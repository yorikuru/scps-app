"use client";

import React from "react";
import { ShieldCheck, Unlink, Link as LinkIcon, MessageCircle, Smartphone, CheckCircle2, Bell, BellOff } from "lucide-react";
import { User, AuthProvider, linkWithPopup, unlink } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db, googleProvider, microsoftProvider } from "@/lib/firebase";

type Props = {
  currentUser: User | null;
  userData: any;
  setUserData: React.Dispatch<React.SetStateAction<any>>;
  showAlert: (type: "success" | "error", message: string) => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  setConfirmDialog: (dialog: any) => void;
  tenantData: any;
  linkedProviders: string[];
  setLinkedProviders: React.Dispatch<React.SetStateAction<string[]>>;
};

export default function IntegrationsSection({
  currentUser,
  userData,
  setUserData,
  showAlert,
  isProcessing,
  setIsProcessing,
  setConfirmDialog,
  tenantData,
  linkedProviders,
  setLinkedProviders
}: Props) {
  
  const handleLinkAccount = async (provider: AuthProvider, providerName: string, providerIdStr: string) => {
    if (!currentUser) return;
    setIsProcessing(true);
    try {
      const result = await linkWithPopup(currentUser, provider);
      const newProviders = result.user.providerData.map(pd => pd.providerId);
      setLinkedProviders(newProviders);

      await updateDoc(doc(db, "users", currentUser.uid), {
        authProviders: newProviders.map(p => p === "password" ? "email" : p.replace(".com", ""))
      });

      showAlert("success", `${providerName} アカウントとの連携が完了しました。`);

      // セキュリティ通知メールの送信
      await fetch('/api/send-security-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, action: `${providerName} アカウントとの連携が設定されました` })
      });
      
    } catch (error: any) {
      console.error("Account linking error:", error);
      let errorMsg = `${providerName} との連携に失敗しました。`;
      if (error.code === "auth/credential-already-in-use") {
        errorMsg = `この ${providerName} アカウントは既に別のユーザーに紐付いています。`;
      } else if (error.code === "auth/popup-closed-by-user") {
        errorMsg = "連携画面が閉じられました。";
      }
      showAlert("error", errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnlinkAccount = async (providerId: string, providerName: string) => {
    if (!currentUser) return;
    if (linkedProviders.length <= 1) {
      showAlert("error", "少なくとも1つのログイン手段を残す必要があります。");
      return;
    }
    setIsProcessing(true);
    try {
      const result = await unlink(currentUser, providerId);
      const newProviders = result.providerData.map(pd => pd.providerId);
      setLinkedProviders(newProviders);

      await updateDoc(doc(db, "users", currentUser.uid), {
        authProviders: newProviders.map(p => p === "password" ? "email" : p.replace(".com", ""))
      });

      showAlert("success", `${providerName} アカウントの連携を解除しました。`);
    } catch (error: any) {
      console.error("Account unlinking error:", error);
      showAlert("error", `${providerName} の連携解除に失敗しました。`);
    } finally {
      setIsProcessing(false);
    }
  };

  const startLineLinking = () => {
    const clientId = process.env.NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID || "2010747597";
    const redirectUri = encodeURIComponent(`${window.location.origin}${window.location.pathname}`);
    const state = currentUser?.uid || "random_state";
    window.location.href = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=profile&bot_prompt=aggressive`;
  };

  const toggleLineNotification = async (enabled: boolean) => {
    if (!userData) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "users", userData.id), {
        lineNotificationEnabled: enabled,
      });
      setUserData((prev: any) => prev ? { ...prev, lineNotificationEnabled: enabled } : null);
      showAlert("success", enabled ? "LINE通知をオンにしました。" : "LINE通知をオフにしました。");
    } catch (error) {
      console.error("Update error:", error);
      showAlert("error", "設定の保存に失敗しました。");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnlinkLine = () => {
    setConfirmDialog({
      show: true,
      message: "LINE連携を解除しますか？\nシステムの通知がLINEに届かなくなります。",
      onConfirm: async () => {
        setConfirmDialog({ show: false, message: "", onConfirm: () => {} });
        if (!userData) return;
        setIsProcessing(true);
        try {
          await updateDoc(doc(db, "users", userData.id), {
            lineUserId: null,
          });
          setUserData((prev: any) => prev ? { ...prev, lineUserId: undefined, lineNotificationEnabled: false } : null);
          showAlert("success", "LINE連携を解除しました。");
        } catch (error) {
          console.error("Unlink error:", error);
          showAlert("error", "解除に失敗しました。");
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  const isLineFeatureAvailable = tenantData?.lineFeatureEnabled === true && userData?.lineConnectionAllowed !== false;
  const isLineLinked = !!userData?.lineUserId;
  const isLineNotificationEnabled = userData?.lineNotificationEnabled !== false;

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 bg-white flex items-center">
        <ShieldCheck className="mr-2 text-emerald-600 h-5 w-5" />
        <h3 className="text-lg font-extrabold text-gray-900">アカウント・通知連携</h3>
      </div>
      <div className="p-6">
        
        <div className="mb-10">
          <p className="text-base font-bold text-gray-900 mb-2">ログイン連携</p>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            外部アカウントを連携すると、次回からパスワードを入力せずに安全かつスムーズにログインできます。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Google */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-5 border border-gray-200 rounded-xl bg-white hover:shadow-sm transition-shadow gap-4">
              <div className="flex items-center w-full sm:w-auto">
                <svg className="h-8 w-8 mr-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <div>
                  <p className="text-base font-bold text-gray-900">Google</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {linkedProviders.includes("google.com") ? "連携済み" : "未連携"}
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-auto">
                {linkedProviders.includes("google.com") ? (
                  <button
                    onClick={() => handleUnlinkAccount("google.com", "Google")}
                    disabled={isProcessing}
                    className="w-full sm:w-auto flex items-center justify-center text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Unlink size={16} className="mr-1.5" /> 解除
                  </button>
                ) : (
                  <button
                    onClick={() => handleLinkAccount(googleProvider, "Google", "google.com")}
                    disabled={isProcessing}
                    className="w-full sm:w-auto flex items-center justify-center text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <LinkIcon size={16} className="mr-1.5" /> 連携
                  </button>
                )}
              </div>
            </div>

            {/* Microsoft */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-5 border border-gray-200 rounded-xl bg-white hover:shadow-sm transition-shadow gap-4">
              <div className="flex items-center w-full sm:w-auto">
                <svg className="h-8 w-8 mr-4 flex-shrink-0" viewBox="0 0 21 21">
                  <path d="M0 0h10v10H0z" fill="#f25022"/><path d="M11 0h10v10H11z" fill="#7fba00"/><path d="M0 11h10v10H0z" fill="#00a4ef"/><path d="M11 11h10v10H11z" fill="#ffb900"/>
                </svg>
                <div>
                  <p className="text-base font-bold text-gray-900">Microsoft</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {linkedProviders.includes("microsoft.com") ? "連携済み" : "未連携"}
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-auto">
                {linkedProviders.includes("microsoft.com") ? (
                  <button
                    onClick={() => handleUnlinkAccount("microsoft.com", "Microsoft")}
                    disabled={isProcessing}
                    className="w-full sm:w-auto flex items-center justify-center text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Unlink size={16} className="mr-1.5" /> 解除
                  </button>
                ) : (
                  <button
                    onClick={() => handleLinkAccount(microsoftProvider, "Microsoft", "microsoft.com")}
                    disabled={isProcessing}
                    className="w-full sm:w-auto flex items-center justify-center text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <LinkIcon size={16} className="mr-1.5" /> 連携
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {isLineFeatureAvailable && (
          <div className="pt-8 border-t border-gray-100">
            <p className="text-base font-bold text-[#06C755] mb-6 flex items-center">
              <MessageCircle className="h-5 w-5 mr-2" /> LINE メッセージ・通知連携
            </p>
            
            {!isLineLinked ? (
              <div className="text-center p-8 border border-gray-200 rounded-2xl bg-gray-50/50 flex flex-col items-center">
                <Smartphone className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-base text-gray-700 mb-6 leading-relaxed font-medium">
                  システムの重要なお知らせや期限を、<br className="hidden sm:block" />使い慣れたLINEアプリで直接受け取れるようになります。
                </p>
                <button
                  onClick={startLineLinking}
                  disabled={isProcessing}
                  className="w-full max-w-sm flex items-center justify-center px-6 py-3.5 border border-transparent rounded-xl shadow-md text-base font-extrabold text-white bg-[#06C755] hover:bg-[#05b34c] focus:outline-none transition-colors disabled:opacity-50"
                >
                  <LinkIcon className="h-5 w-5 mr-2" />
                  LINEと連携して通知を受け取る
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col sm:flex-row items-center justify-between p-5 border border-[#b3efca] rounded-xl bg-[#f0fbf4] gap-4">
                  <div className="w-full sm:w-auto">
                    <p className="text-base font-bold text-[#00993c] flex items-center mb-1.5">
                      <CheckCircle2 className="h-5 w-5 mr-2" /> 連携済み
                    </p>
                    <p className="text-sm text-[#00732d] font-medium">
                      現在、システムの通知がLINEに送信されます。
                    </p>
                  </div>
                  <button
                    onClick={handleUnlinkLine}
                    disabled={isProcessing}
                    className="w-full sm:w-auto text-sm font-bold text-gray-600 hover:text-red-600 px-5 py-2.5 border border-gray-300 hover:border-red-200 rounded-lg bg-white transition-colors"
                  >
                    連携を解除
                  </button>
                </div>

                <div className="flex items-center justify-between p-5 border border-gray-200 rounded-xl bg-white hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center pr-4">
                    <div className={`p-3 rounded-full mr-4 ${isLineNotificationEnabled ? 'bg-[#e6faed] text-[#06C755]' : 'bg-gray-100 text-gray-400'}`}>
                      {isLineNotificationEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="text-base font-bold text-gray-900">通常のお知らせを受信</div>
                      <div className="text-xs text-gray-500 mt-1">※重要なお知らせは設定に関わらず配信されます</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleLineNotification(!isLineNotificationEnabled)}
                    disabled={isProcessing}
                    className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isLineNotificationEnabled ? 'bg-[#06C755]' : 'bg-gray-200'} disabled:opacity-50`}
                  >
                    <span className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isLineNotificationEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}