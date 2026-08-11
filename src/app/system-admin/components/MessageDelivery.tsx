"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { collection, query, orderBy, getDocs, deleteDoc, doc } from "firebase/firestore";
import { getStorage, ref, deleteObject } from "firebase/storage";
import { db } from "@/lib/firebase";
import { Send, BellRing, Loader2, X, Pin, AlertTriangle, Calendar, User, Info, CheckSquare, Trash2, Edit2, Wrench, CalendarDays, RefreshCw, ClipboardList, FileText, Building2, Link as LinkIcon, Globe, Paperclip, Eye, Download } from "lucide-react";
import { GlobalUserData, TenantData } from "../page";

import MessageForm from "./MessageForm";
import MessageHistory from "./MessageHistory";
import MessageResponses from "./MessageResponses";
import ActiveMessagesByTenant from "./ActiveMessagesByTenant";
import { useDialog } from "@/components/DialogContext"; // ★追加

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

const DEPARTMENT_LABELS: Record<string, string> = {
  manager: "マネージャー権限層",
  role_teacher: "教職員",
  role_officer: "生徒会役員",
  role_student: "一般生徒",
  role_admin: "管理者"
};

type Props = {
  tenants: TenantData[];
  users: GlobalUserData[];
};

export default function MessageDelivery({ tenants, users }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showAlert, showConfirm } = useDialog(); // ★追加

  const tab = searchParams.get("tab") || "history";
  const editId = searchParams.get("editId");
  const viewId = searchParams.get("viewId");

  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const setQueryParams = useCallback((paramsToUpdate: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(paramsToUpdate).forEach(([key, value]) => {
      if (value === null) params.delete(key);
      else params.set(key, value);
    });
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router]);

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "system_messages"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const fetched: SystemMessage[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data() as any;
        fetched.push({ id: docSnap.id, ...data } as SystemMessage);
      });
      setMessages(fetched);
    } catch (error) {
      showAlert("履歴の取得に失敗しました。", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

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
      showAlert("削除しました。", "success");
      if (viewId === id) setQueryParams({ viewId: null });
    } catch (e) {
      showAlert("削除に失敗しました。", "error");
    }
  };

  const requestDelete = (id: string) => {
    // ★ 独自のダイアログステートを廃止し、共通ダイアログに変更
    showConfirm(
      "このメッセージを削除しますか？\n添付ファイルも完全に削除され、元に戻せません。", 
      () => executeDelete(id),
      "danger",
      "削除の確認"
    );
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

  const selectedMessageToView = useMemo(() => messages.find(m => m.id === viewId) || null, [messages, viewId]);
  const selectedMessageToEdit = useMemo(() => messages.find(m => m.id === editId) || null, [messages, editId]);

  const getTargetName = (msg: SystemMessage) => {
    if (msg.targetType === "tenant") {
      const tIds = msg.targetIds || (msg.targetId ? [msg.targetId] : []);
      if (tIds.length === 0) return "指定なし";
      return tIds.map(tid => tenants.find(t => t.id === tid)?.name || "不明なテナント").join(", ");
    }
    if (msg.targetType === "department") {
      if (!msg.targetDepartments || msg.targetDepartments.length === 0) return "指定なし";
      return msg.targetDepartments.map(dep => DEPARTMENT_LABELS[dep] || dep.replace("pos_", "")).join(", ");
    }
    if (msg.targetType === "user") {
      if (!msg.targetIds || msg.targetIds.length === 0) return "指定なし";
      return msg.targetIds.map(uid => {
        const u = users.find(user => user.id === uid);
        const tName = u ? (tenants.find(t => t.id === u.schoolId)?.name || "不明") : "不明";
        return `${u?.name || "不明"} (${tName})`;
      }).join(", ");
    }
    return "SCPS一斉";
  };

  const getTargetTenants = (msg: SystemMessage) => {
    if (msg.targetType === "all") return tenants.map(t => t.id);
    if (msg.targetType === "tenant") return msg.targetIds && msg.targetIds.length > 0 ? msg.targetIds : (msg.targetId ? [msg.targetId] : []);
    if (msg.targetType === "department" || msg.targetType === "user") {
      const userIds = msg.targetIds || [];
      const tIds = new Set<string>();
      userIds.forEach(uid => {
        const u = users.find(user => user.id === uid);
        if (u) tIds.add(u.schoolId);
      });
      return Array.from(tIds);
    }
    return [];
  };

  const getTenantCompletion = (msg: SystemMessage, tenantId: string) => {
    let tUsers = [];
    if (msg.targetType === "all" || msg.targetType === "tenant") {
      tUsers = users.filter(u => u.schoolId === tenantId);
    } else {
      tUsers = users.filter(u => u.schoolId === tenantId && msg.targetIds?.includes(u.id));
    }
    const total = tUsers.length;
    if (total === 0) return { total: 0, responded: 0, isCompleted: true, unresponded: [], respondedUsers: [] }; 
    
    const respondedUsers = tUsers.filter(u => msg.responses?.includes(u.id));
    const unresponded = tUsers.filter(u => !msg.responses?.includes(u.id));
    const isCompleted = msg.responseType === "single" ? respondedUsers.length > 0 : respondedUsers.length >= total;
    
    return { total, responded: respondedUsers.length, isCompleted, unresponded, respondedUsers };
  };

  return (
    <div className="space-y-6 relative">
      <div>
        <h3 className="text-xl font-extrabold text-gray-900">特権システムメッセージ配信</h3>
        <p className="text-sm text-gray-500 mt-1">システム全体、または特定テナント宛てにメッセージを配信・管理します。</p>
      </div>

      <div className="bg-white border-b border-gray-200 rounded-t-2xl px-2 pt-2">
        <nav className="flex space-x-2 overflow-x-auto custom-scrollbar" aria-label="Tabs">
          <button onClick={() => setQueryParams({ tab: "history", editId: null, viewId: null })} className={`flex items-center px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${tab === "history" ? "border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
            <BellRing className="w-4 h-4 mr-2" /> 配信履歴一覧
          </button>
          <button onClick={() => setQueryParams({ tab: "responses", editId: null, viewId: null })} className={`flex items-center px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${tab === "responses" ? "border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
            <CheckSquare className="w-4 h-4 mr-2" /> 対応状況の確認
          </button>
          <button onClick={() => setQueryParams({ tab: "active_by_tenant", editId: null, viewId: null })} className={`flex items-center px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${tab === "active_by_tenant" ? "border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
            <Building2 className="w-4 h-4 mr-2" /> テナント別 配信中
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
            {tab === "history" && <MessageHistory messages={messages} tenants={tenants} users={users} setQueryParams={setQueryParams} requestDelete={requestDelete} />}
            {tab === "responses" && <MessageResponses messages={messages} tenants={tenants} users={users} setQueryParams={setQueryParams} />}
            {tab === "active_by_tenant" && <ActiveMessagesByTenant messages={messages} tenants={tenants} users={users} setQueryParams={setQueryParams} />}
            {tab === "form" && (
              <MessageForm 
                tenants={tenants} users={users} 
                // MessageForm側が古いshowAlertの引数順序(type, msg)を要求している場合への安全なブリッジ
                showAlert={(type, msg) => showAlert(msg, type)} 
                editMessage={selectedMessageToEdit} 
                onSuccess={() => { fetchMessages(); setQueryParams({ tab: "history", editId: null }); }}
                onCancel={() => setQueryParams({ tab: "history", editId: null })}
              />
            )}
          </>
        )}
      </div>

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
              <div className="text-[10px] text-gray-500 flex flex-col gap-1 font-bold border-b border-gray-100 pb-3 mb-3">
                <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" />配信: {selectedMessageToView.startAt ? selectedMessageToView.startAt.replace("T", " ") : new Date(selectedMessageToView.createdAt).toLocaleString()}</span>
                <span className="flex items-center"><User className="w-3 h-3 mr-1" />配信元: {selectedMessageToView.showSenderName && selectedMessageToView.senderName ? selectedMessageToView.senderName : "システム管理者"}</span>
                <span className="flex items-start w-full mt-1">
                  <Globe className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                  <span className="leading-tight">宛先: {getTargetName(selectedMessageToView)}</span>
                </span>
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

              {selectedMessageToView.requireResponse && (
                <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3 animate-fade-in">
                  <div className="flex justify-between items-center mb-2 border-b border-blue-100 pb-2">
                    <span className="text-xs font-bold text-blue-900 flex items-center">
                      <CheckSquare className="w-4 h-4 mr-1.5 text-blue-600" />
                      テナント別の対応状況 ({selectedMessageToView.responseType === 'single' ? "誰か1人で完了" : "全員必須"})
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar mt-2">
                    {(() => {
                      const tIds = getTargetTenants(selectedMessageToView);
                      return tIds.map(tid => {
                        const t = tenants.find(tenant => tenant.id === tid);
                        const comp = getTenantCompletion(selectedMessageToView, tid);
                        if (comp.total === 0) return null;

                        return (
                          <div key={tid} className="border border-blue-200 rounded p-2 bg-white flex flex-col gap-1.5">
                            <div className="flex justify-between items-center border-b border-gray-100 pb-1">
                              <span className="text-[10px] font-bold text-gray-800">{t?.name || "不明"}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${comp.isCompleted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {comp.isCompleted ? '完了' : '未完'} ({comp.responded}/{comp.total})
                              </span>
                            </div>
                            {selectedMessageToView.responseType === "single" ? (
                              comp.isCompleted ? (
                                <span className="text-[9px] text-gray-600 font-medium">対応者: {comp.respondedUsers.map(u=>u.name).join(", ")}</span>
                              ) : (
                                <span className="text-[9px] text-gray-400 font-medium">テナント内の誰か1人の対応待ち</span>
                              )
                            ) : (
                              comp.isCompleted ? (
                                <span className="text-[9px] text-green-600 font-bold">全員対応済み</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {comp.unresponded.map(u => <span key={u.id} className="text-[8px] bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded text-gray-600">{u.name}</span>)}
                                </div>
                              )
                            )}
                          </div>
                        )
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center rounded-b-2xl">
              <div className="flex gap-2">
                <button onClick={() => setQueryParams({ tab: "form", editId: selectedMessageToView.id, viewId: null })} className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center">
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> 編集
                </button>
                <button onClick={() => requestDelete(selectedMessageToView.id)} className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> 削除
                </button>
              </div>
              <button onClick={() => setQueryParams({ viewId: null })} className="px-5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-md transition-colors">閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}