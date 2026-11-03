import { NOTE_HORIZON, NOTE_LIMIT, type Note, type NotesView } from "../lib/data.ts";
import { directionLabel, formatDate, noteStatusLabel } from "../lib/format.ts";
import Pct from "./Pct.tsx";

/** History of 20-session notes, newest first; `view` says whether the notes part is known and whether it was kept. */
export default function NotesTable({ notes, view }: { notes: Note[]; view: NotesView }) {
  if (!view.known) {
    return <p className="text-sm text-slate-600">Chưa lấy được lịch sử nhận định của mã này ở lượt cập nhật gần nhất.</p>;
  }
  const kept = view.kept && (
    <p className="mb-2 text-xs text-amber-800">Của lượt cập nhật trước (lượt gần nhất chưa lấy được nhận định).</p>
  );
  if (notes.length === 0) {
    return (
      <>
        {kept}
        <p className="text-sm text-slate-600">Chưa có nhận định {NOTE_HORIZON} phiên nào.</p>
      </>
    );
  }
  return (
    <>
      {kept}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[34rem] text-sm whitespace-nowrap">
          <caption className="sr-only">
            Lịch sử nhận định {NOTE_HORIZON} phiên, mới nhất trước, tối đa {NOTE_LIMIT} nhận định
          </caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Ngày tín hiệu</th>
              <th scope="col" className="px-3 py-2 font-medium">Nhận định</th>
              <th scope="col" className="px-3 py-2 font-medium">Ngày chấm</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Lợi nhuận {NOTE_HORIZON} phiên</th>
              <th scope="col" className="px-3 py-2 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {notes.map((n, i) => (
              <tr key={`${n.signalDate}-${i}`}>
                <td className="px-3 py-2 tabular-nums">{formatDate(n.signalDate)}</td>
                <td className="px-3 py-2">{directionLabel(n.direction)}</td>
                <td className="px-3 py-2 tabular-nums">{formatDate(n.targetDate)}</td>
                <td className="px-3 py-2 text-right"><Pct value={n.returnPct} /></td>
                <td className={`px-3 py-2 ${n.hit === true ? "text-green-700" : n.hit === false ? "text-red-700" : "text-slate-700"}`}>
                  {noteStatusLabel(n)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
