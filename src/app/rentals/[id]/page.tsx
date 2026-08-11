"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Package, Calendar as CalendarIcon, MapPin, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Wrench 
} from "lucide-react";

type RentalData = {
  equipmentName: string;
  borrowerName: string;
  purpose: string;
  location: string;
  startDate: string;
  endDate: string;
  status: "active" | "returned";
  schoolId: string;
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

  if (isLoading) return <div className="min-h-screen bg-gray-50 flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  if (!rental) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
      <h1 className="text-lg font-black text-gray-800 mb-2">貸出情報が見つかりません</h1>
      <p className="text-sm text-gray-500">無効なQRコード、またはデータが削除された可能性があります。</p>
    </div>
  );

  const isOverdue = rental.status === "active" && new Date(`${rental.endDate}T23:59:59`) < new Date();

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col text-gray-900 pb-20">
      
      {/* 閲覧用ヘッダー */}
      <div className="bg-indigo-600 px-4 pt-12 pb-6 text-white text-center shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl"></div>
        <Package className="w-10 h-10 mx-auto mb-3 opacity-90" />
        <h1 className="text-xl font-black tracking-widest">備品貸出ステータス</h1>
        <p className="text-xs font-bold text-indigo-200 mt-1">ID: {rentalId.slice(-6).toUpperCase()}</p>
      </div>

      <main className="flex-1 max-w-lg mx-auto w-full p-4 -mt-4 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          
          {/* ステータスバナー */}
          <div className={`p-4 flex items-center justify-center gap-2 border-b border-gray-100 ${
            rental.status === "returned" ? "bg-emerald-50 text-emerald-700" :
            isOverdue ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
          }`}>
            {rental.status === "returned" ? <CheckCircle2 className="w-5 h-5" /> : 
             isOverdue ? <AlertCircle className="w-5 h-5 animate-pulse" /> : <Loader2 className="w-5 h-5 animate-spin" />}
            
            <h2 className="text-base font-black">
              {rental.status === "returned" ? "返却完了" : isOverdue ? "期限超過（至急返却してください）" : "現在貸出中"}
            </h2>
          </div>

          {/* 詳細情報 */}
          <div className="p-6 space-y-6">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">貸出備品</p>
              <p className="text-2xl font-black text-gray-900 leading-tight">{rental.equipmentName}</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-100">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">借受人（代表者）</p>
                <p className="text-sm font-black text-gray-800">{rental.borrowerName}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin className="w-3 h-3"/> 使用場所</p>
                  <p className="text-sm font-black text-gray-800">{rental.location}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><CalendarIcon className="w-3 h-3"/> 返却期限</p>
                  <p className={`text-sm font-black ${isOverdue ? 'text-red-600' : 'text-gray-800'}`}>{rental.endDate}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">使用目的</p>
                <p className="text-sm font-bold text-gray-600">{rental.purpose}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 役員向けのアクション */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500 font-bold mb-3">この備品を返却する（生徒会役員専用）</p>
          <button 
            onClick={() => router.push(`/top/equipment`)} 
            className="w-full py-3.5 bg-gray-900 hover:bg-black text-white text-sm font-bold rounded-xl shadow-md transition-colors flex justify-center items-center gap-2"
          >
            <Wrench className="w-4 h-4" /> 管理システムを開いて処理する
          </button>
        </div>

      </main>
    </div>
  );
}