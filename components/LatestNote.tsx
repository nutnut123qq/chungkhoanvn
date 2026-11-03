import type { Note } from "../lib/data.ts";
import { directionLabel, formatDate, noteStatusLabel, scoreText } from "../lib/format.ts";

export default function LatestNote({ note, score }: { note: Note | undefined; score: { scored: number; hits: number } }) {
  if (!note) return <p className="text-sm text-slate-600">Chưa có nhận định cho mã này.</p>;
  const facts: [string, string][] = [
    ["Kỳ hạn", `${note.horizonSessions} phiên`],
    ["Ngày tín hiệu", formatDate(note.signalDate)],
    ["Ngày chấm", formatDate(note.targetDate)],
    ["Trạng thái", noteStatusLabel(note)],
    ["Điểm của mã", scoreText(score)],
  ];
  return (
    <div className="space-y-3">
      <p className="text-2xl font-bold">{directionLabel(note.direction)}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-600">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {note.thesis && (
        <details className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">Lập luận gốc của AI (tiếng Anh)</summary>
          <p lang="en" className="mt-2 whitespace-pre-line text-slate-700">{note.thesis}</p>
        </details>
      )}
    </div>
  );
}
