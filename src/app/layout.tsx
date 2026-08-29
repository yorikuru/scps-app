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
    // ★ html と body に overflow-hidden と overscroll-none を強制適用し、ブラウザのバウンスを禁止
    <html lang="ja" className="h-full overflow-hidden overscroll-none">
      <body className="h-full overflow-hidden overscroll-none antialiased">
        <div className="h-full w-full flex flex-col overflow-hidden">
          <DialogProvider>
            {children}
          </DialogProvider>
        </div>
      </body>
    </html>
  );
}