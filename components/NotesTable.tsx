import type { Note } from "../lib/data.ts";
import { directionLabel, formatDate, noteStatusLabel } from "../lib/format.ts";
import Pct from "./Pct.tsx";

export default function NotesTable({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return <p className="text-sm text-slate-600">Chưa có nhận định nào.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[36rem] text-sm whitespace-nowrap">
        <caption className="sr-only">Lịch sử nhận định, mới nhất trước</caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-600">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Ngày tín hiệu</th>
            <th scope="col" className="px-3 py-2 font-medium">Nhận định</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Kỳ hạn</th>
            <th scope="col" className="px-3 py-2 font-medium">Ngày chấm</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Lợi nhuận sau kỳ hạn</th>
            <th scope="col" className="px-3 py-2 font-medium">Trạng thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {notes.map((n, i) => (
            <tr key={`${n.signalDate}-${n.horizonSessions}-${i}`}>
              <td className="px-3 py-2 tabular-nums">{formatDate(n.signalDate)}</td>
              <td className="px-3 py-2">{directionLabel(n.direction)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{n.horizonSessions} phiên</td>
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
  );
}
