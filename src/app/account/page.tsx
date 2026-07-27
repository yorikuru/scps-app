"use client";

import React, { useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft, UserCircle, ShieldCheck, Link as LinkIcon, Calendar } from "lucide-react";

import ProfileSection from "./components/ProfileSection";
import SecuritySection from "./components/SecuritySection";
import IntegrationsSection from "./components/IntegrationsSection";
import CalendarSettings from "./components/CalendarSettings"; // ★追加したカレンダー設定

type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

type ConfirmDialogState = {
  show: boolean;
  message: string;
  onConfirm: () => void;
};

type TabType = "profile" | "security" | "integrations" | "calendar";

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [tenantData, setTenantData] = useState<any>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingLine, setIsProcessingLine] = useState(false);
  
  const [alert, setAlert] = useState<AlertState>({ show: false, type: "success", message: "" });
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ show: false, message: "", onConfirm: () => {} });
  
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  
  // ★タブのステート（URLパラメータと連動）
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  const showAlert = useCallback((type: "success" | "error", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert((prev) => ({ ...prev, show: false })), 5000);
  }, []);

  useEffect(() => {
    // URLのパラメータから初期タブを設定
    const tabParam = searchParams.get("tab") as TabType;
    if (tabParam && ["profile", "security", "integrations", "calendar"].includes(tabParam)) {
      setActiveTab(tabParam);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const providers = user.providerData.map(pd => pd.providerId);
        setLinkedProviders(providers);

        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const data: any = { id: userDocSnap.id, ...userDocSnap.data() };
            setUserData(data);

            if (data.schoolId) {
              const tenantDocRef = doc(db, "schools", data.schoolId);
              const tenantDocSnap = await getDoc(tenantDocRef);
              if (tenantDocSnap.exists()) {
                setTenantData(tenantDocSnap.data());
              }
            }

            const code = searchParams.get("code");
            if (code && !data.lineUserId) {
              setIsProcessingLine(true);
              await handleLineCallback(code, user.uid);
            }
          }
        } catch (error) {
          console.error("データ取得エラー:", error);
          showAlert("error", "プロフィール情報の取得に失敗しました。");
        }
      } else {
        window.location.href = "/login";
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [searchParams]);

  const handleLineCallback = async (code: string, uid: string) => {
    try {
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const response = await fetch("/api/line/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, redirectUri }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "連携に失敗しました。");
      }

      const newLineUserId = data.lineUserId;

      await updateDoc(doc(db, "users", uid), {
        lineUserId: newLineUserId,
        lineNotificationEnabled: true,
      });

      setUserData((prev: any) => prev ? { ...prev, lineUserId: newLineUserId, lineNotificationEnabled: true } : null);
      
      router.replace(window.location.pathname);
      showAlert("success", "LINEアカウントとの連携が完了しました！");

    } catch (error: any) {
      console.error("LINE linking error:", error);
      showAlert("error", error.message || "LINE連携処理中にエラーが発生しました。");
    } finally {
      setIsProcessingLine(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // URLを書き換える（ページリロードなし）
    router.replace(`/account?tab=${tab}`, { scroll: false });
  };

  if (isLoading || isProcessingLine) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 text-center">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600 mb-4" />
        <p className="text-gray-500 font-bold text-sm">
          {isProcessingLine ? "LINEアカウントを連携しています..." : "読み込み中..."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] dark:bg-gray-950 py-8 px-4 sm:px-6 lg:px-8 relative">
      
      {/* 確認ダイアログ */}
      {confirmDialog.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100 transform scale-100 transition-transform">
            <div className="flex items-start mb-4">
              <div className="bg-red-100 p-2 rounded-full mr-4 flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 whitespace-pre-wrap leading-relaxed mt-1">{confirmDialog.message}</h3>
            </div>
            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={() => setConfirmDialog({ show: false, message: "", onConfirm: () => {} })}
                className="px-5 py-2.5 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm"
              >
                解除する
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center tracking-tight">
              マイアカウント設定
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-medium">プロフィール情報の確認と、システムの設定を行います。</p>
          </div>
          <button
            onClick={() => router.push("/top")}
            className="hidden sm:flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors bg-white dark:bg-gray-900 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> トップへ戻る
          </button>
        </div>

        {alert.show && (
          <div className={`p-4 mb-6 rounded-xl text-sm font-bold flex items-center shadow-sm animate-fade-in ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {alert.type === "success" ? <CheckCircle2 className="mr-3 h-5 w-5 flex-shrink-0" /> : <AlertCircle className="mr-3 h-5 w-5 flex-shrink-0" />}
            {alert.message}
          </div>
        )}

        {/* タブメニュー */}
        <div className="flex overflow-x-auto space-x-2 bg-gray-100 dark:bg-gray-800/60 p-1.5 rounded-2xl mb-8 no-scrollbar border border-gray-200 dark:border-gray-800">
          <button
            onClick={() => handleTabChange("profile")}
            className={`flex items-center px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex-1 justify-center ${
              activeTab === "profile" 
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
            }`}
          >
            <UserCircle className="h-4 w-4 mr-2" />
            プロフィール
          </button>
          
          <button
            onClick={() => handleTabChange("security")}
            className={`flex items-center px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex-1 justify-center ${
              activeTab === "security" 
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
            }`}
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            セキュリティ
          </button>
          
          <button
            onClick={() => handleTabChange("integrations")}
            className={`flex items-center px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex-1 justify-center ${
              activeTab === "integrations" 
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
            }`}
          >
            <LinkIcon className="h-4 w-4 mr-2" />
            アカウント連携
          </button>

          <button
            onClick={() => handleTabChange("calendar")}
            className={`flex items-center px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex-1 justify-center ${
              activeTab === "calendar" 
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
            }`}
          >
            <Calendar className="h-4 w-4 mr-2" />
            カレンダー設定
          </button>
        </div>

        {/* タブに応じたコンテンツの表示 */}
        <div className="space-y-6">
          {activeTab === "profile" && (
            <ProfileSection currentUser={currentUser} userData={userData} tenantData={tenantData} />
          )}

          {activeTab === "security" && (
            <SecuritySection currentUser={currentUser} userData={userData} setUserData={setUserData} showAlert={showAlert} isProcessing={isProcessing} setIsProcessing={setIsProcessing} setConfirmDialog={setConfirmDialog} />
          )}

          {activeTab === "integrations" && (
            <IntegrationsSection currentUser={currentUser} userData={userData} setUserData={setUserData} showAlert={showAlert} isProcessing={isProcessing} setIsProcessing={setIsProcessing} setConfirmDialog={setConfirmDialog} tenantData={tenantData} linkedProviders={linkedProviders} setLinkedProviders={setLinkedProviders} />
          )}

          {activeTab === "calendar" && (
            <CalendarSettings userData={userData} showAlert={showAlert} />
          )}
        </div>

      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
      </div>
    }>
      <AccountContent />
    </Suspense>
  );
}