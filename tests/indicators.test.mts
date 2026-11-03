import { test } from "node:test";
import assert from "node:assert/strict";
import { INDICATOR_KEYS, type Indicators } from "../lib/data.ts";
import { formatNumber } from "../lib/format.ts";
import { comparePrinted, indicatorsOlderThan, sma, summarizeIndicators } from "../lib/indicators.ts";

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
    "RSI14 = 38,2.",
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
  assert.ok(lines.includes("RSI14 = 74,0 (từ 70 trở lên)."));
  assert.ok(lines.includes("MACD histogram dương."));
  assert.ok(lines.includes("Giá nằm trên dải Bollinger trên."));
  assert.ok(summarizeIndicators(row({ rsi14: 25 })).includes("RSI14 = 25,0 (từ 30 trở xuống)."));
  assert.ok(summarizeIndicators(row({ close: 100, bollingerUpper: 120, bollingerLower: 105 }))
    .includes("Giá nằm dưới dải Bollinger dưới."));
  assert.ok(summarizeIndicators(row({ macdHistogram: 0 })).includes("MACD histogram bằng 0."));
});

test("comparisons agree with the numbers as printed (no 'dưới 19.877 (19.877)')", () => {
  assert.equal(comparePrinted(19877, 19877.4, 0), 0);
  assert.equal(comparePrinted(19877, 19877.6, 0), -1);
  assert.equal(comparePrinted(69.96, 70, 1), 0);
  assert.equal(comparePrinted(69.94, 70, 1), -1);
  assert.deepEqual(summarizeIndicators(row({ close: 19877, sma50: 19877.4, sma200: 19876.6 })), [
    "Giá đóng cửa 19.877 nằm ở mức SMA50 (19.877) và ở mức SMA200 (19.877).",
    "SMA50 đang ở mức SMA200.",
  ]);
  assert.deepEqual(summarizeIndicators(row({ close: 19877, sma50: 19877.6 })), ["Giá đóng cửa 19.877 nằm dưới SMA50 (19.878)."]);
  // RSI is printed with one decimal, like the indicator table; the zone follows the printed value.
  assert.deepEqual(summarizeIndicators(row({ rsi14: 69.96 })), ["RSI14 = 70,0 (từ 70 trở lên)."]);
  assert.deepEqual(summarizeIndicators(row({ rsi14: 69.94 })), ["RSI14 = 69,9."]);
  assert.deepEqual(summarizeIndicators(row({ rsi14: 30.04 })), ["RSI14 = 30,0 (từ 30 trở xuống)."]);
  assert.deepEqual(summarizeIndicators(row({ rsi14: 30.06 })), ["RSI14 = 30,1."]);
  // The histogram row prints "0,0" for -0.04: the sentence must not call it negative.
  assert.equal(formatNumber(-0.04, 1), "0,0");
  assert.deepEqual(summarizeIndicators(row({ macdHistogram: -0.04 })), ["MACD histogram xấp xỉ 0."]);
  assert.deepEqual(summarizeIndicators(row({ macdHistogram: -0.06 })), ["MACD histogram âm."]);
  // Bollinger bands at printed equality.
  assert.ok(summarizeIndicators(row({ close: 20000, bollingerUpper: 19999.6, bollingerLower: 18000 }))
    .includes("Giá nằm ở mức dải Bollinger trên."));
  assert.ok(summarizeIndicators(row({ close: 18000, bollingerUpper: 20000, bollingerLower: 18000.4 }))
    .includes("Giá nằm ở mức dải Bollinger dưới."));
  assert.ok(summarizeIndicators(row({ close: 19000.2, bollingerUpper: 20000, bollingerMiddle: 19000, bollingerLower: 18000 }))
    .includes("Giá nằm ở mức đường giữa dải Bollinger."));
});

test("every printed comparison is consistent over a grid of near-equal values", () => {
  const parse = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
  for (let i = 0; i < 400; i++) {
    const close = 19000 + i * 0.25;
    const level = 19050;
    const [line] = summarizeIndicators(row({ close, sma50: level }));
    const m = /^Giá đóng cửa ([\d.]+) nằm (trên|dưới|ở mức) SMA50 \(([\d.]+)\)\.$/.exec(line);
    assert.ok(m, line);
    const [shownClose, word, shownLevel] = [parse(m[1]), m[2], parse(m[3])];
    const expected = shownClose > shownLevel ? "trên" : shownClose < shownLevel ? "dưới" : "ở mức";
    assert.equal(word, expected, line);
  }
});

test("indicatorsOlderThan flags only a row from an earlier session", () => {
  assert.equal(indicatorsOlderThan("2026-10-31", "2026-11-03"), true);
  assert.equal(indicatorsOlderThan("2026-11-03", "2026-11-03"), false);
  // The screen file can lag the indicator row (a failed 16:20 screen run): newer is not "older".
  assert.equal(indicatorsOlderThan("2026-11-04", "2026-11-03"), false);
  assert.equal(indicatorsOlderThan(null, "2026-11-03"), false);
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
    "RSI14 = 50,0.",
  ]);
  for (const line of summarizeIndicators(row({ close: 1, sma50: 1, sma200: 1 }))) {
    assert.doesNotMatch(line, /null|undefined|NaN/);
  }
});
