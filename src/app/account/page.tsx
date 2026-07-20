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
import { QRCodeSVG } from "qrcode.react";
import { startRegistration } from "@simplewebauthn/browser";
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
  Scan, 
  KeyRound, 
  X,
  ArrowRight,
  ArrowLeft,
  Download,
  Apple,
  Fingerprint
} from "lucide-react";

// UIアラートの型定義
type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

// UI確認モーダルの型定義
type ConfirmDialogState = {
  show: boolean;
  message: string;
  onConfirm: () => void;
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
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ show: false, message: "", onConfirm: () => {} });
  
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);

  // 端末OS判定用 (QR表示切替)
  const [deviceType, setDeviceType] = useState<"loading" | "pc" | "ios" | "android">("loading");

  // TOTP設定チュートリアル用ステート
  const [isSettingTotp, setIsSettingTotp] = useState(false);
  const [setupStep, setSetupStep] = useState<number>(0);
  const [totpSetupData, setTotpSetupData] = useState<{ secret: string; uri: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert((prev) => ({ ...prev, show: false })), 5000);
  };

  useEffect(() => {
    // 端末の判定 (iOS / Android / PC)
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setDeviceType("ios");
    } else if (/android/.test(ua)) {
      setDeviceType("android");
    } else {
      setDeviceType("pc");
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

            // LINEログインからのコールバック処理
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

  // --- 認証アプリ (TOTP) 設定処理 ---
  const handleStartTotpSetup = async () => {
    if (!currentUser?.email) {
      showAlert("error", "メールアドレスが登録されていないため、設定できません。");
      return;
    }
    
    setIsSettingTotp(true);
    setSetupStep(1);
    
    try {
      const res = await fetch('/api/totp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email })
      });
      const data = await res.json();
      
      if (res.ok) {
        setTotpSetupData(data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      showAlert("error", "設定用データの生成に失敗しました。再度お試しください。");
      setSetupStep(0);
      setIsSettingTotp(false);
    }
  };

  const handleVerifyTotp = async () => {
    if (!totpSetupData || mfaCode.length !== 6) return;
    setIsVerifying(true);

    try {
      const res = await fetch('/api/totp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mfaCode, secret: totpSetupData.secret })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "コードが正しくありません。");
      }

      await updateDoc(doc(db, "users", currentUser!.uid), {
        totpSecret: totpSetupData.secret
      });

      setUserData((prev: any) => prev ? { ...prev, totpSecret: totpSetupData.secret } : null);
      setSetupStep(4); 
      showAlert("success", "認証アプリの設定が完了しました！");
      
    } catch (error: any) {
      showAlert("error", error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCancelSetup = () => {
    setIsSettingTotp(false);
    setSetupStep(0);
    setTotpSetupData(null);
    setMfaCode("");
  };

  const handleRemoveTotp = () => {
    setConfirmDialog({
      show: true,
      message: "本当に認証アプリの連携を解除しますか？",
      onConfirm: async () => {
        setConfirmDialog({ show: false, message: "", onConfirm: () => {} });
        if (!userData) return;
        setIsProcessing(true);
        try {
          await updateDoc(doc(db, "users", userData.id), {
            totpSecret: null
          });
          setUserData((prev: any) => prev ? { ...prev, totpSecret: null } : null);
          showAlert("success", "認証アプリの連携を解除しました。");
        } catch (error) {
          showAlert("error", "連携解除に失敗しました。");
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  // --- パスキー (WebAuthn) 設定処理 ---
  const handleRegisterPasskey = async () => {
    if (!currentUser?.email) {
      showAlert("error", "メールアドレスが登録されていません。");
      return;
    }
    
    setIsProcessing(true);
    try {
      // 1. オプション（チャレンジ）を取得
      const optionsResp = await fetch('/api/webauthn/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.uid, email: currentUser.email })
      });
      const optionsJSON = await optionsResp.json();
      if (!optionsResp.ok) throw new Error(optionsJSON.error || "オプションの生成に失敗しました");

      // 2. ブラウザの生体認証（WebAuthn API）を呼び出し
      const attResp = await startRegistration({ optionsJSON });

      // 3. 署名をサーバーで検証し保存
      const verifyResp = await fetch('/api/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.uid, response: attResp })
      });
      const verifyResult = await verifyResp.json();
      if (!verifyResp.ok) throw new Error(verifyResult.error || "検証に失敗しました");

      showAlert("success", "現在の端末をパスキーとして登録しました！");
      
      // フロントエンドのStateを更新
      const newPasskeyObj = { createdAt: new Date().toISOString() };
      setUserData((prev: any) => prev ? { ...prev, passkeys: [...(prev.passkeys || []), newPasskeyObj] } : null);

    } catch (error: any) {
      console.error("Passkey register error:", error);
      // エラー文言が "The operation either timed out or was not allowed" 等の場合はキャンセル扱い
      if (error.message.includes("timed out") || error.message.includes("not allowed") || error.name === "NotAllowedError") {
        showAlert("error", "パスキーの登録がキャンセルされました。");
      } else {
        showAlert("error", error.message || "パスキーの登録に失敗しました。");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePasskeys = () => {
    setConfirmDialog({
      show: true,
      message: "登録されているすべてのパスキー（生体認証端末）を解除しますか？\n解除後はパスワード等でログインする必要があります。",
      onConfirm: async () => {
        setConfirmDialog({ show: false, message: "", onConfirm: () => {} });
        if (!userData) return;
        setIsProcessing(true);
        try {
          await updateDoc(doc(db, "users", userData.id), {
            passkeys: []
          });
          setUserData((prev: any) => prev ? { ...prev, passkeys: [] } : null);
          showAlert("success", "すべてのパスキーを解除しました。");
        } catch (error) {
          showAlert("error", "パスキーの解除に失敗しました。");
        } finally {
          setIsProcessing(false);
        }
      }
    });
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

  const isLineFeatureAvailable = tenantData?.lineFeatureEnabled === true && userData?.lineConnectionAllowed !== false;
  const isLineLinked = !!userData?.lineUserId;
  const isLineNotificationEnabled = userData?.lineNotificationEnabled !== false;

  // ダウンロードリンク定数
  const APP_URLS = {
    ms: {
      ios: "https://apps.apple.com/jp/app/microsoft-authenticator/id983156458",
      android: "https://play.google.com/store/apps/details?id=com.azure.authenticator&hl=ja"
    },
    google: {
      ios: "https://apps.apple.com/jp/app/google-authenticator/id388497605",
      android: "https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2&hl=ja"
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-8 px-4 sm:px-6 lg:px-8 relative">
      
      {/* UI確認モーダルダイアログ */}
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

      {/* TOTP設定チュートリアル フルスクリーンモーダル */}
      {isSettingTotp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col relative border border-gray-100">
            
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white/95 sticky top-0 z-10">
              <div className="flex items-center text-blue-900">
                <ShieldAlert className="h-5 w-5 mr-2 text-blue-600" />
                <h3 className="text-base font-extrabold">認証アプリの設定</h3>
              </div>
              <button onClick={handleCancelSetup} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
              <div className="max-w-xl mx-auto mb-10">
                <div className="flex items-center justify-between relative">
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 rounded-full -z-10"></div>
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-blue-500 rounded-full transition-all duration-500 -z-10" style={{ width: `${((setupStep - 1) / 3) * 100}%` }}></div>
                  
                  {[1, 2, 3, 4].map((step) => (
                    <div key={step} className={`flex items-center justify-center h-8 w-8 rounded-full border-2 text-sm font-bold transition-all duration-300 bg-white shadow-sm ${setupStep >= step ? "border-blue-600 text-blue-600 ring-4 ring-blue-50" : "border-gray-300 text-gray-400"}`}>
                      {step === 4 ? <CheckCircle2 className="h-4 w-4" /> : step}
                    </div>
                  ))}
                </div>
              </div>

              <div className="max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
                
                {setupStep === 1 && (
                  <div className="text-center animate-fade-in">
                    <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                      <Smartphone className="h-8 w-8 text-blue-600" />
                    </div>
                    <h4 className="text-xl font-extrabold text-gray-900 mb-3">アプリを準備する</h4>
                    <p className="text-sm text-gray-600 mb-8 leading-relaxed">
                      お手持ちのスマートフォンに <b>Microsoft Authenticator</b> または <b>Google Authenticator</b> などの認証用アプリをインストールしてください。
                    </p>

                    {deviceType !== "loading" && (
                      <div className="grid gap-6 sm:grid-cols-2 mb-10 text-left">
                        {/* Microsoft */}
                        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-center sm:justify-start mb-4">
                              <svg className="h-6 w-6 mr-2 flex-shrink-0" viewBox="0 0 21 21">
                                <path d="M0 0h10v10H0z" fill="#f25022"/><path d="M11 0h10v10H11z" fill="#7fba00"/><path d="M0 11h10v10H0z" fill="#00a4ef"/><path d="M11 11h10v10H11z" fill="#ffb900"/>
                              </svg>
                              <h6 className="font-bold text-sm text-gray-900">Microsoft<br/>Authenticator</h6>
                            </div>
                            
                            {deviceType === "pc" && (
                              <div className="flex justify-center gap-4 mb-4">
                                <div className="text-center">
                                  <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm inline-block">
                                    <QRCodeSVG value={APP_URLS.ms.ios} size={70} />
                                  </div>
                                  <p className="text-[10px] mt-1.5 font-bold text-gray-500 flex items-center justify-center"><Apple className="h-3 w-3 mr-0.5"/>iPhone</p>
                                </div>
                                <div className="text-center">
                                  <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm inline-block">
                                    <QRCodeSVG value={APP_URLS.ms.android} size={70} />
                                  </div>
                                  <p className="text-[10px] mt-1.5 font-bold text-gray-500">Android</p>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2 mt-auto">
                            {(deviceType === "pc" || deviceType === "ios") && (
                              <a href={APP_URLS.ms.ios} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full bg-gray-900 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-black transition-colors">
                                <Apple className="h-4 w-4 mr-1.5" /> App Store で入手
                              </a>
                            )}
                            {(deviceType === "pc" || deviceType === "android") && (
                              <a href={APP_URLS.ms.android} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full bg-blue-600 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors">
                                <Download className="h-4 w-4 mr-1.5" /> Google Play で入手
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Google */}
                        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-center sm:justify-start mb-4">
                              <svg className="h-6 w-6 mr-2 flex-shrink-0" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                              </svg>
                              <h6 className="font-bold text-sm text-gray-900">Google<br/>Authenticator</h6>
                            </div>

                            {deviceType === "pc" && (
                              <div className="flex justify-center gap-4 mb-4">
                                <div className="text-center">
                                  <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm inline-block">
                                    <QRCodeSVG value={APP_URLS.google.ios} size={70} />
                                  </div>
                                  <p className="text-[10px] mt-1.5 font-bold text-gray-500 flex items-center justify-center"><Apple className="h-3 w-3 mr-0.5"/>iPhone</p>
                                </div>
                                <div className="text-center">
                                  <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm inline-block">
                                    <QRCodeSVG value={APP_URLS.google.android} size={70} />
                                  </div>
                                  <p className="text-[10px] mt-1.5 font-bold text-gray-500">Android</p>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2 mt-auto">
                            {(deviceType === "pc" || deviceType === "ios") && (
                              <a href={APP_URLS.google.ios} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full bg-gray-900 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-black transition-colors">
                                <Apple className="h-4 w-4 mr-1.5" /> App Store で入手
                              </a>
                            )}
                            {(deviceType === "pc" || deviceType === "android") && (
                              <a href={APP_URLS.google.android} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full bg-blue-600 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors">
                                <Download className="h-4 w-4 mr-1.5" /> Google Play で入手
                              </a>
                            )}
                          </div>
                        </div>

                      </div>
                    )}

                    <div className="max-w-md mx-auto">
                      <button 
                        onClick={() => setSetupStep(2)}
                        className="px-8 py-3.5 bg-blue-600 text-white text-base font-bold rounded-xl hover:bg-blue-700 transition-all w-full shadow-md hover:shadow-lg flex items-center justify-center"
                      >
                        アプリの準備ができたので次へ <ArrowRight className="h-5 w-5 ml-2" />
                      </button>
                    </div>
                  </div>
                )}

                {setupStep === 2 && (
                  <div className="text-center animate-fade-in">
                    <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                      <Scan className="h-8 w-8 text-blue-600" />
                    </div>
                    <h4 className="text-xl font-extrabold text-gray-900 mb-3">QRコードを読み取る</h4>
                    <p className="text-sm text-gray-600 mb-6">
                      認証アプリで「QRコードをスキャン」を選択し、下の画像を読み取ってください。
                    </p>
                    
                    <div className="flex justify-center mb-6">
                      {totpSetupData ? (
                        <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm">
                          <QRCodeSVG value={totpSetupData.uri} size={180} level="M" />
                        </div>
                      ) : (
                        <div className="w-[216px] h-[216px] bg-gray-50 flex items-center justify-center rounded-2xl border border-gray-100">
                          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-10 text-left max-w-sm mx-auto">
                      <p className="text-xs font-bold text-gray-700 mb-2 flex items-center">
                        <KeyRound className="h-4 w-4 mr-1 text-gray-500" /> カメラが使えない場合は手動入力
                      </p>
                      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                        <code className="text-sm font-mono text-gray-800 break-all select-all">
                          {totpSetupData?.secret || "読込中..."}
                        </code>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                      <button 
                        onClick={() => setSetupStep(1)}
                        className="px-6 py-3.5 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors w-full sm:w-auto"
                      >
                        戻る
                      </button>
                      <button 
                        onClick={() => setSetupStep(3)}
                        className="px-8 py-3.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-md transition-colors flex-1 flex items-center justify-center"
                      >
                        読み取ったので次へ <ArrowRight className="h-4 w-4 ml-2" />
                      </button>
                    </div>
                  </div>
                )}

                {setupStep === 3 && (
                  <div className="text-center animate-fade-in">
                    <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                      <KeyRound className="h-8 w-8 text-blue-600" />
                    </div>
                    <h4 className="text-xl font-extrabold text-gray-900 mb-3">認証コードの入力</h4>
                    <p className="text-sm text-gray-600 mb-8">
                      アプリに表示されている<b>6桁の数字</b>を入力して、設定を完了させます。
                    </p>
                    
                    <input 
                      type="text" 
                      maxLength={6}
                      placeholder="000000"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                      className="block w-full max-w-xs mx-auto text-center text-4xl tracking-[0.3em] font-mono border-2 border-gray-300 rounded-xl py-5 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50 focus:bg-white transition-all shadow-inner mb-10 outline-none"
                      autoFocus
                    />

                    <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                      <button 
                        onClick={() => { setSetupStep(2); setMfaCode(""); }}
                        className="px-6 py-3.5 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors w-full sm:w-auto"
                        disabled={isVerifying}
                      >
                        戻る
                      </button>
                      <button 
                        onClick={handleVerifyTotp}
                        disabled={mfaCode.length !== 6 || isVerifying}
                        className="px-8 py-3.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-1 flex items-center justify-center"
                      >
                        {isVerifying ? <Loader2 className="h-5 w-5 animate-spin" /> : "設定を完了する"}
                      </button>
                    </div>
                  </div>
                )}

                {setupStep === 4 && (
                  <div className="text-center animate-fade-in py-6">
                    <div className="mx-auto w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-8 border-4 border-green-100">
                      <CheckCircle2 className="h-12 w-12 text-green-500" />
                    </div>
                    <h4 className="text-2xl font-extrabold text-gray-900 mb-4">設定が完了しました！</h4>
                    <p className="text-base text-gray-600 mb-10 leading-relaxed max-w-md mx-auto">
                      次回以降のログイン時に、登録したアプリから認証コードを入力することでより安全にログインできます。
                    </p>
                    <button 
                      onClick={handleCancelSetup}
                      className="px-8 py-4 bg-gray-900 text-white text-base font-bold rounded-xl hover:bg-black w-full max-w-sm mx-auto shadow-md transition-colors flex items-center justify-center"
                    >
                      画面を閉じる
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* メインコンテンツ (1カラム・全幅活用) */}
      <div className="max-w-5xl mx-auto space-y-10">
        
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center tracking-tight">
              マイアカウント
            </h1>
            <p className="mt-2 text-sm text-gray-500 font-medium">プロフィール情報の確認と、セキュリティ設定を行います。</p>
          </div>
          <button
            onClick={() => router.push("/top")}
            className="hidden sm:flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors bg-white px-4 py-2 border border-gray-200 rounded-lg shadow-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> トップに戻る
          </button>
        </div>

        {alert.show && (
          <div className={`p-4 rounded-xl text-sm font-bold flex items-center shadow-sm animate-fade-in ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {alert.type === "success" ? <CheckCircle2 className="mr-3 h-5 w-5 flex-shrink-0" /> : <AlertCircle className="mr-3 h-5 w-5 flex-shrink-0" />}
            {alert.message}
          </div>
        )}

        {/* 1. プロフィール情報 セクション */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-white">
            <h3 className="text-lg font-extrabold text-gray-900 flex items-center">
              <UserIcon className="mr-2 h-5 w-5 text-blue-600" />
              プロフィール情報
            </h3>
          </div>
          <div className="p-0">
            <dl className="divide-y divide-gray-100">
              <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center hover:bg-gray-50/50 transition-colors">
                <dt className="text-sm font-bold text-gray-500 sm:w-1/4 mb-1 sm:mb-0 flex items-center">氏名</dt>
                <dd className="text-base text-gray-900 font-bold sm:w-3/4">
                  {userData?.name || "未設定"} <span className="text-gray-400 font-medium text-sm ml-3">{userData?.nameKana || ""}</span>
                </dd>
              </div>
              <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center hover:bg-gray-50/50 transition-colors">
                <dt className="text-sm font-bold text-gray-500 sm:w-1/4 mb-1 sm:mb-0 flex items-center">メールアドレス</dt>
                <dd className="text-base text-gray-900 font-medium sm:w-3/4">{currentUser?.email}</dd>
              </div>
              <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center hover:bg-gray-50/50 transition-colors">
                <dt className="text-sm font-bold text-gray-500 sm:w-1/4 mb-1 sm:mb-0 flex items-center">所属テナント</dt>
                <dd className="text-base text-gray-900 font-medium sm:w-3/4">{tenantData?.name || "未設定"}</dd>
              </div>
              <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center hover:bg-gray-50/50 transition-colors">
                <dt className="text-sm font-bold text-gray-500 sm:w-1/4 mb-1 sm:mb-0 flex items-center">役職・権限</dt>
                <dd className="text-base text-gray-900 font-medium sm:w-3/4 flex items-center flex-wrap gap-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                    {userData?.role === "admin" ? "テナント管理者" : userData?.role === "system_admin" ? "システム特権" : userData?.role === "officer" ? "生徒会役員" : "一般生徒"}
                  </span>
                  {userData?.positionName && <span className="text-gray-700 font-bold">{userData.positionName}</span>}
                </dd>
              </div>
              <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center hover:bg-gray-50/50 transition-colors">
                <dt className="text-sm font-bold text-gray-500 sm:w-1/4 mb-1 sm:mb-0 flex items-center">電話番号</dt>
                <dd className="text-base text-gray-900 font-medium sm:w-3/4">{userData?.phoneNumber || "未登録"}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* 2. 2段階認証 (MFA) セクション */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-white flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-gray-900 flex items-center">
              <ShieldAlert className="mr-2 text-blue-600 h-5 w-5" />
              2段階認証 (MFA)
            </h3>
          </div>
          <div className="p-6 space-y-4">
            
            {/* パスキー (WebAuthn) カード */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-5 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex-1">
                <p className="text-base font-bold text-gray-900 mb-1 flex items-center">
                  <Fingerprint className="h-4 w-4 mr-1.5 text-gray-700" />
                  パスキー（生体認証）連携
                </p>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">
                  Touch IDやFace IDなど、端末の生体認証機能を使ってパスワードレスでより安全にログインできます。
                </p>
                <div className="flex items-center">
                  <span className="text-sm font-bold text-gray-900 mr-3">現在の状態:</span>
                  {userData?.passkeys && userData.passkeys.length > 0 ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                      {userData.passkeys.length}台の端末を登録済み
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-600">
                      未登録
                    </span>
                  )}
                </div>
              </div>
              
              <div className="w-full md:w-auto flex-shrink-0 flex flex-col md:flex-row gap-3">
                <button 
                  onClick={handleRegisterPasskey}
                  disabled={isSettingTotp || isProcessing}
                  className="w-full md:w-auto px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-gray-900 hover:bg-black focus:outline-none transition-colors"
                >
                  現在の端末を登録する
                </button>
                {userData?.passkeys && userData.passkeys.length > 0 && (
                  <button 
                    onClick={handleRemovePasskeys}
                    disabled={isProcessing}
                    className="w-full md:w-auto px-6 py-3 border border-red-200 rounded-xl shadow-sm text-sm font-bold text-red-600 bg-white hover:bg-red-50 focus:outline-none transition-colors"
                  >
                    連携を解除
                  </button>
                )}
              </div>
            </div>

            {/* 認証アプリ連携 カード */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-5 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex-1">
                <p className="text-base font-bold text-gray-900 mb-1 flex items-center">
                  <Scan className="h-4 w-4 mr-1.5 text-gray-700" />
                  認証アプリ連携 (TOTP)
                </p>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">
                  Google Authenticator等のアプリを登録することで、ログイン時に追加の認証を求め、アカウントの安全性を高めます。
                </p>
                <div className="flex items-center">
                  <span className="text-sm font-bold text-gray-900 mr-3">現在の状態:</span>
                  {userData?.totpSecret ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                      設定済み
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-600">
                      未設定
                    </span>
                  )}
                </div>
              </div>
              
              <div className="w-full md:w-auto flex-shrink-0 flex flex-col md:flex-row gap-3">
                {!userData?.totpSecret ? (
                  <button 
                    onClick={handleStartTotpSetup}
                    disabled={isSettingTotp || isProcessing}
                    className="w-full md:w-auto px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 focus:outline-none transition-colors"
                  >
                    アプリを設定する
                  </button>
                ) : (
                  <button 
                    onClick={handleRemoveTotp}
                    disabled={isProcessing}
                    className="w-full md:w-auto px-6 py-3 border border-red-200 rounded-xl shadow-sm text-sm font-bold text-red-600 bg-white hover:bg-red-50 focus:outline-none transition-colors"
                  >
                    連携を解除
                  </button>
                )}
              </div>
            </div>

          </div>
        </section>

        {/* 3. アカウント・通知連携 セクション */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-white flex items-center">
            <ShieldCheck className="mr-2 text-emerald-600 h-5 w-5" />
            <h3 className="text-lg font-extrabold text-gray-900">アカウント・通知連携</h3>
          </div>
          <div className="p-6">
            
            {/* ログイン連携グリッド */}
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

            {/* LINE通知連携セクション */}
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
                    {/* ステータスカード */}
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

                    {/* 通知ON/OFFトグル */}
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