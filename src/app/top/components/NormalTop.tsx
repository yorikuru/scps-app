"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as LucideIcons from "lucide-react";
import { ChevronRight, AlertTriangle, ArrowRightLeft, Grid } from "lucide-react";
import { UserData, SchoolData, SystemApp } from "../page";

import ScheduleWidget from "./ScheduleWidget";
import AdminNotificationWidget, { ExtendedSystemMessage } from "./AdminNotificationWidget";
import BoardWidget from "./BoardWidget";
import WeatherWidget from "./WeatherWidget";
import PresenceWidget from "./PresenceWidget";
import TasksWidget from "./TasksWidget";
import { UserPresence } from "../presence/types";

type ExtendedSchoolData = SchoolData & {
  availableModules?: string[];
  customAppNames?: Record<string, string>;
  appPermissions?: Record<string, any>;
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
  slate: { lightBg: "bg-slate-50", text: "text-slate-600", hoverBg: "hover:bg-slate-100", iconText: "text-slate-600", badgeBg: "bg-slate-100", badgeText: "text-slate-800" },
  gray: { lightBg: "bg-gray-50", text: "text-gray-600", hoverBg: "hover:bg-gray-100", iconText: "text-gray-600", badgeBg: "bg-gray-100", badgeText: "text-gray-800" },
  zinc: { lightBg: "bg-zinc-50", text: "text-zinc-600", hoverBg: "hover:bg-zinc-100", iconText: "text-zinc-600", badgeBg: "bg-zinc-100", badgeText: "text-zinc-800" },
  neutral: { lightBg: "bg-neutral-50", text: "text-neutral-600", hoverBg: "hover:bg-neutral-100", iconText: "text-neutral-600", badgeBg: "bg-neutral-100", badgeText: "text-neutral-800" },
  stone: { lightBg: "bg-stone-50", text: "text-stone-600", hoverBg: "hover:bg-stone-100", iconText: "text-stone-600", badgeBg: "bg-stone-100", badgeText: "text-stone-800" },
  red: { lightBg: "bg-red-50", text: "text-red-600", hoverBg: "hover:bg-red-100", iconText: "text-red-600", badgeBg: "bg-red-100", badgeText: "text-red-800" },
  orange: { lightBg: "bg-orange-50", text: "text-orange-600", hoverBg: "hover:bg-orange-100", iconText: "text-orange-600", badgeBg: "bg-orange-100", badgeText: "text-orange-800" },
  amber: { lightBg: "bg-amber-50", text: "text-amber-600", hoverBg: "hover:bg-amber-100", iconText: "text-amber-600", badgeBg: "bg-amber-100", badgeText: "text-amber-800" },
  yellow: { lightBg: "bg-yellow-50", text: "text-yellow-600", hoverBg: "hover:bg-yellow-100", iconText: "text-yellow-600", badgeBg: "bg-yellow-100", badgeText: "text-yellow-800" },
  lime: { lightBg: "bg-lime-50", text: "text-lime-600", hoverBg: "hover:bg-lime-100", iconText: "text-lime-600", badgeBg: "bg-lime-100", badgeText: "text-lime-800" },
  green: { lightBg: "bg-green-50", text: "text-green-600", hoverBg: "hover:bg-green-100", iconText: "text-green-600", badgeBg: "bg-green-100", badgeText: "text-green-800" },
  emerald: { lightBg: "bg-emerald-50", text: "text-emerald-600", hoverBg: "hover:bg-emerald-100", iconText: "text-emerald-600", badgeBg: "bg-emerald-100", badgeText: "text-emerald-800" },
  teal: { lightBg: "bg-teal-50", text: "text-teal-600", hoverBg: "hover:bg-teal-100", iconText: "text-teal-600", badgeBg: "bg-teal-100", badgeText: "text-teal-800" },
  cyan: { lightBg: "bg-cyan-50", text: "text-cyan-600", hoverBg: "hover:bg-cyan-100", iconText: "text-cyan-600", badgeBg: "bg-cyan-100", badgeText: "text-cyan-800" },
  sky: { lightBg: "bg-sky-50", text: "text-sky-600", hoverBg: "hover:bg-sky-100", iconText: "text-sky-600", badgeBg: "bg-sky-100", badgeText: "text-sky-800" },
  blue: { lightBg: "bg-blue-50", text: "text-blue-600", hoverBg: "hover:bg-blue-100", iconText: "text-blue-600", badgeBg: "bg-blue-100", badgeText: "text-blue-800" },
  indigo: { lightBg: "bg-indigo-50", text: "text-indigo-600", hoverBg: "hover:bg-indigo-100", iconText: "text-indigo-600", badgeBg: "bg-indigo-100", badgeText: "text-indigo-800" },
  violet: { lightBg: "bg-violet-50", text: "text-violet-600", hoverBg: "hover:bg-violet-100", iconText: "text-violet-600", badgeBg: "bg-violet-100", badgeText: "text-violet-800" },
  purple: { lightBg: "bg-purple-50", text: "text-purple-600", hoverBg: "hover:bg-purple-100", iconText: "text-purple-600", badgeBg: "bg-purple-100", badgeText: "text-purple-800" },
  fuchsia: { lightBg: "bg-fuchsia-50", text: "text-fuchsia-600", hoverBg: "hover:bg-fuchsia-100", iconText: "text-fuchsia-600", badgeBg: "bg-fuchsia-100", badgeText: "text-fuchsia-800" },
  pink: { lightBg: "bg-pink-50", text: "text-pink-600", hoverBg: "hover:bg-pink-100", iconText: "text-pink-600", badgeBg: "bg-pink-100", badgeText: "text-pink-800" },
  rose: { lightBg: "bg-rose-50", text: "text-rose-600", hoverBg: "hover:bg-rose-100", iconText: "text-rose-600", badgeBg: "bg-rose-100", badgeText: "text-rose-800" },
  default: { lightBg: "bg-indigo-50", text: "text-indigo-600", hoverBg: "hover:bg-indigo-100", iconText: "text-indigo-600", badgeBg: "bg-indigo-100", badgeText: "text-indigo-800" }
};

export default function NormalTop({ userData, schoolData, messages, systemApps, tenantUsers, markMessageAsRead, handleLogout }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const dateParam = searchParams.get("date");
  const selectedDate = dateParam ? new Date(dateParam) : new Date();

  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]); 
  const [presences, setPresences] = useState<UserPresence[]>([]); 
  
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  const [surveyUnansweredCount, setSurveyUnansweredCount] = useState(0);
  const [surveyRequiredUnansweredCount, setSurveyRequiredUnansweredCount] = useState(0);

  useEffect(() => {
    if (!schoolData) return;

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
    }, (err) => {}); // ★ エラーハンドリング追加

    const qRentals = query(collection(db, "rentals"), where("schoolId", "==", schoolData.id));
    const unsubRentals = onSnapshot(qRentals, (snapshot) => {
      const fetched: any[] = [];
      snapshot.forEach(d => fetched.push({ id: d.id, ...d.data() }));
      setRentals(fetched);
    }, (err) => {}); // ★ エラーハンドリング追加

    const qPresences = query(collection(db, "presence_statuses"), where("schoolId", "==", schoolData.id));
    const unsubPresences = onSnapshot(qPresences, (snapshot) => {
      const fetched: UserPresence[] = [];
      snapshot.forEach(d => fetched.push({ id: d.id, ...d.data() } as UserPresence));
      setPresences(fetched);
    }, (err) => {}); // ★ エラーハンドリング追加

    return () => { unsubTasks(); unsubRentals(); unsubPresences(); };
  }, [schoolData]);

  useEffect(() => {
    if (!userData?.id || !schoolData?.id) return;

    let unsubNotif: (() => void) | undefined;
    let unsubChat: (() => void) | undefined;
    let unsubSurveys: (() => void) | undefined;
    let unsubSurveyResponses: (() => void) | undefined;

    const qNotif = query(collection(db, "notifications"), where("userId", "==", userData.id), where("schoolId", "==", schoolData.id), where("isRead", "==", false));
    unsubNotif = onSnapshot(qNotif, (snapshot) => {
      const counts: Record<string, number> = {};
      const now = Date.now();
      snapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : new Date(data.createdAt).getTime();
        if (createdAt <= now) {
          const sourceApp = data.sourceApp || "system";
          counts[sourceApp] = (counts[sourceApp] || 0) + 1;
        }
      });
      setUnreadCounts(counts);
    }, (err) => {}); // ★ エラーハンドリング追加

    const qChat = query(collection(db, "chat_rooms"), where("schoolId", "==", schoolData.id), where("members", "array-contains", userData.id));
    unsubChat = onSnapshot(qChat, (snapshot) => {
      let totalChatUnread = 0;
      snapshot.forEach((doc) => {
        totalChatUnread += (doc.data().unreadCount?.[userData.id] || 0);
      });
      setChatUnreadCount(totalChatUnread);
    }, (err) => {}); // ★ エラーハンドリング追加

    let currentSurveys: any[] = [];
    let myRespondedIds = new Set<string>();

    const calculateSurveyBadges = () => {
      let requiredUnanswered = 0;
      let optionalUnanswered = 0;
      const now = new Date().getTime();

      currentSurveys.forEach(survey => {
        const sData = survey.settings || {};
        const accepting = sData.acceptingResponses ?? survey.isActive ?? true;
        if (!accepting) return;

        const startDate = sData.startDate ? new Date(sData.startDate).getTime() : 0;
        const endDate = sData.endDate ? new Date(sData.endDate).getTime() : Infinity;
        if (now < startDate || now > endDate) return;

        const accessTarget = sData.accessTarget ?? (survey.isPublic ? "public" : "tenant_members");
        let isTarget = false;
        if (["tenant_members", "external_users", "public"].includes(accessTarget)) isTarget = true;
        else if (accessTarget === "selected_users" && (sData.respondentIds || []).includes(userData.id)) isTarget = true;

        if (isTarget && !myRespondedIds.has(survey.id)) {
          if ((sData.requiredRespondentIds || []).includes(userData.id)) {
            requiredUnanswered++;
          } else {
            optionalUnanswered++;
          }
        }
      });

      setSurveyRequiredUnansweredCount(requiredUnanswered);
      setSurveyUnansweredCount(optionalUnanswered);
    };

    const qSurveys = query(collection(db, "surveys"), where("tenantId", "==", schoolData.id));
    unsubSurveys = onSnapshot(qSurveys, (snap) => {
      currentSurveys = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      calculateSurveyBadges();
    }, (err) => {}); // ★ エラーハンドリング追加

    const qMyResponses = query(collection(db, "survey_responses"), where("respondentId", "==", userData.id));
    unsubSurveyResponses = onSnapshot(qMyResponses, (snap) => {
      myRespondedIds = new Set(snap.docs.map(d => d.data().surveyId));
      calculateSurveyBadges();
    }, (err) => {}); // ★ エラーハンドリング追加

    return () => { 
      if (unsubNotif) unsubNotif(); 
      if (unsubChat) unsubChat(); 
      if (unsubSurveys) unsubSurveys();
      if (unsubSurveyResponses) unsubSurveyResponses();
    };
  }, [userData, schoolData]);

  const userAllowedApps = useMemo(() => {
    if (!schoolData || !userData || !systemApps) return [];
    const exSchoolData = schoolData as ExtendedSchoolData;
    
    return systemApps.filter(app => {
      if (!app.isActive) return false;
      const appId = (app as any).appId || app.id;
      const isTenantAllowed = exSchoolData.availableModules?.includes(appId);
      if (!isTenantAllowed) return false;
      const roleKey = (userData?.role || "guest") as string;
      const defaultRoles = (app as any).defaultRoles || { admin: true, it_manager: true, teacher: true, officer: true, guest: false };
      const perms = exSchoolData.appPermissions?.[appId] || defaultRoles;
      if (perms[roleKey] === false) return false;
      return true;
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

  const presenceApp = userAllowedApps.find(app => app.id === "presence");
  const presenceC = presenceApp ? (APP_COLOR_MAPPINGS[(presenceApp as any).color] || APP_COLOR_MAPPINGS.default) : APP_COLOR_MAPPINGS.default;

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

  const taskRedCount = myTasks.filter(t => t.status === "not_started").length;
  const taskBlueCount = myTasks.filter(t => t.status === "in_progress" || t.status === "waiting" || t.status === "pending").length;

  const activeRentals = rentals.filter(r => r.status === "active" || r.status === "partial");
  const overdueRentals = activeRentals.filter(r => {
    if (!r.endDate) return false;
    const end = new Date(r.endDate);
    end.setHours(23, 59, 59);
    return end < new Date();
  });
  
  const activeRentalsCount = activeRentals.length;
  const activePresences = presences.filter(p => p.currentState === "available");

  return (
    <div className="p-2 sm:p-4 lg:p-6 w-full min-w-0">
      <div className="max-w-7xl mx-auto space-y-2.5 sm:space-y-4 w-full min-w-0">

        <div className="grid grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-4 lg:gap-5 w-full min-w-0 lg:h-[220px]">
          
          <div className="col-span-1 lg:col-span-8 xl:col-span-9 min-w-0 flex flex-col h-full">
            <ScheduleWidget userData={userData} schoolData={schoolData} selectedDate={selectedDate} />
          </div>
          
          <div className="col-span-1 lg:col-span-4 xl:col-span-3 min-w-0 flex flex-col gap-2.5 sm:gap-4 h-full">
            
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
                    if (isChatApp) unread = chatUnreadCount;
                    else unread = unreadCounts[app.id] || 0;

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
                              {surveyRequiredUnansweredCount > 0 && <span className="w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm">{surveyRequiredUnansweredCount > 99 ? '99+' : surveyRequiredUnansweredCount}</span>}
                              {surveyUnansweredCount > 0 && <span className="w-4 h-4 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm">{surveyUnansweredCount > 99 ? '99+' : surveyUnansweredCount}</span>}
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

            <div className="flex-1 flex flex-col min-h-0">
              <WeatherWidget schoolData={schoolData} />
            </div>
            
          </div>
        </div>

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
            
            {presenceApp && (
              <PresenceWidget 
                presenceApp={presenceApp as any} 
                presenceC={presenceC} 
                activePresences={activePresences} 
              />
            )}

            {tasksApp && (
              <TasksWidget 
                tasksApp={tasksApp} 
                tasksC={tasksC} 
                totalTasks={totalTasks} 
                statusCounts={statusCounts} 
                myTasks={myTasks} 
              />
            )}

          </div>

        </div>
      </div>
    </div>
  );
}