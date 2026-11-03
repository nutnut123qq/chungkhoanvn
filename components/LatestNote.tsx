import { NOTE_HORIZON, THESIS_MAX, thesisWasCut, type Note, type NotesView } from "../lib/data.ts";
import { directionLabel, formatDate, formatNumber, noteStatusLabel } from "../lib/format.ts";

/** The latest 20-session note of a ticker; `view` says whether the notes part is known and whether it was kept. */
export default function LatestNote({ note, view }: { note: Note | undefined; view: NotesView }) {
  if (!view.known) {
    return <p className="text-sm text-slate-600">Chưa lấy được nhận định của mã này ở lượt cập nhật gần nhất.</p>;
  }
  const kept = view.kept && (
    <p className="text-xs text-amber-800">Của lượt cập nhật trước (lượt gần nhất chưa lấy được nhận định).</p>
  );
  if (!note) {
    return (
      <div className="space-y-2">
        {kept}
        <p className="text-sm text-slate-600">Chưa có nhận định {NOTE_HORIZON} phiên nào cho mã này.</p>
      </div>
    );
  }
  const facts: [string, string][] = [
    ["Kỳ hạn", `${note.horizonSessions} phiên`],
    ["Ngày tín hiệu", formatDate(note.signalDate)],
    ["Ngày chấm", formatDate(note.targetDate)],
    ["Trạng thái", noteStatusLabel(note)],
  ];
  return (
    <div className="space-y-3">
      {kept}
      <p className="text-2xl font-bold">{directionLabel(note.direction)}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-600">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {note.thesis ? (
        <details className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">Lập luận gốc của AI (tiếng Anh)</summary>
          <p lang="en" className="mt-2 whitespace-pre-line text-slate-700">{note.thesis}</p>
          {thesisWasCut(note.thesis) && (
            <p className="mt-2 text-xs text-slate-600">
              Lập luận dài hơn {formatNumber(THESIS_MAX)} ký tự đã được cắt; dấu … đánh dấu chỗ cắt.
            </p>
          )}
        </details>
      ) : (
        <p className="text-xs text-slate-600">
          Không hiển thị lập luận gốc: nhận định không có lập luận, hoặc lập luận bị ẩn vì nhắc tới thông tin ngoài phạm
          vi kỹ thuật.
        </p>
      )}
    </div>
  );
}
