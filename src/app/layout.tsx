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
    // ★ overflow-hidden を削除し、自然な h-full にします
    <html lang="ja" className="h-full">
      <body className="h-full antialiased">
        <div className="h-full w-full flex flex-col">
          <DialogProvider>
            {children}
          </DialogProvider>
        </div>
      </body>
    </html>
  );
}