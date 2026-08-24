"use client";

import React, { useState, useEffect } from "react";
import { SurveySettings, getDefaultSurveySettings, UserData } from "../types";
import SurveySettingsEditor from "./SurveySettingsEditor";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Save, Settings } from "lucide-react";
import { useDialog } from "@/components/DialogContext";

type Props = {
  schoolId: string;
  tenantUsers: UserData[];
};

export default function SurveyDefaultSettings({ schoolId, tenantUsers }: Props) {
  const [settings, setSettings] = useState<SurveySettings>(getDefaultSurveySettings());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { showAlert } = useDialog();

  useEffect(() => {
    const fetchDefaults = async () => {
      try {
        const docSnap = await getDoc(doc(db, "schools", schoolId));
        if (docSnap.exists() && docSnap.data().surveyDefaults) {
          setSettings({ ...getDefaultSurveySettings(), ...docSnap.data().surveyDefaults });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDefaults();
  }, [schoolId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "schools", schoolId), {
        surveyDefaults: settings
      });
      showAlert("テナントのデフォルト設定を保存しました", "success");
    } catch (e) {
      showAlert("保存に失敗しました", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2"><Settings className="w-5 h-5 text-gray-500"/> デフォルト設定</h2>
          <p className="text-xs text-gray-500 mt-1">新しく作成されるフォームの初期設定を定義します。（管理者・IT担当者のみ）</p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-bold rounded-xl shadow-sm flex items-center gap-2">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} 設定を保存
        </button>
      </div>

      <SurveySettingsEditor settings={settings} setSettings={setSettings} tenantUsers={tenantUsers} />
    </div>
  );
}