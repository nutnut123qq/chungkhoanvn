// Renders the real pages from the fixture data set (tests/helpers/render.mts) and checks the text a visitor reads.
// The fixtures carry the part states the exporter writes (tests/data.test.mts "fixtures are producer-shaped").
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleanupVariants, FIXTURE, fixtureVariant, renderHome, renderLayout, renderMethod, renderTicker, visibleText,
} from "./helpers/render.mts";

after(cleanupVariants);

const DISCLAIMER = "Nhận định kỹ thuật tự động, chỉ để tham khảo, không phải khuyến nghị đầu tư.";
const ADVICE = new Set(["nên", "mua", "bán", "khuyến", "khuyên"]);
const adviceWords = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => ADVICE.has(w));
const count = (text: string, part: string) => text.split(part).length - 1;
const TICKERS = ["ACB", "FPT", "GAS", "HPG", "LPB", "MBB", "SSI", "STB", "TCB", "VCB", "VIC", "VPL"];
const KEPT = "Dữ liệu giữ từ một lượt cập nhật trước";
// The site's own words about a thesis on a ticker page (C1): the card for a hidden one, the label and the cut note.
const CARD = "Không hiển thị lập luận gốc: nhận định không có lập luận, hoặc lập luận đã bị luật tự động ẩn. Luật tự động đôi khi ẩn cả lập luận chỉ có nội dung kỹ thuật; xem trang Phương pháp và giới hạn.";
const THESIS_LABEL = "Lập luận gốc của AI (tiếng Anh)";
const CUT_NOTE = "Lập luận dài hơn 1.500 ký tự đã được cắt; dấu … đánh dấu chỗ cắt.";
// Words that would tie a thesis to a holding, an action or one of the rules, or claim what the rules guarantee (review
// of r4b, MINOR). The site's own copy has none of them outside /phuong-phap/'s thesis section, apart from the VN30-1
// sentences of / and of the limits ("nắm giữ 10 mã …"), which the checks below take out first.
const TIE = ["vị thế", "hành động", "luật thứ", "bộ lọc", "từ khóa", "gắn với", "nắm giữ", "đang giữ", "người viết",
  "danh mục", "bảo đảm"];
const TIE_WORDS = new RegExp(TIE.join("|"), "iu");

/** A ticker's fixture file as the exporter wrote it (the expectations below follow its notes, not a list). */
const fixtureSymbol = (ticker: string) => JSON.parse(readFileSync(join(FIXTURE, "symbols", `${ticker}.json`), "utf8"));

/** Visible text of each <td> of the overview row that links to /ma/<ticker>/ (Link drops the slash outside Next). */
function homeCells(html: string, ticker: string): string[] {
  const link = new RegExp(`href="/ma/${ticker}/?"`);
  const row = html.split("<tr").map((r) => r.split("</tr>")[0]).find((r) => link.test(r));
  assert.ok(row, `row ${ticker}`);
  return row.split("<td").slice(1).map((cell) => visibleText(`<td${cell}`));
}

/** The lines of the box at the top of a ticker page (meta.unavailable), as a visitor reads them. */
function topLines(html: string): string[] {
  const box = html.match(/<ul class="[^"]*bg-amber-50[^"]*">([\s\S]*?)<\/ul>/);
  return box ? box[1].split("<li").slice(1).map((li) => visibleText(`<li${li}`)) : [];
}

function assertClean(text: string, where: string) {
  assert.doesNotMatch(text, /\bundefined\b|\bNaN\b|\bnull\b/, where);
}

type Files = { read: (rel: string) => any; write: (rel: string, value: unknown) => void };

function editUnavailable({ read, write }: Files, edit: (list: any[]) => any[]): void {
  const meta = read("meta.json");
  meta.unavailable = edit(meta.unavailable);
  write("meta.json", meta);
}

test("home: notes cells say '—' when unknown, mark kept values, and show the score with its baseline", async () => {
  const html = await renderHome();
  const text = visibleText(html);
  assertClean(text, "home");
  const cells = (t: string) => homeCells(html, t).slice(-2);
  assert.deepEqual(cells("MBB"), ["Đi ngang 03/11/2026", "3/7 đúng mốc 4/7 · mẫu nhỏ"]);
  assert.deepEqual(cells("VIC"), ["Tăng 03/11/2026", "chưa chấm"]);
  assert.deepEqual(cells("STB"), ["Chưa có", "chưa chấm"]);
  assert.deepEqual(cells("SSI"), ["Tăng 03/11/2026", "chưa chấm"]);
  assert.deepEqual(cells("ACB"), ["Tăng* (giữ từ một lượt cập nhật trước) 02/11/2026", "1/1 đúng mốc 0/1 · mẫu nhỏ"]);
  assert.deepEqual(cells("VCB"), ["Đi ngang* (giữ từ một lượt cập nhật trước) 02/11/2026", "chưa chấm"]);
  assert.deepEqual(cells("GAS"), ["Đi ngang* (giữ từ một lượt cập nhật trước) 02/11/2026", "chưa chấm"]);
  assert.deepEqual(cells("VPL"), ["Tăng 03/11/2026", "chưa chấm"]);
  // Kept with no note (LPB): the kept "no note yet" and "not scored", marked as kept.
  assert.deepEqual(cells("LPB"), ["Chưa có* (giữ từ một lượt cập nhật trước)", "chưa chấm"]);
  // Not served (FPT), not read with nothing kept (HPG), or null in a file kept whole (TCB): "—", never
  // "Chưa có" / "chưa chấm".
  for (const t of ["FPT", "HPG", "TCB"]) assert.deepEqual(cells(t), ["—", "—"], t);
  // The legend of "—" covers both meanings; the kept marker does not claim exactly one run back.
  assert.match(text, /Ô “—” ở hai cột này: mã chưa có nhận định, hoặc lượt cập nhật gần nhất chưa lấy được nhận định của mã; trang của mã ghi rõ lý do\./);
  assert.match(text, /Dấu \* : nhận định và điểm của mã là dữ liệu giữ từ một lượt cập nhật trước, vì lượt cập nhật gần nhất chưa lấy được\./);
  assert.doesNotMatch(text, /lấy từ lượt cập nhật trước|của lượt cập nhật trước/);
  assert.match(text, /trong toàn bộ y nhận định 20 phiên đã chấm của mã, x nhận định đúng; “mốc z\/y”/);
  // The screen-reader caption counts the rows; VN30-1 stays "top 10" whatever the screen's topK (3 here).
  assert.match(text, /12 mã của rổ VN30 xếp theo lợi nhuận 6 tháng/);
  assert.doesNotMatch(text, /30 mã/);
  assert.match(text, /★ = 3 mã có lợi nhuận 6 tháng cao nhất/);
  assert.match(text, /nắm giữ 10 mã có lợi nhuận 6 tháng cao nhất thắng VNINDEX/);
  assert.deepEqual(adviceWords(text), []);
  // C1 (review of r4b): nothing on / about theses, the rules or a holding; the VN30-1 sentence is its only "nắm giữ".
  const own = text.split("nắm giữ 10 mã có lợi nhuận 6 tháng cao nhất thắng VNINDEX").join(" ");
  assert.doesNotMatch(own, TIE_WORDS);
  assert.doesNotMatch(own, /lập luận|luật tự động/iu);
});

test("home: the '—' and '*' legends appear only when some row needs them", async () => {
  // Every notes part read fresh with a score; the empty technical entries the exporter writes stay, and the kept
  // technical parts of GAS and VPL become empty ones for their null value.
  const dir = fixtureVariant((files) => {
    editUnavailable(files, (l) => l.filter((u) => u.part === "technical" && !u.reason.includes(";")));
    editUnavailable(files, (l) => [...l, { symbol: "TCB", part: "technical", reason: "backend chưa hỗ trợ mã này" },
      { symbol: "GAS", part: "technical", reason: "dữ liệu VNINDEX chưa khớp tới phiên mới nhất của mã" },
      { symbol: "VPL", part: "technical", reason: "backend chưa có chỉ báo 1d" }]);
    for (const s of ["HPG", "FPT", "TCB"]) {
      files.write(`symbols/${s}.json`, { ...files.read(`symbols/${s}.json`), score: { scored: 0, hits: 0, baselineHits: 0, sampleStatus: "no-data" } });
    }
  });
  const text = visibleText(await renderHome(dir));
  assert.doesNotMatch(text, /Ô “—” ở hai cột này/);
  assert.doesNotMatch(text, /Dấu \*/);
  assert.doesNotMatch(text, /\*/);
});

test("home: the '—' legend shows whatever state is behind the '—' rows (not served only; null in a file kept whole only)", async () => {
  const noScore = { scored: 0, hits: 0, baselineHits: 0, sampleStatus: "no-data" };
  // Only rows whose notes part is not served, like today's real data (every '—' row "chưa có"): HPG's notes read
  // fresh, TCB not served instead of kept whole, VCB read fresh.
  const notServed = fixtureVariant((files) => {
    editUnavailable(files, (l) => l.flatMap((u) => {
      if (u.symbol === "VCB" || (u.symbol === "HPG" && u.part === "notes")) return [];
      if (u.symbol !== "TCB") return [u];
      return [
        { symbol: "TCB", part: "technical", reason: "backend chưa hỗ trợ mã này" },
        { symbol: "TCB", part: "notes", reason: "backend chưa hỗ trợ mã này" },
      ];
    }));
    files.write("symbols/HPG.json", { ...files.read("symbols/HPG.json"), score: noScore });
  });
  // Only the null notes part of a file kept whole (TCB): FPT's and HPG's notes read fresh.
  const keptNull = fixtureVariant((files) => {
    editUnavailable(files, (l) => l.filter((u) => !(u.part === "notes" && (u.symbol === "FPT" || u.symbol === "HPG"))));
    for (const s of ["FPT", "HPG"]) files.write(`symbols/${s}.json`, { ...files.read(`symbols/${s}.json`), score: noScore });
  });
  for (const [name, dir, dashRows] of [["not served", notServed, ["FPT", "TCB"]], ["kept whole", keptNull, ["TCB"]]] as const) {
    const html = await renderHome(dir);
    assert.deepEqual(TICKERS.filter((t) => homeCells(html, t).at(-1) === "—"), dashRows, name);
    for (const t of dashRows) assert.deepEqual(homeCells(html, t).slice(-2), ["—", "—"], `${name} ${t}`);
    assert.match(visibleText(html),
      /Ô “—” ở hai cột này: mã chưa có nhận định, hoặc lượt cập nhật gần nhất chưa lấy được nhận định của mã; trang của mã ghi rõ lý do\./, name);
  }
});

test("ticker MBB (fresh): every status label, cut thesis, whole-journal score with baseline and sample", async () => {
  const text = visibleText(await renderTicker("MBB"));
  assertClean(text, "MBB");
  assert.doesNotMatch(text, /[Cc]hưa lấy được|[Cc]hưa có|lượt cập nhật trước/);
  assert.match(text, /Nhận định AI mới nhất Đi ngang Kỳ hạn 20 phiên Ngày tín hiệu 03\/11\/2026 Ngày chấm 01\/12\/2026 Trạng thái Chờ đủ 20 phiên/);
  assert.match(text, /Point 1: The 1d close sits below/);
  assert.match(text, /…\s*Lập luận dài hơn 1\.500 ký tự đã được cắt; dấu … đánh dấu chỗ cắt\./);
  assert.match(text, /Nhận định đúng 3\/7 đúng Mốc so sánh của luật 4\/7 đúng Mẫu mẫu còn nhỏ: chưa đủ 30 nhận định đã chấm/);
  assert.match(text, /Tính trên toàn bộ 7 nhận định 20 phiên đã chấm của mã, kể cả những nhận định không còn trong bảng lịch sử\./);
  const rows = [
    "03/11/2026 Đi ngang 01/12/2026 — Chờ đủ 20 phiên",
    "02/10/2026 Tăng 30/10/2026 — Chờ nến phiên chấm (đang thiếu)",
    "01/10/2026 Giảm 29/10/2026 -5,2% Đúng",
    "30/09/2026 Tăng 28/10/2026 +1,1% Sai",
    "29/09/2026 Không nhận định 27/10/2026 +0,4% Không chấm (không nhận định)",
    "25/09/2026 Tăng 23/10/2026 — Chờ nến phiên tín hiệu (đang thiếu)",
    "24/09/2026 Đi ngang — — Không chấm (ghi sau hạn)",
    "23/09/2026 Giảm — — Không chấm (chưa định được hạn ghi)",
    "22/09/2026 Tăng — — Chờ lịch nghỉ HOSE để định phiên chấm",
  ];
  assert.ok(text.includes(rows.join(" ")), "history rows in order");
  // T5d: the backend scores the whole journal again on every update, on the adjusted prices stored then.
  assert.match(text, /Bảng hiện tối đa 60 nhận định gần nhất\. Lợi nhuận 20 phiên tính trên giá đóng cửa điều chỉnh của phiên tín hiệu và phiên chấm\. Mỗi lượt cập nhật, backend chấm lại cả nhật ký trên giá điều chỉnh đang lưu, vì vậy lợi nhuận và kết quả Đúng\/Sai của nhận định đã chấm có thể đổi khi giá được điều chỉnh lại\./);
  assert.doesNotMatch(text, /tại lúc chấm/);
});

test("ticker VIC: older indicator row flagged; a null thesis says 'luật tự động' without naming a rule, links the method page; nothing scored", async () => {
  const html = await renderTicker("VIC");
  const text = visibleText(html);
  assertClean(text, "VIC");
  assert.match(text, /Chỉ báo ngày, phiên 31\/10\/2026 \(cũ hơn phiên dữ liệu 03\/11\/2026\)/);
  // T4 + C1 (r4b): an empty thesis, or one hidden by the automatic rules (the action-field rule since r4, or the keyword
  // filter), which sometimes hide a purely technical thesis too. The card names neither rule and says nothing about an
  // action, a position or money, so it cannot point at this note; /phuong-phap/ describes the rules. The whole paragraph
  // is pinned, so no sentence claiming a cause or what the rules guarantee can join it.
  const hidden = html.match(/<p class="[^"]*">(?:(?!<\/p>)[\s\S])*Không hiển thị lập luận gốc(?:(?!<\/p>)[\s\S])*<\/p>/)?.[0] ?? "";
  assert.equal(visibleText(hidden), CARD);
  assert.match(hidden, /<a\b[^>]*\shref="\/phuong-phap\/?"[^>]*>Phương pháp và giới hạn<\/a>/); // Link drops the slash outside Next
  assert.doesNotMatch(visibleText(hidden), /vị thế|hành động|tiền|lệnh|giữ|chờ|gắn với|từ khóa/i);
  // Review of r4b: the whole "Nhận định AI mới nhất" card is pinned, so no sibling sentence (a cause for this note, a
  // holding) can join the paragraph above, whatever its words. Its class is pinned too: static text cannot see a class
  // that hides it (sr-only, hidden, invisible), and a reader would then see no card at all.
  const latestCard = html.match(/<section\b[^>]*aria-label="Nhận định AI mới nhất"[^>]*>(?:(?!<\/section>)[\s\S])*<\/section>/)?.[0] ?? "";
  assert.equal(visibleText(latestCard), `Nhận định AI mới nhất Tăng Kỳ hạn 20 phiên Ngày tín hiệu 03/11/2026 Ngày chấm 01/12/2026 Trạng thái Chờ đủ 20 phiên ${CARD}`);
  assert.match(hidden, /^<p class="text-xs text-slate-600">/);
  assert.doesNotMatch(text, /bị ẩn vì nhắc tới thông tin ngoài phạm vi kỹ thuật|ngoài phạm vi kỹ thuật/);
  assert.doesNotMatch(text, /Lập luận gốc của AI/);
  // T5b: "chưa chấm" without a cause (none written, none due or waiting for a bar look the same in the totals).
  assert.match(text, /Điểm nhận định 20 phiên chưa chấm: chưa có nhận định 20 phiên nào được chấm\./);
  assert.doesNotMatch(text, /đủ kỳ hạn để chấm/);
});

test("ticker STB: relative strength empty (VNINDEX not aligned) says 'chưa có' with the reason; indicators stay fresh", async () => {
  const text = visibleText(await renderTicker("STB"));
  assertClean(text, "STB");
  assert.doesNotMatch(text, /[Cc]hưa lấy được|cũ hơn|lượt cập nhật trước/);
  const empty = "Chưa có sức mạnh tương đối so VNINDEX: dữ liệu VNINDEX chưa khớp tới phiên mới nhất của mã.";
  assert.equal(count(text, empty), 2); // the line at the top and the card
  assert.match(text, /Sức mạnh tương đối so với VNINDEX Chưa có sức mạnh tương đối so VNINDEX: dữ liệu VNINDEX/);
  assert.match(text, /Chỉ báo kỹ thuật Chỉ báo ngày, phiên 03\/11\/2026/);
  assert.doesNotMatch(text, /Chưa có chỉ báo kỹ thuật|Chưa có dữ liệu/);
  assert.match(text, /Chưa có nhận định 20 phiên nào cho mã này\./);
  assert.match(text, /Chưa có nhận định 20 phiên nào\./);
  assert.match(text, /Điểm nhận định 20 phiên chưa chấm: chưa có nhận định 20 phiên nào được chấm\./);
  assert.match(text, /Giá đóng cửa 19\.877 nằm ở mức SMA50 \(19\.877\) và trên SMA200 \(19\.650\)\./);
  assert.match(text, /RSI14 = 70,0 \(từ 70 trở lên\)\./);
  assert.match(text, /MACD histogram xấp xỉ 0\./);
  assert.match(text, /RSI14 70,0 MACD 12,3 MACD tín hiệu 12,3 MACD histogram 0,0/);
});

test("ticker SSI: no 1d indicator row says 'chưa có' with the reason; relative strength and notes read fresh", async () => {
  const text = visibleText(await renderTicker("SSI"));
  assertClean(text, "SSI");
  assert.doesNotMatch(text, /[Cc]hưa lấy được|lượt cập nhật trước/);
  assert.match(text, /Chưa có chỉ báo kỹ thuật: backend chưa có chỉ báo 1d\./);
  assert.match(text, /Chỉ báo kỹ thuật Chưa có chỉ báo kỹ thuật cho mã này: backend chưa có chỉ báo 1d\./);
  assert.match(text, /Sức mạnh tương đối so với VNINDEX 20 phiên -1,2% 60 phiên \+2,7%/);
  assert.doesNotMatch(text, /Chưa có sức mạnh tương đối/);
  assert.match(text, /Nhận định AI mới nhất Tăng Kỳ hạn 20 phiên Ngày tín hiệu 03\/11\/2026/);
});

test("ticker ACB: notes kept by an earlier export are shown with a note, never as fresh or missing", async () => {
  const text = visibleText(await renderTicker("ACB"));
  assertClean(text, "ACB");
  assert.match(text, /Lượt cập nhật gần nhất chưa lấy được nhận định: lỗi HTTP 500\. Nhận định trên trang này là dữ liệu giữ từ một lượt cập nhật trước\./);
  assert.match(text, /Nhận định AI mới nhất Dữ liệu giữ từ một lượt cập nhật trước \(lượt cập nhật gần nhất chưa lấy được nhận định\)\. Tăng/);
  assert.match(text, /Điểm nhận định 20 phiên Dữ liệu giữ từ một lượt cập nhật trước\. Nhận định đúng 1\/1 đúng Mốc so sánh của luật 0\/1 đúng/);
  assert.match(text, /Lịch sử nhận định 20 phiên Dữ liệu giữ từ một lượt cập nhật trước \(lượt cập nhật gần nhất chưa lấy được nhận định\)\./);
  assert.match(text, /01\/10\/2026 Giảm 29\/10\/2026 -6,1% Đúng/);
  assert.doesNotMatch(text, /Chưa có nhận định|Chưa lấy được nhận định|chưa chấm|của lượt cập nhật trước/);
  assert.equal(count(text, KEPT), 3); // technical was read fresh: no note on its cards
});

test("ticker HPG: notes not read and nothing kept → '—' / 'chưa lấy được'; technical kept → shown with a note", async () => {
  const text = visibleText(await renderTicker("HPG"));
  assertClean(text, "HPG");
  assert.match(text, /Lượt cập nhật gần nhất chưa lấy được chỉ báo kỹ thuật: lỗi HTTP 429\. Chỉ báo kỹ thuật và sức mạnh tương đối trên trang này là dữ liệu giữ từ một lượt cập nhật trước\./);
  assert.match(text, /Lượt cập nhật gần nhất chưa lấy được nhận định: lỗi HTTP 401\. Chưa có dữ liệu lượt trước để hiện thay\./);
  assert.match(text, /Chỉ báo kỹ thuật Dữ liệu giữ từ một lượt cập nhật trước \(lượt cập nhật gần nhất chưa lấy được\)\. Chỉ báo ngày, phiên 02\/11\/2026/);
  assert.match(text, /Nhận định AI mới nhất Chưa lấy được nhận định của mã này ở lượt cập nhật gần nhất\./);
  assert.match(text, /Điểm nhận định 20 phiên — Chưa lấy được nhận định của mã này ở lượt cập nhật gần nhất\./);
  assert.match(text, /Lịch sử nhận định 20 phiên Chưa lấy được lịch sử nhận định của mã này ở lượt cập nhật gần nhất\./);
  assert.match(text, /Sức mạnh tương đối so với VNINDEX Dữ liệu giữ từ một lượt cập nhật trước \(lượt cập nhật gần nhất chưa lấy được\)\./);
  assert.doesNotMatch(text, /Chưa có nhận định|chưa chấm/);
});

test("ticker HPG, one reason in two states (HTTP 500: technical kept, notes nothing to keep): two lines, notes never kept", async () => {
  const dir = fixtureVariant((files) => editUnavailable(files, (l) => l.map((u) => (u.symbol !== "HPG" ? u : {
    ...u, reason: u.part === "technical" ? "lỗi HTTP 500; giữ dữ liệu lượt trước" : "lỗi HTTP 500; chưa có dữ liệu lượt trước",
  }))));
  const html = await renderTicker("HPG", dir);
  const text = visibleText(html);
  assertClean(text, "HPG");
  assert.deepEqual(topLines(html), [
    "Lượt cập nhật gần nhất chưa lấy được chỉ báo kỹ thuật: lỗi HTTP 500. Chỉ báo kỹ thuật và sức mạnh tương đối trên trang này là dữ liệu giữ từ một lượt cập nhật trước.",
    "Lượt cập nhật gần nhất chưa lấy được nhận định: lỗi HTTP 500. Chưa có dữ liệu lượt trước để hiện thay.",
  ]);
  assert.doesNotMatch(text, /chỉ báo kỹ thuật và nhận định/);
  assert.match(text, /Nhận định AI mới nhất Chưa lấy được nhận định của mã này ở lượt cập nhật gần nhất\./);
  assert.match(text, /Chỉ báo kỹ thuật Dữ liệu giữ từ một lượt cập nhật trước \(lượt cập nhật gần nhất chưa lấy được\)\./);
});

test("ticker VPL (Y2): technical kept with the relative strength only: the line names that alone, the indicator card says the kept data has none", async () => {
  const html = await renderTicker("VPL");
  const text = visibleText(html);
  assertClean(text, "VPL");
  assert.deepEqual(topLines(html), [
    "Lượt cập nhật gần nhất chưa lấy được chỉ báo kỹ thuật: lỗi HTTP 503. Sức mạnh tương đối trên trang này là dữ liệu giữ từ một lượt cập nhật trước.",
  ]);
  assert.match(text, /Chỉ báo kỹ thuật Dữ liệu giữ từ một lượt cập nhật trước không có chỉ báo kỹ thuật của mã này\./);
  assert.match(text, /Sức mạnh tương đối so với VNINDEX Dữ liệu giữ từ một lượt cập nhật trước \(lượt cập nhật gần nhất chưa lấy được\)\. 20 phiên \+4,8% 60 phiên \+12,1%/);
  // The notes were read fresh: no kept note on their cards; the indicator card never says "chưa lấy được".
  assert.match(text, /Nhận định AI mới nhất Tăng Kỳ hạn 20 phiên Ngày tín hiệu 03\/11\/2026/);
  assert.equal(count(text, KEPT), 2);
  assert.doesNotMatch(text, /Phần chỉ báo kỹ thuật|[Cc]hỉ báo kỹ thuật trên trang này|Chưa lấy được|Chưa có chỉ báo|Chưa có sức mạnh/);
});

test("ticker GAS (Y2): technical kept with the indicators only and notes kept, one reason: one line naming what is held; the RS card says the kept data has none", async () => {
  const html = await renderTicker("GAS");
  const text = visibleText(html);
  assertClean(text, "GAS");
  assert.deepEqual(topLines(html), [
    "Lượt cập nhật gần nhất chưa lấy được chỉ báo kỹ thuật và nhận định: lỗi HTTP 500. Chỉ báo kỹ thuật và nhận định trên trang này là dữ liệu giữ từ một lượt cập nhật trước.",
  ]);
  assert.match(text, /Sức mạnh tương đối so với VNINDEX Dữ liệu giữ từ một lượt cập nhật trước không có sức mạnh tương đối so VNINDEX của mã này\./);
  assert.match(text, /Chỉ báo kỹ thuật Dữ liệu giữ từ một lượt cập nhật trước \(lượt cập nhật gần nhất chưa lấy được\)\. Chỉ báo ngày, phiên 02\/11\/2026 \(cũ hơn phiên dữ liệu 03\/11\/2026\)/);
  assert.match(text, /Nhận định AI mới nhất Dữ liệu giữ từ một lượt cập nhật trước \(lượt cập nhật gần nhất chưa lấy được nhận định\)\. Đi ngang/);
  assert.match(text, /Lịch sử nhận định 20 phiên Dữ liệu giữ từ một lượt cập nhật trước \(lượt cập nhật gần nhất chưa lấy được nhận định\)\./);
  assert.doesNotMatch(text, /[Ss]ức mạnh tương đối (?:và|trên trang này)|Chưa lấy được|Chưa có sức mạnh|Chưa có chỉ báo/);
});

test("ticker LPB (review of r4): notes kept with no note: the line names 'Phần nhận định', every notes card says so", async () => {
  const html = await renderTicker("LPB");
  const text = visibleText(html);
  assertClean(text, "LPB");
  // The earlier export read an empty journal: what is kept is the absence of a note and a "not scored" total, so the
  // line does not say "Nhận định trên trang này", which would read as notes shown on the page.
  assert.deepEqual(topLines(html), [
    "Lượt cập nhật gần nhất chưa lấy được nhận định: thiếu quyền đọc nhật ký nhận định. Phần nhận định trên trang này là dữ liệu giữ từ một lượt cập nhật trước.",
  ]);
  assert.match(text, /Nhận định AI mới nhất Dữ liệu giữ từ một lượt cập nhật trước \(lượt cập nhật gần nhất chưa lấy được nhận định\)\. Chưa có nhận định 20 phiên nào cho mã này\./);
  assert.match(text, /Điểm nhận định 20 phiên Dữ liệu giữ từ một lượt cập nhật trước\. chưa chấm: chưa có nhận định 20 phiên nào được chấm\./);
  assert.match(text, /Lịch sử nhận định 20 phiên Dữ liệu giữ từ một lượt cập nhật trước \(lượt cập nhật gần nhất chưa lấy được nhận định\)\. Chưa có nhận định 20 phiên nào\./);
  // Candles and technical read fresh: the three notes cards are the only kept ones.
  assert.equal(count(text, KEPT), 3);
  assert.match(text, /Chỉ báo kỹ thuật Chỉ báo ngày, phiên 03\/11\/2026/);
  assert.doesNotMatch(text, /Nhận định trên trang này|(?<!Phần )nhận định trên trang này|Chưa lấy được|chưa có dữ liệu lượt trước|— /);
});

test("ticker FPT (not served): 'chưa có' with the reason, one line at the top and on every card; no 'chưa lấy được', no '—'", async () => {
  const html = await renderTicker("FPT");
  const text = visibleText(html);
  assertClean(text, "FPT");
  assert.match(text, /Chưa có chỉ báo kỹ thuật, sức mạnh tương đối và nhận định: backend chưa hỗ trợ mã này\./);
  assert.equal(count(html, "<li>"), 1);
  assert.match(text, /Chỉ báo kỹ thuật Chưa có chỉ báo kỹ thuật cho mã này: backend chưa hỗ trợ mã này\./);
  assert.match(text, /Nhận định AI mới nhất Chưa có nhận định: backend chưa hỗ trợ mã này\./);
  assert.match(text, /Điểm nhận định 20 phiên Chưa có nhận định: backend chưa hỗ trợ mã này\./);
  assert.match(text, /Sức mạnh tương đối so với VNINDEX Chưa có sức mạnh tương đối so VNINDEX: backend chưa hỗ trợ mã này\./);
  assert.doesNotMatch(text, /lý do ghi ở đầu trang/); // one reason for both values: every card gives it
  assert.match(text, /Lịch sử nhận định 20 phiên Chưa có nhận định: backend chưa hỗ trợ mã này\./);
  assert.doesNotMatch(text, /[Cc]hưa lấy được|chưa chấm|— Chưa|lượt cập nhật trước|lượt trước/);
  assert.doesNotMatch(text, /UNSUPPORTED|HTTP/);
});

test("ticker VCB: a candles failure keeps the whole previous file; the line names every part it holds, every card says so", async () => {
  const text = visibleText(await renderTicker("VCB"));
  assertClean(text, "VCB");
  assert.match(text, /Lượt cập nhật gần nhất chưa lấy được nến: lỗi HTTP 502\. Biểu đồ, chỉ báo kỹ thuật, sức mạnh tương đối và nhận định trên trang này là dữ liệu giữ từ một lượt cập nhật trước\./);
  assert.match(text, /Giá đóng cửa 59\.650 · phiên 02\/11\/2026/);
  assert.match(text, /Biểu đồ nến ngày Dữ liệu giữ từ một lượt cập nhật trước \(lượt cập nhật gần nhất chưa lấy được nến\)\./);
  for (const card of ["Chỉ báo kỹ thuật", "Nhận định AI mới nhất", "Điểm nhận định 20 phiên", "Sức mạnh tương đối so với VNINDEX", "Lịch sử nhận định 20 phiên"]) {
    assert.ok(text.includes(`${card} ${KEPT}`), card);
  }
  assert.doesNotMatch(text, /Chưa có|Chưa lấy được|không có /); // every part of the kept file has data
});

test("ticker TCB: a file kept whole with null parts names only what it holds; no card says 'chưa lấy được'", async () => {
  const text = visibleText(await renderTicker("TCB"));
  assertClean(text, "TCB");
  assert.match(text, /Lượt cập nhật gần nhất chưa lấy được nến: lỗi HTTP 500\. Biểu đồ trên trang này là dữ liệu giữ từ một lượt cập nhật trước\./);
  assert.match(text, /Biểu đồ nến ngày Dữ liệu giữ từ một lượt cập nhật trước \(lượt cập nhật gần nhất chưa lấy được nến\)\./);
  assert.match(text, /Chỉ báo kỹ thuật Dữ liệu giữ từ một lượt cập nhật trước không có chỉ báo kỹ thuật của mã này\./);
  assert.match(text, /Nhận định AI mới nhất Dữ liệu giữ từ một lượt cập nhật trước không có nhận định của mã này\./);
  assert.match(text, /Điểm nhận định 20 phiên Dữ liệu giữ từ một lượt cập nhật trước không có nhận định của mã này\./);
  assert.match(text, /Sức mạnh tương đối so với VNINDEX Dữ liệu giữ từ một lượt cập nhật trước không có sức mạnh tương đối so VNINDEX của mã này\./);
  assert.match(text, /Lịch sử nhận định 20 phiên Dữ liệu giữ từ một lượt cập nhật trước không có lịch sử nhận định của mã này\./);
  // "chưa lấy được" only for the candles themselves (the line and the chart note).
  assert.equal(count(text, "chưa lấy được"), 2);
  assert.doesNotMatch(text, /Chưa lấy được|chưa chấm|Chưa có|— /);
  assert.doesNotMatch(text, /chỉ báo kỹ thuật, |và nhận định trên trang này/);
});

test("variants: newer indicator row, candles missing / not served / none, an 'ok' sample, two empty reasons, kept part with a null", async () => {
  const newer = fixtureVariant(({ read, write }) => {
    const stb = read("symbols/STB.json");
    stb.indicators.date = "2026-11-04";
    write("symbols/STB.json", stb);
  });
  assert.doesNotMatch(visibleText(await renderTicker("STB", newer)), /cũ hơn/);

  // Candles not read with nothing kept (VIC); the backend sent no candles at all (STB, read fresh).
  const noCandles = fixtureVariant((files) => {
    editUnavailable(files, (l) => [...l, { symbol: "VIC", part: "candles", reason: "lỗi HTTP 500; chưa có dữ liệu lượt trước" }]);
    files.write("symbols/VIC.json", { ...files.read("symbols/VIC.json"), candles: [] });
    files.write("symbols/STB.json", { ...files.read("symbols/STB.json"), candles: [] });
  });
  const vic = visibleText(await renderTicker("VIC", noCandles));
  assert.match(vic, /Lượt cập nhật gần nhất chưa lấy được nến: lỗi HTTP 500\. Chưa có dữ liệu lượt trước để hiện thay\./);
  assert.match(vic, /Biểu đồ nến ngày Chưa lấy được dữ liệu nến của mã này ở lượt cập nhật gần nhất\./);
  assert.match(vic, /Giá đóng cửa 230\.500 · phiên 03\/11\/2026/); // from the screen row
  assert.match(visibleText(await renderTicker("STB", noCandles)), /Biểu đồ nến ngày Chưa có dữ liệu nến cho mã này\./);

  // Candles not served (400 on /candles).
  const notServed = fixtureVariant((files) => {
    editUnavailable(files, (l) => [...l, { symbol: "VIC", part: "candles", reason: "backend chưa hỗ trợ mã này" }]);
    files.write("symbols/VIC.json", { ...files.read("symbols/VIC.json"), candles: [] });
  });
  const vicEmpty = visibleText(await renderTicker("VIC", notServed));
  assert.match(vicEmpty, /Chưa có nến: backend chưa hỗ trợ mã này\./);
  assert.match(vicEmpty, /Biểu đồ nến ngày Chưa có dữ liệu nến cho mã này: backend chưa hỗ trợ mã này\./);
  assert.doesNotMatch(vicEmpty, /[Cc]hưa lấy được/);

  const ok = fixtureVariant(({ read, write }) => {
    write("symbols/MBB.json", { ...read("symbols/MBB.json"), score: { scored: 31, hits: 12, baselineHits: 14, sampleStatus: "ok" } });
  });
  assert.match(visibleText(await renderTicker("MBB", ok)), /Nhận định đúng 12\/31 đúng Mốc so sánh của luật 14\/31 đúng Mẫu đủ mẫu tối thiểu của luật/);
  assert.deepEqual(homeCells(await renderHome(ok), "MBB").slice(-1), ["12/31 đúng mốc 14/31 · đủ mẫu"]);

  // One run without an indicator row and without the VNINDEX benchmark: the line at the top names both with both
  // reasons; each card points to it instead of giving a reason that may be about the other value (no inference).
  const both = fixtureVariant((files) => {
    files.write("symbols/STB.json", { ...files.read("symbols/STB.json"), indicators: null });
    editUnavailable(files, (l) => {
      const at = l.findIndex((u) => u.symbol === "STB");
      return [...l.slice(0, at), { symbol: "STB", part: "technical", reason: "backend chưa có chỉ báo 1d" }, ...l.slice(at)];
    });
  });
  const stbHtml = await renderTicker("STB", both);
  const stb = visibleText(stbHtml);
  const reasons = "backend chưa có chỉ báo 1d; dữ liệu VNINDEX chưa khớp tới phiên mới nhất của mã";
  assert.deepEqual(topLines(stbHtml), [`Chưa có chỉ báo kỹ thuật và sức mạnh tương đối: ${reasons}.`]);
  assert.match(stb, /Chỉ báo kỹ thuật Chưa có chỉ báo kỹ thuật cho mã này \(lý do ghi ở đầu trang\)\./);
  assert.match(stb, /Sức mạnh tương đối so với VNINDEX Chưa có sức mạnh tương đối so VNINDEX \(lý do ghi ở đầu trang\)\./);
  assert.equal(count(stb, "backend chưa có chỉ báo 1d"), 1); // the line at the top only
  assert.equal(count(stb, "dữ liệu VNINDEX chưa khớp"), 1);

  // A technical part kept on its own whose kept data had no relative strength (Y2: the line names the indicators only).
  const keptOne = fixtureVariant(({ read, write }) => write("symbols/HPG.json", { ...read("symbols/HPG.json"), relativeStrength: null }));
  const hpgHtml = await renderTicker("HPG", keptOne);
  const hpg = visibleText(hpgHtml);
  assert.equal(topLines(hpgHtml)[0],
    "Lượt cập nhật gần nhất chưa lấy được chỉ báo kỹ thuật: lỗi HTTP 429. Chỉ báo kỹ thuật trên trang này là dữ liệu giữ từ một lượt cập nhật trước.");
  assert.match(hpg, /Sức mạnh tương đối so với VNINDEX Dữ liệu giữ từ một lượt cập nhật trước không có sức mạnh tương đối so VNINDEX của mã này\./);
  assert.doesNotMatch(hpg, /Chưa lấy được sức mạnh/);
});

test("the reason text is never interpreted: the words shown change, the state and the labels do not", async () => {
  // Reasons that read like a failure and like kept data, without a suffix: still "chưa có" (empty).
  const odd = fixtureVariant((files) => editUnavailable(files, (l) => l.map((u) =>
    u.symbol === "FPT" ? { ...u, reason: "lỗi HTTP 500, giữ dữ liệu lượt trước" } : u)));
  const fpt = visibleText(await renderTicker("FPT", odd));
  assert.match(fpt, /Chưa có chỉ báo kỹ thuật, sức mạnh tương đối và nhận định: lỗi HTTP 500, giữ dữ liệu lượt trước\./);
  assert.doesNotMatch(fpt, /[Cc]hưa lấy được|trên trang này là dữ liệu giữ/);
  // STB's and SSI's reasons swapped: each label still follows the value that is null.
  const swapped = fixtureVariant((files) => editUnavailable(files, (l) => l.map((u) =>
    u.symbol === "STB" ? { ...u, reason: "backend chưa có chỉ báo 1d" }
      : u.symbol === "SSI" ? { ...u, reason: "dữ liệu VNINDEX chưa khớp tới phiên mới nhất của mã" } : u)));
  assert.match(visibleText(await renderTicker("STB", swapped)), /Sức mạnh tương đối so với VNINDEX Chưa có sức mạnh tương đối so VNINDEX: backend chưa có chỉ báo 1d\./);
  assert.match(visibleText(await renderTicker("SSI", swapped)), /Chỉ báo kỹ thuật Chưa có chỉ báo kỹ thuật cho mã này: dữ liệu VNINDEX chưa khớp/);
  // A kept part (Y2): what the line names follows the null values, not reasons that read as the other value missing.
  const keptOdd = fixtureVariant((files) => editUnavailable(files, (l) => l.map((u) =>
    u.symbol === "VPL" ? { ...u, reason: "dữ liệu VNINDEX chưa khớp tới phiên mới nhất của mã; giữ dữ liệu lượt trước" } : u)));
  const vplHtml = await renderTicker("VPL", keptOdd);
  assert.deepEqual(topLines(vplHtml), [
    "Lượt cập nhật gần nhất chưa lấy được chỉ báo kỹ thuật: dữ liệu VNINDEX chưa khớp tới phiên mới nhất của mã. Sức mạnh tương đối trên trang này là dữ liệu giữ từ một lượt cập nhật trước.",
  ]);
  assert.match(visibleText(vplHtml), /Chỉ báo kỹ thuật Dữ liệu giữ từ một lượt cập nhật trước không có chỉ báo kỹ thuật của mã này\./);
  // The data of r2 (old reason strings) still renders, its words shown as written.
  const r2 = fixtureVariant((files) => editUnavailable(files, (l) => l.map((u) =>
    u.symbol === "FPT" ? { ...u, reason: "backend chưa hỗ trợ mã này (UNSUPPORTED_CAPABILITY)" } : u)));
  assert.match(visibleText(await renderTicker("FPT", r2)), /Chưa có chỉ báo kỹ thuật, sức mạnh tương đối và nhận định: backend chưa hỗ trợ mã này \(UNSUPPORTED_CAPABILITY\)\./);
});

test("ticker pages: outside the thesis no advice word, no raw null, nothing tying a thesis to a holding, an action or a rule", async () => {
  const withCard: string[] = [];
  for (const ticker of TICKERS) {
    const html = await renderTicker(ticker);
    const latest = fixtureSymbol(ticker).notes[0];
    // The thesis is the note writer's text (English in every fixture, hence lang="en"); check the site's own Vietnamese
    // copy around it.
    assert.equal(count(html, '<p lang="en"'), latest?.thesis ? 1 : 0, ticker);
    const text = visibleText(html.replace(/<p lang="en"[\s\S]*?<\/p>/g, ""));
    assertClean(text, ticker);
    assert.deepEqual(adviceWords(text), [], ticker);
    assert.doesNotMatch(text, /của lượt cập nhật trước|lấy từ lượt cập nhật trước/, ticker);
    // C1 (review of r4b): locked on the whole page, not only in the card's paragraph. No word tying a thesis to a
    // holding, an action or a rule anywhere, and every "lập luận" belongs to the card, the label or the cut note, so no
    // other sentence about a thesis (a cause for this one, a guarantee) can join the page.
    assert.doesNotMatch(text, TIE_WORDS, ticker);
    assert.doesNotMatch([CARD, THESIS_LABEL, CUT_NOTE].reduce((t, s) => t.split(s).join(" "), text), /lập luận/iu, ticker);
    // The card shows exactly where the latest note has a null thesis; a shown thesis carries the label once.
    const card = count(text, "Không hiển thị lập luận gốc");
    assert.equal(card, latest && latest.thesis === null ? 1 : 0, ticker);
    assert.equal(count(text, THESIS_LABEL), latest?.thesis ? 1 : 0, ticker);
    if (card) withCard.push(ticker);
  }
  assert.deepEqual(withCard, ["VIC"]); // the fixture's one null latest thesis: the card checks above are not vacuous
});

test("thesis language (review of r4b): '(tiếng Anh)' and lang=\"en\" only for a thesis with no letter outside A-Z", async () => {
  // Only v7 asks for English and nothing enforces it, so the label follows the text: a Vietnamese thesis, precomposed or
  // decomposed (NFD), is shown as written and never called English; English with symbols (≈, −, …) still is. The NFD
  // one has no "đ" (a letter of its own that NFD keeps), so only its combining marks can tell it from English.
  const vi = "Giá đóng cửa trên đỉnh 20 phiên, khối lượng gấp 1,5 lần trung bình; RSI14 gần 62.";
  const nfd = "Giá trên SMA50 và SMA200; khối lượng gấp 1,5 lần trung bình phiên.".normalize("NFD");
  const en = "Close ≈ SMA50 − 0.4%; RSI14 near 48 … range-bound.";
  assert.ok(/^[\x00-\x7F\p{M}]+$/u.test(nfd)); // ASCII letters and combining marks only
  const dir = fixtureVariant(({ read, write }) => {
    for (const [ticker, thesis] of [["SSI", vi], ["VPL", nfd], ["GAS", en]]) {
      const doc = read(`symbols/${ticker}.json`);
      doc.notes[0].thesis = thesis;
      write(`symbols/${ticker}.json`, doc);
    }
  });
  for (const [ticker, thesis] of [["SSI", vi], ["VPL", nfd]]) {
    const html = await renderTicker(ticker, dir);
    assert.match(html, /<summary[^>]*>Lập luận gốc của AI<\/summary>/, ticker);
    assert.doesNotMatch(html, /lang="en"|tiếng Anh/, ticker);
    assert.ok(html.includes(`<p class="mt-2 whitespace-pre-line text-slate-700">${thesis}</p>`), ticker);
  }
  const gas = await renderTicker("GAS", dir);
  assert.match(gas, /<summary[^>]*>Lập luận gốc của AI \(tiếng Anh\)<\/summary>/);
  assert.ok(gas.includes(`<p lang="en" class="mt-2 whitespace-pre-line text-slate-700">${en}</p>`));
});

test("ticker metadata and unknown tickers", async () => {
  const { generateMetadata } = await import("../app/ma/[ticker]/page.tsx");
  const meta = await generateMetadata({ params: Promise.resolve({ ticker: "MBB" }) });
  assert.match(String(meta.description), /nhận định kỹ thuật tự động kỳ hạn 20 phiên cho MBB, có chấm điểm\. Chỉ để tham khảo, không phải khuyến nghị đầu tư\./);
  await assert.rejects(renderTicker("XYZ"));
});

/** The visible text of the one <p> of `html` that contains `start` ("" when there is none). */
function paragraph(html: string, start: string): string {
  const all = html.match(/<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<\/p>/g) ?? [];
  const hits = all.filter((p) => visibleText(p).includes(start));
  assert.ok(hits.length <= 1, `${hits.length} paragraphs contain ${start}`);
  return visibleText(hits[0] ?? "");
}

test("method page: v2 rules in words, the three part states, both thesis rules, what v7 added, advice words only in the disclaimer", async () => {
  const html = await renderMethod();
  const text = visibleText(html);
  assertClean(text, "phuong-phap");
  // C1 (r4b): both automatic rules, in general terms; the filter may hide a purely technical thesis and does not catch
  // every wording; the page does not say which rule hid a thesis. Pinned whole, so no claim of a guarantee or a cause
  // can join. r4c: rule 1 is kept general on purpose (it says only that some kinds of notes get their thesis published,
  // judged by other fields of the note, never by the text); the next test locks its words whatever this pin says.
  const rules = paragraph(html, "Hai luật tự động");
  assert.equal(rules, "Hai luật tự động có thể ẩn cả lập luận. Luật thứ nhất không đọc lập luận: chỉ một số loại nhận định được đăng lập luận, xét theo các trường khác của nhận định. Luật thứ hai là một bộ lọc dò theo từ khóa, ẩn cả lập luận khi nghi lập luận nhắc tới hành động giao dịch, vị thế, tiền, lệnh, đường dẫn hay mã nội bộ; bộ lọc có thể ẩn oan một lập luận chỉ có nội dung kỹ thuật, và không bảo đảm bắt hết mọi cách diễn đạt. Trang không ghi lập luận nào bị ẩn theo luật nào.");
  // C2 (r4b): what v7 (03/11/2026) added is the rules for writing a thesis for the public page (Step 4; "trong đó có":
  // it also asks for English, 1500 characters and number formats); the versions before it already kept the model to
  // candles and indicators (skill v1-v6 "Technical-only (candles and indicators)") and had none of these rules. Y1
  // (review of r4): the rules belong to a version, not to a date: the ACB thesis with signal date 03/11/2026 was written
  // under v6, MBB and BID of that date under v7; the page cannot tell which thesis followed which, nor how many.
  // r4c (cold-check r4b, NIT of the states lens): v7 Step 4 allows a few chart phrases built on those action words
  // ("selling pressure", "buying pressure", "support held", "price stopped at the low"), so "in any form" has its
  // exception ("trừ vài cụm mô tả biểu đồ").
  const v7 = paragraph(html, "từ bản v7");
  assert.equal(v7, "Vì lập luận được đăng nguyên văn, từ bản v7 (ngày 03/11/2026), hướng dẫn viết của mô hình có thêm các luật viết lập luận cho trang công khai, trong đó có: không dùng từ chỉ hành động giao dịch ở bất kỳ dạng nào, trừ vài cụm mô tả biểu đồ; không nhắc vị thế, tiền hay T+n; không ghi đường dẫn, mã nội bộ hay chuỗi ký tự dài. Các bản trước v7 cũng giới hạn mô hình ở nến và chỉ báo, nhưng chưa có các luật viết này. Lập luận có ngày tín hiệu 03/11/2026 có thể được viết theo bản v7 hoặc theo bản cũ hơn; trang không ghi lập luận nào được viết theo bản nào.");
  // The r4 sentence named the wrong gap (candles and indicators only) and counted one older thesis as "một số".
  assert.doesNotMatch(text, /dặn mô hình chỉ viết mô tả kỹ thuật|không được dặn như vậy|một số lập luận|gắn với vị thế/);
  // Review of r4b (NIT): only v7 asks for English and nothing enforces it, so a thesis is "thường" in English.
  const intro = paragraph(html, "Lập luận gốc của mô hình");
  assert.equal(intro, "Lập luận gốc của mô hình, thường viết bằng tiếng Anh, hiển thị nguyên văn với nhận định mới nhất ở trang từng mã. Lập luận dài hơn 1.500 ký tự được cắt ở 1.500 ký tự và kết thúc bằng dấu “…”.");
  const made = paragraph(html, "Với mỗi mã backend đã hỗ trợ");
  assert.equal(made, "Với mỗi mã backend đã hỗ trợ, sau mỗi phiên một mô hình AI đọc nến và chỉ báo kỹ thuật của mã rồi ghi một nhận định cho 20 phiên tới: Tăng, Giảm, Đi ngang hoặc Không nhận định. Mô hình không đọc tin tức, báo cáo tài chính hay sự kiện doanh nghiệp. Nhận định được ghi vào nhật ký trước khi biết kết quả. Trang chỉ hiển thị và chấm nhận định kỳ hạn 20 phiên; nhận định kỳ hạn khác (nếu có) không xuất hiện ở đây.");
  // Review of r4b (MINOR): locked on the whole page, not only in the pinned paragraphs. The thesis section is pinned
  // whole (its heading and these four paragraphs), so no sentence about theses, positions or the rules can join it; and
  // the words such a sentence needs appear nowhere else on the page (the VN30-1 limit is the one other "nắm giữ").
  const section = html.match(/<section\b[^>]*>(?:(?!<\/section>)[\s\S])*Nhận định hướng được tạo thế nào(?:(?!<\/section>)[\s\S])*<\/section>/)?.[0] ?? "";
  assert.equal(visibleText(section), ["Nhận định hướng được tạo thế nào", made, intro, rules, v7].join(" "));
  const page = text.split("rằng nắm giữ 10 mã mạnh nhất thắng VNINDEX").join(" ").toLowerCase();
  for (const word of [...TIE, "lập luận", "luật tự động", "v7", "tiếng anh"]) {
    assert.equal(count(page, word), count(visibleText(section).toLowerCase(), word), word);
  }
  for (const phrase of [
    // T1: the three states of a part.
    "“Chưa có”: backend đã trả lời nhưng chưa có dữ liệu cho phần đó",
    "hoặc chưa hỗ trợ mã đó",
    "“Chưa lấy được”: lượt cập nhật gần nhất gặp lỗi khi đọc phần đó và không có dữ liệu cũ để hiện thay",
    "“Dữ liệu giữ từ một lượt cập nhật trước”: lượt cập nhật gần nhất gặp lỗi khi đọc phần đó",
    "có thể đã cách nhiều lượt",
    "ô “—” ở cột nhận định và cột điểm nghĩa là chưa có hoặc chưa lấy được",
    // T5d: scored again on every update.
    "R = giá đóng cửa điều chỉnh phiên chấm ÷ giá đóng cửa điều chỉnh phiên tín hiệu − 1",
    "Ở mỗi lượt cập nhật, backend chấm lại cả nhật ký trên giá điều chỉnh đang lưu lúc đó",
    "R và kết quả Đúng/Sai của một nhận định đã chấm có thể đổi giữa các lượt cập nhật",
    // T5a: the whole tie rule.
    "khi hoà, ưu tiên Đi ngang, rồi tới Tăng, rồi tới Giảm; khi chưa có lịch sử nào, mốc là Đi ngang",
    // T5c: the base rates are a kNN probability, not the comparison baseline.
    "Tỷ lệ nền (xác suất ước lượng bằng kNN",
    "chạm mức +5% trước, chạm mức −4% trước, hay không chạm mức nào trong 20 phiên tính từ giá mở cửa phiên sau",
    "mới có cho MBB và BID, và trang này không hiển thị. Tỷ lệ nền khác với mốc so sánh của luật chấm",
    "R từ +5% trở lên là Tăng, từ −4% trở xuống là Giảm",
    "là tổng trên toàn bộ y nhận định 20 phiên đã chấm của mã từ khi bắt đầu ghi",
    "bảng lịch sử chỉ hiện tối đa 60 nhận định gần nhất",
    "mốc so sánh “z/y”",
    "“mẫu nhỏ” khi chưa có 30 nhận định đã chấm có kỳ hạn 20 phiên không chồng lên nhau",
    "28/74", "34/74",
    "“Chờ đủ 20 phiên”", "“Chờ nến phiên chấm (đang thiếu)”", "“Chờ nến phiên tín hiệu (đang thiếu)”",
    "“Chờ lịch nghỉ HOSE để định phiên chấm”", "“Không chấm (không nhận định)”", "“Không chấm (ghi sau hạn)”",
    "“Không chấm (chưa định được hạn ghi)”",
  ]) assert.ok(text.includes(phrase), phrase);
  assert.doesNotMatch(text, /số đếm thật trên các nhận định đã chấm của mã đó/);
  assert.doesNotMatch(text, /bị ẩn hoàn toàn nếu nhắc tới thông tin ngoài phạm vi kỹ thuật|tên hoặc địa chỉ máy/);
  assert.doesNotMatch(text, /hoà thì ưu tiên Đi ngang\./);
  assert.doesNotMatch(text, /tần suất lịch sử của Tăng\/Giảm\/Đi ngang/);
  assert.doesNotMatch(text, /tại lúc chấm/);
  assert.doesNotMatch(text, /trang giữ số liệu của lượt trước cho phần đó/);
  // Y1: the filter cannot guarantee that no thesis gives advice, so the page states its aim, not a fact. The whole
  // disclaimer is pinned, so no other claim (no advice, no consulting) can be added to it.
  const disclaimer = "Nhận định kỹ thuật tự động, chỉ để tham khảo, không phải khuyến nghị đầu tư. Trang này không nhằm đưa ra lời khuyên giao dịch, không quản lý tiền của ai và không chịu trách nhiệm cho quyết định đầu tư dựa trên nội dung ở đây. Mọi quyết định và rủi ro thuộc về người đọc.";
  assert.equal(count(text, disclaimer), 1);
  assert.doesNotMatch(text, /không đưa ra lời khuyên/);
  // The date-bound wording of r4 (a v6 thesis is dated 03/11/2026) and its "không theo luật đó" (read as breaking it).
  assert.doesNotMatch(text, /vì vậy mô hình được dặn|từ ngày 03\/11\/2026, mô hình|không theo luật đó/);
  assert.deepEqual(adviceWords(text.split(disclaimer).join(" ")), []);
});

// r4c: /phuong-phap/ is read together with the hidden-thesis card of a ticker page, so rule 1 stays general and must
// not name the field values it looks at. The words: action and holding words in Vietnamese, and the English values.
const RULE_ONE_WORDS = ["chờ", "vị thế", "hành động", "không có", "giữ", "nắm", "mua", "bán", "lệnh", "tiền", "danh mục",
  "wait", "none", "hold", "reduce", "sell", "buy", "position", "market", "action"].map((w) => w.normalize("NFC"));
/** `word` as whole syllables: no letter, mark or digit right before or right after it. */
const syllables = (word: string) => new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${word}(?![\\p{L}\\p{M}\\p{N}])`, "u");

/**
 * Rule 1 as a visitor reads it, found by the page's structure rather than by its wording, so a reworded or re-pinned
 * paragraph is read too: the one <p> that holds "Luật thứ nhất" (named once on the page), without the keyword filter's
 * sentence ("Luật thứ hai" up to the full stop that ends it), whose list of what it looks for is where such words
 * belong. NFC (Vietnamese typed as base letter + combining marks reads the same) and lower case; visibleText already
 * folds a JSX line break into one space.
 */
function ruleOne(html: string): string {
  const fold = (markup: string) => visibleText(markup).normalize("NFC").toLowerCase();
  const page = fold(html);
  assert.equal(count(page, "luật thứ nhất"), 1, "rule 1 is named once on the page");
  assert.equal(count(page, "luật thứ hai"), 1, "rule 2 is named once on the page");
  const own = (html.match(/<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<\/p>/g) ?? []).map(fold).filter((p) => p.includes("luật thứ nhất"));
  assert.equal(own.length, 1, "rule 1 stands in a paragraph");
  const text = own[0];
  const filter = text.indexOf("luật thứ hai");
  if (filter < 0) return text;
  const end = text.slice(filter).search(/\.(?=\s|$)/);
  const rest = text.slice(0, filter) + (end < 0 ? "" : text.slice(filter + end + 1));
  assert.ok(rest.includes("luật thứ nhất"), `rule 1 outside the filter's sentence: ${rest}`);
  return rest;
}

test("method page: the rule-1 sentence names none of the listed action, holding or field-value words", async () => {
  const html = await renderMethod();
  const rule = ruleOne(html);
  for (const word of RULE_ONE_WORDS) assert.doesNotMatch(rule, syllables(word), `rule 1 says "${word}": ${rule}`);
  // Scoped on purpose: elsewhere on the page "Chờ" starts the status labels and the filter's sentence names "hành
  // động" and "vị thế", so a page-wide check could not tell rule 1 from them.
  const page = visibleText(html).normalize("NFC").toLowerCase();
  for (const word of ["chờ", "vị thế", "hành động"]) assert.match(page, syllables(word), word);
});

test("layout: the disclaimer twice, the data session and update time on every page", async () => {
  const text = visibleText(await renderLayout());
  assertClean(text, "layout");
  assert.equal(count(text, DISCLAIMER), 2);
  // Outside the disclaimer, no advice word: the header and footer make no other claim about advice.
  assert.deepEqual(adviceWords(text.split(DISCLAIMER).join(" ")), []);
  assert.match(text, /Dữ liệu phiên 03\/11\/2026\./);
  assert.match(text, /cập nhật 19:05 03\/11\/2026 \(giờ Việt Nam\)/);
  assert.match(text, /NỘI DUNG TRANG/);
  // Review of r4b: header, banner and footer pinned whole, so no claim (about theses, the rules, a holding or advice)
  // can be added to every page. The two nav links are adjacent inline elements: visibleText joins their words, the
  // browser separates them with the flex gap.
  assert.equal(text, `Bảng VN30 Bảng VN30Phương pháp ${DISCLAIMER} Dữ liệu phiên 03/11/2026. NỘI DUNG TRANG Dữ liệu phiên 03/11/2026, cập nhật 19:05 03/11/2026 (giờ Việt Nam). Nguồn: VCI, giá điều chỉnh, qua backend của dự án. ${DISCLAIMER} Phương pháp và giới hạn`);
  assert.doesNotMatch(text, TIE_WORDS);
  assert.doesNotMatch(text, /lập luận|luật tự động/iu);
});

test("404 page has its own title", async () => {
  const { metadata } = await import("../app/not-found.tsx");
  assert.equal(metadata.title, "Không tìm thấy trang");
});
