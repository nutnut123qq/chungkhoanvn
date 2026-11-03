import { after, test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadSiteData, notesView, NULL_WORDS, nullText, PARTS, parseMeta, parseScreen, parseSymbol, partReasons, partState,
  partUnavailable, SCHEMA, technicalCardReasons, thesisWasCut, unavailableLines, type Meta,
} from "../lib/data.ts";

const FIXTURE = join(import.meta.dirname, "fixtures", "data");
const readFixture = (rel: string) => JSON.parse(readFileSync(join(FIXTURE, rel), "utf8"));

const temps: string[] = [];
after(() => { for (const d of temps) rmSync(d, { recursive: true, force: true }); });

type Read = (rel: string) => any;
type Write = (rel: string, v: unknown) => void;

/** A copy of the fixture set, edited, in a fresh directory (loadSiteData memoises per directory). */
function variant(edit: (read: Read, write: Write, dir: string) => void): string {
  const dir = mkdtempSync(join(tmpdir(), "vn30-web-data-"));
  temps.push(dir);
  cpSync(FIXTURE, dir, { recursive: true });
  edit((rel) => JSON.parse(readFileSync(join(dir, rel), "utf8")), (rel, v) => writeFileSync(join(dir, rel), JSON.stringify(v)), dir);
  return dir;
}

/** meta.unavailable edited in a variant. */
function editUnavailable(read: Read, write: Write, edit: (list: any[]) => any[]): void {
  const meta = read("meta.json");
  meta.unavailable = edit(meta.unavailable);
  write("meta.json", meta);
}

const lines = (dir: string, s: string) => {
  const { meta, symbols } = loadSiteData(dir);
  return unavailableLines(meta, symbols[s]);
};

/** STB in a run without a 1d indicator row and without the VNINDEX benchmark: two entries without suffix. */
function stbBothNull(read: Read, write: Write): void {
  write("symbols/STB.json", { ...read("symbols/STB.json"), indicators: null });
  editUnavailable(read, write, (l) => {
    const at = l.findIndex((u) => u.symbol === "STB");
    return [...l.slice(0, at), { symbol: "STB", part: "technical", reason: "backend chưa có chỉ báo 1d" }, ...l.slice(at)];
  });
}

// The r3 reasons the exporter writes (contract E5): plain Vietnamese, the suffixes unchanged.
const E5_REASON = /^(?:lỗi HTTP \d{3}|phản hồi sai định dạng|backend chưa hỗ trợ mã này|backend chưa có chỉ báo 1d|dữ liệu VNINDEX chưa khớp tới phiên mới nhất của mã|thiếu quyền đọc nhật ký nhận định)(?:; giữ dữ liệu lượt trước|; chưa có dữ liệu lượt trước)?$/;

test("the v2 fixture set loads and keeps nulls as null", () => {
  const { meta, screen, symbols } = loadSiteData(FIXTURE);
  assert.equal(SCHEMA, "vn30-web-data/v2");
  assert.equal(meta.schema, "vn30-web-data/v2");
  assert.deepEqual(meta.symbols, ["ACB", "FPT", "HPG", "MBB", "SSI", "STB", "TCB", "VCB", "VIC"]);
  assert.deepEqual(Object.keys(symbols).sort(), meta.symbols);
  assert.deepEqual(screen.rows.map((r) => r.symbol), ["VIC", "MBB", "ACB", "VCB", "STB", "HPG", "TCB", "SSI", "FPT"]);
  assert.equal(screen.rows[8].rank, null);
  assert.equal(screen.rows[8].returns["6"], null);
  assert.equal(symbols.FPT.indicators, null);
  assert.equal(symbols.FPT.relativeStrength, null);
  assert.equal(symbols.FPT.score, null);
  assert.equal(symbols.HPG.score, null);
  assert.deepEqual(symbols.HPG.notes, []);
  assert.equal(symbols.VIC.indicators?.sma200, null);
  assert.equal(symbols.VIC.notes[0].thesis, null);
  assert.equal(symbols.STB.relativeStrength, null);
  assert.deepEqual(symbols.STB.score, { scored: 0, hits: 0, baselineHits: 0, sampleStatus: "no-data" });
  assert.equal(symbols.SSI.indicators, null);
  assert.deepEqual(symbols.SSI.relativeStrength, { "20": -0.012, "60": 0.027 });
  // TCB: kept whole from a run in which technical and notes were not served.
  assert.equal(symbols.TCB.candles.at(-1)?.[0], "2026-11-02");
  assert.deepEqual([symbols.TCB.indicators, symbols.TCB.relativeStrength, symbols.TCB.notes, symbols.TCB.score], [null, null, [], null]);
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

test("fixtures are producer-shaped: every part state the exporter writes, with the r3 (E5) reasons", () => {
  const { meta } = loadSiteData(FIXTURE);
  const states = Object.fromEntries(meta.symbols.map((s) => [s, PARTS.map((p) => partState(meta, s, p)).join(" ")]));
  assert.deepEqual(states, {
    ACB: "fresh fresh kept", // notes kept (HTTP error)
    FPT: "fresh empty empty", // technical and notes not served
    HPG: "fresh kept missing", // technical kept; notes failed with nothing to keep
    MBB: "fresh fresh fresh",
    SSI: "fresh empty fresh", // no 1d indicator row
    STB: "fresh empty fresh", // VNINDEX benchmark not "ok"
    TCB: "kept kept kept", // candles failed: the whole previous file, with null parts
    VCB: "kept kept kept", // candles failed: the whole previous file, every part with data
    VIC: "fresh fresh fresh",
  });
  for (const u of meta.unavailable) assert.match(u.reason, E5_REASON, `${u.symbol} ${u.part}`);
  // Entries in the exporter's order: tickers sorted, then candles, technical, notes.
  const order = meta.unavailable.map((u) => `${u.symbol} ${PARTS.indexOf(u.part)}`);
  assert.deepEqual(order, [...order].sort());
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
  assert.throws(() => parseMeta({ ...meta, unavailable: [{ symbol: "XYZ", part: "notes", reason: "lỗi HTTP 500" }] }), /không có trong symbols/);
  assert.throws(() => parseMeta({ ...meta, unavailable: [{ symbol: "MBB", part: "prices", reason: "lỗi HTTP 500" }] }), /unavailable\[0\]\.part.*"prices"/);
  assert.throws(() => parseMeta({ ...meta, unavailable: [{ symbol: "MBB", part: "notes", reason: " " }] }), /reason: rỗng/);
});

test("tickers must be plain alphanumeric (they become URL segments)", () => {
  const meta = readFixture("meta.json");
  assert.throws(() => parseMeta({ ...meta, symbols: ["../etc"] }), /mã không hợp lệ/);
  assert.throws(() => parseMeta({ ...meta, symbols: ["MBB", "MBB"] }), /trùng/);
});

test("cross-file checks: missing symbol file, session mismatch", () => {
  assert.throws(() => loadSiteData(variant((_r, _w, dir) => rmSync(join(dir, "symbols", "VIC.json")))), /symbols\/VIC\.json/);
  assert.throws(() => loadSiteData(variant((read, write) => write("screen.json", { ...read("screen.json"), session: "2026-11-02" }))),
    /screen\.json\.session/);
});

test("a part's values must match its state as the exporter writes it; any other combination fails the build", () => {
  const nothingKept = "lỗi HTTP 500; chưa có dữ liệu lượt trước";
  const noScore = { scored: 0, hits: 0, baselineHits: 0, sampleStatus: "no-data" };
  const cases: [string, (read: Read, write: Write) => void, RegExp][] = [
    // Technical read fresh: the exporter lists every null (STB without its entry is the r2 fixture).
    ["relativeStrength null without its entry", (read, write) => editUnavailable(read, write, (l) => l.filter((u) => u.symbol !== "STB")),
      /STB\.json\.relativeStrength: null nhưng meta\.unavailable không có phần technical/],
    ["indicators null without its entry", (read, write) => write("symbols/MBB.json", { ...read("symbols/MBB.json"), indicators: null }),
      /MBB\.json\.indicators: null nhưng meta\.unavailable không có phần technical/],
    // An entry without suffix stands for a null value.
    ["empty technical with both values", (read, write) => write("symbols/STB.json", { ...read("symbols/STB.json"), relativeStrength: { "20": 0.01, "60": 0.02 } }),
      /STB\.json\.indicators: meta\.unavailable ghi phần technical trống/],
    // Not read with nothing kept: written empty.
    ["missing technical with values", (read, write) => editUnavailable(read, write, (l) => [...l, { symbol: "MBB", part: "technical", reason: nothingKept }]),
      /MBB\.json\.indicators: meta\.unavailable ghi chưa lấy được phần technical/],
    // Kept on its own: holds something (with nothing to keep the exporter writes NOTHING_KEPT instead).
    ["kept technical with nothing", (read, write) => write("symbols/HPG.json", { ...read("symbols/HPG.json"), indicators: null, relativeStrength: null }),
      /HPG\.json\.indicators: meta\.unavailable ghi giữ phần technical/],
    ["fresh notes with score null", (read, write) => write("symbols/STB.json", { ...read("symbols/STB.json"), score: null }),
      /STB\.json\.score: null nhưng meta\.unavailable không có phần notes/],
    ["missing notes with notes", (read, write) => editUnavailable(read, write, (l) => [...l, { symbol: "VIC", part: "notes", reason: nothingKept }]),
      /VIC\.json\.notes: meta\.unavailable ghi phần notes là "missing"/],
    ["empty notes (not served) with a score object", (read, write) => write("symbols/FPT.json", { ...read("symbols/FPT.json"), score: noScore }),
      /FPT\.json\.notes: meta\.unavailable ghi phần notes là "empty"/],
    ["kept notes with score null", (read, write) => write("symbols/ACB.json", { ...read("symbols/ACB.json"), notes: [], score: null }),
      /ACB\.json\.score: null nhưng meta\.unavailable ghi giữ phần notes/],
    ["missing candles with candles", (read, write) => editUnavailable(read, write, (l) => [...l, { symbol: "VIC", part: "candles", reason: nothingKept }]),
      /VIC\.json\.candles: không rỗng nhưng meta\.unavailable ghi phần candles là "missing"/],
    ["empty candles (not served) with candles", (read, write) => editUnavailable(read, write, (l) => [...l, { symbol: "VIC", part: "candles", reason: "backend chưa hỗ trợ mã này" }]),
      /VIC\.json\.candles: không rỗng nhưng meta\.unavailable ghi phần candles là "empty"/],
  ];
  for (const [name, edit, pattern] of cases) assert.throws(() => loadSiteData(variant(edit)), pattern, name);
});

test("producer states that load: null parts in a file kept whole, one null in a kept part, two empty reasons", () => {
  // TCB (fixtures): candles kept whole, every other part null in that file; the notes part is then kept with no score.
  assert.equal(loadSiteData(FIXTURE).symbols.TCB.score, null);
  // A technical part kept on its own may lack one value: the earlier run had no VNINDEX benchmark.
  const keptOne = variant((read, write) => write("symbols/HPG.json", { ...read("symbols/HPG.json"), relativeStrength: null }));
  assert.equal(loadSiteData(keptOne).symbols.HPG.relativeStrength, null);
  // One run without an indicator row and without the benchmark: two entries without suffix, indicators before strength.
  const both = variant(stbBothNull);
  assert.equal(partState(loadSiteData(both).meta, "STB", "technical"), "empty");
  // Candles not served (400 on /candles): written empty, the other parts read on.
  const noCandles = variant((read, write) => {
    write("symbols/VIC.json", { ...read("symbols/VIC.json"), candles: [] });
    editUnavailable(read, write, (l) => [...l, { symbol: "VIC", part: "candles", reason: "backend chưa hỗ trợ mã này" }]);
  });
  assert.equal(partState(loadSiteData(noCandles).meta, "VIC", "candles"), "empty");
});

test("partUnavailable and partState read the suffixes of meta.unavailable, part by part", () => {
  const { meta } = loadSiteData(FIXTURE);
  assert.equal(partUnavailable(meta, "MBB", "notes"), null);
  assert.deepEqual(partUnavailable(meta, "ACB", "notes"), { kept: true, nothingKept: false, reasons: ["lỗi HTTP 500"] });
  assert.deepEqual(partUnavailable(meta, "HPG", "notes"), { kept: false, nothingKept: true, reasons: ["lỗi HTTP 401"] });
  assert.deepEqual(partUnavailable(meta, "HPG", "technical"), { kept: true, nothingKept: false, reasons: ["lỗi HTTP 429"] });
  assert.deepEqual(partUnavailable(meta, "FPT", "technical"), { kept: false, nothingKept: false, reasons: ["backend chưa hỗ trợ mã này"] });
  assert.deepEqual(partUnavailable(meta, "STB", "technical"), {
    kept: false, nothingKept: false, reasons: ["dữ liệu VNINDEX chưa khớp tới phiên mới nhất của mã"],
  });
  const state = (s: string, p: "candles" | "technical" | "notes") => partState(meta, s, p);
  assert.equal(state("MBB", "notes"), "fresh");
  assert.equal(state("ACB", "notes"), "kept");
  assert.equal(state("ACB", "technical"), "fresh");
  assert.equal(state("HPG", "notes"), "missing");
  assert.equal(state("HPG", "technical"), "kept");
  // An entry without suffix: the backend answered empty or does not serve the part. "empty", never "missing".
  assert.equal(state("FPT", "technical"), "empty");
  assert.equal(state("FPT", "notes"), "empty");
  assert.equal(state("STB", "technical"), "empty");
  assert.equal(state("SSI", "technical"), "empty");
  assert.equal(state("FPT", "candles"), "fresh");
  // A candles failure keeps the whole previous file: every part of VCB and TCB is an earlier export's.
  for (const s of ["VCB", "TCB"]) for (const p of PARTS) assert.equal(state(s, p), "kept", `${s} ${p}`);
  assert.deepEqual(partReasons(meta, "TCB", "candles"), ["lỗi HTTP 500"]);
  assert.deepEqual(partReasons(meta, "TCB", "notes"), []);
  assert.deepEqual(partReasons(meta, "MBB", "technical"), []);
  // Only the suffix counts: the same words give "empty", "missing" or "kept" by suffix alone.
  const only = (reason: string): Meta => ({ ...meta, unavailable: [{ symbol: "MBB", part: "technical", reason }] });
  assert.equal(partState(only("lỗi HTTP 500"), "MBB", "technical"), "empty");
  assert.equal(partState(only("lỗi HTTP 500; chưa có dữ liệu lượt trước"), "MBB", "technical"), "missing");
  assert.equal(partState(only("backend chưa hỗ trợ mã này; giữ dữ liệu lượt trước"), "MBB", "technical"), "kept");
  assert.equal(partState(only("chưa có dữ liệu lượt trước, giữ dữ liệu lượt trước"), "MBB", "technical"), "empty");
  // Duplicate entries of one part collapse; the suffixes are not part of the reasons.
  const dup: Meta = { ...meta, unavailable: [
    { symbol: "MBB", part: "technical", reason: "backend chưa có chỉ báo 1d" },
    { symbol: "MBB", part: "technical", reason: "backend chưa có chỉ báo 1d" },
    { symbol: "MBB", part: "technical", reason: "dữ liệu VNINDEX chưa khớp tới phiên mới nhất của mã" },
  ] };
  assert.deepEqual(partUnavailable(dup, "MBB", "technical")?.reasons, [
    "backend chưa có chỉ báo 1d", "dữ liệu VNINDEX chưa khớp tới phiên mới nhất của mã",
  ]);
});

test("notesView: known only for a part read fresh or kept that has a score; state and reasons go along", () => {
  const { meta, symbols } = loadSiteData(FIXTURE);
  const view = (s: string) => notesView(meta, s, symbols[s].score);
  assert.deepEqual(view("MBB"), { state: "fresh", known: true, kept: false, reasons: [] });
  assert.deepEqual(view("STB"), { state: "fresh", known: true, kept: false, reasons: [] });
  assert.deepEqual(view("ACB"), { state: "kept", known: true, kept: true, reasons: ["lỗi HTTP 500"] });
  assert.deepEqual(view("VCB"), { state: "kept", known: true, kept: true, reasons: [] });
  assert.deepEqual(view("HPG"), { state: "missing", known: false, kept: false, reasons: ["lỗi HTTP 401"] });
  assert.deepEqual(view("FPT"), { state: "empty", known: false, kept: false, reasons: ["backend chưa hỗ trợ mã này"] });
  // The notes part of a file kept whole was null in it: kept, with nothing to show.
  assert.deepEqual(view("TCB"), { state: "kept", known: false, kept: true, reasons: [] });
  // Even with a score object (the loader rejects such data), an empty or missing part is never known.
  const score = { scored: 0, hits: 0, baselineHits: 0, sampleStatus: "no-data" } as const;
  assert.equal(notesView(meta, "FPT", score).known, false);
  assert.equal(notesView(meta, "HPG", score).known, false);
});

test("unavailableLines: one sentence per state and reasons, each part named once, the reasons as written", () => {
  const { meta, symbols } = loadSiteData(FIXTURE);
  const of = (s: string) => unavailableLines(meta, symbols[s]);
  assert.deepEqual(of("MBB"), []);
  assert.deepEqual(of("VIC"), []);
  // empty (no suffix): "Chưa có", never "chưa lấy được"; parts with the same reason share one sentence.
  assert.deepEqual(of("FPT"), ["Chưa có chỉ báo kỹ thuật, sức mạnh tương đối và nhận định: backend chưa hỗ trợ mã này."]);
  // An empty technical part is named by what the file lacks (T2).
  assert.deepEqual(of("STB"), ["Chưa có sức mạnh tương đối so VNINDEX: dữ liệu VNINDEX chưa khớp tới phiên mới nhất của mã."]);
  assert.deepEqual(of("SSI"), ["Chưa có chỉ báo kỹ thuật: backend chưa có chỉ báo 1d."]);
  // missing and kept.
  assert.deepEqual(of("HPG"), [
    "Lượt cập nhật gần nhất chưa lấy được chỉ báo kỹ thuật: lỗi HTTP 429. Phần chỉ báo kỹ thuật trên trang này là dữ liệu giữ từ một lượt cập nhật trước.",
    "Lượt cập nhật gần nhất chưa lấy được nhận định: lỗi HTTP 401. Chưa có dữ liệu lượt trước để hiện thay.",
  ]);
  assert.deepEqual(of("ACB"), [
    "Lượt cập nhật gần nhất chưa lấy được nhận định: lỗi HTTP 500. Phần nhận định trên trang này là dữ liệu giữ từ một lượt cập nhật trước.",
  ]);
  // A file kept whole: the sentence names only what that file holds (T5e).
  assert.deepEqual(of("VCB"), [
    "Lượt cập nhật gần nhất chưa lấy được nến: lỗi HTTP 502. Biểu đồ, chỉ báo kỹ thuật, sức mạnh tương đối và nhận định trên trang này là dữ liệu giữ từ một lượt cập nhật trước.",
  ]);
  assert.deepEqual(of("TCB"), [
    "Lượt cập nhật gần nhất chưa lấy được nến: lỗi HTTP 500. Biểu đồ trên trang này là dữ liệu giữ từ một lượt cập nhật trước.",
  ]);
  // Kept data may be several runs old: never "the previous run".
  for (const s of meta.symbols) for (const line of of(s)) assert.doesNotMatch(line, /của lượt cập nhật trước|lấy từ lượt/, s);
});

test("unavailableLines (T2): an empty technical part is named by its null values; missing and kept name the whole part", () => {
  const both = variant(stbBothNull);
  assert.deepEqual(lines(both, "STB"), [
    "Chưa có chỉ báo kỹ thuật và sức mạnh tương đối: backend chưa có chỉ báo 1d; dữ liệu VNINDEX chưa khớp tới phiên mới nhất của mã.",
  ]);
  // Kept on its own without the relative strength: still the whole part.
  const keptOne = variant((read, write) => write("symbols/HPG.json", { ...read("symbols/HPG.json"), relativeStrength: null }));
  assert.equal(lines(keptOne, "HPG")[0],
    "Lượt cập nhật gần nhất chưa lấy được chỉ báo kỹ thuật: lỗi HTTP 429. Phần chỉ báo kỹ thuật trên trang này là dữ liệu giữ từ một lượt cập nhật trước.");
  // Not read with nothing kept (both values null): the whole part.
  const missing = variant((read, write) => {
    write("symbols/SSI.json", { ...read("symbols/SSI.json"), relativeStrength: null });
    editUnavailable(read, write, (l) => l.map((u) => (u.symbol === "SSI" ? { ...u, reason: "phản hồi sai định dạng; chưa có dữ liệu lượt trước" } : u)));
  });
  assert.deepEqual(lines(missing, "SSI"), [
    "Lượt cập nhật gần nhất chưa lấy được chỉ báo kỹ thuật: phản hồi sai định dạng. Chưa có dữ liệu lượt trước để hiện thay.",
  ]);
  // The reason never picks the label: STB's and SSI's reasons swapped, each label still follows the null value.
  const swapped = variant((read, write) => editUnavailable(read, write, (l) => l.map((u) =>
    u.symbol === "STB" ? { ...u, reason: "backend chưa có chỉ báo 1d" }
      : u.symbol === "SSI" ? { ...u, reason: "dữ liệu VNINDEX chưa khớp tới phiên mới nhất của mã" } : u)));
  assert.deepEqual(lines(swapped, "STB"), ["Chưa có sức mạnh tương đối so VNINDEX: backend chưa có chỉ báo 1d."]);
  assert.deepEqual(lines(swapped, "SSI"), ["Chưa có chỉ báo kỹ thuật: dữ liệu VNINDEX chưa khớp tới phiên mới nhất của mã."]);
  // Candles not served, and candles not read with nothing kept.
  const emptyCandles = variant((read, write) => {
    write("symbols/VIC.json", { ...read("symbols/VIC.json"), candles: [] });
    editUnavailable(read, write, (l) => [...l, { symbol: "VIC", part: "candles", reason: "backend chưa hỗ trợ mã này" }]);
  });
  assert.deepEqual(lines(emptyCandles, "VIC"), ["Chưa có nến: backend chưa hỗ trợ mã này."]);
});

test("unavailableLines groups parts only when both the state and the reasons match (producer states of failed reads)", () => {
  const keptLine = (what: string, reason: string) =>
    `Lượt cập nhật gần nhất chưa lấy được ${what}: ${reason}. Phần ${what} trên trang này là dữ liệu giữ từ một lượt cập nhật trước.`;
  // One reason, two states (HTTP 500 on both reads; technical kept, nothing to keep for the notes): two sentences.
  // Grouped by reason alone, the notes would be called kept data while every notes card says "chưa lấy được".
  const twoStates = variant((read, write) => editUnavailable(read, write, (l) => l.map((u) => (u.symbol !== "HPG" ? u : {
    ...u, reason: u.part === "technical" ? "lỗi HTTP 500; giữ dữ liệu lượt trước" : "lỗi HTTP 500; chưa có dữ liệu lượt trước",
  }))));
  assert.deepEqual(lines(twoStates, "HPG"), [
    keptLine("chỉ báo kỹ thuật", "lỗi HTTP 500"),
    "Lượt cập nhật gần nhất chưa lấy được nhận định: lỗi HTTP 500. Chưa có dữ liệu lượt trước để hiện thay.",
  ]);
  for (const line of lines(twoStates, "HPG")) assert.doesNotMatch(line, /chỉ báo kỹ thuật và nhận định/);
  // One state, two reasons: two sentences, each with its own reason (kept: technical 429 and notes 500; empty:
  // VNINDEX not aligned and notes not served).
  const keptTwoReasons = variant((read, write) => editUnavailable(read, write, (l) => {
    const at = l.findIndex((u) => u.symbol === "ACB");
    return [...l.slice(0, at), { symbol: "ACB", part: "technical", reason: "lỗi HTTP 429; giữ dữ liệu lượt trước" }, ...l.slice(at)];
  }));
  assert.deepEqual(lines(keptTwoReasons, "ACB"), [keptLine("chỉ báo kỹ thuật", "lỗi HTTP 429"), keptLine("nhận định", "lỗi HTTP 500")]);
  const emptyTwoReasons = variant((read, write) => {
    write("symbols/STB.json", { ...read("symbols/STB.json"), score: null });
    editUnavailable(read, write, (l) => {
      const at = l.findIndex((u) => u.symbol === "STB") + 1;
      return [...l.slice(0, at), { symbol: "STB", part: "notes", reason: "backend chưa hỗ trợ mã này" }, ...l.slice(at)];
    });
  });
  assert.deepEqual(lines(emptyTwoReasons, "STB"), [
    "Chưa có sức mạnh tương đối so VNINDEX: dữ liệu VNINDEX chưa khớp tới phiên mới nhất của mã.",
    "Chưa có nhận định: backend chưa hỗ trợ mã này.",
  ]);
  // One state and one reason (HTTP 500, nothing to keep for either): one sentence naming both parts.
  const oneLine = variant((read, write) => {
    write("symbols/HPG.json", { ...read("symbols/HPG.json"), indicators: null, relativeStrength: null });
    editUnavailable(read, write, (l) => l.map((u) => (u.symbol === "HPG" ? { ...u, reason: "lỗi HTTP 500; chưa có dữ liệu lượt trước" } : u)));
  });
  assert.deepEqual(lines(oneLine, "HPG"), [
    "Lượt cập nhật gần nhất chưa lấy được chỉ báo kỹ thuật và nhận định: lỗi HTTP 500. Chưa có dữ liệu lượt trước để hiện thay.",
  ]);
});

test("technicalCardReasons: the cards point to the line at the top only for both values null with several reasons", () => {
  const { meta, symbols } = loadSiteData(FIXTURE);
  const of = (s: string) => technicalCardReasons(meta, symbols[s]);
  assert.deepEqual(of("FPT"), ["backend chưa hỗ trợ mã này"]); // both null, one reason: it concerns both values
  assert.deepEqual(of("SSI"), ["backend chưa có chỉ báo 1d"]); // one value null
  assert.deepEqual(of("STB"), ["dữ liệu VNINDEX chưa khớp tới phiên mới nhất của mã"]);
  assert.deepEqual(of("HPG"), ["lỗi HTTP 429"]); // kept: the cards show data or say the kept data has none
  assert.deepEqual(of("MBB"), []);
  const both = loadSiteData(variant(stbBothNull));
  assert.equal(technicalCardReasons(both.meta, both.symbols.STB), null);
});

test("nullText: what a card says in place of a null value, from the part state only", () => {
  const w = NULL_WORDS.indicators;
  assert.equal(nullText(w, "empty", ["backend chưa hỗ trợ mã này"]), "Chưa có chỉ báo kỹ thuật cho mã này: backend chưa hỗ trợ mã này.");
  assert.equal(nullText(w, "empty", ["a", "b"]), "Chưa có chỉ báo kỹ thuật cho mã này: a; b.");
  assert.equal(nullText(w, "missing", ["lỗi HTTP 500"]), "Chưa lấy được chỉ báo kỹ thuật của mã này ở lượt cập nhật gần nhất.");
  assert.equal(nullText(w, "kept", []), "Dữ liệu giữ từ một lượt cập nhật trước không có chỉ báo kỹ thuật của mã này.");
  assert.equal(nullText(NULL_WORDS.strength, "empty", ["x"]), "Chưa có sức mạnh tương đối so VNINDEX: x.");
  assert.equal(nullText(NULL_WORDS.notes, "empty", ["x"]), "Chưa có nhận định: x.");
  assert.equal(nullText(NULL_WORDS.candles, "empty", ["x"]), "Chưa có dữ liệu nến cho mã này: x.");
  // Reasons null (technicalCardReasons): the card sends the reader to the line at the top instead.
  assert.equal(nullText(w, "empty", null), "Chưa có chỉ báo kỹ thuật cho mã này (lý do ghi ở đầu trang).");
  assert.equal(nullText(NULL_WORDS.strength, "empty", null), "Chưa có sức mạnh tương đối so VNINDEX (lý do ghi ở đầu trang).");
  for (const [name, words] of Object.entries(NULL_WORDS)) {
    assert.doesNotMatch(nullText(words, "empty", ["x"]), /chưa lấy được/i, name);
    assert.doesNotMatch(nullText(words, "kept", []), /chưa lấy được|lượt cập nhật trước\./i, name);
    assert.match(nullText(words, "kept", []), /^Dữ liệu giữ từ một lượt cập nhật trước không có /, name);
    // The reason of a failed read is in the line at the top of the page, not repeated on every card.
    assert.match(nullText(words, "missing", ["LÝ-DO"]), /^Chưa lấy được .*\.$/, name);
    assert.doesNotMatch(nullText(words, "missing", ["LÝ-DO"]), /LÝ-DO/, name);
  }
});
