"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as LucideIcons from "lucide-react";
import { 
  ChevronRight, AlertTriangle, Calendar as CalendarIcon, Flag, CheckCircle2, BarChart3, ArrowRightLeft
} from "lucide-react";
import { UserData, SchoolData, SystemApp } from "../page";

import ScheduleWidget from "./ScheduleWidget";
import MemberStatusBoard from "./MemberStatusBoard";
import AdminNotificationWidget, { ExtendedSystemMessage } from "./AdminNotificationWidget";
import BoardWidget from "./BoardWidget";
import WeatherWidget from "./WeatherWidget";

type ExtendedSchoolData = SchoolData & {
  availableModules?: string[];
  customAppNames?: Record<string, string>;
};

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

type Props = {
  userData: UserData | null;
  schoolData: SchoolData | null;
  messages: ExtendedSystemMessage[]; 
  systemApps: SystemApp[];
  tenantUsers: UserData[];
  markMessageAsRead: (messageId: string) => void;
  handleLogout: () => void;
};

const APP_COLOR_MAPPINGS: Record<string, { lightBg: string, text: string, hoverBg: string, iconText: string, badgeBg: string, badgeText: string }> = {
  indigo: { lightBg: "bg-indigo-50", text: "text-indigo-600", hoverBg: "hover:bg-indigo-100", iconText: "text-indigo-600", badgeBg: "bg-indigo-100", badgeText: "text-indigo-800" },
  blue: { lightBg: "bg-blue-50", text: "text-blue-600", hoverBg: "hover:bg-blue-100", iconText: "text-blue-600", badgeBg: "bg-blue-100", badgeText: "text-blue-800" },
  green: { lightBg: "bg-emerald-50", text: "text-emerald-600", hoverBg: "hover:bg-emerald-100", iconText: "text-emerald-600", badgeBg: "bg-emerald-100", badgeText: "text-emerald-800" },
  purple: { lightBg: "bg-purple-50", text: "text-purple-600", hoverBg: "hover:bg-purple-100", iconText: "text-purple-600", badgeBg: "bg-purple-100", badgeText: "text-purple-800" },
  orange: { lightBg: "bg-orange-50", text: "text-orange-600", hoverBg: "hover:bg-orange-100", iconText: "text-orange-600", badgeBg: "bg-orange-100", badgeText: "text-orange-800" },
  rose: { lightBg: "bg-rose-50", text: "text-rose-600", hoverBg: "hover:bg-rose-100", iconText: "text-rose-600", badgeBg: "bg-rose-100", badgeText: "text-rose-800" },
  amber: { lightBg: "bg-amber-50", text: "text-amber-600", hoverBg: "hover:bg-amber-100", iconText: "text-amber-600", badgeBg: "bg-amber-100", badgeText: "text-amber-800" },
  default: { lightBg: "bg-indigo-50", text: "text-indigo-600", hoverBg: "hover:bg-indigo-100", iconText: "text-indigo-600", badgeBg: "bg-indigo-100", badgeText: "text-indigo-800" }
};

type TaskStatus = "not_started" | "in_progress" | "waiting" | "pending" | "done";
type TaskPriority = "urgent" | "high" | "medium" | "low";

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string, color: string, dot: string }> = {
  not_started: { label: "未着手", color: "text-gray-600 bg-gray-100", dot: "bg-gray-400" },
  in_progress: { label: "進行中", color: "text-blue-700 bg-blue-100", dot: "bg-blue-500" },
  waiting: { label: "確認待ち", color: "text-amber-700 bg-amber-100", dot: "bg-amber-500" },
  pending: { label: "保留", color: "text-purple-700 bg-purple-100", dot: "bg-purple-500" },
  done: { label: "完了", color: "text-emerald-700 bg-emerald-100", dot: "bg-emerald-500" },
};

const TASK_PRIORITY_CONFIG: Record<TaskPriority, { label: string, color: string, icon: React.ReactNode }> = {
  urgent: { label: "緊急", color: "text-red-700 border-red-500 bg-red-50", icon: <AlertTriangle className="w-2.5 h-2.5 text-red-600" /> },
  high: { label: "高", color: "text-orange-700 border-orange-200 bg-orange-50", icon: <Flag className="w-2.5 h-2.5 text-orange-600" /> },
  medium: { label: "中", color: "text-blue-700 border-blue-200 bg-blue-50", icon: <Flag className="w-2.5 h-2.5 text-blue-600" /> },
  low: { label: "低", color: "text-gray-600 border-gray-200 bg-gray-50", icon: <Flag className="w-2.5 h-2.5 text-gray-500" /> },
};

export default function NormalTop({ userData, schoolData, messages, systemApps, tenantUsers, markMessageAsRead, handleLogout }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const dateParam = searchParams.get("date");
  const selectedDate = dateParam ? new Date(dateParam) : new Date();

  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]); 

  useEffect(() => {
    if (!schoolData) return;

    // Taskデータの取得
    const qTasks = query(collection(db, "tasks"), where("schoolId", "==", schoolData.id));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      const fetched: any[] = [];
      snapshot.forEach((d) => {
        const td = d.data();
        fetched.push({
          id: d.id, title: td.title, status: td.status || "not_started", priority: td.priority || "medium",
          dueDate: td.dueDate || null, dueTime: td.dueTime || null,
          assignees: td.assignees || (td.assigneeId ? [td.assigneeId] : []),
          createdAt: td.createdAt ? td.createdAt.toDate().toISOString() : new Date().toISOString(),
        });
      });
      setAllTasks(fetched);
    });

    // 貸出データの取得
    const qRentals = query(collection(db, "rentals"), where("schoolId", "==", schoolData.id));
    const unsubRentals = onSnapshot(qRentals, (snapshot) => {
      const fetched: any[] = [];
      snapshot.forEach(d => fetched.push({ id: d.id, ...d.data() }));
      setRentals(fetched);
    });

    return () => { unsubTasks(); unsubRentals(); };
  }, [schoolData]);

  const userAllowedApps = useMemo(() => {
    if (!schoolData || !userData || !systemApps) return [];
    
    const exSchoolData = schoolData as ExtendedSchoolData;

    return systemApps.filter(app => {
      if (!app.isActive) return false;
      const appId = (app as any).appId || app.id;
      const isTenantAllowed = exSchoolData.availableModules?.includes(appId);
      const isUserAllowed = userData.allowedModules?.includes(appId);

      const roleKey = (userData?.role || "guest") as string;
      const defaultRoles = (app as any).defaultRoles || { admin: true, it_manager: true, teacher: true, officer: true, guest: false };
      const perms = (exSchoolData as any)?.appPermissions?.[appId] || defaultRoles;
      if (perms[roleKey] === false) return false;

      return isTenantAllowed && isUserAllowed;
    }).map(app => {
      const appId = (app as any).appId || app.id;
      const customName = exSchoolData.customAppNames?.[appId];
      return {
        ...app,
        id: appId,
        displayName: customName || app.name || (app as any).displayName
      };
    }).sort((a, b) => ((a as any).order || 0) - ((b as any).order || 0));
  }, [systemApps, schoolData, userData]);

  const boardApp = userAllowedApps.find(app => app.id === "board");
  const boardC = boardApp ? (APP_COLOR_MAPPINGS[(boardApp as any).color] || APP_COLOR_MAPPINGS.default) : APP_COLOR_MAPPINGS.default;

  const tasksApp = userAllowedApps.find(app => app.id === "tasks");
  const tasksC = tasksApp ? (APP_COLOR_MAPPINGS[(tasksApp as any).color] || APP_COLOR_MAPPINGS.default) : APP_COLOR_MAPPINGS.default;

  const equipmentApp = userAllowedApps.find(app => app.id === "equipment");
  const equipmentC = equipmentApp ? (APP_COLOR_MAPPINGS[(equipmentApp as any).color] || APP_COLOR_MAPPINGS.default) : APP_COLOR_MAPPINGS.default;

  const isOverdue = (dueDate: string | null, dueTime: string | null | undefined, status: string) => {
    if (!dueDate || status === "done") return false;
    const now = new Date();
    const [year, month, day] = dueDate.split('-').map(Number);
    let hour = 23, minute = 59, second = 59;
    if (dueTime) { const [h, m] = dueTime.split(':').map(Number); hour = h; minute = m; second = 0; }
    const due = new Date(year, month - 1, day, hour, minute, second);
    return due < now;
  };

  const myTasks = allTasks.filter(t => t.assignees.includes(userData?.id || "") && t.status !== "done").sort((a, b) => {
    const aOverdue = isOverdue(a.dueDate, a.dueTime, a.status);
    const bOverdue = isOverdue(b.dueDate, b.dueTime, b.status);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    if (a.priority === "urgent" && b.priority !== "urgent") return -1;
    if (a.priority !== "urgent" && b.priority === "urgent") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const statusCounts = {
    not_started: allTasks.filter(t => t.status === "not_started").length,
    in_progress: allTasks.filter(t => t.status === "in_progress").length,
    waiting: allTasks.filter(t => t.status === "waiting").length,
    pending: allTasks.filter(t => t.status === "pending").length,
    done: allTasks.filter(t => t.status === "done").length,
  };
  const totalTasks = allTasks.length;

  const activeRentals = rentals.filter(r => r.status === "active" || r.status === "partial");
  const overdueRentals = activeRentals.filter(r => {
    if (!r.endDate) return false;
    const end = new Date(r.endDate);
    end.setHours(23, 59, 59);
    return end < new Date();
  });

  return (
    // ★ p-3 sm:p-4 -> p-2 sm:p-4 に変更し、スマホでの外側の無駄な余白を削減
    <div className="p-2 sm:p-4 lg:p-6 w-full min-w-0">
      {/* ★ space-y-4 -> space-y-2.5 sm:space-y-4 に変更し、縦のパーツ間隔を縮める */}
      <div className="max-w-7xl mx-auto space-y-2.5 sm:space-y-4 w-full min-w-0">

        {/* スケジュールと天気 */}
        {/* ★ gap-4 -> gap-2.5 sm:gap-4 に変更 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-4 lg:gap-5 w-full min-w-0">
          <div className="lg:col-span-8 xl:col-span-9 min-w-0">
            <ScheduleWidget userData={userData} schoolData={schoolData} selectedDate={selectedDate} />
          </div>
          <div className="lg:col-span-4 xl:col-span-3 min-w-0">
            <WeatherWidget schoolData={schoolData} />
          </div>
        </div>

        {/* ★ gap-4 -> gap-2.5 sm:gap-4 に変更 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-4 lg:gap-5 w-full min-w-0">
          
          <div className="lg:col-span-6 space-y-2.5 sm:space-y-4 min-w-0">
            
            <AdminNotificationWidget 
              userData={userData} 
              messages={messages} 
              tenantUsers={tenantUsers} 
            />

            <BoardWidget schoolData={schoolData} boardApp={boardApp} boardC={boardC} tenantUsers={tenantUsers} />

            {equipmentApp && (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col min-w-0">
                <div className="px-3.5 py-2.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h2 className="text-xs sm:text-sm font-black text-gray-900 flex items-center gap-1.5 truncate">
                    <DynamicIcon name={(equipmentApp as any).icon} className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${equipmentC.iconText}`} /> 
                    {(equipmentApp as any).displayName}
                  </h2>
                  <button onClick={() => router.push((equipmentApp as any).path)} className={`px-2 py-0.5 sm:px-2.5 sm:py-1 ${equipmentC.lightBg} ${equipmentC.text} ${equipmentC.hoverBg} rounded-lg text-[10px] font-bold flex items-center transition-colors flex-shrink-0`}>
                    開く <ChevronRight className="w-3 h-3 ml-0.5" />
                  </button>
                </div>
                
                {/* ★ p-3 -> p-2.5 に変更し、内部の余白を詰める */}
                <div className="p-2.5 sm:p-4 flex flex-col gap-2.5 min-w-0">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-blue-50 rounded-xl p-2 sm:p-3 border border-blue-100 flex flex-col items-center justify-center shadow-sm">
                      <span className="text-[10px] font-bold text-blue-700 mb-0.5 sm:mb-1 flex items-center gap-1"><ArrowRightLeft className="w-3 h-3"/> 貸出中</span>
                      <span className="text-lg sm:text-xl font-black text-blue-800">{activeRentals.length} <span className="text-[9px] font-bold">件</span></span>
                    </div>
                    <div className={`rounded-xl p-2 sm:p-3 border flex flex-col items-center justify-center shadow-sm ${overdueRentals.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                      <span className={`text-[10px] font-bold mb-0.5 sm:mb-1 flex items-center gap-1 ${overdueRentals.length > 0 ? 'text-red-700' : 'text-gray-500'}`}>
                        <AlertTriangle className="w-3 h-3"/> 期限超過
                      </span>
                      <span className={`text-lg sm:text-xl font-black ${overdueRentals.length > 0 ? 'text-red-700' : 'text-gray-400'}`}>{overdueRentals.length} <span className="text-[9px] font-bold">件</span></span>
                    </div>
                  </div>
                  
                  {overdueRentals.length > 0 && (
                    <div className="mt-1.5 space-y-1.5">
                      <p className="text-[9px] font-black text-red-600 uppercase tracking-wider">要督促アラート</p>
                      {overdueRentals.slice(0, 3).map(r => (
                        <div key={r.id} onClick={() => router.push((equipmentApp as any).path)} className="flex justify-between items-center text-[10px] font-bold p-1.5 sm:p-2 bg-white border border-red-100 hover:border-red-300 rounded-lg cursor-pointer transition-colors group">
                          <span className="truncate flex-1 text-gray-800 group-hover:text-red-700">{r.borrowerName} ({r.items?.length || 0}点)</span>
                          <span className="text-red-600 flex-shrink-0 bg-red-50 px-1.5 py-0.5 rounded">期限: {r.endDate}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          <div className="lg:col-span-6 space-y-2.5 sm:space-y-4 min-w-0">
            
            {tasksApp && (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col min-w-0">
                <div className="px-3.5 py-2.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h2 className="text-xs sm:text-sm font-black text-gray-900 flex items-center gap-1.5 truncate">
                    <DynamicIcon name={(tasksApp as any).icon} className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${tasksC.iconText}`} /> 
                    {(tasksApp as any).displayName}
                  </h2>
                  <button onClick={() => router.push((tasksApp as any).path)} className={`px-2 py-0.5 sm:px-2.5 sm:py-1 ${tasksC.lightBg} ${tasksC.text} ${tasksC.hoverBg} rounded-lg text-[10px] font-bold flex items-center transition-colors flex-shrink-0`}>
                    開く <ChevronRight className="w-3 h-3 ml-0.5" />
                  </button>
                </div>

                {/* ★ p-3 -> p-2.5 に変更し、内部の余白を詰める */}
                <div className="p-2.5 sm:p-4 flex flex-col gap-2.5 min-w-0">
                  
                  <div className="bg-gray-50 rounded-xl p-2 sm:p-2.5 border border-gray-100/80">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 flex items-center gap-1"><BarChart3 className="w-3 h-3" /> 全体の進捗状況</span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-gray-400">計 {totalTasks} 件</span>
                    </div>
                    {totalTasks === 0 ? (
                      <div className="h-1.5 w-full bg-gray-200 rounded-full"></div>
                    ) : (
                      <div className="flex h-1.5 w-full rounded-full overflow-hidden gap-[1px]">
                        {statusCounts.done > 0 && <div style={{width: `${(statusCounts.done/totalTasks)*100}%`}} className="bg-emerald-500" title={`完了: ${statusCounts.done}`}></div>}
                        {statusCounts.in_progress > 0 && <div style={{width: `${(statusCounts.in_progress/totalTasks)*100}%`}} className="bg-blue-500" title={`進行中: ${statusCounts.in_progress}`}></div>}
                        {statusCounts.waiting > 0 && <div style={{width: `${(statusCounts.waiting/totalTasks)*100}%`}} className="bg-amber-500" title={`確認待ち: ${statusCounts.waiting}`}></div>}
                        {statusCounts.pending > 0 && <div style={{width: `${(statusCounts.pending/totalTasks)*100}%`}} className="bg-purple-500" title={`保留: ${statusCounts.pending}`}></div>}
                        {statusCounts.not_started > 0 && <div style={{width: `${(statusCounts.not_started/totalTasks)*100}%`}} className="bg-gray-300" title={`未着手: ${statusCounts.not_started}`}></div>}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-[10px] sm:text-xs font-bold text-gray-700 flex items-center gap-1 mb-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> あなたの担当タスク
                    </h3>
                    <div className="space-y-1.5">
                      {myTasks.length === 0 ? (
                        <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 text-center py-2.5 border border-dashed border-gray-200 rounded-xl">担当中の未完了タスクはありません</p>
                      ) : (
                        myTasks.slice(0, 3).map(t => {
                          const overdue = isOverdue(t.dueDate, t.dueTime, t.status);
                          return (
                            <div key={t.id} onClick={() => router.push(`/top/tasks/detail/${t.id}`)} className={`p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 group min-w-0 ${overdue ? 'bg-red-50/80 border-red-300' : 'bg-white border-gray-200 hover:border-indigo-300'}`}>
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className={`px-1 py-0.5 rounded text-[8px] font-bold border flex-shrink-0 ${TASK_PRIORITY_CONFIG[t.priority as TaskPriority].color}`}>
                                  {TASK_PRIORITY_CONFIG[t.priority as TaskPriority].label}
                                </span>
                                <span className={`text-[10px] sm:text-xs font-black truncate group-hover:text-indigo-600 transition-colors ${overdue ? 'text-red-900' : 'text-gray-900'}`}>{t.title}</span>
                              </div>
                              
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-1 ${TASK_STATUS_CONFIG[t.status as TaskStatus].color}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${TASK_STATUS_CONFIG[t.status as TaskStatus].dot}`}></span>
                                  <span className="hidden sm:inline">{TASK_STATUS_CONFIG[t.status as TaskStatus].label}</span>
                                </span>
                                {t.dueDate && (
                                  <span className={`text-[8px] font-bold flex items-center gap-0.5 ${overdue ? 'text-red-600' : 'text-gray-400'}`}>
                                    <CalendarIcon className="w-2.5 h-2.5" /> {new Date(t.dueDate).toLocaleDateString('ja-JP', {month:'numeric', day:'numeric'})}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}

            <div className="min-w-0">
              <MemberStatusBoard userData={userData} tenantUsers={tenantUsers} />
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}