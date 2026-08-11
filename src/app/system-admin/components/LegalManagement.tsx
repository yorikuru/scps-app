"use client";

import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Save, Loader2, ShieldCheck, FileText, Scale, Eye } from "lucide-react";
import { useDialog } from "@/components/DialogContext"; // ★追加

export default function LegalManagement() {
  const { showAlert } = useDialog(); // ★追加

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"privacyPolicy" | "termsOfService" | "commercialLaw">("privacyPolicy");

  const [formData, setFormData] = useState({
    privacyPolicy: "",
    termsOfService: "",
    commercialLaw: "",
  });

  useEffect(() => {
    const fetchLegalData = async () => {
      try {
        const docRef = doc(db, "system_settings", "legal");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            privacyPolicy: data.privacyPolicy || "",
            termsOfService: data.termsOfService || "",
            commercialLaw: data.commercialLaw || "",
          });
        }
      } catch (error) {
        console.error("Failed to load legal docs", error);
        showAlert("規約データの読み込みに失敗しました。", "error"); // ★修正
      } finally {
        setIsLoading(false);
      }
    };
    fetchLegalData();
  }, [showAlert]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, "system_settings", "legal");
      await setDoc(docRef, {
        ...formData,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      
      showAlert("法務ドキュメントを保存・公開しました。", "success"); // ★修正
    } catch (error) {
      console.error("Save error:", error);
      showAlert("保存に失敗しました。", "error"); // ★修正
    } finally {
      setIsSaving(false);
    }
  };

  const getPreviewUrl = () => {
    if (activeTab === "privacyPolicy") return "/legal/privacy";
    if (activeTab === "termsOfService") return "/legal/terms";
    return "/legal/commercial";
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-extrabold text-gray-900 flex items-center">
            <Scale className="h-6 w-6 mr-2 text-indigo-600" /> 法務・規約ドキュメント管理
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            プラットフォーム全体（全テナント・全ユーザー）に適用される利用規約やプライバシーポリシーを管理します。
          </p>
        </div>
        <div className="flex gap-2">
          <a 
            href={getPreviewUrl()} target="_blank" rel="noreferrer"
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold flex items-center hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Eye className="h-4 w-4 mr-2" /> ユーザー画面プレビュー
          </a>
          <button 
            onClick={handleSave} disabled={isSaving}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center transition-colors shadow-sm disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            保存して全体に公開
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
        {/* タブ */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab("privacyPolicy")}
            className={`flex-1 flex justify-center items-center py-3.5 text-sm font-bold transition-all border-b-2 ${activeTab === "privacyPolicy" ? "border-indigo-600 text-indigo-700 bg-white" : "border-transparent text-gray-500 hover:bg-gray-100"}`}
          >
            <ShieldCheck className="h-4 w-4 mr-2" /> プライバシーポリシー
          </button>
          <button
            onClick={() => setActiveTab("termsOfService")}
            className={`flex-1 flex justify-center items-center py-3.5 text-sm font-bold transition-all border-b-2 ${activeTab === "termsOfService" ? "border-indigo-600 text-indigo-700 bg-white" : "border-transparent text-gray-500 hover:bg-gray-100"}`}
          >
            <FileText className="h-4 w-4 mr-2" /> 利用規約
          </button>
          <button
            onClick={() => setActiveTab("commercialLaw")}
            className={`flex-1 flex justify-center items-center py-3.5 text-sm font-bold transition-all border-b-2 ${activeTab === "commercialLaw" ? "border-indigo-600 text-indigo-700 bg-white" : "border-transparent text-gray-500 hover:bg-gray-100"}`}
          >
            <Scale className="h-4 w-4 mr-2" /> 特定商取引法に基づく表記
          </button>
        </div>

        {/* テキストエディタ */}
        <div className="flex-1 p-0 relative">
          <textarea
            value={formData[activeTab]}
            onChange={(e) => setFormData({ ...formData, [activeTab]: e.target.value })}
            className="w-full h-full p-6 bg-white text-gray-900 text-sm font-medium resize-none focus:outline-none focus:ring-0 border-0 leading-relaxed"
            placeholder={`${activeTab === 'privacyPolicy' ? 'プライバシーポリシー' : activeTab === 'termsOfService' ? '利用規約' : '特定商取引法に基づく表記'} の内容を入力してください。空行で段落が分かれます。`}
          />
        </div>
        
        {/* フッター */}
        <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 flex justify-between items-center text-xs font-bold text-gray-400">
          <span>文字数: {formData[activeTab].length} 文字</span>
          <span>※HTMLタグは使用できません。</span>
        </div>
      </div>
    </div>
  );
}