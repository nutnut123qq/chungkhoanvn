import { test } from "node:test";
import assert from "node:assert/strict";
import { INDICATOR_KEYS, type Indicators } from "../lib/data.ts";
import { sma, summarizeIndicators } from "../lib/indicators.ts";

function row(values: Partial<Indicators>): Indicators {
  const r = { date: "2026-11-03" } as Indicators;
  for (const k of INDICATOR_KEYS) r[k] = null;
  return { ...r, ...values };
}

// Whole-word check that works with Vietnamese letters (\b is ASCII-only in JS).
const ADVICE = new Set(["nên", "mua", "bán", "khuyến", "khuyên"]);
function adviceWords(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => ADVICE.has(w));
}

test("sma averages a sliding window and skips the warm-up", () => {
  assert.deepEqual(sma([1, 2, 3, 4, 5], 3), [
    { index: 2, value: 2 },
    { index: 3, value: 3 },
    { index: 4, value: 4 },
  ]);
  assert.deepEqual(sma([1, 2], 3), []);
  assert.deepEqual(sma([10], 1), [{ index: 0, value: 10 }]);
  assert.throws(() => sma([1, 2, 3], 0));
});

test("sma of 260 closes with period 200 has 61 points ending at the last close", () => {
  const closes = Array.from({ length: 260 }, (_, i) => i + 1);
  const s = sma(closes, 200);
  assert.equal(s.length, 61);
  assert.equal(s[0].index, 199);
  assert.equal(s[0].value, 100.5);
  assert.equal(s.at(-1)?.value, 160.5);
});

test("summary states the facts for a full row", () => {
  const lines = summarizeIndicators(row({
    close: 18750, sma50: 19877.4, sma200: 21004.2, rsi14: 38.24, macdHistogram: -70.4,
    bollingerUpper: 20600, bollingerMiddle: 19500, bollingerLower: 18400, atr14: 512.3,
  }));
  assert.deepEqual(lines, [
    "Giá đóng cửa 18.750 nằm dưới SMA50 (19.877) và dưới SMA200 (21.004).",
    "SMA50 đang dưới SMA200.",
    "RSI14 = 38.",
    "MACD histogram âm.",
    "Giá nằm ở nửa dưới dải Bollinger.",
    "ATR14 = 512, bằng 2,7% giá đóng cửa.",
  ]);
  assert.deepEqual(adviceWords(lines.join(" ")), []);
});

test("summary covers the upper side and the RSI zones", () => {
  const lines = summarizeIndicators(row({
    close: 25000, sma50: 22000, sma200: 21000, rsi14: 74, macdHistogram: 12,
    bollingerUpper: 24000, bollingerMiddle: 22000, bollingerLower: 20000,
  }));
  assert.ok(lines.includes("Giá đóng cửa 25.000 nằm trên SMA50 (22.000) và trên SMA200 (21.000)."));
  assert.ok(lines.includes("SMA50 đang trên SMA200."));
  assert.ok(lines.includes("RSI14 = 74 (từ 70 trở lên)."));
  assert.ok(lines.includes("MACD histogram dương."));
  assert.ok(lines.includes("Giá nằm trên dải Bollinger trên."));
  assert.ok(summarizeIndicators(row({ rsi14: 25 })).includes("RSI14 = 25 (từ 30 trở xuống)."));
  assert.ok(summarizeIndicators(row({ close: 100, bollingerUpper: 120, bollingerLower: 105 }))
    .includes("Giá nằm dưới dải Bollinger dưới."));
  assert.ok(summarizeIndicators(row({ macdHistogram: 0 })).includes("MACD histogram bằng 0."));
});

test("summary skips null fields and returns [] for a null row", () => {
  assert.deepEqual(summarizeIndicators(null), []);
  assert.deepEqual(summarizeIndicators(row({})), []);
  // Only SMA50 known: no SMA200 clause, no SMA cross sentence, no Bollinger without the middle band.
  assert.deepEqual(summarizeIndicators(row({ close: 18750, sma50: 19877.4, bollingerUpper: 20000, bollingerLower: 18000 })), [
    "Giá đóng cửa 18.750 nằm dưới SMA50 (19.877).",
  ]);
  // No close: nothing that compares with price, but RSI still shows.
  assert.deepEqual(summarizeIndicators(row({ sma50: 1, sma200: 2, rsi14: 50, atr14: 10 })), [
    "SMA50 đang dưới SMA200.",
    "RSI14 = 50.",
  ]);
  for (const line of summarizeIndicators(row({ close: 1, sma50: 1, sma200: 1 }))) {
    assert.doesNotMatch(line, /null|undefined|NaN/);
  }
});
