import Link from "next/link";
import {
  KEPT_NOTE, NOTE_HORIZON, NULL_WORDS, nullText, THESIS_MAX, thesisWasCut, type Note, type NotesView,
} from "../lib/data.ts";
import { directionLabel, formatDate, formatNumber, noteStatusLabel } from "../lib/format.ts";

/**
 * A letter outside A-Z: a precomposed one (ă, đ, ế, Đ…) or a combining mark (a decomposed tone mark). Only the writing
 * instructions from v7 ask for English, so a thesis is called English, and marked lang="en", only when it has no such
 * letter: a Vietnamese thesis is never called English.
 */
const NON_ENGLISH_LETTER = /(?![A-Za-z])[\p{L}\p{M}]/u;

/** The latest 20-session note of a ticker; `view` gives the notes part's state, and whether it can be shown. */
export default function LatestNote({ note, view }: { note: Note | undefined; view: NotesView }) {
  if (!view.known) return <p className="text-sm text-slate-600">{nullText(NULL_WORDS.notes, view.state, view.reasons)}</p>;
  const kept = view.kept && (
    <p className="text-xs text-amber-800">{KEPT_NOTE} (lượt cập nhật gần nhất chưa lấy được nhận định).</p>
  );
  if (!note) {
    return (
      <div className="space-y-2">
        {kept}
        <p className="text-sm text-slate-600">Chưa có nhận định {NOTE_HORIZON} phiên nào được đăng cho mã này.</p>
      </div>
    );
  }
  const facts: [string, string][] = [
    ["Kỳ hạn", `${note.horizonSessions} phiên`],
    ["Ngày tín hiệu", formatDate(note.signalDate)],
    ["Ngày chấm", formatDate(note.targetDate)],
    ["Trạng thái", noteStatusLabel(note)],
  ];
  const english = note.thesis !== null && !NON_ENGLISH_LETTER.test(note.thesis);
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
          <summary className="cursor-pointer font-medium">
            {english ? "Lập luận gốc của AI (tiếng Anh)" : "Lập luận gốc của AI"}
          </summary>
          <p lang={english ? "en" : undefined} className="mt-2 whitespace-pre-line text-slate-700">{note.thesis}</p>
          {thesisWasCut(note.thesis) && (
            <p className="mt-2 text-xs text-slate-600">
              Lập luận dài hơn {formatNumber(THESIS_MAX)} ký tự đã được cắt; dấu … đánh dấu chỗ cắt.
            </p>
          )}
        </details>
      ) : (
        // Generic on purpose: a note with no thesis, or a thesis the keyword filter hid. The first rule leaves a note out
        // whole (r5), so it is never the cause here; the card names no rule, so nothing here can point at one note.
        <p className="text-xs text-slate-600">
          Không hiển thị lập luận gốc: nhận định không có lập luận, hoặc lập luận đã bị luật tự động ẩn. Luật tự động
          đôi khi ẩn cả lập luận chỉ có nội dung kỹ thuật; xem trang{" "}
          <Link href="/phuong-phap/" className="underline">Phương pháp và giới hạn</Link>.
        </p>
      )}
    </div>
  );
}
