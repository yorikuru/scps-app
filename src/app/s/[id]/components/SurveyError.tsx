"use client";

import React from "react";
import { AlertCircle } from "lucide-react";

type Props = {
  errorMsg: string;
};

export default function SurveyError({ errorMsg }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 font-sans">
      <div className="bg-white shadow-sm sm:rounded-xl max-w-md w-full p-8 text-center border-t-4 border-gray-400">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
          <AlertCircle className="h-6 w-6 text-gray-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">アクセスできません</h2>
        <p className="text-sm font-bold text-gray-600 mb-6 leading-relaxed">{errorMsg}</p>
        <button 
          onClick={() => window.close()} 
          className="w-full inline-flex justify-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          このタブを閉じる
        </button>
      </div>
    </div>
  );
}