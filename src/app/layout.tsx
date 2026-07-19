import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | 生徒会ポータルシステム",
    default: "生徒会ポータルシステム | SCPS",
  },
  description: "生徒会ポータルシステム（SCPS）",
  // ※ ここにあった icons の設定は削除しました。
  // src/app/icon.png が自動的にファビコンとして読み込まれます。
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        {children}
      </body>
    </html>
  );
}