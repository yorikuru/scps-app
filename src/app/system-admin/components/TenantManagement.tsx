"use client";

import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Settings, X, Save, Loader2 } from "lucide-react";
import { TenantData, SYSTEM_MODULES } from "../page";

type Props = {
  tenants: TenantData[];
  setTenants: (tenants: TenantData[]) => void;
  showAlert: (type: "success" | "error", message: string) => void;
};

export default function TenantManagement({ tenants, setTenants, showAlert }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  
  // 編集モーダル用ステート
  const [editingTenant, setEditingTenant] = useState<TenantData | null>(null);
  const [editData, setEditData] = useState<Partial<TenantData>>({});
  const [isSaving, setIsSaving] = useState(false);

  const openEditModal = (tenant: TenantData) => {
    setEditingTenant(tenant);
    setEditData({ ...tenant });
  };

  const closeEditModal = () => {
    setEditingTenant(null);
    setEditData({});
  };

  const handleEditChange = (field: keyof TenantData, value: any) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const toggleModule = (moduleId: string) => {
    const currentModules = editData.availableModules || [];
    const newModules = currentModules.includes(moduleId)
      ? currentModules.filter(m => m !== moduleId)
      : [...currentModules, moduleId];
    handleEditChange("availableModules", newModules);
  };

  const toggleAuthProvider = (provider: string) => {
    const currentProviders = editData.allowedAuthProviders || ["password"];
    const newProviders = currentProviders.includes(provider)
      ? currentProviders.filter(p => p !== provider)
      : [...currentProviders, provider];
    if (!newProviders.includes("password")) newProviders.push("password");
    handleEditChange("allowedAuthProviders", newProviders);
  };

  const handleSaveChanges = async () => {
    if (!editingTenant) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "schools", editingTenant.id), {
        ...editData
      });
      
      setTenants(tenants.map(t => t.id === editingTenant.id ? { ...t, ...editData } as TenantData : t));
      showAlert("success", "テナント情報を更新しました。");
      closeEditModal();
    } catch (error) {
      showAlert("error", "更新に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredTenants = tenants.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.schoolCode.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6">
      
      {/* 編集モーダル */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-auto flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="text-lg font-extrabold text-gray-900">テナント情報の詳細編集</h3>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700">学校（テナント）名</label>
                  <input type="text" value={editData.name || ""} onChange={(e) => handleEditChange("name", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">学校コード</label>
                  <input type="text" value={editData.schoolCode || ""} onChange={(e) => handleEditChange("schoolCode", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">代表者（管理者）氏名</label>
                  <input type="text" value={editData.adminName || ""} onChange={(e) => handleEditChange("adminName", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">代表者（管理者）メールアドレス</label>
                  <input type="email" value={editData.adminEmail || ""} onChange={(e) => handleEditChange("adminEmail", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">学校種別</label>
                  <input type="text" value={editData.schoolType || ""} onChange={(e) => handleEditChange("schoolType", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">アカウント状態</label>
                  <select value={editData.status || "active"} onChange={(e) => handleEditChange("status", e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 text-sm">
                    <option value="active">稼働中 (Active)</option>
                    <option value="suspended">利用停止 (Suspended)</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-bold text-gray-900 mb-3">許可する認証連携プロバイダ</h4>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={editData.allowedAuthProviders?.includes("google") || false} onChange={() => toggleAuthProvider("google")} className="rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                    <span className="text-sm text-gray-700">Google連携</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={editData.allowedAuthProviders?.includes("microsoft") || false} onChange={() => toggleAuthProvider("microsoft")} className="rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                    <span className="text-sm text-gray-700">Microsoft連携</span>
                  </label>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-bold text-gray-900 mb-3">テナントへ提供する機能一括設定</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SYSTEM_MODULES.map(mod => {
                    const isChecked = editData.availableModules?.includes(mod.id) || false;
                    return (
                      <label key={mod.id} className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${isChecked ? "bg-blue-50 border-blue-300" : "bg-white hover:bg-gray-50"}`}>
                        <input type="checkbox" checked={isChecked} onChange={() => toggleModule(mod.id)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                        <span className="ml-3 text-sm font-bold text-gray-900">{mod.name}</span>
                      </label>
                    );
                  })}
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
          <h3 className="text-xl font-extrabold text-gray-900">テナント（学校）管理</h3>
          <p className="text-sm text-gray-500 mt-1">テナントのステータス、認証連携、利用機能の制御を詳細に行います。</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" placeholder="テナント名・コードで検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-blue-500 focus:border-blue-500 w-full md:w-64 shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">テナント情報</th>
                <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase">管理者情報</th>
                <th className="px-6 py-3 text-center text-xs font-extrabold text-gray-500 uppercase">ステータス</th>
                <th className="px-6 py-3 text-right text-xs font-extrabold text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{tenant.name}</div>
                    <div className="text-xs text-gray-500">コード: {tenant.schoolCode}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{tenant.adminName}</div>
                    <div className="text-xs text-gray-500">{tenant.adminEmail}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${tenant.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {tenant.status === "active" ? "稼働中" : "停止中"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button 
                      onClick={() => openEditModal(tenant)}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-extrabold rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    >
                      <Settings className="h-4 w-4 mr-1" /> 詳細編集
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}