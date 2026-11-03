import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Không tìm thấy trang",
  description: "Trang này không có hoặc mã không thuộc rổ VN30 hiện tại.",
};

export default function NotFound() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Không tìm thấy trang</h1>
      <p className="text-sm text-slate-600">Trang này không có hoặc mã không thuộc rổ VN30 hiện tại.</p>
      <Link href="/" className="text-sm text-blue-700 underline">← Về Bảng VN30</Link>
    </div>
  );
}
