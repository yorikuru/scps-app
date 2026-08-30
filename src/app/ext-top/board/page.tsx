"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, onSnapshot, orderBy, updateDoc, arrayUnion } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { 
  ArrowUpDown, Loader2, AlertTriangle, LogOut, Search, 
  MessageSquareText, Calendar, ChevronLeft, Paperclip, 
  FileIcon, Download, AlertOctagon, Check, CheckSquare, 
  AlertCircle, XCircle, BookOpen, Globe 
} from "lucide-react";
import * as LucideIcons from "lucide-react";

import { useDialog } from "@/components/DialogContext";
import { ExternalUser } from "@/app/types/external";
import ExtHeader from "@/app/ext-top/components/ExtHeader";
import { Announcement, Category, AppConfig, COLOR_MAPPINGS } from "@/app/top/board/types";
import CustomSelect from "@/components/CustomSelect";
import LoadingScreen from "@/components/LoadingScreen";

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

const UserAvatar = ({ name, url, className = "w-5 h-5 text-[9px]" }: { name: string, url?: string, className?: string }) => {
  return url ? (
    <img src={url} alt={name} className={`${className} rounded-full object-cover shadow-2xs flex-shrink-0 border border-gray-100`} />
  ) : (
    <div className={`${className} rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-2xs`}>
      {name.charAt(0)}
    </div>
  );
};

function ExternalBoardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const noticeQuery = searchParams.get("notice");

  const { showConfirm, showAlert } = useDialog();
  
  const [extUser, setExtUser] = useState<ExternalUser | null>(null);
  const [schoolData, setSchoolData] = useState<any>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);

  const [activeNoticeId, setActiveNoticeId] = useState<string | null>(null);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // フィルター・ソート
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterReadStatus, setFilterReadStatus] = useState<"all" | "unread" | "read">("all");
  const [filterActionStatus, setFilterActionStatus] = useState<"all" | "incomplete" | "completed">("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const [appConfig, setAppConfig] = useState<AppConfig>({ name: "連絡事項", icon: "MessageSquareText", color: "indigo" });

  useEffect(() => {
    let unsubAnnouncements: (() => void) | undefined;
    let unsubCategories: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const qExt = query(collection(db, "external_users"), where("authUid", "==", user.uid));
          const querySnapshot = await getDocs(qExt); 

          if (querySnapshot.empty) {
            setError("外部ユーザーアカウントが見つかりません。");
            setIsLoading(false);
            return;
          }

          const extDoc = querySnapshot.docs[0];
          const currentUserData = { id: extDoc.id, ...extDoc.data() } as ExternalUser;
          
          const now = Date.now();
          let isExpired = false;
          if (currentUserData.expiresAt) {
            const expTime = typeof (currentUserData.expiresAt as any).toDate === 'function' 
              ? (currentUserData.expiresAt as any).toDate().getTime() 
              : new Date(currentUserData.expiresAt).getTime();
            if (expTime < now) isExpired = true;
          }

          if (currentUserData.status !== "active" || isExpired) {
            setError(isExpired ? "アカウントの有効期限が切れています。" : "アカウントが有効化されていないか、停止されています。");
            setIsLoading(false);
            return;
          }

          const allowedModules = currentUserData.allowedModules || [];
          if (!allowedModules.includes("board")) {
            setError("このアプリの利用権限が付与されていません。");
            setIsLoading(false);
            return;
          }

          setExtUser(currentUserData);

          const schoolDocSnap = await getDoc(doc(db, "schools", currentUserData.schoolId));
          let currentSchoolData: any = {};
          if (schoolDocSnap.exists()) {
            currentSchoolData = schoolDocSnap.data();
            setSchoolData(currentSchoolData);
          }

          const qApps = query(collection(db, "system_apps"), where("appId", "==", "board"));
          const appsSnap = await getDocs(qApps);
          let boardAppMeta: any = { icon: "MessageSquareText", color: "indigo", name: "連絡事項" };
          if (!appsSnap.empty) {
            boardAppMeta = appsSnap.docs[0].data();
          }

          setAppConfig({
            name: currentSchoolData.customExternalAppNames?.["board"] || currentSchoolData.customAppNames?.["board"] || boardAppMeta.name,
            icon: boardAppMeta.icon,
            color: boardAppMeta.color
          });

          unsubUsers = onSnapshot(query(collection(db, "users"), where("schoolId", "==", currentUserData.schoolId)), (snapshot) => {
            const fetchedUsers: any[] = [];
            snapshot.forEach(d => fetchedUsers.push({ id: d.id, ...d.data() }));
            setTenantUsers(fetchedUsers);
          });

          unsubCategories = onSnapshot(query(collection(db, "board_categories"), where("schoolId", "==", currentUserData.schoolId)), (snapshot) => {
            const cats: Category[] = [];
            snapshot.forEach((d) => cats.push({ id: d.id, ...d.data() } as Category));
            setCategories(cats);
          });

          // 外部ユーザー向けの連絡事項を取得
          const qAnnouncements = query(
            collection(db, "announcements"), 
            where("schoolId", "==", currentUserData.schoolId),
            where("isExternal", "==", true),
            orderBy("createdAt", "desc")
          );

          unsubAnnouncements = onSnapshot(qAnnouncements, (snapshot) => {
            const fetched: any[] = [];
            snapshot.forEach((d) => {
              const docData = d.data();
              fetched.push({
                id: d.id,
                title: docData.title,
                content: docData.content,
                authorName: docData.authorName,
                authorId: docData.authorId,
                authorPhotoURL: docData.authorPhotoURL || docData.authorAvatarUrl,
                createdAt: docData.createdAt ? docData.createdAt.toDate().toISOString() : new Date().toISOString(),
                categoryId: docData.categoryId,
                isUrgent: docData.isUrgent,
                attachments: docData.attachments || [],
                publishStartDate: docData.publishStartDate || null,
                publishEndDate: docData.publishEndDate || null,
                isExternal: docData.isExternal || false,
                // ★ 既読・対応の追加
                readByExternal: docData.readByExternal || [], 
                requireAction: docData.requireAction || false,
                actionType: docData.actionType || "all",
                actionByExternal: docData.actionByExternal || []
              });
            });
            setAnnouncements(fetched);
          });

          setIsLoading(false);
        } catch (error) {
          console.error(error);
          setError("データの読み込みに失敗しました。");
          setIsLoading(false);
        }
      } else {
        router.push("/ext-login");
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUsers) unsubUsers();
      if (unsubCategories) unsubCategories();
      if (unsubAnnouncements) unsubAnnouncements();
    };
  }, [router]);

  useEffect(() => {
    if (!isLoading && noticeQuery) {
      if (announcements.some(a => a.id === noticeQuery)) {
        setActiveNoticeId(noticeQuery);
        if (window.innerWidth < 1024) setShowMobileDetail(true);
      } else {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("notice");
        router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
      }
    }
  }, [noticeQuery, announcements, isLoading, router, searchParams, pathname]);

  const updateNoticeUrl = (noticeId: string | null) => {
    setActiveNoticeId(noticeId);
    const params = new URLSearchParams(searchParams.toString());
    if (noticeId) {
      params.set("notice", noticeId);
    } else {
      params.delete("notice");
    }
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };

  // ★ 既読・対応ステータスの判定関数
  const isReadForMe = (a: any) => {
    if (!a || !extUser) return false;
    return a.readByExternal?.some((r: any) => (typeof r === 'string' ? r : r.userId) === extUser.id) || false;
  };

  const isActionedForMe = (a: any) => {
    if (!a || !extUser) return false;
    if (!a.requireAction) return true;
    const list = a.actionByExternal || [];
    const iActioned = list.some((r: any) => (typeof r === 'string' ? r : r.userId) === extUser.id);
    if (iActioned) return true;
    // 誰か1人の場合
    if (a.actionType === "single" && list.length > 0) return true;
    return false;
  };

  const toggleReadStatus = async (markAsRead: boolean) => {
    if (!activeNoticeId || !extUser) return;
    const a = announcements.find(x => x.id === activeNoticeId);
    if (!a) return;
    const currentList = a.readByExternal || [];
    let newList;
    if (markAsRead) {
      const newRecord = { userId: extUser.id, readAt: new Date().toISOString() };
      newList = [...currentList.filter((r: any) => (typeof r === 'string' ? r : r.userId) !== extUser.id), newRecord];
    } else {
      newList = currentList.filter((r: any) => (typeof r === 'string' ? r : r.userId) !== extUser.id);
    }
    try { await updateDoc(doc(db, "announcements", a.id), { readByExternal: newList }); } 
    catch (e) { showAlert("更新に失敗しました。"); }
  };

  const toggleActionStatus = async (markAsActioned: boolean) => {
    if (!activeNoticeId || !extUser) return;
    const a = announcements.find(x => x.id === activeNoticeId);
    if (!a) return;
    const currentList = a.actionByExternal || [];
    let newList;
    if (markAsActioned) {
      const newRecord = { userId: extUser.id, actionAt: new Date().toISOString() };
      newList = [...currentList.filter((r: any) => (typeof r === 'string' ? r : r.userId) !== extUser.id), newRecord];
    } else {
      newList = currentList.filter((r: any) => (typeof r === 'string' ? r : r.userId) !== extUser.id);
    }
    try { await updateDoc(doc(db, "announcements", a.id), { actionByExternal: newList }); } 
    catch (e) { showAlert("更新に失敗しました。"); }
  };

  const getStatusBadge = (a: any) => {
    const badges = [];
    if (a.requireAction) {
      if (isActionedForMe(a)) {
        badges.push(<span key="action" className="px-1 py-0.5 sm:px-1.5 rounded text-[7px] sm:text-[8px] font-bold bg-indigo-100 text-indigo-700 flex items-center shadow-2xs shrink-0"><CheckSquare className="w-2.5 h-2.5 mr-0.5" />対応済</span>);
      } else {
        badges.push(<span key="action" className="px-1 py-0.5 sm:px-1.5 rounded text-[7px] sm:text-[8px] font-bold bg-rose-100 text-rose-700 flex items-center shadow-2xs shrink-0"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />要対応</span>);
      }
    }
    return badges.length > 0 ? <div className="flex items-center mr-1">{badges}</div> : null;
  };

  const filteredAndSorted = useMemo(() => {
    const now = new Date().getTime();
    return announcements
      .filter(a => {
        const start = a.publishStartDate ? new Date(a.publishStartDate).getTime() : new Date(a.createdAt).getTime();
        const end = a.publishEndDate ? new Date(a.publishEndDate).getTime() : null;
        return start <= now && (!end || end >= now);
      })
      .filter(a => filterCategory === "all" || a.categoryId === filterCategory)
      .filter(a => {
        if (filterReadStatus === "all") return true;
        const read = isReadForMe(a);
        if (filterReadStatus === "read") return read;
        if (filterReadStatus === "unread") return !read;
        return true;
      })
      .filter(a => {
        if (filterActionStatus === "all") return true;
        if (!a.requireAction) return false;
        const actioned = isActionedForMe(a);
        if (filterActionStatus === "completed") return actioned;
        if (filterActionStatus === "incomplete") return !actioned;
        return true;
      })
      .filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.content.toLowerCase().includes(searchQuery.toLowerCase()) || a.authorName.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;

        const aNeedsAction = a.requireAction && !isActionedForMe(a);
        const bNeedsAction = b.requireAction && !isActionedForMe(b);
        if (aNeedsAction && !bNeedsAction) return -1;
        if (!aNeedsAction && bNeedsAction) return 1;

        const timeA = a.publishStartDate ? new Date(a.publishStartDate).getTime() : new Date(a.createdAt).getTime();
        const timeB = b.publishStartDate ? new Date(b.publishStartDate).getTime() : new Date(b.createdAt).getTime();
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
      });
  }, [announcements, filterCategory, filterReadStatus, filterActionStatus, searchQuery, sortOrder, extUser]);

  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (!isMobile && !activeNoticeId && filteredAndSorted.length > 0) {
      updateNoticeUrl(filteredAndSorted[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredAndSorted, activeNoticeId]);

  const handleLogout = () => {
    showConfirm("ログアウトしますか？", async () => {
      await signOut(auth);
      router.push("/ext-login");
    }, "warning", "ログアウトの確認");
  };

  const handleErrorReturn = () => {
    if (error === "このアプリの利用権限が付与されていません。") router.push("/ext-top");
    else signOut(auth).then(() => router.push("/ext-login"));
  };

  if (isLoading) return <LoadingScreen message="連絡事項を準備中..." />;

  if (error || !extUser) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-black text-gray-900 mb-2">アクセスできません</h1>
        <p className="text-sm font-bold text-gray-500 mb-6">{error}</p>
        <button onClick={handleErrorReturn} className="px-5 py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-transform hover:-translate-y-0.5 shadow-sm">
          <LogOut className="w-4 h-4"/> 戻る
        </button>
      </div>
    );
  }

  const c = COLOR_MAPPINGS[appConfig.color] || COLOR_MAPPINGS.default;

  const activeNotice = announcements.find(a => a.id === activeNoticeId);
  const activeCategory = categories.find(cat => cat.id === activeNotice?.categoryId);
  const activeAuthorUser = tenantUsers.find(u => u.id === activeNotice?.authorId);
  const activeAvatarUrl = activeAuthorUser?.photoURL || activeNotice?.authorPhotoURL;

  const isRead = isReadForMe(activeNotice);
  const isActioned = isActionedForMe(activeNotice);

  const formatTimeCompact = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${d.getMonth()+1}/${d.getDate()}`;
  };

  return (
    <div className="h-[100dvh] font-sans flex flex-col text-gray-900 bg-[#F9FAFB] relative overflow-hidden overscroll-none">
      
      <ExtHeader 
        schoolData={schoolData} 
        handleLogout={handleLogout} 
        appMeta={appConfig} 
        showBackButton={true} 
      />

      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col min-h-0 bg-white sm:bg-transparent">
        <div className="flex-1 overflow-hidden flex bg-white sm:shadow-sm sm:border-x border-gray-200 relative min-h-0">
          
          <div className={`w-full lg:w-[380px] xl:w-[420px] border-r border-gray-200 flex flex-col flex-shrink-0 bg-white h-full ${showMobileDetail ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-2 border-b border-gray-200 bg-gray-50/80 flex flex-col gap-1.5 shrink-0">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input 
                  type="text" placeholder="キーワード検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-8 pr-2 py-1.5 bg-white border border-gray-300 rounded-lg text-[16px] sm:text-xs font-bold focus:outline-none focus:ring-1 ${c.ring} shadow-2xs`}
                />
              </div>

              {/* ★ フィルター群のコンパクト化 */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 min-w-0">
                    <CustomSelect 
                      value={filterReadStatus} onChange={val => setFilterReadStatus(val as any)}
                      options={[ { value: "all", label: "既読: 全て" }, { value: "unread", label: "未読" }, { value: "read", label: "既読" } ]}
                      buttonClassName="w-full flex items-center justify-between bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-700 font-bold shadow-2xs focus:ring-1 focus:ring-blue-500 text-[10px] sm:text-[11px] h-7"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CustomSelect 
                      value={filterActionStatus} onChange={val => setFilterActionStatus(val as any)}
                      options={[ { value: "all", label: "対応: 全て" }, { value: "incomplete", label: "未対応" }, { value: "completed", label: "対応済" } ]}
                      buttonClassName="w-full flex items-center justify-between bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-700 font-bold shadow-2xs focus:ring-1 focus:ring-blue-500 text-[10px] sm:text-[11px] h-7"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 min-w-0">
                    <CustomSelect 
                      value={filterCategory} onChange={setFilterCategory}
                      options={[ { value: "all", label: "全カテゴリ" }, ...categories.map(cat => ({ value: cat.id, label: cat.name })) ]}
                      buttonClassName="w-full flex items-center justify-between bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-700 font-bold shadow-2xs focus:ring-1 focus:ring-blue-500 text-[10px] sm:text-[11px] h-7"
                    />
                  </div>
                  <div className="w-[100px] shrink-0">
                    <CustomSelect 
                      value={sortOrder} onChange={val => setSortOrder(val as any)}
                      options={[ { value: "desc", label: "新着順" }, { value: "asc", label: "古い順" } ]}
                      buttonClassName="w-full flex items-center justify-between bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-700 font-bold shadow-2xs focus:ring-1 focus:ring-blue-500 text-[10px] sm:text-[11px] h-7"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-gray-100 pb-20 lg:pb-0">
              {filteredAndSorted.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-gray-400 py-12 opacity-70">
                  <MessageSquareText className="w-6 h-6 mb-2" />
                  <p className="text-[10px] font-bold">該当する連絡はありません</p>
                </div>
              ) : (
                filteredAndSorted.map((a) => {
                  const isSelected = a.id === activeNoticeId;
                  const isUr = a.isUrgent;
                  const cat = categories.find(c => c.id === a.categoryId);
                  const authorUser = tenantUsers.find(u => u.id === a.authorId);
                  const avatarUrl = authorUser?.photoURL || a.authorPhotoURL;
                  const isReadMark = isReadForMe(a);

                  return (
                    <div 
                      key={a.id} 
                      onClick={() => { updateNoticeUrl(a.id); if (window.innerWidth < 1024) setShowMobileDetail(true); }}
                      className={`px-2.5 py-2 cursor-pointer flex items-center gap-2 min-w-0 transition-colors group ${isSelected && window.innerWidth >= 1024 ? (isUr ? 'bg-red-600 text-white' : `${c.bg} text-white shadow-inner`) : 'hover:bg-gray-50 text-gray-900'}`}
                    >
                      <div className="relative flex-shrink-0">
                        <UserAvatar name={a.authorName} url={avatarUrl} className="w-7 h-7 text-[9px]" />
                        {isUr && <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${isSelected && window.innerWidth >= 1024 ? 'bg-white' : 'bg-red-500'}`}></div>}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5">
                          <h4 className={`text-[11px] sm:text-xs font-bold truncate flex-1 ${isSelected && window.innerWidth >= 1024 ? 'text-white' : (!isReadMark ? 'text-gray-900 font-black' : 'text-gray-600 font-medium')}`}>
                            {a.title}
                          </h4>
                          {getStatusBadge(a)}
                          {a.attachments && a.attachments.length > 0 && <Paperclip className={`w-3 h-3 flex-shrink-0 ${isSelected && window.innerWidth >= 1024 ? 'text-white/70' : 'text-gray-400'}`} />}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] sm:text-[10px] truncate max-w-[80px] ${isSelected && window.innerWidth >= 1024 ? 'text-white/80' : 'text-gray-500'}`}>{a.authorName}</span>
                          {cat && <span className={`px-1.5 rounded-sm text-[8px] font-bold border truncate max-w-[60px] ${isSelected && window.innerWidth >= 1024 ? 'border-white/30 text-white/90' : cat.color}`}>{cat.name}</span>}
                        </div>
                      </div>

                      <div className={`w-10 text-right flex-shrink-0 flex flex-col items-end gap-1 ${isSelected && window.innerWidth >= 1024 ? 'text-white/90' : 'text-gray-400'}`}>
                        <span className="text-[9px] sm:text-[10px] font-medium">{formatTimeCompact(a.publishStartDate || a.createdAt)}</span>
                        {!isReadMark && <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm animate-pulse"></span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className={`flex-1 w-full h-full min-w-0 bg-white ${showMobileDetail ? 'block absolute inset-0 z-20' : 'hidden lg:flex flex-col'}`}>
            {!activeNotice ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/30 text-gray-400 p-6 text-center h-full">
                <div className={`p-4 ${c.lightBg} ${c.text} rounded-2xl mb-4 shadow-sm`}>
                  <DynamicIcon name={appConfig.icon} className="w-10 h-10" />
                </div>
                <h3 className="text-sm font-black text-gray-700 mb-1">連絡事項が選択されていません</h3>
                <p className="text-[11px] font-bold text-gray-400">左側のリストから項目を選択すると、ここに詳細が表示されます。</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col h-full bg-white relative pb-24 lg:pb-0">
                
                <div className="lg:hidden flex items-center px-3 py-2.5 border-b border-gray-100 bg-white sticky top-0 z-20 shrink-0">
                  <button onClick={() => { setShowMobileDetail(false); updateNoticeUrl(null); }} className="flex items-center text-[11px] sm:text-sm font-bold text-gray-500 hover:text-gray-900 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg transition-colors">
                    <ChevronLeft className="w-4 h-4 mr-0.5" /> 戻る
                  </button>
                </div>

                <div className="p-4 sm:p-6 border-b border-gray-100 shrink-0">
                  <div className="flex justify-between items-start mb-4 gap-4">
                    <h2 className="text-lg sm:text-xl font-black text-gray-900 leading-snug break-words flex-1">
                      {activeNotice.isUrgent && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-red-600 text-white shadow-xs mr-2 align-middle"><AlertOctagon className="w-3 h-3 mr-0.5" /> 緊急</span>}
                      {getStatusBadge(activeNotice)}
                      <span className="ml-1 leading-normal">{activeNotice.title}</span>
                    </h2>
                  </div>

                  <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100 w-fit">
                    <UserAvatar name={activeNotice.authorName} url={activeAvatarUrl} className="w-10 h-10 text-sm" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-gray-900">{activeNotice.authorName}</span>
                        {activeCategory && <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${activeCategory.color}`}>{activeCategory.name}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 mt-0.5">
                        <Calendar className="w-3 h-3" /> 掲載: {new Date(activeNotice.publishStartDate || activeNotice.createdAt).toLocaleString('ja-JP')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6 flex-1">
                  <div 
                    className="text-[13px] sm:text-sm text-gray-800 leading-loose break-words [&_a]:text-blue-600 [&_a]:underline [&_b]:font-black [&_i]:italic [&_u]:underline [&_font[size='2']]:text-xs [&_font[size='3']]:text-sm [&_font[size='5']]:text-xl [&_font[size='7']]:text-3xl [&_span[style*='background-color']]:px-1.5 [&_span[style*='background-color']]:py-0.5 [&_span[style*='background-color']]:rounded-md"
                    dangerouslySetInnerHTML={{ __html: activeNotice.content }}
                  />
                </div>

                {activeNotice.attachments && activeNotice.attachments.length > 0 && (
                  <div className="p-4 sm:p-5 bg-gray-50/50 border-t border-gray-100 shrink-0">
                    <h5 className="text-[10px] sm:text-xs font-black text-gray-600 mb-2 flex items-center"><Paperclip className="w-3.5 h-3.5 mr-1"/> 添付ファイル</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl">
                      {activeNotice.attachments.map((file: any, idx: number) => (
                        <a 
                          key={idx} href={file.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/30 transition-all group shadow-sm"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg"><FileIcon className="w-3.5 h-3.5" /></div>
                            <span className="text-[11px] font-bold text-gray-700 group-hover:text-blue-700 truncate">{file.name}</span>
                          </div>
                          <Download className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-600 flex-shrink-0 ml-2" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* ★ アクション領域 (既読 / 対応) */}
                <div className="p-3 sm:p-5 border-t border-gray-100 bg-gray-50/50 mt-auto shrink-0 z-10 sticky bottom-0">
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch justify-center max-w-lg mx-auto">
                    
                    {/* 既読ブロック */}
                    <div className="flex-1 bg-white rounded-xl p-2.5 sm:p-3 flex items-center justify-between border border-gray-200 shadow-sm">
                      <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-wider shrink-0 mr-2">確認状況</span>
                      {isRead ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-[10px] sm:text-xs font-black text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-emerald-100 shadow-2xs">
                            <Check className="w-3.5 h-3.5" /> 確認済み
                          </span>
                          <button onClick={() => toggleReadStatus(false)} className="p-1 sm:p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200" title="未読に戻す">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => toggleReadStatus(true)} className={`w-full sm:w-auto px-4 py-1.5 sm:py-2 text-white rounded-lg text-[10px] sm:text-xs font-black shadow-md transition-transform hover:-translate-y-0.5 flex items-center justify-center gap-1.5 ${c.bg} ${c.hover}`}>
                          <BookOpen className="w-3.5 h-3.5" /> 既読にする
                        </button>
                      )}
                    </div>

                    {/* 対応ブロック */}
                    {activeNotice.requireAction && (
                      <div className="flex-1 bg-white rounded-xl p-2.5 sm:p-3 flex items-center justify-between border border-indigo-200 shadow-sm relative overflow-hidden">
                        {activeNotice.actionType === "single" && <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-bl-lg shadow-sm">代表者対応で完了</div>}
                        <span className="text-[9px] sm:text-[10px] font-black text-indigo-400 uppercase tracking-wider shrink-0 mr-2">タスク</span>
                        
                        {isActioned ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[10px] sm:text-xs font-black text-indigo-600 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-indigo-200 shadow-2xs">
                              <CheckSquare className="w-3.5 h-3.5"/> 対応済み
                            </span>
                            <button onClick={() => toggleActionStatus(false)} className="p-1 sm:p-1.5 text-indigo-300 hover:bg-indigo-50 hover:text-indigo-500 rounded-lg transition-colors border border-transparent hover:border-indigo-100" title="未対応に戻す">
                              <XCircle className="w-4 h-4"/>
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => toggleActionStatus(true)} className="w-full sm:w-auto px-4 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] sm:text-xs font-black shadow-md transition-transform hover:-translate-y-0.5 flex items-center justify-center gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5" /> 対応済にする
                          </button>
                        )}
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

export default function ExternalBoardMainPage() {
  return (
    <Suspense fallback={
      <div className="h-[100dvh] flex justify-center items-center bg-gray-50">
        <LoadingScreen />
      </div>
    }>
      <ExternalBoardContent />
    </Suspense>
  );
}