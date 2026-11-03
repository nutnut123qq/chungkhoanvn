import Link from "next/link";
import Pct from "../components/Pct.tsx";
import { loadSiteData, type Horizon } from "../lib/data.ts";
import { directionLabel, formatDate, formatNumber, formatVnDateTime, scoreText } from "../lib/format.ts";

const HORIZONS: Horizon[] = ["3", "6", "12"];

export default function HomePage() {
  const { meta, screen, symbols } = loadSiteData();
  const notices = [
    screen.basket.possiblyStale && "Rổ VN30 có thể đã cũ (đã quá lâu kể từ kỳ xét duyệt gần nhất).",
    screen.missingSessionBar.length > 0 && `Chưa có nến phiên ${formatDate(screen.session)}: ${screen.missingSessionBar.join(", ")}.`,
    screen.notUpToDate.length > 0 && `Dữ liệu chưa cập nhật tới phiên mới nhất: ${screen.notUpToDate.join(", ")}.`,
  ].filter((n): n is string => typeof n === "string");

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">Bảng VN30</h1>
        <p className="mt-1 text-sm text-slate-600">
          Phiên {formatDate(screen.session)} · cập nhật {formatVnDateTime(meta.generatedAtUtc)} (giờ Việt Nam)
          {screen.basket.effectiveDate && <> · rổ hiệu lực từ {formatDate(screen.basket.effectiveDate)}</>}
        </p>
      </section>

      <section aria-labelledby="vnindex">
        <h2 id="vnindex" className="text-sm font-semibold text-slate-700">VNINDEX</h2>
        <dl className="mt-2 grid grid-cols-3 gap-2 sm:max-w-md">
          {HORIZONS.map((h) => (
            <div key={h} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <dt className="text-xs text-slate-600">{h} tháng</dt>
              <dd className="text-lg font-semibold"><Pct value={screen.indexReturns[h]} /></dd>
            </div>
          ))}
        </dl>
      </section>

      {notices.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {notices.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}

      <section aria-labelledby="bang">
        <h2 id="bang" className="sr-only">Bảng xếp hạng VN30</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[44rem] text-sm">
            <caption className="sr-only">
              30 mã VN30 xếp theo lợi nhuận {screen.rankingMonths} tháng; mỗi ô lợi nhuận kèm chênh lệch so với VNINDEX.
            </caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th scope="col" className="px-3 py-2 text-right font-medium">Hạng {screen.rankingMonths}T</th>
                <th scope="col" className="sticky left-0 bg-slate-50 px-3 py-2 font-medium">Mã</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Giá đóng cửa</th>
                {HORIZONS.map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 text-right font-medium">
                    {h}T<span className="block font-normal">so VNINDEX</span>
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 font-medium">Nhận định mới nhất</th>
                <th scope="col" className="px-3 py-2 font-medium">Điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {screen.rows.map((row) => {
                const data = symbols[row.symbol];
                const latest = data.notes[0];
                return (
                  <tr key={row.symbol}>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{row.rank ?? "—"}</td>
                    <td className="sticky left-0 bg-white px-3 py-2 font-semibold whitespace-nowrap shadow-[1px_0_0_#f1f5f9]">
                      <Link href={`/ma/${row.symbol}/`} className="text-blue-700 underline hover:text-blue-900">
                        {row.symbol}
                      </Link>
                      {row.top && (
                        <span className="ml-1 text-amber-600" title={`Top ${screen.topK} theo ${screen.rankingMonths} tháng`}>
                          ★<span className="sr-only"> top {screen.topK}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.close)}</td>
                    {HORIZONS.map((h) => (
                      <td key={h} className="px-3 py-2 text-right whitespace-nowrap">
                        <Pct value={row.returns[h]} className="font-medium" />
                        <Pct value={row.excessVsIndex[h]} className="block text-xs" />
                      </td>
                    ))}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {latest ? (
                        <>
                          {directionLabel(latest.direction)}
                          <span className="block text-xs text-slate-500">{formatDate(latest.signalDate)}</span>
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-700">{scoreText(data.score)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-y-1 text-sm text-slate-600">
          <p>
            ★ = {screen.topK} mã có lợi nhuận {screen.rankingMonths} tháng cao nhất. Dòng nhỏ dưới mỗi ô là chênh lệch so với
            VNINDEX cùng kỳ. Điểm là số nhận định đã đủ 20 phiên và đúng, trên số đã chấm.
          </p>
          <p>
            Xếp hạng chỉ phản ánh sức mạnh giá trong quá khứ. Bài kiểm tra lịch sử VN30-1 không tìm thấy đủ bằng chứng rằng
            nắm giữ {screen.topK} mã đứng đầu thắng VNINDEX.{" "}
            <Link href="/phuong-phap/" className="underline">Xem phương pháp</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
