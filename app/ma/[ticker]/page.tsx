import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CandleChart from "../../../components/CandleChart.tsx";
import IndicatorPanel from "../../../components/IndicatorPanel.tsx";
import LatestNote from "../../../components/LatestNote.tsx";
import NotesTable from "../../../components/NotesTable.tsx";
import Pct from "../../../components/Pct.tsx";
import ScoreSummary from "../../../components/ScoreSummary.tsx";
import {
  KEPT_NOTE, loadSiteData, NOTE_HORIZON, NOTE_LIMIT, notesView, NULL_WORDS, nullText, partReasons, partState,
  technicalCardReasons, unavailableLines,
} from "../../../lib/data.ts";
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
    description: `Biểu đồ nến, chỉ báo kỹ thuật và nhận định kỹ thuật tự động kỳ hạn ${NOTE_HORIZON} phiên cho ${ticker}, có chấm điểm. Chỉ để tham khảo, không phải khuyến nghị đầu tư.`,
  };
}

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
  const missingLines = unavailableLines(meta, data);
  const candles = partState(meta, ticker, "candles");
  const technical = partState(meta, ticker, "technical");
  const notes = notesView(meta, ticker, data.score);
  const technicalReasons = technicalCardReasons(meta, data);
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
        {missingLines.length > 0 && (
          <ul className="mt-2 space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            {missingLines.map((line) => <li key={line}>{line}</li>)}
          </ul>
        )}
      </div>

      <Card title="Biểu đồ nến ngày">
        {data.candles.length === 0 && candles !== "fresh" ? (
          <p className="text-sm text-slate-600">{nullText(NULL_WORDS.candles, candles, partReasons(meta, ticker, "candles"))}</p>
        ) : (
          <>
            {candles === "kept" && (
              <p className="mb-2 text-xs text-amber-800">{KEPT_NOTE} (lượt cập nhật gần nhất chưa lấy được nến).</p>
            )}
            <CandleChart symbol={ticker} candles={data.candles} />
          </>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Chỉ báo kỹ thuật">
          <IndicatorPanel indicators={data.indicators} session={meta.session} state={technical} reasons={technicalReasons} />
        </Card>
        <div className="space-y-6">
          <Card title="Nhận định AI mới nhất">
            <LatestNote note={data.notes[0]} view={notes} />
          </Card>
          <Card title={`Điểm nhận định ${NOTE_HORIZON} phiên`}>
            <ScoreSummary score={data.score} view={notes} />
          </Card>
          <Card title="Sức mạnh tương đối so với VNINDEX">
            {rs ? (
              <>
                {technical === "kept" && (
                  <p className="mb-2 text-xs text-amber-800">{KEPT_NOTE} (lượt cập nhật gần nhất chưa lấy được).</p>
                )}
                <dl className="grid grid-cols-2 gap-2">
                  {(["20", "60"] as const).map((k) => (
                    <div key={k} className="rounded-md bg-slate-50 px-3 py-2">
                      <dt className="text-xs text-slate-600">{k} phiên</dt>
                      <dd className="text-lg font-semibold"><Pct value={rs[k]} /></dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="text-sm text-slate-600">{nullText(NULL_WORDS.strength, technical, technicalReasons)}</p>
            )}
            <p className="mt-2 text-xs text-slate-600">
              Chênh lệch lợi nhuận của {ticker} so với VNINDEX trong cùng số phiên.
              {data.isBank && " Với mã ngân hàng, trang này không dùng chỉ số so sánh theo nhóm ngân hàng; chỉ hiển thị so với VNINDEX."}
            </p>
          </Card>
        </div>
      </div>

      <section aria-labelledby="lich-su">
        <h2 id="lich-su" className="mb-3 text-base font-semibold">Lịch sử nhận định {NOTE_HORIZON} phiên</h2>
        <NotesTable notes={data.notes} view={notes} />
        <p className="mt-2 text-xs text-slate-600">
          Bảng hiện tối đa {NOTE_LIMIT} nhận định gần nhất. Lợi nhuận {NOTE_HORIZON} phiên tính trên giá đóng cửa điều
          chỉnh của phiên tín hiệu và phiên chấm. Mỗi lượt cập nhật, backend chấm lại cả nhật ký trên giá điều chỉnh đang
          lưu, vì vậy lợi nhuận và kết quả Đúng/Sai của nhận định đã chấm có thể đổi khi giá được điều chỉnh lại.{" "}
          <Link href="/phuong-phap/" className="underline">Cách chấm điểm</Link>
        </p>
      </section>
    </div>
  );
}
