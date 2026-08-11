"use client";

import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Edit2, Trash2, Save, X, Loader2, LayoutGrid, Globe, CheckSquare, Square, Search, ShieldCheck } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useDialog } from "@/components/DialogContext";

export type RolePermissions = {
  admin: boolean;
  it_manager: boolean;
  teacher: boolean;
  officer: boolean;
  guest: boolean;
};

export type SystemApp = {
  id: string;
  appId: string; 
  name: string;
  description: string;
  icon: string;
  color: string;
  path: string;
  isActive: boolean;
  order: number;
  defaultRoles: RolePermissions; 
};

const TAILWIND_COLORS = [
  "slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber", 
  "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", 
  "indigo", "violet", "purple", "fuchsia", "pink", "rose"
];

const AVAILABLE_ICONS = [
  "Activity", "AlertCircle", "Archive", "Award", "BarChart2", "Bell", "BookOpen", "Bookmark", "Box", "Briefcase", "Calendar", "Camera", "CheckCircle", "CheckSquare", "Clipboard", "Clock", "Cloud", "Code", "CreditCard", "Database", "FileText", "Folder", "Globe", "Grid", "Home", "Image", "Inbox", "Info", "Key", "Layers", "LayoutDashboard", "Link", "List", "Lock", "Mail", "MapPin", "MessageSquare", "MessageSquareText", "Monitor", "Phone", "PieChart", "Save", "Search", "Send", "Settings", "ShieldCheck", "Smartphone", "Star", "Tablet", "Trash2", "Upload", "User", "Users", "Video"
];

const ROLE_LABELS: Record<keyof RolePermissions, string> = {
  admin: "テナント管理者",
  it_manager: "IT担当者",
  teacher: "教員・顧問",
  officer: "生徒会役員",
  guest: "一般生徒・ゲスト"
};

const DEFAULT_ROLES: RolePermissions = { admin: true, it_manager: true, teacher: true, officer: true, guest: false };

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

// ★ Props から showAlert を削除しました
export default function AppManagement() {
  const [apps, setApps] = useState<SystemApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [iconSearch, setIconSearch] = useState("");

  // ★ ダイアログフックを取得
  const { showAlert, showConfirm } = useDialog();

  // 配信管理モーダル用ステート
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [deployApp, setDeployApp] = useState<SystemApp | null>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [tenantSearch, setTenantSearch] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);

  const [formData, setFormData] = useState<Partial<SystemApp>>({
    appId: "", name: "", description: "", icon: "Box", color: "indigo", path: "", isActive: true, order: 0, defaultRoles: DEFAULT_ROLES
  });

  useEffect(() => { fetchApps(); }, []);

  const fetchApps = async () => {
    try {
      const q = query(collection(db, "system_apps"), orderBy("order", "asc"));
      const snapshot = await getDocs(q);
      const appData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemApp));
      setApps(appData);
    } catch (error) {
      showAlert("アプリ情報の取得に失敗しました。", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const openNewModal = () => {
    setFormData({ appId: "", name: "", description: "", icon: "Box", color: "indigo", path: "", isActive: true, order: apps.length * 10, defaultRoles: DEFAULT_ROLES });
    setIsEditing(false); setIconSearch(""); setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = { ...formData, order: Number(formData.order) };
      if (isEditing && formData.id) {
        await updateDoc(doc(db, "system_apps", formData.id), payload);
        showAlert("アプリを更新しました。", "success");
      } else {
        await addDoc(collection(db, "system_apps"), payload);
        showAlert("新しいアプリを作成しました。", "success");
      }
      setIsModalOpen(false); fetchApps();
    } catch (error) { showAlert("保存に失敗しました。", "error"); } finally { setIsSaving(false); }
  };

  // 削除処理本体
  const executeDelete = async (id: string) => {
    try { 
      await deleteDoc(doc(db, "system_apps", id)); 
      showAlert("削除しました。", "success"); 
      fetchApps(); 
    } catch (e) { 
      showAlert("削除に失敗しました。", "error"); 
    }
  };

  // 削除確認
  const handleDelete = (id: string) => {
    // ★ showConfirm に置換
    showConfirm(
      "本当に削除しますか？\n全テナントから完全にアクセスできなくなります。",
      () => executeDelete(id),
      "danger",
      "アプリの削除"
    );
  };

  const handleRoleToggle = (roleKey: keyof RolePermissions) => {
    setFormData(prev => ({
      ...prev, defaultRoles: { ...(prev.defaultRoles || DEFAULT_ROLES), [roleKey]: !(prev.defaultRoles || DEFAULT_ROLES)[roleKey] }
    }));
  };

  // 配信管理モーダルを開く
  const openDeployModal = async (app: SystemApp) => {
    setDeployApp(app);
    setIsDeployModalOpen(true);
    setSelectedTenants([]);
    setTenantSearch("");
    try {
      const snap = await getDocs(collection(db, "schools"));
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { showAlert("テナント一覧の取得に失敗しました。", "error"); }
  };

  const toggleTenantSelection = (id: string) => {
    setSelectedTenants(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const selectAllFiltered = () => {
    const filteredIds = tenants.filter(t => t.name.includes(tenantSearch) || t.schoolCode.includes(tenantSearch)).map(t => t.id);
    const allSelected = filteredIds.every(id => selectedTenants.includes(id));
    if (allSelected) {
      setSelectedTenants(prev => prev.filter(id => !filteredIds.includes(id))); // 選択解除
    } else {
      setSelectedTenants(prev => Array.from(new Set([...prev, ...filteredIds]))); // 全選択
    }
  };

  // 一括ON/OFF 実行処理本体
  const executeBulkProcess = async (action: "enable" | "disable") => {
    setIsDeploying(true);
    try {
      const batch = writeBatch(db);
      selectedTenants.forEach(tenantId => {
        const tenant = tenants.find(t => t.id === tenantId);
        if (!tenant) return;
        let modules = tenant.availableModules || [];
        
        if (action === "enable" && !modules.includes(deployApp!.appId)) {
          modules.push(deployApp!.appId);
          batch.update(doc(db, "schools", tenantId), { availableModules: modules });
        } else if (action === "disable" && modules.includes(deployApp!.appId)) {
          modules = modules.filter((m: string) => m !== deployApp!.appId);
          batch.update(doc(db, "schools", tenantId), { availableModules: modules });
        }
      });
      await batch.commit();
      showAlert(`一括設定（${action === 'enable' ? 'ON' : 'OFF'}）が完了しました。`, "success");
      setIsDeployModalOpen(false);
    } catch (error) {
      showAlert("一括設定に失敗しました。", "error");
    } finally {
      setIsDeploying(false);
    }
  };

  // 一括ON / OFFの確認
  const executeBulkDeploy = (action: "enable" | "disable") => {
    if (selectedTenants.length === 0) return;
    // ★ showConfirm に置換
    showConfirm(
      `選択した ${selectedTenants.length} 件のテナントに対して、このアプリを「${action === 'enable' ? '利用ON' : '利用OFF'}」にします。よろしいですか？`,
      () => executeBulkProcess(action),
      action === 'enable' ? "info" : "danger",
      "一括設定の確認"
    );
  };

  const filteredIcons = AVAILABLE_ICONS.filter(icon => icon.toLowerCase().includes(iconSearch.toLowerCase()));
  const filteredTenants = tenants.filter(t => t.name.includes(tenantSearch) || t.schoolCode.includes(tenantSearch));

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-indigo-600" /> プラグイン・アプリ管理
          </h2>
          <p className="text-xs font-bold text-gray-500 mt-1">システム全体で提供するアプリの作成、権限設定、テナントへの一括配信を行います。</p>
        </div>
        <button onClick={openNewModal} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl flex items-center shadow-sm transition-colors">
          <Plus className="h-4 w-4 mr-1.5" /> アプリを新規作成
        </button>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-6 py-3.5 text-left text-[11px] font-black text-gray-500 uppercase tracking-wider">アプリ情報</th>
                <th className="px-6 py-3.5 text-left text-[11px] font-black text-gray-500 uppercase tracking-wider">システム設定</th>
                <th className="px-6 py-3.5 text-center text-[11px] font-black text-gray-500 uppercase tracking-wider">稼働状況</th>
                <th className="px-6 py-3.5 text-right text-[11px] font-black text-gray-500 uppercase tracking-wider">アクション</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {apps.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-sm font-bold text-gray-400">アプリが登録されていません</td></tr>
              ) : (
                apps.map(app => (
                  <tr key={app.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`p-2.5 rounded-xl bg-${app.color}-50 border border-${app.color}-100 text-${app.color}-600`}>
                          <DynamicIcon name={app.icon} className="h-5 w-5" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-black text-gray-900">{app.name}</p>
                          <p className="text-xs font-bold text-gray-500 mt-0.5 max-w-xs truncate">{app.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-gray-700 bg-gray-100 inline-block px-2 py-1 rounded-md mb-1">{app.path}</div>
                      <div className="text-[10px] font-bold text-gray-400">ID: {app.appId} | 順序: {app.order}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 inline-flex text-[10px] font-black rounded-full border ${app.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {app.isActive ? "稼働中" : "システム停止中"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openDeployModal(app)} className="px-3 py-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors flex items-center">
                          <Globe className="h-3.5 w-3.5 mr-1" /> 配信管理
                        </button>
                        <button onClick={() => { setFormData(app); setIsEditing(true); setIsModalOpen(true); }} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(app.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 編集・作成モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <h3 className="text-sm font-black text-gray-900">{isEditing ? "アプリ設定の編集" : "新しいアプリの登録"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-full transition-colors"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 左カラム：基本情報と権限 */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-black text-gray-500 mb-1.5 uppercase">アプリID <span className="text-red-500">*</span></label>
                      <input type="text" required value={formData.appId} onChange={e => setFormData({...formData, appId: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-bold focus:bg-white" placeholder="例: board" disabled={isEditing} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-gray-500 mb-1.5 uppercase">表示順序 <span className="text-red-500">*</span></label>
                      <input type="number" required value={formData.order} onChange={e => setFormData({...formData, order: Number(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-bold focus:bg-white" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-gray-500 mb-1.5 uppercase">アプリ名 (デフォルト) <span className="text-red-500">*</span></label>
                    <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-bold focus:bg-white" placeholder="例: お知らせボード" />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-gray-500 mb-1.5 uppercase">説明・概要</label>
                    <textarea rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-bold focus:bg-white resize-none" />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-gray-500 mb-1.5 uppercase">URLパス <span className="text-red-500">*</span></label>
                    <input type="text" required value={formData.path} onChange={e => setFormData({...formData, path: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-bold focus:bg-white" placeholder="例: /app/board" />
                  </div>

                  {/* 役職ごとのデフォルト権限設定 */}
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
                    <label className="block text-[11px] font-black text-indigo-900 mb-3 uppercase flex items-center">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" /> デフォルト利用権限
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {(Object.keys(ROLE_LABELS) as Array<keyof RolePermissions>).map(roleKey => (
                        <label key={roleKey} className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-lg border border-gray-200 hover:border-indigo-300">
                          <input type="checkbox" checked={formData.defaultRoles?.[roleKey]} onChange={() => handleRoleToggle(roleKey)} className="w-4 h-4 text-indigo-600 rounded" />
                          <span className="text-xs font-bold text-gray-800">{ROLE_LABELS[roleKey]}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-[10px] font-bold text-indigo-500 mt-3">※各テナントの管理者画面で学校ごとに個別に上書き（オーバーライド）が可能です。</p>
                  </div>
                </div>

                {/* 右カラム：デザイン設定 */}
                <div className="space-y-6">
                  {/* カラーとシステム稼働設定 */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded" />
                      <div>
                        <label htmlFor="isActive" className="text-sm font-black text-gray-900 cursor-pointer">システム全体で稼働中</label>
                        <p className="text-[9px] text-gray-500 font-bold mt-0.5">OFFにすると特権管理者以外は全テナントで利用不可</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-gray-500 mb-2 uppercase">テーマカラー</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                      {TAILWIND_COLORS.map(color => (
                        <div 
                          key={color} onClick={() => setFormData({...formData, color})}
                          className={`w-6 h-6 rounded-full cursor-pointer transition-transform border-2 ${formData.color === color ? 'border-gray-900 scale-110 shadow-md' : 'border-transparent'}`}
                          style={{ backgroundColor: color === 'stone' ? '#78716c' : color === 'zinc' ? '#71717a' : color === 'neutral' ? '#737373' : color === 'slate' ? '#64748b' : undefined }}
                        >
                          <div className={`w-full h-full rounded-full bg-${color}-500`}></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* アイコン選択 */}
                  <div className="flex-1 flex flex-col h-[280px]">
                    <label className="block text-[11px] font-black text-gray-500 mb-2 uppercase flex justify-between items-center">
                      <span>アイコン選択 (Lucide)</span>
                      <div className="relative">
                        <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="検索..." value={iconSearch} onChange={e => setIconSearch(e.target.value)} className="w-32 pl-6 pr-2 py-1 text-xs font-normal border border-gray-300 rounded-md focus:outline-none focus:border-indigo-500" />
                      </div>
                    </label>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-wrap gap-2 content-start">
                      {filteredIcons.map(iconName => (
                        <div 
                          key={iconName} onClick={() => setFormData({...formData, icon: iconName})}
                          className={`p-2 rounded-lg cursor-pointer flex items-center justify-center transition-colors ${formData.icon === iconName ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
                          title={iconName}
                        >
                          <DynamicIcon name={iconName} className="w-5 h-5" />
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-gray-100 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                  キャンセル
                </button>
                <button type="submit" disabled={isSaving} className="px-8 py-2.5 text-xs font-bold text-white bg-gray-900 hover:bg-black rounded-xl shadow-md transition-all flex items-center">
                  {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  保存して設定を反映
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* テナントへの一括配信・管理モーダル */}
      {isDeployModalOpen && deployApp && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-${deployApp.color}-100 text-${deployApp.color}-600`}>
                  <DynamicIcon name={deployApp.icon} className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900">配信設定: {deployApp.name}</h3>
                  <p className="text-[10px] font-bold text-gray-500">{selectedTenants.length} 件の学校が選択されています</p>
                </div>
              </div>
              <button onClick={() => setIsDeployModalOpen(false)} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-full"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="学校名で検索..." value={tenantSearch} onChange={e => setTenantSearch(e.target.value)} className="w-full pl-9 pr-3 py-1.5 text-xs font-bold bg-gray-100 border-transparent rounded-lg focus:bg-white focus:border-indigo-500 outline-none" />
              </div>
              <button onClick={selectAllFiltered} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                表示中の学校をすべて選択/解除
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              <div className="space-y-1.5">
                {filteredTenants.length === 0 ? (
                  <p className="text-xs text-center text-gray-400 py-8 font-bold">該当する学校が見つかりません</p>
                ) : (
                  filteredTenants.map(tenant => {
                    const isSelected = selectedTenants.includes(tenant.id);
                    const isCurrentlyON = tenant.availableModules?.includes(deployApp.appId);

                    return (
                      <div key={tenant.id} onClick={() => toggleTenantSelection(tenant.id)} className={`p-3 border rounded-xl flex items-center justify-between cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/50 border-blue-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                        <div className="flex items-center gap-3">
                          {isSelected ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-300" />}
                          <div>
                            <p className="text-sm font-black text-gray-900">{tenant.name}</p>
                            <p className="text-[10px] font-bold text-gray-500">{tenant.schoolCode}</p>
                          </div>
                        </div>
                        <div>
                          {isCurrentlyON ? (
                            <span className="px-2 py-0.5 text-[9px] font-bold bg-green-100 text-green-700 border border-green-200 rounded-md">現在: ON</span>
                          ) : (
                            <span className="px-2 py-0.5 text-[9px] font-bold bg-gray-100 text-gray-500 border border-gray-200 rounded-md">現在: OFF</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center gap-3">
              <p className="text-xs font-bold text-gray-500">選択した学校に対して、このアプリを...</p>
              <div className="flex gap-2">
                <button onClick={() => executeBulkDeploy("disable")} disabled={isDeploying || selectedTenants.length === 0} className="px-6 py-2 text-xs font-bold text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-xl disabled:opacity-50">
                  一括で OFF にする
                </button>
                <button onClick={() => executeBulkDeploy("enable")} disabled={isDeploying || selectedTenants.length === 0} className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm disabled:opacity-50 flex items-center">
                  {isDeploying ? <Loader2 className="animate-spin h-3.5 w-3.5 mr-1" /> : null}一括で ON にする
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}