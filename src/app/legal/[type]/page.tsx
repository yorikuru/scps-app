"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Printer, ArrowLeft, Loader2, FileText, ShieldCheck, Scale } from "lucide-react";

type LegalType = "privacy" | "terms" | "commercial";

const TYPE_CONFIG = {
  privacy: {
    title: "プライバシーポリシー（個人情報保護方針）",
    icon: ShieldCheck,
    dbField: "privacyPolicy",
  },
  terms: {
    title: "利用規約",
    icon: FileText,
    dbField: "termsOfService",
  },
  commercial: {
    title: "特定商取引法に基づく表記",
    icon: Scale,
    dbField: "commercialLaw",
  },
};

export default function LegalDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const type = params.type as LegalType;
  
  const [content, setContent] = useState<string>("");
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = TYPE_CONFIG[type];

  useEffect(() => {
    if (!config) {
      setError("無効なページです");
      setIsLoading(false);
      return;
    }

    const fetchLegalDoc = async () => {
      try {
        const docRef = doc(db, "system_settings", "legal");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setContent(data[config.dbField] || "現在、規約は準備中です。");
          setUpdatedAt(data.updatedAt ? new Date(data.updatedAt).toLocaleDateString('ja-JP') : "未設定");
        } else {
          setContent("現在、規約は準備中です。");
        }
      } catch (err) {
        console.error("Failed to fetch legal document:", err);
        setError("データの読み込みに失敗しました。");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLegalDoc();
  }, [type, config]);

  const handlePrint = () => {
    window.print();
  };

  if (!config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <p className="text-gray-500 font-bold mb-4">ページが見つかりません</p>
        <button onClick={() => router.back()} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">戻る</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 print:bg-white text-gray-900 dark:text-gray-100 print:text-black">
      
      {/* 画面用ヘッダー（印刷時は非表示） */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50 print:hidden shadow-sm">
        <button 
          onClick={() => router.back()}
          className="flex items-center text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> 戻る
        </button>
        <h1 className="text-sm font-extrabold text-gray-800 dark:text-gray-200">生徒会ポータル (SCPS) 法務情報</h1>
        <button 
          onClick={handlePrint}
          className="flex items-center px-4 py-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors border border-indigo-200 dark:border-indigo-800"
        >
          <Printer className="h-4 w-4 mr-2" /> PDF保存・印刷
        </button>
      </header>

      {/* 印刷用ヘッダー（通常時は非表示、印刷時のみ表示） */}
      <div className="hidden print:block text-center pb-2 border-b border-gray-400 mb-4 mt-0">
        <h2 className="text-lg font-black text-black">生徒会ポータルシステム (SCPS)</h2>
        <p className="text-[10px] text-gray-600 mt-1">発行: YORIKURU / 出力日: {new Date().toLocaleDateString('ja-JP')}</p>
      </div>

      {/* コンテンツメインエリア（PCで幅広く、文字を小さく） */}
      <main className="max-w-6xl mx-auto p-4 sm:p-8 lg:p-12 print:p-0 print:max-w-none print:m-0">
        
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-20 print:hidden">
            <Loader2 className="animate-spin h-10 w-10 text-indigo-600 mb-4" />
            <p className="text-sm font-bold text-gray-500">文書を読み込んでいます...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 p-6 rounded-xl border border-red-200 text-center print:hidden">
            <p className="text-red-700 font-bold">{error}</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 print:bg-white rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 print:border-none print:shadow-none p-6 sm:p-10 print:p-0">
            
            {/* タイトルエリア */}
            <div className="text-center mb-8 pb-6 border-b border-gray-100 dark:border-gray-800 print:border-none print:mb-2 print:pb-2">
              <div className="flex justify-center mb-4 print:hidden">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl">
                  <config.icon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white print:text-base tracking-tight mb-2">
                {config.title}
              </h1>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 print:text-[9px] print:text-right print:mt-[-15px]">
                最終更新日: {updatedAt}
              </p>
            </div>

            {/* 本文エリア（文字サイズと行間を圧縮、A4収まりを優先） */}
            <div className="prose prose-sm dark:prose-invert print:prose-black max-w-none prose-headings:font-black prose-p:leading-snug prose-a:text-indigo-600 whitespace-pre-wrap font-sans text-sm print:text-[8px] print:leading-[1.15] print:max-w-full">
              {content}
            </div>
            
          </div>
        )}

      </main>

      {/* フッター（印刷時は非表示） */}
      <footer className="text-center py-6 text-xs font-bold text-gray-400 print:hidden">
        &copy; {new Date().getFullYear()} YORIKURU All rights reserved.
      </footer>
    </div>
  );
}