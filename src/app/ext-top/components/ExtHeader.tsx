"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ArrowLeft, Home, Menu, X, Bell } from "lucide-react";

// ★ 通知バッジの型を定義
type AppBadges = {
  chat?: { unread: number; mention: boolean };
  equipment?: { active: number; overdue: boolean };
  board?: { unread: number };
};

type AppConfig = { name: string; icon: string; color: string; };

type Props = {
  schoolData: any;
  handleLogout: () => void;
  appMeta?: AppConfig;
  showBackButton?: boolean;
  appBadges?: AppBadges; // ★ Propsに追加
};

export default function ExtHeader({ schoolData, handleLogout, appMeta, showBackButton = false, appBadges }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  // ★ どこかのアプリで通知が発生しているかを判定
  const hasNotification = 
    (appBadges?.chat?.unread ?? 0) > 0 || 
    (appBadges?.equipment?.overdue ?? false) || 
    (appBadges?.board?.unread ?? 0) > 0;

  return (
    <>
      <header className="bg-white border-b border-gray-200 shrink-0 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 h-14">
          <div className="flex items-center gap-3 min-w-0">
            {showBackButton && (
              <button 
                onClick={() => router.push("/ext-top")} 
                className="p-1.5 -ml-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors relative shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
                {hasNotification && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                )}
              </button>
            )}
            
            <div className="flex flex-col min-w-0">
              {appMeta ? (
                <>
                  <h1 className="text-sm font-black text-gray-900 truncate">{appMeta.name}</h1>
                  <p className="text-[9px] font-bold text-gray-500 truncate">{schoolData?.name || "ゲストポータル"}</p>
                </>
              ) : (
                <>
                  <h1 className="text-sm font-black text-gray-900 truncate">{schoolData?.name || "ゲストポータル"}</h1>
                  <p className="text-[9px] font-bold text-gray-500 truncate">生徒会ポータルシステム</p>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* ハンバーガーメニュー */}
            <button 
              onClick={() => setMenuOpen(!menuOpen)} 
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors relative"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              {hasNotification && !menuOpen && !showBackButton && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse"></span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ドロップダウンメニュー */}
      {menuOpen && (
        <div className="absolute top-14 left-0 w-full bg-white border-b border-gray-200 shadow-lg animate-fade-in p-3 z-40">
          <div className="space-y-1">
            <button 
              onClick={() => { setMenuOpen(false); router.push("/ext-top"); }} 
              className="w-full text-left px-4 py-3.5 rounded-xl hover:bg-gray-50 flex items-center justify-between text-sm font-bold text-gray-700 transition-colors"
            >
              <span className="flex items-center gap-3"><Home className="w-4 h-4" /> トップページ</span>
              {hasNotification && <span className="px-2 py-0.5 bg-red-500 text-white text-[9px] rounded-full font-black animate-pulse shadow-sm">新着あり</span>}
            </button>
            <button 
              onClick={() => { setMenuOpen(false); handleLogout(); }} 
              className="w-full text-left px-4 py-3.5 rounded-xl hover:bg-red-50 text-red-600 flex items-center gap-3 text-sm font-bold transition-colors"
            >
              <LogOut className="w-4 h-4" /> ログアウト
            </button>
          </div>
        </div>
      )}
    </>
  );
}