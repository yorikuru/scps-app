"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Package, Calendar as CalendarIcon, MapPin, CheckCircle2, AlertCircle, 
  Loader2, Wrench, FileText, Globe, LogIn, AlertTriangle
} from "lucide-react";
import LoadingScreen from "@/components/LoadingScreen";

type RentalItem = { 
  equipmentId: string; 
  equipmentName: string; 
  managementId: string; 
  status: "active" | "returned"; 
};

type RentalData = {
  items: RentalItem[];
  borrowerName: string;
  purpose: string;
  location: string;
  startDate: string;
  endDate: string;
  status: "active" | "returned" | "partial";
  schoolId: string;
  borrowerType?: "text" | "external" | "internal";
};

export default function PublicRentalPage() {
  const params = useParams();
  const router = useRouter();
  const rentalId = params.id as string;

  const [rental, setRental] = useState<RentalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRental = async () => {
      try {
        const docSnap = await getDoc(doc(db, "rentals", rentalId));
        if (docSnap.exists()) {
          setRental(docSnap.data() as RentalData);
        }
      } catch (error) {
        console.error("データの取得に失敗しました", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRental();
  }, [rentalId]);

  if (isLoading) return <LoadingScreen />;

  if (!rental) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
      <h1 className="text-lg font-black text-gray-800 mb-2">貸出情報が見つかりません</h1>
      <p className="text-sm font-bold text-gray-500 text-center leading-relaxed">
        無効なQRコード、または<br/>データが既に削除された可能性があります。
      </p>
    </div>
  );

  const isOverdue = (rental.status === "active" || rental.status === "partial") && new Date(`${rental.endDate}T23:59:59`) < new Date();
  const isExternal = rental.borrowerType === "external";
  const itemsCount = (rental.items || []).length;

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col text-gray-900 pb-20">
      
      {/* 閲覧用ヘッダー（グラデーション） */}
      <div className={`px-4 pt-12 pb-8 text-white text-center shadow-md relative overflow-hidden transition-colors ${
        isOverdue ? 'bg-gradient-to-br from-red-600 to-rose-700' : 'bg-gradient-to-br from-indigo-600 to-blue-700'
      }`}>
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl"></div>
        
        <Package className="w-12 h-12 mx-auto mb-3 opacity-90 drop-shadow-md" />
        <h1 className="text-xl font-black tracking-widest drop-shadow-sm">備品貸出ステータス</h1>
        <p className="text-xs font-bold text-white/80 mt-1 font-mono tracking-widest">ID: {rentalId.slice(-6).toUpperCase()}</p>
      </div>

      <main className="flex-1 max-w-lg mx-auto w-full p-4 -mt-6 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
          
          {/* ステータスバナー */}
          <div className={`p-5 flex items-center justify-center gap-2 border-b border-gray-100 ${
            rental.status === "returned" ? "bg-emerald-50 text-emerald-700" :
            isOverdue ? "bg-red-600 text-white shadow-inner" : 
            rental.status === "partial" ? "bg-blue-50 text-blue-700" : "bg-indigo-50 text-indigo-700"
          }`}>
            {rental.status === "returned" ? <CheckCircle2 className="w-6 h-6" /> : 
             isOverdue ? <AlertTriangle className="w-6 h-6 animate-pulse" /> : <Loader2 className="w-6 h-6 animate-spin" />}
            
            <h2 className="text-base sm:text-lg font-black text-center leading-tight">
              {rental.status === "returned" ? "すべて返却完了" : 
               rental.status === "partial" ? "一部返却済み（未返却あり）" : 
               isOverdue ? (
                <span className="flex flex-col items-center">
                  <span>返却期限を超過しています</span>
                  <span className="text-xs sm:text-sm mt-1 underline decoration-white/50 underline-offset-4">速やかに返却してください</span>
                </span>
               ) : "現在貸出中"}
            </h2>
          </div>

          <div className="p-5 sm:p-7 space-y-8">
            
            {/* 借受人情報 */}
            <div className="text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">借受人（代表者）</p>
              <p className="text-2xl font-black text-gray-900 leading-tight">
                {rental.borrowerName} <span className="text-lg text-gray-600 ml-1">様</span>
              </p>
              {isExternal && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 mt-3 bg-blue-100 text-blue-700 text-[10px] font-black rounded-full border border-blue-200">
                  <Globe className="w-3 h-3" /> 外部ユーザー（ゲスト）
                </span>
              )}
            </div>

            {/* 貸出備品リスト */}
            <div>
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Package className="w-4 h-4" /> 貸出備品一覧 ({itemsCount}点)
              </h3>
              <div className="space-y-2">
                {(rental.items || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 sm:p-4 bg-gray-50 border border-gray-100 rounded-xl">
                    <div className="min-w-0 pr-3">
                      <p className={`text-sm font-black truncate ${item.status === 'returned' ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-900'}`}>
                        {item.equipmentName}
                      </p>
                      <p className="text-[10px] font-mono text-gray-400 mt-1">ID: {item.managementId}</p>
                    </div>
                    <div className="shrink-0">
                      {item.status === "returned" ? (
                        <span className="px-2.5 py-1 bg-gray-200 text-gray-600 text-[10px] font-bold rounded-lg border border-gray-300">返却済</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-lg border border-amber-200 shadow-inner">未返却</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 詳細情報カード */}
            <div className="bg-gray-50 rounded-2xl p-5 space-y-4 border border-gray-100">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><CalendarIcon className="w-3 h-3"/> 貸出日</p>
                  <p className="text-sm font-black text-gray-800">{rental.startDate}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><CalendarIcon className="w-3 h-3"/> 返却期限</p>
                  <p className={`text-sm font-black ${isOverdue && rental.status !== "returned" ? 'text-red-600' : 'text-gray-800'}`}>{rental.endDate}</p>
                </div>
              </div>
              
              {/* 外部ユーザー判定での表示出し分け */}
              {!isExternal ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-200/60">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin className="w-3 h-3"/> 使用場所</p>
                    <p className="text-sm font-black text-gray-800">{rental.location}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><FileText className="w-3 h-3"/> 使用目的</p>
                    <p className="text-sm font-bold text-gray-800">{rental.purpose}</p>
                  </div>
                </div>
              ) : (
                <div className="pt-4 border-t border-gray-200/60">
                  <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-100 flex items-start gap-2.5">
                    <Globe className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] sm:text-xs font-bold text-blue-900 leading-relaxed">
                      プライバシー保護のため、使用場所と使用目的は公開されていません。<br/>
                      詳細はゲストポータル（マイページ）からご確認いただけます。
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* アクションボタンエリア */}
        <div className="mt-8 space-y-4">
          
          {/* 外部ユーザー（ゲスト）向けのアクション */}
          {isExternal && (
            <button 
              onClick={() => router.push(`/ext-top/equipment`)} 
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-2xl shadow-lg transition-transform hover:-translate-y-0.5 flex justify-center items-center gap-2"
            >
              <LogIn className="w-5 h-5" /> ゲストポータルにログインして確認
            </button>
          )}
          
          {/* 学校関係者（役員）向けのアクション */}
          <div className="text-center pt-2">
            <p className="text-[10px] text-gray-400 font-bold mb-2">学校関係者・生徒会役員の方</p>
            <button 
              onClick={() => router.push(`/top/equipment?tab=rentals`)} 
              className="w-full py-3.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-black rounded-xl transition-colors flex justify-center items-center gap-2"
            >
              <Wrench className="w-4 h-4" /> 管理システムを開いて返却処理を行う
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}