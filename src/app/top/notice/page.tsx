"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, onSnapshot, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import * as LucideIcons from "lucide-react"; 
import { 
  Bell, Mail, MailOpen, Trash2, Flag, CheckCheck, 
  Search, ChevronLeft, ExternalLink, Loader2, X
} from "lucide-react";
import { useDialog } from "@/components/DialogContext";

type AppNotification = {
  id: string;
  userId: string;
  schoolId: string;
  title: string;
  body: string;
  sourceApp: string;
  linkUrl?: string;
  isRead: boolean;
  isFlagged: boolean;
  createdAt: string;
};

const NOTICE_COLORS: Record<string, { color: string, bg: string }> = {
  slate: { color: "text-slate-600", bg: "bg-slate-50" },
  gray: { color: "text-gray-600", bg: "bg-gray-50" },
  zinc: { color: "text-zinc-600", bg: "bg-zinc-50" },
  neutral: { color: "text-neutral-600", bg: "bg-neutral-50" },
  stone: { color: "text-stone-600", bg: "bg-stone-50" },
  red: { color: "text-red-600", bg: "bg-red-50" },
  orange: { color: "text-orange-600", bg: "bg-orange-50" },
  amber: { color: "text-amber-600", bg: "bg-amber-50" },
  yellow: { color: "text-yellow-600", bg: "bg-yellow-50" },
  lime: { color: "text-lime-600", bg: "bg-lime-50" },
  green: { color: "text-green-600", bg: "bg-green-50" },
  emerald: { color: "text-emerald-600", bg: "bg-emerald-50" },
  teal: { color: "text-teal-600", bg: "bg-teal-50" },
  cyan: { color: "text-cyan-600", bg: "bg-cyan-50" },
  sky: { color: "text-sky-600", bg: "bg-sky-50" },
  blue: { color: "text-blue-600", bg: "bg-blue-50" },
  indigo: { color: "text-indigo-600", bg: "bg-indigo-50" },
  violet: { color: "text-violet-600", bg: "bg-violet-50" },
  purple: { color: "text-purple-600", bg: "bg-purple-50" },
  fuchsia: { color: "text-fuchsia-600", bg: "bg-fuchsia-50" },
  pink: { color: "text-pink-600", bg: "bg-pink-50" },
  rose: { color: "text-rose-600", bg: "bg-rose-50" },
  default: { color: "text-gray-600", bg: "bg-gray-100" }
};

export default function NoticePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryNoticeId = searchParams.get("id"); // ★ URLクエリからIDを取得

  const [userId, setUserId] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  
  const [schoolData, setSchoolData] = useState<any>(null);
  const [systemApps, setSystemApps] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);

  const { showAlert, showConfirm } = useDialog();
  
  const [allNotifications, setAllNotifications] = useState<AppNotification[]>([]);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "flagged">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const [currentTime, setCurrentTime] = useState(Date.now());
  const [macToasts, setMacToasts] = useState<AppNotification[]>([]);
  const initialLoadRef = useRef(true);
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          let userDocSnap = await getDoc(doc(db, "users", user.uid));
          let currentSchoolId = "";

          if (userDocSnap.exists()) {
            currentSchoolId = userDocSnap.data().schoolId;
          } else {
            const qExt = query(collection(db, "external_users"), where("authUid", "==", user.uid));
            const extSnap = await getDocs(qExt);
            if (!extSnap.empty) currentSchoolId = extSnap.docs[0].data().schoolId;
          }

          if (currentSchoolId) {
            setUserId(user.uid);
            setSchoolId(currentSchoolId);
            
            const schoolDocSnap = await getDoc(doc(db, "schools", currentSchoolId));
            if (schoolDocSnap.exists()) setSchoolData(schoolDocSnap.data());

            try {
              const appsSnap = await getDocs(collection(db, "system_apps"));
              setSystemApps(appsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (appErr) { console.error(appErr); }
          } else {
            router.push("/login"); return;
          }
        } catch (error) { console.error(error); }
      } else { router.push("/login"); }
    });

    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!userId || !schoolId) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("schoolId", "==", schoolId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: AppNotification[] = [];
      snapshot.forEach(d => {
        const data = d.data();
        let dateIso = new Date().toISOString();
        if (data.createdAt) {
          dateIso = typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate().toISOString() : new Date(data.createdAt).toISOString();
        }
        fetched.push({ id: d.id, ...data, createdAt: dateIso } as AppNotification);
      });
      setAllNotifications(fetched);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId, schoolId]);

  // ★ 初期ロード時にURLクエリのIDを反映する
  useEffect(() => {
    if (!isLoading && queryNoticeId && allNotifications.some(n => n.id === queryNoticeId)) {
       setSelectedNoticeId(queryNoticeId);
       
       // 未読なら既読化
       const target = allNotifications.find(n => n.id === queryNoticeId);
       if (target && !target.isRead) {
          updateDoc(doc(db, "notifications", target.id), { isRead: true }).catch(console.error);
       }
    }
  }, [isLoading, queryNoticeId, allNotifications]);

  useEffect(() => {
    if (isLoading) return;

    const now = currentTime;
    const newToasts: AppNotification[] = [];

    allNotifications.forEach(n => {
      const time = new Date(n.createdAt).getTime();
      if (time <= now) {
        if (!notifiedIdsRef.current.has(n.id)) {
          notifiedIdsRef.current.add(n.id);
          if (!initialLoadRef.current) {
            newToasts.push(n);
          }
        }
      }
    });

    if (newToasts.length > 0) {
      setMacToasts(prev => [...prev, ...newToasts]);
      newToasts.forEach(t => {
        setTimeout(() => {
          setMacToasts(prev => prev.filter(toast => toast.id !== t.id));
        }, 5000);
      });
    }

    if (initialLoadRef.current) {
      initialLoadRef.current = false;
    }
  }, [allNotifications, currentTime, isLoading]);

  const visibleNotifications = useMemo(() => {
    return allNotifications
      .filter(n => new Date(n.createdAt).getTime() <= currentTime)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allNotifications, currentTime]);

  const getAppConfig = (sourceApp: string) => {
    const appMeta = systemApps.find(a => a.appId === sourceApp || a.id === sourceApp);
    
    let iconName = appMeta?.icon || "Bell";
    let colorKey = appMeta?.color || "default";
    let defaultLabel = appMeta?.name || "通知";

    if (!appMeta) {
      switch (sourceApp) {
        case "chat": iconName = "MessageCircle"; colorKey = "indigo"; defaultLabel = "チャット"; break;
        case "board": iconName = "FileText"; colorKey = "emerald"; defaultLabel = "連絡事項"; break;
        case "tasks":
        case "task": iconName = "CheckSquare"; colorKey = "amber"; defaultLabel = "タスク"; break;
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

  const filteredNotifications = useMemo(() => {
    let filtered = visibleNotifications;
    if (activeTab === "unread") filtered = filtered.filter(n => !n.isRead);
    if (activeTab === "flagged") filtered = filtered.filter(n => n.isFlagged);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(q) || 
        n.body.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [visibleNotifications, activeTab, searchQuery]);

  const selectedNotice = visibleNotifications.find(n => n.id === selectedNoticeId);

  const handleSelectNotice = async (notice: AppNotification) => {
    setSelectedNoticeId(notice.id);
    
    // URLを更新する
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", notice.id);
    router.replace(`/top/notice?${params.toString()}`);

    if (!notice.isRead) {
      try {
        await updateDoc(doc(db, "notifications", notice.id), { isRead: true });
      } catch (error) { console.error("既読更新エラー:", error); }
    }
  };

  const handleToggleFlag = async (noticeId: string, currentFlag: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try { await updateDoc(doc(db, "notifications", noticeId), { isFlagged: !currentFlag }); } catch (error) {}
  };

  const handleToggleRead = async (noticeId: string, currentRead: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try { await updateDoc(doc(db, "notifications", noticeId), { isRead: !currentRead }); } catch (error) {}
  };

  const executeDelete = async (noticeId: string) => {
    try {
      await deleteDoc(doc(db, "notifications", noticeId));
      if (selectedNoticeId === noticeId) {
        setSelectedNoticeId(null);
        // URLのIDパラメータを削除
        const params = new URLSearchParams(searchParams.toString());
        params.delete("id");
        router.replace(params.toString() ? `/top/notice?${params.toString()}` : "/top/notice");
      }
      showAlert("通知を削除しました", "success");
    } catch (error) {
      showAlert("削除に失敗しました", "error");
    }
  };

  const handleDelete = (noticeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    showConfirm(
      "この通知を削除しますか？",
      () => executeDelete(noticeId),
      "danger",
      "通知削除の確認"
    );
  };

  const handleMarkAllAsRead = async () => {
    const unreadNotices = visibleNotifications.filter(n => !n.isRead);
    if (unreadNotices.length === 0) return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      unreadNotices.forEach(n => batch.update(doc(db, "notifications", n.id), { isRead: true }));
      await batch.commit();
    } catch (error) { showAlert("一括既読に失敗しました", "error"); } finally { setIsProcessing(false); }
  };

  // ★ 表示中タブに応じた削除の実行
  const executeDeleteAll = async () => {
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      // filteredNotifications は現在表示されているタブと検索結果を反映している
      let targetsToDelete = filteredNotifications;

      // 「すべて」タブの場合は、フラグ付きを削除対象から除外
      if (activeTab === "all") {
        targetsToDelete = targetsToDelete.filter(n => !n.isFlagged);
      }

      if (targetsToDelete.length === 0) {
        showAlert("削除できる通知がありません", "info");
        setIsProcessing(false);
        return;
      }

      targetsToDelete.forEach(n => batch.delete(doc(db, "notifications", n.id)));
      await batch.commit();
      setSelectedNoticeId(null);
      
      const params = new URLSearchParams(searchParams.toString());
      params.delete("id");
      router.replace(params.toString() ? `/top/notice?${params.toString()}` : "/top/notice");

      showAlert("通知を削除しました", "success");
    } catch (error) { 
      showAlert("一括削除に失敗しました", "error"); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleDeleteAll = () => {
    let message = "表示中の通知をすべて削除しますか？";
    if (activeTab === "all") {
      message = "すべての通知を削除しますか？\n（フラグが付いている通知は削除されません）";
    }
    showConfirm(message, executeDeleteAll, "danger", "通知削除の確認");
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) {
      return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    } else if (d.toDateString() === yesterday.toDateString()) { return `昨日`; } 
    else { return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; }
  };

  const formatFullDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (isLoading) {
    return <div className="h-full flex justify-center items-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }

  const unreadCount = visibleNotifications.filter(n => !n.isRead).length;

  return (
    <div className="h-full font-sans flex flex-col text-gray-900 bg-[#F9FAFB] relative overflow-hidden">
      
      {/* ＝＝＝ Mac風通知モーダル (画面右上に常駐) ＝＝＝ */}
      <div className="absolute top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
        {macToasts.map(toast => {
          const appConf = getAppConfig(toast.sourceApp);
          const Icon = appConf.icon;
          return (
            <div 
              key={toast.id} 
              onClick={() => {
                handleSelectNotice(toast);
                setMacToasts(prev => prev.filter(t => t.id !== toast.id));
              }}
              className="w-80 bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-2xl p-4 flex gap-3 pointer-events-auto cursor-pointer transition-all hover:bg-white hover:scale-[1.02]"
              style={{ animation: "fadeInRight 0.3s ease-out forwards" }}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${appConf.bg} ${appConf.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-0.5">
                  <h4 className="text-sm font-black text-gray-900 truncate">{toast.title}</h4>
                  <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap ml-2">たった今</span>
                </div>
                <p className="text-xs font-medium text-gray-600 line-clamp-2 leading-relaxed">{toast.body}</p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setMacToasts(prev => prev.filter(t => t.id !== toast.id)); }}
                className="absolute -top-2 -right-2 bg-gray-800 text-white p-1 rounded-full opacity-0 hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(20px) scale(0.95); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}} />

      <main className="flex-1 w-full max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 flex flex-col min-h-0">
        
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm"><Bell className="w-5 h-5" /></div>
            <div>
              <h1 className="text-lg font-black text-gray-900 tracking-tight leading-tight">インボックス</h1>
              <p className="text-[10px] font-bold text-gray-500">システムからのお知らせや新着通知</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={handleMarkAllAsRead} disabled={isProcessing || unreadCount === 0} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 rounded-md text-[11px] font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5">
              <CheckCheck className="w-3.5 h-3.5" /> すべて既読
            </button>
            <button onClick={handleDeleteAll} disabled={isProcessing || filteredNotifications.length === 0} className="px-3 py-1.5 bg-white border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-200 rounded-md text-[11px] font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> {activeTab === "all" ? "すべて削除" : "表示中を削除"}
            </button>
          </div>
        </div>

        {/* メインコンテナ */}
        <div className="flex-1 overflow-hidden flex bg-white rounded-2xl shadow-sm border border-gray-200 relative">
          
          {/* 左ペイン：リスト */}
          <div className={`w-full sm:w-[320px] md:w-[360px] flex flex-col border-r border-gray-200 flex-shrink-0 ${selectedNoticeId ? 'hidden sm:flex' : 'flex'}`}>
            <div className="p-3 border-b border-gray-100 bg-gray-50/80 shrink-0">
              <div className="flex bg-gray-200/60 p-1 rounded-lg w-full shadow-inner mb-2.5 overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab("all")} className={`flex-1 min-w-[50px] flex justify-center items-center py-1 text-[10px] font-bold rounded-md transition-all relative ${activeTab === "all" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>すべて</button>
                <button onClick={() => setActiveTab("unread")} className={`flex-1 min-w-[50px] flex justify-center items-center py-1 text-[10px] font-bold rounded-md transition-all relative ${activeTab === "unread" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>未読{unreadCount > 0 && <span className="absolute top-1 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}</button>
                <button onClick={() => setActiveTab("flagged")} className={`flex-1 min-w-[50px] flex justify-center items-center py-1 text-[10px] font-bold rounded-md transition-all ${activeTab === "flagged" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>フラグ</button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input type="text" placeholder="検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs transition-all" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
              {filteredNotifications.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-gray-400">
                  <MailOpen className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-[11px] font-bold">通知はありません</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredNotifications.map(notice => {
                    const appConf = getAppConfig(notice.sourceApp);
                    const Icon = appConf.icon;
                    const isSelected = selectedNoticeId === notice.id;

                    return (
                      <div key={notice.id} onClick={() => handleSelectNotice(notice)} className={`p-2.5 flex gap-2.5 cursor-pointer transition-colors relative border-l-[3px] group ${isSelected ? "bg-blue-50/60 border-blue-500" : !notice.isRead ? "bg-white border-transparent hover:bg-gray-50" : "bg-white border-transparent hover:bg-gray-50 opacity-70"}`}>
                        {!notice.isRead && <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm" />}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-black/5 ${appConf.bg} ${appConf.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0 pr-5">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className={`text-[8px] font-black ${appConf.color} bg-white px-1.5 py-0.5 rounded border border-current/20`}>{appConf.label}</span>
                            <span className={`text-[9px] whitespace-nowrap ${!notice.isRead ? 'text-blue-600 font-bold' : 'text-gray-400 font-medium'}`}>{formatTime(notice.createdAt)}</span>
                          </div>
                          <h4 className={`text-[12px] truncate leading-tight mt-1 mb-0.5 ${!notice.isRead ? 'font-black text-gray-900' : 'font-bold text-gray-800'}`}>{notice.title}</h4>
                          <p className="text-[10px] text-gray-500 truncate font-medium">{notice.body}</p>
                        </div>
                        <button onClick={(e) => handleToggleFlag(notice.id, notice.isFlagged, e)} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-all ${notice.isFlagged ? 'text-amber-500 opacity-100' : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-amber-500 hover:bg-amber-50'}`}>
                          <Flag className={`w-3.5 h-3.5 ${notice.isFlagged ? 'fill-amber-500' : ''}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 右ペイン：詳細 */}
          <div className={`flex-1 flex flex-col min-w-0 bg-[#FAFAFA] relative ${!selectedNoticeId ? 'hidden sm:flex' : 'flex'}`}>
            {/* ★ スマホ用ヘッダー（未読・フラグ・削除もここに配置） */}
            {selectedNoticeId && selectedNotice && (
              <div className="sm:hidden p-3 border-b border-gray-200 bg-white shrink-0 flex items-center justify-between">
                <button 
                  onClick={() => {
                    setSelectedNoticeId(null);
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete("id");
                    router.replace(params.toString() ? `/top/notice?${params.toString()}` : "/top/notice");
                  }} 
                  className="flex items-center text-blue-600 text-xs font-bold"
                >
                  <ChevronLeft className="w-4 h-4 mr-0.5" /> 戻る
                </button>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleToggleRead(selectedNotice.id, selectedNotice.isRead)} className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 rounded-lg transition-colors" title={selectedNotice.isRead ? "未読にする" : "既読にする"}>
                    {selectedNotice.isRead ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleToggleFlag(selectedNotice.id, selectedNotice.isFlagged)} className={`p-1.5 rounded-lg transition-colors ${selectedNotice.isFlagged ? 'text-amber-500 bg-amber-50' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <Flag className={`w-4 h-4 ${selectedNotice.isFlagged ? 'fill-amber-500' : ''}`} />
                  </button>
                  <button onClick={(e) => handleDelete(selectedNotice.id, e)} className="p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {!selectedNotice ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6 text-center h-full">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 opacity-50 shadow-inner">
                  <Mail className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-sm font-black text-gray-600 mb-1">通知を選択してください</h3>
                <p className="text-[10px] font-bold text-gray-400">左側のリストから通知をクリックすると詳細が表示されます。</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col h-full overflow-hidden animate-fade-in">
                {/* ★ PC用ヘッダー */}
                <div className="hidden sm:flex px-5 py-3 border-b border-gray-200 bg-white justify-end gap-1.5 shrink-0">
                  <button onClick={() => handleToggleRead(selectedNotice.id, selectedNotice.isRead)} className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 rounded-lg transition-colors tooltip" title={selectedNotice.isRead ? "未読にする" : "既読にする"}>
                    {selectedNotice.isRead ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleToggleFlag(selectedNotice.id, selectedNotice.isFlagged)} className={`p-1.5 rounded-lg transition-colors ${selectedNotice.isFlagged ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' : 'text-gray-500 hover:bg-gray-100 hover:text-amber-500'}`} title={selectedNotice.isFlagged ? "フラグを外す" : "フラグを付ける"}>
                    <Flag className={`w-4 h-4 ${selectedNotice.isFlagged ? 'fill-amber-500' : ''}`} />
                  </button>
                  <button onClick={(e) => handleDelete(selectedNotice.id, e)} className="p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors" title="削除">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 lg:p-8">
                  <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-3">
                        {(() => {
                           const appConf = getAppConfig(selectedNotice.sourceApp);
                           const Icon = appConf.icon;
                           return (
                             <>
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-black/5 ${appConf.bg} ${appConf.color}`}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-[9px] font-black ${appConf.color} bg-white px-1.5 py-0.5 rounded border border-current/20`}>{appConf.label}</span>
                                  <span className="text-[10px] font-bold text-gray-400">{formatFullDate(selectedNotice.createdAt)}</span>
                                </div>
                                <h2 className="text-base sm:text-lg font-black text-gray-900 leading-tight">{selectedNotice.title}</h2>
                              </div>
                             </>
                           );
                        })()}
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap font-medium border-t border-gray-100 pt-5 text-[13px]">
                      {selectedNotice.body}
                    </div>
                    {selectedNotice.linkUrl && (
                      <div className="mt-8 pt-5 border-t border-gray-100 flex justify-center">
                        <button onClick={() => router.push(selectedNotice.linkUrl!)} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 transition-all hover:-translate-y-0.5 flex items-center gap-2">
                          内容を確認する <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}