"use client";

import React, { useState, useEffect, useMemo } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Send, Trash2, BellRing, AlertTriangle, Loader2, Calendar, 
  Users, Building2, Globe, Edit2, X, Save, Info, Wrench, CalendarDays, Tag, Search, Pin, User
} from "lucide-react";
import { UserData, SchoolData } from "../page";

type Props = {
  schoolData: SchoolData | null;
  users: UserData[];
  currentUser: UserData | null;
  showAlert: (type: "success" | "error", message: string) => void;
};

export type MessageCategory = "info" | "warning" | "maintenance" | "event";

export type SystemMessage = {
  id: string;
  title: string;
  content: string;
  category: MessageCategory;
  targetType: "all" | "tenant" | "user";
  targetId: string;
  startAt: string;
  endAt: string;
  isDismissible: boolean;
  isImportant: boolean;
  createdAt: string;
  readBy?: string[];
  schoolId?: string;
  senderId?: string;
  senderName?: string;
  senderRole?: string;
  senderSchoolId?: string;
  showSenderName?: boolean;
};

const CATEGORIES: Record<MessageCategory, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  info: { label: "お知らせ", icon: <Info className="h-4 w-4" />, color: "text-blue-700 border-blue-200", bgColor: "bg-blue-50" },
  warning: { label: "警告・重要", icon: <AlertTriangle className="h-4 w-4" />, color: "text-red-700 border-red-200", bgColor: "bg-red-50" },
  maintenance: { label: "メンテナンス", icon: <Wrench className="h-4 w-4" />, color: "text-orange-700 border-orange-200", bgColor: "bg-orange-50" },
  event: { label: "イベント", icon: <CalendarDays className="h-4 w-4" />, color: "text-green-700 border-green-200", bgColor: "bg-green-50" },
};

export default function MessageDelivery({ schoolData, users, currentUser, showAlert }: Props) {
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<MessageCategory>("info");
  const [targetType, setTargetType] = useState<"tenant" | "user">("tenant");
  const [targetId, setTargetId] = useState("");
  const [targetSearchQuery, setTargetSearchQuery] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [isImportant, setIsImportant] = useState(false);
  const [isDismissible, setIsDismissible] = useState(true);
  const [showSenderName, setShowSenderName] = useState(false);

  const [editingMessage, setEditingMessage] = useState<SystemMessage | null>(null);
  const [editData, setEditData] = useState<Partial<SystemMessage>>({});
  const [editTargetSearchQuery, setEditTargetSearchQuery] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean; message: string; onConfirm: () => void } | null>(null);

  const uniqueUsers = useMemo(() => {
    const map = new Map<string, UserData>();
    users.forEach(u => { if (u && u.id) map.set(u.id, u); });
    return Array.from(map.values());
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!targetSearchQuery) return uniqueUsers;
    const q = targetSearchQuery.toLowerCase();
    return uniqueUsers.filter(u => u.name.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q)));
  }, [uniqueUsers, targetSearchQuery]);

  const editFilteredUsers = useMemo(() => {
    if (!editTargetSearchQuery) return uniqueUsers;
    const q = editTargetSearchQuery.toLowerCase();
    return uniqueUsers.filter(u => u.name.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q)));
  }, [uniqueUsers, editTargetSearchQuery]);

  const fetchMessages = async () => {
    if (!schoolData) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, "system_messages"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const fetched: SystemMessage[] = [];
      const myUserIds = new Set(uniqueUsers.map(u => u.id));
      
      snap.forEach(docSnap => {
        // idの重複警告を避けるため、doc.data()からidがあれば除外、または上書き順序を明示
        const rawData = docSnap.data() as SystemMessage;
        const { id, ...dataWithoutId } = rawData; 
        const messageData = { id: docSnap.id, ...dataWithoutId } as SystemMessage;

        const isAll = messageData.targetType === "all";
        const isMyTenant = messageData.targetType === "tenant" && messageData.targetId === schoolData.id;
        const isMyUser = messageData.targetType === "user" && myUserIds.has(messageData.targetId);
        const isFromMySchool = messageData.schoolId === schoolData.id || messageData.senderSchoolId === schoolData.id;
        
        if (isAll || isMyTenant || isMyUser || isFromMySchool) {
          fetched.push(messageData);
        }
      });
      setMessages(fetched);
    } catch (error) {
      console.error("Fetch messages error:", error);
      showAlert("error", "配信履歴の取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [schoolData]);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setCategory("info");
    setTargetType("tenant");
    setTargetId("");
    setTargetSearchQuery("");
    setStartAt("");
    setEndAt("");
    setIsImportant(false);
    setIsDismissible(true);
    setShowSenderName(false);
  };

  const validateDates = (start: string, end: string) => {
    if (start && end) {
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      if (s >= e) return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolData || !currentUser) return;
    if (!title || !content) {
      showAlert("error", "タイトルと本文は必須です。");
      return;
    }
    if (targetType === "user" && !targetId) {
      showAlert("error", "配信先のユーザーを選択してください。");
      return;
    }
    if (!validateDates(startAt, endAt)) {
      showAlert("error", "終了日時は開始日時より後に設定してください。");
      return;
    }

    setIsSubmitting(true);
    try {
      const newMessage = {
        title,
        content,
        category,
        targetType,
        targetId: targetType === "tenant" ? schoolData.id : targetId,
        startAt,
        endAt,
        isImportant,
        isDismissible,
        createdAt: new Date().toISOString(),
        readBy: [],
        schoolId: schoolData.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        senderSchoolId: schoolData.id,
        showSenderName,
      };

      await addDoc(collection(db, "system_messages"), newMessage);
      showAlert("success", "メッセージを配信しました。");
      resetForm();
      fetchMessages();
    } catch (error) {
      showAlert("error", "メッセージの配信に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "system_messages", id));
      setMessages(messages.filter(m => m.id !== id));
      showAlert("success", "メッセージを削除しました。");
    } catch (error) {
      showAlert("error", "削除に失敗しました。");
    } finally {
      setConfirmDialog(null);
    }
  };

  const requestDelete = (id: string) => {
    setConfirmDialog({
      show: true,
      message: "このメッセージを削除しますか？\nユーザーの画面からも即座に非表示になります。",
      onConfirm: () => executeDelete(id)
    });
  };

  const openEditModal = (msg: SystemMessage) => {
    setEditingMessage(msg);
    setEditData({ ...msg, category: msg.category || "info" });
    setEditTargetSearchQuery("");
  };

  const closeEditModal = () => {
    setEditingMessage(null);
    setEditData({});
  };

  const handleEditChange = (field: keyof SystemMessage, value: any) => {
    setEditData(prev => ({ ...prev, [field]: value }));
    if (field === "targetType") {
      setEditData(prev => ({ ...prev, targetId: value === "tenant" ? schoolData!.id : "" }));
      setEditTargetSearchQuery("");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMessage) return;
    if (editData.targetType === "user" && !editData.targetId) {
      showAlert("error", "配信先を選択してください。");
      return;
    }
    if (!validateDates(editData.startAt || "", editData.endAt || "")) {
      showAlert("error", "終了日時は開始日時より後に設定してください。");
      return;
    }

    setIsSavingEdit(true);
    try {
      const safeUpdateData = Object.fromEntries(
        Object.entries(editData).filter(([_, v]) => v !== undefined)
      );

      await updateDoc(doc(db, "system_messages", editingMessage.id), safeUpdateData);
      
      setMessages(messages.map(m => m.id === editingMessage.id ? { ...m, ...safeUpdateData } as SystemMessage : m));
      showAlert("success", "メッセージを更新しました。");
      closeEditModal();
    } catch (error) {
      showAlert("error", "メッセージの更新に失敗しました。");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const getTargetName = (type: string, id: string) => {
    if (type === "tenant") return "組織（テナント）全体";
    if (type === "user") {
      const u = uniqueUsers.find(u => u.id === id);
      return u ? `個人: ${u.name}` : "不明なユーザー";
    }
    if (type === "all") return "システム全体（特権）";
    return "不明";
  };

  const getSenderNameDisplay = (msg: SystemMessage) => {
    if (msg.senderRole === "system_admin") return "システム管理者";
    if (msg.schoolId === schoolData?.id || msg.senderSchoolId === schoolData?.id) {
      return msg.senderName || "テナント管理者";
    }
    return "不明な配信者";
  };

  return (
    <div className="space-y-6 relative">

      {/* カスタム確認ダイアログ */}
      {confirmDialog?.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 px-4 py-6 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100 transform scale-100 transition-transform">
            <div className="flex items-start mb-4">
              <div className="bg-red-100 p-3 rounded-full mr-4 flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-gray-900 mb-2">確認</h3>
                <p className="text-sm font-medium text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-5 py-2.5 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {editingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4 py-6 overflow-y-auto backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-auto flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl flex-shrink-0">
              <h3 className="text-xl font-extrabold text-gray-900 flex items-center">
                <Edit2 className="h-5 w-5 mr-2 text-blue-600" />
                メッセージの編集
              </h3>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 p-1.5 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-white">
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center"><Tag className="h-4 w-4 mr-1"/> カテゴリ</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(Object.keys(CATEGORIES) as MessageCategory[]).map((cat) => {
                    const { label, icon, color, bgColor } = CATEGORIES[cat];
                    const isSelected = editData.category === cat;
                    return (
                      <label key={cat} className={`cursor-pointer flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${isSelected ? `${color} ${bgColor} border-current ring-2 ring-offset-1 ring-blue-500/50` : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-500'}`}>
                        <input type="radio" className="hidden" checked={isSelected} onChange={() => handleEditChange("category", cat)} />
                        <div className="mb-1">{icon}</div>
                        <span className="text-xs font-bold">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">配信ターゲット</label>
                <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" checked={editData.targetType === "tenant"} onChange={() => handleEditChange("targetType", "tenant")} className="text-blue-600 focus:ring-blue-500 border-gray-300 h-4 w-4" />
                    <span className="text-sm font-bold text-gray-900">組織（テナント）全体</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" checked={editData.targetType === "user"} onChange={() => handleEditChange("targetType", "user")} className="text-blue-600 focus:ring-blue-500 border-gray-300 h-4 w-4" />
                    <span className="text-sm font-bold text-gray-900">個人（個別ユーザー）</span>
                  </label>
                </div>
              </div>

              {/* 検索付きターゲットリスト (編集モーダル用) */}
              {editData.targetType === "user" && (
                <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
                  <div className="p-2 border-b border-gray-200 bg-gray-50">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input 
                        type="text" placeholder="名前やIDで検索..." value={editTargetSearchQuery} onChange={e => setEditTargetSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1 bg-white">
                    {editFilteredUsers.map(u => (
                      <label key={u.id} className={`flex items-center p-3 rounded-md cursor-pointer transition-colors ${editData.targetId === u.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                        <input type="radio" checked={editData.targetId === u.id} onChange={() => handleEditChange("targetId", u.id)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 mr-3" />
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-800 font-bold">{u.name}</span>
                          <span className="text-xs text-gray-500">{u.email || "メール未登録"}</span>
                        </div>
                      </label>
                    ))}
                    {editFilteredUsers.length === 0 && (
                      <div className="p-4 text-center text-sm font-bold text-gray-500">一致する検索結果がありません</div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700">件名</label>
                <input type="text" value={editData.title || ""} onChange={e => handleEditChange("title", e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-lg py-2.5 px-3 text-gray-900 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-sm" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700">メッセージ本文</label>
                <textarea rows={5} value={editData.content || ""} onChange={e => handleEditChange("content", e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-lg py-2.5 px-3 text-gray-900 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-sm" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 flex items-center"><Calendar className="h-4 w-4 mr-1 text-gray-400"/> 配信開始日時 (任意)</label>
                  <input type="datetime-local" value={editData.startAt || ""} onChange={e => handleEditChange("startAt", e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-lg py-2.5 px-3 text-gray-900 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 flex items-center"><Calendar className="h-4 w-4 mr-1 text-gray-400"/> 配信終了日時 (任意)</label>
                  <input type="datetime-local" value={editData.endAt || ""} onChange={e => handleEditChange("endAt", e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-lg py-2.5 px-3 text-gray-900 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-sm" />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <label className="flex-1 flex items-center p-3 border border-gray-200 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
                  <input type="checkbox" checked={editData.isImportant || false} onChange={e => handleEditChange("isImportant", e.target.checked)} className="h-5 w-5 rounded text-red-600 focus:ring-red-500 border-gray-300" />
                  <div className="ml-3">
                    <span className="block text-sm font-bold text-gray-900 flex items-center"><Pin className="h-4 w-4 mr-1"/> 上部にピン留め</span>
                    <span className="block text-[10px] text-gray-500 mt-0.5">赤い「重要なお知らせ」バッジがつき、常に上部に表示されます。</span>
                  </div>
                </label>
                <label className="flex-1 flex items-center p-3 border border-gray-200 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
                  <input type="checkbox" checked={editData.isDismissible || false} onChange={e => handleEditChange("isDismissible", e.target.checked)} className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                  <div className="ml-3">
                    <span className="block text-sm font-bold text-gray-900">ユーザーの削除（既読）を許可</span>
                    <span className="block text-[10px] text-gray-500 mt-0.5">オフにすると、期間終了まで強制的に表示され続けます。</span>
                  </div>
                </label>
              </div>

            </div>

            <div className="px-6 py-5 border-t border-gray-200 bg-white rounded-b-2xl flex justify-end space-x-4 flex-shrink-0">
              <button onClick={closeEditModal} className="px-6 py-2.5 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors">
                キャンセル
              </button>
              <button onClick={handleSaveEdit} disabled={isSavingEdit} className="px-8 py-2.5 border border-transparent rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md flex items-center transition-all active:scale-95 disabled:opacity-50">
                {isSavingEdit ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xl font-extrabold text-gray-900">組織内メッセージ配信</h3>
        <p className="text-sm text-gray-500 mt-1">テナント内の全ユーザー、または特定のユーザーのトップ画面にお知らせを配信します。</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        
        {/* 左側：メッセージ作成フォーム */}
        <div className="xl:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h4 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 mb-5 flex items-center">
              <Send className="h-5 w-5 mr-2 text-blue-600" />
              新規メッセージの作成
            </h4>

            <div className="space-y-5">
              
              {/* カテゴリ選択 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center"><Tag className="h-4 w-4 mr-1"/> カテゴリ</label>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(CATEGORIES) as MessageCategory[]).map((cat) => {
                    const { label, icon, color, bgColor } = CATEGORIES[cat];
                    const isSelected = category === cat;
                    return (
                      <label key={cat} className={`cursor-pointer flex items-center p-3 rounded-xl border-2 transition-all ${isSelected ? `${color} ${bgColor} border-current ring-2 ring-offset-1 ring-blue-500/30` : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-500'}`}>
                        <input type="radio" className="hidden" checked={isSelected} onChange={() => setCategory(cat)} />
                        <div className="mr-2">{icon}</div>
                        <span className="text-sm font-bold">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">タイトル <span className="text-red-500">*</span></label>
                <input 
                  type="text" required value={title} onChange={e => setTitle(e.target.value)} 
                  className="w-full border border-gray-300 rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                  placeholder="例: 生徒総会のお知らせ"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">本文 <span className="text-red-500">*</span></label>
                <textarea 
                  required value={content} onChange={e => setContent(e.target.value)} rows={5}
                  className="w-full border border-gray-300 rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                  placeholder="メッセージの内容を入力..."
                ></textarea>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">配信ターゲット</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input type="radio" name="targetType" value="tenant" checked={targetType === "tenant"} onChange={() => { setTargetType("tenant"); setTargetId(""); setTargetSearchQuery(""); }} className="h-4 w-4 text-blue-600 focus:ring-blue-500" />
                      <span className="ml-2 text-sm text-gray-800 flex items-center"><Globe className="h-4 w-4 mr-1 text-gray-500" />テナント全体</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input type="radio" name="targetType" value="user" checked={targetType === "user"} onChange={() => { setTargetType("user"); setTargetId(""); setTargetSearchQuery(""); }} className="h-4 w-4 text-blue-600 focus:ring-blue-500" />
                      <span className="ml-2 text-sm text-gray-800 flex items-center"><Users className="h-4 w-4 mr-1 text-gray-500" />個人</span>
                    </label>
                  </div>
                </div>

                {targetType === "user" && (
                  <div className="animate-fade-in border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
                    <div className="p-2 border-b border-gray-200 bg-gray-50">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input 
                          type="text" placeholder="名前やIDで検索..." value={targetSearchQuery} onChange={e => setTargetSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto p-1 bg-white">
                      {filteredUsers.map(u => (
                        <label key={u.id} className={`flex items-center p-3 rounded-md cursor-pointer transition-colors ${targetId === u.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                          <input type="radio" checked={targetId === u.id} onChange={() => setTargetId(u.id)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 mr-3" />
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-800 font-bold">{u.name}</span>
                            <span className="text-xs text-gray-500">{u.email || "メール未登録"}</span>
                          </div>
                        </label>
                      ))}
                      {filteredUsers.length === 0 && (
                        <div className="p-4 text-center text-sm font-bold text-gray-500">一致するユーザーがいません</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center"><Calendar className="h-4 w-4 mr-1 text-gray-500"/> 掲載開始日時</label>
                  <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className="w-full border border-gray-300 rounded-lg py-2.5 px-3 text-xs focus:ring-blue-500 shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center"><Calendar className="h-4 w-4 mr-1 text-gray-500"/> 掲載終了日時</label>
                  <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} className="w-full border border-gray-300 rounded-lg py-2.5 px-3 text-xs focus:ring-blue-500 shadow-sm" />
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <label className="flex items-center p-3 border border-gray-200 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors shadow-sm">
                  <input type="checkbox" checked={isImportant} onChange={e => setIsImportant(e.target.checked)} className="h-4 w-4 text-red-600 border-gray-300 rounded" />
                  <div className="ml-3">
                    <span className="block text-sm font-bold text-gray-900 flex items-center"><Pin className="h-4 w-4 mr-1"/> 上部にピン留め</span>
                    <span className="block text-[10px] text-gray-500 mt-0.5">赤い「重要なお知らせ」バッジがつき、常に上部に表示されます。</span>
                  </div>
                </label>

                <label className="flex items-center p-3 border border-gray-200 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors shadow-sm">
                  <input type="checkbox" checked={isDismissible} onChange={e => setIsDismissible(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                  <div className="ml-3">
                    <span className="block text-sm font-bold text-gray-800">ユーザーによる非表示（既読）を許可</span>
                    <span className="block text-[10px] text-gray-500 mt-0.5">オフにすると、期間終了まで強制的に表示され続けます。</span>
                  </div>
                </label>

                <label className="flex items-center p-3 border border-gray-200 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors shadow-sm">
                  <input type="checkbox" checked={showSenderName} onChange={e => setShowSenderName(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                  <div className="ml-3">
                    <span className="block text-sm font-bold text-gray-900">配信者名を表示する</span>
                    <span className="block text-[10px] text-gray-500 mt-0.5">ユーザーの画面にあなたの名前を表示します。（OFFの場合は「テナント管理者」）</span>
                  </div>
                </label>
              </div>

              <button 
                type="submit" disabled={isSubmitting}
                className="w-full mt-4 flex items-center justify-center px-6 py-3.5 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Send className="h-5 w-5 mr-2" />}
                メッセージを配信する
              </button>
            </div>
          </form>
        </div>

        {/* 右側：配信履歴 */}
        <div className="xl:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden max-h-[85vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50 flex-shrink-0">
              <h4 className="text-base font-bold text-gray-900 flex items-center">
                <BellRing className="h-5 w-5 mr-2 text-gray-600" />
                現在の配信状況・履歴
              </h4>
              <span className="text-xs font-bold text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                計 {messages.length} 件
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-gray-50/50">
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16">
                  <BellRing className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-bold text-sm">配信されたメッセージはありません</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isActive = (!msg.startAt || new Date(msg.startAt) <= new Date()) && (!msg.endAt || new Date(msg.endAt) >= new Date());
                  const catInfo = CATEGORIES[msg.category || "info"];
                  
                  const canEdit = msg.schoolId === schoolData?.id || msg.senderSchoolId === schoolData?.id;

                  return (
                    <div key={msg.id} className={`bg-white border rounded-xl p-5 shadow-sm relative transition-colors ${msg.isImportant ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200'} hover:shadow-md`}>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${catInfo.bgColor} ${catInfo.color}`}>
                            {catInfo.icon} <span className="ml-1">{catInfo.label}</span>
                          </span>
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {isActive ? '配信中' : '期間外'}
                          </span>
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                            宛先: {getTargetName(msg.targetType, msg.targetId)}
                          </span>
                          {msg.isImportant && (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                              <Pin className="h-3 w-3 mr-0.5" /> ピン留め
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {canEdit ? (
                            <>
                              <button onClick={() => openEditModal(msg)} className="text-blue-600 hover:text-blue-900 transition-colors p-1.5 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-100 shadow-sm" title="編集">
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button onClick={() => requestDelete(msg.id)} className="text-red-600 hover:text-red-900 transition-colors p-1.5 bg-red-50 hover:bg-red-100 rounded-md border border-red-100 shadow-sm" title="削除">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">閲覧専用</span>
                          )}
                        </div>
                      </div>

                      <h5 className="font-extrabold text-gray-900 text-base mb-2">{msg.title}</h5>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100 mb-3">{msg.content}</p>

                      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-gray-500 font-medium">
                        <div className="flex items-center"><Calendar className="h-3 w-3 mr-1"/> 作成: {new Date(msg.createdAt).toLocaleString()}</div>
                        <div className="flex items-center"><CalendarDays className="h-3 w-3 mr-1"/> 期間: {msg.startAt ? msg.startAt.replace('T', ' ') : '指定なし'} 〜 {msg.endAt ? msg.endAt.replace('T', ' ') : '指定なし'}</div>
                        <div className="flex items-center"><User className="h-3 w-3 mr-1"/> 配信者: {getSenderNameDisplay(msg)}</div>
                        <div className="flex items-center"><Info className="h-3 w-3 mr-1"/> 動作: {msg.isDismissible ? "既読許可" : "強制表示"}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}