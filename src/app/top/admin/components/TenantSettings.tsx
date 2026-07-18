"use client";

import React, { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Settings } from "lucide-react";
import { SchoolData } from "../page";

type Props = {
  schoolData: SchoolData | null;
  showAlert: (type: "success" | "error", message: string) => void;
};

export default function TenantSettings({ schoolData, showAlert }: Props) {
  const [allowGoogle, setAllowGoogle] = useState(false);
  const [allowMicrosoft, setAllowMicrosoft] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    if (schoolData) {
      setAllowGoogle(schoolData.allowedAuthProviders?.includes("google") || schoolData.allowedAuthProviders?.includes("all") || false);
      setAllowMicrosoft(schoolData.allowedAuthProviders?.includes("microsoft") || schoolData.allowedAuthProviders?.includes("all") || false);
    }
  }, [schoolData]);

  const handleSaveSettings = async () => {
    if (!schoolData) return;
    setIsSavingSettings(true);
    try {
      const newProviders = ["password"];
      if (allowGoogle) newProviders.push("google");
      if (allowMicrosoft) newProviders.push("microsoft");

      await updateDoc(doc(db, "schools", schoolData.id), {
        allowedAuthProviders: newProviders
      });
      showAlert("success", "組織設定を保存しました。");
    } catch (error) {
      showAlert("error", "設定の保存に失敗しました。");
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h3 className="text-xl font-extrabold text-gray-900 flex items-center">
          <Settings className="h-6 w-6 mr-2 text-gray-600" /> テナント（学校）基本設定
        </h3>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
          <h4 className="text-base font-bold text-gray-900">ログイン許可設定</h4>
          <p className="text-xs text-gray-500 mt-1">テナント内の全ユーザーに対する、外部連携ログインの許可状態を制御します。</p>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-sm font-bold text-gray-900">Google アカウントログイン</h5>
              <p className="text-xs text-gray-500 mt-1">@gmail.com または Google Workspaceアカウントでの連携を許可</p>
            </div>
            <label className="inline-flex relative items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={allowGoogle} onChange={() => setAllowGoogle(!allowGoogle)} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <hr className="border-gray-200" />

          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-sm font-bold text-gray-900">Microsoft アカウントログイン</h5>
              <p className="text-xs text-gray-500 mt-1">学校配布のMicrosoft 365 (Entra ID) アカウントでの連携を許可</p>
            </div>
            <label className="inline-flex relative items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={allowMicrosoft} onChange={() => setAllowMicrosoft(!allowMicrosoft)} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-right">
          <button onClick={handleSaveSettings} disabled={isSavingSettings} className={`inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-bold rounded-md text-white transition-colors ${isSavingSettings ? "bg-gray-400" : "bg-gray-900 hover:bg-black"}`}>
            {isSavingSettings ? "保存中..." : "設定を保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}