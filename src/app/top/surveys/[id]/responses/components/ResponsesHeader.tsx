"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";

type Props = {
  title: string | undefined;
};

export default function ResponsesHeader({ title }: Props) {
  const router = useRouter();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center overflow-hidden">
          <button
            onClick={() => router.push("/top/surveys?tab=list")}
            className="mr-4 p-2 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
            title="管理に戻る"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="truncate">
            <div className="flex items-center text-xs font-bold text-purple-600 mb-0.5">
              <FileText className="h-3 w-3 mr-1" /> 回答ビューア
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
              {title || "読み込み中..."}
            </h1>
          </div>
        </div>
      </div>
    </header>
  );
}