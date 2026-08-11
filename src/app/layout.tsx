import type { Metadata } from "next";
import "./globals.css";
import { DialogProvider } from "@/components/DialogContext";

export const metadata: Metadata = {
  title: {
    template: "%s | 生徒会ポータルシステム",
    default: "生徒会ポータルシステム | SCPS",
  },
  description: "生徒会ポータルシステム（SCPS）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // ★ html と body に h-full と overflow-hidden を持たせてスクロールを防ぎます
    <html lang="ja" className="h-full overflow-hidden">
      <body className="h-full overflow-hidden antialiased">
        {/* ★ アプリ全体を画面いっぱいに固定するラッパー */}
        <div className="h-full w-full overflow-hidden flex flex-col fixed inset-0">
          <DialogProvider>
            {children}
          </DialogProvider>
        </div>
      </body>
    </html>
  );
}