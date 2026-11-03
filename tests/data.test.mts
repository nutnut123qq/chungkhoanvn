import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSiteData, parseMeta, parseScreen, parseSymbol } from "../lib/data.ts";

const FIXTURE = join(import.meta.dirname, "fixtures", "data");
const readFixture = (rel: string) => JSON.parse(readFileSync(join(FIXTURE, rel), "utf8"));

test("the fixture set loads and keeps nulls as null", () => {
  const { meta, screen, symbols } = loadSiteData(FIXTURE);
  assert.equal(meta.schema, "vn30-web-data/v1");
  assert.deepEqual(meta.symbols, ["FPT", "MBB", "VIC"]);
  assert.deepEqual(Object.keys(symbols).sort(), ["FPT", "MBB", "VIC"]);
  assert.deepEqual(screen.rows.map((r) => r.symbol), ["VIC", "MBB", "FPT"]);
  assert.equal(screen.rows[2].rank, null);
  assert.equal(screen.rows[2].returns["6"], null);
  assert.equal(symbols.FPT.indicators, null);
  assert.deepEqual(symbols.FPT.notes, []);
  assert.equal(symbols.VIC.indicators?.sma200, null);
  assert.equal(symbols.MBB.isBank, true);
  assert.deepEqual(symbols.MBB.notes.map((n) => n.hit), [null, true, false, null]);
  assert.deepEqual(symbols.MBB.score, { scored: 2, hits: 1 });
});

test("a wrong schema name fails loudly", () => {
  assert.throws(() => parseMeta({ ...readFixture("meta.json"), schema: "vn30-web-data/v2" }), /meta\.json\.schema/);
});

test("a missing key fails even where null would be allowed", () => {
  const mbb = readFixture("symbols/MBB.json");
  delete mbb.indicators.sma200;
  assert.throws(() => parseSymbol(mbb, "MBB"), /indicators.*thiếu trường "sma200"/);
  const screen = readFixture("screen.json");
  delete screen.rows[0].rank;
  assert.throws(() => parseScreen(screen), /rows\[0\].*"rank"/);
});

test("wrong types and values fail with the field path", () => {
  const cases: [string, (s: Record<string, any>) => void, RegExp][] = [
    ["direction", (s) => { s.notes[0].direction = "buy"; }, /notes\[0\]\.direction/],
    ["hit", (s) => { s.notes[1].hit = "yes"; }, /notes\[1\]\.hit/],
    ["candle width", (s) => { s.candles[0].pop(); }, /candles\[0\]/],
    ["candle order", (s) => { s.candles[1][0] = s.candles[0][0]; }, /candles\[1\].*tăng dần/],
    ["price as string", (s) => { s.candles[2][4] = "19000"; }, /candles\[2\]\[4\]/],
    ["returnPct", (s) => { s.notes[1].returnPct = "5%"; }, /notes\[1\]\.returnPct/],
    ["score", (s) => { s.score.hits = 9; }, /score/],
    ["symbol", (s) => { s.symbol = "BID"; }, /cần "MBB"/],
    ["relativeStrength", (s) => { s.relativeStrength = { "20": 0.01 }; }, /relativeStrength.*"60"/],
  ];
  for (const [name, mutate, pattern] of cases) {
    const s = readFixture("symbols/MBB.json");
    mutate(s);
    assert.throws(() => parseSymbol(s, "MBB"), pattern, name);
  }
});

test("tickers must be plain alphanumeric (they become URL segments)", () => {
  const meta = readFixture("meta.json");
  assert.throws(() => parseMeta({ ...meta, symbols: ["../etc"] }), /mã không hợp lệ/);
  assert.throws(() => parseMeta({ ...meta, symbols: ["MBB", "MBB"] }), /trùng/);
});

test("cross-file checks: missing symbol file and session mismatch", () => {
  const dir = mkdtempSync(join(tmpdir(), "vn30-web-"));
  try {
    cpSync(FIXTURE, dir, { recursive: true });
    rmSync(join(dir, "symbols", "VIC.json"));
    assert.throws(() => loadSiteData(dir), /symbols\/VIC\.json/);

    cpSync(FIXTURE, dir, { recursive: true });
    const screen = readFixture("screen.json");
    writeFileSync(join(dir, "screen.json"), JSON.stringify({ ...screen, session: "2026-11-02" }));
    assert.throws(() => loadSiteData(dir), /screen\.json\.session/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
