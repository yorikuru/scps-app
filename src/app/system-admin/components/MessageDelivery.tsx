"use client";

import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BellRing, Send, Loader2, Edit2, Trash2, X, Save } from "lucide-react";
import { TenantData, GlobalUserData } from "../page";

type Props = {
  tenants: TenantData[];
  users: GlobalUserData[];
  showAlert: (type: "success" | "error", message: string) => void;
};

export type SystemMessage = {
  id: string;
  title: string;
  content: string;
  targetType: "all" | "tenant" | "user";
  targetId: string;
  startAt: string;
  endAt: string;
  isDismissible: boolean;
  isImportant: boolean;
  createdAt: string;
  readBy: string[];
};

export default function MessageDelivery({ tenants, users, showAlert }: Props) {
  // 新規作成用ステート
  const [targetType, setTargetType] = useState<"all" | "tenant" | "user">("all");
  const [targetId, setTargetId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [isDismissible, setIsDismissible] = useState(true);
  const [isImportant, setIsImportant] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // 一覧・編集用ステート
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [editingMessage, setEditingMessage] = useState<SystemMessage | null>(null);
  const [editData, setEditData] = useState<Partial<SystemMessage>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchMessages = async () => {
    setIsLoadingMessages(true);
    try {
      const snap = await getDocs(collection(db, "system_messages"));
      const mData: SystemMessage[] = [];
      snap.forEach(doc => mData.push({ id: doc.id, ...doc.data() } as SystemMessage));
      mData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMessages(mData);
    } catch (error) {
      console.error("Fetch messages error:", error);
      showAlert("error", "メッセージ一覧の取得に失敗しました。");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetType !== "all" && !targetId) {
      showAlert("error", "配信先を選択してください。");
      return;
    }
    
    setIsSending(true);
    try {
      await addDoc(collection(db, "system_messages"), {
        targetType,
        targetId: targetType === "all" ? "ALL" : targetId,
        title,
        content,
        startAt,
        endAt,
        isDismissible,
        isImportant,
        createdAt: new Date().toISOString(),
        readBy: []
      });
      
      showAlert("success", "メッセージの配信が完了しました。");
      setTitle("");
      setContent("");
      setTargetId("");
      setStartAt("");
      setEndAt("");
      setIsDismissible(true);
      setIsImportant(false);
      fetchMessages();
    } catch (error) {
      showAlert("error", "メッセージの配信に失敗しました。");
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (id: string) => {
    if (!window.confirm("このメッセージを削除してよろしいですか？（ユーザーの画面からも即座に消えます）")) return;
    try {
      await deleteDoc(doc(db, "system_messages", id));
      setMessages(messages.filter(m => m.id !== id));
      showAlert("success", "メッセージを削除しました。");
    } catch (error) {
      showAlert("error", "メッセージの削除に失敗しました。");
    }
  };

  const openEditModal = (msg: SystemMessage) => {
    setEditingMessage(msg);
    setEditData({ ...msg });
  };

  const closeEditModal = () => {
    setEditingMessage(null);
    setEditData({});
  };

  const handleEditChange = (field: keyof SystemMessage, value: any) => {
    setEditData(prev => ({ ...prev, [field]: value }));
    // targetTypeが変更されたらtargetIdをリセット
    if (field === "targetType") {
      setEditData(prev => ({ ...prev, targetId: value === "all" ? "ALL" : "" }));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMessage) return;
    if (editData.targetType !== "all" && !editData.targetId) {
      showAlert("error", "配信先を選択してください。");
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateDoc(doc(db, "system_messages", editingMessage.id), {
        ...editData
      });
      
      setMessages(messages.map(m => m.id === editingMessage.id ? { ...m, ...editData } as SystemMessage : m));
      showAlert("success", "メッセージを更新しました。");
      closeEditModal();
    } catch (error) {
      showAlert("error", "メッセージの更新に失敗しました。");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const getTargetName = (type: string, id: string) => {
    if (type === "all") return "全ユーザー";
    if (type === "tenant") {
      const t = tenants.find(t => t.id === id);
      return t ? `テナント: ${t.name}` : "不明なテナント";
    }
    if (type === "user") {
      const u = users.find(u => u.id === id);
      return u ? `ユーザー: ${u.name}` : "不明なユーザー";
    }
    return "不明";
  };

  return (
    <div className="space-y-8">

      {/* 編集モーダル */}
      {editingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-auto flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="text-lg font-extrabold text-gray-900">メッセージの編集</h3>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">配信ターゲット</label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" checked={editData.targetType === "all"} onChange={() => handleEditChange("targetType", "all")} className="text-blue-600 focus:ring-blue-500 border-gray-300" />
                    <span className="text-sm font-bold text-gray-900">全ユーザー</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" checked={editData.targetType === "tenant"} onChange={() => handleEditChange("targetType", "tenant")} className="text-blue-600 focus:ring-blue-500 border-gray-300" />
                    <span className="text-sm font-bold text-gray-900">特定のテナント</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" checked={editData.targetType === "user"} onChange={() => handleEditChange("targetType", "user")} className="text-blue-600 focus:ring-blue-500 border-gray-300" />
                    <span className="text-sm font-bold text-gray-900">個別ユーザー</span>
                  </label>
                </div>
              </div>

              {editData.targetType === "tenant" && (
                <div>
                  <label className="block text-sm font-bold text-gray-700">対象テナント選択</label>
                  <select value={editData.targetId || ""} onChange={e => handleEditChange("targetId", e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:ring-blue-500 focus:border-blue-500 text-sm">
                    <option value="">選択してください</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.schoolCode})</option>)}
                  </select>
                </div>
              )}

              {editData.targetType === "user" && (
                <div>
                  <label className="block text-sm font-bold text-gray-700">対象ユーザー選択</label>
                  <select value={editData.targetId || ""} onChange={e => handleEditChange("targetId", e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:ring-blue-500 focus:border-blue-500 text-sm">
                    <option value="">選択してください</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name} - {u.email}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700">件名</label>
                  <input type="text" value={editData.title || ""} onChange={e => handleEditChange("title", e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:ring-blue-500 focus:border-blue-500 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700">メッセージ本文</label>
                <textarea rows={5} value={editData.content || ""} onChange={e => handleEditChange("content", e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:ring-blue-500 focus:border-blue-500 text-sm" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700">配信開始日時 (任意)</label>
                  <input type="datetime-local" value={editData.startAt || ""} onChange={e => handleEditChange("startAt", e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:ring-blue-500 focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">配信終了日時 (任意)</label>
                  <input type="datetime-local" value={editData.endAt || ""} onChange={e => handleEditChange("endAt", e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:ring-blue-500 focus:border-blue-500 text-sm" />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-6 pt-4 border-t border-gray-200">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={editData.isImportant || false} onChange={e => handleEditChange("isImportant", e.target.checked)} className="h-5 w-5 rounded text-red-600 focus:ring-red-500 border-gray-300" />
                  <span className="text-sm font-bold text-gray-900">重要フラグ（トップに優先表示）</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={editData.isDismissible || false} onChange={e => handleEditChange("isDismissible", e.target.checked)} className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                  <span className="text-sm font-bold text-gray-900">ユーザーによる削除（既読）を許可</span>
                </label>
              </div>

            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
              <button onClick={closeEditModal} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-bold text-gray-700 bg-white hover:bg-gray-50">
                キャンセル
              </button>
              <button onClick={handleSaveEdit} disabled={isSavingEdit} className="px-6 py-2 border border-transparent rounded-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 flex items-center">
                {isSavingEdit ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新規作成フォーム */}
      <div>
        <h3 className="text-xl font-extrabold text-gray-900 flex items-center">
          <BellRing className="h-6 w-6 mr-2 text-orange-500" /> 新規メッセージ配信
        </h3>
        <p className="text-sm text-gray-500 mt-1">ユーザーのTOP画面に表示されるお知らせバナーを作成します。</p>
      </div>

      <form onSubmit={handleSendMessage} className="bg-white shadow rounded-lg p-6 border border-gray-200 space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">配信ターゲット</label>
          <div className="flex gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="radio" checked={targetType === "all"} onChange={() => setTargetType("all")} className="text-orange-600 focus:ring-orange-500 border-gray-300" />
              <span className="text-sm font-bold text-gray-900">全ユーザー（一斉）</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="radio" checked={targetType === "tenant"} onChange={() => { setTargetType("tenant"); setTargetId(""); }} className="text-orange-600 focus:ring-orange-500 border-gray-300" />
              <span className="text-sm font-bold text-gray-900">特定のテナント</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="radio" checked={targetType === "user"} onChange={() => { setTargetType("user"); setTargetId(""); }} className="text-orange-600 focus:ring-orange-500 border-gray-300" />
              <span className="text-sm font-bold text-gray-900">個別ユーザー</span>
            </label>
          </div>
        </div>

        {targetType === "tenant" && (
          <div>
            <label className="block text-sm font-bold text-gray-700">対象テナント選択</label>
            <select required value={targetId} onChange={e => setTargetId(e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:ring-orange-500 focus:border-orange-500 text-sm">
              <option value="">選択してください</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.schoolCode})</option>)}
            </select>
          </div>
        )}

        {targetType === "user" && (
          <div>
            <label className="block text-sm font-bold text-gray-700">対象ユーザー選択</label>
            <select required value={targetId} onChange={e => setTargetId(e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:ring-orange-500 focus:border-orange-500 text-sm">
              <option value="">選択してください</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} - {u.email}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700">件名</label>
            <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:ring-orange-500 focus:border-orange-500 text-sm shadow-sm" placeholder="【重要】システムメンテナンスのお知らせ" />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700">メッセージ本文</label>
            <textarea required rows={4} value={content} onChange={e => setContent(e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:ring-orange-500 focus:border-orange-500 text-sm shadow-sm" placeholder="本文を入力してください..." />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700">配信開始日時 (任意)</label>
            <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:ring-orange-500 focus:border-orange-500 text-sm shadow-sm" />
            <p className="text-xs text-gray-500 mt-1">未設定の場合はすぐに配信されます。</p>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700">配信終了日時 (任意)</label>
            <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 focus:ring-orange-500 focus:border-orange-500 text-sm shadow-sm" />
            <p className="text-xs text-gray-500 mt-1">未設定の場合は無期限で表示されます。</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" checked={isImportant} onChange={e => setIsImportant(e.target.checked)} className="h-5 w-5 rounded text-red-600 focus:ring-red-500 border-gray-300" />
            <div>
              <span className="block text-sm font-bold text-gray-900">重要フラグ</span>
              <span className="block text-xs text-gray-500">ユーザーの画面で目立つように一番上に表示されます。</span>
            </div>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" checked={isDismissible} onChange={e => setIsDismissible(e.target.checked)} className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
            <div>
              <span className="block text-sm font-bold text-gray-900">削除（既読）を許可</span>
              <span className="block text-xs text-gray-500">ユーザーが✗ボタンで非表示にすることを許可します。</span>
            </div>
          </label>
        </div>

        <div className="pt-4 border-t border-gray-200 text-right">
          <button type="submit" disabled={isSending} className={`inline-flex justify-center items-center py-2 px-8 border border-transparent shadow-sm text-sm font-bold rounded-md text-white transition-colors ${isSending ? "bg-orange-400" : "bg-orange-600 hover:bg-orange-700"}`}>
            {isSending ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Send className="h-5 w-5 mr-2" />}
            配信する
          </button>
        </div>
      </form>

      {/* 配信済みメッセージ一覧 */}
      <div>
        <h3 className="text-lg font-extrabold text-gray-900 mb-4">配信済みメッセージ一覧</h3>
        <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">件名・フラグ</th>
                  <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">配信ターゲット</th>
                  <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">配信期間</th>
                  <th className="px-6 py-3 text-right text-xs font-extrabold text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoadingMessages ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></td></tr>
                ) : messages.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-sm font-bold text-gray-500">配信済みのメッセージはありません</td></tr>
                ) : (
                  messages.map((msg) => (
                    <tr key={msg.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900 break-words">{msg.title}</div>
                        <div className="mt-1 flex gap-2">
                          {msg.isImportant && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">重要</span>}
                          {!msg.isDismissible && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">削除不可</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                        {getTargetName(msg.targetType, msg.targetId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        <div>開始: {msg.startAt ? msg.startAt.replace("T", " ") : "指定なし"}</div>
                        <div>終了: {msg.endAt ? msg.endAt.replace("T", " ") : "指定なし"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button onClick={() => openEditModal(msg)} className="text-blue-600 hover:text-blue-900 bg-blue-50 p-2 rounded-md mr-2">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteMessage(msg.id)} className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-md">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}