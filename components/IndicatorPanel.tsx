import type { Indicators, PartState } from "../lib/data.ts";
import { formatDate, formatNumber } from "../lib/format.ts";
import { INDICATOR_DIGITS, indicatorsOlderThan, summarizeIndicators } from "../lib/indicators.ts";

const P = INDICATOR_DIGITS.price;

const ROWS: [keyof Indicators, string, number][] = [
  ["close", "Giá đóng cửa", P],
  ["sma50", "SMA50", P],
  ["sma200", "SMA200", P],
  ["ema12", "EMA12", P],
  ["ema26", "EMA26", P],
  ["ema50", "EMA50", P],
  ["ema200", "EMA200", P],
  ["rsi14", "RSI14", INDICATOR_DIGITS.rsi],
  ["macd", "MACD", INDICATOR_DIGITS.macd],
  ["macdSignal", "MACD tín hiệu", INDICATOR_DIGITS.macd],
  ["macdHistogram", "MACD histogram", INDICATOR_DIGITS.macd],
  ["bollingerUpper", "Bollinger trên", P],
  ["bollingerMiddle", "Bollinger giữa", P],
  ["bollingerLower", "Bollinger dưới", P],
  ["atr14", "ATR14", P],
];

/** `state` is the technical part's state in the latest export (fresh, kept from the previous run, or missing). */
export default function IndicatorPanel({
  indicators, session, state,
}: { indicators: Indicators | null; session: string; state: PartState }) {
  if (!indicators) {
    return (
      <p className="text-sm text-slate-600">
        {state === "fresh"
          ? "Chưa có dữ liệu chỉ báo kỹ thuật cho mã này."
          : "Chưa lấy được chỉ báo kỹ thuật của mã này ở lượt cập nhật gần nhất."}
      </p>
    );
  }
  const summary = summarizeIndicators(indicators);
  const older = indicatorsOlderThan(indicators.date, session);
  return (
    <div className="space-y-3">
      {state === "kept" && (
        <p className="text-xs text-amber-800">Số liệu của lượt cập nhật trước (lượt gần nhất chưa lấy được).</p>
      )}
      <p className="text-xs text-slate-600">
        Chỉ báo ngày, phiên {formatDate(indicators.date)}
        {older && <span className="text-amber-800"> (cũ hơn phiên dữ liệu {formatDate(session)})</span>}
      </p>
      {summary.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {summary.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
      <table className="w-full text-sm">
        <caption className="sr-only">Giá trị chỉ báo mới nhất</caption>
        <tbody className="divide-y divide-slate-100">
          {ROWS.map(([key, label, digits]) => (
            <tr key={key}>
              <th scope="row" className="py-1 pr-3 text-left font-normal text-slate-600">{label}</th>
              <td className="py-1 text-right tabular-nums">{formatNumber(indicators[key] as number | null, digits)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
