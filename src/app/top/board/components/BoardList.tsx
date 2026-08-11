"use client";

import React, { useState, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import { Search, Edit2, Trash2, AlertOctagon, AlertCircle, Paperclip, Download, FileIcon, MessageSquareText, Calendar, ArrowDownUp, Clock } from "lucide-react";
import { Announcement, Category, UserData, AppConfig, COLOR_MAPPINGS } from "../types";

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
  onEdit: (announcement: Announcement) => void;
  onDelete: (id: string) => Promise<void>;
};

export default function BoardList({ announcements, categories, userData, tenantUsers, appConfig, onEdit, onDelete }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const c = COLOR_MAPPINGS[appConfig.color] || COLOR_MAPPINGS.default;

  const canManage = (a: Announcement) => {
    if (!userData) return false;
    return a.authorId === userData.id || userData.role === "admin" || userData.role === "system_admin" || userData.isITManager;
  };

  const isAuthor = (a: Announcement) => {
    if (!userData) return false;
    return a.authorId === userData.id;
  };

  const now = new Date().getTime();
  
  // ★表示すべきかどうかの判定（過去のもの、または自分が投稿したもの）
  const shouldDisplay = (a: Announcement) => {
    const start = a.publishStartDate ? new Date(a.publishStartDate).getTime() : new Date(a.createdAt).getTime();
    if (start <= now) return true; // 配信時間を迎えている
    if (isAuthor(a)) return true; // まだ迎えていないが、自分が投稿者である
    return false; // 他人の予約投稿は非表示
  };

  const isActive = (a: Announcement) => {
    const start = a.publishStartDate ? new Date(a.publishStartDate).getTime() : new Date(a.createdAt).getTime();
    const end = a.publishEndDate ? new Date(a.publishEndDate).getTime() : null;
    return start <= now && (!end || end >= now);
  };

  const getStatusBadge = (a: Announcement) => {
    const start = a.publishStartDate ? new Date(a.publishStartDate).getTime() : new Date(a.createdAt).getTime();
    const end = a.publishEndDate ? new Date(a.publishEndDate).getTime() : null;
    if (start > now) return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-700 flex items-center"><Clock className="w-2.5 h-2.5 mr-0.5" />予約中・待機中</span>;
    if (end && end < now) return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gray-100 text-gray-500">掲載終了</span>;
    return null;
  };

  const filteredAndSorted = announcements
    .filter(a => shouldDisplay(a)) // ★追加：表示可否のフィルター
    .filter(a => isActive(a) || canManage(a))
    .filter(a => filterCategory === "all" || a.categoryId === filterCategory)
    .filter(a => !filterUrgent || a.isUrgent)
    .filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.content.toLowerCase().includes(searchQuery.toLowerCase()) || a.authorName.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      const timeA = a.publishStartDate ? new Date(a.publishStartDate).getTime() : new Date(a.createdAt).getTime();
      const timeB = b.publishStartDate ? new Date(b.publishStartDate).getTime() : new Date(b.createdAt).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });

  useEffect(() => {
    if (selectedId && !filteredAndSorted.find(a => a.id === selectedId)) setSelectedId(null);
  }, [filteredAndSorted, selectedId]);

  useEffect(() => {
    if (!selectedId && filteredAndSorted.length > 0) setSelectedId(filteredAndSorted[0].id);
  }, [filteredAndSorted, selectedId]);

  const formatTimeCompact = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${d.getMonth()+1}/${d.getDate()}`;
  };

  const executeDelete = async () => {
    if (deleteConfirmId) {
      await onDelete(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const selectedAnnouncement = filteredAndSorted.find(a => a.id === selectedId);
  const selectedCategory = categories.find(cat => cat.id === selectedAnnouncement?.categoryId);
  const selectedAuthorUser = tenantUsers.find(u => u.id === selectedAnnouncement?.authorId);
  const selectedAvatarUrl = selectedAuthorUser?.photoURL;

  return (
    <div className="flex flex-col lg:flex-row h-full bg-white relative">
      
      {/* ＝＝＝ 左ペイン：コンパクトリスト ＝＝＝ */}
      <div className="w-full lg:w-[420px] xl:w-[480px] border-r border-gray-200 flex flex-col flex-shrink-0 bg-white">
        <div className="p-2 border-b border-gray-200 bg-gray-50/50 flex flex-col gap-2 sticky top-0 z-10">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input 
              type="text" placeholder="検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 ${c.ring} shadow-2xs`}
            />
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <select 
              value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="flex-1 bg-white border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none font-bold"
            >
              <option value="all">全カテゴリ</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            <button onClick={() => setFilterUrgent(!filterUrgent)} className={`p-1 border rounded-md transition-colors ${filterUrgent ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`} title="緊急のみ表示">
              <AlertOctagon className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")} className="p-1 bg-white border border-gray-200 text-gray-400 rounded-md hover:bg-gray-50 transition-colors" title="並び替え">
              <ArrowDownUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-gray-100">
          {filteredAndSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-gray-400 py-12 opacity-70">
              <MessageSquareText className="w-6 h-6 mb-2" />
              <p className="text-[10px] font-bold">該当する連絡はありません</p>
            </div>
          ) : (
            filteredAndSorted.map((a) => {
              const isSelected = a.id === selectedId;
              const isUr = a.isUrgent;
              const cat = categories.find(c => c.id === a.categoryId);
              const authorUser = tenantUsers.find(u => u.id === a.authorId);
              const avatarUrl = authorUser?.photoURL;
              const statusBadge = getStatusBadge(a);

              return (
                <div 
                  key={a.id} onClick={() => setSelectedId(a.id)}
                  className={`px-3 py-2 cursor-pointer flex items-center gap-2.5 min-w-0 transition-colors group ${isSelected ? (isUr ? 'bg-red-600 text-white' : `${c.bg} text-white shadow-inner`) : (!isActive(a) ? 'bg-gray-50 opacity-70' : 'hover:bg-gray-50 text-gray-900')}`}
                >
                  <div className="relative flex-shrink-0">
                    <UserAvatar name={a.authorName} url={avatarUrl} className={`w-7 h-7 text-[10px] ${!isActive(a) ? 'grayscale' : ''}`} />
                    {isUr && <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white ${isSelected ? 'bg-white' : 'bg-red-500'}`}></div>}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5">
                      <h4 className={`text-xs font-bold truncate flex-1 ${isSelected ? 'text-white' : (statusBadge ? 'text-gray-500' : 'text-gray-900')}`}>{a.title}</h4>
                      {statusBadge}
                      {a.attachments && a.attachments.length > 0 && <Paperclip className={`w-3 h-3 flex-shrink-0 ${isSelected ? 'text-white/70' : 'text-gray-400'}`} />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] truncate max-w-[80px] ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>{a.authorName}</span>
                      {cat && <span className={`px-1.5 rounded-sm text-[9px] font-bold border truncate max-w-[60px] ${isSelected ? 'border-white/30 text-white/90' : cat.color}`}>{cat.name}</span>}
                    </div>
                  </div>

                  <div className={`w-12 text-right flex-shrink-0 text-[10px] font-medium ${isSelected ? 'text-white/90' : 'text-gray-400'}`}>
                    {formatTimeCompact(a.publishStartDate || a.createdAt)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ＝＝＝ 右ペイン：プレビュー詳細 ＝＝＝ */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {selectedAnnouncement ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
            <div className="p-5 sm:p-6 sm:pb-4 border-b border-gray-100">
              <div className="flex justify-between items-start mb-4 gap-4">
                <h2 className="text-xl font-black text-gray-900 leading-snug break-words flex-1">
                  {selectedAnnouncement.isUrgent && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-red-600 text-white shadow-xs mr-2 align-middle"><AlertOctagon className="w-3 h-3 mr-0.5" /> 緊急</span>}
                  {getStatusBadge(selectedAnnouncement)}
                  <span className="ml-1">{selectedAnnouncement.title}</span>
                </h2>
                {canManage(selectedAnnouncement) && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => onEdit(selectedAnnouncement)} className="p-2 text-gray-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-200" title="編集"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteConfirmId(selectedAnnouncement.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200" title="削除"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <UserAvatar name={selectedAnnouncement.authorName} url={selectedAvatarUrl} className="w-10 h-10 text-sm" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-gray-900">{selectedAnnouncement.authorName}</span>
                    {selectedCategory && <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${selectedCategory.color}`}>{selectedCategory.name}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 mt-0.5">
                    <Calendar className="w-3 h-3" /> 掲載: {new Date(selectedAnnouncement.publishStartDate || selectedAnnouncement.createdAt).toLocaleString('ja-JP')}
                    {selectedAnnouncement.publishEndDate && ` 〜 ${new Date(selectedAnnouncement.publishEndDate).toLocaleString('ja-JP')}`}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 flex-1">
              <div 
                className="text-sm text-gray-800 leading-loose break-words [&_a]:text-blue-600 [&_a]:underline [&_b]:font-black [&_i]:italic [&_u]:underline [&_font[size='2']]:text-xs [&_font[size='3']]:text-sm [&_font[size='5']]:text-xl [&_font[size='7']]:text-3xl [&_span[style*='background-color']]:px-1.5 [&_span[style*='background-color']]:py-0.5 [&_span[style*='background-color']]:rounded-md"
                dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content }}
              />
            </div>

            {selectedAnnouncement.attachments && selectedAnnouncement.attachments.length > 0 && (
              <div className="p-5 sm:p-6 bg-gray-50/50 border-t border-gray-100 mt-auto">
                <h5 className="text-xs font-black text-gray-600 mb-3 flex items-center"><Paperclip className="w-4 h-4 mr-1.5"/> 添付ファイル</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                  {selectedAnnouncement.attachments.map((file, idx) => (
                    <a 
                      key={idx} href={file.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/30 transition-all group shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><FileIcon className="w-4 h-4" /></div>
                        <span className="text-[11px] font-bold text-gray-700 group-hover:text-blue-700 truncate">{file.name}</span>
                      </div>
                      <Download className="w-4 h-4 text-gray-300 group-hover:text-blue-600 flex-shrink-0 ml-2 transition-colors" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/30 text-gray-400 p-6 text-center">
            <div className={`p-4 ${c.lightBg} ${c.text} rounded-2xl mb-4 shadow-sm`}>
              <DynamicIcon name={appConfig.icon} className="w-10 h-10" />
            </div>
            <h3 className="text-sm font-black text-gray-700 mb-1">連絡事項が選択されていません</h3>
            <p className="text-[11px] font-bold text-gray-400">左側のリストから項目を選択すると、ここに詳細が表示されます。</p>
          </div>
        )}
      </div>

      {deleteConfirmId && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
            <div className="p-5 flex items-start gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-full flex-shrink-0"><AlertCircle className="w-5 h-5" /></div>
              <div>
                <h3 className="text-sm font-black text-gray-900 mb-1">投稿を削除しますか？</h3>
                <p className="text-xs font-medium text-gray-500 leading-relaxed">この操作は取り消せません。本当にこの連絡事項を削除してもよろしいですか？</p>
              </div>
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition-colors shadow-2xs">キャンセル</button>
              <button onClick={executeDelete} className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-colors">削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}