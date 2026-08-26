"use client";

import React, { useState, useRef, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import { Send, CheckCircle2, AlertCircle, Edit2, AlertOctagon, Bold, Italic, Underline, Link as LinkIcon, Loader2, Paperclip, X, FileIcon, UploadCloud, CalendarClock, AlertTriangle, Globe, Users, CheckSquare, ChevronLeft, Palette } from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { Announcement, Category, AppConfig, AlertState, COLOR_MAPPINGS, Attachment, TargetType, ExtTargetType, UserData, Position, ActionType } from "../types";
import { useDialog } from "@/components/DialogContext";
import { ExternalUser } from "@/app/types/external";
import CustomSelect from "@/components/CustomSelect"; 

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

const formatForInput = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const UserSelector = ({ users, selectedIds, onChange, title }: { users: any[], selectedIds: string[], onChange: (ids: string[]) => void, title: string }) => {
  const [search, setSearch] = useState("");
  const filtered = users.filter(u => u.name.includes(search));
  
  return (
    <div className="border border-gray-200 rounded-lg p-2 bg-white shadow-sm mt-1.5 animate-fade-in">
      <div className="text-[9px] font-bold text-gray-500 mb-1">{title}</div>
      <input 
        type="text" placeholder="名前で検索..." value={search} onChange={e=>setSearch(e.target.value)}
        className="w-full mb-1.5 p-1.5 border border-gray-200 rounded text-[10px] font-bold outline-none focus:border-indigo-400 bg-gray-50 focus:bg-white transition-colors"
      />
      <div className="max-h-24 overflow-y-auto space-y-0.5 custom-scrollbar">
        {filtered.length === 0 ? <div className="text-center text-gray-400 text-[9px] py-3">該当ユーザーなし</div> : filtered.map(u => (
          <label key={u.id} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-700 cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors border border-transparent hover:border-gray-200">
            <input 
              type="checkbox" 
              checked={selectedIds.includes(u.id)} 
              onChange={(e) => {
                if (e.target.checked) onChange([...selectedIds, u.id]);
                else onChange(selectedIds.filter(id => id !== u.id));
              }} 
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
            />
            <span className="truncate">{u.name}</span> <span className="text-[8px] text-gray-400 font-normal truncate">{u.positionName || u.affiliation || ""}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

type Props = {
  appConfig: AppConfig;
  categories: Category[];
  editingAnnouncement: Announcement | null;
  uiAlert: AlertState;
  isSubmitting: boolean;
  schoolId: string;
  tenantUsers: UserData[];
  externalUsers: ExternalUser[];
  positions: Position[];
  onSubmit: (data: { 
    title: string; content: string; categoryId: string; isUrgent: boolean; 
    attachments: Attachment[]; publishStartDate: string; publishEndDate: string | null; 
    isExternal: boolean; isInternalAlso: boolean;
    targetType: TargetType; targetPositionIds: string[]; targetUserIds: string[];
    extTargetType: ExtTargetType; extTargetUserIds: string[];
    requireAction: boolean; actionType: ActionType;
  }) => void;
  onCancelEdit: () => void;
};

export default function BoardForm({ appConfig, categories, editingAnnouncement, uiAlert, isSubmitting, schoolId, tenantUsers, externalUsers, positions, onSubmit, onCancelEdit }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [fontSize, setFontSize] = useState("3"); 
  const [isUrgent, setIsUrgent] = useState(false);
  const [isExternal, setIsExternal] = useState(false);
  const [isInternalAlso, setIsInternalAlso] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [publishStartDate, setPublishStartDate] = useState("");
  const [publishEndDate, setPublishEndDate] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [targetType, setTargetType] = useState<TargetType>("all");
  const [targetPositionIds, setTargetPositionIds] = useState<string[]>([]);
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [extTargetType, setExtTargetType] = useState<ExtTargetType>("all");
  const [extTargetUserIds, setExtTargetUserIds] = useState<string[]>([]);

  const [requireAction, setRequireAction] = useState(false);
  const [actionType, setActionType] = useState<ActionType>("all");

  const { showAlert } = useDialog();
  const [showCategoryWarning, setShowCategoryWarning] = useState(false);
  const [showExternalWarning, setShowExternalWarning] = useState(false); 

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const c = COLOR_MAPPINGS[appConfig.color] || COLOR_MAPPINGS.default;

  useEffect(() => {
    if (editingAnnouncement) {
      setTitle(editingAnnouncement.title);
      setContent(editingAnnouncement.content);
      setSelectedCategory(editingAnnouncement.categoryId || "");
      setIsUrgent(editingAnnouncement.isUrgent || false);
      setIsExternal(editingAnnouncement.isExternal || false);
      setIsInternalAlso(editingAnnouncement.isInternalAlso !== false); 
      setTargetType(editingAnnouncement.targetType || "all");
      setTargetPositionIds(editingAnnouncement.targetPositionIds || []);
      setTargetUserIds(editingAnnouncement.targetUserIds || []);
      setExtTargetType(editingAnnouncement.extTargetType || "all");
      setExtTargetUserIds(editingAnnouncement.extTargetUserIds || []);
      setRequireAction(editingAnnouncement.requireAction || false); 
      setActionType(editingAnnouncement.actionType || "all");       
      setAttachments(editingAnnouncement.attachments || []);
      setPublishStartDate(editingAnnouncement.publishStartDate || formatForInput(new Date(editingAnnouncement.createdAt)));
      setPublishEndDate(editingAnnouncement.publishEndDate || "");
      if (editorRef.current) editorRef.current.innerHTML = editingAnnouncement.content;
    } else {
      setTitle(""); setContent(""); setSelectedCategory(""); setIsUrgent(false); setIsExternal(false); setIsInternalAlso(true); 
      setTargetType("all"); setTargetPositionIds([]); setTargetUserIds([]); setExtTargetType("all"); setExtTargetUserIds([]);
      setRequireAction(false); setActionType("all"); 
      setAttachments([]); setPublishStartDate(formatForInput(new Date())); setPublishEndDate("");
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
    if (attachments.length + files.length > 2) { showAlert("添付ファイルは最大2つまでです。", "warning"); return; }

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
      } catch (error) { showAlert(`${file.name}のアップロードに失敗しました。`, "error"); }
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
    checkExternalAndSubmit();
  };

  const handleCategoryBypass = () => {
    setShowCategoryWarning(false);
    checkExternalAndSubmit();
  };

  const checkExternalAndSubmit = () => {
    if (isExternal && !editingAnnouncement) {
      setShowExternalWarning(true); 
    } else {
      confirmSubmit();
    }
  };

  const confirmSubmit = () => {
    setShowCategoryWarning(false);
    setShowExternalWarning(false);
    onSubmit({ 
      title, content, categoryId: selectedCategory, isUrgent, attachments,
      publishStartDate, publishEndDate: publishEndDate || null, isExternal, isInternalAlso,
      targetType, targetPositionIds, targetUserIds, extTargetType, extTargetUserIds,
      requireAction, actionType 
    });
  };

  return (
    <>
      <div className={`flex flex-col h-full rounded-2xl shadow-sm relative min-h-0 transition-all duration-300 ${
        isExternal ? 'bg-blue-50/50 border border-blue-300' : 'bg-white border border-gray-200'
      }`}>
        
        {/* ヘッダー */}
        <div className={`px-2.5 sm:px-4 py-2 border-b flex flex-wrap gap-2 items-center justify-between shrink-0 transition-colors ${
          isExternal ? 'bg-blue-600 border-blue-700 rounded-t-2xl text-white shadow-sm' : editingAnnouncement ? 'bg-amber-50/80 border-amber-200 rounded-t-2xl' : 'bg-gray-50/50 border-gray-100 rounded-t-2xl'
        }`}>
          <div className="flex items-center gap-1.5">
            <button onClick={onCancelEdit} className={`p-1 rounded-lg transition-colors flex items-center justify-center ${isExternal ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-200 text-gray-500'}`} title="戻る">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {editingAnnouncement ? <Edit2 className={`w-3.5 h-3.5 ${isExternal ? 'text-white' : 'text-amber-600'}`} /> : <DynamicIcon name={appConfig.icon} className={`w-3.5 h-3.5 ${isExternal ? 'text-white' : c.text}`} />}
            <h2 className={`text-xs font-black ${isExternal ? 'text-white' : editingAnnouncement ? 'text-amber-900' : 'text-gray-900'}`}>
              {editingAnnouncement ? "連絡の編集" : "新規配信"}
            </h2>
            {isExternal && <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-black rounded border border-red-600 flex items-center shadow-inner"><AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> 外部公開</span>}
          </div>
          
          <div className="flex items-center gap-1.5 ml-auto">
            {editingAnnouncement && isExternal && (
              <label className="flex items-center justify-center gap-1 cursor-pointer px-2 py-1 rounded border shadow-sm bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                <input type="checkbox" checked={isInternalAlso} onChange={e => setIsInternalAlso(e.target.checked)} className="hidden" />
                <span className="text-[9px] font-black">メンバーにも配信</span>
                <div className={`w-5 h-3 rounded-full flex items-center transition-colors ${isInternalAlso ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                   <div className={`w-2 h-2 bg-white rounded-full transition-transform shadow-sm ${isInternalAlso ? 'translate-x-2.5' : 'translate-x-0.5'}`}></div>
                </div>
              </label>
            )}

            <label className={`flex items-center justify-center gap-1 cursor-pointer px-2 py-1 rounded border shadow-sm ${isExternal ? 'bg-white text-blue-700 border-blue-300' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <input type="checkbox" checked={isExternal} onChange={e => setIsExternal(e.target.checked)} className="hidden" />
              <Globe className="w-3 h-3" />
              <span className="text-[9px] font-black">外部公開</span>
              <div className={`w-5 h-3 rounded-full flex items-center transition-colors ${isExternal ? 'bg-blue-600' : 'bg-gray-300'}`}>
                   <div className={`w-2 h-2 bg-white rounded-full transition-transform shadow-sm ${isExternal ? 'translate-x-2.5' : 'translate-x-0.5'}`}></div>
              </div>
            </label>
          </div>
        </div>
        
        {/* フォーム本体: PCでは2カラム構成 */}
        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-y-auto lg:overflow-hidden custom-scrollbar p-2 gap-2.5">
          
          {/* 左カラム (設定関連) */}
          <div className="w-full lg:w-[300px] flex flex-col gap-2 lg:overflow-y-auto custom-scrollbar pr-1 shrink-0 pb-4 lg:pb-0">
            
            <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-[10px] font-black text-gray-800 flex items-center gap-1 border-b border-gray-100 pb-1.5 mb-1.5">
                <Users className="w-3 h-3 text-indigo-500" /> メンバー配信先
              </h3>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-gray-700">
                  <input type="radio" checked={targetType === 'all'} onChange={() => setTargetType('all')} className="w-3 h-3 text-indigo-600"/> 一斉
                </label>
                <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-gray-700">
                  <input type="radio" checked={targetType === 'position'} onChange={() => setTargetType('position')} className="w-3 h-3 text-indigo-600"/> 役職
                </label>
                <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-gray-700">
                  <input type="radio" checked={targetType === 'individual'} onChange={() => setTargetType('individual')} className="w-3 h-3 text-indigo-600"/> 個人
                </label>
              </div>

              {targetType === 'position' && (
                <div className="mt-2 p-1.5 bg-gray-50 border border-gray-200 rounded space-y-1.5 animate-fade-in">
                  <div>
                    <p className="text-[8px] font-black text-gray-500 mb-1">システム区分</p>
                    <div className="flex flex-wrap gap-1">
                       {['sys_student', 'sys_teacher', 'sys_admin'].map(sysId => (
                         <label key={sysId} className={`flex items-center gap-1 text-[9px] font-bold cursor-pointer bg-white px-1.5 py-1 rounded border transition-colors ${targetPositionIds.includes(sysId) ? 'border-indigo-400 text-indigo-800 bg-indigo-50' : 'border-gray-200 text-gray-600'}`}>
                           <input type="checkbox" checked={targetPositionIds.includes(sysId)} onChange={e => { if(e.target.checked) setTargetPositionIds([...targetPositionIds, sysId]); else setTargetPositionIds(targetPositionIds.filter(id => id !== sysId)); }} className="w-2 h-2 text-indigo-600 rounded"/> 
                           {sysId === 'sys_student' ? '生徒全員' : sysId === 'sys_teacher' ? '教員全員' : '管理者'}
                         </label>
                       ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-gray-500 mb-1">役職マスタ</p>
                    <div className="flex flex-wrap gap-1">
                       {positions.filter(p => p.isInternal).map(p => (
                         <label key={p.id} className={`flex items-center gap-1 text-[9px] font-bold cursor-pointer bg-white px-1.5 py-1 rounded border transition-colors ${targetPositionIds.includes(p.id) ? 'border-indigo-400 text-indigo-800 bg-indigo-50' : 'border-gray-200 text-gray-600'}`}>
                           <input type="checkbox" checked={targetPositionIds.includes(p.id)} onChange={e => { if(e.target.checked) setTargetPositionIds([...targetPositionIds, p.id]); else setTargetPositionIds(targetPositionIds.filter(id => id !== p.id)); }} className="w-2 h-2 text-indigo-600 rounded"/> {p.name}
                         </label>
                       ))}
                    </div>
                  </div>
                </div>
              )}

              {targetType === 'individual' && (
                <UserSelector users={tenantUsers} selectedIds={targetUserIds} onChange={setTargetUserIds} title="対象メンバー" />
              )}
            </div>

            {isExternal && (
              <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-200 shadow-sm animate-fade-in">
                <h3 className="text-[10px] font-black text-blue-900 flex items-center gap-1 border-b border-blue-100 pb-1.5 mb-1.5">
                  <Globe className="w-3 h-3 text-blue-600" /> 外部ゲスト配信先
                </h3>
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-blue-800">
                    <input type="radio" checked={extTargetType === 'all'} onChange={() => setExtTargetType('all')} className="w-3 h-3 text-blue-600"/> ゲスト一斉
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-blue-800">
                    <input type="radio" checked={extTargetType === 'individual'} onChange={() => setExtTargetType('individual')} className="w-3 h-3 text-blue-600"/> 個人別
                  </label>
                </div>
                {extTargetType === 'individual' && (
                  <UserSelector users={externalUsers} selectedIds={extTargetUserIds} onChange={setExtTargetUserIds} title="対象ゲスト" />
                )}
              </div>
            )}

            <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black text-gray-800 flex items-center gap-1">
                  <CheckSquare className="w-3 h-3 text-indigo-500" /> タスク化
                </h3>
                <label className="flex items-center gap-1 cursor-pointer bg-gray-50 border border-gray-200 px-1.5 py-1 rounded hover:bg-gray-100 transition-colors">
                  <input type="checkbox" checked={requireAction} onChange={e => setRequireAction(e.target.checked)} className="w-3 h-3 text-indigo-600 rounded" />
                  <span className="text-[9px] font-bold text-gray-700">要求する</span>
                </label>
              </div>
              {requireAction && (
                <div className="mt-1.5 p-1.5 bg-gray-50 border border-gray-200 rounded animate-fade-in flex flex-col gap-1">
                  <label className="flex items-center gap-1 text-[9px] font-bold text-gray-700 cursor-pointer">
                    <input type="radio" checked={actionType === 'all'} onChange={() => setActionType('all')} className="w-3 h-3 text-indigo-600" /> 
                    <span>全員対応必須</span>
                  </label>
                  <label className="flex items-center gap-1 text-[9px] font-bold text-gray-700 cursor-pointer">
                    <input type="radio" checked={actionType === 'single'} onChange={() => setActionType('single')} className="w-3 h-3 text-indigo-600" /> 
                    <span>1人対応で完了</span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <div className="flex-1 w-full">
                <label className="block text-[9px] font-bold text-gray-500 mb-0.5">カテゴリ</label>
                <CustomSelect 
                  value={selectedCategory} 
                  onChange={setSelectedCategory}
                  options={[
                    { value: "", label: "(カテゴリなし)" },
                    ...categories.map(cat => ({ value: cat.id, label: cat.name }))
                  ]}
                />
              </div>
              <div className="pt-3.5 w-auto">
                <label className="flex items-center justify-center gap-1 cursor-pointer bg-red-50 px-2 py-1.5 rounded-lg border border-red-100 hover:bg-red-100 transition-colors h-full shadow-2xs">
                  <input type="checkbox" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)} className="w-3 h-3 text-red-600 rounded cursor-pointer" />
                  <span className="text-[10px] font-black text-red-700 flex items-center"><AlertOctagon className="w-3 h-3 mr-0.5" /> 緊急</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="w-full">
                <label className="block text-[9px] font-bold text-gray-500 mb-0.5">開始日時 <span className="text-red-500">*</span></label>
                <div className="relative">
                  <CalendarClock className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="datetime-local" required value={publishStartDate} onChange={(e) => setPublishStartDate(e.target.value)}
                    className={`w-full bg-white border border-gray-200 rounded-lg pl-7 pr-1 py-1.5 text-[11px] font-bold text-gray-900 focus:outline-none focus:ring-2 shadow-sm ${isExternal ? 'focus:ring-blue-500' : c.ring}`}
                  />
                </div>
              </div>
              <div className="w-full">
                <label className="block text-[9px] font-bold text-gray-500 mb-0.5">終了日時 (任意)</label>
                <div className="relative">
                  <CalendarClock className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="datetime-local" value={publishEndDate} onChange={(e) => setPublishEndDate(e.target.value)}
                    className={`w-full bg-white border border-gray-200 rounded-lg pl-7 pr-1 py-1.5 text-[11px] font-bold text-gray-900 focus:outline-none focus:ring-2 shadow-sm ${isExternal ? 'focus:ring-blue-500' : c.ring}`}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-2 shrink-0 shadow-2xs">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[9px] font-bold text-gray-600 flex items-center"><Paperclip className="w-3 h-3 mr-1"/> 添付ファイル(最大2)</span>
                {attachments.length < 2 && (
                  <label className={`cursor-pointer px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded text-[9px] font-bold text-gray-700 hover:bg-gray-100 flex items-center transition-colors shadow-2xs ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isUploading ? <Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" /> : <UploadCloud className="w-2.5 h-2.5 mr-0.5" />} 追加
                    <input type="file" className="hidden" multiple onChange={handleFileUpload} ref={fileInputRef} />
                  </label>
                )}
              </div>
              {attachments.length > 0 && (
                <div className="flex flex-col gap-1">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 border border-gray-200 p-1 rounded shadow-2xs">
                      <div className="flex items-center gap-1 overflow-hidden">
                        <div className="p-0.5 bg-blue-50 text-blue-600 rounded"><FileIcon className="w-2.5 h-2.5" /></div>
                        <span className="text-[9px] font-bold text-gray-700 truncate max-w-[100px]">{file.name}</span>
                      </div>
                      <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右カラム (タイトルと本文) */}
          <div className="flex-1 flex flex-col min-w-0 gap-2">
            {uiAlert.show && (
              <div className={`p-1.5 rounded text-[10px] font-bold flex items-center shadow-sm animate-fade-in ${uiAlert.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {uiAlert.type === "success" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />} {uiAlert.message}
              </div>
            )}

            <div>
              <label className="block text-[9px] font-bold text-gray-500 mb-0.5">タイトル <span className="text-red-500">*</span></label>
              <input
                type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                className={`w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-black text-gray-900 focus:outline-none focus:ring-2 ${isExternal ? 'focus:ring-blue-500' : c.ring} shadow-sm`}
                placeholder="件名を入力してください"
              />
            </div>

            <div className="flex-1 flex flex-col min-h-[250px]">
              <label className="block text-[9px] font-bold text-gray-500 mb-0.5">本文 <span className="text-red-500">*</span></label>
              
              <div className="flex flex-wrap items-center gap-0.5 mb-0.5 p-1 bg-white border border-gray-200 rounded-t-lg shrink-0 border-b-0 shadow-sm">
                <button type="button" onClick={() => applyFormat('foreColor', '#111827')} className="w-3.5 h-3.5 rounded-full bg-gray-900 border border-gray-300 hover:scale-110 shadow-2xs"></button>
                <button type="button" onClick={() => applyFormat('foreColor', '#ef4444')} className="w-3.5 h-3.5 rounded-full bg-red-500 border border-gray-300 hover:scale-110 shadow-2xs"></button>
                <button type="button" onClick={() => applyFormat('foreColor', '#3b82f6')} className="w-3.5 h-3.5 rounded-full bg-blue-500 border border-gray-300 hover:scale-110 shadow-2xs"></button>
                <div className="w-px h-3 bg-gray-300 mx-0.5"></div>
                
                <button type="button" onClick={() => applyFormat('hiliteColor', '#fef08a')} className="w-3.5 h-3.5 rounded-full bg-yellow-200 border border-gray-300 hover:scale-110 shadow-2xs"></button>
                <button type="button" onClick={() => applyFormat('hiliteColor', '#fbcfe8')} className="w-3.5 h-3.5 rounded-full bg-pink-200 border border-gray-300 hover:scale-110 shadow-2xs"></button>
                <button type="button" onClick={() => applyFormat('hiliteColor', '#bbf7d0')} className="w-3.5 h-3.5 rounded-full bg-green-200 border border-gray-300 hover:scale-110 shadow-2xs"></button>
                <div className="w-px h-3 bg-gray-300 mx-0.5"></div>

                <button type="button" onClick={() => applyFormat('bold')} className="p-1 hover:bg-gray-100 rounded text-gray-700" title="太字"><Bold className="w-3 h-3" /></button>
                <button type="button" onClick={() => applyFormat('italic')} className="p-1 hover:bg-gray-100 rounded text-gray-700" title="斜体"><Italic className="w-3 h-3" /></button>
                <button type="button" onClick={() => applyFormat('underline')} className="p-1 hover:bg-gray-100 rounded text-gray-700" title="下線"><Underline className="w-3 h-3" /></button>
                <div className="w-px h-3 bg-gray-300 mx-0.5"></div>

                <div className="w-16">
                  <CustomSelect 
                    value={fontSize}
                    onChange={(val) => {
                      setFontSize(val);
                      applyFormat('fontSize', val);
                    }}
                    options={[
                      { value: "2", label: "小" },
                      { value: "3", label: "中" },
                      { value: "5", label: "大" }
                    ]}
                    buttonClassName="flex items-center justify-between py-0.5 px-1.5 text-[10px] border border-gray-300 rounded text-gray-700 bg-white hover:bg-gray-50 outline-none font-bold w-full"
                  />
                </div>
                <div className="w-px h-3 bg-gray-300 mx-0.5"></div>

                <button type="button" onClick={handleLink} className="p-1 hover:bg-gray-100 rounded text-gray-600" title="リンク挿入"><LinkIcon className="w-3 h-3" /></button>
              </div>
              
              <div
                ref={editorRef} contentEditable onInput={(e) => setContent(e.currentTarget.innerHTML)}
                className={`flex-1 bg-white border border-gray-300 rounded-b-lg p-2 text-xs text-gray-900 focus:outline-none focus:ring-2 ${isExternal ? 'focus:ring-blue-500' : c.ring} overflow-y-auto custom-scrollbar leading-relaxed shadow-sm [&_a]:text-blue-600 [&_a]:underline [&_b]:font-black [&_i]:italic [&_u]:underline [&_font[size="2"]]:text-[10px] [&_font[size="3"]]:text-xs [&_font[size="5"]]:text-base [&_span[style*="background-color"]]:px-1 [&_span[style*="background-color"]]:rounded-sm`}
              />
            </div>

            <div className="pt-2 mt-auto shrink-0 flex justify-end">
              <button
                type="submit" disabled={isSubmitting || isUploading || !title.trim() || !content.trim() || !publishStartDate}
                className={`w-full sm:w-auto justify-center px-6 py-2 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-md transition-all flex items-center ${
                  isExternal ? 'bg-red-600 hover:bg-red-700 ring-2 ring-red-600 ring-offset-2' : editingAnnouncement ? 'bg-amber-600 hover:bg-amber-700' : `${c.bg} ${c.hover}`
                }`}
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : (isExternal ? <Globe className="w-3.5 h-3.5 mr-1.5" /> : editingAnnouncement ? <Edit2 className="w-3.5 h-3.5 mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />)}
                {isExternal ? "外部へ公開して配信" : editingAnnouncement ? "編集内容を保存" : "連絡事項を配信"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {showCategoryWarning && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in rounded-2xl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs overflow-hidden p-5 text-center border border-gray-100">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <h3 className="text-xs font-black text-gray-900 mb-2">カテゴリ未設定</h3>
            <p className="text-[10px] font-medium text-gray-500 mb-4">本当にカテゴリなしで投稿しますか？</p>
            <div className="flex gap-2">
              <button onClick={() => setShowCategoryWarning(false)} className="flex-1 py-1.5 bg-white border border-gray-300 text-gray-700 text-[10px] font-bold rounded-lg hover:bg-gray-50">戻って設定</button>
              <button onClick={handleCategoryBypass} className="flex-1 py-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-lg hover:bg-amber-600 shadow-sm">そのまま進む</button>
            </div>
          </div>
        </div>
      )}

      {showExternalWarning && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in rounded-2xl">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-5 text-center border border-red-200">
            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3 border border-red-200 shadow-inner">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-black text-gray-900 mb-2">外部公開の最終確認</h3>
            <p className="text-[10px] font-bold text-red-600 leading-relaxed mb-4 bg-red-50 p-2 rounded-lg border border-red-100">
              この連絡事項は<br className="hidden sm:block"/>「外部ゲスト」にも配信されます。<br/>内部情報が漏洩する可能性はありませんか？
            </p>

            <div className="mb-4 p-2.5 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setIsInternalAlso(!isInternalAlso)}>
              <div className="text-left">
                <p className="text-[11px] font-black text-gray-900">メンバー用ポータルにも配信する</p>
              </div>
              <div className={`w-8 h-4 rounded-full flex items-center transition-colors shrink-0 ${isInternalAlso ? 'bg-blue-600' : 'bg-gray-300'}`}>
                <div className={`w-3 h-3 bg-white rounded-full transition-transform shadow-sm ${isInternalAlso ? 'translate-x-4' : 'translate-x-1'}`}></div>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <button onClick={confirmSubmit} className="w-full py-2 bg-red-600 text-white text-[11px] font-bold rounded-lg hover:bg-red-700 shadow-md transition-colors">はい、確定して配信します</button>
              <button onClick={() => setShowExternalWarning(false)} className="w-full py-2 bg-gray-100 border border-gray-200 text-gray-700 text-[11px] font-bold rounded-lg hover:bg-gray-200 transition-colors">いいえ、戻って確認します</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}