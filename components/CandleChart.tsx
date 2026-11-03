"use client";

import { useEffect, useRef } from "react";
import { CandlestickSeries, ColorType, createChart, LineSeries, TickMarkType, type Time } from "lightweight-charts";
import type { Candle } from "../lib/data.ts";
import { sma } from "../lib/indicators.ts";

// The default vi-VN tick labels mix "Tháng 2" with a bare "3"; use one explicit style instead.
function tickLabel(time: Time, type: TickMarkType): string | null {
  const t = typeof time === "string" ? time.split("-").map(Number) : typeof time === "object" ? [time.year, time.month, time.day] : null;
  if (!t) return null;
  const [year, month, day] = t;
  if (type === TickMarkType.Year) return String(year);
  if (type === TickMarkType.Month) return `T${month}`;
  if (type === TickMarkType.DayOfMonth) return `${day}/${month}`;
  return null;
}

const SMA_LINES = [
  { period: 50, color: "#2563eb", title: "SMA50" },
  { period: 200, color: "#d97706", title: "SMA200" },
];

export default function CandleChart({ symbol, candles }: { symbol: string; candles: Candle[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || candles.length === 0) return;
    const priceFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#374151", fontSize: 12 },
      grid: { vertLines: { color: "#f1f5f9" }, horzLines: { color: "#f1f5f9" } },
      rightPriceScale: { borderColor: "#e5e7eb" },
      timeScale: { borderColor: "#e5e7eb", tickMarkFormatter: tickLabel },
      localization: { locale: "vi-VN", dateFormat: "dd/MM/yyyy", priceFormatter: (p: number) => priceFormat.format(p) },
      // The wheel and vertical swipes must scroll the page, not the chart; drag and pinch still pan/zoom.
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
    });
    chart
      .addSeries(CandlestickSeries, {
        upColor: "#16a34a", downColor: "#dc2626", borderVisible: false,
        wickUpColor: "#16a34a", wickDownColor: "#dc2626",
      })
      .setData(candles.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
    const closes = candles.map((c) => c[4]);
    for (const line of SMA_LINES) {
      const points = sma(closes, line.period);
      if (points.length === 0) continue;
      chart
        .addSeries(LineSeries, {
          color: line.color, lineWidth: 2,
          priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
        })
        .setData(points.map((p) => ({ time: candles[p.index][0], value: p.value })));
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles]);

  if (candles.length === 0) return <p className="text-sm text-slate-600">Chưa có dữ liệu nến cho mã này.</p>;

  const drawn = SMA_LINES.filter((l) => candles.length >= l.period);
  const missing = SMA_LINES.filter((l) => candles.length < l.period).map((l) => l.title);
  return (
    <figure>
      <div
        ref={ref}
        role="img"
        aria-label={`Biểu đồ nến ngày của ${symbol}, ${candles.length} phiên${drawn.length ? `, kèm ${drawn.map((l) => l.title).join(" và ")}` : ""}`}
        className="h-80 w-full sm:h-[26rem]"
      />
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {drawn.map((l) => (
          <span key={l.title}>
            <span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: l.color }} />
            {l.title}
          </span>
        ))}
        <span>{candles.length} phiên gần nhất, giá điều chỉnh</span>
        {missing.length > 0 && <span>Chưa đủ phiên để vẽ {missing.join(", ")}</span>}
      </figcaption>
    </figure>
  );
}
