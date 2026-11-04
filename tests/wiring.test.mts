// Source checks for the wiring the render tests cannot see by themselves (which helper feeds which cell), for the
// client-bundle boundary, and for repository hygiene. Line breaks are matched as \r?\n: a checkout may be CRLF.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const src = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

test("Y1: no page, card or document states as a fact that the site gives no advice (the filter cannot guarantee it)", () => {
  // Theses are published verbatim after a keyword filter that does not catch every wording, so the site may say what
  // it aims at, never that it gives, holds or contains no advice, however worded: "không" followed within four words
  // by khuyên, khuyến nghị or tư vấn. Two phrases stay: the aim ("không nhằm đưa ra lời khuyên"), and "không phải
  // khuyến nghị đầu tư", which says what the automated views are.
  const ALLOWED = [/không\s+nhằm\s+đưa\s+ra\s+lời\s+khuyên/giu, /không\s+phải\s+khuyến\s+nghị\s+đầu\s+tư/giu];
  const CLAIM = /không\s+(?:[^\s.!?;:]+\s+){0,4}?(?:khuyên|khuyến\s+nghị|tư\s+vấn)/iu;
  const claims = (text: string) => ALLOWED.reduce((t, re) => t.replace(re, " "), text).match(CLAIM)?.[0] ?? null;
  // The wordings tried so far, across a JSX line break, are claims; the two allowed phrases alone are not.
  for (const claim of ["Trang không chứa lời khuyên giao dịch.", "không tư vấn đầu tư", "không đưa ra lời\r\n          khuyên",
    "không có khuyến nghị nào", "Không khuyên ai mua", "không phải khuyến nghị đầu tư và không chứa lời khuyên"]) {
    assert.notEqual(claims(claim), null, claim);
  }
  for (const phrase of ["không nhằm đưa ra lời\n          khuyên giao dịch", "Chỉ để tham khảo, không phải khuyến nghị đầu tư."]) {
    assert.equal(claims(phrase), null, phrase);
  }
  const files = ["app", "components", "lib"].flatMap((dir) =>
    readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" }).filter((f) => /\.tsx?$/.test(f)).map((f) => join(dir, f)));
  files.push("README.md");
  assert.ok(files.length >= 14, String(files.length));
  for (const rel of files) assert.equal(claims(src(rel)), null, rel);
  assert.match(src("app/phuong-phap/page.tsx"), /Trang này không nhằm đưa ra lời\s+khuyên giao dịch, không quản lý tiền của ai/);
});

test("home page: the notes cells go through notesView (meta.unavailable), not straight from the data", () => {
  const page = src("app/page.tsx");
  assert.match(page, /const view = notesView\(meta, row\.symbol, data\.score\);/);
  assert.match(page, /latest: latestNoteCell\(view, data\.notes\[0\]\), score: scoreCell\(view, data\.score\)/);
  assert.doesNotMatch(page, /scoreText\(data\.score\)/);
  assert.match(page, /\{screen\.rows\.length\} mã của rổ VN30/);
  assert.doesNotMatch(page, /30 mã/);
});

test("home page: every cell holding sr-only text is positioned, so the text cannot widen the page on phones", () => {
  // An absolutely positioned sr-only span inside the scrolling table escapes the scroll box unless its cell is
  // positioned (sticky or relative); seen as a 558 px page at 390 px when a row carried the kept marker.
  const cells = src("app/page.tsx").split("<td").slice(1).map((c) => c.split("</td>")[0]);
  const withSrOnly = cells.filter((c) => c.includes("sr-only"));
  assert.ok(withSrOnly.length >= 2);
  for (const cell of withSrOnly) assert.match(cell, /^ className="(?:[^"]*\s)?(?:sticky|relative)\s/, cell.slice(0, 80));
});

test("ticker page: every card gets the part state (and reasons) of its own part", () => {
  const page = src("app/ma/[ticker]/page.tsx");
  assert.match(page, /const missingLines = unavailableLines\(meta, data\);/);
  assert.match(page, /const candles = partState\(meta, ticker, "candles"\);\r?\n\s*const technical = partState\(meta, ticker, "technical"\);\r?\n\s*const notes = notesView\(meta, ticker, data\.score\);\r?\n\s*const technicalReasons = technicalCardReasons\(meta, data\);/);
  assert.match(page, /<IndicatorPanel indicators=\{data\.indicators\} session=\{meta\.session\} state=\{technical\} reasons=\{technicalReasons\} \/>/);
  assert.match(page, /nullText\(NULL_WORDS\.candles, candles, partReasons\(meta, ticker, "candles"\)\)/);
  assert.match(page, /nullText\(NULL_WORDS\.strength, technical, technicalReasons\)/);
  assert.match(page, /<Card title="Nhận định AI mới nhất">\r?\n\s*<LatestNote note=\{data\.notes\[0\]\} view=\{notes\} \/>/);
  assert.match(page, /<ScoreSummary score=\{data\.score\} view=\{notes\} \/>/);
  assert.match(page, /<NotesTable notes=\{data\.notes\} view=\{notes\} \/>/);
  assert.match(page, /\{missingLines\.map\(\(line\) => <li key=\{line\}>\{line\}<\/li>\)\}/);
  assert.doesNotMatch(page, /PART_LABELS/);
});

test("pages and cards never read a reason: only lib/data.ts looks at suffixes, the reasons are passed through", () => {
  for (const rel of [
    "app/page.tsx", "app/ma/[ticker]/page.tsx", "components/IndicatorPanel.tsx", "components/LatestNote.tsx",
    "components/NotesTable.tsx", "components/ScoreSummary.tsx", "lib/format.ts",
  ]) {
    const code = src(rel);
    assert.doesNotMatch(code, /\.reason\b|reasons\s*\[|reasons\.(?:some|every|find|includes|indexOf|filter|map|join)\b|_SUFFIX/, rel);
  }
  // In lib/data.ts a reason is only ever tested for a suffix, stripped of it, or shown.
  const data = src("lib/data.ts");
  for (const use of data.match(/\breason\.\w+\(/g) ?? []) assert.match(use, /^reason\.(?:endsWith|slice|trim)\($/, use);
  assert.doesNotMatch(data, /reasons?\.(?:includes|indexOf|search|match|startsWith|test)\(|\.reason\.(?!endsWith\()/);
});

test("indicator panel: the 'older' flag compares with <, through indicatorsOlderThan", () => {
  const panel = src("components/IndicatorPanel.tsx");
  assert.match(panel, /const older = indicatorsOlderThan\(indicators\.date, session\);/);
  assert.doesNotMatch(panel, /!== session/);
  assert.match(src("lib/indicators.ts"), /return date !== null && date < session;/);
});

test("modules bundled for the browser import data.ts for types only (it reads the file system)", () => {
  for (const rel of ["lib/format.ts", "lib/indicators.ts", "components/CandleChart.tsx"]) {
    const imports = src(rel).match(/^import .*from "\.\.?\/(?:lib\/)?data\.ts";\r?$/gm) ?? [];
    assert.ok(imports.length > 0, rel);
    for (const line of imports) assert.match(line, /^import type /, `${rel}: ${line}`);
  }
});

test("hygiene: 404 title, ignored local files, README on v2 and its part states", () => {
  assert.match(src("app/not-found.tsx"), /export const metadata: Metadata = \{\r?\n\s*title: "Không tìm thấy trang",/);
  const ignored = src(".gitignore").split(/\r?\n/);
  for (const entry of [".env*", ".vercel", "*.tmp", "node_modules/", ".next/", "out/"]) assert.ok(ignored.includes(entry), entry);
  const readme = src("README.md");
  assert.match(readme, /vn30-web-data\/v2/);
  assert.doesNotMatch(readme, /theo hợp đồng `vn30-web-data\/v1`/);
  assert.match(readme, /không suy nghĩa từ chữ của lý do/);
  assert.match(readme, /dữ liệu giữ từ một lượt cập nhật trước/);
  // Y2: the README says the kept line names only what the kept data holds, kept notes with no note included.
  assert.match(readme, /chỉ kể những giá trị mà dữ liệu giữ thật sự có/);
  assert.match(readme, /"phần nhận định" khi dữ liệu giữ không có\s+nhận định 20 phiên nào \(chỉ có điểm\)/);
  // r5: notes the exporter leaves out still count in the backend's score, so kept data with no note may hold a score
  // above zero, and a maintainer must not tie the two.
  assert.doesNotMatch(readme, /chỉ có điểm `no-data`/);
  assert.match(readme, /`notes` chỉ gồm các nhận\s+định exporter xuất, còn `score` là tổng của backend trên toàn bộ nhận định 20 phiên đã chấm của mã,\s+nên có thể đếm\s+cả nhận định không có trong `notes`\./);
  // Review of r5 (NIT): the README is public like the pages, so it names no holding, action or rule value either: the
  // words of TIE in tests/pages.test.mts (what would tie a note to a holding or to one of the rules), owning, the ways
  // of saying a kind of note is not exported or not published, and the field values in English.
  const README_TIE = ["vị thế", "hành động", "luật thứ", "bộ lọc", "từ khóa", "gắn với", "nắm giữ", "đang giữ", "người viết",
    "danh mục", "bảo đảm", "sở hữu", "không được xuất", "không xuất", "không được đăng", "không đăng", "bị loại", "bị bỏ",
    "hold", "position", "actionview", "actionbasis", "market-only", "insufficient-input"];
  const words = readme.normalize("NFC").toLowerCase().replace(/\s+/g, " ");
  for (const word of README_TIE) assert.ok(!words.includes(word), `README says "${word}"`);
  // Review of r5 (MINOR 2): the overview and ticker descriptions say the newest published note (the exporter may leave
  // out the newest notes); tests/pages.test.mts "every phrase about the most recent notes" checks the README too.
  assert.match(readme, /nhận định 20 phiên mới nhất được đăng,/);
  assert.match(readme, /nhận định AI mới nhất được đăng,/);
});
