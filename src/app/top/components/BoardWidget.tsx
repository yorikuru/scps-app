"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ChevronRight, Paperclip, AlertOctagon, Globe, CheckSquare, BookOpen, AlertCircle, X, Download, FileIcon, Calendar, Link as LinkIcon, User as UserIcon } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { SchoolData, UserData } from "../page";
import { onAuthStateChanged } from "firebase/auth";

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

const UserAvatar = ({ name, url, className = "w-4 h-4 text-[8px]" }: { name: string, url?: string, className?: string }) => {
  return url ? (
    <img src={url} alt={name} className={`${className} rounded-full object-cover shadow-2xs flex-shrink-0 border border-gray-100 bg-white`} />
  ) : (
    <div className={`${className} rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-2xs`}>
      {name.charAt(0)}
    </div>
  );
};

type Props = {
  schoolData: SchoolData | null;
  boardApp: any;
  boardC: any;
  tenantUsers: UserData[]; 
  userData?: UserData | null; 
};

export default function BoardWidget({ schoolData, boardApp, boardC, tenantUsers, userData: propsUserData }: Props) {
  const router = useRouter();
  const [boardAnnouncements, setBoardAnnouncements] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [userData, setUserData] = useState<UserData | null>(propsUserData || null);
  const [filterMode, setFilterMode] = useState<"all" | "unread" | "action_req">("all");
  const [selectedNotice, setSelectedNotice] = useState<any | null>(null);

  useEffect(() => {
    if (!propsUserData) {
      const unsub = onAuthStateChanged(auth, async (user) => {
        if (user) {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) setUserData({ id: user.uid, ...snap.data() } as UserData);
        }
      });
      return () => unsub();
    } else {
      setUserData(propsUserData);
    }
  }, [propsUserData]);

  useEffect(() => {
    if (!schoolData) return;
    
    const qBoard = query(collection(db, "announcements"), where("schoolId", "==", schoolData.id), orderBy("createdAt", "desc"));
    const unsubBoard = onSnapshot(qBoard, (snapshot) => {
      const fetched: any[] = [];
      snapshot.forEach(d => { 
        const data = d.data(); 
        fetched.push({ 
          id: d.id, 
          ...data, 
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          attachments: data.attachments || [],
        }); 
      });
      setBoardAnnouncements(fetched);
    });

    const qCat = query(collection(db, "board_categories"), where("schoolId", "==", schoolData.id));
    const unsubCat = onSnapshot(qCat, (snapshot) => {
      setCategories(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
    });

    return () => { unsubBoard(); unsubCat(); };
  }, [schoolData]);

  if (!boardApp || !userData) return null;

  const isTargetUser = (a: any) => {
    if (a.isInternalAlso === false) return false;
    if (a.targetType === "individual") return a.targetUserIds?.includes(userData.id) || false;
    
    if (a.targetType === "position") {
      const pIds = a.targetPositionIds || [];
      if (pIds.includes("sys_admin") && (userData.role === "admin" || userData.role === "system_admin" || (userData as any).isITManager)) return true;
      if (pIds.includes("sys_student") && userData.role === "student") return true;
      if (pIds.includes("sys_teacher") && userData.role === "teacher") return true;
      if ((userData as any).positionIds?.some((pid:string) => pIds.includes(pid))) return true;
      return false;
    }
    return true; 
  };

  const isReadForMe = (a: any) => {
    if (!a) return false;
    const list = a.readByInternal || [];
    return list.some((r: any) => (typeof r === 'string' ? r : r.userId) === userData.id);
  };

  const isActionedForMe = (a: any) => {
    if (!a || !a.requireAction) return true;
    const list = a.actionByInternal || [];
    const iActioned = list.some((r: any) => (typeof r === 'string' ? r : r.userId) === userData.id);
    if (iActioned) return true;
    
    if (a.actionType === "single") {
      const intActioned = (a.actionByInternal?.length || 0) > 0;
      const extActioned = (a.actionByExternal?.length || 0) > 0;
      if (intActioned || extActioned) return true;
    }
    return false;
  };

  const toggleReadStatus = async (a: any, markAsRead: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const field = "readByInternal";
    const currentList = a[field] || [];
    let newList;
    if (markAsRead) {
      const newRecord = { userId: userData.id, readAt: new Date().toISOString() };
      newList = [...currentList.filter((r: any) => (typeof r === 'string' ? r : r.userId) !== userData.id), newRecord];
    } else {
      newList = currentList.filter((r: any) => (typeof r === 'string' ? r : r.userId) !== userData.id);
    }
    try { 
      await updateDoc(doc(db, "announcements", a.id), { [field]: newList }); 
      setSelectedNotice((prev: any) => prev?.id === a.id ? { ...prev, [field]: newList } : prev);
    } catch (err) { console.error(err); }
  };

  const toggleActionStatus = async (a: any, markAsActioned: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const field = "actionByInternal";
    const currentList = a[field] || [];
    let newList;
    if (markAsActioned) {
      const newRecord = { userId: userData.id, actionAt: new Date().toISOString() };
      newList = [...currentList.filter((r: any) => (typeof r === 'string' ? r : r.userId) !== userData.id), newRecord];
    } else {
      newList = currentList.filter((r: any) => (typeof r === 'string' ? r : r.userId) !== userData.id);
    }
    try { 
      await updateDoc(doc(db, "announcements", a.id), { [field]: newList }); 
      setSelectedNotice((prev: any) => prev?.id === a.id ? { ...prev, [field]: newList } : prev);
    } catch (err) { console.error(err); }
  };

  const now = new Date().getTime();

  const activeAnnouncements = boardAnnouncements
    .filter(a => {
      const start = a.publishStartDate ? new Date(a.publishStartDate).getTime() : new Date(a.createdAt).getTime();
      const end = a.publishEndDate ? new Date(a.publishEndDate).getTime() : null;
      return start <= now && (!end || end >= now);
    })
    .filter(isTargetUser)
    .filter(a => {
      if (filterMode === "unread") return !isReadForMe(a);
      if (filterMode === "action_req") return a.requireAction && !isActionedForMe(a);
      return true;
    })
    .sort((a, b) => {
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;

      const aNeedsAction = a.requireAction && !isActionedForMe(a);
      const bNeedsAction = b.requireAction && !isActionedForMe(b);
      if (aNeedsAction && !bNeedsAction) return -1;
      if (!aNeedsAction && bNeedsAction) return 1;

      const timeA = a.publishStartDate ? new Date(a.publishStartDate).getTime() : new Date(a.createdAt).getTime();
      const timeB = b.publishStartDate ? new Date(b.publishStartDate).getTime() : new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

  const selectedAuthorUser = selectedNotice ? tenantUsers.find(u => u.id === selectedNotice.authorId) : null;
  const selectedAvatarUrl = selectedAuthorUser?.photoURL || selectedNotice?.authorPhotoURL;
  const selectedCategory = categories.find(cat => cat.id === selectedNotice?.categoryId);

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-w-0 max-h-[400px]">
        <div className="px-3.5 py-2.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
          <h2 className="text-xs sm:text-sm font-black text-gray-900 flex items-center gap-1.5 truncate">
            <DynamicIcon name={boardApp.icon} className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${boardC.iconText}`} /> 
            {boardApp.displayName || "連絡事項"}
          </h2>
          <Link href={boardApp.path} className={`px-2.5 py-1 ${boardC.lightBg} ${boardC.text} ${boardC.hoverBg} rounded-lg text-[10px] font-bold flex items-center transition-colors flex-shrink-0`}>
            すべて見る <ChevronRight className="w-3 h-3 ml-0.5" />
          </Link>
        </div>

        <div className="flex gap-1.5 p-1.5 bg-gray-50/50 border-b border-gray-100 shrink-0 overflow-x-auto custom-scrollbar">
          <button onClick={() => setFilterMode("all")} className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border shadow-2xs whitespace-nowrap transition-colors ${filterMode === "all" ? 'bg-gray-800 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}>すべて</button>
          <button onClick={() => setFilterMode("unread")} className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border shadow-2xs whitespace-nowrap transition-colors ${filterMode === "unread" ? 'bg-blue-600 border-blue-700 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}>未読のみ</button>
          <button onClick={() => setFilterMode("action_req")} className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border shadow-2xs whitespace-nowrap transition-colors ${filterMode === "action_req" ? 'bg-rose-600 border-rose-700 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}>未対応のみ</button>
        </div>
        
        <div className="divide-y divide-gray-100 overflow-y-auto custom-scrollbar bg-white">
          {activeAnnouncements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 opacity-70">
              <DynamicIcon name={boardApp.icon} className="w-6 h-6 text-gray-300 mb-2" />
              <p className="text-[10px] sm:text-xs text-gray-400 font-bold">該当する連絡事項はありません</p>
            </div>
          ) : (
            activeAnnouncements.slice(0, 15).map(notice => {
              const cat = categories.find(c => c.id === notice.categoryId);
              
              const dateObj = new Date(notice.publishStartDate || notice.createdAt);
              const isToday = dateObj.toDateString() === new Date().toDateString();
              const dateStr = isToday ? `${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')}` : `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

              const isActioned = isActionedForMe(notice);
              const isRead = isReadForMe(notice);

              return (
                <div 
                  key={notice.id} 
                  onClick={() => setSelectedNotice(notice)} 
                  className="px-2.5 sm:px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors flex items-center justify-between gap-1.5 group min-w-0"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {!isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm animate-pulse flex-shrink-0"></span>}
                    {notice.isUrgent && <span className="px-1 py-0.5 rounded text-[7px] font-black bg-red-100 text-red-700 flex-shrink-0 flex items-center"><AlertOctagon className="w-2.5 h-2.5 mr-0.5"/>緊急</span>}
                    {notice.requireAction && !isActioned && <span className="px-1 py-0.5 rounded text-[7px] font-black bg-rose-100 text-rose-700 flex-shrink-0 flex items-center"><AlertCircle className="w-2.5 h-2.5 mr-0.5"/>要対応</span>}
                    {cat && <span className={`px-1 py-0.5 rounded text-[7px] font-bold border shrink-0 truncate max-w-[50px] sm:max-w-[70px] ${cat.color}`}>{cat.name}</span>}
                    
                    <p className={`text-[11px] font-bold text-gray-900 truncate group-hover:${boardC.text} transition-colors flex-1`}>{notice.title}</p>
                  </div>
                  
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {notice.requireAction && (
                      <button 
                        onClick={(e) => toggleActionStatus(notice, !isActioned, e)} 
                        className={`px-1.5 py-0.5 text-[8px] font-bold rounded border shadow-2xs transition-all flex items-center gap-0.5 ${isActioned ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                      >
                        <CheckSquare className="w-2.5 h-2.5" />
                        <span className="hidden sm:inline">{isActioned ? "対応済" : "未対応"}</span>
                      </button>
                    )}
                    {!notice.requireAction && (
                      <button 
                        onClick={(e) => toggleReadStatus(notice, !isRead, e)} 
                        className={`px-1.5 py-0.5 text-[8px] font-bold rounded border shadow-2xs transition-all flex items-center gap-0.5 ${isRead ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                      >
                        <BookOpen className="w-2.5 h-2.5" />
                        <span className="hidden sm:inline">{isRead ? "既読" : "未読"}</span>
                      </button>
                    )}
                    <span className="text-[9px] font-bold text-gray-400 w-7 text-right">{dateStr}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 詳細ポップアップ（モーダル） */}
      {selectedNotice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col border border-gray-200 max-h-[90vh]">
            
            <div className="p-3 sm:p-3.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {selectedNotice.isUrgent && <span className="px-1.5 sm:px-2 py-0.5 rounded-lg text-[8px] sm:text-[9px] font-black bg-red-600 text-white flex items-center shadow-xs"><AlertOctagon className="w-2.5 h-2.5 mr-0.5" />緊急</span>}
                {selectedNotice.isExternal && <span className="px-1.5 sm:px-2 py-0.5 rounded-lg text-[8px] sm:text-[9px] font-black bg-blue-100 text-blue-700 flex items-center shadow-xs"><Globe className="w-2.5 h-2.5 mr-0.5" />外部公開</span>}
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-bold ${boardC.badgeBg} ${boardC.badgeText}`}>
                  {boardApp.displayName}
                </span>
                {selectedCategory && <span className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold border ${selectedCategory.color}`}>{selectedCategory.name}</span>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                <button onClick={() => setSelectedNotice(null)} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col">
              <h3 className="text-base sm:text-lg font-black text-gray-900 mb-3 sm:mb-4 leading-snug break-words">{selectedNotice.title}</h3>
              
              <div className="flex items-center gap-2.5 mb-4 bg-gray-50 p-2.5 rounded-xl border border-gray-100 w-fit pr-4">
                <UserAvatar name={selectedNotice.authorName} url={selectedAvatarUrl} className="w-7 h-7 sm:w-8 sm:h-8 text-[10px] sm:text-[12px]" />
                <div className="flex flex-col">
                  <span className="text-[11px] sm:text-xs font-bold text-gray-800 leading-none">{selectedNotice.authorName}</span>
                  <span className="text-[9px] sm:text-[10px] text-gray-400 font-medium mt-1 flex items-center"><Calendar className="w-2.5 h-2.5 mr-1"/>{new Date(selectedNotice.publishStartDate || selectedNotice.createdAt).toLocaleString('ja-JP')}</span>
                </div>
              </div>

              <div 
                className="p-3 sm:p-4 bg-white rounded-xl text-xs sm:text-sm text-gray-800 whitespace-pre-wrap leading-relaxed border border-gray-200 shadow-inner min-h-[90px] overflow-hidden break-words [&_a]:text-blue-600 [&_a]:underline [&_b]:font-black [&_i]:italic [&_u]:underline [&_font[size='2']]:text-xs [&_font[size='3']]:text-sm [&_font[size='5']]:text-xl [&_font[size='7']]:text-3xl [&_span[style*='background-color']]:px-1.5 [&_span[style*='background-color']]:py-0.5 [&_span[style*='background-color']]:rounded-md"
                dangerouslySetInnerHTML={{ __html: selectedNotice.content }}
              />

              {selectedNotice.attachments && selectedNotice.attachments.length > 0 && (
                <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                  <h5 className="text-[10px] sm:text-[11px] font-bold text-gray-500 mb-2 flex items-center"><Paperclip className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1"/> 添付ファイル</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {selectedNotice.attachments.map((file: any, idx: number) => (
                      <a 
                        key={idx} href={file.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between p-2 sm:p-2.5 bg-white border border-gray-200 rounded-lg sm:rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all group shadow-2xs min-w-0"
                      >
                        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                          <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0"><FileIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></div>
                          <span className="text-[10px] sm:text-[11px] font-bold text-gray-700 group-hover:text-blue-700 truncate">{file.name}</span>
                        </div>
                        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0 ml-2" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-3 sm:p-3.5 border-t border-gray-100 bg-gray-50/80 flex justify-between items-center mt-auto shrink-0 flex-wrap gap-2">
              <div className="flex gap-1.5 sm:gap-2">
                {!isReadForMe(selectedNotice) && (
                  <button 
                    onClick={(e) => toggleReadStatus(selectedNotice, true, e)} 
                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold rounded-xl shadow-sm flex items-center transition-colors bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <BookOpen className="w-3.5 h-3.5 mr-1 sm:mr-1.5" />
                    既読にする
                  </button>
                )}
                {isReadForMe(selectedNotice) && (
                  <button 
                    onClick={(e) => toggleReadStatus(selectedNotice, false, e)} 
                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold rounded-xl shadow-sm flex items-center transition-colors bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    <BookOpen className="w-3.5 h-3.5 mr-1 sm:mr-1.5" />
                    未読に戻す
                  </button>
                )}

                {selectedNotice.requireAction && (
                  <button 
                    onClick={(e) => toggleActionStatus(selectedNotice, !isActionedForMe(selectedNotice), e)} 
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold rounded-xl shadow-sm flex items-center transition-colors ${
                      isActionedForMe(selectedNotice) 
                        ? "bg-white border border-indigo-500 text-indigo-600 hover:bg-indigo-50"
                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5 mr-1 sm:mr-1.5" />
                    {isActionedForMe(selectedNotice) ? "対応済み（解除）" : "対応済みにする"}
                  </button>
                )}
              </div>
              <div className="flex gap-2 ml-auto">
                <Link href={`${boardApp.path || "/top/board"}?id=${selectedNotice.id}`} className="px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-[10px] sm:text-xs font-bold flex items-center transition-colors border border-indigo-100">
                  <LinkIcon className="w-3 h-3 mr-1" /> <span className="hidden sm:inline">アプリで</span>開く
                </Link>
                <button onClick={() => setSelectedNotice(null)} className="px-4 sm:px-5 py-1.5 sm:py-2 bg-gray-900 hover:bg-black transition-colors text-white text-[11px] sm:text-xs font-bold rounded-xl shadow-md">閉じる</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}