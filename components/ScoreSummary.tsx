import { KEPT_NOTE, NOTE_HORIZON, NULL_WORDS, nullText, type NotesView, type Score } from "../lib/data.ts";
import { baselineText, sampleLongLabel, scoreText } from "../lib/format.ts";

/** The ticker's whole-journal score for 20-session notes, with the rule's baseline and sample status beside it. */
export default function ScoreSummary({ score, view }: { score: Score | null; view: NotesView }) {
  if (!view.known || !score) {
    // "—" mirrors the overview cell of a read that failed; an empty part (not served) just says "chưa có".
    return (
      <p className="text-sm text-slate-600">
        {view.state === "missing" && <><span className="font-semibold">—</span>{" "}</>}
        {nullText(NULL_WORDS.notes, view.state, view.reasons)}
      </p>
    );
  }
  const kept = view.kept && <p className="text-xs text-amber-800">{KEPT_NOTE}.</p>;
  const baseline = baselineText(score);
  if (baseline === null) {
    // Nothing scored yet; the reason (none written, none due, waiting for a bar) is not in the backend's totals.
    return (
      <div className="space-y-2">
        {kept}
        <p className="text-sm">
          <span className="font-semibold">{scoreText(score)}</span>: chưa có nhận định {NOTE_HORIZON} phiên nào được
          chấm.
        </p>
      </div>
    );
  }
  const facts: [string, string][] = [
    ["Nhận định đúng", scoreText(score)],
    ["Mốc so sánh của luật", `${baseline} đúng`],
    ["Mẫu", sampleLongLabel(score.sampleStatus)],
  ];
  return (
    <div className="space-y-2">
      {kept}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-600">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-slate-600">
        Tính trên toàn bộ {score.scored} nhận định {NOTE_HORIZON} phiên đã chấm của mã, kể cả nhận định không hiện trên
        trang. Mốc so sánh là số lần đúng nếu mỗi lần chỉ đoán kết quả xảy ra nhiều nhất trong lịch sử của mã tính tới
        phiên tín hiệu. Đây là số đếm, không phải xác suất.
      </p>
    </div>
  );
}
