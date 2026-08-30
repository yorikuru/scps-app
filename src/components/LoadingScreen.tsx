"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { RefreshCw } from "lucide-react";

export default function LoadingScreen({ message = "LOADING..." }: { message?: string }) {
  const [showReload, setShowReload] = useState(false);
  const [userType, setUserType] = useState<"member" | "external" | "unknown">("unknown");
  const pathname = usePathname();

  // 3秒後に再読み込みボタンを表示する
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowReload(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // ログイン状態とユーザータイプを取得する
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // 通信遅延でFirestoreから取得できない場合に備え、まずはURLパスからユーザータイプを推測
        if (pathname?.startsWith("/ext-top")) {
          setUserType("external");
        } else if (pathname?.startsWith("/top")) {
          setUserType("member");
        }

        try {
          // 正確なユーザータイプをFirestoreから取得
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setUserType("member");
            return;
          }
          const extDoc = await getDoc(doc(db, "external_users", user.uid));
          if (extDoc.exists()) {
            setUserType("external");
            return;
          }
        } catch (e) {
          // 通信エラー等で取得できない場合は推測状態を維持する
        }
      } else {
        setUserType("unknown");
      }
    });

    return () => unsubscribe();
  }, [pathname]);

  const handleReload = () => {
    try {
      if (typeof window !== "undefined" && window.location.href) {
        // 原則：現在のページを再読み込み
        window.location.reload();
      } else {
        throw new Error("URL is unknown");
      }
    } catch (e) {
      // URLが不明、または読み取れない場合のフォールバックルーティング
      if (userType === "member") {
        window.location.href = "/top";
      } else if (userType === "external") {
        window.location.href = "/ext-top";
      } else {
        window.location.href = "/";
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F9FAFB]">
      
      {/* アニメーション部分 */}
      <div className="relative flex items-center justify-center">
        {/* 背景の軌道（薄い円） */}
        <div className="absolute w-14 h-14 border-4 border-indigo-100 rounded-full"></div>
        
        {/* 回転するスピナー（濃い色の円弧） */}
        <div className="absolute w-14 h-14 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
        
        {/* 中央のロゴ部分 */}
        <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shadow-inner">
          <span className="text-white text-[9px] font-black tracking-tighter">SCPS</span>
        </div>
      </div>
      
      {/* メッセージテキスト */}
      <p className="mt-5 text-[11px] font-black text-indigo-900/60 tracking-[0.2em] animate-pulse">
        {message}
      </p>

      {/* 3秒後に表示されるリロードボタン */}
      {showReload && (
        <div className="mt-8 flex flex-col items-center gap-3 animate-fade-in">
          <p className="text-[10px] font-bold text-gray-500">
            読み込みに時間がかかっています
          </p>
          <button
            onClick={handleReload}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-white border border-gray-200 shadow-sm rounded-xl text-xs font-black text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            再読み込み
          </button>
        </div>
      )}
      
    </div>
  );
}