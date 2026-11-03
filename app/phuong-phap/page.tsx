import type { Metadata } from "next";
import { loadSiteData } from "../../lib/data.ts";
import { formatDate } from "../../lib/format.ts";

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
      </Section>

      <Section title="Nhận định hướng được tạo thế nào">
        <p>
          Sau mỗi phiên, một mô hình AI đọc nến và chỉ báo kỹ thuật của mã rồi ghi một nhận định cho 20 phiên tới: Tăng, Giảm,
          Đi ngang hoặc Không nhận định. Mô hình không đọc tin tức, báo cáo tài chính hay sự kiện doanh nghiệp. Nhận định được
          ghi vào nhật ký trước khi biết kết quả. Lập luận gốc của mô hình bằng tiếng Anh, hiển thị nguyên văn ở trang từng
          mã.
        </p>
      </Section>

      <Section title="Cách chấm điểm (luật direction-score-v1 của backend)">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Phiên chấm là đúng 20 phiên giao dịch sau phiên tín hiệu theo lịch HOSE. Lợi nhuận R = giá đóng cửa phiên chấm ÷ giá
            đóng cửa phiên tín hiệu − 1.
          </li>
          <li>R từ +5% trở lên là Tăng, từ −4% trở xuống là Giảm, còn lại là Đi ngang.</li>
          <li>Nhận định “Đúng” khi trùng với kết quả thực tế, ngược lại là “Sai”. “Không nhận định” không được chấm.</li>
          <li>
            Chỉ nhận định ghi trước giờ mở cửa phiên kế tiếp mới được chấm; nếu một phiên có nhiều nhận định, chỉ nhận định sớm
            nhất được tính.
          </li>
          <li>Khi chưa đủ 20 phiên, trạng thái là “Chờ đủ 20 phiên”.</li>
          <li>
            Mốc so sánh của luật chấm: với mỗi nhận định, lấy kết quả (Tăng, Giảm hay Đi ngang) xảy ra nhiều nhất trong lịch
            sử của chính mã đó tính tới phiên tín hiệu; hoà thì ưu tiên Đi ngang. Một cách đoán chỉ có ích nếu đúng nhiều hơn
            mốc này trên cùng các phiên.
          </li>
        </ul>
        <p>
          “x/y đúng” là số đếm thật trên các nhận định đã chấm của mã đó, không phải xác suất. Mẫu còn nhỏ, vì vậy tỷ lệ này dao
          động mạnh.
        </p>
      </Section>

      <Section title="Giới hạn đã biết">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Hai bài thử mù trên MBB và BID (30 và 31/10/2026, kỳ hạn 20 phiên) cho kết quả 28/74 nhận định đúng, trong khi luôn
            đoán “Đi ngang” đúng 34/74. Tức là chưa thấy lợi thế; cách đoán tự động còn kém mốc so sánh.
          </li>
          <li>28 mã còn lại chưa có bài thử mù nào.</li>
          <li>Ngoài MBB và BID, chưa có tỷ lệ nền (tần suất lịch sử của Tăng/Giảm/Đi ngang) cho các mã.</li>
          <li>
            Bảng xếp hạng chỉ đo sức mạnh giá trong quá khứ. Bài kiểm tra lịch sử VN30-1 kết luận chưa đủ bằng chứng rằng nắm
            giữ 10 mã mạnh nhất thắng VNINDEX.
          </li>
          <li>Dữ liệu có thể trễ, thiếu hoặc sai do nguồn hoặc do lỗi xử lý; ô “—” nghĩa là không có dữ liệu.</li>
        </ul>
      </Section>

      <Section title="Miễn trừ trách nhiệm">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
          Nhận định kỹ thuật tự động, chỉ để tham khảo, không phải khuyến nghị đầu tư. Trang này không đưa ra lời khuyên
          giao dịch, không quản lý tiền của ai và không chịu trách nhiệm cho quyết định đầu tư dựa trên nội dung ở đây. Mọi
          quyết định và rủi ro thuộc về người đọc.
        </p>
      </Section>
    </article>
  );
}
