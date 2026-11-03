import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { loadSiteData } from "../lib/data.ts";
import { formatDate, formatVnDateTime } from "../lib/format.ts";

export const metadata: Metadata = {
  title: { default: "Bảng VN30 — phân tích kỹ thuật tự động", template: "%s — Bảng VN30" },
  description:
    "Bảng sức mạnh giá rổ VN30, biểu đồ, chỉ báo và nhận định kỹ thuật tự động có chấm điểm thật. Chỉ để tham khảo, không phải khuyến nghị đầu tư.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { meta } = loadSiteData();
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="text-lg font-semibold text-slate-900 no-underline">
              Bảng VN30
            </Link>
            <nav aria-label="Chính" className="flex gap-4 text-sm">
              <Link href="/" className="text-slate-700 hover:text-slate-950 hover:underline">Bảng VN30</Link>
              <Link href="/phuong-phap/" className="text-slate-700 hover:text-slate-950 hover:underline">Phương pháp</Link>
            </nav>
          </div>
        </header>
        <div className="border-b border-amber-200 bg-amber-50">
          <p className="mx-auto max-w-5xl px-4 py-2 text-sm text-amber-950">
            Nhận định kỹ thuật tự động, chỉ để tham khảo, không phải khuyến nghị đầu tư.{" "}
            <span className="whitespace-nowrap">Dữ liệu phiên {formatDate(meta.session)}.</span>
          </p>
        </div>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl space-y-1 px-4 py-4 text-xs text-slate-600">
            <p>
              Dữ liệu phiên {formatDate(meta.session)}, cập nhật {formatVnDateTime(meta.generatedAtUtc)} (giờ Việt Nam).
              Nguồn: {meta.source}.
            </p>
            <p>
              Nhận định kỹ thuật tự động, chỉ để tham khảo, không phải khuyến nghị đầu tư.{" "}
              <Link href="/phuong-phap/" className="underline">Phương pháp và giới hạn</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
