"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  onAuthStateChanged, 
  linkWithPopup, 
  unlink, 
  User,
  AuthProvider
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db, googleProvider, microsoftProvider } from "@/lib/firebase";
import { 
  User as UserIcon, 
  ShieldCheck, 
  Mail, 
  Building, 
  Phone, 
  Briefcase,
  Link as LinkIcon,
  Unlink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
  Bell,
  BellOff,
  Smartphone,
  ShieldAlert,
  ArrowLeft
} from "lucide-react";

// UIアラートの型定義
type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

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
  
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert((prev) => ({ ...prev, show: false })), 5000);
  };

  useEffect(() => {
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

            // LINEログインからのコールバック（?code=...）がある場合の処理
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

  // --- LINE連携処理 ---
  const handleLineCallback = async (code: string, uid: string) => {
    try {
      // 現在のURL（/account 等）を自動で取得して戻り先に指定
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
      
      // パラメータを消すために現在のURLへ再リダイレクト
      router.replace(window.location.pathname);
      showAlert("success", "LINEアカウントとの連携が完了しました！");

    } catch (error: any) {
      console.error("LINE linking error:", error);
      showAlert("error", error.message || "LINE連携処理中にエラーが発生しました。");
    } finally {
      setIsProcessingLine(false);
    }
  };

  const startLineLinking = () => {
    const clientId = process.env.NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID || "2010747597";
    // 現在のURL（/account 等）を自動で取得して戻り先に指定
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

  const handleUnlinkLine = async () => {
    if (!userData) return;
    if (!window.confirm("LINE連携を解除しますか？\nシステムの通知がLINEに届かなくなります。")) return;
    
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
  };

  // --- 既存のログインアカウント連携処理 ---
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

      showAlert("success", `${providerName} アカウントとの連携が完了しました。`);
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
      setCurrentUser(result);

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

  // LINE連携の表示条件: テナントが有効化している かつ ユーザーが許可されている
  const isLineFeatureAvailable = tenantData?.lineFeatureEnabled === true && userData?.lineConnectionAllowed !== false;
  const isLineLinked = !!userData?.lineUserId;
  const isLineNotificationEnabled = userData?.lineNotificationEnabled !== false;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 flex items-center">
              <UserIcon className="mr-3 text-blue-600" size={28} />
              マイアカウント
            </h1>
            <p className="mt-2 text-sm text-gray-600">プロフィール情報の確認と、セキュリティ設定（外部アカウント連携）を行います。</p>
          </div>
          <button
            onClick={() => router.push("/top")}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            &larr; トップに戻る
          </button>
        </div>

        {/* UIアラート */}
        {alert.show && (
          <div className={`p-4 rounded-md text-sm font-bold flex items-center ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {alert.type === "success" ? <CheckCircle2 className="mr-2 h-5 w-5 flex-shrink-0" /> : <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />}
            {alert.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 左側：プロフィール情報 */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white shadow sm:rounded-lg overflow-hidden border border-gray-200">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg leading-6 font-bold text-gray-900">プロフィール情報</h3>
              </div>
              <div className="px-4 py-5 sm:p-0">
                <dl className="sm:divide-y sm:divide-gray-200">
                  <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 flex items-center">
                      <UserIcon className="mr-2 h-4 w-4 text-gray-400" />氏名
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 font-bold sm:mt-0 sm:col-span-2">
                      {userData?.name || "未設定"} <span className="text-gray-400 font-normal ml-2">{userData?.nameKana || ""}</span>
                    </dd>
                  </div>
                  <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 flex items-center">
                      <Mail className="mr-2 h-4 w-4 text-gray-400" />メールアドレス
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {currentUser?.email}
                    </dd>
                  </div>
                  <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 flex items-center">
                      <Building className="mr-2 h-4 w-4 text-gray-400" />所属テナント
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {tenantData?.name || "未設定"}
                    </dd>
                  </div>
                  <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 flex items-center">
                      <Briefcase className="mr-2 h-4 w-4 text-gray-400" />役職・権限
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {userData?.role === "admin" ? "テナント管理者" : userData?.role === "system_admin" ? "システム特権" : userData?.role === "officer" ? "生徒会役員" : "一般生徒"}
                      </span>
                      <span className="ml-3 text-gray-600 font-bold">{userData?.positionName || ""}</span>
                    </dd>
                  </div>
                  <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 flex items-center">
                      <Phone className="mr-2 h-4 w-4 text-gray-400" />電話番号
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {userData?.phoneNumber || "未登録"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* 右側：セキュリティ（アカウント連携） */}
          <div className="space-y-6">
            <div className="bg-white shadow sm:rounded-lg overflow-hidden border border-gray-200">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg leading-6 font-bold text-gray-900 flex items-center">
                  <ShieldCheck className="mr-2 text-emerald-600" size={20} />
                  アカウント・通知連携
                </h3>
              </div>
              <div className="p-4 sm:p-6 space-y-8">
                
                {/* ログイン用プロバイダ */}
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">ログイン連携</h4>
                  <p className="text-xs text-gray-500 leading-relaxed mb-4">
                    外部アカウントを連携すると、次回からパスワードを入力せずにログインできます。
                  </p>

                  <div className="space-y-3">
                    {/* Google連携 */}
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-center">
                        <svg className="h-6 w-6 mr-3" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <div>
                          <p className="text-sm font-bold text-gray-900">Google</p>
                          <p className="text-xs text-gray-500">
                            {linkedProviders.includes("google.com") ? "連携済み" : "未連携"}
                          </p>
                        </div>
                      </div>
                      <div>
                        {linkedProviders.includes("google.com") ? (
                          <button
                            onClick={() => handleUnlinkAccount("google.com", "Google")}
                            disabled={isProcessing}
                            className="flex items-center text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                          >
                            <Unlink size={14} className="mr-1" /> 解除
                          </button>
                        ) : (
                          <button
                            onClick={() => handleLinkAccount(googleProvider, "Google", "google.com")}
                            disabled={isProcessing}
                            className="flex items-center text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                          >
                            <LinkIcon size={14} className="mr-1" /> 連携
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Microsoft連携 */}
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-center">
                        <svg className="h-6 w-6 mr-3" viewBox="0 0 21 21">
                          <path d="M0 0h10v10H0z" fill="#f25022"/><path d="M11 0h10v10H11z" fill="#7fba00"/><path d="M0 11h10v10H0z" fill="#00a4ef"/><path d="M11 11h10v10H11z" fill="#ffb900"/>
                        </svg>
                        <div>
                          <p className="text-sm font-bold text-gray-900">Microsoft</p>
                          <p className="text-xs text-gray-500">
                            {linkedProviders.includes("microsoft.com") ? "連携済み" : "未連携"}
                          </p>
                        </div>
                      </div>
                      <div>
                        {linkedProviders.includes("microsoft.com") ? (
                          <button
                            onClick={() => handleUnlinkAccount("microsoft.com", "Microsoft")}
                            disabled={isProcessing}
                            className="flex items-center text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                          >
                            <Unlink size={14} className="mr-1" /> 解除
                          </button>
                        ) : (
                          <button
                            onClick={() => handleLinkAccount(microsoftProvider, "Microsoft", "microsoft.com")}
                            disabled={isProcessing}
                            className="flex items-center text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                          >
                            <LinkIcon size={14} className="mr-1" /> 連携
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* LINE通知連携 */}
                {isLineFeatureAvailable && (
                  <div className="pt-6 border-t border-gray-200">
                    <h4 className="text-xs font-bold text-[#06C755] uppercase tracking-wider mb-3 flex items-center">
                      <MessageCircle className="h-4 w-4 mr-1" /> メッセージ・通知連携
                    </h4>
                    
                    {!isLineLinked ? (
                      <div className="text-center p-5 border border-gray-200 rounded-lg bg-white">
                        <Smartphone className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-600 mb-4 leading-relaxed font-medium">
                          重要なお知らせや期限を<br />LINEで受け取れます。
                        </p>
                        <button
                          onClick={startLineLinking}
                          disabled={isProcessing}
                          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-full shadow-sm text-sm font-extrabold text-white bg-[#06C755] hover:bg-[#05b34c] focus:outline-none transition-colors disabled:opacity-50"
                        >
                          <LinkIcon className="h-4 w-4 mr-2" />
                          LINEと連携する
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-[#b3efca] rounded-lg bg-[#f0fbf4]">
                          <div>
                            <p className="text-sm font-bold text-[#00993c] flex items-center">
                              <CheckCircle2 className="h-4 w-4 mr-1" /> 連携済み
                            </p>
                            <p className="text-xs text-[#00732d] mt-1">
                              システムの通知がLINEに送信されます。
                            </p>
                          </div>
                          <button
                            onClick={handleUnlinkLine}
                            disabled={isProcessing}
                            className="text-xs font-bold text-gray-500 hover:text-red-600 px-3 py-1.5 border border-gray-300 hover:border-red-200 rounded-md bg-white transition-colors whitespace-nowrap"
                          >
                            連携を解除
                          </button>
                        </div>

                        {/* 通知ON/OFFトグル */}
                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-center pr-3">
                            <div className={`p-1.5 rounded-full mr-3 ${isLineNotificationEnabled ? 'bg-[#e6faed] text-[#06C755]' : 'bg-gray-100 text-gray-400'}`}>
                              {isLineNotificationEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900">通常のお知らせ受信</div>
                              <div className="text-[10px] text-gray-500 mt-0.5">※重要なお知らせは設定に関わらず配信されます</div>
                            </div>
                          </div>
                          <button
                            onClick={() => toggleLineNotification(!isLineNotificationEnabled)}
                            disabled={isProcessing}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isLineNotificationEnabled ? 'bg-[#06C755]' : 'bg-gray-200'} disabled:opacity-50`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isLineNotificationEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
          
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