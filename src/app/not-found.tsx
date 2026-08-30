"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB] flex items-center justify-center p-4 font-sans text-gray-900">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col items-center text-center p-8 sm:p-10 animate-fade-in">
        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-sm border border-indigo-100">
          <FileQuestion className="w-10 h-10" />
        </div>
        
        <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tighter">404</h1>
        <h2 className="text-lg font-black text-gray-800 mb-4">ページが見つかりません</h2>
        
        <p className="text-xs sm:text-sm font-bold text-gray-500 mb-8 leading-relaxed">
          お探しのページは、移動または削除されたか、URLが間違っている可能性があります。
        </p>
        
        <div className="w-full flex flex-col gap-3">
          <button 
            onClick={() => router.back()} 
            className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 text-xs sm:text-sm font-black rounded-2xl shadow-sm flex items-center justify-center gap-2 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" /> 前のページに戻る
          </button>
          
          <button 
            onClick={() => router.push("/top")} 
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white text-xs sm:text-sm font-black rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-95"
          >
            <Home className="w-4 h-4" /> ダッシュボードへ戻る
          </button>
        </div>
      </div>
    </div>
  );
}