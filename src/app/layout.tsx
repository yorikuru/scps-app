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
    <html lang="ja" className="h-full overflow-hidden">
      <body className="h-full overflow-hidden antialiased">
        {/* ★ 変更：overflow-hidden を外し、縦方向のスクロール（overflow-y-auto）を許可します */}
        <div className="h-full w-full overflow-y-auto overflow-x-hidden flex flex-col fixed inset-0">
          <DialogProvider>
            {children}
          </DialogProvider>
        </div>
      </body>
    </html>
  );
}