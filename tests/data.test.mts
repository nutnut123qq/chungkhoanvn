import { after, test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadSiteData, notesView, parseMeta, parseScreen, parseSymbol, partState, partUnavailable, SCHEMA, thesisWasCut,
  unavailableLines, type Meta,
} from "../lib/data.ts";

const FIXTURE = join(import.meta.dirname, "fixtures", "data");
const readFixture = (rel: string) => JSON.parse(readFileSync(join(FIXTURE, rel), "utf8"));

const temps: string[] = [];
after(() => { for (const d of temps) rmSync(d, { recursive: true, force: true }); });

/** A copy of the fixture set, edited, in a fresh directory (loadSiteData memoises per directory). */
function variant(edit: (read: (rel: string) => any, write: (rel: string, v: unknown) => void, dir: string) => void): string {
  const dir = mkdtempSync(join(tmpdir(), "vn30-web-data-"));
  temps.push(dir);
  cpSync(FIXTURE, dir, { recursive: true });
  edit((rel) => JSON.parse(readFileSync(join(dir, rel), "utf8")), (rel, v) => writeFileSync(join(dir, rel), JSON.stringify(v)), dir);
  return dir;
}

test("the v2 fixture set loads and keeps nulls as null", () => {
  const { meta, screen, symbols } = loadSiteData(FIXTURE);
  assert.equal(SCHEMA, "vn30-web-data/v2");
  assert.equal(meta.schema, "vn30-web-data/v2");
  assert.deepEqual(meta.symbols, ["ACB", "FPT", "HPG", "MBB", "STB", "VCB", "VIC"]);
  assert.deepEqual(Object.keys(symbols).sort(), meta.symbols);
  assert.deepEqual(screen.rows.map((r) => r.symbol), ["VIC", "MBB", "ACB", "VCB", "STB", "HPG", "FPT"]);
  assert.equal(screen.rows[6].rank, null);
  assert.equal(screen.rows[6].returns["6"], null);
  assert.equal(symbols.FPT.indicators, null);
  assert.equal(symbols.FPT.relativeStrength, null);
  assert.equal(symbols.FPT.score, null);
  assert.equal(symbols.HPG.score, null);
  assert.deepEqual(symbols.HPG.notes, []);
  assert.equal(symbols.VIC.indicators?.sma200, null);
  assert.equal(symbols.VIC.notes[0].thesis, null);
  assert.equal(symbols.STB.relativeStrength, null);
  assert.deepEqual(symbols.STB.score, { scored: 0, hits: 0, baselineHits: 0, sampleStatus: "no-data" });
  // The score is the backend's whole-journal total, not a count of the exported notes (2 scored, 1 hit here).
  assert.deepEqual(symbols.MBB.score, { scored: 7, hits: 3, baselineHits: 4, sampleStatus: "insufficient-sample" });
  assert.deepEqual(symbols.MBB.notes.filter((n) => n.status === "scored").map((n) => n.hit), [true, false]);
  assert.deepEqual(new Set(symbols.MBB.notes.map((n) => n.status)), new Set([
    "pending", "scored", "no-view", "out-of-window-not-scored", "window-undetermined-not-scored",
  ]));
  assert.deepEqual(new Set(symbols.MBB.notes.map((n) => n.pendingReason)), new Set([
    "immature", "target-bar-missing", null, "signal-bar-missing", "calendar-coverage-expired",
  ]));
});

test("a v1 data set is rejected (meta schema and the old score shape)", () => {
  assert.throws(() => parseMeta({ ...readFixture("meta.json"), schema: "vn30-web-data/v1" }), /meta\.json\.schema.*vn30-web-data\/v2/);
  const dir = variant((read, write) => write("meta.json", { ...read("meta.json"), schema: "vn30-web-data/v1" }));
  assert.throws(() => loadSiteData(dir), /meta\.json\.schema/);
  const mbb = readFixture("symbols/MBB.json");
  mbb.score = { scored: 2, hits: 1 };
  assert.throws(() => parseSymbol(mbb, "MBB"), /score.*thiếu trường "baselineHits"/);
});

test("a missing key fails even where null would be allowed", () => {
  const mbb = readFixture("symbols/MBB.json");
  delete mbb.indicators.sma200;
  assert.throws(() => parseSymbol(mbb, "MBB"), /indicators.*thiếu trường "sma200"/);
  const noScore = readFixture("symbols/MBB.json");
  delete noScore.score;
  assert.throws(() => parseSymbol(noScore, "MBB"), /thiếu trường "score"/);
  const screen = readFixture("screen.json");
  delete screen.rows[0].rank;
  assert.throws(() => parseScreen(screen), /rows\[0\].*"rank"/);
});

test("unknown enum values, other horizons and impossible combinations fail with the field path", () => {
  const cases: [string, (s: Record<string, any>) => void, RegExp][] = [
    ["direction", (s) => { s.notes[0].direction = "buy"; }, /notes\[0\]\.direction.*"buy"/],
    ["status resolved (backend name)", (s) => { s.notes[2].status = "resolved"; }, /notes\[2\]\.status.*"resolved"/],
    ["status superseded", (s) => { s.notes[4].status = "superseded-not-scored"; }, /notes\[4\]\.status/],
    ["status retrospective", (s) => { s.notes[6].status = "retrospective-not-scored"; }, /notes\[6\]\.status/],
    ["status no-declared-thresholds", (s) => { s.notes[7].status = "no-declared-thresholds"; }, /notes\[7\]\.status/],
    ["pendingReason", (s) => { s.notes[0].pendingReason = "late"; }, /notes\[0\]\.pendingReason.*"late"/],
    ["horizon 60", (s) => { s.notes[3].horizonSessions = 60; }, /notes\[3\]\.horizonSessions.*20/],
    ["hit on a pending note", (s) => { s.notes[0].hit = true; }, /notes\[0\]\.hit/],
    ["scored note without hit", (s) => { s.notes[2].hit = null; }, /notes\[2\]\.hit/],
    ["scored note without return", (s) => { s.notes[2].returnPct = null; }, /notes\[2\].*returnPct/],
    ["scored note with a pending reason", (s) => { s.notes[3].pendingReason = "immature"; }, /notes\[3\]/],
    ["pending note without reason", (s) => { s.notes[1].pendingReason = null; }, /notes\[1\]\.pendingReason/],
    ["no-view direction scored", (s) => { s.notes[2].direction = "no-view"; }, /notes\[2\]\.direction/],
    ["no-view status with a direction", (s) => { s.notes[4].direction = "up"; }, /notes\[4\]\.status/],
    ["hit as text", (s) => { s.notes[3].hit = "yes"; }, /notes\[3\]\.hit/],
    ["returnPct as text", (s) => { s.notes[3].returnPct = "5%"; }, /notes\[3\]\.returnPct/],
    ["candle width", (s) => { s.candles[0].pop(); }, /candles\[0\]/],
    ["candle order", (s) => { s.candles[1][0] = s.candles[0][0]; }, /candles\[1\].*tăng dần/],
    ["candle volume 0", (s) => { s.candles[3][5] = 0; }, /candles\[3\]\[5\]/],
    ["too many candles", (s) => { s.candles = Array.from({ length: 261 }, (_, i) => [`2025-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`, 1, 1, 1, 1, 1]); }, /nhiều hơn 260/],
    ["price as string", (s) => { s.candles[2][4] = "19000"; }, /candles\[2\]\[4\]/],
    ["symbol", (s) => { s.symbol = "BID"; }, /cần "MBB"/],
    ["relativeStrength", (s) => { s.relativeStrength = { "20": 0.01 }; }, /relativeStrength.*"60"/],
  ];
  for (const [name, mutate, pattern] of cases) {
    const s = readFixture("symbols/MBB.json");
    mutate(s);
    assert.throws(() => parseSymbol(s, "MBB"), pattern, name);
  }
});

test("notes must be newest first; equal signal dates are allowed", () => {
  const s = readFixture("symbols/MBB.json");
  [s.notes[2], s.notes[3]] = [s.notes[3], s.notes[2]];
  assert.throws(() => parseSymbol(s, "MBB"), /notes\[3\].*mới nhất trước/);
  const same = readFixture("symbols/MBB.json");
  same.notes[1].signalDate = same.notes[0].signalDate;
  assert.equal(parseSymbol(same, "MBB").notes.length, 9);
  const many = readFixture("symbols/MBB.json");
  many.notes = Array.from({ length: 61 }, () => ({ ...many.notes[1] }));
  assert.throws(() => parseSymbol(many, "MBB"), /nhiều hơn 60 nhận định/);
});

test("score: object of four fields or null, consistent with itself and with notes", () => {
  const cases: [string, unknown, RegExp][] = [
    ["number", 3, /score: phải là object/],
    ["array", [1, 2], /score: phải là object/],
    ["no sampleStatus", { scored: 7, hits: 3, baselineHits: 4 }, /thiếu trường "sampleStatus"/],
    ["unknown sampleStatus", { scored: 7, hits: 3, baselineHits: 4, sampleStatus: "maybe" }, /score\.sampleStatus.*"maybe"/],
    ["hits above scored", { scored: 7, hits: 8, baselineHits: 4, sampleStatus: "ok" }, /score\.hits/],
    ["baseline above scored", { scored: 7, hits: 3, baselineHits: 9, sampleStatus: "ok" }, /score\.baselineHits/],
    ["negative", { scored: 7, hits: -1, baselineHits: 4, sampleStatus: "ok" }, /score\.hits/],
    ["no-data with scored notes", { scored: 7, hits: 3, baselineHits: 4, sampleStatus: "no-data" }, /score\.sampleStatus/],
    ["ok with nothing scored", { scored: 0, hits: 0, baselineHits: 0, sampleStatus: "ok" }, /score\.sampleStatus/],
    ["null with notes", null, /score: null nhưng notes không rỗng/],
  ];
  for (const [name, score, pattern] of cases) {
    const s = readFixture("symbols/MBB.json");
    s.score = score;
    assert.throws(() => parseSymbol(s, "MBB"), pattern, name);
  }
  const fpt = readFixture("symbols/FPT.json");
  assert.equal(parseSymbol(fpt, "FPT").score, null);
});

test("thesis: at most 1500 characters (code points); the cut marker is recognised", () => {
  const mbb = readFixture("symbols/MBB.json");
  const cut: string = mbb.notes[0].thesis;
  assert.equal([...cut].length, 1500);
  assert.equal(thesisWasCut(cut), true);
  assert.equal(thesisWasCut("Short text…"), false);
  assert.equal(thesisWasCut(`${"a".repeat(1500)}`), false);
  const long = readFixture("symbols/MBB.json");
  long.notes[0].thesis = `${cut.slice(0, -1)}x…`;
  assert.throws(() => parseSymbol(long, "MBB"), /notes\[0\]\.thesis.*1500/);
  const astral = readFixture("symbols/MBB.json");
  astral.notes[0].thesis = "📈".repeat(1500); // 3000 UTF-16 units, 1500 characters
  assert.equal(parseSymbol(astral, "MBB").notes[0].thesis?.length, 3000);
});

test("meta.unavailable: known ticker, known part, non-empty reason", () => {
  const meta = readFixture("meta.json");
  assert.throws(() => parseMeta({ ...meta, unavailable: [{ symbol: "XYZ", part: "notes", reason: "HTTP 500" }] }), /không có trong symbols/);
  assert.throws(() => parseMeta({ ...meta, unavailable: [{ symbol: "MBB", part: "prices", reason: "HTTP 500" }] }), /unavailable\[0\]\.part.*"prices"/);
  assert.throws(() => parseMeta({ ...meta, unavailable: [{ symbol: "MBB", part: "notes", reason: " " }] }), /reason: rỗng/);
});

test("tickers must be plain alphanumeric (they become URL segments)", () => {
  const meta = readFixture("meta.json");
  assert.throws(() => parseMeta({ ...meta, symbols: ["../etc"] }), /mã không hợp lệ/);
  assert.throws(() => parseMeta({ ...meta, symbols: ["MBB", "MBB"] }), /trùng/);
});

test("cross-file checks: missing symbol file, session mismatch, score null or notes against meta.unavailable", () => {
  assert.throws(() => loadSiteData(variant((_r, _w, dir) => rmSync(join(dir, "symbols", "VIC.json")))), /symbols\/VIC\.json/);
  assert.throws(() => loadSiteData(variant((read, write) => write("screen.json", { ...read("screen.json"), session: "2026-11-02" }))),
    /screen\.json\.session/);
  // score null although the notes part was read fresh.
  assert.throws(() => loadSiteData(variant((read, write) => write("symbols/STB.json", { ...read("symbols/STB.json"), score: null }))),
    /STB\.json\.score: null nhưng meta\.unavailable/);
  // notes present although the part is listed as not read with nothing kept.
  assert.throws(() => loadSiteData(variant((read, write) => {
    const meta = read("meta.json");
    meta.unavailable.push({ symbol: "VIC", part: "notes", reason: "HTTP 500; chưa có dữ liệu lượt trước" });
    write("meta.json", meta);
  })), /VIC\.json\.notes: meta\.unavailable ghi chưa lấy được/);
  // A kept part may be empty (the previous run had nothing either).
  const keptEmpty = variant((read, write) => {
    const meta = read("meta.json");
    meta.unavailable = meta.unavailable.map((u: any) => (u.symbol === "HPG" && u.part === "notes" ? { ...u, reason: "HTTP 401; giữ dữ liệu lượt trước" } : u));
    write("meta.json", meta);
  });
  assert.equal(loadSiteData(keptEmpty).symbols.HPG.score, null);
});

test("partUnavailable and partState read meta.unavailable per part", () => {
  const { meta } = loadSiteData(FIXTURE);
  assert.equal(partUnavailable(meta, "MBB", "notes"), null);
  assert.deepEqual(partUnavailable(meta, "ACB", "notes"), { kept: true, nothingKept: false, reasons: ["HTTP 500"] });
  assert.deepEqual(partUnavailable(meta, "HPG", "notes"), { kept: false, nothingKept: true, reasons: ["HTTP 401"] });
  assert.deepEqual(partUnavailable(meta, "HPG", "technical"), { kept: true, nothingKept: false, reasons: ["HTTP 429"] });
  assert.deepEqual(partUnavailable(meta, "FPT", "technical"), {
    kept: false, nothingKept: false, reasons: ["backend chưa hỗ trợ mã này (UNSUPPORTED_CAPABILITY)"],
  });
  assert.equal(partUnavailable(meta, "VCB", "notes"), null);
  assert.equal(partState(meta, "MBB", "notes"), "fresh");
  assert.equal(partState(meta, "ACB", "notes"), "kept");
  assert.equal(partState(meta, "ACB", "technical"), "fresh");
  assert.equal(partState(meta, "HPG", "notes"), "missing");
  assert.equal(partState(meta, "HPG", "technical"), "kept");
  assert.equal(partState(meta, "FPT", "notes"), "missing");
  assert.equal(partState(meta, "FPT", "candles"), "fresh");
  // A candles failure keeps the whole previous file: every part of VCB is the previous run's.
  assert.equal(partState(meta, "VCB", "candles"), "kept");
  assert.equal(partState(meta, "VCB", "technical"), "kept");
  assert.equal(partState(meta, "VCB", "notes"), "kept");
  // Duplicate entries of one part collapse; the suffixes are not part of the reasons.
  const dup: Meta = { ...meta, unavailable: [
    { symbol: "MBB", part: "technical", reason: "backend chưa có chỉ báo 1d" },
    { symbol: "MBB", part: "technical", reason: "backend chưa có chỉ báo 1d" },
    { symbol: "MBB", part: "technical", reason: "chưa có sức mạnh tương đối" },
  ] };
  assert.deepEqual(partUnavailable(dup, "MBB", "technical")?.reasons, ["backend chưa có chỉ báo 1d", "chưa có sức mạnh tương đối"]);
});

test("notesView: unknown when the part is missing or the score is null, kept when copied", () => {
  const { meta, symbols } = loadSiteData(FIXTURE);
  const view = (s: string) => notesView(meta, s, symbols[s].score);
  assert.deepEqual(view("MBB"), { known: true, kept: false });
  assert.deepEqual(view("STB"), { known: true, kept: false });
  assert.deepEqual(view("ACB"), { known: true, kept: true });
  assert.deepEqual(view("VCB"), { known: true, kept: true });
  assert.deepEqual(view("HPG"), { known: false, kept: false });
  assert.deepEqual(view("FPT"), { known: false, kept: false });
  // Kept from a previous run that had nothing: still unknown.
  const keptNull: Meta = { ...meta, unavailable: [{ symbol: "HPG", part: "notes", reason: "HTTP 401; giữ dữ liệu lượt trước" }] };
  assert.deepEqual(notesView(keptNull, "HPG", null), { known: false, kept: true });
});

test("unavailableLines: one sentence per group, each part named once, with the reason", () => {
  const { meta } = loadSiteData(FIXTURE);
  assert.deepEqual(unavailableLines(meta, "MBB"), []);
  assert.deepEqual(unavailableLines(meta, "FPT"), [
    "Chưa lấy được chỉ báo kỹ thuật và nhận định: backend chưa hỗ trợ mã này (UNSUPPORTED_CAPABILITY).",
  ]);
  assert.deepEqual(unavailableLines(meta, "HPG"), [
    "Lượt cập nhật gần nhất chưa lấy được chỉ báo kỹ thuật: HTTP 429. Phần chỉ báo kỹ thuật trên trang này là của lượt cập nhật trước.",
    "Lượt cập nhật gần nhất chưa lấy được nhận định: HTTP 401. Chưa có dữ liệu lượt trước để hiện thay.",
  ]);
  assert.deepEqual(unavailableLines(meta, "VCB"), [
    "Lượt cập nhật gần nhất chưa lấy được nến: HTTP 502. Biểu đồ, chỉ báo và nhận định trên trang này là của lượt cập nhật trước.",
  ]);
  const dup: Meta = { ...meta, unavailable: [
    { symbol: "MBB", part: "technical", reason: "backend chưa có chỉ báo 1d" },
    { symbol: "MBB", part: "technical", reason: "chưa có sức mạnh tương đối" },
    { symbol: "MBB", part: "technical", reason: "backend chưa có chỉ báo 1d" },
  ] };
  const lines = unavailableLines(dup, "MBB");
  assert.deepEqual(lines, ["Chưa lấy được chỉ báo kỹ thuật: backend chưa có chỉ báo 1d; chưa có sức mạnh tương đối."]);
  assert.equal(lines.join(" ").split("chỉ báo kỹ thuật").length - 1, 1);
});
