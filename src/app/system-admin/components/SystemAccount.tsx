"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChanged, linkWithPopup, unlink, User, AuthProvider } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db, googleProvider, microsoftProvider } from "@/lib/firebase";
import { UserCog, Link as LinkIcon, Unlink, Loader2 } from "lucide-react";
import { useDialog } from "@/components/DialogContext";

export default function SystemAccount() {
  const { showAlert } = useDialog();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const providers = user.providerData.map(pd => pd.providerId);
        setLinkedProviders(providers);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLinkAccount = async (provider: AuthProvider, providerName: string, providerIdStr: string) => {
    if (!currentUser) return;
    setIsProcessing(true);
    try {
      const result = await linkWithPopup(currentUser, provider);
      const newProviders = result.user.providerData.map(pd => pd.providerId);
      setLinkedProviders(newProviders);
      setCurrentUser(result.user);

      await updateDoc(doc(db, "users", currentUser.uid), {
        authProviders: newProviders.map(p => p === "password" ? "email" : p.replace(".com", ""))
      });
      showAlert(`${providerName} アカウントとの連携が完了しました。`, "success");
    } catch (error: any) {
      let errorMsg = `${providerName} との連携に失敗しました。`;
      if (error.code === "auth/credential-already-in-use") errorMsg = `この ${providerName} アカウントは既に別のユーザーに紐付いています。`;
      if (error.code === "auth/popup-closed-by-user") errorMsg = "連携画面が閉じられました。";
      showAlert(errorMsg, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnlinkAccount = async (providerId: string, providerName: string) => {
    if (!currentUser) return;
    if (linkedProviders.length <= 1) {
      showAlert("少なくとも1つのログイン手段を残す必要があります。", "error");
      return;
    }
    setIsProcessing(true);
    try {
      const result = await unlink(currentUser, providerId);
      const newProviders = result.providerData.map(pd => pd.providerId);
      setLinkedProviders(newProviders);
      setCurrentUser(result);

      await updateDoc(doc(db, "users", currentUser.uid), {
        authProviders: newProviders.map(p => p === "password" ? "email" : p.replace(".com", ""))
      });
      showAlert(`${providerName} アカウントの連携を解除しました。`, "success");
    } catch (error) {
      showAlert(`${providerName} の連携解除に失敗しました。`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl w-full mx-auto animate-fade-in">
      <div className="px-2 sm:px-0">
        <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 flex items-center">
          <UserCog className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-gray-600" /> 管理者アカウント連携
        </h3>
        <p className="text-[10px] sm:text-xs text-gray-500 mt-1 font-bold">システム管理アカウントの外部ソーシャル連携（SSO）を設定します。</p>
      </div>

      <div className="bg-white shadow-sm rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 bg-gray-50/80">
          <h4 className="text-sm font-black text-gray-900">アカウント連携</h4>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 mt-1 leading-relaxed">外部アカウントを連携すると、次回からパスワードを入力せずに安全にログインできます。</p>
        </div>
        
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Google */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 border border-gray-100 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors">
            <div className="flex items-center">
              <svg className="h-6 w-6 mr-3 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <div>
                <p className="text-sm font-black text-gray-900 leading-tight">Google</p>
                <p className="text-[10px] font-bold text-gray-500 mt-0.5">{linkedProviders.includes("google.com") ? <span className="text-green-600">連携済み</span> : "未連携"}</p>
              </div>
            </div>
            <div className="flex justify-end w-full sm:w-auto mt-1 sm:mt-0">
              {linkedProviders.includes("google.com") ? (
                <button onClick={() => handleUnlinkAccount("google.com", "Google")} disabled={isProcessing} className="w-full sm:w-auto flex items-center justify-center text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 px-4 py-2.5 sm:py-2 rounded-lg transition-colors disabled:opacity-50">
                  <Unlink size={14} className="mr-1.5" /> 解除する
                </button>
              ) : (
                <button onClick={() => handleLinkAccount(googleProvider, "Google", "google.com")} disabled={isProcessing} className="w-full sm:w-auto flex items-center justify-center text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 px-4 py-2.5 sm:py-2 rounded-lg transition-colors disabled:opacity-50 shadow-sm">
                  <LinkIcon size={14} className="mr-1.5" /> 連携する
                </button>
              )}
            </div>
          </div>

          {/* Microsoft */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 border border-gray-100 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors">
            <div className="flex items-center">
              <svg className="h-6 w-6 mr-3 shrink-0" viewBox="0 0 21 21">
                <path d="M0 0h10v10H0z" fill="#f25022"/><path d="M11 0h10v10H11z" fill="#7fba00"/><path d="M0 11h10v10H0z" fill="#00a4ef"/><path d="M11 11h10v10H11z" fill="#ffb900"/>
              </svg>
              <div>
                <p className="text-sm font-black text-gray-900 leading-tight">Microsoft</p>
                <p className="text-[10px] font-bold text-gray-500 mt-0.5">{linkedProviders.includes("microsoft.com") ? <span className="text-green-600">連携済み</span> : "未連携"}</p>
              </div>
            </div>
            <div className="flex justify-end w-full sm:w-auto mt-1 sm:mt-0">
              {linkedProviders.includes("microsoft.com") ? (
                <button onClick={() => handleUnlinkAccount("microsoft.com", "Microsoft")} disabled={isProcessing} className="w-full sm:w-auto flex items-center justify-center text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 px-4 py-2.5 sm:py-2 rounded-lg transition-colors disabled:opacity-50">
                  <Unlink size={14} className="mr-1.5" /> 解除する
                </button>
              ) : (
                <button onClick={() => handleLinkAccount(microsoftProvider, "Microsoft", "microsoft.com")} disabled={isProcessing} className="w-full sm:w-auto flex items-center justify-center text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 px-4 py-2.5 sm:py-2 rounded-lg transition-colors disabled:opacity-50 shadow-sm">
                  <LinkIcon size={14} className="mr-1.5" /> 連携する
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}