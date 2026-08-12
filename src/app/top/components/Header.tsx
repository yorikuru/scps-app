"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  PanelLeftClose, PanelLeft, Settings, ShieldCheck, LogOut, Clock, User as UserIcon,
  BellRing, Mail, MailOpen, Star, Trash2, CheckCircle2, ChevronRight, Home 
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { doc, getDoc, getDocs, collection, query, where, onSnapshot, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserData } from "../page";
import HeaderSearch from "./HeaderSearch";
import { useDialog } from "@/components/DialogContext";

// 通知のカラーマッピング
const NOTICE_COLORS: Record<string, { color: string, bg: string }> = {
  indigo: { color: "text-indigo-600", bg: "bg-indigo-50" },
  blue: { color: "text-blue-600", bg: "bg-blue-50" },
  emerald: { color: "text-emerald-600", bg: "bg-emerald-50" },
  green: { color: "text-emerald-600", bg: "bg-emerald-50" },
  purple: { color: "text-purple-600", bg: "bg-purple-50" },
  orange: { color: "text-orange-600", bg: "bg-orange-50" },
  rose: { color: "text-rose-600", bg: "bg-rose-50" },
  amber: { color: "text-amber-600", bg: "bg-amber-50" },
  cyan: { color: "text-cyan-600", bg: "bg-cyan-50" },
  sky: { color: "text-sky-600", bg: "bg-sky-50" },
  teal: { color: "text-teal-600", bg: "bg-teal-50" },
  violet: { color: "text-violet-600", bg: "bg-violet-50" },
  pink: { color: "text-pink-600", bg: "bg-pink-50" },
  slate: { color: "text-slate-600", bg: "bg-slate-100" },
  default: { color: "text-blue-600", bg: "bg-blue-50" }
};

type Props = {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  userData: UserData | null;
  messages: any[]; 
  tenantUsers: UserData[]; 
  canAccessSettings: boolean;
  handleLogout: () => void;
  isProfileMenuOpen: boolean;
  setIsProfileMenuOpen: (open: boolean) => void;
};

export default function Header({
  isSidebarOpen, setIsSidebarOpen, userData,
  canAccessSettings, handleLogout, isProfileMenuOpen, setIsProfileMenuOpen
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { showConfirm } = useDialog();

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // マスタデータ（アプリ名・通知バッジ用）
  const [schoolData, setSchoolData] = useState<any>(null);
  const [systemApps, setSystemApps] = useState<any[]>([]);
  const [allNotifications, setAllNotifications] = useState<any[]>([]);

  // 1秒ごとに時計を更新
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 外部クリックでメニューを閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { 
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileMenuOpen(false); 
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setIsNotifOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setIsProfileMenuOpen]);

  // テナント設定とアプリマスタを取得
  useEffect(() => {
    if (!userData?.schoolId) return;
    const fetchMeta = async () => {
      try {
        const sDoc = await getDoc(doc(db, "schools", userData.schoolId));
        if (sDoc.exists()) setSchoolData(sDoc.data());

        const appsSnap = await getDocs(collection(db, "apps"));
        if (!appsSnap.empty) {
          setSystemApps(appsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
          const sysAppsSnap = await getDocs(collection(db, "system_apps"));
          setSystemApps(sysAppsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (e) { console.error(e); }
    };
    fetchMeta();
  }, [userData]);

  // インボックス通知のリアルタイム取得
  useEffect(() => {
    if (!userData?.id || !userData?.schoolId) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userData.id),
      where("schoolId", "==", userData.schoolId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: any[] = [];
      snapshot.forEach(d => {
        const data = d.data();
        let dateIso = new Date().toISOString();
        if (data.createdAt) {
          dateIso = typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate().toISOString() : new Date(data.createdAt).toISOString();
        }
        fetched.push({ id: d.id, ...data, createdAt: dateIso });
      });
      setAllNotifications(fetched);
    });

    return () => unsubscribe();
  }, [userData]);

  // 表示可能な通知（現在時刻より過去のもの）
  const visibleNotifications = useMemo(() => {
    return allNotifications
      .filter(n => new Date(n.createdAt).getTime() <= currentTime)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allNotifications, currentTime]);

  const unreadCount = visibleNotifications.filter(n => !n.isRead).length;
  const topNotifications = visibleNotifications.slice(0, 5);

  // アプリの情報（アイコンや色、カスタマイズ名）を取得
  const getAppConfig = (sourceApp: string) => {
    const appMeta = systemApps.find(a => a.id === sourceApp || a.appId === sourceApp);
    let iconName = appMeta?.icon || "Bell";
    let colorKey = appMeta?.color || "default";
    let defaultLabel = appMeta?.displayName || appMeta?.name || "通知";

    if (!appMeta) {
      switch (sourceApp) {
        case "chat": iconName = "MessageCircle"; colorKey = "indigo"; defaultLabel = "チャット"; break;
        case "board": iconName = "FileText"; colorKey = "emerald"; defaultLabel = "連絡事項"; break;
        case "task":
        case "tasks": iconName = "CheckSquare"; colorKey = "amber"; defaultLabel = "タスク"; break;
        case "equipment": iconName = "Package"; colorKey = "blue"; defaultLabel = "備品管理"; break;
        case "system": iconName = "Settings"; colorKey = "slate"; defaultLabel = "システム"; break;
      }
    }

    const customName = schoolData?.customAppNames?.[sourceApp];
    const label = customName || defaultLabel;
    const colors = NOTICE_COLORS[colorKey] || NOTICE_COLORS.default;
    const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.Bell;

    return { icon: IconComponent, color: colors.color, bg: colors.bg, label };
  };

  // パンくずリスト用のアプリ名
  const currentAppId = pathname.split("/")[2]; 
  let currentAppName = "";
  if (currentAppId) {
    if (currentAppId === "account") currentAppName = "マイアカウント設定";
    else if (currentAppId === "admin") {
      const subApp = pathname.split("/")[3];
      if (subApp === "messages") currentAppName = "テナントお知らせ配信";
      else currentAppName = "テナント管理";
    }
    else if (currentAppId === "notice") currentAppName = "インボックス通知";
    else {
      const conf = getAppConfig(currentAppId);
      currentAppName = conf.label !== "通知" ? conf.label : currentAppId; 
    }
  }

  // 通知のアクション
  const toggleRead = async (id: string, currentRead: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await updateDoc(doc(db, "notifications", id), { isRead: !currentRead }); } catch (err) {}
  };

  const toggleFlag = async (id: string, currentFlag: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await updateDoc(doc(db, "notifications", id), { isFlagged: !currentFlag }); } catch (err) {}
  };

  const executeDeleteNotif = async (id: string) => {
    try { await deleteDoc(doc(db, "notifications", id)); } catch (err) {}
  };

  const deleteNotif = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm(
      "この通知を削除しますか？",
      () => executeDeleteNotif(id),
      "danger",
      "通知削除の確認"
    );
  };

  const markAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const unreadNotifs = visibleNotifications.filter(n => !n.isRead);
    if (unreadNotifs.length === 0) return;
    try {
      const batch = writeBatch(db);
      unreadNotifs.forEach(n => batch.update(doc(db, "notifications", n.id), { isRead: true }));
      await batch.commit();
    } catch (err) {}
  };

  const formatTimeRelative = (dateStr: string) => {
    if (!dateStr) return "";
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return "今";
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;
    return new Date(dateStr).toLocaleDateString('ja-JP');
  };

  const formattedDateTime = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(currentTime));

  return (
    // ★ h-11 sm:h-12 で高さを固定し、flex-shrink-0 を付与して潰れないようにします。
    <header className="h-11 sm:h-12 bg-white border-b border-gray-200 flex items-center justify-between px-2 sm:px-4 flex-shrink-0 z-30 relative w-full">
      
      {/* 左側：サイドバー切り替え＆ホームボタン＆パンくずリスト */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md transition-colors">
          {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
        </button>
        
        {/* ホームボタン */}
        <button onClick={() => router.push('/top')} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" title="ホーム画面へ">
          <Home className="w-4 h-4" />
        </button>

        <div className="hidden sm:flex items-center text-[11px] font-bold text-gray-500">
          <span onClick={() => router.push('/top')} className="hover:text-indigo-600 hover:underline cursor-pointer transition-colors">生徒会ポータル</span>
          <span className="mx-1.5 text-gray-300">/</span>
          {currentAppName ? (
            <span className="text-gray-900">{currentAppName}</span>
          ) : (
            <span className="text-gray-900">ダッシュボード</span>
          )}
        </div>
      </div>
      
      {/* 中央：時計表示 */}
      <div className="hidden md:flex items-center gap-1 px-2.5 py-0.5 bg-gray-50 border border-gray-200/80 rounded-md shadow-2xs">
        <Clock className="w-3 h-3 text-indigo-600 animate-pulse" />
        <span className="text-[11px] font-black tracking-tight text-gray-800 font-mono">{formattedDateTime}</span>
      </div>

      {/* 右側：検索・通知・プロフィール・ログアウト */}
      <div className="flex items-center gap-1 sm:gap-3">
        
        <HeaderSearch />
        
        {/* 通知ベルとドロップダウン */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors relative" title="インボックス通知">
            <BellRing className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 sm:top-1 sm:right-1 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse"></span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-[-45px] sm:right-0 top-full mt-2 w-[290px] sm:w-[320px] max-w-[90vw] bg-white border border-gray-200 rounded-xl shadow-xl z-40 flex flex-col overflow-hidden animate-fade-in origin-top-right">
              <div className="px-3 py-2 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                <h3 className="text-[11px] font-black text-gray-900 flex items-center gap-1.5"><BellRing className="w-3.5 h-3.5 text-blue-600" /> インボックス通知</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> すべて既読
                  </button>
                )}
              </div>
              
              {/* ドロップダウン内部のスクロール指定 */}
              <div className="max-h-[350px] overflow-y-auto custom-scrollbar bg-white divide-y divide-gray-50 overscroll-contain">
                {topNotifications.length === 0 ? (
                  <div className="p-6 flex flex-col items-center justify-center text-gray-400">
                    <BellRing className="w-6 h-6 mb-1.5 opacity-20" />
                    <p className="text-[10px] font-bold">新しい通知はありません</p>
                  </div>
                ) : (
                  topNotifications.map(n => {
                    const appConf = getAppConfig(n.sourceApp);
                    const Icon = appConf.icon;
                    return (
                      <div 
                        key={n.id} 
                        onClick={() => { setIsNotifOpen(false); router.push(n.linkUrl || '/top/notice'); }}
                        className={`p-2.5 hover:bg-gray-50 transition-colors group flex gap-2.5 relative cursor-pointer ${!n.isRead ? 'bg-blue-50/20' : ''}`}
                      >
                        {!n.isRead && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500"></div>}
                        
                        <div className="flex-shrink-0 mt-0.5">
                          <div className={`p-1.5 rounded-full ${!n.isRead ? 'bg-white shadow-sm border border-gray-100' : 'bg-transparent'} ${appConf.color} ${appConf.bg}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 pr-6">
                          <div className="flex justify-between items-start mb-0.5">
                            <h4 className={`text-[11px] truncate pr-1 ${!n.isRead ? 'font-black text-gray-900' : 'font-bold text-gray-600'}`}>{n.title}</h4>
                            <span className="text-[8px] font-bold text-gray-400 flex-shrink-0 mt-0.5">{formatTimeRelative(n.createdAt)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mb-0.5">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black bg-white border border-current/20 ${appConf.color}`}>{appConf.label}</span>
                            {n.isFlagged && <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-100 text-amber-700 border border-amber-200">フラグ</span>}
                          </div>
                          <p className="text-[9px] text-gray-500 line-clamp-1 leading-relaxed mt-0.5">{n.body || n.content}</p>
                        </div>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-1.5 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm shadow-sm border border-gray-200 rounded p-0.5 flex flex-col gap-0.5 z-10">
                          <button onClick={(e) => toggleRead(n.id, n.isRead, e)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500" title={n.isRead ? "既読にする" : "未読にする"}>
                            {n.isRead ? <MailOpen className="w-3 h-3 text-blue-600" /> : <Mail className="w-3 h-3" />}
                          </button>
                          <button onClick={(e) => toggleFlag(n.id, n.isFlagged, e)} className={`p-1.5 rounded ${n.isFlagged ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' : 'text-gray-500 hover:bg-gray-100'}`} title="フラグ">
                            <Star className={`w-3 h-3 ${n.isFlagged ? 'fill-current' : ''}`} />
                          </button>
                          <button onClick={(e) => deleteNotif(n.id, e)} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded text-gray-500 transition-colors" title="削除">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="p-1.5 border-t border-gray-100 bg-gray-50 text-center">
                <button 
                  onClick={() => { setIsNotifOpen(false); router.push('/top/notice'); }} 
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center justify-center w-full py-1.5 gap-1"
                >
                  すべての通知を見る <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ログアウトボタン */}
        <button onClick={handleLogout} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors hidden sm:block" title="ログアウト">
          <LogOut className="w-4 h-4" />
        </button>

        {/* プロフィールメニュー */}
        <div className="relative" ref={profileRef}>
          <button onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="flex items-center p-0.5 rounded-full hover:bg-gray-100 transition-colors ml-1">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 shadow-sm">
              {(userData as any)?.photoURL ? (
                <img src={(userData as any).photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
                  {userData?.name?.charAt(0) || "U"}
                </div>
              )}
            </div>
          </button>
          
          {isProfileMenuOpen && (
            <div className="absolute right-[-10px] sm:right-0 top-full mt-2 w-48 sm:w-52 bg-white border border-gray-200 rounded-xl shadow-xl p-1.5 z-40 animate-fade-in origin-top-right">
              <div className="px-2.5 py-1.5 border-b border-gray-100 mb-1">
                <p className="text-xs font-bold text-gray-900 truncate">{userData?.name}</p>
                <p className="text-[9px] text-gray-500 truncate">{userData?.email || "メール未設定"}</p>
              </div>
              <Link href="/top/account" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-2 px-2.5 py-2 text-[11px] font-bold text-gray-700 hover:bg-gray-100 hover:text-indigo-600 rounded-md transition-colors">
                <Settings className="w-3.5 h-3.5" /> マイアカウント設定
              </Link>
              {canAccessSettings && (
                <Link href="/top/admin" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-2 px-2.5 py-2 text-[11px] font-bold text-gray-700 hover:bg-gray-100 hover:text-indigo-600 rounded-md transition-colors">
                  <ShieldCheck className="w-3.5 h-3.5" /> テナント管理
                </Link>
              )}
              {/* スマホの時はここにログアウトも表示する */}
              <button onClick={handleLogout} className="sm:hidden w-full flex items-center gap-2 px-2.5 py-2 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded-md transition-colors mt-1 border-t border-gray-100">
                <LogOut className="w-3.5 h-3.5" /> ログアウト
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}