import { NOTE_HORIZON, type NotesView, type Score } from "../lib/data.ts";
import { baselineText, sampleLongLabel, scoreText } from "../lib/format.ts";

/** The ticker's whole-journal score for 20-session notes, with the rule's baseline and sample status beside it. */
export default function ScoreSummary({ score, view }: { score: Score | null; view: NotesView }) {
  if (!view.known || !score) {
    return (
      <p className="text-sm text-slate-600">
        <span className="font-semibold">—</span> Chưa lấy được nhận định của mã này ở lượt cập nhật gần nhất.
      </p>
    );
  }
  const kept = view.kept && <p className="text-xs text-amber-800">Của lượt cập nhật trước.</p>;
  const baseline = baselineText(score);
  if (baseline === null) {
    return (
      <div className="space-y-2">
        {kept}
        <p className="text-sm">
          <span className="font-semibold">{scoreText(score)}</span>: chưa có nhận định {NOTE_HORIZON} phiên nào của mã
          đủ kỳ hạn để chấm.
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
        Tính trên toàn bộ {score.scored} nhận định {NOTE_HORIZON} phiên đã chấm của mã, kể cả những nhận định không còn
        trong bảng lịch sử. Mốc so sánh là số lần đúng nếu mỗi lần chỉ đoán kết quả xảy ra nhiều nhất trong lịch sử của
        mã tính tới phiên tín hiệu. Đây là số đếm, không phải xác suất.
      </p>
    </div>
  );
}
