"use client";

import React from "react";
import { useRouter } from "next/navigation";
import * as LucideIcons from "lucide-react";
import { ChevronRight, Zap, Users, CheckCircle2 } from "lucide-react";
import { SystemApp } from "../page";
import { UserPresence } from "../presence/types";

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

type Props = {
  presenceApp: SystemApp;
  presenceC: { lightBg: string, text: string, hoverBg: string, iconText: string };
  activePresences: UserPresence[];
};

export default function PresenceWidget({ presenceApp, presenceC, activePresences }: Props) {
  const router = useRouter();

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col min-w-0">
      <div className="px-3.5 py-2.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h2 className="text-xs sm:text-sm font-black text-gray-900 flex items-center gap-1.5 truncate">
          <DynamicIcon name={(presenceApp as any).icon} className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${presenceC.iconText}`} /> 
          {(presenceApp as any).displayName}
        </h2>
        <button onClick={() => router.push((presenceApp as any).path)} className={`px-2 py-0.5 sm:px-2.5 sm:py-1 ${presenceC.lightBg} ${presenceC.text} ${presenceC.hoverBg} rounded-lg text-[10px] font-bold flex items-center transition-colors flex-shrink-0`}>
          開く <ChevronRight className="w-3 h-3 ml-0.5" />
        </button>
      </div>
      <div className="p-2.5 sm:p-4 flex flex-col gap-2 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Zap className="w-3 h-3 text-amber-500" /> 現在連絡可能なメンバー</span>
          <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{activePresences.length} 名</span>
        </div>
        
        {activePresences.length === 0 ? (
          <div className="p-3 text-center border border-dashed border-gray-200 rounded-xl text-[10px] font-bold text-gray-400">現在連絡可能なメンバーはいません</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activePresences.map(p => {
              return (
                <div key={p.id} className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border shadow-2xs bg-white border-gray-200">
                  {p.userPhotoURL ? (
                    <img src={p.userPhotoURL} alt="avatar" className="w-5 h-5 rounded-full object-cover shrink-0 border border-gray-100" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                      <Users className="w-2.5 h-2.5 text-gray-500" />
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-black text-gray-800 leading-none truncate max-w-[60px] sm:max-w-[80px]">{p.userName}</span>
                    <span className="text-[7px] font-bold text-green-600 mt-0.5 leading-none flex items-center gap-0.5"><CheckCircle2 className="w-2 h-2" /> 連絡可能</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  );
}