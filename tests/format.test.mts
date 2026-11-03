import { test } from "node:test";
import assert from "node:assert/strict";
import type { NoteStatus, PendingReason, Score } from "../lib/data.ts";
import {
  baselineText, DASH, directionLabel, formatDate, formatNumber, formatPercent, formatVnDateTime, latestNoteCell,
  noteStatusLabel, pendingLabel, sampleLongLabel, sampleShortLabel, scoreCell, scoreText,
} from "../lib/format.ts";

test("formatNumber uses vi-VN grouping, renders null as a dash and never prints a negative zero", () => {
  assert.equal(formatNumber(18750), "18.750");
  assert.equal(formatNumber(1234500), "1.234.500");
  assert.equal(formatNumber(19877.4), "19.877");
  assert.equal(formatNumber(38.24, 1), "38,2");
  assert.equal(formatNumber(0), "0");
  assert.equal(formatNumber(-0), "0");
  assert.equal(formatNumber(-0.04, 1), "0,0");
  assert.equal(formatNumber(-0.4), "0");
  assert.equal(formatNumber(-0.06, 1), "-0,1");
  assert.equal(formatNumber(-80.5, 1), "-80,5");
  assert.equal(formatNumber(null), DASH);
  assert.equal(formatNumber(undefined), DASH);
  assert.equal(formatNumber(Number.NaN), DASH);
});

test("formatPercent turns a fraction into a signed vi-VN percent", () => {
  assert.equal(formatPercent(0.123), "+12,3%");
  assert.equal(formatPercent(-0.014), "-1,4%");
  assert.equal(formatPercent(1.262), "+126,2%");
  assert.equal(formatPercent(0), "0,0%");
  assert.equal(formatPercent(-0.0004), "0,0%");
  assert.equal(formatPercent(null), DASH);
});

test("formatDate and formatVnDateTime", () => {
  assert.equal(formatDate("2026-11-03"), "03/11/2026");
  assert.equal(formatDate(null), DASH);
  assert.equal(formatDate("03/11/2026"), DASH);
  // 12:05 UTC is 19:05 in Vietnam; 20:30 UTC rolls over to the next day.
  assert.equal(formatVnDateTime("2026-11-03T12:05:00Z"), "19:05 03/11/2026");
  assert.equal(formatVnDateTime("2026-11-03T20:30:00+00:00"), "03:30 04/11/2026");
  assert.equal(formatVnDateTime("not a date"), DASH);
  assert.equal(formatVnDateTime(null), DASH);
});

test("directionLabel maps every contract direction", () => {
  assert.equal(directionLabel("up"), "Tăng");
  assert.equal(directionLabel("down"), "Giảm");
  assert.equal(directionLabel("sideways"), "Đi ngang");
  assert.equal(directionLabel("no-view"), "Không nhận định");
  assert.equal(directionLabel("buy"), DASH);
  assert.equal(directionLabel(null), DASH);
});

test("every pending reason has its own label", () => {
  const labels = {
    immature: "Chờ đủ 20 phiên",
    "target-bar-missing": "Chờ nến phiên chấm (đang thiếu)",
    "signal-bar-missing": "Chờ nến phiên tín hiệu (đang thiếu)",
    "calendar-coverage-expired": "Chờ lịch nghỉ HOSE để định phiên chấm",
  } satisfies Record<PendingReason, string>;
  for (const [reason, label] of Object.entries(labels)) {
    assert.equal(pendingLabel(reason as PendingReason, 20), label, reason);
    assert.equal(noteStatusLabel({ status: "pending", pendingReason: reason as PendingReason, hit: null, horizonSessions: 20 }), label);
  }
  assert.equal(new Set(Object.values(labels)).size, 4);
  assert.equal(pendingLabel(null, 20), DASH);
});

test("every status has its own label; scored follows hit", () => {
  const label = (status: NoteStatus, hit: boolean | null = null) =>
    noteStatusLabel({ status, pendingReason: status === "pending" ? "immature" : null, hit, horizonSessions: 20 });
  assert.equal(label("scored", true), "Đúng");
  assert.equal(label("scored", false), "Sai");
  assert.equal(label("pending"), "Chờ đủ 20 phiên");
  assert.equal(label("no-view"), "Không chấm (không nhận định)");
  assert.equal(label("out-of-window-not-scored"), "Không chấm (ghi sau hạn)");
  assert.equal(label("window-undetermined-not-scored"), "Không chấm (chưa định được hạn ghi)");
  const all = ["Đúng", "Sai", label("pending"), label("no-view"), label("out-of-window-not-scored"), label("window-undetermined-not-scored")];
  assert.equal(new Set(all).size, all.length);
  // Backend names that are never exported are not given a label of their own.
  assert.equal(noteStatusLabel({ status: "resolved" as NoteStatus, pendingReason: null, hit: true, horizonSessions: 20 }), DASH);
});

const score = (scored: number, hits: number, baselineHits: number, sampleStatus: Score["sampleStatus"]): Score =>
  ({ scored, hits, baselineHits, sampleStatus });

test("scoreText: unknown is a dash, nothing scored is 'chưa chấm', else hits over scored", () => {
  assert.equal(scoreText(null), DASH);
  assert.equal(scoreText(undefined), DASH);
  assert.equal(scoreText(score(0, 0, 0, "no-data")), "chưa chấm");
  assert.equal(scoreText(score(7, 3, 4, "insufficient-sample")), "3/7 đúng");
  assert.equal(scoreText(score(1, 0, 1, "insufficient-sample")), "0/1 đúng");
  assert.equal(baselineText(score(7, 3, 4, "insufficient-sample")), "4/7");
  assert.equal(baselineText(score(31, 12, 0, "ok")), "0/31");
  assert.equal(baselineText(score(0, 0, 0, "no-data")), null);
  assert.equal(baselineText(null), null);
});

test("sample status labels", () => {
  assert.equal(sampleShortLabel("no-data"), null);
  assert.equal(sampleShortLabel("insufficient-sample"), "mẫu nhỏ");
  assert.equal(sampleShortLabel("ok"), "đủ mẫu");
  assert.equal(sampleLongLabel("no-data"), "chưa có nhận định nào được chấm");
  assert.match(sampleLongLabel("insufficient-sample"), /^mẫu còn nhỏ: chưa đủ 30 nhận định đã chấm/);
  assert.match(sampleLongLabel("ok"), /^đủ mẫu tối thiểu của luật: ít nhất 30/);
});

test("overview cells: unknown notes show a dash, never 'Chưa có' or 'chưa chấm'", () => {
  const known = { known: true, kept: false };
  const unknown = { known: false, kept: false };
  const note = {
    signalDate: "2026-11-03", horizonSessions: 20, direction: "up" as const, thesis: null, status: "pending" as const,
    pendingReason: "immature" as const, targetDate: "2026-12-01", returnPct: null, hit: null,
  };
  assert.deepEqual(latestNoteCell(unknown, undefined), { main: DASH, sub: null });
  assert.deepEqual(latestNoteCell(unknown, note), { main: DASH, sub: null });
  assert.deepEqual(latestNoteCell({ known: false, kept: true }, note), { main: DASH, sub: null });
  assert.deepEqual(latestNoteCell(known, undefined), { main: "Chưa có", sub: null });
  assert.deepEqual(latestNoteCell(known, note), { main: "Tăng", sub: "03/11/2026" });
  assert.deepEqual(scoreCell(unknown, score(7, 3, 4, "ok")), { main: DASH, sub: null });
  assert.deepEqual(scoreCell(known, null), { main: DASH, sub: null });
  assert.deepEqual(scoreCell(known, score(0, 0, 0, "no-data")), { main: "chưa chấm", sub: null });
  assert.deepEqual(scoreCell(known, score(7, 3, 4, "insufficient-sample")), { main: "3/7 đúng", sub: "mốc 4/7 · mẫu nhỏ" });
  assert.deepEqual(scoreCell(known, score(31, 12, 14, "ok")), { main: "12/31 đúng", sub: "mốc 14/31 · đủ mẫu" });
});
