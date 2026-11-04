# Bảng VN30 — web tĩnh

Trang web tĩnh, tiếng Việt, cho rổ VN30:

- `/` — bảng VN30 của phiên: hạng theo lợi nhuận 6 tháng, giá đóng cửa, lợi nhuận 3/6/12 tháng và chênh lệch so với
  VNINDEX, nhận định 20 phiên mới nhất được đăng, và điểm “x/y đúng” kèm mốc so sánh của luật và trạng thái mẫu.
- `/ma/<MÃ>/` — biểu đồ nến ngày kèm SMA50/SMA200, chỉ báo mới nhất kèm câu tóm tắt tự động (chỉ nêu sự kiện),
  sức mạnh tương đối so với VNINDEX, nhận định AI mới nhất được đăng, điểm của mã và lịch sử chấm điểm.
- `/phuong-phap/` — nguồn dữ liệu, cách chấm, giới hạn đã biết và miễn trừ.

Nhận định kỹ thuật tự động, chỉ để tham khảo, không phải khuyến nghị đầu tư.

## Dữ liệu được cập nhật thế nào

Trang không gọi API lúc người dùng xem. Mọi số liệu nằm trong thư mục `data/` và được đọc **lúc build**:

- `data/meta.json`, `data/screen.json`, `data/symbols/<MÃ>.json`, theo hợp đồng `vn30-web-data/v2`. Bộ dữ liệu
  `vn30-web-data/v1` cũ làm build dừng, vì v2 đổi nghĩa của `notes`, `score` và `thesis`. `notes` chỉ gồm các nhận
  định exporter xuất, còn `score` là tổng của backend trên toàn bộ nhận định 20 phiên đã chấm của mã, nên có thể đếm
  cả nhận định không có trong `notes`.
- Script `ai/export_vn30_web.py` của dự án chính ghi các file này từ backend sau mỗi phiên. Tác vụ hằng tối commit và
  push repo này khi dữ liệu đổi; Vercel tự build lại sau mỗi lần push.
- Mọi file đều được kiểm tra khi build (`lib/data.ts`). Sai schema, giá trị ngoài danh sách cho phép, nhận định không
  phải kỳ hạn 20 phiên, nhận định sai thứ tự mới nhất trước, thiếu trường hay thiếu file của một mã sẽ làm build dừng
  với thông báo chỉ rõ file và trường, nên bản đang chạy trên Vercel không bị thay bằng bản hỏng.
- `null` trong dữ liệu luôn hiển thị là "—", không bao giờ là 0.
- `meta.unavailable` liệt kê phần nào của mã nào không phải số liệu vừa đọc được. Trang chỉ dựa vào hậu tố của lý do
  và việc giá trị có `null` hay không, không suy nghĩa từ chữ của lý do (lý do hiện nguyên văn):
  - không hậu tố (backend trả rỗng thật hoặc chưa hỗ trợ mã): "Chưa có …: <lý do>";
  - `; chưa có dữ liệu lượt trước`: "chưa lấy được", hiện "—", không bao giờ là "chưa có nhận định" hay "chưa chấm";
  - `; giữ dữ liệu lượt trước`: hiện số liệu kèm ghi chú "dữ liệu giữ từ một lượt cập nhật trước" (exporter có thể
    giữ qua nhiều lượt liên tiếp). Câu ở đầu trang chỉ kể những giá trị mà dữ liệu giữ thật sự có, theo giá trị nào
    `null`: phần chỉ báo giữ riêng có thể chỉ có chỉ báo, hoặc chỉ có sức mạnh tương đối (lượt trước thiếu giá trị
    kia); khi không đọc được nến và cả file được giữ, câu cũng chỉ kể những phần file đó có. Nhận định được giữ có
    tên "nhận định" khi dữ liệu giữ có ít nhất một nhận định 20 phiên, và "phần nhận định" khi dữ liệu giữ không có
    nhận định 20 phiên nào (chỉ có điểm). Thẻ của giá trị `null` ghi "Dữ liệu giữ từ một lượt cập nhật
    trước không có …", không bao giờ "chưa lấy được".
  - Phần chỉ báo trống, cả chỉ báo lẫn sức mạnh tương đối đều `null` và có hơn một lý do: dòng đầu trang nêu cả hai
    cùng mọi lý do, còn hai thẻ ghi "(lý do ghi ở đầu trang)" thay vì lặp lại mọi lý do, vì mỗi lý do có thể chỉ
    thuộc một trong hai giá trị mà trang không đọc chữ của lý do để biết.
- Giá trị của mỗi phần phải khớp trạng thái đó như exporter ghi (ví dụ phần đọc mới không có `null` nào không kèm
  mục trong `meta.unavailable`); dữ liệu sai khớp làm build dừng.

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
- `tests/` — test `node:test`; `tests/fixtures/data/` là bộ dữ liệu mẫu theo đúng hợp đồng, với trạng thái của từng
  phần đúng như exporter ghi, gồm cả các trường hợp chưa có (backend chưa hỗ trợ mã, chưa có chỉ báo ngày, dữ liệu
  VNINDEX chưa khớp), chưa lấy được, giữ từ một lượt cập nhật trước (kể cả phần chỉ báo mà dữ liệu giữ chỉ có chỉ báo,
  GAS, hoặc chỉ có sức mạnh tương đối, VPL, và nhận định giữ từ một nhật ký rỗng, LPB), và giữ cả file khi không đọc
  được nến. Ba file GAS, LPB và VPL do chính exporter ghi (hai lượt nối nhau, backend giả); các file khác dựng bằng
  script riêng, không qua exporter, nên vài giá trị số trong cùng một file chưa khớp nhau như exporter sẽ ghi (ví dụ
  giá đóng cửa của dòng chỉ báo và của nến cùng phiên). `tests/helpers/` render các trang ra HTML tĩnh để test đọc
  đúng chữ người xem thấy.
