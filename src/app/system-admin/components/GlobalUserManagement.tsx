"use client";

import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Edit2, X, Save, Loader2, MessageCircle } from "lucide-react";
import { GlobalUserData, TenantData } from "../page";

type Props = {
  users: GlobalUserData[];
  setUsers: (users: GlobalUserData[]) => void;
  tenants: TenantData[];
  showAlert: (type: "success" | "error", message: string) => void;
};

export default function GlobalUserManagement({ users, setUsers, tenants, showAlert }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  
  const [editingUser, setEditingUser] = useState<GlobalUserData | null>(null);
  const [editData, setEditData] = useState<Partial<GlobalUserData>>({});
  const [isSaving, setIsSaving] = useState(false);

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
    setEditingUser(user);
    setEditData({ ...user });
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditData({});
  };

  const handleEditChange = (field: keyof GlobalUserData | string, value: any) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveChanges = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", editingUser.id), { ...editData });
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...editData } as GlobalUserData : u));
      showAlert("success", "ユーザー情報を更新しました。");
      closeEditModal();
    } catch (error) {
      showAlert("error", "更新に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">

      {/* 編集モーダル */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl my-auto flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="text-lg font-extrabold text-gray-900">ユーザー情報の詳細編集</h3>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3 pb-2 border-b border-gray-100">
                  <h4 className="font-bold text-gray-700">基本情報・ステータス</h4>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">氏名</label>
                  <input type="text" value={editData.name || ""} onChange={(e) => handleEditChange("name", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">ふりがな</label>
                  <input type="text" value={editData.nameKana || ""} onChange={(e) => handleEditChange("nameKana", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">メールアドレス</label>
                  <input type="email" value={editData.email || ""} onChange={(e) => handleEditChange("email", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm" />
                  <p className="text-[10px] text-gray-500 mt-1">※Firebase Auth側の変更は別途必要です</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">アカウント状態</label>
                  <select value={editData.accountStatus || "active"} onChange={(e) => handleEditChange("accountStatus", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm">
                    <option value="active">有効 (Active)</option>
                    <option value="pending">承認待ち (Pending)</option>
                    <option value="rejected">停止・却下 (Rejected)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">システム権限</label>
                  <select value={editData.role || "student"} onChange={(e) => handleEditChange("role", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm">
                    <option value="student">一般生徒</option>
                    <option value="officer">生徒会役員</option>
                    <option value="admin">テナント管理者</option>
                    <option value="system_admin">システム管理者（特権）</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">IT担当者フラグ</label>
                  <div className="mt-3 flex items-center">
                    <input type="checkbox" checked={editData.isITManager || false} onChange={(e) => handleEditChange("isITManager", e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                    <span className="ml-2 text-sm text-gray-700">IT担当者とする</span>
                  </div>
                </div>

                <div className="md:col-span-3 pb-2 border-b border-gray-100 mt-4 flex items-center">
                  <MessageCircle className="h-5 w-5 text-[#06C755] mr-2" />
                  <h4 className="font-bold text-gray-700">LINE通知連携機能</h4>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">連携の許可設定</label>
                  <select 
                    value={(editData as any).lineConnectionAllowed === false ? "false" : "true"} 
                    onChange={(e) => handleEditChange("lineConnectionAllowed", e.target.value === "true")} 
                    className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm"
                  >
                    <option value="true">許可する (デフォルト)</option>
                    <option value="false">許可しない (連携不可)</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700">LINEユーザーID</label>
                  <div className="flex gap-2 mt-1">
                    <input 
                      type="text" 
                      value={(editData as any).lineUserId || ""} 
                      readOnly 
                      className="block w-full border border-gray-300 bg-gray-50 rounded-md py-2 px-3 text-sm text-gray-500" 
                      placeholder="未連携" 
                    />
                    {(editData as any).lineUserId && (
                       <button 
                         type="button" 
                         onClick={() => {
                           handleEditChange("lineUserId", null);
                           handleEditChange("lineNotificationEnabled", false);
                         }} 
                         className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md text-xs font-bold whitespace-nowrap hover:bg-red-100 transition-colors"
                       >
                         強制解除
                       </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">※連携を強制解除する場合は「強制解除」ボタンを押して保存してください</p>
                </div>

                <div className="md:col-span-3 pb-2 border-b border-gray-100 mt-4">
                  <h4 className="font-bold text-gray-700">学校・所属情報</h4>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">所属テナントID</label>
                  <input type="text" value={editData.schoolId || ""} onChange={(e) => handleEditChange("schoolId", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">学籍番号</label>
                  <input type="text" value={editData.studentId || ""} onChange={(e) => handleEditChange("studentId", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">役職名</label>
                  <input type="text" value={editData.positionName || ""} onChange={(e) => handleEditChange("positionName", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">学年</label>
                  <input type="text" value={editData.grade || ""} onChange={(e) => handleEditChange("grade", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">組・クラス</label>
                  <input type="text" value={editData.classNumber || ""} onChange={(e) => handleEditChange("classNumber", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">出席番号</label>
                  <input type="text" value={editData.attendanceNumber || ""} onChange={(e) => handleEditChange("attendanceNumber", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">所属部署・コース</label>
                  <input type="text" value={editData.department || ""} onChange={(e) => handleEditChange("department", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">部活・クラブ</label>
                  <input type="text" value={editData.club || ""} onChange={(e) => handleEditChange("club", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">システム利用番号</label>
                  <input type="text" value={editData.systemId || ""} onChange={(e) => handleEditChange("systemId", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm" />
                </div>

                <div className="md:col-span-3 pb-2 border-b border-gray-100 mt-4">
                  <h4 className="font-bold text-gray-700">パーソナル・連絡先情報</h4>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">性別</label>
                  <select value={editData.gender || ""} onChange={(e) => handleEditChange("gender", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm">
                    <option value="">未設定</option>
                    <option value="male">男性</option>
                    <option value="female">女性</option>
                    <option value="other">その他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">生年月日</label>
                  <input type="date" value={editData.birthDate || ""} onChange={(e) => handleEditChange("birthDate", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">電話番号</label>
                  <input type="text" value={editData.phoneNumber || ""} onChange={(e) => handleEditChange("phoneNumber", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm" />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-bold text-gray-700">所属組織住所</label>
                  <input type="text" value={editData.organizationAddress || ""} onChange={(e) => handleEditChange("organizationAddress", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 text-sm" />
                </div>

              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
              <button onClick={closeEditModal} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-bold text-gray-700 bg-white hover:bg-gray-50">
                キャンセル
              </button>
              <button onClick={handleSaveChanges} disabled={isSaving} className="px-6 py-2 border border-transparent rounded-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 flex items-center">
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
            className="pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-blue-500 focus:border-blue-500 w-full md:w-64 shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">ユーザー情報</th>
                <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">テナント情報</th>
                <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">アカウント状態</th>
                <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">LINE連携</th>
                <th className="px-6 py-3 text-right text-xs font-extrabold text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.slice(0, 100).map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{user.name}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-blue-700">{getTenantName(user.schoolId)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">コード: {getTenantCode(user.schoolId)}</div>
                    <div className="text-xs text-gray-500">権限: {user.role}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold ${
                      user.accountStatus === "active" ? "bg-green-100 text-green-800" :
                      user.accountStatus === "pending" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                    }`}>
                      {user.accountStatus === "active" ? "有効" : user.accountStatus === "pending" ? "承認待ち" : "却下・停止"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(user as any).lineConnectionAllowed === false ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-gray-100 text-gray-500">
                        連携不可
                      </span>
                    ) : (user as any).lineUserId ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-[#e6faed] text-[#00993c]">
                        連携済み
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800">
                        未連携
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button 
                      onClick={() => openEditModal(user)}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-extrabold rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    >
                      <Edit2 className="h-4 w-4 mr-1" /> 詳細編集
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 text-center">
            ※検索結果は最大100件まで表示されます。
          </div>
        </div>
      </div>
    </div>
  );
}