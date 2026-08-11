"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { collection, query, orderBy, getDocs, deleteDoc, doc, updateDoc, arrayRemove, arrayUnion } from "firebase/firestore";
import { getStorage, ref, deleteObject } from "firebase/storage";
import { db } from "@/lib/firebase";
import { Send, BellRing, Loader2, X, Pin, AlertTriangle, Calendar, User, Info, CheckSquare, Trash2, Edit2, Wrench, CalendarDays, RefreshCw, ClipboardList, FileText, ShieldAlert, Paperclip, Download, Eye } from "lucide-react";
import { UserData, SchoolData } from "../page";

import MessageForm from "./MessageForm";
import MessageHistory from "./MessageHistory";
import MessageResponses from "./MessageResponses";

export type MessageCategory = "info" | "warning" | "maintenance" | "event" | "update" | "survey" | "report";

export type SystemMessageAttachment = {
  name: string;
  url: string;
  type: string;
  size: number;
  path: string;
};

export type SystemMessage = {
  id: string;
  title: string;
  content: string;
  category: MessageCategory;
  subBadge?: "none" | "update1" | "update2";
  revision?: number;
  targetType: "all" | "tenant" | "department" | "user";
  targetId: string;
  targetIds?: string[];
  targetDepartments?: string[];
  startAt: string;
  endAt: string;
  isDismissible: boolean;
  isImportant: boolean;
  requireResponse?: boolean;
  responseType?: "single" | "all";
  responses?: string[];
  attachments?: SystemMessageAttachment[];
  createdAt: string;
  readBy?: string[];
  schoolId?: string;
  senderId?: string;
  senderName?: string;
  senderRole?: string;
  senderSchoolId?: string;
  showSenderName?: boolean;
};

export const CATEGORIES: Record<MessageCategory, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  info: { label: "お知らせ", icon: <Info className="h-3.5 w-3.5" />, color: "text-blue-700 border-blue-200", bgColor: "bg-blue-50" },
  warning: { label: "警告・重要", icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "text-red-700 border-red-200", bgColor: "bg-red-50" },
  maintenance: { label: "メンテナンス", icon: <Wrench className="h-3.5 w-3.5" />, color: "text-orange-700 border-orange-200", bgColor: "bg-orange-50" },
  event: { label: "イベント", icon: <CalendarDays className="h-3.5 w-3.5" />, color: "text-green-700 border-green-200", bgColor: "bg-green-50" },
  update: { label: "アップデート", icon: <RefreshCw className="h-3.5 w-3.5" />, color: "text-indigo-700 border-indigo-200", bgColor: "bg-indigo-50" },
  survey: { label: "アンケート", icon: <ClipboardList className="h-3.5 w-3.5" />, color: "text-teal-700 border-teal-200", bgColor: "bg-teal-50" },
  report: { label: "活動報告", icon: <FileText className="h-3.5 w-3.5" />, color: "text-purple-700 border-purple-200", bgColor: "bg-purple-50" },
};

type Props = {
  schoolData: SchoolData | null;
  users: UserData[];
  currentUser: UserData | null;
  showAlert: (type: "success" | "error" | "warning", message: string) => void;
};

export default function MessageDelivery({ schoolData, users, currentUser, showAlert }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = searchParams.get("tab") || "history";
  const editId = searchParams.get("editId");
  const viewId = searchParams.get("viewId");

  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean; message: string; onConfirm: () => void } | null>(null);
  const [unauthorizedAccess, setUnauthorizedAccess] = useState(false);

  const setQueryParams = useCallback((paramsToUpdate: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(paramsToUpdate).forEach(([key, value]) => {
      if (value === null) params.delete(key);
      else params.set(key, value);
    });
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router]);

  const fetchMessages = useCallback(async () => {
    if (!schoolData) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, "system_messages"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const fetched: SystemMessage[] = [];
      const myUserIds = new Set(users.map(u => u.id));
      const now = new Date();
      
      snap.forEach(docSnap => {
        const rawData = docSnap.data() as any;
        const msg = { id: docSnap.id, ...rawData } as SystemMessage;

        const isSystemMsg = msg.senderRole === "system_admin" || msg.schoolId === "SYSTEM";

        if (isSystemMsg && msg.startAt && new Date(msg.startAt) > now) {
          return; 
        }

        const isAll = msg.targetType === "all";
        const tIds = msg.targetIds || (msg.targetId ? [msg.targetId] : []);
        const isMyTenant = msg.targetType === "tenant" && tIds.includes(schoolData.id);
        const isMyUser = (msg.targetType === "user" || msg.targetType === "department") && (
          myUserIds.has(msg.targetId) || 
          (msg.targetIds && msg.targetIds.some(uid => myUserIds.has(uid)))
        );
        const isFromMySchool = msg.schoolId === schoolData.id || msg.senderSchoolId === schoolData.id;
        
        if (isAll || isMyTenant || isMyUser || isFromMySchool) {
          fetched.push(msg);
        }
      });
      setMessages(fetched);
    } catch (error) {
      showAlert("error", "履歴の取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [schoolData, users, showAlert]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (tab === "form" && editId && messages.length > 0) {
      const msg = messages.find(m => m.id === editId);
      if (msg && (msg.senderRole === "system_admin" || msg.schoolId === "SYSTEM")) {
        setUnauthorizedAccess(true);
      } else {
        setUnauthorizedAccess(false);
      }
    } else {
      setUnauthorizedAccess(false);
    }
  }, [tab, editId, messages]);

  const executeDelete = async (id: string) => {
    try {
      const msgToDelete = messages.find(m => m.id === id);
      if (msgToDelete?.attachments && msgToDelete.attachments.length > 0) {
        const storage = getStorage();
        for (const att of msgToDelete.attachments) {
          if (att.path) {
            const fileRef = ref(storage, att.path);
            await deleteObject(fileRef).catch(e => console.error("File delete error", e));
          }
        }
      }

      await deleteDoc(doc(db, "system_messages", id));
      setMessages(messages.filter(m => m.id !== id));
      showAlert("success", "削除しました。");
      if (viewId === id) setQueryParams({ viewId: null });
    } catch (e) {
      showAlert("error", "削除に失敗しました。");
    } finally {
      setConfirmDialog(null);
    }
  };

  const requestDelete = (id: string) => {
    setConfirmDialog({ show: true, message: "このメッセージを削除しますか？\n添付ファイルも完全に削除され、元に戻せません。", onConfirm: () => executeDelete(id) });
  };

  const handleDownload = async (url: string, filename: string, e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      window.open(url, '_blank');
    }
  };

  // ★ 追加：対応状況のトグル処理
  const handleToggleResponse = async (msg: SystemMessage) => {
    if (!currentUser) return;
    const isResponded = msg.responses?.includes(currentUser.id);
    const newResponses = isResponded 
      ? (msg.responses || []).filter(id => id !== currentUser.id) 
      : [...(msg.responses || []), currentUser.id];

    // ローカルステートを更新してUIに即時反映
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, responses: newResponses } : m));

    try {
      await updateDoc(doc(db, "system_messages", msg.id), {
        responses: isResponded ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id)
      });
    } catch (error: any) { 
      showAlert("error", "通信エラーにより対応状況が保存されませんでした。"); 
      // 失敗時は元の状態に戻す
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, responses: msg.responses } : m));
    }
  };

  const selectedMessageToView = useMemo(() => messages.find(m => m.id === viewId) || null, [messages, viewId]);
  const selectedMessageToEdit = useMemo(() => messages.find(m => m.id === editId) || null, [messages, editId]);

  return (
    <div className="space-y-6 relative">
      <div>
        <h3 className="text-xl font-extrabold text-gray-900">組織内メッセージ配信</h3>
        <p className="text-sm text-gray-500 mt-1">お知らせの配信、履歴管理、対応状況の確認を行います。</p>
      </div>

      <div className="bg-white border-b border-gray-200 rounded-t-2xl px-2 pt-2">
        <nav className="flex space-x-2 overflow-x-auto custom-scrollbar" aria-label="Tabs">
          <button onClick={() => setQueryParams({ tab: "history", editId: null, viewId: null })} className={`flex items-center px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${tab === "history" ? "border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
            <BellRing className="w-4 h-4 mr-2" /> 配信履歴一覧
          </button>
          <button onClick={() => setQueryParams({ tab: "responses", editId: null, viewId: null })} className={`flex items-center px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${tab === "responses" ? "border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
            <CheckSquare className="w-4 h-4 mr-2" /> 対応状況の確認
          </button>
          <button onClick={() => setQueryParams({ tab: "form", editId: null, viewId: null })} className={`flex items-center px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${tab === "form" ? "border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
            <Send className="w-4 h-4 mr-2" /> {editId ? "メッセージの編集" : "新規メッセージ作成"}
          </button>
        </nav>
      </div>

      <div className="animate-fade-in bg-white rounded-b-2xl shadow-sm border border-gray-200 min-h-[500px]">
        {isLoading ? (
          <div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
        ) : (
          <>
            {tab === "history" && <MessageHistory messages={messages} users={users} setQueryParams={setQueryParams} requestDelete={requestDelete} />}
            {tab === "responses" && <MessageResponses messages={messages} users={users} setQueryParams={setQueryParams} />}
            {tab === "form" && !unauthorizedAccess && (
              <MessageForm 
                schoolData={schoolData} users={users} currentUser={currentUser} showAlert={showAlert}
                editMessage={selectedMessageToEdit} 
                onSuccess={() => { fetchMessages(); setQueryParams({ tab: "history", editId: null }); }}
                onCancel={() => setQueryParams({ tab: "history", editId: null })}
              />
            )}
          </>
        )}
      </div>

      {unauthorizedAccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden p-6 sm:p-8 text-center border border-gray-100">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm border border-red-100">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">編集が禁止されています</h3>
            <p className="text-sm font-bold text-gray-500 mb-6 leading-relaxed whitespace-pre-wrap">
              システム管理者が発行したお知らせのため、このアカウントでは編集や更新を行うことができません。
            </p>
            <button 
              onClick={() => {
                setUnauthorizedAccess(false);
                setQueryParams({ tab: "history", editId: null });
              }} 
              className="w-full py-3 bg-gray-900 text-white text-sm font-black rounded-xl hover:bg-black shadow-lg transition-all active:scale-[0.98]"
            >
              一覧へ戻る
            </button>
          </div>
        </div>
      )}

      {selectedMessageToView && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-gray-200">
            <div className="p-3.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${CATEGORIES[selectedMessageToView.category || "info"]?.bgColor || "bg-blue-50"} ${CATEGORIES[selectedMessageToView.category || "info"]?.color || "text-blue-700 border-blue-200"}`}>
                  {CATEGORIES[selectedMessageToView.category || "info"]?.icon}
                  {CATEGORIES[selectedMessageToView.category || "info"]?.label || "お知らせ"}
                </span>
                {selectedMessageToView.subBadge === "update1" && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">更新①</span>}
                {selectedMessageToView.subBadge === "update2" && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-800 border border-orange-200">更新②</span>}
                {selectedMessageToView.isImportant && <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white flex items-center shadow-xs"><AlertTriangle className="w-2.5 h-2.5 mr-0.5" />緊急</span>}
              </div>
              <button onClick={() => setQueryParams({ viewId: null })} className="p-1 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"><X className="h-5 w-5" /></button>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <h3 className="text-lg font-black text-gray-900 leading-snug mb-3">{selectedMessageToView.title}</h3>
              <div className="text-[10px] text-gray-500 flex flex-wrap gap-3 font-bold border-b border-gray-100 pb-3 mb-3">
                <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" />配信: {selectedMessageToView.startAt ? selectedMessageToView.startAt.replace("T", " ") : new Date(selectedMessageToView.createdAt).toLocaleString()}</span>
                <span className="flex items-center"><User className="w-3 h-3 mr-1" />配信元: {selectedMessageToView.showSenderName && selectedMessageToView.senderName ? selectedMessageToView.senderName : "テナント管理者"}</span>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-100">
                {selectedMessageToView.content}
              </div>

              {selectedMessageToView.attachments && selectedMessageToView.attachments.length > 0 && (
                <div className="mt-5 border-t border-gray-100 pt-4">
                  <span className="text-[10px] font-bold text-gray-500 block mb-2">添付ファイル</span>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedMessageToView.attachments.map((att, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
                        <div className="flex items-center gap-2 overflow-hidden pr-2">
                          <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-xs font-bold text-gray-700 truncate">{att.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition-colors flex items-center">
                            <Eye className="w-3 h-3 mr-1" /> 表示
                          </a>
                          <button onClick={(e) => handleDownload(att.url, att.name, e)} className="px-2.5 py-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg transition-colors flex items-center">
                            <Download className="w-3 h-3 mr-1" /> DL
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center rounded-b-2xl">
              <div className="flex gap-2">
                {!(selectedMessageToView.senderRole === "system_admin" || selectedMessageToView.schoolId === "SYSTEM") && (
                  <>
                    <button onClick={() => setQueryParams({ tab: "form", editId: selectedMessageToView.id, viewId: null })} className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center">
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> 編集
                    </button>
                    <button onClick={() => requestDelete(selectedMessageToView.id)} className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center">
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> 削除
                    </button>
                  </>
                )}
              </div>

              {/* ★ 追加：自分が対応するためのボタン */}
              <div className="flex gap-2">
                {selectedMessageToView.requireResponse && currentUser && (
                  <button 
                    onClick={() => handleToggleResponse(selectedMessageToView)} 
                    className={`px-4 py-2 text-xs font-bold rounded-xl shadow-sm flex items-center transition-colors ${
                      selectedMessageToView.responses?.includes(currentUser.id) 
                        ? "bg-white border border-green-500 text-green-600 hover:bg-green-50"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                    {selectedMessageToView.responses?.includes(currentUser.id) ? "対応済み（解除する）" : "対応済みにする"}
                  </button>
                )}
                <button onClick={() => setQueryParams({ viewId: null })} className="px-5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-md transition-colors">閉じる</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDialog?.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-5 text-center border border-gray-100">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-xs font-black text-gray-900 mb-5 leading-relaxed whitespace-pre-wrap">{confirmDialog.message}</h3>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors">キャンセル</button>
              <button onClick={confirmDialog.onConfirm} className="flex-1 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 shadow-sm transition-colors">削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}