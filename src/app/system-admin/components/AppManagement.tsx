"use client";

import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Edit2, Trash2, Save, X, Loader2, LayoutGrid } from "lucide-react";
import * as LucideIcons from "lucide-react";

export type SystemApp = {
  id: string;
  appId: string; // board, tasks など
  name: string;
  description: string;
  icon: string; // Lucideアイコンの名前
  color: string; // indigo, green, blue, purple, rose, orange など
  path: string;
  isActive: boolean;
  order: number;
};

const COLORS = [
  { id: "indigo", label: "インディゴ (標準)", hex: "bg-indigo-500" },
  { id: "blue", label: "ブルー", hex: "bg-blue-500" },
  { id: "green", label: "グリーン", hex: "bg-green-500" },
  { id: "purple", label: "パープル", hex: "bg-purple-500" },
  { id: "orange", label: "オレンジ", hex: "bg-orange-500" },
  { id: "rose", label: "ローズ (赤)", hex: "bg-rose-500" },
];

export default function AppManagement({ showAlert }: { showAlert: (type: "success" | "error", msg: string) => void }) {
  const [apps, setApps] = useState<SystemApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState<Partial<SystemApp>>({
    appId: "", name: "", description: "", icon: "Box", color: "indigo", path: "/top/", isActive: true, order: 0
  });

  const fetchApps = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "system_apps"), orderBy("order", "asc"));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemApp));
      setApps(fetched);
    } catch (e) {
      showAlert("error", "アプリ一覧の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchApps(); }, []);

  const handleSave = async () => {
    if (!formData.appId || !formData.name || !formData.path) {
      showAlert("error", "必須項目が入力されていません"); return;
    }
    try {
      if (formData.id) {
        const { id, ...data } = formData;
        await updateDoc(doc(db, "system_apps", id), data);
        showAlert("success", "アプリを更新しました");
      } else {
        await addDoc(collection(db, "system_apps"), formData);
        showAlert("success", "アプリを登録しました");
      }
      setIsEditing(false);
      fetchApps();
    } catch (e) {
      showAlert("error", "保存に失敗しました");
    }
  };

  const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
    const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
    return <IconComponent className={className} />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-extrabold text-gray-900 flex items-center">
            <LayoutGrid className="h-6 w-6 mr-2 text-indigo-600" /> プラグイン・アプリ管理
          </h3>
          <p className="text-sm text-gray-500 mt-1">テナントに提供するアプリケーション（機能モジュール）を動的に管理します。</p>
        </div>
        <button 
          onClick={() => { setFormData({ appId: "", name: "", description: "", icon: "Box", color: "indigo", path: "/top/", isActive: true, order: apps.length + 1 }); setIsEditing(true); }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center shadow-sm"
        >
          <Plus className="h-4 w-4 mr-1" /> 新規アプリ登録
        </button>
      </div>

      {isEditing && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 animate-fade-in">
          <h4 className="font-bold text-gray-900 mb-4">{formData.id ? "アプリの編集" : "新規アプリ登録"}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-bold text-gray-700 mb-1">システムID (英数字)</label><input type="text" value={formData.appId} onChange={e => setFormData({...formData, appId: e.target.value})} className="w-full border-gray-300 rounded-lg text-sm" placeholder="例: board" /></div>
            <div><label className="block text-xs font-bold text-gray-700 mb-1">表示名</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-gray-300 rounded-lg text-sm" placeholder="例: お知らせボード" /></div>
            <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">説明</label><input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border-gray-300 rounded-lg text-sm" placeholder="アプリの簡単な説明" /></div>
            <div><label className="block text-xs font-bold text-gray-700 mb-1">リンクパス</label><input type="text" value={formData.path} onChange={e => setFormData({...formData, path: e.target.value})} className="w-full border-gray-300 rounded-lg text-sm" placeholder="/top/board" /></div>
            <div><label className="block text-xs font-bold text-gray-700 mb-1">Lucide アイコン名</label><input type="text" value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})} className="w-full border-gray-300 rounded-lg text-sm" placeholder="例: LayoutDashboard" /></div>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">テーマカラー</label>
              <select value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} className="w-full border-gray-300 rounded-lg text-sm">
                {COLORS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-bold text-gray-700 mb-1">表示順序 (数値)</label><input type="number" value={formData.order} onChange={e => setFormData({...formData, order: Number(e.target.value)})} className="w-full border-gray-300 rounded-lg text-sm" /></div>
            
            <div className="md:col-span-2 pt-2">
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500 mr-2" />
                <span className="text-sm font-bold text-gray-800">システム全体でこのアプリを有効にする</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end mt-6 gap-3">
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">キャンセル</button>
            <button onClick={handleSave} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm">保存する</button>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">アプリ</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">パス & ID</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">ステータス</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {apps.map(app => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg bg-${app.color}-100 text-${app.color}-600`}>
                        <DynamicIcon name={app.icon} className="h-5 w-5" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-bold text-gray-900">{app.name}</p>
                        <p className="text-xs text-gray-500">{app.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="font-mono text-xs">{app.path}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">ID: {app.appId} | 順序: {app.order}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${app.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {app.isActive ? "有効" : "無効"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => { setFormData(app); setIsEditing(true); }} className="text-indigo-600 hover:text-indigo-900 p-2"><Edit2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}