# Bảng VN30 — web tĩnh

Trang web tĩnh, tiếng Việt, cho rổ VN30:

- `/` — bảng VN30 của phiên: hạng theo lợi nhuận 6 tháng, giá đóng cửa, lợi nhuận 3/6/12 tháng và chênh lệch so với
  VNINDEX, nhận định mới nhất và số nhận định đúng/đã chấm.
- `/ma/<MÃ>/` — biểu đồ nến ngày kèm SMA50/SMA200, chỉ báo mới nhất kèm câu tóm tắt tự động (chỉ nêu sự kiện),
  sức mạnh tương đối so với VNINDEX, nhận định AI mới nhất và lịch sử chấm điểm.
- `/phuong-phap/` — nguồn dữ liệu, cách chấm, giới hạn đã biết và miễn trừ.

Nhận định kỹ thuật tự động, chỉ để tham khảo, không phải khuyến nghị đầu tư.

## Dữ liệu được cập nhật thế nào

Trang không gọi API lúc người dùng xem. Mọi số liệu nằm trong thư mục `data/` và được đọc **lúc build**:

- `data/meta.json`, `data/screen.json`, `data/symbols/<MÃ>.json`, theo hợp đồng `vn30-web-data/v1`.
- Script `ai/export_vn30_web.py` của dự án chính ghi các file này từ backend sau mỗi phiên. Tác vụ hằng tối commit và
  push repo này khi dữ liệu đổi; Vercel tự build lại sau mỗi lần push.
- Mọi file đều được kiểm tra khi build (`lib/data.ts`). Sai schema, thiếu trường hay thiếu file của một mã sẽ làm
  build dừng với thông báo chỉ rõ file và trường, nên bản đang chạy trên Vercel không bị thay bằng bản hỏng.
- `null` trong dữ liệu luôn hiển thị là "—", không bao giờ là 0.

Biến môi trường `DATA_DIR` đổi thư mục dữ liệu (mặc định `data/`, tính từ thư mục repo).

## Build

Cần Node 22 trở lên.

```bash
npm install
npm test                                  # kiểm tra các hàm định dạng, tóm tắt, SMA, đọc dữ liệu
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
- `components/` — biểu đồ (client component duy nhất), bảng chỉ báo, nhận định, lịch sử.
- `lib/` — hàm thuần: định dạng vi-VN, nhãn, tóm tắt chỉ báo, SMA, đọc và kiểm tra dữ liệu.
- `tests/` — test `node:test`; `tests/fixtures/data/` là bộ dữ liệu mẫu theo đúng hợp đồng.
