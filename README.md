# Bảng VN30 — web tĩnh

Trang web tĩnh, tiếng Việt, cho rổ VN30:

- `/` — bảng VN30 của phiên: hạng theo lợi nhuận 6 tháng, giá đóng cửa, lợi nhuận 3/6/12 tháng và chênh lệch so với
  VNINDEX, nhận định 20 phiên mới nhất, và điểm “x/y đúng” kèm mốc so sánh của luật và trạng thái mẫu.
- `/ma/<MÃ>/` — biểu đồ nến ngày kèm SMA50/SMA200, chỉ báo mới nhất kèm câu tóm tắt tự động (chỉ nêu sự kiện),
  sức mạnh tương đối so với VNINDEX, nhận định AI mới nhất, điểm của mã và lịch sử chấm điểm.
- `/phuong-phap/` — nguồn dữ liệu, cách chấm, giới hạn đã biết và miễn trừ.

Nhận định kỹ thuật tự động, chỉ để tham khảo, không phải khuyến nghị đầu tư.

## Dữ liệu được cập nhật thế nào

Trang không gọi API lúc người dùng xem. Mọi số liệu nằm trong thư mục `data/` và được đọc **lúc build**:

- `data/meta.json`, `data/screen.json`, `data/symbols/<MÃ>.json`, theo hợp đồng `vn30-web-data/v2`. Bộ dữ liệu
  `vn30-web-data/v1` cũ làm build dừng, vì v2 đổi nghĩa của `notes`, `score` và `thesis`.
- Script `ai/export_vn30_web.py` của dự án chính ghi các file này từ backend sau mỗi phiên. Tác vụ hằng tối commit và
  push repo này khi dữ liệu đổi; Vercel tự build lại sau mỗi lần push.
- Mọi file đều được kiểm tra khi build (`lib/data.ts`). Sai schema, giá trị ngoài danh sách cho phép, nhận định không
  phải kỳ hạn 20 phiên, nhận định sai thứ tự mới nhất trước, thiếu trường hay thiếu file của một mã sẽ làm build dừng
  với thông báo chỉ rõ file và trường, nên bản đang chạy trên Vercel không bị thay bằng bản hỏng.
- `null` trong dữ liệu luôn hiển thị là "—", không bao giờ là 0.
- `meta.unavailable` liệt kê phần nào của mã nào chưa đọc được ở lượt cập nhật. Phần giữ lại từ lượt trước được hiển thị
  kèm một dòng ghi chú; phần không đọc được và không có gì để giữ hiển thị "—" / "chưa lấy được", không bao giờ là
  "chưa có nhận định" hay "chưa chấm".

Biến môi trường `DATA_DIR` đổi thư mục dữ liệu (mặc định `data/`, tính từ thư mục repo).

## Build

Cần Node 22 trở lên.

```bash
npm install
npm test                                  # hàm thuần, đọc dữ liệu, và render các trang từ bộ dữ liệu mẫu
npm run build                             # xuất trang tĩnh ra out/ từ data/
DATA_DIR=tests/fixtures/data npm run build   # build bằng bộ dữ liệu mẫu
```

Trên máy Windows của dự án, shim `npm`/`npx` có thể treo; gọi trực tiếp:

```bash
node node_modules/next/dist/bin/next build
node --disable-warning=ExperimentalWarning --experimental-strip-types --test tests/*.test.mts
```

Xem thử thư mục `out/` bằng một static server bất kỳ, ví dụ `python -m http.server 3107 --directory out`.

## Cấu trúc

- `app/` — layout và các trang (Next.js App Router, `output: "export"`).
- `components/` — biểu đồ (client component duy nhất), bảng chỉ báo, nhận định, điểm, lịch sử.
- `lib/` — hàm thuần: định dạng vi-VN, nhãn, tóm tắt chỉ báo, SMA, đọc và kiểm tra dữ liệu, đọc `meta.unavailable`.
- `tests/` — test `node:test`; `tests/fixtures/data/` là bộ dữ liệu mẫu theo đúng hợp đồng, gồm cả các trường hợp giữ
  dữ liệu lượt trước, chưa lấy được và backend chưa hỗ trợ mã. `tests/helpers/` render các trang ra HTML tĩnh để test
  đọc đúng chữ người xem thấy.
