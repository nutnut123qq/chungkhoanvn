import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CandleChart from "../../../components/CandleChart.tsx";
import IndicatorPanel from "../../../components/IndicatorPanel.tsx";
import LatestNote from "../../../components/LatestNote.tsx";
import NotesTable from "../../../components/NotesTable.tsx";
import Pct from "../../../components/Pct.tsx";
import { loadSiteData } from "../../../lib/data.ts";
import { formatDate, formatNumber } from "../../../lib/format.ts";

type Props = { params: Promise<{ ticker: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return loadSiteData().meta.symbols.map((ticker) => ({ ticker }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  return {
    title: `${ticker} — biểu đồ, chỉ báo và nhận định`,
    description: `Biểu đồ nến, chỉ báo kỹ thuật và nhận định tự động 20 phiên cho ${ticker}. Chỉ để tham khảo, không phải khuyến nghị đầu tư.`,
  };
}

const PART_LABELS: Record<string, string> = { technical: "chỉ báo kỹ thuật", notes: "nhận định", candles: "nến" };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4" aria-label={title}>
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function TickerPage({ params }: Props) {
  const { ticker } = await params;
  const { meta, screen, symbols } = loadSiteData();
  const data = symbols[ticker];
  if (!data) notFound();

  const last = data.candles.at(-1);
  const row = screen.rows.find((r) => r.symbol === ticker);
  const close = last ? last[4] : (row?.close ?? null);
  const closeDate = last ? last[0] : screen.session;
  const subtitle = data.label !== ticker && data.label !== `${ticker} (${ticker})` ? data.label : null;
  const missingParts = meta.unavailable.filter((u) => u.symbol === ticker).map((u) => PART_LABELS[u.part] ?? u.part);
  const rs = data.relativeStrength;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-blue-700 underline">← Bảng VN30</Link>
        <h1 className="mt-2 text-2xl font-bold">
          {ticker}
          {data.isBank && (
            <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 align-middle text-xs font-medium text-slate-700">
              Ngân hàng
            </span>
          )}
        </h1>
        {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
        <p className="mt-1 text-sm">
          Giá đóng cửa <span className="font-semibold tabular-nums">{formatNumber(close)}</span>
          <span className="text-slate-600"> · phiên {formatDate(closeDate)}</span>
          {row?.rank != null && <span className="text-slate-600"> · hạng {row.rank} theo {screen.rankingMonths} tháng</span>}
        </p>
        {missingParts.length > 0 && (
          <p className="mt-1 text-xs text-slate-600">
            Lượt cập nhật gần nhất chưa lấy được: {missingParts.join(", ")}.
          </p>
        )}
      </div>

      <Card title="Biểu đồ nến ngày">
        <CandleChart symbol={ticker} candles={data.candles} />
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Chỉ báo kỹ thuật">
          <IndicatorPanel indicators={data.indicators} session={meta.session} />
        </Card>
        <div className="space-y-6">
          <Card title="Nhận định AI mới nhất">
            <LatestNote note={data.notes[0]} score={data.score} />
          </Card>
          <Card title="Sức mạnh tương đối so với VNINDEX">
            {rs ? (
              <dl className="grid grid-cols-2 gap-2">
                {(["20", "60"] as const).map((k) => (
                  <div key={k} className="rounded-md bg-slate-50 px-3 py-2">
                    <dt className="text-xs text-slate-600">{k} phiên</dt>
                    <dd className="text-lg font-semibold"><Pct value={rs[k]} /></dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-slate-600">Chưa có dữ liệu sức mạnh tương đối cho mã này.</p>
            )}
            <p className="mt-2 text-xs text-slate-600">
              Chênh lệch lợi nhuận của {ticker} so với VNINDEX trong cùng số phiên.
              {data.isBank && " Với mã ngân hàng, trang này không dùng chỉ số so sánh theo nhóm ngân hàng; chỉ hiển thị so với VNINDEX."}
            </p>
          </Card>
        </div>
      </div>

      <section aria-labelledby="lich-su">
        <h2 id="lich-su" className="mb-3 text-base font-semibold">Lịch sử nhận định</h2>
        <NotesTable notes={data.notes} />
        <p className="mt-2 text-xs text-slate-600">
          Lợi nhuận tính từ giá đóng cửa phiên tín hiệu tới phiên chấm.{" "}
          <Link href="/phuong-phap/" className="underline">Cách chấm điểm</Link>
        </p>
      </section>
    </div>
  );
}
