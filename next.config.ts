import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true, 
  },
  // firebase-admin を Vercel のビルド・バンドル対象から外す
  serverExternalPackages: ['firebase-admin'],
  
  // ★ ここを追加：独自ドメインでの認証リライト設定
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://scps-portal.firebaseapp.com/__/auth/:path*',
      },
    ];
  },
};

export default nextConfig;