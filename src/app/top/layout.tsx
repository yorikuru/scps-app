import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "TOP",
};

export default function TopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}