import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinBudget - ระบบบันทึกรายจ่าย",
  description: "ระบบบันทึกรายการโอนเงินจ่ายเงินให้ Supplier",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
