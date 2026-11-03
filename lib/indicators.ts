// Pure indicator helpers: SMA from closes and a factual Vietnamese summary of the latest row.
// The summary states facts only (no advice words), and every comparison agrees with the numbers as printed.
import type { Indicators } from "./data.ts";
import { formatNumber } from "./format.ts";

/** Simple moving average; the first `period - 1` points have no value and are omitted. */
export function sma(values: number[], period: number): { index: number; value: number }[] {
  if (!Number.isInteger(period) || period <= 0) throw new Error(`period không hợp lệ: ${period}`);
  const out: { index: number; value: number }[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out.push({ index: i, value: sum / period });
  }
  return out;
}

/** Digits each indicator is printed with, here and in the indicator table. */
export const INDICATOR_DIGITS = { price: 0, rsi: 1, macd: 1 } as const;

/**
 * -1, 0 or 1 comparing a and b as printed with `digits` decimals: equal when both print the same. Rounding is
 * monotonic, so when the printed values differ their order is the order of the raw values.
 */
export function comparePrinted(a: number, b: number, digits: number): -1 | 0 | 1 {
  if (formatNumber(a, digits) === formatNumber(b, digits)) return 0;
  return a < b ? -1 : 1;
}

function side(close: number, level: number): string {
  const c = comparePrinted(close, level, INDICATOR_DIGITS.price);
  return c > 0 ? "trên" : c < 0 ? "dưới" : "ở mức";
}

/** True when the indicator row is from a session before the data session (an indicator row may also be newer). */
export function indicatorsOlderThan(date: string | null, session: string): boolean {
  return date !== null && date < session;
}

/** Latest indicator row → short factual sentences. Null fields are skipped; null row → []. */
export function summarizeIndicators(ind: Indicators | null): string[] {
  if (!ind) return [];
  const out: string[] = [];
  const { close, sma50, sma200, rsi14, macdHistogram, bollingerUpper, bollingerMiddle, bollingerLower, atr14 } = ind;
  const price = (v: number) => formatNumber(v, INDICATOR_DIGITS.price);

  if (close !== null) {
    const parts: string[] = [];
    if (sma50 !== null) parts.push(`${side(close, sma50)} SMA50 (${price(sma50)})`);
    if (sma200 !== null) parts.push(`${side(close, sma200)} SMA200 (${price(sma200)})`);
    if (parts.length > 0) out.push(`Giá đóng cửa ${price(close)} nằm ${parts.join(" và ")}.`);
  }
  if (sma50 !== null && sma200 !== null) {
    const c = comparePrinted(sma50, sma200, INDICATOR_DIGITS.price);
    out.push(`SMA50 đang ${c > 0 ? "trên" : c < 0 ? "dưới" : "ở mức"} SMA200.`);
  }
  if (rsi14 !== null) {
    const d = INDICATOR_DIGITS.rsi;
    const zone = comparePrinted(rsi14, 70, d) >= 0 ? " (từ 70 trở lên)" : comparePrinted(rsi14, 30, d) <= 0 ? " (từ 30 trở xuống)" : "";
    out.push(`RSI14 = ${formatNumber(rsi14, d)}${zone}.`);
  }
  if (macdHistogram !== null) {
    const c = comparePrinted(macdHistogram, 0, INDICATOR_DIGITS.macd);
    const sign = c > 0 ? "dương" : c < 0 ? "âm" : macdHistogram === 0 ? "bằng 0" : "xấp xỉ 0";
    out.push(`MACD histogram ${sign}.`);
  }
  if (close !== null && bollingerUpper !== null && bollingerLower !== null) {
    const d = INDICATOR_DIGITS.price;
    const upper = comparePrinted(close, bollingerUpper, d);
    const lower = comparePrinted(close, bollingerLower, d);
    if (upper > 0) out.push("Giá nằm trên dải Bollinger trên.");
    else if (upper === 0) out.push("Giá nằm ở mức dải Bollinger trên.");
    else if (lower < 0) out.push("Giá nằm dưới dải Bollinger dưới.");
    else if (lower === 0) out.push("Giá nằm ở mức dải Bollinger dưới.");
    else if (bollingerMiddle !== null) {
      const middle = comparePrinted(close, bollingerMiddle, d);
      out.push(middle === 0 ? "Giá nằm ở mức đường giữa dải Bollinger." : `Giá nằm ở nửa ${middle > 0 ? "trên" : "dưới"} dải Bollinger.`);
    }
  }
  if (atr14 !== null && close !== null && close > 0) {
    out.push(`ATR14 = ${price(atr14)}, bằng ${formatNumber((atr14 / close) * 100, 1)}% giá đóng cửa.`);
  }
  return out;
}
