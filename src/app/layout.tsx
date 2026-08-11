import type { Metadata } from "next";
import "./globals.css";
import { DialogProvider } from "@/components/DialogContext";

export const metadata: Metadata = {
  title: {
    template: "%s | 生徒会ポータルシステム",
    default: "生徒会ポータルシステム | SCPS",
  },
  description: "生徒会ポータルシステム（SCPS）",
  // ※ src/app/icon.png が自動的にファビコンとして読み込まれます。
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <DialogProvider>
          {children}
        </DialogProvider>
      </body>
    </html>
  );
}