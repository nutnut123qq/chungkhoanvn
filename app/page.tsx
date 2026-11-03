import Link from "next/link";
import Pct from "../components/Pct.tsx";
import { loadSiteData, NOTE_HORIZON, notesView, type Horizon } from "../lib/data.ts";
import { formatDate, formatNumber, formatVnDateTime, latestNoteCell, scoreCell } from "../lib/format.ts";

const HORIZONS: Horizon[] = ["3", "6", "12"];
/** VN30-1 tested holding the top 10 by 6-month return: a fixed fact, not the screen's current topK. */
const VN30_1_TOP = 10;

export default function HomePage() {
  const { meta, screen, symbols } = loadSiteData();
  const notices = [
    screen.basket.possiblyStale && "Rổ VN30 có thể đã cũ (đã quá lâu kể từ kỳ xét duyệt gần nhất).",
    screen.missingSessionBar.length > 0 && `Chưa có nến phiên ${formatDate(screen.session)}: ${screen.missingSessionBar.join(", ")}.`,
    screen.notUpToDate.length > 0 && `Dữ liệu chưa cập nhật tới phiên mới nhất: ${screen.notUpToDate.join(", ")}.`,
  ].filter((n): n is string => typeof n === "string");

  const rows = screen.rows.map((row) => {
    const data = symbols[row.symbol];
    const view = notesView(meta, row.symbol, data.score);
    return { row, view, latest: latestNoteCell(view, data.notes[0]), score: scoreCell(view, data.score) };
  });
  const anyKept = rows.some((r) => r.view.known && r.view.kept);
  const anyUnknown = rows.some((r) => !r.view.known);

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
              {screen.rows.length} mã của rổ VN30 xếp theo lợi nhuận {screen.rankingMonths} tháng; mỗi ô lợi nhuận kèm
              chênh lệch so với VNINDEX.
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
              {rows.map(({ row, view, latest, score }) => (
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
                  {/* relative: keeps the absolutely positioned sr-only text inside the table's scroll box */}
                  <td className="relative px-3 py-2 whitespace-nowrap">
                    {latest.main}
                    {view.known && view.kept && (
                      <span className="text-amber-700" title="Lấy từ lượt cập nhật trước">
                        *<span className="sr-only"> (lấy từ lượt cập nhật trước)</span>
                      </span>
                    )}
                    {latest.sub && <span className="block text-xs text-slate-500">{latest.sub}</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                    {score.main}
                    {score.sub && <span className="block text-xs text-slate-500">{score.sub}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-y-1 text-sm text-slate-600">
          <p>
            ★ = {screen.topK} mã có lợi nhuận {screen.rankingMonths} tháng cao nhất. Dòng nhỏ dưới mỗi ô lợi nhuận là chênh
            lệch so với VNINDEX cùng kỳ.
          </p>
          <p>
            Nhận định mới nhất là hướng của nhận định kỳ hạn {NOTE_HORIZON} phiên gần nhất, kèm ngày tín hiệu. Điểm “x/y
            đúng”: trong toàn bộ y nhận định {NOTE_HORIZON} phiên đã chấm của mã, x nhận định đúng; “mốc z/y”: mốc so sánh
            của luật đúng z lần trên cùng y nhận định; “mẫu nhỏ”: chưa đủ 30 nhận định đã chấm có kỳ hạn không chồng lên
            nhau. Đây là số đếm, không phải xác suất.
          </p>
          {anyUnknown && <p>Ô “—” ở hai cột này: lượt cập nhật gần nhất chưa lấy được nhận định của mã đó.</p>}
          {anyKept && <p>Dấu * : nhận định và điểm của mã lấy từ lượt cập nhật trước, vì lượt gần nhất chưa lấy được.</p>}
          <p>
            Xếp hạng chỉ phản ánh sức mạnh giá trong quá khứ. Bài kiểm tra lịch sử VN30-1 không tìm thấy đủ bằng chứng rằng
            nắm giữ {VN30_1_TOP} mã có lợi nhuận 6 tháng cao nhất thắng VNINDEX.{" "}
            <Link href="/phuong-phap/" className="underline">Xem phương pháp</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
