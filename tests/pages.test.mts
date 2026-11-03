// Renders the real pages from the fixture data set (tests/helpers/render.mts) and checks the text a visitor reads.
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

/** Visible text of each <td> of the overview row that links to /ma/<ticker>/ (Link drops the slash outside Next). */
function homeCells(html: string, ticker: string): string[] {
  const link = new RegExp(`href="/ma/${ticker}/?"`);
  const row = html.split("<tr").map((r) => r.split("</tr>")[0]).find((r) => link.test(r));
  assert.ok(row, `row ${ticker}`);
  return row.split("<td").slice(1).map((cell) => visibleText(`<td${cell}`));
}

function assertClean(text: string, where: string) {
  assert.doesNotMatch(text, /\bundefined\b|\bNaN\b|\bnull\b/, where);
}

test("home: notes cells say '—' when unknown, mark kept values, and show the score with its baseline", async () => {
  const html = await renderHome();
  const text = visibleText(html);
  assertClean(text, "home");
  const cells = (t: string) => homeCells(html, t).slice(-2);
  assert.deepEqual(cells("MBB"), ["Đi ngang 03/11/2026", "3/7 đúng mốc 4/7 · mẫu nhỏ"]);
  assert.deepEqual(cells("VIC"), ["Tăng 03/11/2026", "chưa chấm"]);
  assert.deepEqual(cells("STB"), ["Chưa có", "chưa chấm"]);
  assert.deepEqual(cells("ACB"), ["Tăng* (lấy từ lượt cập nhật trước) 02/11/2026", "1/1 đúng mốc 0/1 · mẫu nhỏ"]);
  assert.deepEqual(cells("VCB"), ["Đi ngang* (lấy từ lượt cập nhật trước) 02/11/2026", "chưa chấm"]);
  // Notes not read and nothing kept (HPG), or not served (FPT): unknown, never "no notes" / "not scored".
  assert.deepEqual(cells("HPG"), ["—", "—"]);
  assert.deepEqual(cells("FPT"), ["—", "—"]);
  assert.match(text, /Ô “—” ở hai cột này: lượt cập nhật gần nhất chưa lấy được nhận định của mã đó\./);
  assert.match(text, /Dấu \* : nhận định và điểm của mã lấy từ lượt cập nhật trước/);
  assert.match(text, /trong toàn bộ y nhận định 20 phiên đã chấm của mã, x nhận định đúng; “mốc z\/y”/);
  // The screen-reader caption counts the rows; VN30-1 stays "top 10" whatever the screen's topK (3 here).
  assert.match(text, /7 mã của rổ VN30 xếp theo lợi nhuận 6 tháng/);
  assert.doesNotMatch(text, /30 mã/);
  assert.match(text, /★ = 3 mã có lợi nhuận 6 tháng cao nhất/);
  assert.match(text, /nắm giữ 10 mã có lợi nhuận 6 tháng cao nhất thắng VNINDEX/);
  assert.deepEqual(adviceWords(text), []);
});

test("a notes part listed as not read hides a score object too ('—', never 'chưa chấm')", async () => {
  // The contract leaves open whether a not-served notes part carries score null or an empty score object.
  const dir = fixtureVariant(({ read, write }) => {
    write("symbols/FPT.json", { ...read("symbols/FPT.json"), score: { scored: 0, hits: 0, baselineHits: 0, sampleStatus: "no-data" } });
  });
  assert.deepEqual(homeCells(await renderHome(dir), "FPT").slice(-2), ["—", "—"]);
  const text = visibleText(await renderTicker("FPT", dir));
  assert.match(text, /Điểm nhận định 20 phiên — Chưa lấy được nhận định/);
  assert.doesNotMatch(text, /chưa chấm|Chưa có nhận định/);
});

test("home: the '—' and '*' legends appear only when some row needs them", async () => {
  const dir = fixtureVariant(({ read, write }) => {
    const meta = read("meta.json");
    meta.unavailable = [];
    write("meta.json", meta);
    for (const s of ["HPG", "FPT"]) write(`symbols/${s}.json`, { ...read(`symbols/${s}.json`), score: { scored: 0, hits: 0, baselineHits: 0, sampleStatus: "no-data" } });
  });
  const text = visibleText(await renderHome(dir));
  assert.doesNotMatch(text, /Ô “—” ở hai cột này/);
  assert.doesNotMatch(text, /Dấu \*/);
  assert.doesNotMatch(text, /\*/);
});

test("ticker MBB (fresh): every status label, cut thesis, whole-journal score with baseline and sample", async () => {
  const text = visibleText(await renderTicker("MBB"));
  assertClean(text, "MBB");
  assert.doesNotMatch(text, /Chưa lấy được|lượt cập nhật trước/);
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
  assert.match(text, /Bảng hiện tối đa 60 nhận định gần nhất\. Lợi nhuận 20 phiên tính trên giá đóng cửa điều chỉnh của phiên tín hiệu và phiên chấm, theo giá lưu tại lúc chấm\./);
});

test("ticker VIC: older indicator row is flagged; a null thesis says why nothing is shown", async () => {
  const text = visibleText(await renderTicker("VIC"));
  assertClean(text, "VIC");
  assert.match(text, /Chỉ báo ngày, phiên 31\/10\/2026 \(cũ hơn phiên dữ liệu 03\/11\/2026\)/);
  assert.match(text, /Không hiển thị lập luận gốc: nhận định không có lập luận, hoặc lập luận bị ẩn vì nhắc tới thông tin ngoài phạm vi kỹ thuật\./);
  assert.doesNotMatch(text, /Lập luận gốc của AI/);
  assert.match(text, /Điểm nhận định 20 phiên chưa chấm: chưa có nhận định 20 phiên nào của mã đủ kỳ hạn để chấm\./);
});

test("ticker STB (fresh, nothing yet): truthful empty states and indicator sentences that match the table", async () => {
  const text = visibleText(await renderTicker("STB"));
  assertClean(text, "STB");
  assert.doesNotMatch(text, /Chưa lấy được|cũ hơn/);
  assert.match(text, /Chưa có nhận định 20 phiên nào cho mã này\./);
  assert.match(text, /Chưa có nhận định 20 phiên nào\./);
  assert.match(text, /Chưa có dữ liệu sức mạnh tương đối cho mã này\./);
  assert.match(text, /Giá đóng cửa 19\.877 nằm ở mức SMA50 \(19\.877\) và trên SMA200 \(19\.650\)\./);
  assert.match(text, /RSI14 = 70,0 \(từ 70 trở lên\)\./);
  assert.match(text, /MACD histogram xấp xỉ 0\./);
  assert.match(text, /RSI14 70,0 MACD 12,3 MACD tín hiệu 12,3 MACD histogram 0,0/);
});

test("ticker ACB: notes kept from the previous run are shown with a note, never as fresh or missing", async () => {
  const text = visibleText(await renderTicker("ACB"));
  assertClean(text, "ACB");
  assert.match(text, /Lượt cập nhật gần nhất chưa lấy được nhận định: HTTP 500\. Phần nhận định trên trang này là của lượt cập nhật trước\./);
  assert.match(text, /Nhận định AI mới nhất Của lượt cập nhật trước \(lượt gần nhất chưa lấy được nhận định\)\. Tăng/);
  assert.match(text, /Điểm nhận định 20 phiên Của lượt cập nhật trước\. Nhận định đúng 1\/1 đúng Mốc so sánh của luật 0\/1 đúng/);
  assert.match(text, /01\/10\/2026 Giảm 29\/10\/2026 -6,1% Đúng/);
  assert.doesNotMatch(text, /Chưa có nhận định|Chưa lấy được nhận định|chưa chấm/);
  assert.doesNotMatch(text, /Số liệu của lượt cập nhật trước/); // technical was read fresh
});

test("ticker HPG: notes not read and nothing kept → '—' / 'chưa lấy được'; technical kept → shown with a note", async () => {
  const text = visibleText(await renderTicker("HPG"));
  assertClean(text, "HPG");
  assert.match(text, /Lượt cập nhật gần nhất chưa lấy được chỉ báo kỹ thuật: HTTP 429\. Phần chỉ báo kỹ thuật trên trang này là của lượt cập nhật trước\./);
  assert.match(text, /Lượt cập nhật gần nhất chưa lấy được nhận định: HTTP 401\. Chưa có dữ liệu lượt trước để hiện thay\./);
  assert.match(text, /Chỉ báo kỹ thuật Số liệu của lượt cập nhật trước \(lượt gần nhất chưa lấy được\)\. Chỉ báo ngày, phiên 02\/11\/2026/);
  assert.match(text, /Nhận định AI mới nhất Chưa lấy được nhận định của mã này ở lượt cập nhật gần nhất\./);
  assert.match(text, /Điểm nhận định 20 phiên — Chưa lấy được nhận định/);
  assert.match(text, /Chưa lấy được lịch sử nhận định của mã này/);
  assert.match(text, /Sức mạnh tương đối so với VNINDEX Số liệu của lượt cập nhật trước/);
  assert.doesNotMatch(text, /Chưa có nhận định|chưa chấm/);
});

test("ticker FPT (not served): one line names both parts once with the reason; no 'no data' claims", async () => {
  const html = await renderTicker("FPT");
  const text = visibleText(html);
  assertClean(text, "FPT");
  assert.match(text, /Chưa lấy được chỉ báo kỹ thuật và nhận định: backend chưa hỗ trợ mã này \(UNSUPPORTED_CAPABILITY\)\./);
  assert.equal(count(text, "UNSUPPORTED_CAPABILITY"), 1);
  assert.equal(count(html, "<li>"), 1);
  assert.match(text, /Chưa lấy được chỉ báo kỹ thuật của mã này/);
  assert.match(text, /Chưa lấy được sức mạnh tương đối của mã này/);
  assert.doesNotMatch(text, /Chưa có nhận định|chưa chấm|Chưa có dữ liệu chỉ báo|Chưa có dữ liệu sức mạnh/);
});

test("ticker VCB: a candles failure keeps the whole previous file, and every card says so", async () => {
  const text = visibleText(await renderTicker("VCB"));
  assertClean(text, "VCB");
  assert.match(text, /Lượt cập nhật gần nhất chưa lấy được nến: HTTP 502\. Biểu đồ, chỉ báo và nhận định trên trang này là của lượt cập nhật trước\./);
  assert.match(text, /Giá đóng cửa 59\.650 · phiên 02\/11\/2026/);
  assert.match(text, /Chỉ báo kỹ thuật Số liệu của lượt cập nhật trước/);
  assert.match(text, /Nhận định AI mới nhất Của lượt cập nhật trước/);
  assert.match(text, /Lịch sử nhận định 20 phiên Của lượt cập nhật trước/);
});

test("variants: newer indicator row, missing or empty candles, an 'ok' sample", async () => {
  const newer = fixtureVariant(({ read, write }) => {
    const stb = read("symbols/STB.json");
    stb.indicators.date = "2026-11-04";
    write("symbols/STB.json", stb);
  });
  assert.doesNotMatch(visibleText(await renderTicker("STB", newer)), /cũ hơn/);

  const noCandles = fixtureVariant(({ read, write }) => {
    const meta = read("meta.json");
    meta.unavailable.push({ symbol: "VIC", part: "candles", reason: "HTTP 500; chưa có dữ liệu lượt trước" });
    write("meta.json", meta);
    write("symbols/VIC.json", { ...read("symbols/VIC.json"), candles: [] });
    write("symbols/STB.json", { ...read("symbols/STB.json"), candles: [] });
  });
  const vic = visibleText(await renderTicker("VIC", noCandles));
  assert.match(vic, /Lượt cập nhật gần nhất chưa lấy được nến: HTTP 500\. Chưa có dữ liệu lượt trước để hiện thay\./);
  assert.match(vic, /Chưa lấy được dữ liệu nến của mã này ở lượt cập nhật gần nhất\./);
  assert.match(vic, /Giá đóng cửa 230\.500 · phiên 03\/11\/2026/); // from the screen row
  const stb = visibleText(await renderTicker("STB", noCandles));
  assert.match(stb, /Chưa có dữ liệu nến cho mã này\./);

  const ok = fixtureVariant(({ read, write }) => {
    write("symbols/MBB.json", { ...read("symbols/MBB.json"), score: { scored: 31, hits: 12, baselineHits: 14, sampleStatus: "ok" } });
  });
  assert.match(visibleText(await renderTicker("MBB", ok)), /Nhận định đúng 12\/31 đúng Mốc so sánh của luật 14\/31 đúng Mẫu đủ mẫu tối thiểu của luật/);
  assert.deepEqual(homeCells(await renderHome(ok), "MBB").slice(-1), ["12/31 đúng mốc 14/31 · đủ mẫu"]);
});

test("ticker pages: no advice words and no raw null/undefined/NaN on any fixture ticker", async () => {
  for (const ticker of ["ACB", "FPT", "HPG", "MBB", "STB", "VCB", "VIC"]) {
    const html = await renderTicker(ticker);
    // The thesis is English text from the note writer; check the site's own Vietnamese copy around it.
    const text = visibleText(html.replace(/<p lang="en"[\s\S]*?<\/p>/g, ""));
    assertClean(text, ticker);
    assert.deepEqual(adviceWords(text), [], ticker);
  }
});

test("ticker metadata and unknown tickers", async () => {
  const { generateMetadata } = await import("../app/ma/[ticker]/page.tsx");
  const meta = await generateMetadata({ params: Promise.resolve({ ticker: "MBB" }) });
  assert.match(String(meta.description), /nhận định kỹ thuật tự động kỳ hạn 20 phiên cho MBB, có chấm điểm\. Chỉ để tham khảo, không phải khuyến nghị đầu tư\./);
  await assert.rejects(renderTicker("XYZ"));
});

test("method page: v2 rules in words, every status explained, advice words only in the disclaimer", async () => {
  const text = visibleText(await renderMethod());
  assertClean(text, "phuong-phap");
  for (const phrase of [
    "Trang chỉ hiển thị và chấm nhận định kỳ hạn 20 phiên",
    "Lập luận gốc của mô hình bằng tiếng Anh, hiển thị nguyên văn",
    "được cắt ở 1.500 ký tự và kết thúc bằng dấu “…”",
    "bị ẩn hoàn toàn nếu nhắc tới thông tin ngoài phạm vi kỹ thuật, như vị thế hay số cổ phiếu đang nắm, tiền, giá vốn, lệnh hay hành động giao dịch, đường dẫn, tên hoặc địa chỉ máy, mã nội bộ",
    "R = giá đóng cửa điều chỉnh phiên chấm ÷ giá đóng cửa điều chỉnh phiên tín hiệu − 1, tính trên giá điều chỉnh đang lưu tại lúc chấm",
    "R từ +5% trở lên là Tăng, từ −4% trở xuống là Giảm",
    "là tổng trên toàn bộ y nhận định 20 phiên đã chấm của mã từ khi bắt đầu ghi",
    "bảng lịch sử chỉ hiện tối đa 60 nhận định gần nhất",
    "mốc so sánh “z/y”",
    "“mẫu nhỏ” khi chưa có 30 nhận định đã chấm có kỳ hạn 20 phiên không chồng lên nhau",
    "28/74", "34/74",
    "“Chờ đủ 20 phiên”", "“Chờ nến phiên chấm (đang thiếu)”", "“Chờ nến phiên tín hiệu (đang thiếu)”",
    "“Chờ lịch nghỉ HOSE để định phiên chấm”", "“Không chấm (không nhận định)”", "“Không chấm (ghi sau hạn)”",
    "“Không chấm (chưa định được hạn ghi)”",
    "trang giữ số liệu của lượt trước cho phần đó và ghi rõ",
  ]) assert.ok(text.includes(phrase), phrase);
  assert.doesNotMatch(text, /số đếm thật trên các nhận định đã chấm của mã đó/);
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
