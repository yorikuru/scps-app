"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { 
  User as UserIcon, Settings, LogOut, LayoutDashboard,
  BellRing, X, ShieldCheck, ChevronRight,
  Info, Wrench, CalendarDays, Pin, MessageSquareText, Send
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { UserData, SchoolData, SystemMessage, SystemApp } from "../page";

import MiniCalendar from "./MiniCalendar";
import ScheduleWidget from "./ScheduleWidget";
import MemberStatusBoard from "./MemberStatusBoard";

type Props = {
  userData: UserData | null;
  schoolData: SchoolData | null;
  messages: SystemMessage[];
  systemApps: SystemApp[];
  tenantUsers: UserData[];
  markMessageAsRead: (messageId: string) => void;
  handleLogout: () => void;
};

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

const COLOR_CLASSES: Record<string, { bg: string, text: string, hover: string }> = {
  indigo: { bg: "bg-indigo-50 dark:bg-indigo-900/30", text: "text-indigo-600 dark:text-indigo-400", hover: "group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50" },
  blue: { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400", hover: "group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50" },
  green: { bg: "bg-green-50 dark:bg-green-900/30", text: "text-green-600 dark:text-green-400", hover: "group-hover:bg-green-100 dark:group-hover:bg-green-900/50" },
  purple: { bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400", hover: "group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50" },
  orange: { bg: "bg-orange-50 dark:bg-orange-900/30", text: "text-orange-600 dark:text-orange-400", hover: "group-hover:bg-orange-100 dark:group-hover:bg-orange-900/50" },
  rose: { bg: "bg-rose-50 dark:bg-rose-900/30", text: "text-rose-600 dark:text-rose-400", hover: "group-hover:bg-rose-100 dark:group-hover:bg-rose-900/50" },
};

const CATEGORIES: Record<string, { label: string; badgeBg: string }> = {
  info: { label: "お知らせ", badgeBg: "bg-blue-100 text-blue-800" },
  warning: { label: "警告・重要", badgeBg: "bg-red-100 text-red-800" },
  maintenance: { label: "メンテナンス", badgeBg: "bg-orange-100 text-orange-800" },
  event: { label: "イベント", badgeBg: "bg-green-100 text-green-800" },
};

export default function NormalTop({ userData, schoolData, messages, systemApps, tenantUsers, markMessageAsRead, handleLogout }: Props) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<SystemMessage | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  
  // ★カレンダー連動用のステート
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [bulletinNotices] = useState<any[]>([
    {
      id: "bulletin-1",
      title: "【文化祭実行委員会】次回打ち合わせの教室変更について",
      content: "今週金曜日の文化祭実行委員会の集まりは、第2視聴覚室から【会議室B】に変更になりました。委員の皆さんは各自移動をお願いします。",
      senderName: "佐藤 健太（文化祭実行委員長）",
      createdAt: new Date().toISOString(),
    },
    {
      id: "bulletin-2",
      title: "生徒会室の鍵の返却リマインド",
      content: "昨日の放課後に生徒会室を利用した方、鍵がキーボックスに戻っていませんでした。最後に退出された方は確認をお願いします。",
      senderName: "高橋 陸（総務）",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    }
  ]);
  const [selectedNotice, setSelectedNotice] = useState<any | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "officer": return "生徒会役員";
      case "admin": return "テナント管理者";
      case "system_admin": return "特権管理者";
      case "guest": return "ゲスト";
      default: return "一般生徒";
    }
  };

  const canAccessSettings = userData?.role === "admin" || userData?.isITManager === true || (userData?.positionName && (userData.positionName.includes("会長") || userData.positionName.includes("顧問")));

  const availableApps = systemApps.filter(app => {
    if (!app.isActive) return false;
    const isAllowedInTenant = !schoolData?.availableModules || schoolData.availableModules.includes(app.appId);
    const isAllowedForUser = !userData?.allowedModules || userData.allowedModules.includes(app.appId);
    return isAllowedInTenant && isAllowedForUser;
  });

  const getSenderDisplay = (msg: SystemMessage) => {
    if (msg.senderRole === "system_admin") return "システム管理者";
    return msg.showSenderName && msg.senderName ? msg.senderName : "テナント管理者";
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] dark:bg-gray-950 transition-colors duration-300 font-sans pb-12">
      
      {/* 1. お知らせ詳細モーダル */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 dark:border-gray-800">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-gray-50/50 dark:bg-gray-800/50">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${CATEGORIES[selectedMessage.category || "info"]?.badgeBg || "bg-blue-100 text-blue-800"}`}>
                  {CATEGORIES[selectedMessage.category || "info"]?.label || "お知らせ"}
                </span>
                {selectedMessage.isImportant && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-600 text-white flex items-center">
                    <Pin className="h-3 w-3 mr-1" /> 重要なお知らせ
                  </span>
                )}
              </div>
              <button onClick={() => setSelectedMessage(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-200/50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white leading-snug">{selectedMessage.title}</h3>
              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-3 font-medium">
                <span>配信: {selectedMessage.startAt ? selectedMessage.startAt.replace("T", " ") : new Date(selectedMessage.createdAt).toLocaleString()}</span>
                <span>配信者: {getSenderDisplay(selectedMessage)}</span>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed border border-gray-100 dark:border-gray-700">
                {selectedMessage.content}
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
              {selectedMessage.isDismissible ? (
                <button 
                  onClick={() => { markMessageAsRead(selectedMessage.id); setSelectedMessage(null); }}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  既読にして閉じる
                </button>
              ) : (
                <span className="text-xs text-gray-400 font-bold">※このお知らせは既読削除できません</span>
              )}
              <button onClick={() => setSelectedMessage(null)} className="px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold rounded-xl hover:bg-black">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. 連絡事項詳細モーダル */}
      {selectedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 dark:border-gray-800">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-gray-50/50 dark:bg-gray-800/50">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                連絡事項
              </span>
              <button onClick={() => setSelectedNotice(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-200/50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white leading-snug">{selectedNotice.title}</h3>
              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-3 font-medium">
                <span>投稿日時: {new Date(selectedNotice.createdAt).toLocaleString()}</span>
                <span>投稿者: {selectedNotice.senderName}</span>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed border border-gray-100 dark:border-gray-700">
                {selectedNotice.content}
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <button onClick={() => setSelectedNotice(null)} className="px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold rounded-xl hover:bg-black">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 固定ヘッダー */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 shadow-sm">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-inner mr-3">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-black text-gray-900 dark:text-white tracking-tight hidden sm:block">生徒会ポータル</h1>
            <h1 className="text-lg font-black text-gray-900 dark:text-white tracking-tight sm:hidden">SCPS</h1>
          </div>

          <div className="flex items-center justify-end space-x-3">
            <span className="hidden md:inline text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
              {schoolData?.name}
            </span>
            
            <div className="relative" ref={profileRef}>
              <button onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full">
                <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  {userData?.name.charAt(0) || <UserIcon className="h-4 w-4" />}
                </div>
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl shadow-2xl bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50 overflow-hidden border border-gray-100 dark:border-gray-700 animate-fade-in">
                  <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 flex items-center">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-inner flex-shrink-0">
                      {userData?.name.charAt(0)}
                    </div>
                    <div className="ml-3 overflow-hidden">
                      <p className="text-sm font-extrabold text-gray-900 dark:text-white truncate">{userData?.name}</p>
                      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mt-1">{getRoleDisplayName(userData?.role || "")}</p>
                    </div>
                  </div>
                  <div className="p-2">
                    <Link href="/account" className="flex items-center px-3 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl group transition-colors">
                      <Settings className="h-4 w-4 mr-3 text-gray-400 group-hover:text-blue-600" /> アカウント設定
                    </Link>
                    {canAccessSettings && (
                      <Link href="/top/admin" className="flex items-center px-3 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl group transition-colors">
                        <ShieldCheck className="h-4 w-4 mr-3 text-gray-400 group-hover:text-gray-900" /> テナント管理
                      </Link>
                    )}
                  </div>
                  <div className="p-2 border-t border-gray-100 dark:border-gray-700">
                    <button onClick={handleLogout} className="w-full flex items-center px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors group">
                      <LogOut className="h-4 w-4 mr-3 text-red-500 group-hover:text-red-600" /> ログアウト
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <div className="lg:col-span-3 space-y-6">
            
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center">
                  <LayoutDashboard className="h-4 w-4 mr-2 text-blue-600" /> テナントメニュー
                </h3>
              </div>
              <div className="p-2 space-y-1">
                {availableApps.length === 0 ? (
                  <p className="p-4 text-xs text-center text-gray-500">利用可能なアプリがありません</p>
                ) : (
                  availableApps.map(app => {
                    const c = COLOR_CLASSES[app.color] || COLOR_CLASSES.indigo;
                    return (
                      <Link key={app.id} href={app.path} className="flex items-center px-3 py-2.5 rounded-xl group transition-all hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className={`p-2 rounded-lg ${c.bg} ${c.text} ${c.hover} transition-colors mr-3`}>
                          <DynamicIcon name={app.icon} className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                          {app.name}
                        </span>
                        <ChevronRight className="h-4 w-4 ml-auto text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    );
                  })
                )}
              </div>
            </div>

            {/* ★カレンダー連動 */}
            <MiniCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />

          </div>

          <div className="lg:col-span-6 space-y-6">
            
            {/* ★スケジュール連動 */}
            <ScheduleWidget userData={userData} schoolData={schoolData} selectedDate={selectedDate} />

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center">
                  <BellRing className="h-4 w-4 mr-2 text-blue-600" /> お知らせ（学校・管理者通知）
                </h3>
                <span className="text-xs font-bold text-gray-400">{messages.length}件</span>
              </div>
              <div className="p-4 space-y-2.5">
                {messages.length === 0 ? (
                  <p className="text-xs font-bold text-gray-400 text-center py-6">現在、新しいお知らせはありません</p>
                ) : (
                  messages.map((msg) => {
                    const catInfo = CATEGORIES[msg.category || "info"] || CATEGORIES.info;
                    return (
                      <div 
                        key={msg.id} 
                        onClick={() => setSelectedMessage(msg)}
                        className="p-3.5 bg-gray-50 hover:bg-blue-50/50 dark:bg-gray-800/40 dark:hover:bg-gray-800/80 rounded-xl border border-gray-200/80 dark:border-gray-700 cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden mr-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${catInfo.badgeBg}`}>
                            {catInfo.label}
                          </span>
                          {msg.isImportant && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white flex-shrink-0 flex items-center">
                              <Pin className="h-3 w-3 mr-0.5" /> 重要
                            </span>
                          )}
                          <p className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {msg.title}
                          </p>
                        </div>
                        <div className="flex items-center text-[10px] font-bold text-gray-400 flex-shrink-0 gap-2">
                          <span>{msg.startAt ? msg.startAt.split("T")[0] : new Date(msg.createdAt).toLocaleDateString()}</span>
                          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-600 transition-colors" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center">
                  <MessageSquareText className="h-4 w-4 mr-2 text-indigo-600" /> 連絡事項（校内共有・連絡）
                </h3>
                <button 
                  onClick={() => alert("一般ユーザー向け投稿画面は次ステップで実装します")}
                  className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold flex items-center border border-indigo-100 dark:border-indigo-900 transition-colors"
                >
                  <Send className="h-3 w-3 mr-1" /> 投稿する
                </button>
              </div>
              <div className="p-4 space-y-2.5">
                {bulletinNotices.map((notice) => (
                  <div 
                    key={notice.id} 
                    onClick={() => setSelectedNotice(notice)}
                    className="p-3.5 bg-gray-50 hover:bg-indigo-50/50 dark:bg-gray-800/40 dark:hover:bg-gray-800/80 rounded-xl border border-gray-200/80 dark:border-gray-700 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 overflow-hidden mr-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 flex-shrink-0">
                        連絡
                      </span>
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {notice.title}
                      </p>
                    </div>
                    <div className="flex items-center text-[10px] font-bold text-gray-400 flex-shrink-0 gap-2">
                      <span>{notice.senderName}</span>
                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-600 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="lg:col-span-3 space-y-6">
            <MemberStatusBoard userData={userData} tenantUsers={tenantUsers} />
          </div>

        </div>
      </main>

    </div>
  );
}