import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DASH, directionLabel, formatDate, formatNumber, formatPercent, formatVnDateTime, noteStatusLabel, scoreText,
} from "../lib/format.ts";

test("formatNumber uses vi-VN grouping and renders null as a dash", () => {
  assert.equal(formatNumber(18750), "18.750");
  assert.equal(formatNumber(1234500), "1.234.500");
  assert.equal(formatNumber(19877.4), "19.877");
  assert.equal(formatNumber(38.24, 1), "38,2");
  assert.equal(formatNumber(0), "0");
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

test("noteStatusLabel: pending, scored hit/miss, other statuses", () => {
  const base = { status: "pending", pendingReason: "immature", hit: null, horizonSessions: 20 };
  assert.equal(noteStatusLabel(base), "Chờ đủ 20 phiên");
  assert.equal(noteStatusLabel({ ...base, pendingReason: null }), "Chờ đủ 20 phiên");
  assert.equal(noteStatusLabel({ ...base, pendingReason: "target-bar-missing" }), "Chờ dữ liệu phiên đích");
  assert.equal(noteStatusLabel({ ...base, status: "scored", pendingReason: null, hit: true }), "Đúng");
  assert.equal(noteStatusLabel({ ...base, status: "scored", pendingReason: null, hit: false }), "Sai");
  // The backend's own name for a scored item is "resolved"; the label follows `hit`.
  assert.equal(noteStatusLabel({ ...base, status: "resolved", pendingReason: null, hit: true }), "Đúng");
  assert.equal(noteStatusLabel({ ...base, status: "no-view", pendingReason: null }), "Không chấm");
  assert.equal(noteStatusLabel({ ...base, status: "superseded-not-scored", pendingReason: null }), "Không chấm");
});

test("scoreText", () => {
  assert.equal(scoreText({ scored: 7, hits: 3 }), "3/7 đúng");
  assert.equal(scoreText({ scored: 1, hits: 0 }), "0/1 đúng");
  assert.equal(scoreText({ scored: 0, hits: 0 }), "chưa chấm");
  assert.equal(scoreText(null), "chưa chấm");
});
