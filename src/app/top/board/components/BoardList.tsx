"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import * as LucideIcons from "lucide-react";
import { Search, AlertOctagon, Paperclip, Download, FileIcon, MessageSquareText, Calendar, ArrowDownUp, Clock, ChevronLeft, Globe, Check, Users, BookOpen, XCircle, CheckSquare, AlertCircle } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Announcement, Category, UserData, AppConfig, COLOR_MAPPINGS } from "../types";
import { ExternalUser } from "@/app/types/external";
import CustomSelect from "@/components/CustomSelect";

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

type Props = {
  announcements: Announcement[];
  categories: Category[];
  userData: UserData | null;
  tenantUsers: UserData[]; 
  appConfig: AppConfig;
  isExternalTab: boolean; 
  externalUsers?: ExternalUser[];
};

export default function BoardList({ announcements, categories, userData, tenantUsers, appConfig, isExternalTab, externalUsers = [] }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlId = searchParams.get("id");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [filterRequireAction, setFilterRequireAction] = useState(false);
  const [filterActionStatus, setFilterActionStatus] = useState<"all" | "completed" | "incomplete">("all");
  const [filterReadStatus, setFilterReadStatus] = useState<"all" | "read" | "unread">("all");
  
  const [sortBy, setSortBy] = useState<"urgent_first" | "date">("urgent_first");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const [selectedId, setSelectedId] = useState<string | null>(urlId || null);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  const c = COLOR_MAPPINGS[appConfig.color] || COLOR_MAPPINGS.default;
  const now = new Date().getTime();

  useEffect(() => {
    if (urlId && urlId !== selectedId) {
      setSelectedId(urlId);
    }
  }, [urlId]);

  const isActive = (a: Announcement) => {
    const start = a.publishStartDate ? new Date(a.publishStartDate).getTime() : new Date(a.createdAt).getTime();
    const end = a.publishEndDate ? new Date(a.publishEndDate).getTime() : null;
    return start <= now && (!end || end >= now);
  };

  const isTargetUser = (a: Announcement) => {
    if (!userData) return false;
    const isExtUser = "category" in userData;
    
    if (isExtUser) {
      if (!a.isExternal) return false;
      if (a.extTargetType === "individual") return a.extTargetUserIds?.includes(userData.id) || false;
      return true;
    } else {
      if (a.isInternalAlso === false) return false;
      if (a.targetType === "individual") return a.targetUserIds?.includes(userData.id) || false;
      
      if (a.targetType === "position") {
        const u = userData as UserData;
        const myU = tenantUsers.find(tu => tu.id === u.id); 
        const pIds = a.targetPositionIds || [];
        
        if (pIds.includes("sys_admin") && (u.role === "admin" || u.role === "system_admin" || u.isITManager)) return true;
        if (pIds.includes("sys_student") && u.role === "student") return true;
        if (pIds.includes("sys_teacher") && u.role === "teacher") return true;
        if (myU?.positionIds?.some(pid => pIds.includes(pid))) return true;
        
        return false;
      }
      return true; 
    }
  };

  const isReadForMe = (a: Announcement | undefined) => {
    if (!a || !userData) return false;
    const isExtUser = "category" in userData;
    const list = isExtUser ? a.readByExternal : a.readByInternal;
    return list?.some((r: any) => (typeof r === 'string' ? r : r.userId) === userData.id) || false;
  };

  const isActionedForMe = (a: Announcement | undefined) => {
    if (!a || !userData) return false;
    if (!a.requireAction) return true;
    const isExtUser = "category" in userData;
    const list = isExtUser ? a.actionByExternal : a.actionByInternal;
    const iActioned = list?.some((r: any) => (typeof r === 'string' ? r : r.userId) === userData.id) || false;
    if (iActioned) return true;
    
    if (a.actionType === "single") {
      const intActioned = (a.actionByInternal?.length || 0) > 0;
      const extActioned = (a.actionByExternal?.length || 0) > 0;
      if (intActioned || extActioned) return true;
    }
    return false;
  };

  const getStatusBadge = (a: Announcement) => {
    const badges = [];
    if (a.requireAction) {
      if (isActionedForMe(a)) {
        badges.push(<span key="action" className="px-1 py-0.5 sm:px-1.5 rounded text-[7px] sm:text-[8px] font-bold bg-indigo-100 text-indigo-700 flex items-center mr-1 shadow-2xs"><CheckSquare className="w-2.5 h-2.5 mr-0.5" />対応済</span>);
      } else {
        badges.push(<span key="action" className="px-1 py-0.5 sm:px-1.5 rounded text-[7px] sm:text-[8px] font-bold bg-rose-100 text-rose-700 flex items-center mr-1 shadow-2xs"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />要対応</span>);
      }
    }
    if (!isExternalTab && a.isExternal) {
      badges.push(<span key="ext" className="px-1 py-0.5 sm:px-1.5 rounded text-[7px] sm:text-[8px] font-bold bg-blue-100 text-blue-700 flex items-center mr-1 shadow-2xs"><Globe className="w-2.5 h-2.5 mr-0.5" />外部公開</span>);
    }
    if (isExternalTab && a.isInternalAlso !== false) {
      badges.push(<span key="int" className="px-1 py-0.5 sm:px-1.5 rounded text-[7px] sm:text-[8px] font-bold bg-indigo-100 text-indigo-700 flex items-center mr-1 shadow-2xs"><Users className="w-2.5 h-2.5 mr-0.5" />メンバー公開</span>);
    }
    return badges.length > 0 ? <div className="flex items-center">{badges}</div> : null;
  };

  const filteredAndSorted = announcements
    .filter(a => isActive(a)) 
    .filter(a => isTargetUser(a)) 
    .filter(a => filterCategory === "all" || a.categoryId === filterCategory)
    .filter(a => !filterUrgent || a.isUrgent)
    .filter(a => !filterRequireAction || a.requireAction)
    .filter(a => {
      if (filterActionStatus === "all") return true;
      if (!a.requireAction) return false;
      const completed = isActionedForMe(a);
      if (filterActionStatus === "completed") return completed;
      if (filterActionStatus === "incomplete") return !completed;
      return true;
    })
    .filter(a => {
      if (filterReadStatus === "all") return true;
      const read = isReadForMe(a);
      if (filterReadStatus === "read") return read;
      if (filterReadStatus === "unread") return !read;
      return true;
    })
    .filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.content.toLowerCase().includes(searchQuery.toLowerCase()) || a.authorName.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "urgent_first") {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
      }
      const timeA = a.publishStartDate ? new Date(a.publishStartDate).getTime() : new Date(a.createdAt).getTime();
      const timeB = b.publishStartDate ? new Date(b.publishStartDate).getTime() : new Date(b.createdAt).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });

  const handleSelectAnnouncement = (id: string) => {
    setSelectedId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    if (window.innerWidth < 1024) {
      setShowMobileDetail(true);
    }
  };

  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (!isMobile && filteredAndSorted.length > 0) {
      if (!selectedId || !filteredAndSorted.find(a => a.id === selectedId)) {
         handleSelectAnnouncement(filteredAndSorted[0].id);
      }
    }
  }, [filteredAndSorted, selectedId]);

  const selectedAnnouncement = filteredAndSorted.find(a => a.id === selectedId);

  const toggleReadStatus = async (markAsRead: boolean) => {
    if (!selectedAnnouncement || !userData) return;
    const isExtUser = "category" in userData;
    const field = isExtUser ? "readByExternal" : "readByInternal";
    const currentList = selectedAnnouncement[field as keyof Announcement] as any[] || [];
    
    let newList;
    if (markAsRead) {
      const newRecord = { userId: userData.id, readAt: new Date().toISOString() };
      newList = [...currentList.filter((r: any) => (typeof r === 'string' ? r : r.userId) !== userData.id), newRecord];
    } else {
      newList = currentList.filter((r: any) => (typeof r === 'string' ? r : r.userId) !== userData.id);
    }
    try { await updateDoc(doc(db, "announcements", selectedAnnouncement.id), { [field]: newList }); } 
    catch (e) { console.error(e); }
  };

  const toggleActionStatus = async (markAsActioned: boolean) => {
    if (!selectedAnnouncement || !userData) return;
    const isExtUser = "category" in userData;
    const field = isExtUser ? "actionByExternal" : "actionByInternal";
    const currentList = selectedAnnouncement[field as keyof Announcement] as any[] || [];
    
    let newList;
    if (markAsActioned) {
      const newRecord = { userId: userData.id, actionAt: new Date().toISOString() };
      newList = [...currentList.filter((r: any) => (typeof r === 'string' ? r : r.userId) !== userData.id), newRecord];
    } else {
      newList = currentList.filter((r: any) => (typeof r === 'string' ? r : r.userId) !== userData.id);
    }
    try { await updateDoc(doc(db, "announcements", selectedAnnouncement.id), { [field]: newList }); } 
    catch (e) { console.error(e); }
  };

  const isRead = useMemo(() => isReadForMe(selectedAnnouncement), [selectedAnnouncement, userData]);
  const isActioned = useMemo(() => isActionedForMe(selectedAnnouncement), [selectedAnnouncement, userData]);

  const isTaskCompletedBySomeone = selectedAnnouncement?.actionType === "single" && 
                                   (((selectedAnnouncement.actionByInternal?.length || 0) > 0) || ((selectedAnnouncement.actionByExternal?.length || 0) > 0));

  const formatTimeCompact = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${d.getMonth()+1}/${d.getDate()}`;
  };

  const renderDetailView = () => {
    if (!selectedAnnouncement) {
      return (
        <div className={`flex-1 flex flex-col items-center justify-center bg-gray-50/30 text-gray-400 p-6 text-center h-full ${isExternalTab ? 'bg-blue-50/20' : ''}`}>
          <div className={`p-4 rounded-2xl mb-4 shadow-sm ${isExternalTab ? 'bg-blue-100 text-blue-600' : `${c.lightBg} ${c.text}`}`}>
            <DynamicIcon name={appConfig.icon} className="w-10 h-10" />
          </div>
          <h3 className="text-sm font-black text-gray-700 mb-1">連絡事項が選択されていません</h3>
          <p className="text-[11px] font-bold text-gray-400">左側のリストから項目を選択すると、ここに詳細が表示されます。</p>
        </div>
      );
    }

    const selectedCategory = categories.find(cat => cat.id === selectedAnnouncement?.categoryId);
    const selectedAuthorUser = tenantUsers.find(u => u.id === selectedAnnouncement?.authorId);
    const selectedAvatarUrl = selectedAuthorUser?.photoURL;

    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col h-full bg-white relative pb-6 sm:pb-0">
        <div className="lg:hidden flex items-center px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-100 bg-white sticky top-0 z-10 shrink-0">
          <button 
            onClick={() => setShowMobileDetail(false)} 
            className="flex items-center text-[11px] sm:text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors bg-gray-50 px-2 py-1 rounded-lg border border-gray-200"
          >
            <ChevronLeft className="w-4 h-4 mr-0.5" /> 戻る
          </button>
        </div>

        <div className="p-4 sm:p-6 border-b border-gray-100 shrink-0">
          <div className="flex justify-between items-start mb-3 sm:mb-4 gap-3 sm:gap-4">
            <h2 className="text-[15px] sm:text-lg lg:text-xl font-black text-gray-900 leading-snug break-words flex-1">
              {selectedAnnouncement.isUrgent && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-red-600 text-white shadow-2xs mr-1.5 align-middle"><AlertOctagon className="w-3 h-3 mr-0.5" /> 緊急</span>}
              {getStatusBadge(selectedAnnouncement)}
              <span className="ml-1 leading-normal">{selectedAnnouncement.title}</span>
            </h2>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
            <div className="flex items-center gap-2.5 sm:gap-3 bg-gray-50 p-2 sm:p-2.5 rounded-xl border border-gray-100 shadow-2xs">
              <UserAvatar name={selectedAnnouncement.authorName} url={selectedAvatarUrl} className="w-8 h-8 sm:w-10 sm:h-10 text-xs sm:text-sm" />
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-[11px] sm:text-sm font-black text-gray-900">{selectedAnnouncement.authorName}</span>
                  {selectedCategory && <span className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold border ${selectedCategory.color}`}>{selectedCategory.name}</span>}
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] font-bold text-gray-400 mt-0.5">
                  <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> 掲載: {new Date(selectedAnnouncement.publishStartDate || selectedAnnouncement.createdAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 flex-1">
          <div 
            className="text-[13px] sm:text-sm text-gray-800 leading-relaxed sm:leading-loose break-words [&_a]:text-blue-600 [&_a]:underline [&_b]:font-black [&_i]:italic [&_u]:underline [&_font[size='2']]:text-[10px] sm:[&_font[size='2']]:text-xs [&_font[size='3']]:text-xs sm:[&_font[size='3']]:text-sm [&_font[size='5']]:text-lg sm:[&_font[size='5']]:text-xl [&_font[size='7']]:text-2xl sm:[&_font[size='7']]:text-3xl [&_span[style*='background-color']]:px-1.5 [&_span[style*='background-color']]:py-0.5 [&_span[style*='background-color']]:rounded-md"
            dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content }}
          />
        </div>

        {selectedAnnouncement.attachments && selectedAnnouncement.attachments.length > 0 && (
          <div className="p-3 sm:p-4 bg-gray-50/50 border-t border-gray-100 shrink-0">
            <h5 className="text-[10px] sm:text-xs font-black text-gray-500 mb-2 flex items-center"><Paperclip className="w-3.5 h-3.5 mr-1"/> 添付ファイル</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-w-2xl">
              {selectedAnnouncement.attachments.map((file, idx) => (
                <a 
                  key={idx} href={file.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 sm:p-2.5 bg-white border border-gray-200 rounded-lg sm:rounded-xl hover:border-blue-400 hover:bg-blue-50/30 transition-all group shadow-2xs"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg"><FileIcon className="w-3.5 h-3.5" /></div>
                    <span className="text-[10px] sm:text-[11px] font-bold text-gray-700 group-hover:text-blue-700 truncate">{file.name}</span>
                  </div>
                  <Download className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-600 flex-shrink-0 ml-1.5 transition-colors" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 外部タブ（プレビュー用）の場合はアクションボタンを表示しない */}
        {!isExternalTab && (
          <div className="p-3 sm:p-5 border-t border-gray-100 bg-gray-50/30 mt-auto shrink-0 z-10 sticky bottom-0">
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
              {selectedAnnouncement.requireAction && (
                <div className="flex-1 bg-white rounded-xl p-2.5 sm:p-3 flex items-center justify-between border border-indigo-200 shadow-sm relative overflow-hidden">
                  {selectedAnnouncement.actionType === "single" && <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-bl-lg shadow-sm">1人対応で完了</div>}
                  <span className="text-[9px] sm:text-[10px] font-black text-indigo-400 uppercase tracking-wider shrink-0 mr-2">対応状況</span>
                  
                  {isActioned ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-[10px] sm:text-xs font-black text-indigo-600 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-indigo-200 shadow-2xs">
                        <CheckSquare className="w-3.5 h-3.5"/> 対応済み
                      </span>
                      <button onClick={() => toggleActionStatus(false)} className="p-1 sm:p-1.5 text-indigo-300 hover:bg-indigo-50 hover:text-indigo-500 rounded-lg transition-colors border border-transparent hover:border-indigo-100" title="未対応に戻す">
                        <XCircle className="w-4 h-4"/>
                      </button>
                    </div>
                  ) : (isTaskCompletedBySomeone ? (
                    <span className="text-[10px] sm:text-xs font-black text-gray-500 flex items-center gap-1 bg-gray-50 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-gray-200 shadow-2xs">
                      <CheckSquare className="w-3.5 h-3.5"/> メンバーが対応済
                    </span>
                  ) : (
                    <button onClick={() => toggleActionStatus(true)} className="w-full sm:w-auto px-4 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] sm:text-xs font-black shadow-md transition-transform hover:-translate-y-0.5 flex items-center justify-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5" /> 対応済にする
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-white relative overflow-hidden">
      
      <div className={`w-full lg:w-[320px] xl:w-[400px] border-r border-gray-200 flex flex-col flex-shrink-0 bg-white h-full ${showMobileDetail ? 'hidden lg:flex' : 'flex'}`}>
        
        {isExternalTab && (
          <div className="bg-blue-50 p-2 sm:p-3 border-b border-blue-100 shrink-0 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="text-[9px] sm:text-[10px] font-bold text-blue-800 leading-snug">
              ここは外部ユーザー（ゲスト）のダッシュボードに配信されている連絡事項の一覧です。（プレビュー専用）
            </p>
          </div>
        )}

        <div className="p-2 border-b border-gray-200 bg-gray-50/50 flex flex-col gap-1.5 sm:gap-2 shrink-0">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input 
              type="text" placeholder="検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] sm:text-xs font-bold focus:outline-none focus:ring-2 ${isExternalTab ? 'focus:ring-blue-500' : c.ring} shadow-2xs`}
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-1 text-[10px]">
            <div className="flex-1 min-w-[90px]">
              <CustomSelect 
                value={filterReadStatus} onChange={val => setFilterReadStatus(val as any)}
                options={[
                  { value: "all", label: "既読状況: 全て" },
                  { value: "unread", label: "未読のみ" },
                  { value: "read", label: "既読のみ" }
                ]}
                buttonClassName="w-full flex items-center justify-between bg-white border border-gray-200 rounded-md px-2 py-1 text-gray-700 font-bold shadow-2xs focus:ring-2 focus:ring-indigo-500 text-[9px] sm:text-[10px]"
              />
            </div>
            <div className="flex-1 min-w-[90px]">
              <CustomSelect 
                value={filterActionStatus} onChange={val => setFilterActionStatus(val as any)}
                options={[
                  { value: "all", label: "対応状況: 全て" },
                  { value: "incomplete", label: "未対応のみ" },
                  { value: "completed", label: "対応済のみ" }
                ]}
                buttonClassName="w-full flex items-center justify-between bg-white border border-gray-200 rounded-md px-2 py-1 text-gray-700 font-bold shadow-2xs focus:ring-2 focus:ring-indigo-500 text-[9px] sm:text-[10px]"
              />
            </div>
            <div className="flex-1 min-w-[90px]">
              <CustomSelect 
                value={filterCategory} onChange={setFilterCategory}
                options={[
                  { value: "all", label: "全カテゴリ" },
                  ...categories.map(cat => ({ value: cat.id, label: cat.name }))
                ]}
                buttonClassName="w-full flex items-center justify-between bg-white border border-gray-200 rounded-md px-2 py-1 text-gray-700 font-bold shadow-2xs focus:ring-2 focus:ring-indigo-500 text-[9px] sm:text-[10px]"
              />
            </div>
            <div className="flex-1 min-w-[95px]">
              <CustomSelect 
                value={sortBy} onChange={val => setSortBy(val as any)}
                options={[
                  { value: "urgent_first", label: "緊急を優先" },
                  { value: "date", label: "掲載日時順" }
                ]}
                buttonClassName="w-full flex items-center justify-between bg-white border border-gray-200 rounded-md px-2 py-1 text-gray-700 font-bold shadow-2xs focus:ring-2 focus:ring-indigo-500 text-[9px] sm:text-[10px]"
              />
            </div>
            
            <button onClick={() => setFilterRequireAction(!filterRequireAction)} className={`p-1 rounded-md transition-colors flex items-center justify-center shadow-2xs ${filterRequireAction ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`} title="要対応のみ表示">
              <CheckSquare className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setFilterUrgent(!filterUrgent)} className={`p-1 rounded-md transition-colors flex items-center justify-center shadow-2xs ${filterUrgent ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`} title="緊急のみ表示">
              <AlertOctagon className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")} className="p-1 bg-white border border-gray-200 text-gray-400 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center shadow-2xs" title="並び替え">
              <ArrowDownUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-gray-100">
          {filteredAndSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-gray-400 py-10 opacity-70">
              <MessageSquareText className="w-5 h-5 mb-2" />
              <p className="text-[9px] font-bold">該当する連絡はありません</p>
            </div>
          ) : (
            filteredAndSorted.map((a) => {
              const isSelected = a.id === selectedId;
              const isUr = a.isUrgent;
              const cat = categories.find(c => c.id === a.categoryId);
              const authorUser = tenantUsers.find(u => u.id === a.authorId);
              const avatarUrl = authorUser?.photoURL;
              const statusBadge = getStatusBadge(a);

              const isReadMark = isReadForMe(a);

              return (
                <div 
                  key={a.id} onClick={() => handleSelectAnnouncement(a.id)}
                  className={`px-2.5 sm:px-3 py-2 sm:py-2.5 cursor-pointer flex items-center gap-2 min-w-0 transition-colors group ${isSelected && window.innerWidth >= 1024 ? (isUr ? 'bg-red-600 text-white' : (isExternalTab ? 'bg-blue-600 text-white shadow-inner' : `${c.bg} text-white shadow-inner`)) : 'hover:bg-gray-50 text-gray-900'}`}
                >
                  <div className="relative flex-shrink-0">
                    <UserAvatar name={a.authorName} url={avatarUrl} className={`w-6 h-6 sm:w-7 sm:h-7 text-[9px]`} />
                    {isUr && <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${isSelected && window.innerWidth >= 1024 ? 'bg-white' : 'bg-red-500'}`}></div>}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5">
                      <h4 className={`text-[11px] sm:text-xs font-bold truncate flex-1 ${isSelected && window.innerWidth >= 1024 ? 'text-white' : (!isReadMark && !isExternalTab ? 'text-gray-900 font-black' : 'text-gray-600 font-medium')}`}>{a.title}</h4>
                      {statusBadge}
                      {a.attachments && a.attachments.length > 0 && <Paperclip className={`w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0 ${isSelected && window.innerWidth >= 1024 ? 'text-white/70' : 'text-gray-400'}`} />}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                      <span className={`text-[9px] sm:text-[10px] truncate max-w-[80px] ${isSelected && window.innerWidth >= 1024 ? 'text-white/80' : 'text-gray-500'}`}>{a.authorName}</span>
                      {cat && <span className={`px-1 rounded-sm text-[8px] sm:text-[9px] font-bold border truncate max-w-[50px] sm:max-w-[60px] ${isSelected && window.innerWidth >= 1024 ? 'border-white/30 text-white/90' : cat.color}`}>{cat.name}</span>}
                    </div>
                  </div>

                  <div className={`w-10 sm:w-12 text-right flex-shrink-0 text-[9px] sm:text-[10px] font-medium flex flex-col items-end gap-1 ${isSelected && window.innerWidth >= 1024 ? 'text-white/90' : 'text-gray-400'}`}>
                    {formatTimeCompact(a.publishStartDate || a.createdAt)}
                    {!isReadMark && !isExternalTab && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm animate-pulse"></span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className={`flex-1 w-full h-full min-w-0 bg-white ${showMobileDetail ? 'block absolute inset-0 z-20' : 'hidden lg:flex flex-col'}`}>
        {renderDetailView()}
      </div>
    </div>
  );
}