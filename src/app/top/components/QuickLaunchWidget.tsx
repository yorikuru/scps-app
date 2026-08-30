"use client";

import React from "react";
import Link from "next/link";
import * as LucideIcons from "lucide-react";
import { Grid } from "lucide-react";

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

const APP_COLOR_MAPPINGS: Record<string, { lightBg: string, text: string }> = {
  slate: { lightBg: "bg-slate-50", text: "text-slate-600" },
  gray: { lightBg: "bg-gray-50", text: "text-gray-600" },
  zinc: { lightBg: "bg-zinc-50", text: "text-zinc-600" },
  neutral: { lightBg: "bg-neutral-50", text: "text-neutral-600" },
  stone: { lightBg: "bg-stone-50", text: "text-stone-600" },
  red: { lightBg: "bg-red-50", text: "text-red-600" },
  orange: { lightBg: "bg-orange-50", text: "text-orange-600" },
  amber: { lightBg: "bg-amber-50", text: "text-amber-600" },
  yellow: { lightBg: "bg-yellow-50", text: "text-yellow-600" },
  lime: { lightBg: "bg-lime-50", text: "text-lime-600" },
  green: { lightBg: "bg-green-50", text: "text-green-600" },
  emerald: { lightBg: "bg-emerald-50", text: "text-emerald-600" },
  teal: { lightBg: "bg-teal-50", text: "text-teal-600" },
  cyan: { lightBg: "bg-cyan-50", text: "text-cyan-600" },
  sky: { lightBg: "bg-sky-50", text: "text-sky-600" },
  blue: { lightBg: "bg-blue-50", text: "text-blue-600" },
  indigo: { lightBg: "bg-indigo-50", text: "text-indigo-600" },
  violet: { lightBg: "bg-violet-50", text: "text-violet-600" },
  purple: { lightBg: "bg-purple-50", text: "text-purple-600" },
  fuchsia: { lightBg: "bg-fuchsia-50", text: "text-fuchsia-600" },
  pink: { lightBg: "bg-pink-50", text: "text-pink-600" },
  rose: { lightBg: "bg-rose-50", text: "text-rose-600" },
  default: { lightBg: "bg-indigo-50", text: "text-indigo-600" }
};

type Props = {
  userAllowedApps: any[];
  appBadges: {
    chat?: { unread: number };
    equipment?: { active: number };
    surveys?: { required: number, optional: number };
    tasks?: { red: number, blue: number };
    generalUnread?: Record<string, number>;
  };
};

export default function QuickLaunchWidget({ userAllowedApps, appBadges }: Props) {
  return (
    <div className="lg:hidden flex-1 flex flex-col min-h-0 bg-white border border-gray-200 rounded-2xl shadow-2xs overflow-hidden">
      <div className="px-2.5 py-1.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
        <h2 className="text-[10px] sm:text-xs font-black text-gray-900 flex items-center gap-1.5 truncate">
          <Grid className="w-3 h-3 text-gray-500" /> クイック起動
        </h2>
      </div>
      <div className="p-1.5 sm:p-2 bg-white flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="grid grid-cols-3 gap-y-2.5 gap-x-1.5 place-items-start w-full">
          {userAllowedApps.map(app => {
            const c = APP_COLOR_MAPPINGS[app.color] || APP_COLOR_MAPPINGS.default;
            const isTasksApp = app.id === "tasks" || app.id === "task";
            const isChatApp = app.id === "chat";
            const isEquipmentApp = app.id === "equipment" || app.id === "rentals";
            const isSurveyApp = app.id === "surveys" || app.id === "survey"; 

            let unread = 0;
            if (isChatApp) unread = appBadges.chat?.unread || 0;
            else unread = appBadges.generalUnread?.[app.id] || 0;

            const taskRedCount = appBadges.tasks?.red || 0;
            const taskBlueCount = appBadges.tasks?.blue || 0;
            const activeRentalsCount = appBadges.equipment?.active || 0;
            const surveyRequired = appBadges.surveys?.required || 0;
            const surveyOptional = appBadges.surveys?.optional || 0;

            return (
              <Link 
                key={app.id} 
                href={app.path} 
                className="flex flex-col items-center gap-1 w-full shrink-0 group relative overflow-visible"
              >
                <div className={`relative w-8 h-8 sm:w-10 sm:h-10 rounded-[10px] sm:rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm border border-gray-100/50 shrink-0 ${c.lightBg} ${c.text}`}>
                  <DynamicIcon name={app.icon} className="w-4 h-4 sm:w-5 sm:h-5" />
                  
                  {isTasksApp ? (
                    <div className="absolute -top-1 -right-1 flex gap-[1px] z-10 scale-[0.75] sm:scale-90 origin-top-right">
                      {taskRedCount > 0 && <span className="w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm">{taskRedCount > 99 ? '99+' : taskRedCount}</span>}
                      {taskBlueCount > 0 && <span className="w-4 h-4 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm">{taskBlueCount > 99 ? '99+' : taskBlueCount}</span>}
                    </div>
                  ) : isEquipmentApp ? (
                    <div className="absolute -top-1 -right-1 flex gap-[1px] z-10 scale-[0.75] sm:scale-90 origin-top-right">
                      {unread > 0 && <span className="w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm">{unread > 99 ? '99+' : unread}</span>}
                      {activeRentalsCount > 0 && <span className="w-4 h-4 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm">{activeRentalsCount > 99 ? '99+' : activeRentalsCount}</span>}
                    </div>
                  ) : isSurveyApp ? (
                    <div className="absolute -top-1 -right-1 flex gap-[1px] z-10 scale-[0.75] sm:scale-90 origin-top-right">
                      {surveyRequired > 0 && <span className="w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm">{surveyRequired > 99 ? '99+' : surveyRequired}</span>}
                      {surveyOptional > 0 && <span className="w-4 h-4 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm">{surveyOptional > 99 ? '99+' : surveyOptional}</span>}
                    </div>
                  ) : (
                    unread > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm z-10 scale-[0.75] sm:scale-90 origin-top-right">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )
                  )}
                </div>
                <span className="text-[8px] sm:text-[9px] font-bold text-gray-700 truncate w-full text-center leading-tight px-0.5">
                  {app.displayName}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  );
}