"use client";

import React, { useState, useEffect, useMemo } from "react";
import { collection, doc, writeBatch, query, where, getDocs, getDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, db } from "@/lib/firebase";
import { Send, Loader2, Calendar, Users, Globe, Tag, Search, Pin, AlertTriangle, Save, BellRing, Settings2, CheckSquare, EyeOff, UserCircle, Network, Edit2, Paperclip, X, Bell, Mail, MessageCircle, BellOff } from "lucide-react";
import { UserData, SchoolData } from "../page";
import { SystemMessage, CATEGORIES, SystemMessageAttachment } from "./MessageDelivery";
import { dispatchNotification, NotificationType } from "@/lib/notifier";
import { sendEmailMessage } from "@/lib/mail";

type ExtendedSchoolData = SchoolData & {
  customAppNames?: Record<string, string>;
};

type Props = {
  schoolData: SchoolData | null;
  users: UserData[];
  currentUser: UserData | null;
  showAlert: (type: "success" | "error" | "warning", message: string) => void;
  editMessage: SystemMessage | null;
  onSuccess: () => void;
  onCancel: () => void;
};

export default function MessageForm({ schoolData, users, currentUser, showAlert, editMessage, onSuccess, onCancel }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmResetDialog, setConfirmResetDialog] = useState(false); 
  const [showUpdateNotifyDialog, setShowUpdateNotifyDialog] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("info");
  const [subBadge, setSubBadge] = useState("none");
  const [targetType, setTargetType] = useState<"tenant" | "department" | "user">("tenant");
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
  const [targetSearchQuery, setTargetSearchQuery] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  
  const [isImportant, setIsImportant] = useState(false);
  const [isDismissible, setIsDismissible] = useState(true);
  const [showSenderName, setShowSenderName] = useState(false);
  const [requireResponse, setRequireResponse] = useState(false);
  const [responseType, setResponseType] = useState<"single" | "all">("single");

  const [notificationMethod, setNotificationMethod] = useState<NotificationType>("none");
  const [updateNotifyMethod, setUpdateNotifyMethod] = useState<NotificationType>("none");

  const [existingAttachments, setExistingAttachments] = useState<SystemMessageAttachment[]>([]);
  const [newAttachments, setNewAttachments] = useState<File[]>([]);
  const [attachmentsToDelete, setAttachmentsToDelete] = useState<SystemMessageAttachment[]>([]);

  const isEdit = !!editMessage;

  useEffect(() => {
    if (isEdit && editMessage) {
      setTitle(editMessage.title || "");
      setContent(editMessage.content || "");
      setCategory(editMessage.category || "info");
      setSubBadge(editMessage.subBadge || "none");
      setTargetType(editMessage.targetType === "all" ? "tenant" : (editMessage.targetType as "tenant" | "department" | "user"));
      setTargetIds(editMessage.targetIds || (editMessage.targetId ? [editMessage.targetId] : []));
      setTargetDepartments(editMessage.targetDepartments || []);
      setStartAt(editMessage.startAt || "");
      setEndAt(editMessage.endAt || "");
      setIsImportant(editMessage.isImportant || false);
      setIsDismissible(editMessage.isDismissible ?? true);
      setShowSenderName(editMessage.showSenderName || false);
      setRequireResponse(editMessage.requireResponse || false);
      setResponseType(editMessage.responseType || "single");
      
      setExistingAttachments(editMessage.attachments || []);
      setNewAttachments([]);
      setAttachmentsToDelete([]);
      
      setNotificationMethod("none");
      setUpdateNotifyMethod("none");
    } else {
      setTitle(""); setContent(""); setCategory("info"); setSubBadge("none"); 
      setTargetType("tenant"); setTargetIds([]); setTargetDepartments([]);
      setStartAt(""); setEndAt(""); setIsImportant(false); setIsDismissible(true); setShowSenderName(false);
      setRequireResponse(false); setResponseType("single");
      setExistingAttachments([]); setNewAttachments([]); setAttachmentsToDelete([]);
      
      setNotificationMethod("none");
      setUpdateNotifyMethod("none");
    }
  }, [isEdit, editMessage]);

  const filteredUsers = useMemo(() => {
    const q = targetSearchQuery.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q)));
  }, [users, targetSearchQuery]);

  const availablePositions = useMemo(() => {
    const posNames = users.map(u => u.positionName).filter(Boolean) as string[];
    return Array.from(new Set(posNames));
  }, [users]);

  const departmentUserIds = useMemo(() => {
    if (targetType !== "department") return [];
    const ids = new Set<string>();
    users.forEach(u => {
      let matched = false;
      if (targetDepartments.includes("manager") && ((u as any).isManager || (u as any).isITManager)) matched = true;
      if (targetDepartments.includes("role_admin") && u.role === "admin") matched = true;
      if (targetDepartments.includes("role_officer") && u.role === "officer") matched = true;
      if (targetDepartments.includes("role_teacher") && u.role === "teacher") matched = true;
      if (targetDepartments.includes("role_student") && u.role === "student") matched = true;
      if (u.positionName && targetDepartments.includes(`pos_${u.positionName}`)) matched = true;
      if (matched) ids.add(u.id);
    });
    return Array.from(ids);
  }, [targetDepartments, users, targetType]);

  const toggleDepartment = (key: string) => {
    setTargetDepartments(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const executeSave = async (methodToUse: NotificationType) => {
    if (!schoolData || !currentUser) return;
    setIsSubmitting(true);
    setShowUpdateNotifyDialog(false);
    setConfirmResetDialog(false);

    try {
      const storage = getStorage();

      for (const att of attachmentsToDelete) {
        if (att.path) {
          const fileRef = ref(storage, att.path);
          await deleteObject(fileRef).catch(e => console.error("File delete error", e));
        }
      }

      let finalTargetIds: string[] = [];
      if (targetType === "user") finalTargetIds = targetIds;
      else if (targetType === "department") finalTargetIds = departmentUserIds;

      const msgRef = isEdit && editMessage ? doc(db, "system_messages", editMessage.id) : doc(collection(db, "system_messages"));

      let finalAttachments = [...existingAttachments];
      for (const file of newAttachments) {
        const fileRef = ref(storage, `system_messages/${msgRef.id}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        finalAttachments.push({
          name: file.name,
          url,
          type: file.type,
          size: file.size,
          path: fileRef.fullPath
        });
      }

      const payload = {
        title, content, category, subBadge, 
        targetType, targetId: targetType === "tenant" ? schoolData.id : "", 
        targetIds: finalTargetIds, targetDepartments,
        startAt, endAt, isImportant, isDismissible, requireResponse,
        responseType: requireResponse ? responseType : "single", showSenderName,
        attachments: finalAttachments,
      };

      const batch = writeBatch(db);

      if (isEdit && editMessage) {
        const newRevision = (editMessage.revision || 1) + 1;
        batch.update(msgRef, { ...payload, revision: newRevision, responses: [] });
      } else {
        batch.set(msgRef, {
          ...payload,
          revision: 1, responses: [], createdAt: new Date().toISOString(), readBy: [],
          schoolId: schoolData.id, senderId: currentUser.id, senderName: currentUser.name, senderRole: currentUser.role, senderSchoolId: schoolData.id,
        });
      }

      await batch.commit();

      let targets: UserData[] = [];
      if (targetType === "tenant") targets = users;
      else targets = users.filter(u => finalTargetIds.includes(u.id));

      let notifTitle = isEdit ? `【更新】${title}` : title;
      let targetUserIds = targets.map(u => u.id);
      
      // ★ 詳細レポート作成のために名前とメアドのリストを作成
      let targetUsersInfo = targets.map(u => ({ id: u.id, name: u.name, email: u.email || "" }));

      let senderEmail = auth.currentUser?.email;
      let senderName = currentUser.name || "配信担当者";
      let isElevated = currentUser.role === "admin" || currentUser.role === "system_admin" || (currentUser as any).isITManager === true;

      const exSchoolData = schoolData as ExtendedSchoolData;
      const customAppName = exSchoolData?.customAppNames?.["system"] || "組織内メッセージ";

      const executeTime = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

      // 一括通知実行（詳細結果を返してもらう）
      const dispatchResult = await dispatchNotification({
        targetUserIds,
        targetUsersInfo,
        title: notifTitle,
        messageBody: content.length > 60 ? `${content.substring(0, 60)}...` : content,
        detailUrl: `/top?msgId=${msgRef.id}`,
        sourceApp: "system",
        appName: customAppName,
        isImportant,
        senderName: showSenderName ? senderName : undefined,
        notificationMethod: methodToUse,
        senderEmailCategory: "notice",
        replaceLinkUrl: isEdit ? `/top?msgId=${msgRef.id}` : undefined
      });

      if ((methodToUse !== "none") && senderEmail) {
        // ★ 配信者宛てのメールが「同時送信によるスパム判定」を受けるのを防ぐため3秒待機
        await new Promise(resolve => setTimeout(resolve, 3000));

        // CSVデータの作成（BOM付きUTF-8）
        let csvContent = "\uFEFF";
        csvContent += "ユーザー名,メールアドレス,メール通知結果,LINE通知結果,エラー詳細\n";
        dispatchResult.details?.forEach(row => {
          csvContent += `"${row.name}","${row.email}",${row.emailSuccess ? '成功' : 'スキップ/失敗'},${row.lineSuccess ? '成功' : 'スキップ/失敗'},"${row.emailError || ''} ${row.lineError || ''}"\n`;
        });
        const base64Csv = Buffer.from(csvContent, "utf-8").toString("base64");

        // HTMLレポートの作成
        let reportHtml = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">`;
        reportHtml += `<h2 style="color: #1e3a8a; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">配信結果レポート</h2>`;
        reportHtml += `<p style="color: #555; line-height: 1.6; font-weight: bold;">${senderName} 様</p>`;
        if (isElevated) reportHtml += `<p style="color: #555; font-size: 12px; margin-top: -10px;">（登録アドレス: ${senderEmail}）</p>`;
        
        reportHtml += `<p style="color: #555; line-height: 1.6; margin-top: 20px;">プッシュ配信処理が完了しました。</p>`;
        reportHtml += `<div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">`;
        reportHtml += `<p style="margin: 0; font-weight: bold; color: #333;">実行日時: <span style="font-weight:normal;">${executeTime}</span></p>`;
        reportHtml += `<p style="margin: 8px 0 0 0; font-weight: bold; color: #333;">件名: <span style="font-weight:normal;">${notifTitle}</span></p>`;
        reportHtml += `</div>`;
        
        reportHtml += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 14px;">`;
        if (dispatchResult.notifyEmail) {
          reportHtml += `<tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #555;">メール配信</td><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #2563eb;">成功: ${dispatchResult.emailSuccess}件 / 対象: ${targetUserIds.length}件</td></tr>`;
        }
        if (dispatchResult.notifyLine) {
          reportHtml += `<tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #555;">LINE配信</td><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #06c755;">成功: ${dispatchResult.lineSuccess}件 / 対象: ${targetUserIds.length}件</td></tr>`;
        }
        reportHtml += `</table>`;
        reportHtml += `<p style="font-size: 12px; color: #6b7280; margin-bottom: 30px;">※対象ユーザーが受信を拒否している場合や未連携の場合は成功数から除外されます。</p>`;

        // ★ 詳細なデータ表（HTMLテーブル）
        reportHtml += `<h3 style="color: #333; font-size: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px;">詳細ログ（上位100件まで）</h3>`;
        reportHtml += `<table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; margin-bottom: 20px;">`;
        reportHtml += `<thead><tr><th style="border-bottom: 2px solid #ccc; padding: 6px;">名前</th><th style="border-bottom: 2px solid #ccc; padding: 6px;">メール</th><th style="border-bottom: 2px solid #ccc; padding: 6px;">LINE</th></tr></thead><tbody>`;
        
        dispatchResult.details?.slice(0, 100).forEach(row => {
          reportHtml += `<tr>
            <td style="border-bottom: 1px solid #eee; padding: 6px;">${row.name}</td>
            <td style="border-bottom: 1px solid #eee; padding: 6px; color: ${row.emailSuccess ? '#059669' : '#dc2626'};">${row.emailSuccess ? '成功' : 'スキップ'}</td>
            <td style="border-bottom: 1px solid #eee; padding: 6px; color: ${row.lineSuccess ? '#059669' : '#dc2626'};">${row.lineSuccess ? '成功' : 'スキップ'}</td>
          </tr>`;
        });
        reportHtml += `</tbody></table>`;
        reportHtml += `<p style="font-size: 12px; color: #ef4444; font-weight: bold;">※ すべての完全なデータは、本メールに添付されているCSVファイル（Excel形式）でご確認・保存いただけます。</p>`;
        reportHtml += `</div>`;
        
        // ★ CSVファイルを添付して送信
        await sendEmailMessage(
          senderEmail, 
          "【SCPS】メッセージ配信完了レポート", 
          reportHtml, 
          "notice",
          [{ name: `delivery_report_${Date.now()}.csv`, contentType: "text/csv", base64Content: base64Csv }]
        ).catch(e => console.error("Report Send Error:", e));
      }

      if (isEdit) showAlert("success", "更新しました。対象ユーザーのダッシュボードに再表示されます。");
      else showAlert("success", "メッセージを配信しました。");
      
      onSuccess();
    } catch (error) {
      console.error(error);
      showAlert("error", "保存に失敗しました。");
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolData || !currentUser) return;
    
    let finalTargetIds: string[] = [];
    if (targetType === "user") finalTargetIds = targetIds;
    else if (targetType === "department") finalTargetIds = departmentUserIds;

    if (targetType === "user" && finalTargetIds.length === 0) {
      showAlert("warning", "配信先のユーザーを選択してください。"); return;
    }
    if (targetType === "department" && finalTargetIds.length === 0) {
      showAlert("warning", "選択した部門に該当するユーザーがいません。"); return;
    }
    if (startAt && endAt && new Date(startAt) >= new Date(endAt)) {
      showAlert("warning", "終了日時は開始日時より後に設定してください。"); return;
    }

    if (isEdit && editMessage && (editMessage.senderRole === "system_admin" || editMessage.schoolId === "SYSTEM")) {
      showAlert("error", "権限エラー: システム管理者が発行したお知らせは編集・保存できません。");
      return;
    }

    if (isEdit) {
      if (editMessage?.requireResponse && editMessage?.responses && editMessage.responses.length > 0) {
        setConfirmResetDialog(true);
      } else {
        setShowUpdateNotifyDialog(true);
      }
    } else {
      executeSave(notificationMethod);
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 lg:p-8 pb-24 min-h-0 bg-[#F9FAFB]">
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          {isEdit && (
            <div className="bg-blue-50 border border-blue-200 p-3 sm:p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center text-blue-800 font-bold text-xs sm:text-sm gap-2">
                <div className="flex items-center"><Edit2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> 既存メッセージの編集モード</div>
                <span className="text-[10px] sm:text-xs font-medium text-blue-600 border border-blue-200 bg-white px-2 py-0.5 rounded-full w-fit">保存すると全ユーザーに再通知されます</span>
              </div>
              <button type="button" onClick={onCancel} className="text-xs font-bold text-gray-500 hover:text-gray-800 bg-white px-4 py-2 rounded-lg border border-gray-200 transition-colors shadow-xs w-full sm:w-auto text-center">
                編集をキャンセル
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
            <div className="lg:col-span-8 space-y-4 sm:space-y-6">
              
              <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4 sm:space-y-6">
                <div className="border-b border-gray-100 pb-2 sm:pb-3 flex items-center">
                  <div className="p-1.5 bg-blue-50 rounded-lg mr-2"><BellRing className="w-4 h-4 text-blue-600" /></div>
                  <h4 className="text-sm sm:text-base font-black text-gray-900">メッセージ内容</h4>
                </div>

                <div>
                  <label className="block text-[11px] sm:text-sm font-bold text-gray-700 mb-1.5">タイトル <span className="text-red-500">*</span></label>
                  <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-gray-300 rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 text-[16px] sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-xs" placeholder="例: 全体システムメンテナンスのお知らせ" />
                </div>

                <div>
                  <label className="block text-[11px] sm:text-sm font-bold text-gray-700 mb-1.5">本文 <span className="text-red-500">*</span></label>
                  <textarea required value={content} onChange={e => setContent(e.target.value)} rows={10} className="w-full border border-gray-300 rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 text-[16px] sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-xs leading-relaxed custom-scrollbar" placeholder="メッセージの詳細を入力..."></textarea>
                </div>
              </div>

              {/* 添付ファイル入力エリア */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-3 sm:space-y-4">
                <div className="border-b border-gray-100 pb-2 sm:pb-3 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-1.5 bg-green-50 rounded-lg mr-2"><Paperclip className="w-4 h-4 text-green-600" /></div>
                    <h4 className="text-sm sm:text-base font-black text-gray-900">添付ファイル</h4>
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">{existingAttachments.length + newAttachments.length} / 3</span>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {existingAttachments.map((att, i) => (
                    <div key={`old-${i}`} className="flex items-center justify-between p-2 sm:p-2.5 bg-gray-50 border border-gray-200 rounded-xl min-w-0">
                      <div className="flex items-center gap-2 overflow-hidden pr-2 flex-1">
                        <Paperclip className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-[10px] sm:text-xs font-bold text-gray-700 truncate">{att.name}</span>
                      </div>
                      <button type="button" onClick={() => {
                         setAttachmentsToDelete([...attachmentsToDelete, att]);
                         setExistingAttachments(existingAttachments.filter((_, idx) => idx !== i));
                      }} className="p-1 sm:p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {newAttachments.map((file, i) => (
                    <div key={`new-${i}`} className="flex items-center justify-between p-2 sm:p-2.5 bg-blue-50 border border-blue-200 rounded-xl min-w-0">
                      <div className="flex items-center gap-2 overflow-hidden pr-2 flex-1">
                        <Paperclip className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 flex-shrink-0" />
                        <span className="text-[10px] sm:text-xs font-bold text-blue-900 truncate">{file.name}</span>
                      </div>
                      <button type="button" onClick={() => {
                         setNewAttachments(newAttachments.filter((_, idx) => idx !== i));
                      }} className="p-1 sm:p-1.5 text-blue-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {existingAttachments.length + newAttachments.length < 3 && (
                    <label className="flex items-center justify-center p-4 sm:p-5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors">
                      <input type="file" multiple onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (existingAttachments.length + newAttachments.length + files.length > 3) {
                          showAlert("warning", "添付ファイルは最大3つまでです。");
                          return;
                        }
                        setNewAttachments([...newAttachments, ...files]);
                      }} className="hidden" />
                      <span className="text-[10px] sm:text-xs font-bold text-gray-500 flex items-center">
                        <Paperclip className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" /> ファイルを追加 (最大3個)
                      </span>
                    </label>
                  )}
                </div>
              </div>

              {/* 配信ターゲット */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4 sm:space-y-5">
                <div className="border-b border-gray-100 pb-2 sm:pb-3 flex items-center">
                  <div className="p-1.5 bg-indigo-50 rounded-lg mr-2"><Users className="w-4 h-4 text-indigo-600" /></div>
                  <h4 className="text-sm sm:text-base font-black text-gray-900">配信ターゲット（宛先）</h4>
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 p-1.5 bg-gray-50 rounded-xl border border-gray-200 w-full sm:w-fit">
                  <label className={`flex items-center justify-center px-3 sm:px-4 py-2 rounded-lg cursor-pointer transition-colors flex-1 sm:flex-none ${targetType === "tenant" ? "bg-white shadow-sm border border-gray-200 font-bold text-blue-700" : "text-gray-500 hover:text-gray-700 font-medium"}`}>
                    <input type="radio" checked={targetType === "tenant"} onChange={() => { setTargetType("tenant"); setTargetIds([]); setTargetDepartments([]); }} className="hidden" />
                    <Globe className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 ${targetType === "tenant" ? "text-blue-600" : "opacity-50"}`} /> テナント全体
                  </label>
                  <label className={`flex items-center justify-center px-3 sm:px-4 py-2 rounded-lg cursor-pointer transition-colors flex-1 sm:flex-none ${targetType === "department" ? "bg-white shadow-sm border border-gray-200 font-bold text-blue-700" : "text-gray-500 hover:text-gray-700 font-medium"}`}>
                    <input type="radio" checked={targetType === "department"} onChange={() => { setTargetType("department"); setTargetIds([]); }} className="hidden" />
                    <Network className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 ${targetType === "department" ? "text-blue-600" : "opacity-50"}`} /> 部門・グループ
                  </label>
                  <label className={`flex items-center justify-center px-3 sm:px-4 py-2 rounded-lg cursor-pointer transition-colors flex-1 sm:flex-none ${targetType === "user" ? "bg-white shadow-sm border border-gray-200 font-bold text-blue-700" : "text-gray-500 hover:text-gray-700 font-medium"}`}>
                    <input type="radio" checked={targetType === "user"} onChange={() => { setTargetType("user"); setTargetDepartments([]); }} className="hidden" />
                    <Users className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 ${targetType === "user" ? "text-blue-600" : "opacity-50"}`} /> 個人を選択
                  </label>
                </div>

                {targetType === "department" && (
                  <div className="p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-200 animate-fade-in space-y-3 sm:space-y-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 pb-2 border-b border-gray-200">
                      <span className="text-[11px] sm:text-xs font-bold text-gray-700">対象グループを選択（複数可）</span>
                      <span className="text-[10px] sm:text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 w-fit">該当: {departmentUserIds.length}名</span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <label className="flex items-center p-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                          <input type="checkbox" checked={targetDepartments.includes("manager")} onChange={() => toggleDepartment("manager")} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 mr-1.5 sm:mr-2 rounded" />
                          <span className="text-[10px] sm:text-xs font-bold">マネージャー層</span>
                        </label>
                        <label className="flex items-center p-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                          <input type="checkbox" checked={targetDepartments.includes("role_teacher")} onChange={() => toggleDepartment("role_teacher")} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 mr-1.5 sm:mr-2 rounded" />
                          <span className="text-[10px] sm:text-xs font-bold">教職員</span>
                        </label>
                        <label className="flex items-center p-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                          <input type="checkbox" checked={targetDepartments.includes("role_officer")} onChange={() => toggleDepartment("role_officer")} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 mr-1.5 sm:mr-2 rounded" />
                          <span className="text-[10px] sm:text-xs font-bold">生徒会役員</span>
                        </label>
                        <label className="flex items-center p-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                          <input type="checkbox" checked={targetDepartments.includes("role_student")} onChange={() => toggleDepartment("role_student")} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 mr-1.5 sm:mr-2 rounded" />
                          <span className="text-[10px] sm:text-xs font-bold">一般生徒</span>
                        </label>
                      </div>
                      
                      {availablePositions.length > 0 && (
                        <div className="pt-3 border-t border-gray-200/60">
                          <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 block mb-2">役職別フィルター</span>
                          <div className="flex flex-wrap gap-2">
                            {availablePositions.map(pos => (
                              <label key={pos} className="flex items-center p-1.5 px-2 bg-white border border-gray-200 rounded-md cursor-pointer hover:bg-blue-50 transition-colors">
                                <input type="checkbox" checked={targetDepartments.includes(`pos_${pos}`)} onChange={() => toggleDepartment(`pos_${pos}`)} className="w-3.5 h-3.5 text-blue-600 mr-1.5 rounded" />
                                <span className="text-[9px] sm:text-[10px] font-bold">{pos}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {departmentUserIds.length > 0 && (
                      <div className="pt-3 border-t border-gray-200">
                        <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 block mb-1.5">配信対象者一覧</span>
                        <div className="flex flex-wrap gap-1.5 max-h-24 sm:max-h-32 overflow-y-auto custom-scrollbar p-2 bg-white border border-gray-200 rounded-lg">
                          {departmentUserIds.map(uid => {
                            const u = users.find(user => user.id === uid);
                            return <span key={uid} className="text-[9px] sm:text-[10px] font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{u?.name || "不明"}</span>;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {targetType === "user" && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50/50 animate-fade-in flex flex-col">
                    <div className="p-2 sm:p-3 border-b border-gray-200 bg-white flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <div className="relative flex-1 w-full max-w-none sm:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
                        <input type="text" placeholder="名前やIDで検索..." value={targetSearchQuery} onChange={e => setTargetSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-1.5 sm:py-2 text-[16px] sm:text-xs font-bold border border-gray-300 rounded-lg focus:ring-blue-500 outline-none" />
                      </div>
                      <div className="text-[10px] sm:text-xs font-bold text-indigo-700 bg-indigo-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-indigo-100 w-fit">選択中: {targetIds.length}名</div>
                    </div>
                    <div className="max-h-[200px] sm:max-h-[250px] overflow-y-auto custom-scrollbar p-2 bg-white grid grid-cols-1 md:grid-cols-2 gap-2">
                      {filteredUsers.map(u => (
                        <label key={u.id} className={`flex items-center p-2 sm:p-2.5 rounded-xl cursor-pointer transition-all border ${targetIds.includes(u.id) ? 'bg-blue-50 border-blue-200 shadow-sm' : 'hover:bg-gray-50 border-transparent'}`}>
                          <input type="checkbox" checked={targetIds.includes(u.id)} onChange={e => setTargetIds(e.target.checked ? [...targetIds, u.id] : targetIds.filter(id => id !== u.id))} className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 rounded mr-2 sm:mr-3 flex-shrink-0" />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[11px] sm:text-sm text-gray-900 font-bold truncate">{u.name}</span>
                            <span className="text-[9px] sm:text-[10px] text-gray-500 truncate">{u.email || "メール未設定"}</span>
                          </div>
                        </label>
                      ))}
                      {filteredUsers.length === 0 && <div className="col-span-full p-6 text-center text-xs sm:text-sm font-bold text-gray-400">一致するユーザーがいません</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 右側の表示設定 */}
            <div className="lg:col-span-4 space-y-4 sm:space-y-6">

              {/* ★ 新規作成時のみ表示される、最上部の外部プッシュ通知設定 */}
              {!isEdit && (
                <div className="bg-gradient-to-br from-blue-50 to-white p-4 sm:p-5 rounded-2xl shadow-sm border border-blue-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                    <h4 className="text-sm font-black text-blue-900 flex items-center">
                      <Bell className="w-4 h-4 mr-1.5 text-blue-600" /> プッシュ通知の設定
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { value: "none", label: "通知なし", icon: BellOff, color: "text-gray-500", bg: "bg-gray-100" },
                      { value: "email", label: "メールで通知", icon: Mail, color: "text-blue-600", bg: "bg-blue-100" },
                      { value: "line", label: "LINEで通知", icon: MessageCircle, color: "text-[#06C755]", bg: "bg-[#b3efca]" },
                      { value: "both", label: "メール & LINE", icon: BellRing, color: "text-indigo-600", bg: "bg-indigo-100" }
                    ].map(opt => (
                      <label key={opt.value} className={`flex items-center p-2.5 rounded-xl border-2 cursor-pointer transition-all ${notificationMethod === opt.value ? 'border-blue-500 bg-white shadow-sm' : 'border-transparent bg-gray-50/50 hover:bg-gray-50'}`}>
                        <input type="radio" className="hidden" checked={notificationMethod === opt.value} onChange={() => setNotificationMethod(opt.value as NotificationType)} />
                        <div className={`p-1.5 rounded-lg ${opt.bg} mr-2.5`}>
                          <opt.icon className={`w-3.5 h-3.5 ${opt.color}`} />
                        </div>
                        <span className={`text-[11px] sm:text-xs font-bold flex-1 ${notificationMethod === opt.value ? 'text-blue-900' : 'text-gray-700'}`}>{opt.label}</span>
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors ${notificationMethod === opt.value ? 'border-blue-600' : 'border-gray-300'}`}>
                          {notificationMethod === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="pt-1">
                    <p className="text-[10px] text-blue-600/80 font-bold leading-relaxed">
                      ※ 配信後、成功状況のレポートが登録アドレス宛に自動送信されます。<br/>対象者が受信拒否設定中の場合は配信されません。
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4 sm:space-y-5">
                <h4 className="text-sm font-black text-gray-900 flex items-center border-b border-gray-100 pb-2">
                  <Tag className="w-4 h-4 mr-1.5 text-gray-400" /> 表示設定
                </h4>
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">カテゴリ <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(CATEGORIES).map(([cat, info]) => (
                      <label key={cat} className={`cursor-pointer flex items-center justify-center py-2 sm:py-2.5 px-1 rounded-xl border-2 transition-all ${category === cat ? `${info.color} border-current bg-white shadow-sm` : 'border-gray-100 bg-gray-50 hover:bg-gray-100 text-gray-500'}`}>
                        <input type="radio" className="hidden" checked={category === cat} onChange={() => setCategory(cat)} />
                        <span className="text-[10px] sm:text-xs font-bold truncate">{info.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">追加バッジ (任意)</label>
                  <div className="flex flex-wrap gap-2">
                    <label className={`cursor-pointer px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold border transition-colors ${subBadge === "none" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
                      <input type="radio" className="hidden" checked={subBadge === "none"} onChange={() => setSubBadge("none")} /> なし
                    </label>
                    <label className={`cursor-pointer px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold border transition-colors ${subBadge === "update1" ? "bg-yellow-100 text-yellow-800 border-yellow-300" : "bg-white text-yellow-700 border-yellow-200 hover:bg-yellow-50"}`}>
                      <input type="radio" className="hidden" checked={subBadge === "update1"} onChange={() => setSubBadge("update1")} /> 更新①
                    </label>
                    <label className={`cursor-pointer px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold border transition-colors ${subBadge === "update2" ? "bg-orange-100 text-orange-800 border-orange-300" : "bg-white text-orange-700 border-orange-200 hover:bg-orange-50"}`}>
                      <input type="radio" className="hidden" checked={subBadge === "update2"} onChange={() => setSubBadge("update2")} /> 更新②
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-200 space-y-3 sm:space-y-4">
                <h4 className="text-sm font-black text-gray-900 flex items-center border-b border-gray-100 pb-2"><Calendar className="w-4 h-4 mr-1.5 text-gray-400" /> スケジュール</h4>
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-500 mb-1">掲載開始日時 (任意)</label>
                  <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className="w-full border border-gray-300 rounded-xl py-2 px-3 text-[16px] sm:text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-500 mb-1">掲載終了日時 (任意)</label>
                  <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} className="w-full border border-gray-300 rounded-xl py-2 px-3 text-[16px] sm:text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-200 space-y-3">
                <h4 className="text-sm font-black text-gray-900 flex items-center border-b border-gray-100 pb-2 mb-2 sm:mb-3"><Settings2 className="w-4 h-4 mr-1.5 text-gray-400" /> オプション設定</h4>

                <label className={`flex items-start p-2.5 sm:p-3 border rounded-xl cursor-pointer transition-all ${isImportant ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                  <div className="flex items-center h-5"><input type="checkbox" checked={isImportant} onChange={e => setIsImportant(e.target.checked)} className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600 rounded border-gray-300" /></div>
                  <div className="ml-2.5 sm:ml-3">
                    <span className={`block text-[11px] sm:text-xs font-bold flex items-center ${isImportant ? 'text-red-800' : 'text-gray-700'}`}><Pin className="w-3 h-3 mr-1" /> 緊急として上部に固定</span>
                    <span className="block text-[8px] sm:text-[9px] text-gray-500 mt-0.5 sm:mt-1 leading-tight">ダッシュボード最上部に赤いバッジで固定表示。</span>
                  </div>
                </label>

                <div className={`p-2.5 sm:p-3 border rounded-xl transition-all ${requireResponse ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                  <label className="flex items-start cursor-pointer">
                    <div className="flex items-center h-5"><input type="checkbox" checked={requireResponse} onChange={e => setRequireResponse(e.target.checked)} className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 rounded border-gray-300" /></div>
                    <div className="ml-2.5 sm:ml-3">
                      <span className={`block text-[11px] sm:text-xs font-bold flex items-center ${requireResponse ? 'text-blue-800' : 'text-gray-700'}`}><CheckSquare className="w-3 h-3 mr-1" /> 対応応答を要求する</span>
                      <span className="block text-[8px] sm:text-[9px] text-gray-500 mt-0.5 sm:mt-1 leading-tight">ユーザーに「対応済みにする」ボタンを表示します。</span>
                    </div>
                  </label>
                  {requireResponse && (
                    <div className="mt-2.5 sm:mt-3 ml-6 sm:ml-7 pt-2.5 sm:pt-3 border-t border-blue-100/50 flex flex-col gap-2">
                      <label className="flex items-center cursor-pointer">
                        <input type="radio" checked={responseType === "single"} onChange={() => setResponseType("single")} className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-600" />
                        <span className="ml-2 text-[9px] sm:text-[10px] font-bold text-gray-700">誰か1人が対応すれば完了</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input type="radio" checked={responseType === "all"} onChange={() => setResponseType("all")} className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-600" />
                        <span className="ml-2 text-[9px] sm:text-[10px] font-bold text-gray-700">全員の対応が必須</span>
                      </label>
                    </div>
                  )}
                </div>

                <label className={`flex items-start p-2.5 sm:p-3 border rounded-xl cursor-pointer transition-all ${isDismissible ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                  <div className="flex items-center h-5"><input type="checkbox" checked={isDismissible} onChange={e => setIsDismissible(e.target.checked)} className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600 rounded border-gray-300" /></div>
                  <div className="ml-2.5 sm:ml-3">
                    <span className="block text-[11px] sm:text-xs font-bold text-gray-700 flex items-center"><EyeOff className="w-3 h-3 mr-1" /> ユーザーの非表示(既読)を許可</span>
                  </div>
                </label>

                <label className={`flex items-start p-2.5 sm:p-3 border rounded-xl cursor-pointer transition-all ${showSenderName ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                  <div className="flex items-center h-5"><input type="checkbox" checked={showSenderName} onChange={e => setShowSenderName(e.target.checked)} className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600 rounded border-gray-300" /></div>
                  <div className="ml-2.5 sm:ml-3">
                    <span className="block text-[11px] sm:text-xs font-bold text-gray-700 flex items-center"><UserCircle className="w-3 h-3 mr-1" /> 自分の名前を配信者として表示</span>
                  </div>
                </label>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-lg text-[13px] sm:text-sm font-black text-white bg-blue-600 hover:bg-blue-700 focus:outline-none transition-all active:scale-95 disabled:opacity-50">
                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 sm:h-5 sm:w-5 mr-2" /> : (isEdit ? <Save className="h-4 w-4 sm:h-5 sm:w-5 mr-2" /> : <Send className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />)} 
                {isEdit ? "保存して全ユーザーに再通知" : "メッセージを配信する"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 編集時の更新確認ダイアログ（カード型UIに変更） */}
      {showUpdateNotifyDialog && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-6 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 sm:p-6 border border-gray-100 relative overflow-visible flex flex-col max-h-[90vh]">
            <div className="flex flex-col items-center text-center mb-5 shrink-0">
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                <BellRing className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-[15px] sm:text-base font-black text-gray-900 mb-1.5">お知らせの更新を通知しますか？</h3>
              <p className="text-[11px] sm:text-xs font-bold text-gray-500 leading-relaxed">
                内容が「更新」されたことを対象ユーザーにプッシュ通知できます。サイレント更新も可能です。
              </p>
            </div>
            
            <div className="space-y-2 mb-6 overflow-y-auto custom-scrollbar p-1">
              {[
                { value: "none", label: "サイレント更新 (通知なし)", desc: "ポータル上のみ更新", icon: BellOff, color: "text-gray-500", bg: "bg-gray-100" },
                { value: "email", label: "メールで通知", desc: "登録アドレスへ送信", icon: Mail, color: "text-blue-600", bg: "bg-blue-100" },
                { value: "line", label: "LINEで通知", desc: "連携済みLINEへ送信", icon: MessageCircle, color: "text-[#06C755]", bg: "bg-[#b3efca]" },
                { value: "both", label: "メール & LINE", desc: "両方で確実に通知", icon: BellRing, color: "text-indigo-600", bg: "bg-indigo-100" }
              ].map(opt => (
                <label key={opt.value} className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${updateNotifyMethod === opt.value ? `border-blue-500 bg-blue-50/50 shadow-sm` : `border-transparent bg-gray-50 hover:bg-gray-100`}`}>
                  <input type="radio" className="hidden" checked={updateNotifyMethod === opt.value} onChange={() => setUpdateNotifyMethod(opt.value as NotificationType)} />
                  <div className={`p-2 rounded-lg ${opt.bg} mr-3`}>
                    <opt.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${opt.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className={`text-xs sm:text-sm font-bold ${updateNotifyMethod === opt.value ? 'text-blue-900' : 'text-gray-800'}`}>{opt.label}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</div>
                  </div>
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center transition-colors ${updateNotifyMethod === opt.value ? 'border-blue-600' : 'border-gray-300'}`}>
                    {updateNotifyMethod === opt.value && <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-blue-600" />}
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-2 shrink-0">
              <button type="button" onClick={() => setShowUpdateNotifyDialog(false)} disabled={isSubmitting} className="flex-1 py-2.5 sm:py-3 bg-white border border-gray-300 text-gray-700 text-[11px] sm:text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50">キャンセル</button>
              <button type="button" onClick={() => executeSave(updateNotifyMethod)} disabled={isSubmitting} className="flex-1 py-2.5 sm:py-3 bg-blue-600 text-white text-[11px] sm:text-xs font-bold rounded-xl hover:bg-blue-700 shadow-sm transition-colors flex justify-center items-center disabled:opacity-50">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存して更新"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 応答リセット確認ダイアログ */}
      {confirmResetDialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-6 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-5 sm:p-6 text-center border border-gray-100">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-sm font-black text-gray-900 mb-2">更新の確認</h3>
            <p className="text-[11px] sm:text-xs font-bold text-gray-600 mb-5 leading-relaxed whitespace-pre-wrap">
              すでに対応済みのユーザーがいますが、対応状況や既読状態はリセットされます。<br/>本当によろしいですか？
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmResetDialog(false)} className="flex-1 py-2 sm:py-2.5 bg-white border border-gray-300 text-gray-700 text-[11px] sm:text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors">キャンセル</button>
              <button type="button" onClick={() => { setConfirmResetDialog(false); setShowUpdateNotifyDialog(true); }} className="flex-1 py-2 sm:py-2.5 bg-blue-600 text-white text-[11px] sm:text-xs font-bold rounded-xl hover:bg-blue-700 shadow-sm transition-colors">リセットして次へ</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}