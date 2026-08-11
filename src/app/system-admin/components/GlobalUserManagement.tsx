"use client";

import React, { useState, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Edit2, X, Save, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { GlobalUserData, TenantData } from "../page";
import { useDialog } from "@/components/DialogContext"; // ★追加

type Props = {
  users: GlobalUserData[];
  setUsers: (users: GlobalUserData[]) => void;
  tenants: TenantData[];
};

// 拡張型定義（MFA等の追加フィールド対応）
type ExtendedGlobalUserData = GlobalUserData & {
  lineConnectionAllowed?: boolean;
  lineUserId?: string;
  lineNotificationEnabled?: boolean;
  requireMfa?: boolean;
  totpSecret?: string;
  passkeys?: any[];
  mfaPolicies?: any;
  useCustomMfaPolicy?: boolean;
};

export default function GlobalUserManagement({ users, setUsers, tenants }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  
  const [editingUser, setEditingUser] = useState<ExtendedGlobalUserData | null>(null);
  const [editData, setEditData] = useState<Partial<ExtendedGlobalUserData>>({});
  const [isSaving, setIsSaving] = useState(false);

  const { showAlert } = useDialog(); // ★追加

  const getTenantName = (schoolId: string) => {
    if (schoolId === "YORIKURU_SYSTEM") return "システム管理 (特権)";
    const t = tenants.find(t => t.id === schoolId);
    return t ? t.name : "不明なテナント";
  };

  const getTenantCode = (schoolId: string) => {
    if (schoolId === "YORIKURU_SYSTEM") return "SYSTEM";
    const t = tenants.find(t => t.id === schoolId);
    return t?.schoolCode ? t.schoolCode : "未設定";
  };

  const openEditModal = (user: GlobalUserData) => {
    setEditingUser(user as ExtendedGlobalUserData);
    setEditData({ ...(user as ExtendedGlobalUserData) });
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditData({});
  };

  const handleEditChange = (field: keyof ExtendedGlobalUserData | string, value: any) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveChanges = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    try {
      // Firestoreは undefined を受け付けないため、undefined のプロパティを削除した安全なオブジェクトを作成
      const safeUpdateData = Object.fromEntries(
        Object.entries(editData).filter(([_, v]) => v !== undefined)
      );

      await updateDoc(doc(db, "users", editingUser.id), safeUpdateData);
      
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...safeUpdateData } as GlobalUserData : u));
      showAlert("ユーザー情報を更新しました。", "success"); // ★引数の順番を変更
      closeEditModal();
    } catch (error) {
      console.error("Save error:", error);
      showAlert("更新に失敗しました。", "error"); // ★引数の順番を変更
    } finally {
      setIsSaving(false);
    }
  };

  // 重複排除と検索フィルタリング
  const filteredUsers = useMemo(() => {
    // 1. まず配列内の重複を完全に排除する（親から重複データが来ても最新のもので上書きして一意にする）
    const uniqueMap = new Map<string, ExtendedGlobalUserData>();
    (users as ExtendedGlobalUserData[]).forEach((u) => {
      if (u && u.id) {
        uniqueMap.set(u.id, u);
      }
    });
    
    let result = Array.from(uniqueMap.values());

    // 2. キーワード検索
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => 
        (u.name && u.name.toLowerCase().includes(q)) || 
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q))
      );
    }
    
    return result;
  }, [users, searchQuery]);

  return (
    <div className="space-y-6">

      {/* 編集モーダル */}
      {editingUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 px-4 py-6 overflow-y-auto backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-auto flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl flex-shrink-0">
              <h3 className="text-xl font-extrabold text-gray-900 flex items-center">
                <Edit2 className="h-5 w-5 mr-2 text-blue-600" />
                ユーザー情報の詳細編集
              </h3>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 p-1.5 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-8 bg-gray-50/50">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="md:col-span-3 pb-2 border-b border-gray-100">
                  <h4 className="font-bold text-gray-900 flex items-center text-sm">
                    <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md mr-2">1</span>基本情報・ステータス
                  </h4>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">氏名</label>
                  <input type="text" value={editData.name || ""} onChange={(e) => handleEditChange("name", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-blue-500 text-sm shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">ふりがな</label>
                  <input type="text" value={editData.nameKana || ""} onChange={(e) => handleEditChange("nameKana", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-blue-500 text-sm shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">メールアドレス</label>
                  <input type="email" value={editData.email || ""} onChange={(e) => handleEditChange("email", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-blue-500 text-sm shadow-sm" />
                  <p className="text-[10px] text-gray-500 mt-1">※Firebase Auth側の変更も必要です</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">アカウント状態</label>
                  <select value={editData.accountStatus || "active"} onChange={(e) => handleEditChange("accountStatus", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-blue-500 text-sm shadow-sm font-bold">
                    <option value="active">有効 (Active)</option>
                    <option value="pending">承認待ち (Pending)</option>
                    <option value="rejected">停止・却下 (Rejected)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">システム権限</label>
                  <select value={editData.role || "student"} onChange={(e) => handleEditChange("role", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-blue-500 text-sm shadow-sm font-bold">
                    <option value="student">一般生徒</option>
                    <option value="officer">生徒会役員</option>
                    <option value="admin">テナント管理者</option>
                    <option value="system_admin">システム管理者（特権）</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">IT担当者フラグ</label>
                  <div className="mt-3 flex items-center bg-blue-50 p-2 rounded-lg border border-blue-100">
                    <input type="checkbox" checked={editData.isITManager || false} onChange={(e) => handleEditChange("isITManager", e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer" />
                    <span className="ml-2 text-sm font-bold text-blue-900 cursor-pointer" onClick={() => handleEditChange("isITManager", !editData.isITManager)}>システム設定の操作を許可</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <div className="pb-2 border-b border-gray-100 flex items-center">
                    <MessageCircle className="h-5 w-5 text-[#06C755] mr-2" />
                    <h4 className="font-bold text-gray-900 text-sm">LINE通知連携設定</h4>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700">連携の許可設定</label>
                    <select 
                      value={editData.lineConnectionAllowed === false ? "false" : "true"} 
                      onChange={(e) => handleEditChange("lineConnectionAllowed", e.target.value === "true")} 
                      className="mt-1 block w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-blue-500 text-sm shadow-sm"
                    >
                      <option value="true">許可する (デフォルト)</option>
                      <option value="false">許可しない (連携不可)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700">LINEユーザーID</label>
                    <div className="flex gap-2 mt-1">
                      <input 
                        type="text" 
                        value={editData.lineUserId || ""} 
                        readOnly 
                        className="block w-full border border-gray-200 bg-gray-100 rounded-lg py-2 px-3 text-sm text-gray-500 shadow-inner" 
                        placeholder="未連携" 
                      />
                      {editData.lineUserId && (
                         <button 
                           type="button" 
                           onClick={() => {
                             handleEditChange("lineUserId", null);
                             handleEditChange("lineNotificationEnabled", false);
                           }} 
                           className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-red-100 transition-colors"
                         >
                           強制解除
                         </button>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">※連携を強制解除する場合は「強制解除」ボタンを押して保存してください</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <div className="pb-2 border-b border-gray-100 flex items-center">
                    <ShieldCheck className="h-5 w-5 text-indigo-600 mr-2" />
                    <h4 className="font-bold text-gray-900 text-sm">2段階認証 (MFA)</h4>
                  </div>
                  <div className="flex items-center justify-between bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                    <div>
                      <p className="text-sm font-bold text-indigo-900">MFAの常時必須化</p>
                      <p className="text-[10px] text-indigo-700">このユーザーのログイン時に2FAを強制します</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={editData.requireMfa || false} onChange={(e) => handleEditChange("requireMfa", e.target.checked)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-bold text-gray-600 border-b border-gray-100 pb-1">現在の設定状況</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">認証アプリ (TOTP):</span>
                      {editData.totpSecret ? <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">設定済</span> : <span className="text-gray-400">未設定</span>}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">パスキー (WebAuthn):</span>
                      {editData.passkeys && editData.passkeys.length > 0 ? <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">{editData.passkeys.length}件登録済</span> : <span className="text-gray-400">未設定</span>}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">個別ポリシー適用:</span>
                      {editData.useCustomMfaPolicy ? <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded">適用中</span> : <span className="text-gray-400">組織準拠</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="md:col-span-4 pb-2 border-b border-gray-100">
                  <h4 className="font-bold text-gray-900 flex items-center text-sm">
                    <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md mr-2">2</span>学校・所属情報
                  </h4>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">所属テナントID</label>
                  <input type="text" value={editData.schoolId || ""} onChange={(e) => handleEditChange("schoolId", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-blue-500 text-sm font-mono shadow-sm bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">学籍番号</label>
                  <input type="text" value={editData.studentId || ""} onChange={(e) => handleEditChange("studentId", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-blue-500 text-sm shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">システム利用番号</label>
                  <input type="text" value={editData.systemId || ""} onChange={(e) => handleEditChange("systemId", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-blue-500 text-sm shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">役職名</label>
                  <input type="text" value={editData.positionName || ""} onChange={(e) => handleEditChange("positionName", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-blue-500 text-sm shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">学年</label>
                  <input type="text" value={editData.grade || ""} onChange={(e) => handleEditChange("grade", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-blue-500 text-sm shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">組・クラス</label>
                  <input type="text" value={editData.classNumber || ""} onChange={(e) => handleEditChange("classNumber", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-blue-500 text-sm shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">出席番号</label>
                  <input type="text" value={editData.attendanceNumber || ""} onChange={(e) => handleEditChange("attendanceNumber", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-blue-500 text-sm shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">所属部署・コース</label>
                  <input type="text" value={editData.department || ""} onChange={(e) => handleEditChange("department", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-blue-500 text-sm shadow-sm" />
                </div>
              </div>

            </div>

            <div className="px-6 py-5 border-t border-gray-200 bg-white rounded-b-2xl flex justify-end space-x-4 flex-shrink-0">
              <button onClick={closeEditModal} className="px-6 py-2.5 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors">
                キャンセル
              </button>
              <button onClick={handleSaveChanges} disabled={isSaving} className="px-8 py-2.5 border border-transparent rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md flex items-center transition-all active:scale-95 disabled:opacity-50">
                {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-extrabold text-gray-900">全ユーザー横断管理</h3>
          <p className="text-sm text-gray-500 mt-1">全テナントに所属するユーザーの検索と、強制的なアカウント操作を行います。</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" placeholder="名前・メール・権限で検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-72 shadow-sm transition-all"
          />
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">ユーザー情報</th>
                <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">テナント・権限</th>
                <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">ステータス / LINE</th>
                <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">MFAセキュリティ</th>
                <th className="px-6 py-4 text-right text-xs font-extrabold text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredUsers.slice(0, 100).map((u) => {
                const user = u as ExtendedGlobalUserData;
                
                // MFA設定状況の判定
                const hasTotp = !!user.totpSecret;
                const hasPasskey = Array.isArray(user.passkeys) && user.passkeys.length > 0;
                const isMfaActive = hasTotp || hasPasskey;
                
                return (
                  <tr key={user.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-blue-700">{getTenantName(user.schoolId)}</div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{getTenantCode(user.schoolId)}</span>
                        <span>{user.role === "admin" ? "管理者" : user.role === "system_admin" ? "特権管理者" : user.role === "officer" ? "生徒会役員" : "一般生徒"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-2 items-start">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          user.accountStatus === "active" ? "bg-green-50 text-green-700 border-green-200" :
                          user.accountStatus === "pending" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-red-50 text-red-700 border-red-200"
                        }`}>
                          {user.accountStatus === "active" ? "有効" : user.accountStatus === "pending" ? "承認待ち" : "却下・停止"}
                        </span>
                        
                        {user.lineConnectionAllowed === false ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
                            LINE連携不可
                          </span>
                        ) : user.lineUserId ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#e6faed] text-[#00993c] border border-[#b3efca]">
                            LINE連携済み
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 text-gray-400 border border-gray-200">
                            LINE未連携
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5 items-start">
                        {user.requireMfa && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 mb-1">
                            <ShieldCheck className="h-3 w-3 mr-1" /> MFA強制対象
                          </span>
                        )}
                        
                        <div className="flex gap-1.5">
                          {hasTotp ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" title="認証アプリ(TOTP)設定済">
                              TOTP
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 text-gray-300 border border-gray-200">
                              TOTP
                            </span>
                          )}
                          
                          {hasPasskey ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" title="パスキー設定済">
                              Passkey
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 text-gray-300 border border-gray-200">
                              Passkey
                            </span>
                          )}
                        </div>
                        
                        {!isMfaActive && (
                          <span className="text-[10px] text-gray-400 font-medium">セキュリティ設定なし</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button 
                        onClick={() => openEditModal(user)}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-xs font-extrabold rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:text-blue-600 focus:outline-none transition-all active:scale-95"
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1.5" /> 詳細編集
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-xs font-bold text-gray-500 text-center">
            ※検索結果は最大100件まで表示されます。
          </div>
        </div>
      </div>
    </div>
  );
}