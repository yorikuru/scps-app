"use client";

import React from "react";
import Link from "next/link";
import { SearchX, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-blue-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/20 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8 relative z-10">
        <div className="flex items-center justify-center mb-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-blue-50 dark:bg-gray-800/80 rounded-full flex items-center justify-center shadow-inner border border-blue-100 dark:border-gray-700">
            <SearchX className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <h1 className="text-5xl sm:text-6xl font-black text-gray-200 dark:text-gray-800 tracking-tighter mb-4 select-none drop-shadow-sm">
          404
        </h1>
        <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-2">
          ページが見つかりません
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed max-w-sm mx-auto">
          お探しのページは削除されたか、URLが変更された可能性があります。URLに間違いがないか再度ご確認ください。
        </p>
      </div>

      <div className="w-full sm:max-w-md mx-auto relative z-10">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md py-6 sm:py-8 px-5 sm:px-10 shadow-xl shadow-gray-200/60 dark:shadow-black/40 rounded-2xl border border-gray-100/90 dark:border-gray-700/90 flex flex-col gap-3 sm:gap-4">
          <Link
            href="/top"
            className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white transition-all bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 active:scale-[0.98]"
          >
            <Home className="h-5 w-5 mr-2" />
            トップページへ戻る
          </Link>
          
          <button
            onClick={() => window.history.back()}
            className="w-full flex justify-center items-center py-3.5 px-4 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm text-sm font-bold text-gray-700 dark:text-gray-200 transition-all bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 active:scale-[0.98]"
          >
            <ArrowLeft className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
            前のページへ戻る
          </button>
        </div>
      </div>

      {/* 背景の装飾 */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-blue-400/10 dark:bg-blue-500/10 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob pointer-events-none"></div>
      <div className="absolute top-1/3 right-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-indigo-400/10 dark:bg-indigo-500/10 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000 pointer-events-none"></div>
    </div>
  );
}