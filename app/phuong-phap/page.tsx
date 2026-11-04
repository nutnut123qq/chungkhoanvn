import type { Metadata } from "next";
import { loadSiteData, NOTE_HORIZON, NOTE_LIMIT, THESIS_MAX } from "../../lib/data.ts";
import { formatDate, formatNumber, noteStatusLabel, pendingLabel } from "../../lib/format.ts";

export const metadata: Metadata = {
  title: "Phương pháp và giới hạn",
  description: "Nguồn dữ liệu, cách tạo và chấm nhận định, các giới hạn đã biết và miễn trừ trách nhiệm.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const H = NOTE_HORIZON;
const notScored = (status: "no-view" | "out-of-window-not-scored" | "window-undetermined-not-scored") =>
  noteStatusLabel({ status, pendingReason: null, hit: null, horizonSessions: H });

export default function MethodPage() {
  const { meta, screen } = loadSiteData();
  return (
    <article className="max-w-3xl space-y-8 text-[15px] leading-relaxed">
      <h1 className="text-2xl font-bold">Phương pháp và giới hạn</h1>

      <Section title="Nguồn dữ liệu">
        <p>
          Nguồn giá: {meta.source}. Dữ liệu được xuất và trang được dựng
          lại sau mỗi phiên giao dịch; bản hiện tại là phiên {formatDate(meta.session)}. Trang không gọi dữ liệu trực tiếp
          khi bạn xem; số liệu chỉ mới tới lần cập nhật gần nhất.
        </p>
        <p>
          Rổ VN30 theo kỳ xét duyệt có hiệu lực từ {formatDate(screen.basket.effectiveDate)}. Lợi nhuận 3, 6 và 12 tháng tính trên
          giá đóng cửa điều chỉnh; “so VNINDEX” là chênh lệch giữa lợi nhuận của mã và của VNINDEX cùng kỳ. Chỉ báo (SMA, EMA,
          RSI, MACD, Bollinger, ATR) là giá trị khung ngày mới nhất. Đường SMA50 và SMA200 trên biểu đồ được tính lại từ
          chính các nến hiển thị.
        </p>
        <p>
          Mỗi mã có ba phần được đọc riêng: nến, chỉ báo kỹ thuật (kèm sức mạnh tương đối so VNINDEX) và nhận định. Khi
          một phần không phải số liệu vừa đọc được, trang của mã ghi rõ phần đó ở một trong ba trạng thái:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            “Chưa có”: backend đã trả lời nhưng chưa có dữ liệu cho phần đó (ví dụ chưa có chỉ báo ngày, hoặc dữ liệu
            VNINDEX chưa khớp tới phiên mới nhất của mã), hoặc chưa hỗ trợ mã đó.
          </li>
          <li>“Chưa lấy được”: lượt cập nhật gần nhất gặp lỗi khi đọc phần đó và không có dữ liệu cũ để hiện thay.</li>
          <li>
            “Dữ liệu giữ từ một lượt cập nhật trước”: lượt cập nhật gần nhất gặp lỗi khi đọc phần đó; trang hiện số liệu
            của lần đọc được gần nhất trước đó, có thể đã cách nhiều lượt. Riêng khi không đọc được nến, toàn bộ dữ liệu
            của mã được giữ nguyên như lần cập nhật trước đó (nếu có).
          </li>
        </ul>
        <p>Ở trang chủ, ô “—” ở cột nhận định và cột điểm nghĩa là chưa có hoặc chưa lấy được.</p>
      </Section>

      <Section title="Nhận định hướng được tạo thế nào">
        <p>
          Với mỗi mã backend đã hỗ trợ, sau mỗi phiên một mô hình AI đọc nến và chỉ báo kỹ thuật của mã rồi ghi một nhận
          định cho {H} phiên tới: Tăng, Giảm, Đi ngang hoặc Không nhận định. Mô hình không đọc tin tức, báo cáo tài chính
          hay sự kiện doanh nghiệp. Nhận định được ghi vào nhật ký trước khi biết kết quả. Trang chỉ hiển thị và chấm nhận
          định kỳ hạn {H} phiên; nhận định kỳ hạn khác (nếu có) không xuất hiện ở đây.
        </p>
        <p>
          Lập luận gốc của mô hình, thường viết bằng tiếng Anh, hiển thị nguyên văn với nhận định mới nhất được đăng ở
          trang từng mã. Lập luận dài hơn {formatNumber(THESIS_MAX)} ký tự được cắt ở {formatNumber(THESIS_MAX)} ký tự và
          kết thúc bằng dấu “…”.
        </p>
        <p>
          Trước khi đăng, nhận định đi qua hai luật tự động. Luật thứ nhất không đọc lập luận: trang chỉ đăng một số loại
          nhận định, xét theo các trường khác của nhận định. Luật thứ hai là một bộ lọc dò theo từ khóa trên lập luận của
          nhận định được đăng, ẩn cả lập luận khi nghi lập luận nhắc tới hành động giao dịch, vị thế, tiền, lệnh, đường
          dẫn hay mã nội bộ; bộ lọc có thể ẩn oan một lập luận chỉ có nội dung kỹ thuật, và không bảo đảm bắt hết mọi
          cách diễn đạt.
        </p>
        <p>
          Vì lập luận được đăng nguyên văn, từ bản v7 (ngày 03/11/2026), hướng dẫn viết của mô hình có thêm các luật viết
          lập luận cho trang công khai, trong đó có: không dùng từ chỉ hành động giao dịch ở bất kỳ dạng nào, trừ vài cụm
          mô tả biểu đồ; không nhắc vị thế, tiền hay T+n; không ghi đường dẫn, mã nội bộ hay chuỗi ký tự dài. Các bản
          trước v7 cũng giới hạn mô hình ở nến và chỉ báo, nhưng chưa có các luật viết này. Lập luận có ngày tín hiệu
          03/11/2026 có thể được viết theo bản v7 hoặc theo bản cũ hơn; trang không ghi lập luận nào được viết theo bản
          nào.
        </p>
      </Section>

      <Section title="Cách chấm điểm (luật direction-score-v1 của backend)">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Phiên chấm là đúng {H} phiên giao dịch sau phiên tín hiệu theo lịch HOSE. Lợi nhuận R = giá đóng cửa điều chỉnh
            phiên chấm ÷ giá đóng cửa điều chỉnh phiên tín hiệu − 1. Ở mỗi lượt cập nhật, backend chấm lại cả nhật ký trên
            giá điều chỉnh đang lưu lúc đó. Giá điều chỉnh được tính lại sau các sự kiện như chia cổ tức, vì vậy R và kết quả
            Đúng/Sai của một nhận định đã chấm có thể đổi giữa các lượt cập nhật, và R có thể khác phép chia trên giá gốc.
          </li>
          <li>R từ +5% trở lên là Tăng, từ −4% trở xuống là Giảm, còn lại là Đi ngang.</li>
          <li>Nhận định “Đúng” khi trùng với kết quả thực tế, ngược lại là “Sai”. “Không nhận định” không được chấm.</li>
          <li>
            Chỉ nhận định ghi trước giờ mở cửa phiên kế tiếp mới được chấm; nếu một phiên có nhiều nhận định ghi trong hạn,
            chỉ nhận định sớm nhất được chấm, còn các nhận định khác ghi trong hạn của phiên đó không được chấm và không
            hiển thị.
          </li>
          <li>
            Mốc so sánh của luật: với mỗi nhận định đã chấm, lấy kết quả (Tăng, Giảm hay Đi ngang) xảy ra nhiều nhất trong
            lịch sử của chính mã đó tính tới phiên tín hiệu; khi hoà, ưu tiên Đi ngang, rồi tới Tăng, rồi tới Giảm; khi
            chưa có lịch sử nào, mốc là Đi ngang. Một cách đoán chỉ có ích nếu đúng nhiều hơn mốc này trên cùng các phiên.
          </li>
        </ul>
        <p>
          Bảng lịch sử ở trang từng mã hiện tối đa {NOTE_LIMIT} nhận định được đăng gần nhất, mới nhất trước. Trạng thái
          của từng nhận định:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>“{pendingLabel("immature", H)}”: phiên chấm chưa tới hoặc chưa kết thúc.</li>
          <li>
            “{pendingLabel("target-bar-missing", H)}” và “{pendingLabel("signal-bar-missing", H)}”: phiên đã kết thúc nhưng
            dữ liệu chưa có nến của phiên đó; nhận định chờ tới khi có nến, không dùng nến phiên khác thay.
          </li>
          <li>
            “{pendingLabel("calendar-coverage-expired", H)}”: phiên chấm rơi vào khoảng thời gian chưa có lịch nghỉ của HOSE,
            vì vậy chưa xác định được ngày chấm.
          </li>
          <li>“{notScored("no-view")}”: nhận định không chọn hướng.</li>
          <li>“{notScored("out-of-window-not-scored")}”: nhận định ghi sau giờ mở cửa phiên kế tiếp phiên tín hiệu.</li>
          <li>
            “{notScored("window-undetermined-not-scored")}”: phiên kế tiếp phiên tín hiệu nằm ngoài phần lịch HOSE đã biết,
            vì vậy chưa xác định được hạn ghi.
          </li>
        </ul>
        <p>
          Điểm “x/y đúng” của một mã là tổng trên toàn bộ y nhận định {H} phiên đã chấm của mã từ khi bắt đầu ghi, kể cả
          nhận định không hiện trên trang. Bên cạnh là mốc so sánh “z/y”: số lần mốc của luật đúng trên đúng y nhận định đó,
          để bạn tự so. Đây là số đếm, không phải xác suất.
        </p>
        <p>
          Trạng thái mẫu: “mẫu nhỏ” khi chưa có 30 nhận định đã chấm có kỳ hạn {H} phiên không chồng lên nhau, “đủ mẫu” khi
          đã có ít nhất 30. Nhận định ghi mỗi phiên cho {H} phiên tới chồng lên nhau nhiều, vì vậy y lớn hơn nhiều so với số
          quan sát thật sự độc lập; khi mẫu còn nhỏ, tỷ lệ đúng dao động mạnh.
        </p>
      </Section>

      <Section title="Giới hạn đã biết">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Hai bài thử mù trên MBB và BID (30 và 31/10/2026, kỳ hạn 20 phiên) cho kết quả 28/74 nhận định đúng, trong khi luôn
            đoán “Đi ngang” đúng 34/74. Tức là chưa thấy lợi thế; cách đoán tự động còn kém mốc so sánh.
          </li>
          <li>28 mã còn lại chưa có bài thử mù nào.</li>
          <li>
            Tỷ lệ nền (xác suất ước lượng bằng kNN trên các phiên tương tự trong lịch sử của mã, cho việc giá chạm mức +5%
            trước, chạm mức −4% trước, hay không chạm mức nào trong {H} phiên tính từ giá mở cửa phiên sau) mới có cho MBB
            và BID, và trang này không hiển thị. Tỷ lệ nền khác với mốc so sánh của luật chấm ở trên.
          </li>
          <li>
            Bảng xếp hạng chỉ đo sức mạnh giá trong quá khứ. Bài kiểm tra lịch sử VN30-1 kết luận chưa đủ bằng chứng rằng nắm
            giữ 10 mã mạnh nhất thắng VNINDEX.
          </li>
          <li>Dữ liệu có thể trễ, thiếu hoặc sai do nguồn hoặc do lỗi xử lý; ô “—” nghĩa là chưa có dữ liệu hoặc chưa lấy được.</li>
        </ul>
      </Section>

      <Section title="Miễn trừ trách nhiệm">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
          Nhận định kỹ thuật tự động, chỉ để tham khảo, không phải khuyến nghị đầu tư. Trang này không nhằm đưa ra lời
          khuyên giao dịch, không quản lý tiền của ai và không chịu trách nhiệm cho quyết định đầu tư dựa trên nội dung ở
          đây. Mọi quyết định và rủi ro thuộc về người đọc.
        </p>
      </Section>
    </article>
  );
}
