"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase"; 
import { LayoutDashboard, Settings, Bell, ShieldCheck, Grid, ChevronLeft, ChevronRight, Megaphone, X } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { SchoolData, UserData } from "../page";
import MiniCalendar from "./MiniCalendar";

// ★ バッジのカラールール定義 ★
// ・赤 (bg-red-500) ＝ 「未読」「未着手」を示すバッジ
// ・青 (bg-blue-500) ＝ 「未対応」「進行中・貸出中・確認待ち等」を示すバッジ

type ExtendedSchoolData = SchoolData & {
  availableModules?: string[];
  customAppNames?: Record<string, string>;
  photoURL?: string;
  logoURL?: string;
};

type Props = {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  schoolData: SchoolData | null;
  userData: UserData | null;
  availableApps: any[];
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  allEvents: any[];
};

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

const COLOR_MAPPINGS: Record<string, { bg: string, text: string, hover: string, border: string, activeBg: string, activeBorder: string, activeIcon: string }> = {
  indigo: { bg: "bg-indigo-900/10", text: "text-indigo-300", hover: "hover:bg-indigo-900/40", border: "border-transparent", activeBg: "bg-indigo-900/40", activeBorder: "border-indigo-500/50", activeIcon: "text-indigo-400" },
  blue: { bg: "bg-blue-900/10", text: "text-blue-300", hover: "hover:bg-blue-900/40", border: "border-transparent", activeBg: "bg-blue-900/40", activeBorder: "border-blue-500/50", activeIcon: "text-blue-400" },
  green: { bg: "bg-emerald-900/10", text: "text-emerald-300", hover: "hover:bg-emerald-900/40", border: "border-transparent", activeBg: "bg-emerald-900/40", activeBorder: "border-emerald-500/50", activeIcon: "text-emerald-400" },
  purple: { bg: "bg-purple-900/10", text: "text-purple-300", hover: "hover:bg-purple-900/40", border: "border-transparent", activeBg: "bg-purple-900/40", activeBorder: "border-purple-500/50", activeIcon: "text-purple-400" },
  orange: { bg: "bg-orange-900/10", text: "text-orange-300", hover: "hover:bg-orange-900/40", border: "border-transparent", activeBg: "bg-orange-900/40", activeBorder: "border-orange-500/50", activeIcon: "text-orange-400" },
  rose: { bg: "bg-rose-900/10", text: "text-rose-300", hover: "hover:bg-rose-900/40", border: "border-transparent", activeBg: "bg-rose-900/40", activeBorder: "border-rose-500/50", activeIcon: "text-rose-400" },
  amber: { bg: "bg-amber-900/10", text: "text-amber-300", hover: "hover:bg-amber-900/40", border: "border-transparent", activeBg: "bg-amber-900/40", activeBorder: "border-amber-500/50", activeIcon: "text-amber-400" },
  cyan: { bg: "bg-cyan-900/10", text: "text-cyan-300", hover: "hover:bg-cyan-900/40", border: "border-transparent", activeBg: "bg-cyan-900/40", activeBorder: "border-cyan-500/50", activeIcon: "text-cyan-400" },
  sky: { bg: "bg-sky-900/10", text: "text-sky-300", hover: "hover:bg-sky-900/40", border: "border-transparent", activeBg: "bg-sky-900/40", activeBorder: "border-sky-500/50", activeIcon: "text-sky-400" },
  teal: { bg: "bg-teal-900/10", text: "text-teal-300", hover: "hover:bg-teal-900/40", border: "border-transparent", activeBg: "bg-teal-900/40", activeBorder: "border-teal-500/50", activeIcon: "text-teal-400" },
  violet: { bg: "bg-violet-900/10", text: "text-violet-300", hover: "hover:bg-violet-900/40", border: "border-transparent", activeBg: "bg-violet-900/40", activeBorder: "border-violet-500/50", activeIcon: "text-violet-400" },
  pink: { bg: "bg-pink-900/10", text: "text-pink-300", hover: "hover:bg-pink-900/40", border: "border-transparent", activeBg: "bg-pink-900/40", activeBorder: "border-pink-500/50", activeIcon: "text-pink-400" },
  default: { bg: "bg-[#2C2C2E]/30", text: "text-gray-300", hover: "hover:bg-[#3A3A3C]/50", border: "border-transparent", activeBg: "bg-[#2C2C2E]", activeBorder: "border-[#3A3A3C]", activeIcon: "text-gray-200" }
};

export default function Sidebar({ 
  isSidebarOpen, setIsSidebarOpen, schoolData, userData, availableApps, selectedDate, setSelectedDate, allEvents 
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [imageError, setImageError] = useState(false);

  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  const [taskRedCount, setTaskRedCount] = useState(0);
  const [taskBlueCount, setTaskBlueCount] = useState(0);

  const [activeRentalsCount, setActiveRentalsCount] = useState(0);

  const [systemMessages, setSystemMessages] = useState<any[]>([]);
  const [tenantUserCount, setTenantUserCount] = useState(0);

  const appMenuRef = useRef<HTMLDivElement>(null);
  const waffleBtnRef = useRef<HTMLButtonElement>(null);

  const ITEMS_PER_PAGE = 9;
  const exSchoolData = schoolData as ExtendedSchoolData;
  const tenantPhotoUrl = exSchoolData?.photoURL || exSchoolData?.logoURL || null;

  const canManageMessages = Boolean(
    userData?.role === "admin" || (userData as any)?.isITManager === true
  );

  const canAccessSettings = Boolean(
    userData?.role === "admin" || 
    (userData as any)?.isITManager === true || 
    ((userData as any)?.positionName && ((userData as any).positionName.includes("会長") || (userData as any).positionName.includes("顧問")))
  );

  useEffect(() => {
    if (!userData?.id || !userData?.schoolId) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userData.id),
      where("schoolId", "==", userData.schoolId),
      where("isRead", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts: Record<string, number> = {};
      let total = 0;
      const now = Date.now();

      snapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : new Date(data.createdAt).getTime();
        if (createdAt > now) return;

        const sourceApp = data.sourceApp || "system";
        counts[sourceApp] = (counts[sourceApp] || 0) + 1;
        total++;
      });

      setUnreadCounts(counts);
      setTotalUnread(total);
    });

    return () => unsubscribe();
  }, [userData]);

  useEffect(() => {
    if (!userData?.id || !userData?.schoolId) return;

    const q = query(
      collection(db, "chat_rooms"),
      where("schoolId", "==", userData.schoolId),
      where("members", "array-contains", userData.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let totalChatUnread = 0;
      snapshot.forEach((doc) => {
        const roomData = doc.data();
        const unread = roomData.unreadCount?.[userData.id] || 0;
        totalChatUnread += unread;
      });
      setChatUnreadCount(totalChatUnread);
    });

    return () => unsubscribe();
  }, [userData]);

  useEffect(() => {
    if (!userData?.id || !userData?.schoolId) return;

    const q = query(
      collection(db, "tasks"),
      where("schoolId", "==", userData.schoolId),
      where("assignees", "array-contains", userData.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let red = 0;
      let blue = 0;
      snapshot.forEach((doc) => {
        const t = doc.data();
        if (t.status === "not_started") {
          red++;
        } else if (t.status === "in_progress" || t.status === "waiting" || t.status === "pending") {
          blue++;
        }
      });
      setTaskRedCount(red);
      setTaskBlueCount(blue);
    });

    return () => unsubscribe();
  }, [userData]);

  useEffect(() => {
    if (!userData?.id || !userData?.schoolId) return;

    const q = query(
      collection(db, "rentals"),
      where("schoolId", "==", userData.schoolId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let activeCount = 0;
      snapshot.forEach((doc) => {
        const r = doc.data();
        if (r.status === "active" || r.status === "partial") {
          activeCount++;
        }
      });
      setActiveRentalsCount(activeCount);
    });

    return () => unsubscribe();
  }, [userData]);

  useEffect(() => {
    if (!userData?.schoolId) return;
    const q = query(collection(db, "users"), where("schoolId", "==", userData.schoolId));
    const unsubscribe = onSnapshot(q, (snap) => setTenantUserCount(snap.size));
    return () => unsubscribe();
  }, [userData?.schoolId]);

  useEffect(() => {
    if (!userData?.schoolId || !canManageMessages) return;
    const q = query(
      collection(db, "system_messages"),
      where("requireResponse", "==", true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.schoolId === userData.schoolId || data.schoolId === "SYSTEM") {
          msgs.push({ id: doc.id, ...data });
        }
      });
      setSystemMessages(msgs);
    });
    return () => unsubscribe();
  }, [userData?.schoolId, canManageMessages]);

  const uncompletedMessagesCount = useMemo(() => {
    let count = 0;
    const now = new Date();

    systemMessages.forEach(msg => {
      if (msg.startAt && new Date(msg.startAt) > now) return;

      if (msg.schoolId === "SYSTEM" && msg.targetType === "tenant") {
        if (!msg.targetIds?.includes(userData?.schoolId || "")) return;
      }

      const respondedCount = msg.responses?.length || 0;
      let isCompleted = false;

      if (msg.responseType === "single") {
        isCompleted = respondedCount > 0;
      } else {
        let total = 0;
        if (msg.targetType === "all" || msg.targetType === "tenant") {
          total = tenantUserCount;
        } else if (msg.targetType === "user" || msg.targetType === "department") {
          total = msg.targetIds?.length || 0;
        }
        isCompleted = total > 0 && respondedCount >= total;
      }

      if (!isCompleted) count++;
    });
    return count;
  }, [systemMessages, tenantUserCount, userData]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        appMenuRef.current && !appMenuRef.current.contains(e.target as Node) &&
        waffleBtnRef.current && !waffleBtnRef.current.contains(e.target as Node)
      ) {
        setIsAppMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = (path: string) => {
    if (path === "/top") return pathname === "/top";
    return pathname.startsWith(path);
  };

  const handleMenuClick = () => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const userAllowedApps = useMemo(() => {
    if (!schoolData || !userData || !availableApps) return [];
    
    return availableApps.filter(app => {
      const appId = app.appId || app.id;
      const isTenantAllowed = exSchoolData.availableModules?.includes(appId);
      const isUserAllowed = (userData as any).allowedModules?.includes(appId);
      return isTenantAllowed && isUserAllowed;
    }).map(app => {
      const appId = app.appId || app.id;
      const customName = exSchoolData.customAppNames?.[appId];
      return {
        ...app,
        id: appId,
        displayName: customName || app.name || app.displayName
      };
    });
  }, [availableApps, schoolData, userData]);

  const sortedApps = [...userAllowedApps].sort((a, b) => (a.order || 0) - (b.order || 0));
  const totalPages = Math.ceil(sortedApps.length / ITEMS_PER_PAGE);
  const currentApps = sortedApps.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

  return (
    <>
      {/* モバイル用：サイドバーが開いている時に背景を暗くしてタッチを遮断するオーバーレイ */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ワッフルメニュー */}
      {isAppMenuOpen && (
        <div 
          ref={appMenuRef}
          className="fixed left-4 md:left-[272px] bottom-16 md:bottom-auto md:top-auto w-[270px] bg-[#2C2C2E] border border-[#3A3A3C] rounded-2xl shadow-2xl z-[100] p-4 animate-fade-in flex flex-col"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#3A3A3C]">
            <span className="text-[11px] font-bold text-gray-400">すべてのアプリ</span>
            <button 
              onClick={() => setIsAppMenuOpen(false)}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#3A3A3C]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {currentApps.length === 0 ? (
              <div className="col-span-3 text-center text-[10px] font-bold text-gray-500 py-6">利用可能なアプリがありません</div>
            ) : (
              currentApps.map(app => {
                const colorConfig = COLOR_MAPPINGS[app.color] || COLOR_MAPPINGS.default;
                const isTasksApp = app.id === "tasks" || app.id === "task";
                const isChatApp = app.id === "chat";
                const isEquipmentApp = app.id === "equipment" || app.id === "rentals";

                const unread = isChatApp ? chatUnreadCount : (unreadCounts[app.id] || 0);

                return (
                  <Link 
                    key={app.id} 
                    href={app.path}
                    onClick={() => { setIsAppMenuOpen(false); handleMenuClick(); }}
                    className="flex flex-col items-center justify-start gap-1.5 p-2 rounded-xl hover:bg-[#3A3A3C] transition-colors group relative"
                  >
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm ${colorConfig.bg} ${colorConfig.text} border ${colorConfig.border}`}>
                      <DynamicIcon name={app.icon} className="w-5 h-5" />
                    </div>
                    
                    {/* ワッフルメニュー内の通知バッジ */}
                    {isTasksApp ? (
                      <div className="absolute -top-1 -right-1 flex gap-0.5 z-10">
                        {taskRedCount > 0 && <span className="w-4 h-4 bg-red-500 border-2 border-[#2C2C2E] rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm">{taskRedCount > 99 ? '99+' : taskRedCount}</span>}
                        {taskBlueCount > 0 && <span className="w-4 h-4 bg-blue-500 border-2 border-[#2C2C2E] rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm">{taskBlueCount > 99 ? '99+' : taskBlueCount}</span>}
                      </div>
                    ) : isEquipmentApp ? (
                      <div className="absolute -top-1 -right-1 flex gap-0.5 z-10">
                        {unread > 0 && <span className="w-4 h-4 bg-red-500 border-2 border-[#2C2C2E] rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm">{unread > 99 ? '99+' : unread}</span>}
                        {activeRentalsCount > 0 && <span className="w-4 h-4 bg-blue-500 border-2 border-[#2C2C2E] rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm">{activeRentalsCount > 99 ? '99+' : activeRentalsCount}</span>}
                      </div>
                    ) : (
                      unread > 0 && (
                        <span className="absolute top-1 right-2 w-4 h-4 bg-red-500 border-2 border-[#2C2C2E] rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm z-10">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )
                    )}

                    <span className="text-[9px] font-bold text-gray-300 truncate w-full text-center leading-tight">
                      {app.displayName}
                    </span>
                  </Link>
                );
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#3A3A3C]">
              <button 
                onClick={(e) => { e.stopPropagation(); setCurrentPage(p => Math.max(0, p - 1)); }}
                disabled={currentPage === 0}
                className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 transition-colors bg-[#1C1C1E] hover:bg-[#3A3A3C] rounded-lg"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-bold text-gray-400">
                {currentPage + 1} / {totalPages}
              </span>
              <button 
                onClick={(e) => { e.stopPropagation(); setCurrentPage(p => Math.min(totalPages - 1, p + 1)); }}
                disabled={currentPage === totalPages - 1}
                className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 transition-colors bg-[#1C1C1E] hover:bg-[#3A3A3C] rounded-lg"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ★ h-screen を h-[100dvh] に変更 */}
      <aside 
        className={`
          fixed md:relative top-0 left-0 h-[100dvh] bg-[#1C1C1E] text-gray-300 transition-all duration-300 ease-in-out z-50 flex flex-col border-r border-[#2C2C2E] overflow-hidden whitespace-nowrap
          ${isSidebarOpen ? "translate-x-0 w-[260px]" : "-translate-x-full md:translate-x-0 md:w-0"}
        `}
      >
        
        <div className="h-14 px-4 flex items-center justify-between border-b border-[#2C2C2E] flex-shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-6 h-6 rounded-md overflow-hidden bg-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-sm flex-shrink-0">
              {tenantPhotoUrl && !imageError ? (
                <img 
                  src={tenantPhotoUrl} 
                  alt="Logo" 
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <span>{schoolData?.name?.charAt(0) || "S"}</span>
              )}
            </div>
            <span className="text-sm font-black text-gray-100 truncate">{schoolData?.name || "ワークスペース"}</span>
          </div>

          <button 
            className="md:hidden text-gray-400 hover:text-white p-1"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col p-3 space-y-4 overflow-hidden">
          
          <div className="flex-shrink-0">
            <p className="px-2 text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Menu</p>
            <div className="space-y-1">
              <Link 
                href="/top" 
                onClick={handleMenuClick}
                className={`relative flex items-center justify-between px-3 py-1.5 rounded-lg font-bold text-[13px] transition-all duration-200 overflow-hidden ${isActive("/top") && !isActive("/top/account") && !isActive("/top/admin") && !isActive("/top/notice") ? "bg-[#2C2C2E] text-white shadow-sm" : "text-gray-400 hover:bg-[#2C2C2E]/50 hover:text-gray-300"}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 transition-transform duration-300 origin-left ${isActive("/top") && !isActive("/top/account") && !isActive("/top/admin") && !isActive("/top/notice") ? "scale-x-100" : "scale-x-0"}`}></div>
                  <LayoutDashboard className={`w-4 h-4 transition-colors duration-200 ${isActive("/top") && !isActive("/top/account") && !isActive("/top/admin") && !isActive("/top/notice") ? "text-indigo-400" : "text-gray-500"}`} /> 
                  ダッシュボード
                </div>
              </Link>
              
              <Link 
                href="/top/account" 
                onClick={handleMenuClick}
                className={`relative flex items-center gap-3 px-3 py-1.5 rounded-lg font-bold text-[13px] transition-all duration-200 overflow-hidden ${isActive("/top/account") ? "bg-[#2C2C2E] text-white shadow-sm" : "text-gray-400 hover:bg-[#2C2C2E]/50 hover:text-gray-300"}`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 transition-transform duration-300 origin-left ${isActive("/top/account") ? "scale-x-100" : "scale-x-0"}`}></div>
                <Settings className={`w-4 h-4 transition-colors duration-200 ${isActive("/top/account") ? "text-indigo-400" : "text-gray-500"}`} /> 
                マイアカウント
              </Link>

              <Link 
                href="/top/notice" 
                onClick={handleMenuClick}
                className={`relative flex items-center justify-between px-3 py-1.5 rounded-lg font-bold text-[13px] transition-all duration-200 overflow-hidden ${isActive("/top/notice") ? "bg-[#2C2C2E] text-white shadow-sm" : "text-gray-400 hover:bg-[#2C2C2E]/50 hover:text-gray-300"}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 bg-blue-500 transition-transform duration-300 origin-left ${isActive("/top/notice") ? "scale-x-100" : "scale-x-0"}`}></div>
                  <Bell className={`w-4 h-4 transition-colors duration-200 ${isActive("/top/notice") ? "text-blue-400" : "text-gray-500"}`} /> 
                  インボックス
                </div>
                {totalUnread > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm" title="未読の通知">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </Link>

              {canManageMessages && (
                <Link 
                  href="/top/admin/messages" 
                  onClick={handleMenuClick}
                  className={`relative flex items-center justify-between px-3 py-1.5 rounded-lg font-bold text-[13px] transition-all duration-200 overflow-hidden ${isActive("/top/admin/messages") ? "bg-[#2C2C2E] text-white shadow-sm" : "text-gray-400 hover:bg-[#2C2C2E]/50 hover:text-gray-300"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 bg-cyan-500 transition-transform duration-300 origin-left ${isActive("/top/admin/messages") ? "scale-x-100" : "scale-x-0"}`}></div>
                    <Megaphone className={`w-4 h-4 transition-colors duration-200 ${isActive("/top/admin/messages") ? "text-cyan-400" : "text-gray-500"}`} /> 
                    テナントお知らせ配信
                  </div>
                  {uncompletedMessagesCount > 0 && (
                    <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm" title="未対応のメッセージ">
                      {uncompletedMessagesCount > 99 ? '99+' : uncompletedMessagesCount}
                    </span>
                  )}
                </Link>
              )}

              {canAccessSettings && (
                <Link 
                  href="/top/admin" 
                  onClick={handleMenuClick}
                  className={`relative flex items-center gap-3 px-3 py-1.5 rounded-lg font-bold text-[13px] transition-all duration-200 overflow-hidden ${isActive("/top/admin") && !isActive("/top/admin/messages") ? "bg-[#2C2C2E] text-white shadow-sm" : "text-gray-400 hover:bg-[#2C2C2E]/50 hover:text-gray-300"}`}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 bg-amber-500 transition-transform duration-300 origin-left ${isActive("/top/admin") && !isActive("/top/admin/messages") ? "scale-x-100" : "scale-x-0"}`}></div>
                  <ShieldCheck className={`w-4 h-4 transition-colors duration-200 ${isActive("/top/admin") && !isActive("/top/admin/messages") ? "text-amber-400" : "text-gray-500"}`} /> 
                  テナント設定
                </Link>
              )}
            </div>
          </div>

          <div className="flex-shrink-0">
            <p className="px-2 text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Calendar</p>
            <MiniCalendar 
              selectedDate={selectedDate} 
              onSelectDate={(date) => {
                setSelectedDate(date);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const params = new URLSearchParams(searchParams.toString());
                params.set("date", `${year}-${month}-${day}`);
                router.push(`${pathname}?${params.toString()}`);
                handleMenuClick();
              }} 
              events={allEvents} 
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="mb-2 px-2 flex justify-between items-center text-gray-500 flex-shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider">Apps</span>
              <button
                ref={waffleBtnRef}
                onClick={() => { setIsAppMenuOpen(!isAppMenuOpen); setCurrentPage(0); }}
                className="p-1 text-gray-400 hover:text-white hover:bg-[#3A3A3C] rounded transition-colors"
                title="すべてのアプリを見る"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1">
              {sortedApps.length === 0 ? (
                <p className="px-2 py-3 text-xs text-gray-500 font-bold bg-[#2C2C2E]/50 rounded-lg text-center border border-[#2C2C2E]">利用できるアプリがありません</p>
              ) : (
                sortedApps.map(app => {
                  const colorConfig = COLOR_MAPPINGS[app.color] || COLOR_MAPPINGS.default;
                  const isAppActive = isActive(app.path);

                  const isTasksApp = app.id === "tasks" || app.id === "task";
                  const isChatApp = app.id === "chat";
                  const isEquipmentApp = app.id === "equipment" || app.id === "rentals";

                  const unread = isChatApp ? chatUnreadCount : (unreadCounts[app.id] || 0);

                  return (
                    <Link 
                      key={app.id} 
                      href={app.path} 
                      onClick={handleMenuClick}
                      className={`relative flex items-center justify-between px-3 py-2 rounded-lg font-bold text-[13px] transition-all duration-300 overflow-hidden border group ${
                        isAppActive 
                          ? `${colorConfig.activeBg} text-white ${colorConfig.activeBorder} shadow-sm` 
                          : `${colorConfig.bg} text-gray-400 ${colorConfig.border} ${colorConfig.hover} hover:text-gray-200`
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 bg-current transition-transform duration-300 origin-left ${colorConfig.text} ${isAppActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-50 opacity-50"}`}></div>
                        <DynamicIcon name={app.icon} className={`w-4 h-4 flex-shrink-0 transition-colors duration-300 ${isAppActive ? colorConfig.activeIcon : "text-gray-500 group-hover:text-gray-400"}`} />
                        <span className="truncate">{app.displayName}</span>
                      </div>
                      
                      {/* サイドバー内のバッジ */}
                      {isTasksApp ? (
                        <div className="flex shrink-0 gap-1 ml-auto">
                          {taskRedCount > 0 && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-black rounded-full shadow-sm bg-red-500 text-white border border-transparent" title="未着手のタスク">
                              {taskRedCount > 99 ? '99+' : taskRedCount}
                            </span>
                          )}
                          {taskBlueCount > 0 && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-black rounded-full shadow-sm bg-blue-500 text-white border border-transparent" title="未完了のタスク">
                              {taskBlueCount > 99 ? '99+' : taskBlueCount}
                            </span>
                          )}
                        </div>
                      ) : isEquipmentApp ? (
                        <div className="flex shrink-0 gap-1 ml-auto">
                          {unread > 0 && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-black rounded-full shadow-sm bg-red-500 text-white border border-transparent" title="未読の通知">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                          {activeRentalsCount > 0 && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-black rounded-full shadow-sm bg-blue-500 text-white border border-transparent" title="貸出中の案件">
                              {activeRentalsCount > 99 ? '99+' : activeRentalsCount}
                            </span>
                          )}
                        </div>
                      ) : (
                        unread > 0 && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-black rounded-full shadow-sm bg-red-500 text-white border border-transparent">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )
                      )}
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ★ <br/>タグを削除し、親の padding (pb-8 md:pb-3) で余白を制御するように変更 */}
        <div className="flex-shrink-0 p-3 pb-8 md:pb-3 mt-1 border-t border-[#2C2C2E] bg-[#1C1C1E]">
          <div className="flex flex-col gap-1.5 text-[9px] font-bold text-gray-500 text-center">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
              <Link href="/legal/terms" className="hover:text-gray-300 transition-colors">利用規約</Link>
              <Link href="/legal/privacy" className="hover:text-gray-300 transition-colors">プライバシー</Link>
              <Link href="/legal/commercial" className="hover:text-gray-300 transition-colors">特定商取引法</Link>
            </div>
            <div className="text-[8px] text-gray-600 mt-0.5">
              &copy; {new Date().getFullYear()} YORIKURU / 生徒会ポータルシステム
            </div>
          </div>
        </div>

      </aside>
    </>
  );
}