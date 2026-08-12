"use client";

import React, { useState, useRef, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import { Send, CheckCircle2, AlertCircle, Edit2, AlertOctagon, Bold, Italic, Underline, Link as LinkIcon, Loader2, Paperclip, X, FileIcon, UploadCloud, CalendarClock, AlertTriangle } from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { Announcement, Category, AppConfig, AlertState, COLOR_MAPPINGS, Attachment } from "../types";
import { useDialog } from "@/components/DialogContext";

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

const formatForInput = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

type Props = {
  appConfig: AppConfig;
  categories: Category[];
  editingAnnouncement: Announcement | null;
  uiAlert: AlertState;
  isSubmitting: boolean;
  schoolId: string;
  onSubmit: (data: { title: string; content: string; categoryId: string; isUrgent: boolean; attachments: Attachment[]; publishStartDate: string; publishEndDate: string | null; }) => void;
  onCancelEdit: () => void;
};

export default function BoardForm({ appConfig, categories, editingAnnouncement, uiAlert, isSubmitting, schoolId, onSubmit, onCancelEdit }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [publishStartDate, setPublishStartDate] = useState("");
  const [publishEndDate, setPublishEndDate] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const { showAlert } = useDialog();
  
  const [showCategoryWarning, setShowCategoryWarning] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const c = COLOR_MAPPINGS[appConfig.color] || COLOR_MAPPINGS.default;

  useEffect(() => {
    if (editingAnnouncement) {
      setTitle(editingAnnouncement.title);
      setContent(editingAnnouncement.content);
      setSelectedCategory(editingAnnouncement.categoryId || "");
      setIsUrgent(editingAnnouncement.isUrgent || false);
      setAttachments(editingAnnouncement.attachments || []);
      setPublishStartDate(editingAnnouncement.publishStartDate || formatForInput(new Date(editingAnnouncement.createdAt)));
      setPublishEndDate(editingAnnouncement.publishEndDate || "");
      if (editorRef.current) editorRef.current.innerHTML = editingAnnouncement.content;
    } else {
      setTitle(""); setContent(""); setSelectedCategory(""); setIsUrgent(false); setAttachments([]);
      setPublishStartDate(formatForInput(new Date())); setPublishEndDate("");
      if (editorRef.current) editorRef.current.innerHTML = "";
    }
  }, [editingAnnouncement]);

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    if (editorRef.current) setContent(editorRef.current.innerHTML);
  };

  const handleLink = () => {
    const url = prompt("リンク先のURLを入力してください (例: https://example.com):");
    if (url) applyFormat("createLink", url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (attachments.length + files.length > 2) { showAlert("添付ファイルは最大2つまでです。"); return; }

    setIsUploading(true);
    const newAttachments: Attachment[] = [...attachments];

    for (const file of files) {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${safeName}`;
        const storageRef = ref(storage, `board_attachments/${schoolId}/${uniqueFileName}`);
        
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        newAttachments.push({ name: file.name, url, size: file.size, type: file.type });
      } catch (error) { showAlert(`${file.name}のアップロードに失敗しました。`); }
    }
    
    setAttachments(newAttachments);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) {
      setShowCategoryWarning(true);
      return;
    }
    confirmSubmit();
  };

  const confirmSubmit = () => {
    setShowCategoryWarning(false);
    onSubmit({ 
      title, content, categoryId: selectedCategory, isUrgent, attachments,
      publishStartDate, publishEndDate: publishEndDate || null 
    });
  };

  return (
    <>
      {/* ★ スマホ画面内で縦に伸びるよう h-full と flex を指定し、スクロールを内側に閉じ込める */}
      <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 relative min-h-0">
        
        <div className={`px-4 sm:px-5 py-3 sm:py-4 border-b flex flex-wrap gap-2 items-center justify-between shrink-0 ${editingAnnouncement ? 'bg-amber-50/80 border-amber-200 rounded-t-2xl' : 'bg-gray-50/50 border-gray-100 rounded-t-2xl'}`}>
          <div className="flex items-center gap-2">
            {editingAnnouncement ? <Edit2 className="w-4 h-4 text-amber-600" /> : <DynamicIcon name={appConfig.icon} className={`w-4 h-4 ${c.text}`} />}
            <h2 className={`text-sm font-black ${editingAnnouncement ? 'text-amber-900' : 'text-gray-900'}`}>{editingAnnouncement ? "連絡事項の編集" : "新しく連絡を配信"}</h2>
          </div>
          {editingAnnouncement && (
            <button onClick={onCancelEdit} className="text-xs font-bold text-gray-500 hover:text-gray-700 bg-white px-2.5 py-1 rounded border border-gray-200 shadow-sm transition-colors">キャンセル</button>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 flex-1 overflow-y-auto custom-scrollbar">
          
          {uiAlert.show && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-center shadow-sm animate-fade-in shrink-0 ${uiAlert.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {uiAlert.type === "success" ? <CheckCircle2 className="w-4 h-4 mr-1.5" /> : <AlertCircle className="w-4 h-4 mr-1.5" />} {uiAlert.message}
            </div>
          )}

          {/* 上部設定エリア */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center shrink-0">
            <div className="flex-1 w-full">
              <label className="block text-[10px] sm:text-xs font-bold text-gray-500 mb-1">カテゴリ</label>
              {/* ★ ズーム防止： text-[16px] sm:text-sm */}
              <select 
                value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 sm:py-2.5 text-[16px] sm:text-sm font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 ${c.ring}`}
              >
                <option value="">(カテゴリなし)</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div className="pt-0 sm:pt-4 w-full sm:w-auto">
              <label className="flex items-center gap-2 cursor-pointer bg-red-50 px-3 py-2 sm:py-2.5 rounded-xl border border-red-100 hover:bg-red-100 transition-colors h-full">
                <input type="checkbox" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)} className="w-4 h-4 text-red-600 rounded cursor-pointer border-red-300 focus:ring-red-500" />
                <span className="text-[11px] sm:text-xs font-black text-red-700 flex items-center"><AlertOctagon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" /> 緊急として配信</span>
              </label>
            </div>
          </div>

          {/* 日付エリア */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 shrink-0">
            <div className="flex-1 w-full">
              <label className="block text-[10px] sm:text-xs font-bold text-gray-500 mb-1">掲載開始日時 <span className="text-red-500">*</span></label>
              <div className="relative">
                <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                {/* ★ ズーム防止： text-[16px] sm:text-sm */}
                <input
                  type="datetime-local" required value={publishStartDate} onChange={(e) => setPublishStartDate(e.target.value)}
                  className={`w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-2 sm:pr-3 py-2 text-[16px] sm:text-sm font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 ${c.ring}`}
                />
              </div>
            </div>
            <div className="flex-1 w-full">
              <label className="block text-[10px] sm:text-xs font-bold text-gray-500 mb-1">掲載終了日時 (任意)</label>
              <div className="relative">
                <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                {/* ★ ズーム防止： text-[16px] sm:text-sm */}
                <input
                  type="datetime-local" value={publishEndDate} onChange={(e) => setPublishEndDate(e.target.value)}
                  className={`w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-2 sm:pr-3 py-2 text-[16px] sm:text-sm font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 ${c.ring}`}
                />
              </div>
            </div>
          </div>

          {/* タイトル */}
          <div className="shrink-0">
            <label className="block text-[10px] sm:text-xs font-bold text-gray-500 mb-1">タイトル <span className="text-red-500">*</span></label>
            {/* ★ ズーム防止： text-[16px] sm:text-sm */}
            <input
              type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
              className={`w-full bg-white border border-gray-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-[16px] sm:text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 ${c.ring} shadow-2xs`}
              placeholder="例: 次回の定例会議について"
            />
          </div>

          {/* リッチテキスト本文 */}
          <div className="flex-1 flex flex-col min-h-[250px] sm:min-h-[300px]">
            <label className="block text-[10px] sm:text-xs font-bold text-gray-500 mb-1">本文 <span className="text-red-500">*</span></label>
            
            <div className="flex flex-wrap items-center gap-1 mb-1.5 p-1 bg-gray-50 border border-gray-200 rounded-xl shrink-0">
              <button type="button" onClick={() => applyFormat('foreColor', '#111827')} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-900 border border-gray-300 hover:scale-110 transition-transform shadow-2xs" title="黒文字"></button>
              <button type="button" onClick={() => applyFormat('foreColor', '#ef4444')} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-500 border border-gray-300 hover:scale-110 transition-transform shadow-2xs" title="赤文字"></button>
              <button type="button" onClick={() => applyFormat('foreColor', '#3b82f6')} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-500 border border-gray-300 hover:scale-110 transition-transform shadow-2xs" title="青文字"></button>
              <div className="w-px h-5 bg-gray-300 mx-0.5 sm:mx-1"></div>
              
              <button type="button" onClick={() => applyFormat('hiliteColor', '#fef08a')} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-yellow-200 border border-gray-300 hover:scale-110 transition-transform shadow-2xs" title="蛍光（黄）"></button>
              <button type="button" onClick={() => applyFormat('hiliteColor', '#fbcfe8')} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-pink-200 border border-gray-300 hover:scale-110 transition-transform shadow-2xs" title="蛍光（ピンク）"></button>
              <button type="button" onClick={() => applyFormat('hiliteColor', '#bbf7d0')} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-200 border border-gray-300 hover:scale-110 transition-transform shadow-2xs" title="蛍光（緑）"></button>
              <div className="w-px h-5 bg-gray-300 mx-0.5 sm:mx-1"></div>

              <button type="button" onClick={() => applyFormat('bold')} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-gray-700 transition-all" title="太字"><Bold className="w-4 h-4" /></button>
              <button type="button" onClick={() => applyFormat('italic')} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-gray-700 transition-all" title="斜体"><Italic className="w-4 h-4" /></button>
              <button type="button" onClick={() => applyFormat('underline')} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-gray-700 transition-all" title="下線"><Underline className="w-4 h-4" /></button>
              <div className="w-px h-5 bg-gray-300 mx-0.5 sm:mx-1"></div>

              <select 
                onChange={(e) => applyFormat('fontSize', e.target.value)}
                className="py-1 px-1.5 sm:px-2 text-xs border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 outline-none cursor-pointer font-bold shadow-2xs"
                defaultValue="3"
                title="文字サイズ"
              >
                <option value="2">小</option>
                <option value="3">中</option>
                <option value="5">大</option>
                <option value="7">特大</option>
              </select>
              <div className="w-px h-5 bg-gray-300 mx-0.5 sm:mx-1"></div>

              <button type="button" onClick={handleLink} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-gray-600 transition-all" title="リンク挿入"><LinkIcon className="w-4 h-4" /></button>
            </div>
            
            {/* ★ ズーム防止：スマホ時は text-[16px] (text-base相当) を指定 */}
            <div
              ref={editorRef} contentEditable onInput={(e) => setContent(e.currentTarget.innerHTML)}
              className={`flex-1 bg-white border border-gray-300 rounded-xl p-3 sm:p-4 text-[16px] sm:text-sm text-gray-900 focus:outline-none focus:ring-2 ${c.ring} overflow-y-auto custom-scrollbar leading-relaxed shadow-inner [&_a]:text-blue-600 [&_a]:underline [&_b]:font-black [&_i]:italic [&_u]:underline [&_font[size="2"]]:text-xs [&_font[size="3"]]:text-sm [&_font[size="5"]]:text-xl [&_font[size="7"]]:text-3xl [&_span[style*="background-color"]]:px-1 [&_span[style*="background-color"]]:rounded-sm`}
            />
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 sm:p-3 shrink-0">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] sm:text-xs font-bold text-gray-600 flex items-center"><Paperclip className="w-3.5 h-3.5 mr-1"/> 添付ファイル (最大2つ)</span>
              {attachments.length < 2 && (
                <label className={`cursor-pointer px-2 sm:px-3 py-1 sm:py-1.5 bg-white border border-gray-300 rounded-lg text-[10px] sm:text-xs font-bold text-gray-700 hover:bg-gray-100 flex items-center transition-colors shadow-2xs ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  {isUploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5 mr-1" />} ファイルを追加
                  <input type="file" className="hidden" multiple onChange={handleFileUpload} ref={fileInputRef} />
                </label>
              )}
            </div>
            {attachments.length > 0 && (
              <div className="flex flex-col gap-1.5 sm:gap-2">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white border border-gray-200 p-1.5 sm:p-2 rounded-lg shadow-2xs">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="p-1 sm:p-1.5 bg-blue-50 text-blue-600 rounded-md"><FileIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></div>
                      <span className="text-[10px] sm:text-xs font-bold text-gray-700 truncate">{file.name}</span>
                    </div>
                    <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="p-1 sm:p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><X className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end shrink-0">
            <button
              type="submit" disabled={isSubmitting || isUploading || !title.trim() || !content.trim() || !publishStartDate}
              className={`w-full sm:w-auto justify-center px-6 py-2.5 sm:py-3 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center ${editingAnnouncement ? 'bg-amber-600 hover:bg-amber-700' : `${c.bg} ${c.hover}`}`}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (editingAnnouncement ? <Edit2 className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />)}
              {editingAnnouncement ? "編集内容を保存" : "連絡事項を配信する"}
            </button>
          </div>
        </form>
      </div>

      {showCategoryWarning && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in rounded-2xl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center border border-gray-100">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-sm font-black text-gray-900 mb-2">カテゴリが未設定です</h3>
            <p className="text-xs font-medium text-gray-500 leading-relaxed mb-6">
              本当にカテゴリなしで投稿しますか？<br/>
              原則としてカテゴリを設定してください。
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowCategoryWarning(false)} 
                className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors"
              >
                戻って設定する
              </button>
              <button 
                onClick={confirmSubmit} 
                className="flex-1 py-2.5 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 shadow-sm transition-colors"
              >
                そのまま投稿
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}