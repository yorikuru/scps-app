import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true, // ← （推奨）Next.jsの標準画像最適化は静的エクスポートでエラーになるため無効化
  },
};

export default nextConfig;