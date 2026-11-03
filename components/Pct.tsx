import { formatPercent } from "../lib/format.ts";

/** Signed percent from a fraction, green when positive and red when negative; null → "—". */
export default function Pct({ value, className = "" }: { value: number | null; className?: string }) {
  const text = formatPercent(value);
  const tone = value === null || text.startsWith("0,0") ? "text-slate-700" : value > 0 ? "text-green-700" : "text-red-700";
  return <span className={`tabular-nums ${tone} ${className}`}>{text}</span>;
}
