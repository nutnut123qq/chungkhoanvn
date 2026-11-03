import type { Indicators } from "../lib/data.ts";
import { formatDate, formatNumber } from "../lib/format.ts";
import { summarizeIndicators } from "../lib/indicators.ts";

const ROWS: [keyof Indicators, string, number][] = [
  ["close", "Giá đóng cửa", 0],
  ["sma50", "SMA50", 0],
  ["sma200", "SMA200", 0],
  ["ema12", "EMA12", 0],
  ["ema26", "EMA26", 0],
  ["ema50", "EMA50", 0],
  ["ema200", "EMA200", 0],
  ["rsi14", "RSI14", 1],
  ["macd", "MACD", 1],
  ["macdSignal", "MACD tín hiệu", 1],
  ["macdHistogram", "MACD histogram", 1],
  ["bollingerUpper", "Bollinger trên", 0],
  ["bollingerMiddle", "Bollinger giữa", 0],
  ["bollingerLower", "Bollinger dưới", 0],
  ["atr14", "ATR14", 0],
];

export default function IndicatorPanel({ indicators, session }: { indicators: Indicators | null; session: string }) {
  if (!indicators) {
    return <p className="text-sm text-slate-600">Chưa có dữ liệu chỉ báo kỹ thuật cho mã này.</p>;
  }
  const summary = summarizeIndicators(indicators);
  const older = indicators.date !== null && indicators.date !== session;
  return (
    <div className="space-y-3">
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
