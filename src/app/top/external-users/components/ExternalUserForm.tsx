"use client";

import React, { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User, Mail, Phone, Save, Trash2, Key, Copy, Check, X, ArrowLeft, Globe, Edit3, Shield, LayoutGrid, Loader2 } from "lucide-react";
import { useDialog } from "@/components/DialogContext";
import { SystemApp } from "@/app/system-admin/components/AppManagement";
import { ExternalUser } from "@/app/types/external";

type Props = {
  userData: any; 
  mode: "create" | "edit" | "view";
  targetUser?: ExternalUser | null;
  onClose: () => void;
  onSuccess: () => void;
  systemApps: SystemApp[]; 
  schoolData: any;         
  setMode: (mode: "create" | "edit" | "view") => void;
};

export default function ExternalUserForm({ userData, mode, targetUser, onClose, onSuccess, systemApps, schoolData, setMode }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const { showAlert, showConfirm } = useDialog();

  const [formData, setFormData] = useState({
    name: "", nameKana: "", email: "", phoneNumber: "", category: "student" as any, affiliation: "",
    validFrom: new Date().toISOString().split("T")[0], validUntil: "", status: "pending" as any, note: "", allowedModules: [] as string[], 
  });

  const [generatedAccount, setGeneratedAccount] = useState<{ loginId: string; initialPassword?: string } | null>(null);

  const extPerms = schoolData?.externalUserPermissions || {
    canCreate: ["admin", "system_admin", "it_manager", "teacher"],
    canView: ["admin", "system_admin", "it_manager", "teacher", "officer"],
    canEdit: ["admin", "system_admin", "it_manager"],
    canDelete: ["admin", "system_admin", "it_manager"]
  };

  const userRole = userData?.role || "guest";
  const canEdit = extPerms.canEdit.includes(userRole) || userData?.isITManager;
  const canDelete = extPerms.canDelete.includes(userRole) || userData?.isITManager;
  
  // ★ 修正：システム側で稼働中 かつ テナントの外部向けモジュールとして許可されているアプリのみ抽出
  const availableApps = systemApps.filter(app => 
    app.isActive && 
    schoolData?.externalAvailableModules?.includes(app.appId || app.id)
  );

  useEffect(() => {
    if (targetUser && (mode === "edit" || mode === "view")) {
      setFormData({
        name: targetUser.name || "", nameKana: targetUser.nameKana || "", email: targetUser.email || "", phoneNumber: targetUser.phoneNumber || "",
        category: targetUser.category || "student", affiliation: targetUser.affiliation || "",
        validFrom: targetUser.validFrom ? targetUser.validFrom.split("T")[0] : new Date().toISOString().split("T")[0],
        validUntil: targetUser.validUntil ? targetUser.validUntil.split("T")[0] : "", status: targetUser.status || "pending",
        note: targetUser.note || "", allowedModules: targetUser.allowedModules || ["chat"], 
      });
      setGeneratedAccount(targetUser.initialPassword ? { loginId: targetUser.loginId, initialPassword: targetUser.initialPassword } : null);
    } else {
      setFormData({
        name: "", nameKana: "", email: "", phoneNumber: "", category: "student", affiliation: "",
        validFrom: new Date().toISOString().split("T")[0], validUntil: "", status: "pending", note: "", allowedModules: ["chat"], 
      });
      setGeneratedAccount(null);
    }
  }, [mode, targetUser]);

  const handleModuleToggle = (appId: string) => {
    setFormData(prev => ({
      ...prev, allowedModules: prev.allowedModules.includes(appId) ? prev.allowedModules.filter(id => id !== appId) : [...prev.allowedModules, appId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category || !formData.validFrom) return showAlert("必須項目（名前、区分、有効開始日）を入力してください。","warning");
    if (formData.allowedModules.length === 0) return showAlert("少なくとも1つの利用可能アプリを選択してください。","warning");

    setIsSubmitting(true);
    try {
      const expiresAtValue = formData.validUntil ? new Date(`${formData.validUntil}T23:59:59`).toISOString() : null;
      if (mode === "create") {
        const loginId = Math.random().toString(36).substring(2, 10).toUpperCase();
        const initialPassword = Math.random().toString(36).substring(2, 10);
        await addDoc(collection(db, "external_users"), {
          schoolId: userData.schoolId, loginId, ...formData, expiresAt: expiresAtValue,
          initialPassword, createdAt: serverTimestamp(), createdBy: userData.id, createdByName: userData.name,
        });
        setGeneratedAccount({ loginId, initialPassword });
        setMode("view");
        showAlert("外部ユーザーを仮登録しました！ログインIDと初期パスワードが発行されました。","success");
      } else if (mode === "edit" && targetUser) {
        const updateData: any = { ...formData, expiresAt: expiresAtValue, updatedAt: serverTimestamp(), updatedBy: userData.id };
        if (formData.status === "pending" && targetUser.status !== "pending") {
          const loginId = Math.random().toString(36).substring(2, 10).toUpperCase();
          const initialPassword = Math.random().toString(36).substring(2, 10);
          Object.assign(updateData, { loginId, initialPassword, authUid: null, emailVerifyToken: null, emailVerifyExpires: null });
          if (targetUser.authUid) await fetch("/api/delete-auth-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ authUid: targetUser.authUid }) });
          setGeneratedAccount({ loginId, initialPassword });
          showAlert("ステータスを未有効化に変更したため、新しいログインIDと初期パスワードが再発行されました。","info");
        }
        await updateDoc(doc(db, "external_users", targetUser.id), updateData);
        if (formData.status !== "pending" || targetUser.status === "pending") showAlert("ユーザー情報を更新しました。","success");
        setMode("view");
      }
      onSuccess();
    } catch (error) {
      showAlert("処理に失敗しました。","error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!targetUser) return;
    showConfirm(`「${targetUser.name}」を完全に削除しますか？`, async () => {
      try {
        if (targetUser.authUid) await fetch("/api/delete-auth-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ authUid: targetUser.authUid }) });
        await deleteDoc(doc(db, "external_users", targetUser.id));
        showAlert("ユーザーを削除しました。","success");
        onSuccess(); onClose();
      } catch (e) { showAlert("削除に失敗しました。","error"); }
    }, "danger", "ユーザー削除の確認");
  };

  const handleCopyCredentials = () => {
    if (!generatedAccount) return;
    navigator.clipboard.writeText(`【SCPS ゲストアカウント情報】\nログインID: ${generatedAccount.loginId}\n初期パスワード: ${generatedAccount.initialPassword || "（変更済み）"}\n\nこちらのアカウントで専用ポータルにログインしてください。`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const getCatLabel = (c: string) => c==="student"?"生徒":c==="teacher"?"教職員":"その他";
  const getBadge = (s: string) => {
    switch (s) {
      case "active": return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">有効</span>;
      case "verifying": return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-700 border border-blue-200">メール確認中</span>;
      case "verified": return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-700 border border-purple-200">PW設定待ち</span>;
      case "suspended": return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">停止中</span>;
      default: return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200">仮登録（未有効化）</span>;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden sm:rounded-3xl shadow-2xl">
      <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-200 bg-gray-50/80 flex justify-between items-center sticky top-0 z-20 backdrop-blur-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={onClose} className="p-1.5 sm:p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"><ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" /></button>
          <h2 className="text-xs sm:text-sm font-black text-gray-900 flex items-center gap-1.5"><Globe className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />{mode === "create" ? "新規ゲスト登録" : mode === "edit" ? "ゲスト情報の編集" : "ゲスト詳細"}</h2>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {mode === "view" && targetUser && (
            <>
              {canEdit && <button onClick={() => setMode("edit")} className="px-2.5 sm:px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 text-[10px] sm:text-xs font-bold rounded-lg flex items-center gap-1"><Edit3 className="w-3.5 h-3.5" /> 編集</button>}
              {canDelete && <button onClick={handleDelete} className="px-2.5 sm:px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-[10px] sm:text-xs font-bold rounded-lg flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> 削除</button>}
            </>
          )}
          <button onClick={onClose} className="p-1.5 sm:p-2 text-gray-400 hover:bg-gray-200 rounded-full"><X className="w-4 h-4 sm:w-5 sm:h-5" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 bg-[#FAFAFA]">
        <div className="max-w-3xl mx-auto space-y-4">
          {generatedAccount && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 sm:p-4 shadow-sm animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 text-amber-900 font-black text-[11px] sm:text-xs">
                  <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" /><span>仮登録認証情報（初回ログイン用）</span>
                </div>
                <button onClick={handleCopyCredentials} className="px-3 py-1.5 bg-amber-600 text-white hover:bg-amber-700 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 shadow-sm w-full sm:w-auto">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "コピー完了" : "コピー"}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs font-bold bg-white p-3 rounded-xl border border-amber-200/60 shadow-inner">
                <div className="bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                  <span className="text-gray-400 text-[9px] sm:text-[10px] block mb-0.5">ログインID</span>
                  <span className="text-gray-900 font-mono select-all text-xs sm:text-sm">{generatedAccount.loginId}</span>
                </div>
                <div className="bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                  <span className="text-gray-400 text-[9px] sm:text-[10px] block mb-0.5">初期パスワード</span>
                  <span className="text-amber-700 font-mono select-all text-xs sm:text-sm">{generatedAccount.initialPassword || "変更済み"}</span>
                </div>
              </div>
            </div>
          )}

          {mode === "view" && targetUser ? (
            <div className="space-y-4">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="text-xs sm:text-sm font-black text-gray-800 flex items-center gap-1.5"><User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" /> プロフィール & ステータス</h3>
                  <div>{getBadge(formData.status)}</div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-[11px] sm:text-xs">
                  <div><span className="text-[9px] sm:text-[10px] font-bold text-gray-400 block mb-0.5">お名前</span><span className="font-black text-gray-900 text-xs sm:text-sm block truncate">{formData.name}</span></div>
                  <div><span className="text-[9px] sm:text-[10px] font-bold text-gray-400 block mb-0.5">ふりがな</span><span className="font-bold text-gray-700 block truncate">{formData.nameKana || "（未登録）"}</span></div>
                  <div><span className="text-[9px] sm:text-[10px] font-bold text-gray-400 block mb-0.5">区分</span><span className="font-bold text-gray-800 block">{getCatLabel(formData.category)}</span></div>
                  <div><span className="text-[9px] sm:text-[10px] font-bold text-gray-400 block mb-0.5">所属 / 団体名</span><span className="font-bold text-gray-800 block truncate">{formData.affiliation || "（未登録）"}</span></div>
                </div>
              </div>
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="text-xs sm:text-sm font-black text-gray-800 flex items-center gap-1.5 border-b border-gray-100 pb-3"><Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" /> 連絡先 & 利用期間</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 text-[11px] sm:text-xs">
                  <div className="sm:col-span-2"><span className="text-[9px] sm:text-[10px] font-bold text-gray-400 block mb-0.5">メールアドレス</span><span className="font-bold text-gray-800 block truncate">{formData.email || "（未登録）"}</span></div>
                  <div className="sm:col-span-2"><span className="text-[9px] sm:text-[10px] font-bold text-gray-400 block mb-0.5">電話番号</span><span className="font-bold text-gray-800 block truncate">{formData.phoneNumber || "（未登録）"}</span></div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:col-span-4">
                    <div><span className="text-[9px] sm:text-[10px] font-bold text-gray-400 block mb-0.5">有効開始日</span><span className="font-bold text-gray-800 block">{formData.validFrom}</span></div>
                    <div><span className="text-[9px] sm:text-[10px] font-bold text-gray-400 block mb-0.5">有効終了日</span><span className="font-bold text-gray-800 block">{formData.validUntil || "無期限"}</span></div>
                  </div>
                </div>
              </div>
              <div className="bg-indigo-50/50 p-4 sm:p-5 rounded-2xl border border-indigo-100 shadow-sm space-y-3">
                <h3 className="text-xs sm:text-sm font-black text-indigo-900 flex items-center gap-1.5 border-b border-indigo-200 pb-2"><LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" /> 利用可能なアプリ</h3>
                <div className="flex flex-wrap gap-2 pt-1">
                  {formData.allowedModules.length === 0 ? <span className="text-[10px] sm:text-xs font-bold text-gray-500">利用可能なアプリはありません。</span> : formData.allowedModules.map(appId => {
                    const appMeta = systemApps.find(a => a.appId === appId || a.id === appId);
                    const appName = schoolData?.customExternalAppNames?.[appId] || schoolData?.customAppNames?.[appId] || appMeta?.name || appId;
                    return <div key={appId} className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white border border-indigo-200 rounded-lg text-[10px] sm:text-xs font-bold text-indigo-800 shadow-sm flex items-center gap-1 sm:gap-1.5"><Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500" /> {appName}</div>;
                  })}
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-black text-gray-800 flex items-center gap-1.5 border-b border-gray-100 pb-2"><User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" /> 基本プロフィール</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div><label className="block text-[9px] sm:text-[10px] font-bold text-gray-700 mb-1.5 uppercase">名前 <span className="text-red-500">*</span></label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs" /></div>
                  <div><label className="block text-[9px] sm:text-[10px] font-bold text-gray-700 mb-1.5 uppercase">ふりがな</label><input type="text" value={formData.nameKana} onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })} className="w-full px-3 py-2 bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs" /></div>
                  <div><label className="block text-[9px] sm:text-[10px] font-bold text-gray-700 mb-1.5 uppercase">区分 <span className="text-red-500">*</span></label><select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as any })} className="w-full px-3 py-2 bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs"><option value="student">生徒</option><option value="teacher">教職員</option><option value="other">その他</option></select></div>
                  <div><label className="block text-[9px] sm:text-[10px] font-bold text-gray-700 mb-1.5 uppercase">所属 / 団体名</label><input type="text" value={formData.affiliation} onChange={(e) => setFormData({ ...formData, affiliation: e.target.value })} className="w-full px-3 py-2 bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs" /></div>
                </div>
              </div>
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-black text-gray-800 flex items-center gap-1.5 border-b border-gray-100 pb-2"><Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" /> 連絡先・有効期限</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="sm:col-span-2"><label className="block text-[9px] sm:text-[10px] font-bold text-gray-700 mb-1.5 uppercase">メールアドレス</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs" /></div>
                  <div className="sm:col-span-2"><label className="block text-[9px] sm:text-[10px] font-bold text-gray-700 mb-1.5 uppercase">電話番号</label><input type="tel" value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} className="w-full px-3 py-2 bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs" /></div>
                  <div><label className="block text-[9px] sm:text-[10px] font-bold text-gray-700 mb-1.5 uppercase">有効開始日 <span className="text-red-500">*</span></label><input type="date" required value={formData.validFrom} onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })} className="w-full px-3 py-2 bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs" /></div>
                  <div><label className="block text-[9px] sm:text-[10px] font-bold text-gray-700 mb-1.5 uppercase">有効終了日 (空欄=無期限)</label><input type="date" value={formData.validUntil} onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })} className="w-full px-3 py-2 bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs" /></div>
                </div>
                {mode !== "create" && (
                  <div className="pt-3 sm:pt-4 mt-2 border-t border-gray-100">
                    <label className="block text-[9px] sm:text-[10px] font-bold text-gray-700 mb-1.5 uppercase">アカウントステータス</label>
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })} className="w-full sm:w-1/2 px-3 py-2 bg-gray-50 focus:bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs">
                      <option value="pending">仮登録（未有効化）※新しいパスワードを再発行</option>
                      <option value="verifying">メール確認中</option><option value="verified">パスワード設定待ち</option>
                      <option value="active">有効（通常使用中）</option><option value="suspended">停止中（アクセス不可）</option>
                    </select>
                  </div>
                )}
              </div>
              
              <div className="bg-indigo-50/50 p-4 sm:p-5 rounded-2xl border border-indigo-100 shadow-sm space-y-3 sm:space-y-4">
                <div className="border-b border-indigo-200 pb-2"><h3 className="text-xs sm:text-sm font-black text-indigo-900 flex items-center gap-1.5"><LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" /> 利用可能なアプリ</h3></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 pt-1">
                  {availableApps.length === 0 ? (
                    <div className="col-span-full text-[10px] sm:text-xs font-bold text-gray-500 p-2">このテナントで外部ユーザーに許可されているアプリはありません。</div>
                  ) : (
                    availableApps.map(app => {
                      const appId = app.appId || app.id;
                      const isChecked = formData.allowedModules.includes(appId);
                      const appName = schoolData?.customExternalAppNames?.[appId] || schoolData?.customAppNames?.[appId] || app.name || appId;
                      return (
                        <label key={appId} className={`flex items-center gap-2 sm:gap-2.5 p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-all shadow-2xs ${isChecked ? 'bg-white border-indigo-400 text-indigo-900' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-white'}`}>
                          <input type="checkbox" checked={isChecked} onChange={() => handleModuleToggle(appId)} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                          <span className="text-[11px] sm:text-xs font-bold truncate">{appName}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
              
              <div className="flex justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => (mode === "edit" ? setMode("view") : onClose())} className="w-full sm:w-auto px-4 sm:px-5 py-2.5 bg-gray-100 text-gray-700 text-xs sm:text-sm font-bold rounded-xl hover:bg-gray-200 transition-colors">キャンセル</button>
                <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-6 sm:px-8 py-2.5 bg-indigo-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}{mode === "create" ? "仮登録してID発行" : "更新を保存"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}