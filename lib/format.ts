// Pure vi-VN formatting and labels. `null` always renders as "—", never as 0.
// Imported by the chart (a client component) through indicators.ts: keep it free of runtime imports from data.ts.
import type { Note, NotesView, PendingReason, SampleStatus, Score } from "./data.ts";

export const DASH = "—";

function nf(digits: number, signed: boolean): Intl.NumberFormat {
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    // "negative": a value that rounds to zero prints "0", never "-0" or "-0,0".
    signDisplay: signed ? "exceptZero" : "negative",
  });
}

/** 18750 → "18.750"; 38.24 with digits 1 → "38,2"; -0.04 with digits 1 → "0,0". */
export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return nf(digits, false).format(value);
}

/** Fraction to signed percent: 0.123 → "+12,3%", -0.014 → "-1,4%". */
export function formatPercent(fraction: number | null | undefined, digits = 1): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return DASH;
  return `${nf(digits, true).format(fraction * 100)}%`;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-11-03" → "03/11/2026". */
export function formatDate(iso: string | null | undefined): string {
  const m = iso ? ISO_DATE.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : DASH;
}

/** UTC ISO timestamp → Vietnam time (UTC+7, no DST): "19:05 03/11/2026". */
export function formatVnDateTime(isoUtc: string | null | undefined): string {
  const ms = isoUtc ? Date.parse(isoUtc) : NaN;
  if (!Number.isFinite(ms)) return DASH;
  const d = new Date(ms + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

const DIRECTION_LABELS: Record<string, string> = {
  up: "Tăng",
  down: "Giảm",
  sideways: "Đi ngang",
  "no-view": "Không nhận định",
};

export function directionLabel(direction: string | null | undefined): string {
  return (direction && DIRECTION_LABELS[direction]) || DASH;
}

/** Why a directional note is still waiting for its result (backend direction-score-v1 pending reasons). */
export function pendingLabel(reason: PendingReason | null, horizonSessions: number): string {
  switch (reason) {
    case "immature":
      return `Chờ đủ ${horizonSessions} phiên`;
    case "target-bar-missing":
      return "Chờ nến phiên chấm (đang thiếu)";
    case "signal-bar-missing":
      return "Chờ nến phiên tín hiệu (đang thiếu)";
    case "calendar-coverage-expired":
      return "Chờ lịch nghỉ HOSE để định phiên chấm";
    default:
      return DASH;
  }
}

export type NoteStatusInput = Pick<Note, "status" | "pendingReason" | "hit" | "horizonSessions">;

/** Exported note status → short Vietnamese label; each status and pending reason has its own wording. */
export function noteStatusLabel(note: NoteStatusInput): string {
  switch (note.status) {
    case "scored":
      return note.hit === true ? "Đúng" : note.hit === false ? "Sai" : DASH;
    case "pending":
      return pendingLabel(note.pendingReason, note.horizonSessions);
    case "no-view":
      return "Không chấm (không nhận định)";
    case "out-of-window-not-scored":
      return "Không chấm (ghi sau hạn)";
    case "window-undetermined-not-scored":
      return "Không chấm (chưa định được hạn ghi)";
    default:
      return DASH;
  }
}

/** {hits 3, scored 7} → "3/7 đúng"; nothing scored → "chưa chấm"; unknown (null) → "—". */
export function scoreText(score: Score | null | undefined): string {
  if (!score) return DASH;
  if (score.scored <= 0) return "chưa chấm";
  return `${score.hits}/${score.scored} đúng`;
}

/** The rule's prior baseline on the same scored notes: "4/7"; null when nothing is scored or the score is unknown. */
export function baselineText(score: Score | null | undefined): string | null {
  if (!score || score.scored <= 0) return null;
  return `${score.baselineHits}/${score.scored}`;
}

/** Short sample status for the overview table; null when there is nothing to qualify. */
export function sampleShortLabel(status: SampleStatus): string | null {
  return status === "insufficient-sample" ? "mẫu nhỏ" : status === "ok" ? "đủ mẫu" : null;
}

/** Full sample status for the ticker page (backend horizon status, minimum 30 non-overlapping scored notes). */
export function sampleLongLabel(status: SampleStatus): string {
  switch (status) {
    case "no-data":
      return "chưa có nhận định nào được chấm";
    case "insufficient-sample":
      return "mẫu còn nhỏ: chưa đủ 30 nhận định đã chấm có kỳ hạn 20 phiên không chồng lên nhau";
    case "ok":
      return "đủ mẫu tối thiểu của luật: ít nhất 30 nhận định đã chấm có kỳ hạn 20 phiên không chồng lên nhau";
    default:
      return DASH;
  }
}

export type Cell = { main: string; sub: string | null };
/** The part of a NotesView the overview cells read: unknown (empty, missing, or a null score) is always "—". */
export type CellView = Pick<NotesView, "known" | "kept">;

/** "Nhận định mới nhất" cell of the overview table. */
export function latestNoteCell(view: CellView, latest: Note | undefined): Cell {
  if (!view.known) return { main: DASH, sub: null };
  if (!latest) return { main: "Chưa có", sub: null };
  return { main: directionLabel(latest.direction), sub: formatDate(latest.signalDate) };
}

/** "Điểm" cell of the overview table: "3/7 đúng" over "mốc 4/7 · mẫu nhỏ". */
export function scoreCell(view: CellView, score: Score | null): Cell {
  if (!view.known || !score) return { main: DASH, sub: null };
  const baseline = baselineText(score);
  if (baseline === null) return { main: scoreText(score), sub: null };
  const sample = sampleShortLabel(score.sampleStatus);
  return { main: scoreText(score), sub: `mốc ${baseline}${sample ? ` · ${sample}` : ""}` };
}
