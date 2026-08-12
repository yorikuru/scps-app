"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChevronRight, X, Paperclip, FileIcon, Download, AlertOctagon } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { SchoolData, UserData } from "../page";

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

const UserAvatar = ({ name, url, className = "w-4 h-4 text-[8px]" }: { name: string, url?: string, className?: string }) => {
  return url ? (
    <img src={url} alt={name} className={`${className} rounded-full object-cover shadow-2xs flex-shrink-0 border border-gray-100`} />
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
};

export default function BoardWidget({ schoolData, boardApp, boardC, tenantUsers }: Props) {
  const [boardAnnouncements, setBoardAnnouncements] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<any | null>(null);

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

  if (!boardApp) return null;

  const now = new Date().getTime();

  const activeAnnouncements = boardAnnouncements.filter(a => {
    const start = a.publishStartDate ? new Date(a.publishStartDate).getTime() : new Date(a.createdAt).getTime();
    const end = a.publishEndDate ? new Date(a.publishEndDate).getTime() : null;
    return start <= now && (!end || end >= now);
  }).sort((a, b) => {
    if (a.isUrgent && !b.isUrgent) return -1;
    if (!a.isUrgent && b.isUrgent) return 1;
    const timeA = a.publishStartDate ? new Date(a.publishStartDate).getTime() : new Date(a.createdAt).getTime();
    const timeB = b.publishStartDate ? new Date(b.publishStartDate).getTime() : new Date(b.createdAt).getTime();
    return timeB - timeA;
  });

  const selectedAuthorUser = selectedNotice ? tenantUsers.find(u => u.id === selectedNotice.authorId) : null;
  const selectedAvatarUrl = selectedAuthorUser?.photoURL || selectedNotice?.authorPhotoURL;
  const selectedCategory = categories.find(cat => cat.id === selectedNotice?.categoryId);

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col min-w-0">
        <div className="px-3.5 py-2.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xs sm:text-sm font-black text-gray-900 flex items-center gap-1.5 truncate">
            <DynamicIcon name={boardApp.icon} className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${boardC.iconText}`} /> 
            {boardApp.displayName}
          </h2>
          <Link href={boardApp.path} className={`px-2 py-0.5 sm:px-2.5 sm:py-1 ${boardC.lightBg} ${boardC.text} ${boardC.hoverBg} rounded-lg text-[10px] font-bold flex items-center transition-colors flex-shrink-0`}>
            すべて見る <ChevronRight className="w-3 h-3 ml-0.5" />
          </Link>
        </div>
        
        <div className="divide-y divide-gray-100 max-h-[280px] overflow-y-auto custom-scrollbar">
          {activeAnnouncements.length === 0 ? (
            <p className="text-[10px] sm:text-xs text-gray-400 text-center py-5 font-bold">連絡事項はありません</p>
          ) : (
            activeAnnouncements.slice(0, 5).map(notice => {
              const authorUser = tenantUsers.find(u => u.id === notice.authorId);
              const avatarUrl = authorUser?.photoURL || notice.authorPhotoURL;
              const cat = categories.find(c => c.id === notice.categoryId);
              
              const dateObj = new Date(notice.publishStartDate || notice.createdAt);
              const isToday = dateObj.toDateString() === new Date().toDateString();
              const dateStr = isToday ? `${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')}` : `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

              return (
                <div key={notice.id} onClick={() => setSelectedNotice(notice)} className="px-2.5 sm:px-3 py-2 sm:py-2.5 hover:bg-gray-50 cursor-pointer transition-colors flex items-center justify-between gap-2 sm:gap-3 group min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                    {/* ★ バッジをスマホ向けに縮小 */}
                    {notice.isUrgent && (
                      <span className="px-1 py-0.5 sm:px-1.5 rounded text-[7px] sm:text-[8px] font-black bg-red-100 text-red-700 flex-shrink-0">緊急</span>
                    )}
                    {cat && <span className={`px-1 py-0.5 sm:px-1.5 rounded text-[7px] sm:text-[8px] font-bold border flex-shrink-0 truncate max-w-[50px] sm:max-w-[70px] ${cat.color}`}>{cat.name}</span>}
                    
                    <p className={`text-[10px] sm:text-[11px] font-bold text-gray-900 truncate group-hover:${boardC.text} transition-colors flex-1`}>{notice.title}</p>
                    
                    {notice.attachments && notice.attachments.length > 0 && <Paperclip className="w-3 h-3 text-gray-400 flex-shrink-0 hidden sm:block" />}
                  </div>
                  
                  <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                    <UserAvatar name={notice.authorName} url={avatarUrl} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[6px] sm:text-[8px]" />
                    <span className="text-[8px] sm:text-[9px] font-bold text-gray-500 hidden sm:block truncate max-w-[50px]">{notice.authorName?.split(" ")[0]}</span>
                    <span className="text-[8px] sm:text-[9px] font-medium text-gray-400 ml-0.5 sm:ml-1 w-6 sm:w-8 text-right flex-shrink-0">{dateStr}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedNotice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col border border-gray-200 max-h-[90vh]">
            
            <div className="p-3 sm:p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {selectedNotice.isUrgent && <span className="px-1.5 sm:px-2 py-0.5 rounded-lg text-[8px] sm:text-[9px] font-black bg-red-600 text-white flex items-center shadow-xs"><AlertOctagon className="w-2.5 h-2.5 mr-0.5" />緊急</span>}
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-bold ${boardC.badgeBg} ${boardC.badgeText}`}>
                  {boardApp.displayName}
                </span>
                {selectedCategory && <span className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold border ${selectedCategory.color}`}>{selectedCategory.name}</span>}
              </div>
              <button onClick={() => setSelectedNotice(null)} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors shrink-0"><X className="h-4 w-4 sm:h-5 sm:w-5" /></button>
            </div>
            
            <div className="p-4 sm:p-8 overflow-y-auto custom-scrollbar flex-1 flex flex-col">
              <h3 className="text-base sm:text-xl font-black text-gray-900 mb-3 sm:mb-4 leading-snug break-words">{selectedNotice.title}</h3>
              
              <div className="flex items-center gap-2.5 mb-4 sm:mb-6 bg-gray-50 p-2.5 rounded-xl border border-gray-100 w-fit pr-4">
                <UserAvatar name={selectedNotice.authorName} url={selectedAvatarUrl} className="w-7 h-7 sm:w-8 sm:h-8 text-[10px] sm:text-[12px]" />
                <div className="flex flex-col">
                  <span className="text-[11px] sm:text-xs font-bold text-gray-800 leading-none">{selectedNotice.authorName}</span>
                  <span className="text-[9px] sm:text-[10px] text-gray-400 font-medium mt-1">掲載: {new Date(selectedNotice.publishStartDate || selectedNotice.createdAt).toLocaleString('ja-JP')}</span>
                </div>
              </div>

              <div 
                className="p-3 sm:p-5 bg-white rounded-xl text-xs sm:text-sm text-gray-800 whitespace-pre-wrap leading-relaxed border border-gray-200 shadow-inner min-h-[100px] overflow-hidden break-words [&_a]:text-blue-600 [&_a]:underline [&_b]:font-black [&_i]:italic [&_u]:underline [&_font[size='2']]:text-xs [&_font[size='3']]:text-sm [&_font[size='5']]:text-xl [&_font[size='7']]:text-3xl [&_span[style*='background-color']]:px-1.5 [&_span[style*='background-color']]:py-0.5 [&_span[style*='background-color']]:rounded-md"
                dangerouslySetInnerHTML={{ __html: selectedNotice.content }}
              />

              {selectedNotice.attachments && selectedNotice.attachments.length > 0 && (
                <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-dashed border-gray-200">
                  <h5 className="text-[10px] sm:text-[11px] font-bold text-gray-500 mb-2 sm:mb-3 flex items-center"><Paperclip className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1"/> 添付ファイル</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {selectedNotice.attachments.map((file: any, idx: number) => (
                      <a 
                        key={idx} href={file.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between p-2 sm:p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all group shadow-2xs min-w-0"
                      >
                        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                          <div className="p-1.5 sm:p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0"><FileIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></div>
                          <span className="text-[10px] sm:text-[11px] font-bold text-gray-700 group-hover:text-blue-700 truncate">{file.name}</span>
                        </div>
                        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0 ml-2" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-3 sm:p-4 border-t border-gray-100 bg-gray-50/80 flex justify-end mt-auto shrink-0">
              <button onClick={() => setSelectedNotice(null)} className="px-5 py-1.5 sm:px-6 sm:py-2 bg-gray-900 hover:bg-black transition-colors text-white text-[11px] sm:text-xs font-bold rounded-xl shadow-md">閉じる</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}