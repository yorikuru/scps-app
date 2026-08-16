// src/app/top/external-users/components/ExternalAppManagementTab.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  LayoutGrid, Save, Loader2, Users, BarChart2, ExternalLink, Eye, Search, X, ChevronRight 
} from "lucide-react";
import * as LucideIcons from "lucide-react";

import { useDialog } from "@/components/DialogContext";
import { ExternalUser } from "@/app/types/external";

type SystemApp = any;

type Props = {
  systemApps: SystemApp[];
  schoolData: any;
  setSchoolData: React.Dispatch<React.SetStateAction<any>>;
  externalUsers: ExternalUser[];
  setManageMode: React.Dispatch<React.SetStateAction<{
    show: boolean;
    mode: "create" | "edit" | "view";
    targetUser?: ExternalUser | null;
  }>>;
};

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

export default function ExternalAppManagementTab({ 
  systemApps, schoolData, setSchoolData, externalUsers, setManageMode 
}: Props) {
  const { showAlert } = useDialog();

  const [customExtAppNames, setCustomExtAppNames] = useState<Record<string, string>>({});
  const [isSavingAppNames, setIsSavingAppNames] = useState(false);
  const [inspectingApp, setInspectingApp] = useState<SystemApp | null>(null);
  const [appUserSearchQuery, setAppUserSearchQuery] = useState("");

  // 初期データのセット
  useEffect(() => {
    if (schoolData?.customExternalAppNames) {
      setCustomExtAppNames(schoolData.customExternalAppNames);
    }
  }, [schoolData]);

  // 外部連携対応アプリの抽出
  const externalReadyApps = useMemo(() => {
    return systemApps.filter(app => app.isExternalReady);
  }, [systemApps]);

  // 表示名の保存処理
  const handleSaveExtAppNames = async () => {
    if (!schoolData?.id) return;
    setIsSavingAppNames(true);
    try {
      const cleanNames = { ...customExtAppNames };
      Object.keys(cleanNames).forEach(key => {
        if (!cleanNames[key] || cleanNames[key].trim() === "") delete cleanNames[key];
      });

      await updateDoc(doc(db, "schools", schoolData.id), {
        customExternalAppNames: cleanNames
      });

      setSchoolData((prev: any) => ({ ...prev, customExternalAppNames: cleanNames }));
      showAlert("外部連携アプリの表示名を保存しました。", "success");
    } catch (error) {
      console.error(error);
      showAlert("表示名の保存に失敗しました。", "error");
    } finally {
      setIsSavingAppNames(false);
    }
  };

  // 特定アプリを使用できる外部ユーザーの一覧取得
  const inspectingAppUsers = useMemo(() => {
    if (!inspectingApp) return [];
    const appId = inspectingApp.appId || inspectingApp.id;
    return externalUsers.filter(user => {
      const hasAccess = user.allowedModules?.includes(appId);
      const matchSearch = appUserSearchQuery === "" || 
        user.name.toLowerCase().includes(appUserSearchQuery.toLowerCase()) ||
        (user.affiliation || "").toLowerCase().includes(appUserSearchQuery.toLowerCase()) ||
        (user.loginId || "").toLowerCase().includes(appUserSearchQuery.toLowerCase());
      return hasAccess && matchSearch;
    });
  }, [inspectingApp, externalUsers, appUserSearchQuery]);

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 space-y-3 sm:space-y-4 overflow-y-auto custom-scrollbar pr-1">
        
        {/* サマリーカードダッシュボード */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 shrink-0">
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">対応システムアプリ数</span>
              <span className="text-lg sm:text-2xl font-black text-gray-900">{externalReadyApps.length} <span className="text-xs font-bold text-gray-400">アプリ</span></span>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <LayoutGrid className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">登録済みゲスト総数</span>
              <span className="text-lg sm:text-2xl font-black text-gray-900">{externalUsers.length} <span className="text-xs font-bold text-gray-400">名</span></span>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">有効稼働中のゲスト数</span>
              <span className="text-lg sm:text-2xl font-black text-emerald-600">
                {externalUsers.filter(u => u.status === "active").length} <span className="text-xs font-bold text-gray-400">名</span>
              </span>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <BarChart2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* アプリ個別管理 & ダッシュボード */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3.5 sm:p-5 flex-1 flex flex-col min-h-0 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3 shrink-0">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-gray-900 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-emerald-600" /> 外部連携アプリ一覧 & 利用者マネジメント
              </h3>
              <p className="text-[10px] font-bold text-gray-500 mt-0.5">
                システム管理者から許可されたアプリのテナント独自名を設定し、現在の利用状況を確認できます。
              </p>
            </div>
            <button 
              onClick={handleSaveExtAppNames}
              disabled={isSavingAppNames}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 w-full sm:w-auto"
            >
              {isSavingAppNames ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              表示設定を保存
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
            {externalReadyApps.length === 0 ? (
              <div className="text-center py-12 text-xs font-bold text-gray-400">
                現在、外部連携に対応しているシステムアプリはありません。
              </div>
            ) : (
              externalReadyApps.map(app => {
                const appId = app.appId || app.id;
                const isTenantEnabled = schoolData?.externalAvailableModules?.includes(appId);
                const assignedUsers = externalUsers.filter(u => u.allowedModules?.includes(appId));
                const activeAssignedCount = assignedUsers.filter(u => u.status === "active").length;
                const customName = customExtAppNames[appId] || "";

                return (
                  <div key={appId} className="bg-gray-50/70 border border-gray-200 rounded-2xl p-3 sm:p-4 transition-all hover:border-gray-300 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      
                      {/* アプリ基本情報 */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-2xs">
                          <DynamicIcon name={app.icon} className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-black text-gray-900 truncate">{app.name}</h4>
                            <span className="text-[9px] font-mono text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">ID: {appId}</span>
                            {isTenantEnabled ? (
                              <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">学校公開中</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[9px] font-black bg-gray-200 text-gray-600">学校未公開</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5 font-mono">
                            <ExternalLink className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>パス: {app.externalPath || `/ext-top/${appId}`}</span>
                          </div>
                        </div>
                      </div>

                      {/* カスタム名変更 ＆ アクション */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:w-1/2">
                        <div className="flex-1">
                          <label className="block text-[9px] font-black text-gray-500 mb-1">ゲスト表示用アプリ名 (独自名)</label>
                          <input 
                            type="text"
                            value={customName}
                            onChange={(e) => setCustomExtAppNames(prev => ({ ...prev, [appId]: e.target.value }))}
                            placeholder={`デフォルト: ${app.name}`}
                            className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-2xs"
                          />
                        </div>
                        <button 
                          onClick={() => { setInspectingApp(app); setAppUserSearchQuery(""); }}
                          className="px-3 py-2 sm:mt-4 bg-white hover:bg-gray-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-600" />
                          利用者 ({assignedUsers.length}名)
                        </button>
                      </div>

                    </div>

                    {/* 利用状況指標 */}
                    <div className="pt-2.5 border-t border-gray-200/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-bold text-gray-600">
                      <div className="bg-white p-2 rounded-xl border border-gray-200/60">
                        <span className="text-gray-400 block text-[9px] mb-0.5">割り当てゲスト数</span>
                        <span className="text-xs font-black text-gray-800">{assignedUsers.length} 名</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-gray-200/60">
                        <span className="text-gray-400 block text-[9px] mb-0.5">アクティブ稼働数</span>
                        <span className="text-xs font-black text-emerald-600">{activeAssignedCount} 名</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-gray-200/60 col-span-2">
                        <span className="text-gray-400 block text-[9px] mb-0.5">ゲスト普及率</span>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 rounded-full transition-all" 
                              style={{ width: `${externalUsers.length > 0 ? (assignedUsers.length / externalUsers.length) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono font-black text-gray-700 shrink-0">
                            {externalUsers.length > 0 ? Math.round((assignedUsers.length / externalUsers.length) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* アプリ利用メンバー内訳モーダル */}
      {inspectingApp && (
        <div className="fixed inset-0 z-50 flex justify-center items-end sm:items-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-3xl h-[85vh] sm:h-[80vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up sm:animate-fade-in flex flex-col">
            
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                  <DynamicIcon name={inspectingApp.icon} className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900">{inspectingApp.name} - 利用許可メンバー</h3>
                  <p className="text-[10px] font-bold text-gray-500">このアプリの利用権限が付与されているゲスト一覧</p>
                </div>
              </div>
              <button 
                onClick={() => setInspectingApp(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 border-b border-gray-200 bg-white shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="メンバー名や所属で検索..." 
                  value={appUserSearchQuery}
                  onChange={(e) => setAppUserSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4">
              {inspectingAppUsers.length === 0 ? (
                <div className="text-center py-12 text-xs font-bold text-gray-400">
                  該当する利用許可メンバーはいません。
                </div>
              ) : (
                <div className="space-y-2">
                  {inspectingAppUsers.map(user => (
                    <div 
                      key={user.id}
                      onClick={() => {
                        setInspectingApp(null);
                        setManageMode({ show: true, mode: "view", targetUser: user });
                      }}
                      className="p-3 bg-gray-50 hover:bg-indigo-50/50 border border-gray-200 rounded-xl flex items-center justify-between cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-amber-500 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-2xs">
                          {user.name.charAt(0)}
                        </div>
                        <div className="min-w-0 pr-2">
                          <p className="text-xs sm:text-sm font-black text-gray-900 group-hover:text-indigo-700 transition-colors truncate">
                            {user.name}
                          </p>
                          <p className="text-[10px] font-bold text-gray-500 truncate mt-0.5">
                            ID: {user.loginId} | 所属: {user.affiliation || "未設定"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                          user.status === "active" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"
                        }`}>
                          {user.status === "active" ? "有効" : "未有効化"}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}