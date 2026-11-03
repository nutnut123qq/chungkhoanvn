// Pure indicator helpers: SMA from closes and a factual Vietnamese summary of the latest row.
// The summary states facts only (no advice words).
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

function side(close: number, level: number): string {
  return close > level ? "trên" : close < level ? "dưới" : "bằng";
}

/** Latest indicator row → short factual sentences. Null fields are skipped; null row → []. */
export function summarizeIndicators(ind: Indicators | null): string[] {
  if (!ind) return [];
  const out: string[] = [];
  const { close, sma50, sma200, rsi14, macdHistogram, bollingerUpper, bollingerMiddle, bollingerLower, atr14 } = ind;

  if (close !== null) {
    const parts: string[] = [];
    if (sma50 !== null) parts.push(`${side(close, sma50)} SMA50 (${formatNumber(sma50)})`);
    if (sma200 !== null) parts.push(`${side(close, sma200)} SMA200 (${formatNumber(sma200)})`);
    if (parts.length > 0) out.push(`Giá đóng cửa ${formatNumber(close)} nằm ${parts.join(" và ")}.`);
  }
  if (sma50 !== null && sma200 !== null && sma50 !== sma200) {
    out.push(`SMA50 đang ${sma50 > sma200 ? "trên" : "dưới"} SMA200.`);
  }
  if (rsi14 !== null) {
    const zone = rsi14 >= 70 ? " (từ 70 trở lên)" : rsi14 <= 30 ? " (từ 30 trở xuống)" : "";
    out.push(`RSI14 = ${formatNumber(rsi14)}${zone}.`);
  }
  if (macdHistogram !== null) {
    out.push(`MACD histogram ${macdHistogram > 0 ? "dương" : macdHistogram < 0 ? "âm" : "bằng 0"}.`);
  }
  if (close !== null && bollingerUpper !== null && bollingerLower !== null) {
    if (close > bollingerUpper) out.push("Giá nằm trên dải Bollinger trên.");
    else if (close < bollingerLower) out.push("Giá nằm dưới dải Bollinger dưới.");
    else if (bollingerMiddle !== null) {
      out.push(`Giá nằm ở nửa ${close >= bollingerMiddle ? "trên" : "dưới"} dải Bollinger.`);
    }
  }
  if (atr14 !== null && close !== null && close > 0) {
    out.push(`ATR14 = ${formatNumber(atr14)}, bằng ${formatNumber((atr14 / close) * 100, 1)}% giá đóng cửa.`);
  }
  return out;
}
