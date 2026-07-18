"use client";

import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Settings, Users, ShieldAlert, Lock, Globe, Loader2, MessageCircle } from "lucide-react";
import { UserData, SchoolData } from "../page";

type Props = {
  schoolData: SchoolData | null;
  users: UserData[];
  setUsers: (users: UserData[]) => void;
  showAlert: (type: "success" | "error", message: string) => void;
};

export default function LineSettings({ schoolData, users, setUsers, showAlert }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [localSchoolData, setLocalSchoolData] = useState<SchoolData | null>(schoolData);

  const toggleTenantFeature = async (field: "lineFeatureEnabled" | "lineConnectionEnforced", currentVal: boolean) => {
    if (!localSchoolData) return;
    setIsSaving(true);
    try {
      const newVal = !currentVal;
      await updateDoc(doc(db, "schools", localSchoolData.id), {
        [field]: newVal
      });
      setLocalSchoolData({ ...localSchoolData, [field]: newVal });
      showAlert("success", "設定を更新しました。");
    } catch (error) {
      console.error(error);
      showAlert("error", "設定の保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleUserAllowance = async (userId: string, currentVal: boolean) => {
    setIsSaving(true);
    try {
      const newVal = !currentVal;
      await updateDoc(doc(db, "users", userId), {
        lineConnectionAllowed: newVal,
        // 許可を取り消した場合、強制的に連携状態も解除する
        ...(newVal === false ? { lineUserId: null, lineNotificationEnabled: false } : {})
      });
      
      setUsers(users.map(u => {
        if (u.id === userId) {
          return newVal === false 
            ? { ...u, lineConnectionAllowed: newVal, lineUserId: undefined }
            : { ...u, lineConnectionAllowed: newVal };
        }
        return u;
      }));
      showAlert("success", "ユーザーの連携許可設定を更新しました。");
    } catch (error) {
      console.error(error);
      showAlert("error", "設定の保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const isSysAllowed = localSchoolData?.lineFeatureAllowed === true;

  return (
    <div className="space-y-6">
      <div className="flex items-center text-[#06C755] mb-4">
        <MessageCircle className="h-6 w-6 mr-2" fill="currentColor" stroke="none" />
        <h2 className="text-xl font-extrabold text-gray-900">LINE運用設定</h2>
      </div>

      {/* テナント基本設定 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center bg-gray-50">
          <Settings className="h-5 w-5 text-gray-500 mr-2" />
          <h3 className="text-lg font-bold text-gray-900">テナント全体の設定</h3>
        </div>
        <div className="p-6">
          {!isSysAllowed ? (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 flex items-start">
              <Lock className="h-5 w-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-red-800">システム管理者により機能が制限されています</h4>
                <p className="text-xs text-red-600 mt-1">現在、このテナントではLINE連携機能を利用できません。利用をご希望の場合はシステム管理者にお問い合わせください。</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center">
                    <Globe className="h-4 w-4 text-[#06C755] mr-2" />
                    LINE連携機能の利用を有効にする
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">テナント内のユーザーがLINE連携設定を行えるようになります。</p>
                </div>
                <button
                  onClick={() => toggleTenantFeature("lineFeatureEnabled", !!localSchoolData?.lineFeatureEnabled)}
                  disabled={isSaving}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:ring-offset-2 ${localSchoolData?.lineFeatureEnabled ? 'bg-[#06C755]' : 'bg-gray-200'} disabled:opacity-50`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${localSchoolData?.lineFeatureEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className={`flex items-center justify-between p-4 border rounded-xl transition-colors ${!localSchoolData?.lineFeatureEnabled ? 'border-gray-100 bg-gray-50 opacity-50' : 'border-red-200 bg-red-50'}`}>
                <div>
                  <h4 className="text-sm font-bold text-red-900 flex items-center">
                    <ShieldAlert className="h-4 w-4 text-red-500 mr-2" />
                    全ユーザーにLINE連携を強制する
                  </h4>
                  <p className="text-xs text-red-700 mt-1">ONにすると、連携が完了するまでポータルを利用できないセットアップ画面が表示されます。</p>
                </div>
                <button
                  onClick={() => toggleTenantFeature("lineConnectionEnforced", !!localSchoolData?.lineConnectionEnforced)}
                  disabled={isSaving || !localSchoolData?.lineFeatureEnabled}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${localSchoolData?.lineConnectionEnforced ? 'bg-red-600' : 'bg-gray-200'} disabled:opacity-50`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${localSchoolData?.lineConnectionEnforced ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ユーザー個別設定 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center bg-gray-50">
          <Users className="h-5 w-5 text-gray-500 mr-2" />
          <h3 className="text-lg font-bold text-gray-900">ユーザー別 ステータス管理</h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">名前</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ステータス</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">連携の許可</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{user.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.lineConnectionAllowed === false ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">連携不可</span>
                      ) : user.lineUserId ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e6faed] text-[#00993c]">連携済み</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">未連携（連携待ち）</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleUserAllowance(user.id, user.lineConnectionAllowed !== false)}
                        disabled={isSaving || !isSysAllowed}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:ring-offset-2 ${user.lineConnectionAllowed !== false ? 'bg-[#06C755]' : 'bg-gray-200'} disabled:opacity-50`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${user.lineConnectionAllowed !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">ユーザーが見つかりません。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}