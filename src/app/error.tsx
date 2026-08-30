"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // ここで Sentry などのエラー監視サービスにエラーを送信することも可能です
    console.error("システムエラーが発生しました:", error);
  }, [error]);

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB] flex items-center justify-center p-4 font-sans text-gray-900">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col items-center text-center p-8 sm:p-10 animate-fade-in">
        <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6 shadow-sm border border-red-100">
          <AlertTriangle className="w-10 h-10" />
        </div>
        
        <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tighter">500</h1>
        <h2 className="text-lg font-black text-gray-800 mb-4">システムエラーが発生しました</h2>
        
        <p className="text-xs sm:text-sm font-bold text-gray-500 mb-8 leading-relaxed">
          予期せぬエラーが発生し、処理を継続できませんでした。<br className="hidden sm:block" />
          通信環境をご確認の上、再度お試しください。
        </p>
        
        <div className="w-full flex flex-col gap-3">
          <button 
            onClick={() => reset()} 
            className="w-full py-3.5 bg-gray-900 hover:bg-black transition-colors text-white text-xs sm:text-sm font-black rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-95"
          >
            <RefreshCw className="w-4 h-4" /> 再読み込み
          </button>
          
          <button 
            onClick={() => router.push("/top")} 
            className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 text-xs sm:text-sm font-black rounded-2xl shadow-sm flex items-center justify-center gap-2 active:scale-95"
          >
            <Home className="w-4 h-4" /> ダッシュボードへ戻る
          </button>
        </div>
      </div>
    </div>
  );
}