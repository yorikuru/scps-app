"use client";

import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Settings, X, Save, Loader2, LayoutGrid, CheckCircle, ShieldCheck } from "lucide-react";
import { TenantData } from "../page";
import { SystemApp, RolePermissions } from "./AppManagement";
import { useDialog } from "@/components/DialogContext"; // ★追加

type Props = {
  tenants: TenantData[];
  setTenants: (tenants: TenantData[]) => void;
  systemApps: SystemApp[];
};

const ROLE_LABELS: Record<keyof RolePermissions, string> = {
  admin: "テナント管理者",
  it_manager: "IT担当者",
  teacher: "教員・顧問",
  officer: "生徒会役員",
  guest: "一般生徒・ゲスト"
};

const DEFAULT_ROLES: RolePermissions = { admin: true, it_manager: true, teacher: true, officer: true, guest: false };

export default function TenantManagement({ tenants, setTenants, systemApps }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  
  const [editingTenant, setEditingTenant] = useState<TenantData | null>(null);
  const [editData, setEditData] = useState<Partial<TenantData>>({});
  
  const [customAppNames, setCustomAppNames] = useState<Record<string, string>>({});
  const [customAppPerms, setCustomAppPerms] = useState<Record<string, RolePermissions>>({});
  
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "apps">("basic");

  const { showAlert } = useDialog(); // ★追加

  const filteredTenants = tenants.filter(t => 
    t.name.includes(searchQuery) || t.schoolCode.includes(searchQuery) || t.adminName.includes(searchQuery)
  );

  const openEditModal = (tenant: TenantData) => {
    setEditingTenant(tenant);
    setEditData({ ...tenant });
    setCustomAppNames((tenant as any).customAppNames || {});
    setCustomAppPerms((tenant as any).appPermissions || {});
    setActiveTab("basic");
  };

  const closeEditModal = () => {
    setEditingTenant(null); setEditData({}); setCustomAppNames({}); setCustomAppPerms({});
  };

  const handleEditChange = (field: keyof TenantData, value: any) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleCustomNameChange = (appId: string, name: string) => {
    setCustomAppNames(prev => ({ ...prev, [appId]: name }));
  };

  const toggleModule = (appId: string) => {
    const currentModules = editData.availableModules || [];
    const newModules = currentModules.includes(appId)
      ? currentModules.filter(m => m !== appId)
      : [...currentModules, appId];
    handleEditChange("availableModules", newModules);
  };

  const handlePermChange = (appId: string, roleKey: keyof RolePermissions, defaultRoles: RolePermissions) => {
    const currentPerms = customAppPerms[appId] || defaultRoles || DEFAULT_ROLES;
    setCustomAppPerms(prev => ({
      ...prev,
      [appId]: { ...currentPerms, [roleKey]: !currentPerms[roleKey] }
    }));
  };

  const saveTenantSettings = async () => {
    if (!editingTenant) return;
    setIsSaving(true);
    try {
      // カスタム名 クリーンアップ
      const cleanCustomNames = { ...customAppNames };
      Object.keys(cleanCustomNames).forEach(key => {
        if (!cleanCustomNames[key] || cleanCustomNames[key].trim() === "") delete cleanCustomNames[key];
      });

      const payload = { 
        ...editData,
        customAppNames: cleanCustomNames,
        appPermissions: customAppPerms
      };

      await updateDoc(doc(db, "schools", editingTenant.id), payload);
      setTenants(tenants.map(t => t.id === editingTenant.id ? { ...t, ...payload } as TenantData : t));
      showAlert("テナント設定を更新しました。", "success"); // ★引数の順番を変更
      closeEditModal();
    } catch (error) {
      showAlert("設定の更新に失敗しました。", "error"); // ★引数の順番を変更
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-200 gap-4">
        <div>
          <h2 className="text-lg font-black text-gray-900">テナント（学校）管理</h2>
          <p className="text-xs font-bold text-gray-500 mt-1">登録されているワークスペースの基本設定およびアプリ配信許可を行います。</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" placeholder="学校名、コード、管理者名で検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-6 py-3.5 text-left text-[11px] font-black text-gray-500 uppercase tracking-wider">学校名 / コード</th>
                <th className="px-6 py-3.5 text-left text-[11px] font-black text-gray-500 uppercase tracking-wider">管理者情報</th>
                <th className="px-6 py-3.5 text-center text-[11px] font-black text-gray-500 uppercase tracking-wider">稼働状況</th>
                <th className="px-6 py-3.5 text-right text-[11px] font-black text-gray-500 uppercase tracking-wider">アクション</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredTenants.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-sm font-bold text-gray-400">該当するテナントが見つかりません</td></tr>
              ) : (
                filteredTenants.map(tenant => (
                  <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-black text-gray-900">{tenant.name}</div>
                      <div className="text-xs font-bold text-gray-500 mt-0.5">コード: {tenant.schoolCode}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{tenant.adminName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{tenant.adminEmail}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black border ${tenant.status === "active" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                        {tenant.status === "active" ? "稼働中" : "停止中"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button 
                        onClick={() => openEditModal(tenant)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-200 shadow-sm text-xs font-bold rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"
                      >
                        <Settings className="h-3.5 w-3.5 mr-1.5" /> 詳細・アプリ設定
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 編集モーダル */}
      {editingTenant && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <h3 className="text-sm font-black text-gray-900">{editingTenant.name} の設定</h3>
              <button onClick={closeEditModal} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-full transition-colors"><X className="h-5 w-5" /></button>
            </div>

            {/* タブ */}
            <div className="flex border-b border-gray-100 bg-gray-50 px-6 pt-2">
              <button onClick={() => setActiveTab("basic")} className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors ${activeTab === "basic" ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                基本設定
              </button>
              <button onClick={() => setActiveTab("apps")} className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === "apps" ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                <LayoutGrid className="w-3.5 h-3.5" /> アプリ配信・アクセス権限設定
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-gray-50/30">
              
              {activeTab === "basic" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
                  <div>
                    <label className="block text-[11px] font-black text-gray-500 mb-1.5 uppercase">学校名・テナント名</label>
                    <input type="text" value={editData.name || ""} onChange={(e) => handleEditChange("name", e.target.value)} className="w-full border border-gray-200 rounded-xl p-2.5 text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-gray-500 mb-1.5 uppercase">スクールコード</label>
                    <input type="text" value={editData.schoolCode || ""} disabled className="w-full border border-gray-200 rounded-xl p-2.5 text-sm font-bold bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-gray-500 mb-1.5 uppercase">ステータス</label>
                    <select value={editData.status || "active"} onChange={(e) => handleEditChange("status", e.target.value)} className="w-full border border-gray-200 rounded-xl p-2.5 text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="active">稼働中</option>
                      <option value="suspended">停止中</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === "apps" && (
                <div className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-indigo-900">この学校（テナント）で利用するアプリとその権限を個別にカスタマイズできます。</p>
                      <p className="text-[10px] text-indigo-700 mt-1">「テナント専用名」を入力すると、この学校のサイドバーではその独自の名前で表示されます。アクセス権限は学校ごとの事情に合わせて上書き可能です。</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 mt-4">
                    {systemApps.map(app => {
                      const isAllowed = editData.availableModules?.includes(app.appId) || false;
                      const customName = customAppNames[app.appId] || "";
                      const appDefaults = app.defaultRoles || DEFAULT_ROLES;
                      // このテナントでの権限設定（なければデフォルトを適用）
                      const perms = customAppPerms[app.appId] || appDefaults;

                      return (
                        <div key={app.id} className={`p-4 border rounded-2xl transition-colors ${isAllowed ? 'border-indigo-300 bg-white shadow-sm' : 'border-gray-200 bg-gray-50'}`}>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl flex items-center justify-center ${isAllowed ? `bg-${app.color}-100 text-${app.color}-600` : 'bg-gray-200 text-gray-500'}`}>
                                <LayoutGrid className="w-5 h-5" />
                              </div>
                              <div>
                                <span className={`text-sm font-black ${isAllowed ? 'text-gray-900' : 'text-gray-500'}`}>{app.name}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">ID: {app.appId}</span>
                                  {!app.isActive && <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">システム全体でOFF（テスト・先行公開可能）</span>}
                                </div>
                              </div>
                            </div>
                            
                            <label className="flex items-center cursor-pointer">
                              <div className="relative">
                                <input type="checkbox" className="sr-only" checked={isAllowed} onChange={() => toggleModule(app.appId)} />
                                <div className={`block w-12 h-7 rounded-full transition-colors ${isAllowed ? 'bg-indigo-500' : 'bg-gray-300'}`}></div>
                                <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${isAllowed ? 'transform translate-x-5' : ''}`}></div>
                              </div>
                            </label>
                          </div>

                          {/* アプリがONの場合のみ詳細設定エリアを展開 */}
                          {isAllowed && (
                            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                              
                              {/* 独自名前変更 */}
                              <div>
                                <label className="block text-[11px] font-black text-gray-500 mb-1.5 flex items-center">
                                  テナント専用名 (エイリアス)
                                </label>
                                <input 
                                  type="text" 
                                  value={customName} 
                                  onChange={(e) => handleCustomNameChange(app.appId, e.target.value)}
                                  placeholder={`標準: ${app.name}`}
                                  className="w-full text-xs font-bold p-2 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <p className="text-[9px] text-gray-400 mt-1">空欄の場合はシステム標準名が使用されます。</p>
                              </div>

                              {/* 役職ごとの個別アクセス権限（オーバーライド） */}
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <label className="block text-[10px] font-black text-gray-500 mb-2 flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" /> 学校個別アクセス権限 (オーバーライド)
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  {(Object.keys(ROLE_LABELS) as Array<keyof RolePermissions>).map(roleKey => {
                                    const isDefault = perms[roleKey] === appDefaults[roleKey];
                                    return (
                                      <label key={roleKey} className={`flex items-center gap-1.5 cursor-pointer px-2 py-1.5 rounded-md border text-[10px] font-bold transition-colors ${perms[roleKey] ? 'bg-white border-indigo-300 text-indigo-900 shadow-2xs' : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'}`}>
                                        <input 
                                          type="checkbox" 
                                          checked={perms[roleKey]} 
                                          onChange={() => handlePermChange(app.appId, roleKey, appDefaults)} 
                                          className="w-3 h-3 text-indigo-600 rounded" 
                                        />
                                        {ROLE_LABELS[roleKey]}
                                        {!isDefault && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-0.5" title="デフォルトから変更済み"></span>}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>

                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            <div className="p-5 border-t border-gray-100 bg-white flex justify-end gap-3 rounded-b-3xl">
              <button onClick={closeEditModal} className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors">
                キャンセル
              </button>
              <button onClick={saveTenantSettings} disabled={isSaving} className="px-8 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all flex items-center">
                {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                設定を保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}