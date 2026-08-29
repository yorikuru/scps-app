"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { collection, query, onSnapshot, doc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BellRing, X, Trash2, AlertTriangle, CheckSquare, Edit2, Link as LinkIcon, Calendar, User, Globe, Pin, Paperclip, Download } from "lucide-react";
import { UserData, SystemMessage } from "../page"; 
import { useDialog } from "@/components/DialogContext";

export type ExtendedSystemMessage = Omit<SystemMessage, "targetType"> & {
  isPinned?: boolean;
  category?: string;
  subBadge?: "none" | "update1" | "update2";
  revision?: number;
  startAt?: string;
  showSenderName?: boolean;
  senderName?: string;
  senderRole?: string;
  targetType?: "all" | "tenant" | "department" | "user";
  targetId?: string;
  targetIds?: string[];
  targetDepartments?: string[];
  readBy?: string[];
  isDismissible?: boolean;
  isImportant?: boolean;
  requireResponse?: boolean;
  responseType?: "single" | "all";
  responses?: string[];
  attachments?: { name: string; url: string; size?: number; type?: string }[];
};

function InfoIcon({ className }: { className?: string }) { return <svg className={className || "w-2.5 h-2.5 sm:w-3 sm:h-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>; }
function WrenchIcon({ className }: { className?: string }) { return <svg className={className || "w-2.5 h-2.5 sm:w-3 sm:h-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>; }
function RefreshIcon({ className }: { className?: string }) { return <svg className={className || "w-2.5 h-2.5 sm:w-3 sm:h-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>; }
function ClipboardIcon({ className }: { className?: string }) { return <svg className={className || "w-2.5 h-2.5 sm:w-3 sm:h-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>; }
function FileIcon({ className }: { className?: string }) { return <svg className={className || "w-2.5 h-2.5 sm:w-3 sm:h-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>; }

const CATEGORIES: Record<string, { label: string; badgeBg: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  info: { label: "お知らせ", badgeBg: "bg-blue-100 text-blue-700", color: "text-blue-700 border-blue-200", bgColor: "bg-blue-50", icon: <InfoIcon/> },
  warning: { label: "重要", badgeBg: "bg-red-100 text-red-700", color: "text-red-700 border-red-200", bgColor: "bg-red-50", icon: <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> },
  maintenance: { label: "メンテ", badgeBg: "bg-orange-100 text-orange-700", color: "text-orange-700 border-orange-200", bgColor: "bg-orange-50", icon: <WrenchIcon/> },
  event: { label: "イベント", badgeBg: "bg-green-100 text-green-700", color: "text-green-700 border-green-200", bgColor: "bg-green-50", icon: <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> },
  update: { label: "アップデート", badgeBg: "bg-indigo-100 text-indigo-700", color: "text-indigo-700 border-indigo-200", bgColor: "bg-indigo-50", icon: <RefreshIcon/> },
  survey: { label: "アンケート", badgeBg: "bg-teal-100 text-teal-700", color: "text-teal-700 border-teal-200", bgColor: "bg-teal-50", icon: <ClipboardIcon/> },
  report: { label: "活動報告", badgeBg: "bg-purple-100 text-purple-700", color: "text-purple-700 border-purple-200", bgColor: "bg-purple-50", icon: <FileIcon/> },
};

const DEPARTMENT_LABELS: Record<string, string> = {
  manager: "マネージャー権限層",
  role_teacher: "教職員",
  role_officer: "生徒会役員",
  role_student: "一般生徒",
  role_admin: "管理者"
};

type Props = {
  userData: UserData | null;
  messages: ExtendedSystemMessage[];
  tenantUsers: UserData[]; 
};

export default function AdminNotificationWidget({ userData, messages, tenantUsers }: Props) {
  const [localMessages, setLocalMessages] = useState<ExtendedSystemMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ExtendedSystemMessage | null>(null);
  const [notificationStates, setNotificationStates] = useState<Record<string, any>>({});
  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean, message: string, onConfirm: () => void } | null>(null);

  const { showAlert } = useDialog();

  const searchParams = useSearchParams();
  const directMsgId = searchParams.get("msgId");

  const canManageMessages = userData?.role === "admin" || (userData as any)?.isITManager;

  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (directMsgId && localMessages.length > 0 && !selectedMessage) {
      const target = localMessages.find(m => m.id === directMsgId);
      if (target) setSelectedMessage(target);
    }
  }, [directMsgId, localMessages]);

  useEffect(() => {
    if (!userData) return;
    const qNotifStates = query(collection(db, "users", userData.id, "notification_states"));
    const unsubNotifStates = onSnapshot(qNotifStates, (snapshot) => {
      const states: Record<string, any> = {};
      snapshot.forEach(d => { states[d.id] = d.data(); });
      setNotificationStates(states);
    });
    return () => unsubNotifStates();
  }, [userData]);

  const getMyTenantTargetUsers = (msg: ExtendedSystemMessage) => {
    if (msg.targetType === "all" || msg.targetType === "tenant") return tenantUsers;
    if (msg.targetType === "user" || msg.targetType === "department") {
      return tenantUsers.filter(u => msg.targetIds?.includes(u.id));
    }
    return [];
  };

  const getTargetName = (msg: ExtendedSystemMessage) => {
    if (msg.targetType === "all") return "SCPS一斉";
    if (msg.targetType === "tenant") return "テナント全体";
    if (msg.targetType === "department") {
      if (!msg.targetDepartments || msg.targetDepartments.length === 0) return "指定なし";
      return msg.targetDepartments.map(dep => DEPARTMENT_LABELS[dep] || dep.replace("pos_", "")).join(", ");
    }
    if (msg.targetType === "user") {
      if (!msg.targetIds || msg.targetIds.length === 0) return "指定なし";
      return msg.targetIds.map(uid => tenantUsers.find(user => user.id === uid)?.name || "不明なユーザー").join(", ");
    }
    return "SCPS一斉";
  };

  const visibleMessages = useMemo(() => {
    if (!userData) return [];
    const now = new Date();

    const filtered = localMessages.filter(msg => {
      if ((msg.senderRole === "system_admin" || msg.schoolId === "SYSTEM") && msg.startAt) {
        if (new Date(msg.startAt) > now) {
          return false;
        }
      }

      const state = notificationStates[msg.id];
      const isUpToDate = !state ? false : (state.revision || 1) >= (msg.revision || 1);
      if (isUpToDate && state.deleted) return false;
      return true; 
    });

    return filtered.sort((a, b) => {
      if (a.isImportant && !b.isImportant) return -1;
      if (!a.isImportant && b.isImportant) return 1;

      const getUnresponded = (msg: ExtendedSystemMessage) => {
        if (!msg.requireResponse) return false;
        const uList = getMyTenantTargetUsers(msg);
        if (uList.length === 0) return false;
        const respondedCount = uList.filter(u => msg.responses?.includes(u.id)).length;
        const isCompleted = msg.responseType === "single" ? respondedCount > 0 : respondedCount >= uList.length;
        return !isCompleted;
      };
      
      const aUnresp = getUnresponded(a);
      const bUnresp = getUnresponded(b);

      if (aUnresp && !bUnresp) return -1;
      if (!aUnresp && bUnresp) return 1;

      const timeA = new Date(a.startAt || a.createdAt).getTime();
      const timeB = new Date(b.startAt || b.createdAt).getTime();
      return timeB - timeA;
    });
  }, [localMessages, userData, notificationStates, tenantUsers]);

  const executeDeleteMessage = async (msgId: string) => {
    if (!userData) return;
    try {
      const msg = localMessages.find(m => m.id === msgId);
      const revision = msg?.revision || 1;
      const ref = doc(db, "users", userData.id, "notification_states", msgId);
      await setDoc(ref, { deleted: true, isRead: true, revision }, { merge: true });
      setSelectedMessage(null);
    } catch (error) {} finally { setConfirmDialog(null); }
  };

  const handleDeleteMessage = (msgId: string) => {
    setConfirmDialog({ show: true, message: "このお知らせをダッシュボードから削除しますか？", onConfirm: () => executeDeleteMessage(msgId) });
  };

  const handleToggleResponse = async (msg: ExtendedSystemMessage) => {
    if (!userData) return;
    const isResponded = msg.responses?.includes(userData.id);
    const newResponses = isResponded ? (msg.responses || []).filter(id => id !== userData.id) : [...(msg.responses || []), userData.id];

    setLocalMessages(prev => prev.map(m => m.id === msg.id ? { ...m, responses: newResponses } : m));
    setSelectedMessage(prev => prev ? { ...prev, responses: newResponses } : null);

    try {
      await updateDoc(doc(db, "system_messages", msg.id), {
        responses: isResponded ? arrayRemove(userData.id) : arrayUnion(userData.id)
      });
    } catch (error: any) { showAlert("通信エラーにより保存されませんでした。"); }
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/top?msgId=${id}`;
    navigator.clipboard.writeText(url);
    showAlert("このお知らせの直リンクURLをコピーしました！");
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col min-w-0">
        <div className="px-3.5 py-2.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-1.5">
            <h2 className="text-xs sm:text-sm font-black text-gray-900 flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" /> 管理者通知
            </h2>
            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{visibleMessages.length}件</span>
          </div>

          {canManageMessages && (
            <Link href="/top/admin/messages" className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[9px] font-bold transition-colors flex items-center gap-1 border border-blue-100">
              <Edit2 className="w-2.5 h-2.5" /> <span className="hidden sm:inline">配信管理</span>
            </Link>
          )}
        </div>

        <div className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto custom-scrollbar">
          {visibleMessages.length === 0 ? (
            <p className="text-[10px] sm:text-xs text-gray-400 text-center py-5 font-bold">通知はありません</p>
          ) : (
            visibleMessages.map(msg => {
              const uList = getMyTenantTargetUsers(msg);
              const targetCount = uList.length;
              const respondedCount = uList.filter(u => msg.responses?.includes(u.id)).length;
              const isCompleted = msg.responseType === "single" ? respondedCount > 0 : (targetCount > 0 && respondedCount >= targetCount);
              const catInfo = CATEGORIES[msg.category || "info"] || CATEGORIES.info;

              return (
                <div key={msg.id} onClick={() => setSelectedMessage(msg)} className="p-1.5 sm:p-2 hover:bg-blue-50/50 cursor-pointer transition-colors flex items-center justify-between group min-w-0">
                  <div className="flex items-center gap-1.5 overflow-hidden mr-2 min-w-0 flex-1">
                    <span className={`px-1.5 py-0.5 rounded text-[7px] sm:text-[8px] font-bold border flex-shrink-0 flex items-center gap-0.5 ${catInfo.bgColor} ${catInfo.color}`}>
                      {catInfo.label}
                    </span>
                    
                    {msg.isImportant && <span className="px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-bold bg-red-100 text-red-700 shrink-0 flex items-center"><Pin className="w-2 h-2 mr-0.5" />緊急</span>}
                    {msg.subBadge === "update1" && <span className="px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 shrink-0">更新①</span>}
                    {msg.subBadge === "update2" && <span className="px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-bold bg-orange-100 text-orange-800 border border-orange-200 shrink-0">更新②</span>}
                    
                    {msg.attachments && msg.attachments.length > 0 && (
                      <Paperclip className="w-2.5 h-2.5 text-gray-400 flex-shrink-0 hidden sm:block" />
                    )}
                    
                    <p className="text-[10px] sm:text-[11px] font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors ml-0.5 flex-1">{msg.title}</p>
                  </div>
                  
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {msg.requireResponse && (
                      isCompleted ? (
                        <span className="px-1.5 py-0.5 rounded text-[7px] sm:text-[8px] font-black bg-blue-100 text-blue-800 border border-blue-200 shadow-sm flex items-center"><CheckSquare className="w-2 h-2 mr-0.5"/>完了</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[7px] sm:text-[8px] font-bold bg-red-50 text-red-700 border border-red-100">未対応</span>
                      )
                    )}
                    <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 ml-1">
                      {msg.startAt ? msg.startAt.split("T")[0].replace(/-/g, '/').slice(5) : new Date(msg.createdAt).toLocaleDateString('ja-JP', {month: 'numeric', day: 'numeric'})}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedMessage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col border border-gray-200 max-h-[90vh]">
            <div className="p-3 sm:p-3.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className={`px-2 sm:px-2.5 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-bold border flex items-center gap-1 ${CATEGORIES[selectedMessage.category || "info"]?.bgColor || "bg-blue-50"} ${CATEGORIES[selectedMessage.category || "info"]?.color || "text-blue-700 border-blue-200"}`}>
                  {CATEGORIES[selectedMessage.category || "info"]?.icon}
                  {CATEGORIES[selectedMessage.category || "info"]?.label || "お知らせ"}
                </span>
                {selectedMessage.subBadge === "update1" && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">更新①</span>}
                {selectedMessage.subBadge === "update2" && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-800 border border-orange-200">更新②</span>}
                {selectedMessage.isImportant && <span className="px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-red-600 text-white flex items-center shadow-xs"><AlertTriangle className="w-2.5 h-2.5 mr-0.5" />緊急</span>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                <button onClick={() => copyLink(selectedMessage.id)} className="p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors" title="URLリンクをコピー"><LinkIcon className="w-4 h-4" /></button>
                <button onClick={() => setSelectedMessage(null)} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 space-y-3 overflow-y-auto custom-scrollbar flex-1">
              <h3 className="text-base sm:text-lg font-black text-gray-900 leading-snug break-words">{selectedMessage.title}</h3>
              <div className="text-[9px] sm:text-[10px] text-gray-500 flex flex-col gap-1 font-bold border-b border-gray-100 pb-3">
                <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" />配信: {selectedMessage.startAt ? selectedMessage.startAt.replace("T", " ") : new Date(selectedMessage.createdAt).toLocaleString()}</span>
                <span className="flex items-center"><User className="w-3 h-3 mr-1" />配信元: {selectedMessage.showSenderName && selectedMessage.senderName ? selectedMessage.senderName : "テナント管理者"}</span>
                {canManageMessages && (
                  <span className="flex items-start mt-1">
                    <Globe className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                    <span className="leading-tight">宛先: {getTargetName(selectedMessage)}</span>
                  </span>
                )}
              </div>
              <div className="p-3 sm:p-4 bg-gray-50 rounded-xl text-xs sm:text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-100 min-h-[90px]">
                {selectedMessage.content}
              </div>

              {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                <div className="mt-4 pt-2 border-t border-gray-100">
                  <h4 className="text-[10px] sm:text-[11px] font-bold text-gray-600 mb-2 flex items-center gap-1">
                    <Paperclip className="w-3.5 h-3.5" /> 添付ファイル
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedMessage.attachments.map((file, idx) => (
                      <a 
                        key={idx} 
                        href={file.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all group shadow-sm min-w-0"
                      >
                        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                          <div className="p-1.5 bg-blue-100 rounded-lg shrink-0">
                            <FileIcon className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-gray-700 group-hover:text-blue-700 truncate">{file.name}</span>
                        </div>
                        <Download className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-600 shrink-0 ml-2" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedMessage.requireResponse && (
                <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-2.5 sm:p-3 animate-fade-in">
                  <div className="flex justify-between items-center mb-2 border-b border-blue-100 pb-2">
                    <span className="text-[10px] sm:text-xs font-bold text-blue-900 flex items-center">
                      <CheckSquare className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                      テナント内の対応状況 ({selectedMessage.responseType === 'single' ? "誰か1人が対応で完了" : "全員の対応が必須"})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar mt-2">
                    {(() => {
                      const uList = getMyTenantTargetUsers(selectedMessage);
                      const respondedUsers = uList.filter(u => selectedMessage.responses?.includes(u.id));
                      const unresponded = uList.filter(u => !selectedMessage.responses?.includes(u.id));
                      const isComp = selectedMessage.responseType === "single" ? respondedUsers.length > 0 : (uList.length > 0 && respondedUsers.length >= uList.length);

                      if (selectedMessage.responseType === "single") {
                        if (isComp) return <span className="text-[9px] sm:text-[10px] font-bold text-blue-700 bg-white px-2 py-1 rounded border border-blue-200 shadow-sm">対応完了: {respondedUsers.map(u=>u.name).join(", ")}</span>;
                        return <span className="text-[9px] sm:text-[10px] font-bold text-gray-500">対象者のうち誰か1人が対応すると完了になります</span>;
                      } else {
                        if (isComp && uList.length > 0) return <span className="text-[9px] sm:text-[10px] font-bold text-green-600">テナント全員対応完了しています</span>;
                        if (unresponded.length === 0) return <span className="text-[9px] sm:text-[10px] font-bold text-gray-400">対象者がいません</span>;
                        return unresponded.map(u => <span key={u.id} className="inline-flex text-[9px] sm:text-[10px] font-bold bg-white text-gray-700 px-2 py-1 rounded border border-gray-200 shadow-sm">{u.name}</span>);
                      }
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 sm:p-3.5 border-t border-gray-100 bg-white flex justify-between items-center flex-wrap gap-2 sm:gap-3 rounded-b-2xl shrink-0">
              <div className="flex gap-1.5 sm:gap-2">
                {selectedMessage.isDismissible && (
                  <button onClick={() => handleDeleteMessage(selectedMessage.id)} className="px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-[11px] font-bold text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors flex items-center">
                    <Trash2 className="w-3.5 h-3.5 sm:mr-1" /> <span className="hidden sm:inline">削除</span>
                  </button>
                )}
                {selectedMessage.requireResponse && (
                  <button 
                    onClick={() => handleToggleResponse(selectedMessage)} 
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold rounded-xl shadow-sm flex items-center transition-colors ${
                      selectedMessage.responses?.includes(userData!.id) 
                        ? "bg-white border border-green-500 text-green-600 hover:bg-green-50"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5 mr-1 sm:mr-1.5" />
                    {selectedMessage.responses?.includes(userData!.id) ? "対応済み（解除する）" : "対応済みにする"}
                  </button>
                )}
              </div>

              <div className="flex gap-2 ml-auto">
                {canManageMessages && !(selectedMessage.senderRole === "system_admin" || selectedMessage.schoolId === "SYSTEM") && (
                  <Link href={`/top/admin/messages?tab=form&editId=${selectedMessage.id}`} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-[10px] sm:text-xs font-bold flex items-center transition-colors border border-indigo-100">
                    <Edit2 className="w-3 h-3 mr-1" /> <span className="hidden sm:inline">管理画面で</span>編集
                  </Link>
                )}
                <button onClick={() => setSelectedMessage(null)} className="px-4 sm:px-5 py-1.5 sm:py-2 bg-gray-900 hover:bg-black text-white text-[10px] sm:text-[11px] font-bold rounded-lg shadow-sm transition-colors ml-auto">
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 確認ダイアログ */}
      {confirmDialog && (
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
    </>
  );
}