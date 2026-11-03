// Renders the real pages from the fixture data set (tests/helpers/render.mts) and checks the text a visitor reads.
// The fixtures carry the part states the exporter writes (tests/data.test.mts "fixtures are producer-shaped").
import { after, test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanupVariants, fixtureVariant, renderHome, renderLayout, renderMethod, renderTicker, visibleText,
} from "./helpers/render.mts";

after(cleanupVariants);

const DISCLAIMER = "Nhận định kỹ thuật tự động, chỉ để tham khảo, không phải khuyến nghị đầu tư.";
const ADVICE = new Set(["nên", "mua", "bán", "khuyến", "khuyên"]);
const adviceWords = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => ADVICE.has(w));
const count = (text: string, part: string) => text.split(part).length - 1;
const TICKERS = ["ACB", "FPT", "HPG", "MBB", "SSI", "STB", "TCB", "VCB", "VIC"];
const KEPT = "Dữ liệu giữ từ một lượt cập nhật trước";

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
  // Not served (FPT), not read with nothing kept (HPG), or null in a file kept whole (TCB): "—", never
  // "Chưa có" / "chưa chấm".
  for (const t of ["FPT", "HPG", "TCB"]) assert.deepEqual(cells(t), ["—", "—"], t);
  // The legend of "—" covers both meanings; the kept marker does not claim exactly one run back.
  assert.match(text, /Ô “—” ở hai cột này: mã chưa có nhận định, hoặc lượt cập nhật gần nhất chưa lấy được nhận định của mã; trang của mã ghi rõ lý do\./);
  assert.match(text, /Dấu \* : nhận định và điểm của mã là dữ liệu giữ từ một lượt cập nhật trước, vì lượt cập nhật gần nhất chưa lấy được\./);
  assert.doesNotMatch(text, /lấy từ lượt cập nhật trước|của lượt cập nhật trước/);
  assert.match(text, /trong toàn bộ y nhận định 20 phiên đã chấm của mã, x nhận định đúng; “mốc z\/y”/);
  // The screen-reader caption counts the rows; VN30-1 stays "top 10" whatever the screen's topK (3 here).
  assert.match(text, /9 mã của rổ VN30 xếp theo lợi nhuận 6 tháng/);
  assert.doesNotMatch(text, /30 mã/);
  assert.match(text, /★ = 3 mã có lợi nhuận 6 tháng cao nhất/);
  assert.match(text, /nắm giữ 10 mã có lợi nhuận 6 tháng cao nhất thắng VNINDEX/);
  assert.deepEqual(adviceWords(text), []);
});

test("home: the '—' and '*' legends appear only when some row needs them", async () => {
  // Every notes part read fresh with a score; the empty technical entries the exporter writes stay.
  const dir = fixtureVariant((files) => {
    editUnavailable(files, (l) => l.filter((u) => u.part === "technical" && !u.reason.includes(";")));
    editUnavailable(files, (l) => [...l, { symbol: "TCB", part: "technical", reason: "backend chưa hỗ trợ mã này" }]);
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

test("ticker VIC: older indicator row flagged; a null thesis names the filter without claiming why; nothing scored", async () => {
  const text = visibleText(await renderTicker("VIC"));
  assertClean(text, "VIC");
  assert.match(text, /Chỉ báo ngày, phiên 31\/10\/2026 \(cũ hơn phiên dữ liệu 03\/11\/2026\)/);
  // T4: hidden by an automatic keyword filter (or empty), which sometimes hides a purely technical thesis too.
  assert.match(text, /Không hiển thị lập luận gốc: nhận định không có lập luận, hoặc lập luận đã bị bộ lọc tự động ẩn\. Bộ lọc dò theo từ khóa, vì vậy đôi khi ẩn cả lập luận chỉ có nội dung kỹ thuật\./);
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
  assert.match(text, /Lượt cập nhật gần nhất chưa lấy được nhận định: lỗi HTTP 500\. Phần nhận định trên trang này là dữ liệu giữ từ một lượt cập nhật trước\./);
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
  assert.match(text, /Lượt cập nhật gần nhất chưa lấy được chỉ báo kỹ thuật: lỗi HTTP 429\. Phần chỉ báo kỹ thuật trên trang này là dữ liệu giữ từ một lượt cập nhật trước\./);
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
    "Lượt cập nhật gần nhất chưa lấy được chỉ báo kỹ thuật: lỗi HTTP 500. Phần chỉ báo kỹ thuật trên trang này là dữ liệu giữ từ một lượt cập nhật trước.",
    "Lượt cập nhật gần nhất chưa lấy được nhận định: lỗi HTTP 500. Chưa có dữ liệu lượt trước để hiện thay.",
  ]);
  assert.doesNotMatch(text, /chỉ báo kỹ thuật và nhận định/);
  assert.match(text, /Nhận định AI mới nhất Chưa lấy được nhận định của mã này ở lượt cập nhật gần nhất\./);
  assert.match(text, /Chỉ báo kỹ thuật Dữ liệu giữ từ một lượt cập nhật trước \(lượt cập nhật gần nhất chưa lấy được\)\./);
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

  // A technical part kept on its own whose kept data had no relative strength.
  const keptOne = fixtureVariant(({ read, write }) => write("symbols/HPG.json", { ...read("symbols/HPG.json"), relativeStrength: null }));
  const hpg = visibleText(await renderTicker("HPG", keptOne));
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
  // The data of r2 (old reason strings) still renders, its words shown as written.
  const r2 = fixtureVariant((files) => editUnavailable(files, (l) => l.map((u) =>
    u.symbol === "FPT" ? { ...u, reason: "backend chưa hỗ trợ mã này (UNSUPPORTED_CAPABILITY)" } : u)));
  assert.match(visibleText(await renderTicker("FPT", r2)), /Chưa có chỉ báo kỹ thuật, sức mạnh tương đối và nhận định: backend chưa hỗ trợ mã này \(UNSUPPORTED_CAPABILITY\)\./);
});

test("ticker pages: no advice words and no raw null/undefined/NaN on any fixture ticker", async () => {
  for (const ticker of TICKERS) {
    const html = await renderTicker(ticker);
    // The thesis is English text from the note writer; check the site's own Vietnamese copy around it.
    const text = visibleText(html.replace(/<p lang="en"[\s\S]*?<\/p>/g, ""));
    assertClean(text, ticker);
    assert.deepEqual(adviceWords(text), [], ticker);
    assert.doesNotMatch(text, /của lượt cập nhật trước|lấy từ lượt cập nhật trước/, ticker);
  }
});

test("ticker metadata and unknown tickers", async () => {
  const { generateMetadata } = await import("../app/ma/[ticker]/page.tsx");
  const meta = await generateMetadata({ params: Promise.resolve({ ticker: "MBB" }) });
  assert.match(String(meta.description), /nhận định kỹ thuật tự động kỳ hạn 20 phiên cho MBB, có chấm điểm\. Chỉ để tham khảo, không phải khuyến nghị đầu tư\./);
  await assert.rejects(renderTicker("XYZ"));
});

test("method page: v2 rules in words, the three part states, the filter as it is, advice words only in the disclaimer", async () => {
  const text = visibleText(await renderMethod());
  assertClean(text, "phuong-phap");
  for (const phrase of [
    "Trang chỉ hiển thị và chấm nhận định kỳ hạn 20 phiên",
    "Lập luận gốc của mô hình bằng tiếng Anh, hiển thị nguyên văn",
    "được cắt ở 1.500 ký tự và kết thúc bằng dấu “…”",
    // T4: a keyword filter, may hide a purely technical thesis, does not catch every wording.
    "một bộ lọc dò theo từ khóa ẩn cả lập luận khi nghi lập luận nhắc tới vị thế, tiền, lệnh hay hành động giao dịch, đường dẫn hay mã nội bộ",
    "Bộ lọc có thể ẩn oan một lập luận chỉ có nội dung kỹ thuật, và không bảo đảm bắt hết mọi cách diễn đạt; vì vậy mô hình được dặn chỉ viết mô tả kỹ thuật",
    // T1: the three states of a part.
    "“Chưa có”: backend đã trả lời nhưng chưa có dữ liệu cho phần đó",
    "hoặc chưa hỗ trợ mã đó",
    "“Chưa lấy được”: lượt cập nhật gần nhất gặp lỗi khi đọc phần đó và không có dữ liệu cũ để hiện thay",
    "“Dữ liệu giữ từ một lượt cập nhật trước”: lượt cập nhật gần nhất gặp lỗi khi đọc phần đó",
    "có thể đã cách nhiều lượt",
    "ô “—” ở cột nhận định và cột điểm nghĩa là chưa có hoặc chưa lấy được",
    "Với mỗi mã backend đã hỗ trợ, sau mỗi phiên một mô hình AI",
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
  const disclaimer = /Nhận định kỹ thuật tự động, chỉ để tham khảo, không phải khuyến nghị đầu tư\. Trang này không đưa ra lời khuyên giao dịch[^.]*\./;
  assert.match(text, disclaimer);
  assert.deepEqual(adviceWords(text.replace(disclaimer, "")), []);
});

test("layout: the disclaimer twice, the data session and update time on every page", async () => {
  const text = visibleText(await renderLayout());
  assertClean(text, "layout");
  assert.equal(count(text, DISCLAIMER), 2);
  assert.match(text, /Dữ liệu phiên 03\/11\/2026\./);
  assert.match(text, /cập nhật 19:05 03\/11\/2026 \(giờ Việt Nam\)/);
  assert.match(text, /NỘI DUNG TRANG/);
});

test("404 page has its own title", async () => {
  const { metadata } = await import("../app/not-found.tsx");
  assert.equal(metadata.title, "Không tìm thấy trang");
});
