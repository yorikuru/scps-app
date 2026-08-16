"use client";

import React from "react";
import { Globe, LogOut, ChevronLeft } from "lucide-react";
import Link from "next/link";
import * as LucideIcons from "lucide-react";

type Props = {
  schoolData: any;
  handleLogout: () => void;
  appMeta?: { name: string; icon: string; color: string } | null;
  showBackButton?: boolean;
  backUrl?: string;
};

// Tailwindの動的クラスパージ対策
const COLOR_CLASSES: Record<string, string> = {
  slate: "bg-slate-600", gray: "bg-gray-600", zinc: "bg-zinc-600", neutral: "bg-neutral-600", stone: "bg-stone-600",
  red: "bg-red-600", orange: "bg-orange-600", amber: "bg-amber-600", yellow: "bg-yellow-600", lime: "bg-lime-600",
  green: "bg-green-600", emerald: "bg-emerald-600", teal: "bg-teal-600", cyan: "bg-cyan-600", sky: "bg-sky-600",
  blue: "bg-blue-600", indigo: "bg-indigo-600", violet: "bg-violet-600", purple: "bg-purple-600",
  fuchsia: "bg-fuchsia-600", pink: "bg-pink-600", rose: "bg-rose-600",
};

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

export default function ExtHeader({ schoolData, handleLogout, appMeta, showBackButton, backUrl = "/ext-top" }: Props) {
  const isAppMode = !!appMeta;
  const bgClass = isAppMode && appMeta.color ? (COLOR_CLASSES[appMeta.color] || "bg-indigo-600") : "bg-white";

  return (
    <header className={`${bgClass} ${isAppMode ? 'text-white border-b-0 shadow-md' : 'text-gray-900 border-b border-gray-200 shadow-sm'} px-3 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-30 w-full shrink-0 transition-colors`}>
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {showBackButton && (
          <Link href={backUrl} className={`p-1.5 sm:p-2 rounded-xl transition-colors shrink-0 flex items-center justify-center ${isAppMode ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-200 text-gray-500'}`}>
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </Link>
        )}
        
        {isAppMode ? (
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
            <DynamicIcon name={appMeta.icon} className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
        ) : schoolData?.logoURL ? (
          <img src={schoolData.logoURL} alt="School Logo" className="h-8 sm:h-9 w-auto object-contain rounded" />
        ) : (
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5" />
          </div>
        )}

        <div className="min-w-0 pr-2">
          <h1 className="text-[12px] sm:text-sm font-black leading-tight truncate">
            {isAppMode ? appMeta.name : (schoolData?.name || "SCPS ゲストポータル")}
          </h1>
          <p className={`text-[9px] sm:text-[10px] font-bold truncate mt-0.5 ${isAppMode ? 'text-white/80' : 'text-gray-500'}`}>
            {isAppMode ? (schoolData?.name || "SCPS ゲストポータル") : "ゲスト専用ダッシュボード"}
          </p>
        </div>
      </div>

      <button 
        onClick={handleLogout}
        className={`p-2 rounded-full transition-colors shrink-0 flex items-center justify-center ${isAppMode ? 'hover:bg-white/20 text-white' : 'hover:text-red-600 hover:bg-red-50 text-gray-400'}`}
        title="ログアウト"
      >
        <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
    </header>
  );
}