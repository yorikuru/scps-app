import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true, 
  },
  // ★ これを追加：firebase-admin を Vercel のビルド・バンドル対象から外す
  serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;