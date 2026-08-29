"use client";

import React, { useState, useEffect } from "react";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Settings, X, Save, Loader2, LayoutGrid, CheckCircle, ShieldCheck, Mail, MapPin, QrCode, Shield, Key, Lock, Globe, Database, UserPlus } from "lucide-react";
import { TenantData } from "../page";
import { SystemApp, RolePermissions } from "./AppManagement";
import { useDialog } from "@/components/DialogContext";
import CustomSelect from "@/components/CustomSelect"; // ★ CustomSelectをインポート

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
  const [customExternalAppNames, setCustomExternalAppNames] = useState<Record<string, string>>({});
  
  const [tenantAdmins, setTenantAdmins] = useState<any[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "admin" | "security" | "apps">("basic");

  const { showAlert } = useDialog();

  const filteredTenants = tenants.filter(t => 
    t.name.includes(searchQuery) || t.schoolCode.includes(searchQuery) || (t.adminName || "").includes(searchQuery)
  );

  const openEditModal = async (tenant: TenantData) => {
    setEditingTenant(tenant);
    setEditData({ ...tenant });
    setCustomAppNames((tenant as any).customAppNames || {});
    setCustomAppPerms((tenant as any).appPermissions || {});
    setCustomExternalAppNames((tenant as any).customExternalAppNames || {});
    setActiveTab("basic");

    setIsLoadingAdmins(true);
    try {
      const q = query(collection(db, "users"), where("schoolId", "==", tenant.id));
      const snap = await getDocs(q);
      const admins: any[] = [];
      snap.forEach(d => {
        const u = d.data();
        if (u.role === "admin" || u.role === "system_admin" || u.isITManager || u.role === "it_manager") {
          admins.push({ id: d.id, ...u });
        }
      });
      setTenantAdmins(admins);
    } catch (e) {
      console.error(e);
      setTenantAdmins([]);
    } finally {
      setIsLoadingAdmins(false);
    }
  };

  const closeEditModal = () => {
    setEditingTenant(null); 
    setEditData({}); 
    setCustomAppNames({}); 
    setCustomAppPerms({});
    setCustomExternalAppNames({});
    setTenantAdmins([]);
  };

  const handleEditChange = (field: keyof TenantData, value: any) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleCustomNameChange = (appId: string, name: string) => {
    setCustomAppNames(prev => ({ ...prev, [appId]: name }));
  };

  const handleCustomExternalNameChange = (appId: string, name: string) => {
    setCustomExternalAppNames(prev => ({ ...prev, [appId]: name }));
  };

  const toggleModule = (appId: string) => {
    const currentModules = editData.availableModules || [];
    const newModules = currentModules.includes(appId)
      ? currentModules.filter(m => m !== appId)
      : [...currentModules, appId];
    handleEditChange("availableModules", newModules);
  };

  const toggleExternalModule = (appId: string) => {
    const currentModules = (editData as any).externalAvailableModules || [];
    const newModules = currentModules.includes(appId)
      ? currentModules.filter((m: string) => m !== appId)
      : [...currentModules, appId];
    handleEditChange("externalAvailableModules" as any, newModules);
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
      const cleanCustomNames = { ...customAppNames };
      Object.keys(cleanCustomNames).forEach(key => {
        if (!cleanCustomNames[key] || cleanCustomNames[key].trim() === "") delete cleanCustomNames[key];
      });

      const cleanExternalNames = { ...customExternalAppNames };
      Object.keys(cleanExternalNames).forEach(key => {
        if (!cleanExternalNames[key] || cleanExternalNames[key].trim() === "") delete cleanExternalNames[key];
      });

      const payload = { 
        ...editData,
        customAppNames: cleanCustomNames,
        customExternalAppNames: cleanExternalNames,
        appPermissions: customAppPerms
      };

      await updateDoc(doc(db, "schools", editingTenant.id), payload);
      setTenants(tenants.map(t => t.id === editingTenant.id ? { ...t, ...payload } as TenantData : t));
      
      showAlert("テナント設定を更新しました。", "success");
      closeEditModal();
    } catch (error) {
      showAlert("設定の更新に失敗しました。", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in w-full min-w-0 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 gap-2 sm:gap-4">
        <div>
          <h2 className="text-sm sm:text-lg font-black text-gray-900">テナント（学校）管理</h2>
          <p className="text-[10px] sm:text-xs font-bold text-gray-500 mt-1">登録されているワークスペースの基本設定およびアプリ配信許可を行います。</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
          <input 
            type="text" placeholder="学校名、コード、管理者名で検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl sm:rounded-2xl overflow-hidden w-full">
        <div className="overflow-x-auto custom-scrollbar w-full">
          <table className="min-w-full divide-y divide-gray-200 min-w-[600px]">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3.5 text-left text-[10px] sm:text-[11px] font-black text-gray-500 uppercase tracking-wider">学校名 / コード</th>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3.5 text-left text-[10px] sm:text-[11px] font-black text-gray-500 uppercase tracking-wider">管理者情報</th>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3.5 text-center text-[10px] sm:text-[11px] font-black text-gray-500 uppercase tracking-wider">稼働状況</th>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3.5 text-right text-[10px] sm:text-[11px] font-black text-gray-500 uppercase tracking-wider">アクション</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredTenants.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-xs sm:text-sm font-bold text-gray-400">該当するテナントが見つかりません</td></tr>
              ) : (
                filteredTenants.map(tenant => {
                  const isSuspended = tenant.status === "suspended";
                  return (
                    <tr key={tenant.id} className={`hover:bg-gray-50 transition-colors ${isSuspended ? 'bg-red-50/20' : ''}`}>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap min-w-0">
                        <div className="text-xs sm:text-sm font-black text-gray-900 truncate max-w-[150px] sm:max-w-xs">{tenant.name}</div>
                        <div className="text-[10px] sm:text-xs font-bold text-gray-500 mt-0.5">コード: {tenant.schoolCode}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap min-w-0">
                        <div className="text-[11px] sm:text-sm font-bold text-gray-900 truncate max-w-[150px] sm:max-w-[200px]">{tenant.adminName || "未設定"}</div>
                        <div className="text-[9px] sm:text-xs text-gray-500 mt-0.5 truncate max-w-[150px] sm:max-w-[200px]">{tenant.adminEmail || "未設定"}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black border ${!isSuspended ? "bg-green-50 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-300 animate-pulse"}`}>
                          {!isSuspended ? "稼働中" : "⚠️ 停止中"}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right">
                        <button 
                          onClick={() => openEditModal(tenant)}
                          className="inline-flex items-center px-2.5 sm:px-3 py-1.5 border border-gray-200 shadow-sm text-[10px] sm:text-xs font-bold rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors shrink-0"
                        >
                          <Settings className="h-3.5 w-3.5 mr-1 sm:mr-1.5" /> 詳細設定
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingTenant && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh] sm:max-h-[90vh] animate-slide-up sm:animate-fade-in border border-gray-200">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
              <h3 className="text-xs sm:text-sm font-black text-gray-900 truncate pr-2">{editingTenant.name} の詳細設定</h3>
              <button onClick={closeEditModal} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-full transition-colors shrink-0"><X className="h-4 w-4 sm:h-5 sm:w-5" /></button>
            </div>

            <div className="flex border-b border-gray-100 bg-gray-50 px-2 sm:px-6 pt-2 overflow-x-auto custom-scrollbar shrink-0">
              <button onClick={() => setActiveTab("basic")} className={`pb-2 sm:pb-3 px-3 sm:px-4 text-[10px] sm:text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === "basic" ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>基本設定・所在地</button>
              <button onClick={() => setActiveTab("admin")} className={`pb-2 sm:pb-3 px-3 sm:px-4 text-[10px] sm:text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === "admin" ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>テナント管理者</button>
              <button onClick={() => setActiveTab("security")} className={`pb-2 sm:pb-3 px-3 sm:px-4 text-[10px] sm:text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === "security" ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>認証・セキュリティ・LINE</button>
              <button onClick={() => setActiveTab("apps")} className={`pb-2 sm:pb-3 px-3 sm:px-4 text-[10px] sm:text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === "apps" ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                <LayoutGrid className="w-3.5 h-3.5" /> アプリ配信・権限
              </button>
            </div>

            <div className="p-3 sm:p-6 overflow-y-auto flex-1 custom-scrollbar bg-gray-50/30 w-full min-h-0">
              
              {activeTab === "basic" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 max-w-3xl">
                  <div>
                    <label className="block text-[9px] sm:text-[11px] font-black text-gray-500 mb-1 sm:mb-1.5 uppercase">学校名・テナント名</label>
                    <input type="text" value={editData.name || ""} onChange={(e) => handleEditChange("name", e.target.value)} className="w-full border border-gray-200 rounded-lg sm:rounded-xl p-2 sm:p-3 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs" />
                  </div>
                  <div>
                    <label className="block text-[9px] sm:text-[11px] font-black text-gray-500 mb-1 sm:mb-1.5 uppercase">スクールコード</label>
                    <input type="text" value={editData.schoolCode || ""} disabled className="w-full border border-gray-200 rounded-lg sm:rounded-xl p-2 sm:p-3 text-xs sm:text-sm font-bold bg-gray-100 text-gray-500 cursor-not-allowed shadow-2xs" />
                  </div>
                  <div>
                    <label className="block text-[9px] sm:text-[11px] font-black text-gray-500 mb-1 sm:mb-1.5 uppercase">学校種別 (schoolType)</label>
                    <CustomSelect 
                      value={(editData as any).schoolType || "high_school"} 
                      onChange={(val) => handleEditChange("schoolType" as any, val)} 
                      options={[
                        { value: "elementary", label: "小学校" },
                        { value: "junior_high", label: "中学校" },
                        { value: "high_school", label: "高等学校" },
                        { value: "combined", label: "中高一貫校" },
                        { value: "university", label: "大学・短大" },
                        { value: "other", label: "その他" },
                      ]}
                      buttonClassName="w-full border border-gray-200 rounded-lg sm:rounded-xl px-2.5 py-2 sm:p-3 text-[11px] sm:text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] sm:text-[11px] font-black text-gray-500 mb-1 sm:mb-1.5 uppercase">ステータス</label>
                    <CustomSelect 
                      value={editData.status || "active"} 
                      onChange={(val) => handleEditChange("status", val)} 
                      options={[
                        { value: "active", label: "稼働中 (Active)" },
                        { value: "suspended", label: "⚠️ 停止中 (Suspended)" },
                      ]}
                      buttonClassName={`w-full border rounded-lg sm:rounded-xl px-2.5 py-2 sm:p-3 text-[11px] sm:text-sm font-black outline-none transition-all shadow-2xs ${editData.status === 'suspended' ? 'bg-red-50 text-red-700 border-red-300' : 'bg-white text-gray-900 border-gray-200'}`}
                    />
                  </div>

                  <div className="md:col-span-2 bg-amber-50/50 border border-amber-200 rounded-xl p-3 sm:p-4 shadow-2xs flex items-center justify-between mt-1 sm:mt-2">
                    <div className="pr-3 sm:pr-4">
                      <h4 className="text-[11px] sm:text-sm font-black text-amber-900 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
                        外部ユーザー連携 (ゲスト機能)
                      </h4>
                      <p className="text-[9px] sm:text-[10px] font-bold text-amber-700/80 mt-1 leading-relaxed">
                        このテナントでの外部ユーザー機能の利用をシステムとして許可します。OFFにすると、この学校は外部ユーザー機能の画面自体を利用できなくなります。
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={(editData as any).isExternalUserEnabled || false} 
                        onChange={(e) => handleEditChange("isExternalUserEnabled" as any, e.target.checked)}
                      />
                      <div className="w-10 h-6 sm:w-12 sm:h-7 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 sm:after:h-6 sm:after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-[9px] sm:text-[11px] font-black text-gray-500 mb-1 sm:mb-1.5 uppercase">郵便番号</label>
                    <input type="text" value={(editData as any).postalCode || ""} onChange={(e) => handleEditChange("postalCode" as any, e.target.value)} className="w-full border border-gray-200 rounded-lg sm:rounded-xl p-2 sm:p-3 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs" />
                  </div>
                  <div>
                    <label className="block text-[9px] sm:text-[11px] font-black text-gray-500 mb-1 sm:mb-1.5 uppercase">所在地 (location)</label>
                    <input type="text" value={(editData as any).location || ""} onChange={(e) => handleEditChange("location" as any, e.target.value)} className="w-full border border-gray-200 rounded-lg sm:rounded-xl p-2 sm:p-3 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs" />
                  </div>
                </div>
              )}

              {activeTab === "admin" && (
                <div className="space-y-3 sm:space-y-4 max-w-2xl">
                  <div className="bg-blue-50 border border-blue-100 p-3 sm:p-4 rounded-xl flex items-start gap-2 sm:gap-3 shadow-2xs">
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-[11px] sm:text-sm font-black text-blue-950">テナント管理者情報</h4>
                      <p className="text-[9px] sm:text-[10px] text-blue-800 mt-0.5 leading-relaxed">このワークスペース（学校）に所属するユーザーのうち、権限が「テナント管理者」または「IT担当者」に設定されているユーザー一覧です。</p>
                    </div>
                  </div>

                  {isLoadingAdmins ? (
                    <div className="flex justify-center py-6 sm:py-8"><Loader2 className="animate-spin h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" /></div>
                  ) : tenantAdmins.length === 0 ? (
                    <div className="p-4 sm:p-6 bg-white border border-gray-200 rounded-xl text-center text-[10px] sm:text-xs font-bold text-gray-400">
                      該当するテナント管理者は見つかりませんでした。<br/>（学校登録時の仮代表者: {editingTenant.adminName} / {editingTenant.adminEmail}）
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tenantAdmins.map(adminUsr => (
                        <div key={adminUsr.id} className="p-2.5 sm:p-3.5 bg-white border border-gray-200 rounded-xl sm:rounded-2xl flex items-center justify-between shadow-2xs">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px] sm:text-xs shrink-0">
                              {adminUsr.name?.charAt(0) || "管"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] sm:text-xs font-black text-gray-900 truncate">{adminUsr.name} <span className="text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md ml-1 sm:ml-1.5">{adminUsr.role === "admin" ? "テナント管理者" : "IT担当者"}</span></p>
                              <p className="text-[9px] sm:text-[10px] text-gray-500 truncate mt-0.5">{adminUsr.email || "メール未登録"}</p>
                            </div>
                          </div>
                          <span className="text-[8px] sm:text-[9px] font-mono text-gray-400">ID: {adminUsr.id.substring(0,8)}...</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 sm:pt-3 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label className="block text-[8px] sm:text-[9px] font-black text-gray-400 mb-1 uppercase">初期登録代表者名 (参考)</label>
                      <input type="text" value={editingTenant.adminName || ""} disabled className="w-full bg-gray-100 border border-gray-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-[10px] sm:text-xs font-bold text-gray-600 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-[8px] sm:text-[9px] font-black text-gray-400 mb-1 uppercase">初期登録代表メール (参考)</label>
                      <input type="text" value={editingTenant.adminEmail || ""} disabled className="w-full bg-gray-100 border border-gray-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-[10px] sm:text-xs font-bold text-gray-600 cursor-not-allowed" />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "security" && (
                <div className="space-y-3 sm:space-y-4 max-w-2xl">
                  <div className="p-3 sm:p-4 bg-white border border-gray-200 rounded-xl sm:rounded-2xl space-y-2 sm:space-y-3 shadow-2xs">
                    <h4 className="text-[11px] sm:text-sm font-black text-gray-900 flex items-center gap-1.5"><Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" /> 認証プロバイダ・MFA設定</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pt-1.5 sm:pt-2">
                      <div className="p-2 sm:p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[9px] sm:text-[10px] font-black text-gray-500 uppercase block mb-1">許可された認証プロバイダ</span>
                        <div className="flex flex-wrap gap-1">
                          {((editData as any).allowedAuthProviders || ["password"]).map((prov: string) => (
                            <span key={prov} className="px-1.5 sm:px-2 py-0.5 bg-white border border-gray-200 rounded text-[9px] sm:text-[10px] font-bold text-gray-700">{prov}</span>
                          ))}
                        </div>
                      </div>

                      <div className="p-2 sm:p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[9px] sm:text-[10px] font-black text-gray-500 uppercase block mb-1">許可されたMFA手法</span>
                        <div className="flex flex-wrap gap-1">
                          {((editData as any).allowedMfaMethods || ["totp", "passkey"]).map((mfa: string) => (
                            <span key={mfa} className="px-1.5 sm:px-2 py-0.5 bg-white border border-gray-200 rounded text-[9px] sm:text-[10px] font-bold text-gray-700">{mfa}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 rounded-xl border border-gray-100 mt-1 sm:mt-2">
                      <div>
                        <span className="text-[10px] sm:text-xs font-black text-gray-900 block">多要素認証 (MFA) の強制</span>
                        <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold">このテナントの全ユーザーにMFAを強制します</span>
                      </div>
                      <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[10px] font-black rounded-full border ${(editData as any).requireMfa ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {(editData as any).requireMfa ? "強制ON" : "OFF"}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 sm:p-4 bg-white border border-gray-200 rounded-xl sm:rounded-2xl space-y-2 sm:space-y-3 shadow-2xs">
                    <h4 className="text-[11px] sm:text-sm font-black text-gray-900 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" /> LINE連携・ネットワーク設定</h4>
                    
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      <div className="p-2 sm:p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
                        <span className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase block">LINE機能許可</span>
                        <span className="text-[10px] sm:text-xs font-black text-gray-800 mt-1 block">{(editData as any).lineFeatureAllowed ? "許可" : "不許可"}</span>
                      </div>
                      <div className="p-2 sm:p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
                        <span className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase block">LINE機能有効</span>
                        <span className="text-[10px] sm:text-xs font-black text-gray-800 mt-1 block">{(editData as any).lineFeatureEnabled ? "有効" : "無効"}</span>
                      </div>
                      <div className="p-2 sm:p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
                        <span className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase block">LINE接続強制</span>
                        <span className="text-[10px] sm:text-xs font-black text-gray-800 mt-1 block">{(editData as any).lineConnectionEnforced ? "強制する" : "任意"}</span>
                      </div>
                    </div>

                    <div className="p-2.5 sm:p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <span className="text-[9px] sm:text-[10px] font-black text-gray-500 uppercase block mb-1">安全なIP・ネットワーク (safeIps)</span>
                      <div className="flex flex-wrap gap-1">
                        {((editData as any).safeIps || []).length === 0 ? (
                          <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold">登録なし</span>
                        ) : (
                          ((editData as any).safeIps || []).map((ip: string) => (
                            <span key={ip} className="px-1.5 sm:px-2 py-0.5 bg-white border border-gray-200 rounded text-[9px] sm:text-[10px] font-mono font-bold text-gray-700">{ip}</span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "apps" && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="bg-indigo-50 border border-indigo-100 p-2.5 sm:p-4 rounded-xl flex items-start gap-2 sm:gap-3 shadow-2xs">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] sm:text-xs font-bold text-indigo-900 leading-tight">この学校（テナント）で利用するアプリとその権限を個別にカスタマイズできます。</p>
                      <p className="text-[8px] sm:text-[10px] text-indigo-700 mt-1 leading-relaxed">「テナント専用名」を設定すると、その独自の名前で表示されます。</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:gap-3 mt-1 sm:mt-2">
                    {systemApps.map(app => {
                      const isAllowed = editData.availableModules?.includes(app.appId) || false;
                      const customName = customAppNames[app.appId] || "";
                      const customExtName = customExternalAppNames[app.appId] || "";
                      const appDefaults = app.defaultRoles || DEFAULT_ROLES;
                      const perms = customAppPerms[app.appId] || appDefaults;

                      return (
                        <div key={app.id} className={`p-2.5 sm:p-3 border rounded-xl sm:rounded-2xl transition-colors ${isAllowed ? 'border-indigo-300 bg-white shadow-sm' : 'border-gray-200 bg-gray-50/70'}`}>
                          
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                              <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${isAllowed ? `bg-${app.color}-100 text-${app.color}-600` : 'bg-gray-200 text-gray-500'}`}>
                                <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </div>
                              <div className="min-w-0 pr-1 sm:pr-2">
                                <span className={`text-[11px] sm:text-xs font-black truncate block ${isAllowed ? 'text-gray-900' : 'text-gray-500'}`}>{app.name}</span>
                                <span className="text-[8px] sm:text-[9px] font-bold text-gray-400">ID: {app.appId}</span>
                              </div>
                            </div>
                            
                            <label className="flex items-center cursor-pointer shrink-0">
                              <div className="relative">
                                <input type="checkbox" className="sr-only" checked={isAllowed} onChange={() => toggleModule(app.appId)} />
                                <div className={`block w-8 h-5 sm:w-10 sm:h-6 rounded-full transition-colors ${isAllowed ? 'bg-indigo-500' : 'bg-gray-300'}`}></div>
                                <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 sm:w-4 sm:h-4 rounded-full transition-transform ${isAllowed ? 'transform translate-x-3 sm:translate-x-4' : ''}`}></div>
                              </div>
                            </label>
                          </div>

                          {isAllowed && (
                            <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-gray-100 flex flex-col gap-2.5 sm:gap-3 animate-fade-in">
                              
                              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-start">
                                <div className="flex-1 space-y-2 sm:space-y-3">
                                  <div>
                                    <label className="block text-[8px] sm:text-[9px] font-black text-gray-500 mb-1">テナント専用名 (エイリアス)</label>
                                    <input 
                                      type="text" value={customName} onChange={(e) => handleCustomNameChange(app.appId, e.target.value)} placeholder={`標準: ${app.name}`}
                                      className="w-full text-[10px] sm:text-xs font-bold p-1.5 sm:p-2 border border-gray-300 rounded-lg sm:rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs"
                                    />
                                  </div>

                                  {(editData as any).isExternalUserEnabled && app.isExternalReady && (() => {
                                    const isExtAllowed = (editData as any).externalAvailableModules?.includes(app.appId) || false;
                                    return (
                                      <div className="p-2 sm:p-2.5 bg-amber-50/50 border border-amber-200 rounded-lg sm:rounded-xl space-y-1.5 sm:space-y-2">
                                        <label className="flex items-center cursor-pointer">
                                          <input 
                                            type="checkbox" 
                                            checked={isExtAllowed}
                                            onChange={() => toggleExternalModule(app.appId)}
                                            className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 rounded mr-1.5 sm:mr-2 focus:ring-amber-500"
                                          />
                                          <span className="text-[8px] sm:text-[9px] font-black text-amber-900 flex items-center gap-1">
                                            <Globe className="w-2.5 h-2.5 sm:w-3 sm:h-3"/> このアプリを外部ユーザーに公開する
                                          </span>
                                        </label>
                                        
                                        {isExtAllowed && (
                                          <div className="animate-fade-in pt-1 border-t border-amber-200/50 mt-1">
                                            <label className="block text-[8px] sm:text-[9px] font-black text-amber-700 mb-1 flex items-center gap-1">外部ユーザー向け 表示名</label>
                                            <input 
                                              type="text" value={customExtName} onChange={(e) => handleCustomExternalNameChange(app.appId, e.target.value)} placeholder={`標準: ${app.name}`}
                                              className="w-full text-[10px] sm:text-xs font-bold p-1.5 sm:p-2 border border-amber-300 rounded-md sm:rounded-lg bg-white focus:ring-2 focus:ring-amber-500 outline-none transition-all shadow-2xs"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>

                                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5">
                                  <label className="block text-[8px] sm:text-[9px] font-black text-gray-500 mb-1 sm:mb-1.5 flex items-center gap-1">
                                    <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-600" /> 学校個別権限オーバーライド
                                  </label>
                                  <div className="flex flex-wrap gap-1">
                                    {(Object.keys(ROLE_LABELS) as Array<keyof RolePermissions>).map(roleKey => (
                                      <label key={roleKey} className={`flex items-center gap-1 cursor-pointer px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border text-[8px] sm:text-[9px] font-bold transition-colors ${perms[roleKey] ? 'bg-white border-indigo-300 text-indigo-900 shadow-2xs' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                                        <input type="checkbox" checked={perms[roleKey]} onChange={() => handlePermChange(app.appId, roleKey, appDefaults)} className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-600 rounded" />
                                        {ROLE_LABELS[roleKey]}
                                      </label>
                                    ))}
                                  </div>
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

            <div className="p-3 sm:p-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 rounded-b-2xl sm:rounded-b-3xl shrink-0 pb-5">
              <button onClick={closeEditModal} className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-2.5 text-[10px] sm:text-xs font-bold text-gray-600 bg-gray-100 border border-gray-200 hover:bg-gray-200 rounded-xl transition-colors text-center">キャンセル</button>
              <button onClick={saveTenantSettings} disabled={isSaving} className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-2.5 text-[10px] sm:text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all flex items-center justify-center disabled:opacity-50">
                {isSaving ? <Loader2 className="animate-spin h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" /> : <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />}設定を保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}