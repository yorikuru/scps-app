"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  AuthProvider,
  signOut
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  updateDoc,
  collection, 
  query, 
  where, 
  getDocs 
} from "firebase/firestore";
import { 
  auth, 
  db, 
  googleProvider, 
  microsoftProvider 
} from "@/lib/firebase";

import { 
  Mail, 
  Key, 
  Loader2, 
  Building, 
  IdCard, 
  LogIn, 
  ShieldCheck, 
  Smartphone,
  Fingerprint,
  ArrowLeft,
  ScanLine
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

type MfaState = {
  isRequired: boolean;
  uid: string;
  userData: any;
  isSystemAdmin: boolean;
  availableMethods: string[];
  selectedMethod: string;
};

export default function LoginPage() {
  const router = useRouter();
  
  const [loginMode, setLoginMode] = useState<"email" | "system">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>({ show: false, type: "success", message: "" });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [systemId, setSystemId] = useState("");

  const [mfaState, setMfaState] = useState<MfaState | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  
  // TOTP(認証アプリ)の初回セットアップ用データ
  const [totpSetupData, setTotpSetupData] = useState<{ secret: string, uri: string } | null>(null);

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert((prev) => ({ ...prev, show: false })), 7000);
  };

  const getClientIp = async (): Promise<string> => {
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const data = await res.json();
      return data.ip;
    } catch (error) {
      console.warn("IPアドレスの取得に失敗しました", error);
      return "";
    }
  };

  const generateAndSendEmailOTP = async (uid: string, userEmail: string) => {
    try {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      const code = (array[0] % 90000000 + 10000000).toString();
      
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        mfaTempCode: code,
        mfaExpiresAt: expiresAt.toISOString()
      });

      const res = await fetch("/api/send-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, code }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "メールの送信に失敗しました。");
      }

    } catch (error: any) {
      console.error("OTP送信エラー:", error);
      throw new Error(error.message || "認証コードの生成・送信に失敗しました。");
    }
  };

  const checkUserAndTenantSettings = async (uid: string, providerId: string, bypassTenantCheck = false) => {
    try {
      const userDocRef = doc(db, "users", uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) throw new Error("ユーザー情報が見つかりません。");
      const userData = userDoc.data();
      
      if (userData.role === "system_admin") {
        return { isSystemAdmin: true, userData, isMfaRequired: false, allowedMfaMethods: [], isSafeIpSkipped: false };
      }

      if (bypassTenantCheck) {
        return { isSystemAdmin: false, userData, isMfaRequired: false, allowedMfaMethods: [], isSafeIpSkipped: false };
      }

      const schoolId = userData.schoolId;
      if (!schoolId) throw new Error("所属するテナントが設定されていません。");

      const schoolDocRef = doc(db, "schools", schoolId);
      const schoolDoc = await getDoc(schoolDocRef);
      if (!schoolDoc.exists()) throw new Error("所属するテナントが見つかりません。");

      const schoolData = schoolDoc.data();
      
      const allowedProviders = schoolData.allowedAuthProviders || ["password"]; 
      let currentProviderType = "password";
      if (providerId === "google.com") currentProviderType = "google";
      if (providerId === "microsoft.com") currentProviderType = "microsoft";

      if (!allowedProviders.includes(currentProviderType) && !allowedProviders.includes("all")) {
        throw new Error(`この組織では ${currentProviderType} によるログインは許可されていません。`);
      }

      let isMfaRequired = false;
      let isSafeIpSkipped = false;
      const allowedMfaMethods = schoolData.allowedMfaMethods || ["email"];
      
      if (userData.accountStatus !== "unaccessed") {
        const clientIp = await getClientIp();
        const safeIps: string[] = schoolData.safeIps || [];
        const isSafeIp = safeIps.includes(clientIp);

        const tenantRequiresMfa = schoolData.requireMfa === true;
        const userRequiresMfa = userData.requireMfa === true;

        if (tenantRequiresMfa || userRequiresMfa) {
          if (isSafeIp) {
            isSafeIpSkipped = true;
          } else {
            isMfaRequired = true;
          }
        }
      }

      return { isSystemAdmin: false, userData, isMfaRequired, allowedMfaMethods, isSafeIpSkipped };

    } catch (error: any) {
      await signOut(auth);
      throw error;
    }
  };

  const handlePostLogin = (uid: string, userData: any, isSystemAdmin: boolean) => {
    showAlert("success", "認証に成功しました。移動します...");
    setTimeout(() => {
      if (userData.accountStatus === "unaccessed") {
        router.push(`/password-reset?uid=${uid}`);
      } else if (isSystemAdmin) {
        router.push("/system-admin");
      } else {
        router.push("/top");
      }
    }, 1000);
  };

  const processLoginFlow = async (userCredential: any, currentProviderType: string, userDataParam?: any) => {
    const { isSystemAdmin, userData, isMfaRequired, allowedMfaMethods, isSafeIpSkipped } = await checkUserAndTenantSettings(userCredential.user.uid, currentProviderType);
    const finalUserData = userDataParam || userData;

    if (isMfaRequired) {
      const selectedMethod = allowedMfaMethods.includes("email") ? "email" : allowedMfaMethods[0];
      
      if (selectedMethod === "email") {
        await generateAndSendEmailOTP(userCredential.user.uid, finalUserData.email);
      }

      setMfaState({
        isRequired: true,
        uid: userCredential.user.uid,
        userData: finalUserData,
        isSystemAdmin,
        availableMethods: allowedMfaMethods,
        selectedMethod: selectedMethod
      });
      setIsLoading(false);
      showAlert("success", "セキュリティ保護のため、追加認証が必要です。");
      return;
    }

    if (isSafeIpSkipped) {
      showAlert("success", "許可されたネットワークからのアクセスのため、2段階認証をスキップしました。");
      setTimeout(() => {
        handlePostLogin(userCredential.user.uid, finalUserData, isSystemAdmin);
      }, 1500);
    } else {
      handlePostLogin(userCredential.user.uid, finalUserData, isSystemAdmin);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert({ show: false, type: "success", message: "" });
    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await processLoginFlow(userCredential, "password");
    } catch (error: any) {
      let errorMsg = "ログインに失敗しました。";
      if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        errorMsg = "メールアドレスまたはパスワードが間違っています。";
      }
      showAlert("error", errorMsg);
      setIsLoading(false);
    } 
  };

  const handleSystemLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert({ show: false, type: "success", message: "" });
    setIsLoading(true);

    try {
      const fullTenantId = `SCPS-${tenantId}`;
      const schoolQ = query(collection(db, "schools"), where("schoolCode", "==", fullTenantId));
      const schoolSnap = await getDocs(schoolQ);
      if (schoolSnap.empty) throw new Error("テナントIDが無効です。");
      
      const schoolId = schoolSnap.docs[0].id;
      const userQ = query(collection(db, "users"), where("schoolId", "==", schoolId), where("systemId", "==", systemId));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty) throw new Error("システム利用番号またはパスワードが違います。");
      
      const userDoc = userSnap.docs[0];
      const userData = userDoc.data();

      if (userData.accountStatus === "unaccessed") {
        if (userData.initialPassword !== password) throw new Error("システム利用番号または初期パスワードが違います。");
        handlePostLogin(userDoc.id, userData, false);
      } else {
        if (!userData.email) throw new Error("このアカウントはメールアドレスが登録されていません。");
        const userCredential = await signInWithEmailAndPassword(auth, userData.email, password);
        await processLoginFlow(userCredential, "password", userData);
      }
    } catch (error: any) {
      let errorMsg = error.message || "ログインに失敗しました。";
      if (error.code === "auth/invalid-credential") errorMsg = "パスワードが間違っています。";
      showAlert("error", errorMsg);
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: AuthProvider) => {
    setAlert({ show: false, type: "success", message: "" });
    setIsLoading(true);
    try {
      const userCredential = await signInWithPopup(auth, provider);
      await processLoginFlow(userCredential, provider.providerId);
    } catch (error: any) {
      let errorMsg = "ソーシャルログインに失敗しました。";
      if (error.code === "auth/popup-closed-by-user") errorMsg = "ログイン画面が閉じられました。";
      showAlert("error", errorMsg);
      setIsLoading(false);
    } 
  };

  // TOTP設定情報の取得
  useEffect(() => {
    if (mfaState?.selectedMethod === 'totp' && !mfaState.userData.totpSecret && !totpSetupData) {
      const fetchTotp = async () => {
        try {
          const res = await fetch('/api/totp/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email: mfaState.userData.email })
          });
          const data = await res.json();
          if (res.ok) setTotpSetupData(data);
          else throw new Error(data.error);
        } catch (error) {
          showAlert('error', '認証アプリの設定準備に失敗しました。');
        }
      };
      fetchTotp();
    }
  }, [mfaState?.selectedMethod]);

  const changeMfaMethod = async (method: string) => {
    if (!mfaState) return;
    setMfaCode("");
    setMfaState({ ...mfaState, selectedMethod: method });
    
    if (method === "email") {
      setIsLoading(true);
      try {
        await generateAndSendEmailOTP(mfaState.uid, mfaState.userData.email);
        showAlert("success", "新しい認証コードをメールで送信しました。");
      } catch (e: any) {
        showAlert("error", e.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaState) return;
    setAlert({ show: false, type: "success", message: "" });
    setIsLoading(true);

    try {
      if (mfaState.selectedMethod === "email") {
        const userDocRef = doc(db, "users", mfaState.uid);
        const userDoc = await getDoc(userDocRef);
        const data = userDoc.data();

        if (!data || !data.mfaTempCode || !data.mfaExpiresAt) throw new Error("認証コードが無効です。もう一度やり直してください。");
        if (new Date() > new Date(data.mfaExpiresAt)) throw new Error("認証コードの有効期限が切れています。");
        if (data.mfaTempCode !== mfaCode) throw new Error("認証コードが正しくありません。");

        await updateDoc(userDocRef, { mfaTempCode: null, mfaExpiresAt: null });
        handlePostLogin(mfaState.uid, mfaState.userData, mfaState.isSystemAdmin);

      } else if (mfaState.selectedMethod === "totp") {
        const secretToVerify = mfaState.userData.totpSecret || totpSetupData?.secret;
        if (!secretToVerify) throw new Error("認証情報が見つかりません。");

        const res = await fetch('/api/totp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: mfaCode, secret: secretToVerify })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "認証コードが正しくありません。");
        }

        // 初回セットアップの場合はFirestoreにシークレットキーを保存
        if (!mfaState.userData.totpSecret) {
          const userDocRef = doc(db, "users", mfaState.uid);
          await updateDoc(userDocRef, { totpSecret: secretToVerify });
          mfaState.userData.totpSecret = secretToVerify;
        }

        handlePostLogin(mfaState.uid, mfaState.userData, mfaState.isSystemAdmin);

      } else {
        throw new Error("この認証方法は現在準備中です。");
      }
    } catch (error: any) {
      showAlert("error", error.message);
      setIsLoading(false);
    }
  };

  const cancelMfa = async () => {
    await signOut(auth);
    setMfaState(null);
    setMfaCode("");
    setTotpSetupData(null);
    setAlert({ show: false, type: "success", message: "" });
  };

  // --- MFA 入力画面のレンダリング ---
  if (mfaState?.isRequired) {
    const isEmail = mfaState.selectedMethod === "email";
    const isTotp = mfaState.selectedMethod === "totp";
    const needsTotpSetup = isTotp && !mfaState.userData.totpSecret;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <ShieldCheck className="h-12 w-12 text-blue-600 drop-shadow-sm" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">2段階認証</h2>
          <p className="text-sm text-gray-500 font-medium mt-2">安全のため、本人確認を行ってください。</p>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white py-8 px-4 sm:px-10 shadow-xl shadow-gray-200/50 rounded-2xl border border-gray-100">
          
          {alert.show && (
            <div className={`mb-6 p-4 rounded-lg text-sm font-bold flex items-start shadow-sm animate-fade-in ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
              <span className="block">{alert.message}</span>
            </div>
          )}

          {mfaState.availableMethods.length > 1 && (
            <div className="mb-6 flex gap-2 justify-center">
              {mfaState.availableMethods.includes("email") && (
                <button onClick={() => changeMfaMethod("email")} className={`p-2 rounded-lg border ${isEmail ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`} title="メール認証"><Mail className="h-5 w-5" /></button>
              )}
              {mfaState.availableMethods.includes("totp") && (
                <button onClick={() => changeMfaMethod("totp")} className={`p-2 rounded-lg border ${isTotp ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`} title="認証アプリ"><ScanLine className="h-5 w-5" /></button>
              )}
              {mfaState.availableMethods.includes("sms") && (
                <button onClick={() => changeMfaMethod("sms")} className={`p-2 rounded-lg border ${mfaState.selectedMethod === "sms" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`} title="SMS認証"><Smartphone className="h-5 w-5" /></button>
              )}
              {mfaState.availableMethods.includes("passkey") && (
                <button onClick={() => changeMfaMethod("passkey")} className={`p-2 rounded-lg border ${mfaState.selectedMethod === "passkey" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`} title="パスキー"><Fingerprint className="h-5 w-5" /></button>
              )}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleMfaSubmit}>
            
            {needsTotpSetup && totpSetupData && (
              <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200 text-center animate-fade-in">
                <p className="text-sm font-bold text-gray-800 mb-2">認証アプリの初回設定</p>
                <p className="text-xs text-gray-500 mb-4">Google Authenticator等のアプリでQRコードを読み取ってください。</p>
                <div className="flex justify-center mb-4 bg-white p-2 rounded-lg inline-block border border-gray-200 shadow-sm">
                  <QRCodeSVG value={totpSetupData.uri} size={150} level="M" />
                </div>
                <p className="text-xs text-gray-400 font-mono">キー: {totpSetupData.secret}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 text-center">
                {isEmail ? "メールで受信した8桁のコード" : "アプリに表示された6桁のコード"}
              </label>
              <input 
                type="text" 
                required 
                maxLength={isEmail ? 8 : 6}
                value={mfaCode} 
                onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                className={`block w-full text-center tracking-[0.2em] font-mono border border-gray-300 rounded-lg py-4 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-gray-50 focus:bg-white ${isEmail ? 'text-3xl' : 'text-4xl'}`} 
                placeholder={isEmail ? "00000000" : "000000"} 
              />
              {isEmail && (
                <p className="text-xs text-center text-gray-500 mt-3 font-medium">
                  {mfaState.userData.email.replace(/(.{2})(.*)(?=@)/, "$1***")} 宛に送信しました
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || (isEmail ? mfaCode.length !== 8 : mfaCode.length !== 6)}
              className={`w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white transition-all ${
                isLoading || (isEmail ? mfaCode.length !== 8 : mfaCode.length !== 6) ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              }`}
            >
              {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : (needsTotpSetup ? "設定して認証する" : "認証する")}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={cancelMfa} className="inline-flex items-center text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">
              <ArrowLeft className="h-4 w-4 mr-1" /> ログイン画面に戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- 通常のログイン画面 ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <div className="flex items-center justify-center mb-2">
          <img 
            src="/icon.png" 
            alt="SCPS Icon" 
            className="h-10 w-10 object-cover rounded-full shadow-sm mr-3 border border-gray-200" 
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">生徒会ポータルシステム</h2>
        </div>
        <p className="text-sm text-gray-500 font-medium">ポータルへようこそ</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white py-8 px-4 sm:px-10 shadow-xl shadow-gray-200/50 rounded-2xl border border-gray-100">
        
        {alert.show && (
          <div className={`mb-6 p-4 rounded-lg text-sm font-bold flex items-start shadow-sm animate-fade-in ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            <span className="block">{alert.message}</span>
          </div>
        )}

        <div className="flex mb-8 bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => { setLoginMode("email"); setAlert({ show: false, type: "success", message: "" }); }} 
            className={`flex-1 py-2.5 text-sm font-bold rounded-md transition-all flex items-center justify-center ${loginMode === "email" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Mail className="h-4 w-4 mr-2" /> メールアドレス
          </button>
          <button 
            onClick={() => { setLoginMode("system"); setAlert({ show: false, type: "success", message: "" }); }} 
            className={`flex-1 py-2.5 text-sm font-bold rounded-md transition-all flex items-center justify-center ${loginMode === "system" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <IdCard className="h-4 w-4 mr-2" /> 組織ID
          </button>
        </div>

        {loginMode === "email" ? (
          <form className="space-y-5" onSubmit={handleEmailLogin}>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">メールアドレス</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)} 
                  className="block w-full pl-10 border border-gray-300 rounded-lg py-3 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-shadow bg-gray-50 focus:bg-white" 
                  placeholder="you@example.com" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">パスワード</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)} 
                  className="block w-full pl-10 border border-gray-300 rounded-lg py-3 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-shadow bg-gray-50 focus:bg-white" 
                  placeholder="••••••••" 
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white transition-all ${
                isLoading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              }`}
            >
              {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <><LogIn className="h-5 w-5 mr-2" /> ログイン</>}
            </button>
          </form>
        ) : (
          <form className="space-y-5" onSubmit={handleSystemLogin}>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">テナントID (学校コード)</label>
              <div className="flex rounded-md shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-100 text-gray-500 font-bold sm:text-sm font-mono">
                  <Building className="h-4 w-4 mr-2 text-gray-400" />
                  SCPS-
                </span>
                <input 
                  type="text" 
                  required 
                  value={tenantId} 
                  onChange={(e) => setTenantId(e.target.value.replace(/[^0-9]/g, ''))}
                  className="flex-1 block w-full min-w-0 rounded-none rounded-r-lg border border-gray-300 py-3 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono transition-shadow bg-gray-50 focus:bg-white" 
                  placeholder="00000000" 
                  maxLength={10}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">システム利用番号</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <IdCard className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="text" required value={systemId} onChange={(e) => setSystemId(e.target.value)} 
                  className="block w-full pl-10 border border-gray-300 rounded-lg py-3 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono transition-shadow bg-gray-50 focus:bg-white" 
                  placeholder="STU0001" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">パスワード</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)} 
                  className="block w-full pl-10 border border-gray-300 rounded-lg py-3 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-shadow bg-gray-50 focus:bg-white" 
                  placeholder="••••••••" 
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white transition-all ${
                isLoading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              }`}
            >
              {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <><LogIn className="h-5 w-5 mr-2" /> ログイン</>}
            </button>
          </form>
        )}

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-gray-400 font-bold text-xs tracking-wider">または連携アカウントでログイン</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3">
            <button
              onClick={() => handleSocialLogin(googleProvider)}
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google でログイン
            </button>

            <button
              onClick={() => handleSocialLogin(microsoftProvider)}
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              <svg className="h-5 w-5 mr-3" viewBox="0 0 21 21">
                <path d="M0 0h10v10H0z" fill="#f25022"/><path d="M11 0h10v10H11z" fill="#7fba00"/><path d="M0 11h10v10H0z" fill="#00a4ef"/><path d="M11 11h10v10H11z" fill="#ffb900"/>
              </svg>
              Microsoft でログイン
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}