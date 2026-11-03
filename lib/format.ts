// Pure vi-VN formatting and labels. `null` always renders as "—", never as 0.

export const DASH = "—";

function nf(digits: number, signed: boolean): Intl.NumberFormat {
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? "exceptZero" : "auto",
  });
}

/** 18750 → "18.750"; 38.24 with digits 1 → "38,2". */
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

export type NoteStatusInput = {
  status: string;
  pendingReason: string | null;
  hit: boolean | null;
  horizonSessions: number;
};

/** Backend direction-score-v1 item status → short Vietnamese label. */
export function noteStatusLabel(note: NoteStatusInput): string {
  if (note.hit === true) return "Đúng";
  if (note.hit === false) return "Sai";
  if (note.status === "pending") {
    return note.pendingReason === null || note.pendingReason === "immature"
      ? `Chờ đủ ${note.horizonSessions} phiên`
      : "Chờ dữ liệu phiên đích";
  }
  return "Không chấm";
}

/** {scored: 7, hits: 3} → "3/7 đúng"; nothing scored → "chưa chấm". */
export function scoreText(score: { scored: number; hits: number } | null | undefined): string {
  if (!score || score.scored <= 0) return "chưa chấm";
  return `${score.hits}/${score.scored} đúng`;
}
