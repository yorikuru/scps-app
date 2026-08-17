"use client";

import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Check, Edit2, Globe, LayoutGrid, Loader2, Smartphone, X, ChevronRight, Users, ChevronDown, ChevronUp, User } from "lucide-react";
import * as LucideIcons from "lucide-react";

import { useDialog } from "@/components/DialogContext";
import { ExternalUser } from "@/app/types/external";

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

type Props = {
  systemApps: any[];
  schoolData: any;
  setSchoolData: (data: any) => void;
  externalUsers: ExternalUser[];
  setManageMode: (mode: { show: boolean, mode: "create"|"edit"|"view", targetUser?: ExternalUser|null }) => void;
};

export default function ExternalAppManagementTab({ systemApps, schoolData, setSchoolData, externalUsers, setManageMode }: Props) {
  const { showAlert } = useDialog();

  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSavingApp, setIsSavingApp] = useState(false);

  // 許可ユーザー一覧の展開ステート
  const [showUsersAppId, setShowUsersAppId] = useState<string | null>(null);

  // 外部公開対象のアプリ（externalPath を持つもの）をフィルタし、order順に並べる
  const externalApps = systemApps
    .filter(app => app.externalPath)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  const handleEditApp = (app: any) => {
    setEditingAppId(app.appId);
    setEditName(schoolData?.customExternalAppNames?.[app.appId] || schoolData?.customAppNames?.[app.appId] || app.name);
    setEditDescription(schoolData?.customAppDescriptions?.[app.appId] || app.description || "");
  };

  const saveAppCustomization = async () => {
    if (!editingAppId || !schoolData?.id) return;
    setIsSavingApp(true);
    try {
      const currentExternalNames = schoolData.customExternalAppNames || {};
      const currentDescriptions = schoolData.customAppDescriptions || {};

      const newExternalNames = { ...currentExternalNames, [editingAppId]: editName.trim() };
      const newDescriptions = { ...currentDescriptions, [editingAppId]: editDescription.trim() };

      await updateDoc(doc(db, "schools", schoolData.id), { 
        customExternalAppNames: newExternalNames,
        customAppDescriptions: newDescriptions 
      });

      setSchoolData({ 
        ...schoolData, 
        customExternalAppNames: newExternalNames,
        customAppDescriptions: newDescriptions 
      });

      showAlert("外部向けのアプリ表示名と説明文を更新しました。", "success");
      setEditingAppId(null);
    } catch (e) {
      console.error(e);
      showAlert("保存に失敗しました。", "error");
    } finally {
      setIsSavingApp(false);
    }
  };

  return (
    // ★ md未満のスマホUI時には全体で縦スクロールするように変更
    <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-y-auto md:overflow-hidden animate-fade-in custom-scrollbar">
      
      {/* 左ペイン：アプリ一覧 */}
      <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col bg-gray-50/30 shrink-0 md:shrink md:overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-200 bg-white shrink-0">
          <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-emerald-600" /> 外部連携アプリの設定
          </h2>
          <p className="text-[11px] font-bold text-gray-500 mt-1.5 leading-relaxed">
            ゲストのマイページに表示される各アプリの名前と説明文をカスタマイズできます。<br/>
            説明文がない場合はデフォルトメッセージが表示されます。
          </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-3">
          {externalApps.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold">外部連携可能なアプリがありません</p>
            </div>
          ) : (
            externalApps.map(app => {
              const isEditing = editingAppId === app.appId;
              const displayName = schoolData?.customExternalAppNames?.[app.appId] || schoolData?.customAppNames?.[app.appId] || app.name;
              const displayDesc = schoolData?.customAppDescriptions?.[app.appId] || app.description;
              const allowedUsers = externalUsers.filter(u => u.allowedModules?.includes(app.appId));

              return (
                <div key={app.id} className={`p-4 rounded-xl border transition-all ${isEditing ? 'border-emerald-500 bg-emerald-50/30 shadow-md ring-1 ring-emerald-500' : 'border-gray-200 bg-white hover:border-emerald-300 shadow-sm'}`}>
                  {isEditing ? (
                    <div className="space-y-3 animate-fade-in">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1">ゲスト画面での表示名 <span className="text-red-500">*</span></label>
                        <input 
                          type="text" value={editName} onChange={e => setEditName(e.target.value)} required
                          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder={app.name}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1">アプリの説明文 (2〜3行推奨)</label>
                        <textarea 
                          rows={2} value={editDescription} onChange={e => setEditDescription(e.target.value)}
                          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-[11px] font-bold focus:ring-2 focus:ring-emerald-500 outline-none resize-none custom-scrollbar"
                          placeholder="ゲストがこのアプリで何ができるかの説明を入力"
                        />
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-emerald-100">
                        <button onClick={() => setEditingAppId(null)} className="flex-1 py-2 text-[11px] font-bold bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">キャンセル</button>
                        <button onClick={saveAppCustomization} disabled={isSavingApp || !editName.trim()} className="flex-1 py-2 text-[11px] font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex justify-center items-center gap-1 shadow-sm disabled:opacity-50">
                          {isSavingApp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} 保存する
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-${app.color}-50 text-${app.color}-600`}>
                        <DynamicIcon name={app.icon} className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="text-sm font-black text-gray-900 truncate pr-2">{displayName}</h4>
                          <button onClick={() => handleEditApp(app)} className="text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 p-1 rounded transition-colors shrink-0">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] font-bold text-gray-500 mt-1 line-clamp-2 leading-relaxed break-all">
                          {displayDesc}
                        </p>
                        
                        {/* ★ 許可ユーザー一覧の展開機能 */}
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <button 
                            onClick={() => setShowUsersAppId(prev => prev === app.appId ? null : app.appId)}
                            className="flex items-center w-full gap-1.5 text-[10px] font-bold text-gray-500 hover:text-emerald-600 transition-colors"
                          >
                            <Users className="w-3.5 h-3.5" /> 許可されているゲスト ({allowedUsers.length}名)
                            {showUsersAppId === app.appId ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
                          </button>

                          {showUsersAppId === app.appId && (
                            <div className="mt-2 max-h-32 overflow-y-auto custom-scrollbar bg-gray-50 border border-gray-200 rounded-lg p-1.5 space-y-1 animate-fade-in">
                              {allowedUsers.length === 0 ? (
                                <p className="text-[10px] text-gray-400 text-center py-2 font-bold">許可されているゲストはいません</p>
                              ) : (
                                allowedUsers.map(u => (
                                  <div key={u.id} className="flex items-center justify-between text-[10px] font-bold p-1.5 hover:bg-white rounded border border-transparent hover:border-gray-200 transition-colors">
                                    <span className="truncate text-gray-700">{u.name}</span>
                                    <span className="text-gray-400 shrink-0 ml-2 truncate max-w-[80px] text-[9px]">{u.affiliation || "所属なし"}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 右ペイン：プレビュー＆ヒント */}
      <div className="w-full md:w-1/2 py-8 px-4 sm:p-6 bg-gray-50 flex flex-col items-center justify-center relative md:overflow-y-auto custom-scrollbar shrink-0 md:shrink">
        
        {/* スマホ画面プレビュー本体 */}
        <div className="w-full max-w-[300px] bg-white rounded-[2.5rem] border-[6px] border-gray-800 shadow-2xl overflow-hidden relative aspect-[9/19] flex flex-col shrink-0 mx-auto">
          {/* スマホモックのノッチ部分 */}
          <div className="absolute top-0 inset-x-0 h-6 bg-gray-800 rounded-b-3xl mx-16 z-20"></div>
          
          <div className="bg-[#F4F7F6] flex-1 flex flex-col overflow-hidden pt-7 relative z-10">
            {/* ヘッダーモック */}
            <div className="px-4 py-2 bg-white shadow-sm flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center text-white text-[8px] font-black shadow-xs">
                  Logo
                </div>
                <span className="text-[10px] font-black text-gray-800">テナント名</span>
              </div>
            </div>
            
            {/* 本文エリア */}
            <div className="px-3 pb-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
              
              {/* ユーザー情報モック */}
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-yellow-400 to-amber-500 flex items-center justify-center text-white font-black text-[8px] text-center shadow-md shrink-0">
                  User<br/>Photo
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[11px] font-black text-gray-900 truncate">こんにちは、ゲスト さん</h2>
                  <div className="flex items-center gap-1 text-[8px] font-bold text-gray-500 mt-0.5">
                    <User className="w-2.5 h-2.5 shrink-0" /> 
                    <span className="truncate">外部ユーザー</span>
                  </div>
                </div>
              </div>
              
              {/* アプリ一覧モック */}
              <div>
                <h3 className="text-[11px] font-black text-gray-700 mb-2.5 ml-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-500" />
                  ご利用可能なメニュー
                </h3>
                <div className="space-y-3">
                  {externalApps.length === 0 ? (
                    <div className="bg-white rounded-xl border border-dashed border-gray-300 p-5 text-center">
                      <p className="text-[10px] font-black text-gray-400">アプリがありません</p>
                    </div>
                  ) : (
                    externalApps.map(app => {
                      const name = schoolData?.customExternalAppNames?.[app.appId] || schoolData?.customAppNames?.[app.appId] || app.name;
                      const desc = schoolData?.customAppDescriptions?.[app.appId] || app.description|| "このアプリケーションは利用できます"; 

                      return (
                        <div key={app.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-${app.color}-50 text-${app.color}-600`}>
                            <DynamicIcon name={app.icon} className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[11px] font-black text-gray-900 truncate">{name}</h4>
                            <p className="text-[9px] font-bold text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{desc}</p>
                          </div>
                          <div className="h-9 flex items-center shrink-0">
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
        
        <div className="mt-6 text-center shrink-0">
          <p className="text-[11px] font-black text-gray-500 flex items-center justify-center gap-1.5">
            <Smartphone className="w-4 h-4" />
            ゲストのスマホ画面プレビュー
          </p>
          <p className="text-[9px] font-bold text-gray-400 mt-1 max-w-[280px]">
            左側の設定で変更した表示名と説明文は、即座にこちらのゲストポータルに反映されます。（※スクロール可能です）
          </p>
        </div>
      </div>
    </div>
  );
}