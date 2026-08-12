"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Loader2, ArrowLeft, UserCircle, ShieldCheck, Link as LinkIcon, Calendar } from "lucide-react";
import { useDialog } from "@/components/DialogContext";

import ProfileSection from "./components/ProfileSection";
import SecuritySection from "./components/SecuritySection";
import IntegrationsSection from "./components/IntegrationsSection";
import CalendarSettings from "./components/CalendarSettings"; 

type TabType = "profile" | "security" | "integrations" | "calendar";

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert } = useDialog();
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [tenantData, setTenantData] = useState<any>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingLine, setIsProcessingLine] = useState(false);
  
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  useEffect(() => {
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
          showAlert("プロフィール情報の取得に失敗しました。", "error");
        }
      } else {
        window.location.href = "/login";
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [searchParams, showAlert]);

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
      showAlert("LINEアカウントとの連携が完了しました！", "success");

    } catch (error: any) {
      console.error("LINE linking error:", error);
      showAlert(error.message || "LINE連携処理中にエラーが発生しました。", "error");
    } finally {
      setIsProcessingLine(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.replace(`/top/account?tab=${tab}`, { scroll: false });
  };

  if (isLoading || isProcessingLine) {
    return (
      <div className="h-full flex flex-col justify-center items-center p-4 text-center bg-gray-50">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600 mb-4" />
        <p className="text-gray-500 font-bold text-sm">
          {isProcessingLine ? "LINEアカウントを連携しています..." : "読み込み中..."}
        </p>
      </div>
    );
  }

  return (
    // ★ h-full flex-1 w-full で親（TopLayout）にぴったり収まるようにし、スクロール崩れを防ぐ
    <div className="h-full flex-1 w-full bg-[#F4F5F7] font-sans flex flex-col relative min-h-0">
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 relative min-h-0 w-full">
        <div className="max-w-4xl mx-auto w-full">
          
          <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-4 sm:mb-6 shrink-0">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 flex items-center tracking-tight">
                マイアカウント設定
              </h1>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500 font-medium">プロフィール情報の確認と、システムの設定を行います。</p>
            </div>
            <button
              onClick={() => router.push("/top")}
              className="hidden sm:flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors bg-white px-4 py-2 border border-gray-200 rounded-xl shadow-sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> トップへ戻る
            </button>
          </div>

          {/* タブメニュー (スマホ横スクロール対応) */}
          <div className="flex overflow-x-auto space-x-1.5 sm:space-x-2 bg-gray-100 p-1.5 rounded-xl sm:rounded-2xl mb-6 sm:mb-8 custom-scrollbar border border-gray-200 shrink-0 snap-x">
            <button
              onClick={() => handleTabChange("profile")}
              className={`flex items-center px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-bold whitespace-nowrap transition-all flex-1 justify-center shrink-0 snap-start ${
                activeTab === "profile" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
              }`}
            >
              <UserCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              プロフィール
            </button>
            
            <button
              onClick={() => handleTabChange("security")}
              className={`flex items-center px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-bold whitespace-nowrap transition-all flex-1 justify-center shrink-0 snap-start ${
                activeTab === "security" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              セキュリティ
            </button>
            
            <button
              onClick={() => handleTabChange("integrations")}
              className={`flex items-center px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-bold whitespace-nowrap transition-all flex-1 justify-center shrink-0 snap-start ${
                activeTab === "integrations" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
              }`}
            >
              <LinkIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              アカウント連携
            </button>

            <button
              onClick={() => handleTabChange("calendar")}
              className={`flex items-center px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-bold whitespace-nowrap transition-all flex-1 justify-center shrink-0 snap-start ${
                activeTab === "calendar" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
              }`}
            >
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              カレンダー設定
            </button>
          </div>

          {/* コンテンツ */}
          <div className="space-y-4 sm:space-y-6">
            {activeTab === "profile" && <ProfileSection currentUser={currentUser} userData={userData} tenantData={tenantData} />}
            {activeTab === "security" && <SecuritySection currentUser={currentUser} userData={userData} setUserData={setUserData} isProcessing={isProcessing} setIsProcessing={setIsProcessing} />}
            {activeTab === "integrations" && <IntegrationsSection currentUser={currentUser} userData={userData} setUserData={setUserData} isProcessing={isProcessing} setIsProcessing={setIsProcessing} tenantData={tenantData} linkedProviders={linkedProviders} setLinkedProviders={setLinkedProviders} />}
            {activeTab === "calendar" && <CalendarSettings userData={userData} />}
          </div>

        </div>
      </main>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex justify-center items-center bg-gray-50">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    }>
      <AccountContent />
    </Suspense>
  );
}