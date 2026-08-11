"use client";

import React, { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ExternalUser, UserData, getDefaultChatPermissions } from "../types";
import { User, Mail, Phone, Calendar, Save, Trash2, Key, Copy, Check, X, ArrowLeft, Globe, Edit3, FileText, Shield } from "lucide-react";
import { useDialog } from "@/components/DialogContext";

type Props = {
  userData: UserData;
  mode: "create" | "edit" | "view";
  targetUser?: ExternalUser | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ExternalUserManagement({ userData, mode: initialMode, targetUser, onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<"create" | "edit" | "view">(initialMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const { showAlert, showConfirm } = useDialog();

  const [formData, setFormData] = useState({
    name: "",
    nameKana: "",
    email: "",
    phoneNumber: "",
    category: "student" as "student" | "teacher" | "other",
    affiliation: "",
    validFrom: new Date().toISOString().split("T")[0],
    validUntil: "",
    status: "pending" as "pending" | "verifying" | "verified" | "active" | "suspended", 
    note: "", 
  });

  const [generatedAccount, setGeneratedAccount] = useState<{ loginId: string; initialPassword?: string } | null>(null);

  const perms = getDefaultChatPermissions(userData);
  const canEdit = perms.canEditExternalUser;
  const canDelete = perms.canDeleteExternalUser;

  useEffect(() => {
    setMode(initialMode);
    if (targetUser && (initialMode === "edit" || initialMode === "view")) {
      setFormData({
        name: targetUser.name || "",
        nameKana: targetUser.nameKana || "",
        email: targetUser.email || "",
        phoneNumber: targetUser.phoneNumber || "",
        category: targetUser.category || "student",
        affiliation: targetUser.affiliation || "",
        validFrom: targetUser.validFrom ? targetUser.validFrom.split("T")[0] : new Date().toISOString().split("T")[0],
        validUntil: targetUser.validUntil ? targetUser.validUntil.split("T")[0] : "",
        status: targetUser.status || "pending",
        note: (targetUser as any).note || "",
      });
      if (targetUser.initialPassword) {
        setGeneratedAccount({ loginId: targetUser.loginId, initialPassword: targetUser.initialPassword });
      } else {
        setGeneratedAccount(null);
      }
    } else {
      setFormData({
        name: "",
        nameKana: "",
        email: "",
        phoneNumber: "",
        category: "student",
        affiliation: "",
        validFrom: new Date().toISOString().split("T")[0],
        validUntil: "",
        status: "pending",
        note: "",
      });
      setGeneratedAccount(null);
    }
  }, [initialMode, targetUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category || !formData.validFrom) {
      showAlert("必須項目（名前、区分、有効開始日）を入力してください。", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const expiresAtValue = formData.validUntil 
        ? new Date(`${formData.validUntil}T23:59:59`).toISOString() 
        : null;

      if (mode === "create") {
        const loginId = Math.random().toString(36).substring(2, 10).toUpperCase();
        const initialPassword = Math.random().toString(36).substring(2, 10);
        
        await addDoc(collection(db, "external_users"), {
          schoolId: userData.schoolId,
          loginId: loginId,
          name: formData.name,
          nameKana: formData.nameKana || "",
          email: formData.email || "",
          phoneNumber: formData.phoneNumber || "",
          category: formData.category,
          affiliation: formData.affiliation || "",
          validFrom: formData.validFrom,
          validUntil: formData.validUntil || null,
          expiresAt: expiresAtValue,
          status: "pending",
          initialPassword: initialPassword,
          note: formData.note || "",
          createdAt: serverTimestamp(),
          createdBy: userData.id,
          createdByName: userData.name,
        });

        setGeneratedAccount({ loginId, initialPassword });
        setMode("view");
        showAlert("外部ユーザーを仮登録しました！ログインIDと初期パスワードが発行されました。", "success");

      } else if (mode === "edit" && targetUser) {
        const updateData: any = {
          name: formData.name,
          nameKana: formData.nameKana || "",
          email: formData.email || "",
          phoneNumber: formData.phoneNumber || "",
          category: formData.category,
          affiliation: formData.affiliation || "",
          validFrom: formData.validFrom,
          validUntil: formData.validUntil || null,
          expiresAt: expiresAtValue,
          status: formData.status,
          note: formData.note || "",
          updatedAt: serverTimestamp(),
          updatedBy: userData.id,
        };

        if (formData.status === "pending" && targetUser.status !== "pending") {
          const loginId = Math.random().toString(36).substring(2, 10).toUpperCase();
          const initialPassword = Math.random().toString(36).substring(2, 10);
          
          updateData.loginId = loginId;
          updateData.initialPassword = initialPassword;
          updateData.authUid = null;
          updateData.emailVerifyToken = null;
          updateData.emailVerifyExpires = null;

          if (targetUser.authUid) {
            await fetch("/api/delete-auth-user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ authUid: targetUser.authUid })
            });
          }

          setGeneratedAccount({ loginId, initialPassword });
          showAlert("ステータスを未有効化に変更したため、新しいログインIDと初期パスワードが再発行されました。", "info");
        }

        await updateDoc(doc(db, "external_users", targetUser.id), updateData);
        if (formData.status !== "pending" || targetUser.status === "pending") {
          showAlert("ユーザー情報を更新しました。", "success");
        }
        setMode("view");
      }
      onSuccess();
    } catch (error) {
      console.error(error);
      showAlert("処理に失敗しました。", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ユーザー削除の実行本体
  const executeDelete = async () => {
    if (!targetUser) return;
    try {
      if (targetUser.authUid) {
        await fetch("/api/delete-auth-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authUid: targetUser.authUid })
        });
      }
      await deleteDoc(doc(db, "external_users", targetUser.id));
      showAlert("ユーザーを削除しました。", "success");
      onSuccess();
      onClose();
    } catch (error) {
      showAlert("削除に失敗しました。", "error");
    }
  };

  // ★ showConfirm を用いた削除確認
  const handleDelete = () => {
    if (!targetUser) return;
    showConfirm(
      `「${targetUser.name}」を完全に削除しますか？`,
      executeDelete,
      "danger",
      "ユーザー削除の確認"
    );
  };

  const handleCopyCredentials = () => {
    if (!generatedAccount) return;
    const text = `【SCPS ゲストチャット アカウント情報】\nログインID: ${generatedAccount.loginId}\n初期パスワード: ${generatedAccount.initialPassword || "（変更済み）"}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "student": return "生徒";
      case "teacher": return "教職員";
      default: return "その他";
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "active": return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">有効</span>;
      case "verifying": return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-700 border border-blue-200">メール確認中</span>;
      case "verified": return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-700 border border-purple-200">PW設定待ち</span>;
      case "suspended": return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">停止中</span>;
      default: return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200">仮登録（未有効化）</span>;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/80 flex justify-between items-center sticky top-0 z-20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-amber-500" />
              {mode === "create" ? "新規外部ユーザー登録" : mode === "edit" ? "外部ユーザー情報の編集" : "外部ユーザー詳細"}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mode === "view" && targetUser && (
            <>
              {canEdit && (
                <button onClick={() => setMode("edit")} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1">
                  <Edit3 className="w-3.5 h-3.5" /> 編集
                </button>
              )}
              {canDelete && (
                <button onClick={handleDelete} className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> 削除
                </button>
              )}
            </>
          )}
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5">
        <div className="max-w-3xl mx-auto space-y-3.5">

          {generatedAccount && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 shadow-2xs">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1.5 text-amber-900 font-black text-xs">
                  <Key className="w-4 h-4 text-amber-600" />
                  <span>仮登録認証情報（初回ログイン用）</span>
                </div>
                <button onClick={handleCopyCredentials} className="px-2.5 py-1 bg-amber-600 text-white hover:bg-amber-700 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shadow-2xs">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "コピー完了" : "コピー"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold bg-white p-2.5 rounded-lg border border-amber-200/60">
                <div>
                  <span className="text-gray-400 text-[9px] block">ログインID</span>
                  <span className="text-gray-900 font-mono select-all text-xs">{generatedAccount.loginId}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[9px] block">初期パスワード</span>
                  <span className="text-amber-700 font-mono select-all text-xs">{generatedAccount.initialPassword || "変更済み"}</span>
                </div>
              </div>
            </div>
          )}

          {mode === "view" && targetUser ? (
            <div className="space-y-3">
              <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <h3 className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-500" /> プロフィール & ステータス
                  </h3>
                  <div>{getStatusBadge(formData.status)}</div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block mb-0.5">お名前</span>
                    <span className="font-black text-gray-900 text-sm block truncate">{formData.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block mb-0.5">ふりがな</span>
                    <span className="font-bold text-gray-700 block truncate">{formData.nameKana || "（未登録）"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block mb-0.5">区分</span>
                    <span className="font-bold text-gray-800 block">{getCategoryLabel(formData.category)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block mb-0.5">所属 / 団体名</span>
                    <span className="font-bold text-gray-800 block truncate">{formData.affiliation || "（未登録）"}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-3">
                <h3 className="text-xs font-black text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
                  <Mail className="w-3.5 h-3.5 text-indigo-500" /> 連絡先 & 利用期間
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block mb-0.5">メールアドレス</span>
                    <span className="font-bold text-gray-800 block truncate">{formData.email || "（未登録）"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block mb-0.5">電話番号</span>
                    <span className="font-bold text-gray-800 block truncate">{formData.phoneNumber || "（未登録）"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block mb-0.5">有効開始日</span>
                    <span className="font-bold text-gray-800 block">{formData.validFrom}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block mb-0.5">有効終了日</span>
                    <span className="font-bold text-gray-800 block">{formData.validUntil || "無期限"}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 block mb-0.5">アカウント作成者</span>
                  <span className="font-bold text-gray-700 block">{targetUser.createdByName || "管理者"}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[10px] font-bold text-gray-400 block mb-0.5">備考 / メモ</span>
                  <p className="font-medium text-gray-700 leading-relaxed text-[11px] bg-white p-2 rounded border border-gray-200/60 whitespace-pre-wrap">
                    {formData.note || "メモはありません。"}
                  </p>
                </div>
              </div>

            </div>
          ) : (
            
            <form onSubmit={handleSubmit} className="space-y-3">
              
              <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200 space-y-3">
                <h3 className="text-xs font-black text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-500" /> 基本プロフィール
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-bold text-gray-700 mb-1">
                      名前 <span className="text-red-500">*</span>
                    </label>
                    <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="例: 山田 太郎" className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-bold text-gray-700 mb-1">ふりがな</label>
                    <input type="text" value={formData.nameKana} onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })} placeholder="例: やまだ たろう" className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-bold text-gray-700 mb-1">
                      区分 <span className="text-red-500">*</span>
                    </label>
                    <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as any })} className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="student">生徒</option>
                      <option value="teacher">教職員</option>
                      <option value="other">その他</option>
                    </select>
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-bold text-gray-700 mb-1">所属 / 団体名</label>
                    <input type="text" value={formData.affiliation} onChange={(e) => setFormData({ ...formData, affiliation: e.target.value })} placeholder="例: 〇〇高校 / 印刷会社" className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200 space-y-3">
                <h3 className="text-xs font-black text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-500" /> 連絡先・有効期限
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-700 mb-1">メールアドレス</label>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="yamada@example.com" className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-700 mb-1">電話番号</label>
                    <input type="tel" value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} placeholder="090-0000-0000" className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-700 mb-1">
                      有効開始日 <span className="text-red-500">*</span>
                    </label>
                    <input type="date" required value={formData.validFrom} onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })} className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-700 mb-1">有効終了日 (空欄=無期限)</label>
                    <input type="date" value={formData.validUntil} onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })} className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>

                {mode !== "create" && (
                  <div className="pt-2 border-t border-gray-200/60">
                    <label className="block text-[10px] font-bold text-gray-700 mb-1">アカウントステータス</label>
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })} className="w-full sm:w-1/2 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="pending">仮登録（未有効化）※新しいログインID・パスワードを再発行します</option>
                      <option value="verifying">メール確認中</option>
                      <option value="verified">パスワード設定待ち</option>
                      <option value="active">有効（通常使用中）</option>
                      <option value="suspended">停止中（アクセス不可）</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200">
                <label className="block text-[10px] font-bold text-gray-700 mb-1">備考 / メモ</label>
                <textarea rows={2} value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} placeholder="例: 文化祭パンフレット印刷担当。" className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button type="button" onClick={() => (mode === "edit" ? setMode("view") : onClose())} className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 transition-colors">
                  キャンセル
                </button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {mode === "create" ? "仮登録してID発行" : "更新を保存"}
                </button>
              </div>

            </form>
          )}

        </div>
      </div>
    </div>
  );
}