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
import { startAuthentication } from "@simplewebauthn/browser";

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
  const [isVerifyingPasskey, setIsVerifyingPasskey] = useState(false);
  
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
      setMfaState({
        isRequired: true,
        uid: userCredential.user.uid,
        userData: finalUserData,
        isSystemAdmin,
        availableMethods: allowedMfaMethods,
        selectedMethod: "" // 最初は空にして選択画面を表示させる
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

  const selectMfaMethod = async (method: string) => {
    if (!mfaState) return;
    setAlert({ show: false, type: "success", message: "" });
    setMfaCode("");
    setMfaState({ ...mfaState, selectedMethod: method });
    
    if (method === "email") {
      setIsLoading(true);
      try {
        await generateAndSendEmailOTP(mfaState.uid, mfaState.userData.email);
        showAlert("success", "認証コードをメールで送信しました。");
      } catch (e: any) {
        showAlert("error", e.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // パスキー認証処理
  const handlePasskeyAuth = async () => {
    if (!mfaState || !mfaState.uid) {
      showAlert("error", "ユーザー情報が特定できません。もう一度ログインし直してください。");
      return;
    }
    setAlert({ show: false, type: "success", message: "" });
    setIsVerifyingPasskey(true);

    try {
      // uidが確実に文字列であることを保証する
      const targetUid = String(mfaState.uid);
      console.log("Sending UID for Auth Options:", targetUid);
      
      const optionsResp = await fetch('/api/webauthn/auth-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: targetUid })
      });
      
      const optionsJSON = await optionsResp.json();
      
      if (!optionsResp.ok) {
        console.error("Server Error details:", optionsJSON);
        throw new Error(optionsJSON.error || "認証オプションの取得に失敗しました");
      }

      const asseResp = await startAuthentication({ optionsJSON });

      const verifyResp = await fetch('/api/webauthn/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: targetUid, response: asseResp })
      });
      
      const verifyResult = await verifyResp.json();
      if (!verifyResp.ok) throw new Error(verifyResult.error || "検証に失敗しました");

      handlePostLogin(targetUid, mfaState.userData, mfaState.isSystemAdmin);

    } catch (error: any) {
      console.error("Passkey auth error:", error);
      if (error.name === "NotAllowedError" || error.message?.includes("timed out") || error.message?.includes("not allowed")) {
         showAlert("error", "生体認証がキャンセルされました。");
      } else {
         showAlert("error", error.message || "パスキー認証に失敗しました。");
      }
    } finally {
      setIsVerifyingPasskey(false);
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

  // --- MFA 入力・選択画面のレンダリング ---
  if (mfaState?.isRequired) {
    const isMethodSelected = mfaState.selectedMethod !== "";
    const isEmail = mfaState.selectedMethod === "email";
    const isTotp = mfaState.selectedMethod === "totp";
    const isPasskey = mfaState.selectedMethod === "passkey";
    const needsTotpSetup = isTotp && !mfaState.userData.totpSecret;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <ShieldCheck className="h-12 w-12 text-blue-600 drop-shadow-sm" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">2段階認証</h2>
          <p className="text-sm text-gray-500 font-medium mt-2">
            {!isMethodSelected ? "認証方法を選択してください。" : "安全のため、本人確認を行ってください。"}
          </p>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white py-8 px-4 sm:px-10 shadow-xl shadow-gray-200/50 rounded-2xl border border-gray-100">
          
          {alert.show && (
            <div className={`mb-6 p-4 rounded-lg text-sm font-bold flex items-start shadow-sm animate-fade-in ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
              <span className="block">{alert.message}</span>
            </div>
          )}

          {!isMethodSelected ? (
            <div className="space-y-4">
              {mfaState.availableMethods.includes("passkey") && (
                <button 
                  onClick={() => selectMfaMethod("passkey")} 
                  disabled={isLoading}
                  className="w-full flex items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-300 transition-all group disabled:opacity-50"
                >
                  <div className="bg-blue-50 p-3 rounded-lg group-hover:bg-blue-100 transition-colors mr-4">
                    <Fingerprint className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900">パスキー</p>
                    <p className="text-xs text-gray-500 mt-1">端末の生体認証（指紋・顔）を利用します</p>
                  </div>
                </button>
              )}

              {mfaState.availableMethods.includes("totp") && (
                <button 
                  onClick={() => selectMfaMethod("totp")} 
                  disabled={isLoading}
                  className="w-full flex items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-300 transition-all group disabled:opacity-50"
                >
                  <div className="bg-blue-50 p-3 rounded-lg group-hover:bg-blue-100 transition-colors mr-4">
                    <ScanLine className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900">認証アプリ</p>
                    <p className="text-xs text-gray-500 mt-1">Google Authenticator等を使用します</p>
                  </div>
                </button>
              )}

              {mfaState.availableMethods.includes("email") && (
                <button 
                  onClick={() => selectMfaMethod("email")} 
                  disabled={isLoading}
                  className="w-full flex items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-300 transition-all group disabled:opacity-50"
                >
                  <div className="bg-blue-50 p-3 rounded-lg group-hover:bg-blue-100 transition-colors mr-4">
                    <Mail className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900">メールアドレス</p>
                    <p className="text-xs text-gray-500 mt-1">登録済みのメールにコードを送信します</p>
                  </div>
                </button>
              )}

              {mfaState.availableMethods.includes("sms") && (
                <button 
                  onClick={() => selectMfaMethod("sms")} 
                  disabled={isLoading}
                  className="w-full flex items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-300 transition-all group disabled:opacity-50"
                >
                  <div className="bg-blue-50 p-3 rounded-lg group-hover:bg-blue-100 transition-colors mr-4">
                    <Smartphone className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900">SMS認証</p>
                    <p className="text-xs text-gray-500 mt-1">登録済みの電話番号にコードを送信します</p>
                  </div>
                </button>
              )}
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleMfaSubmit}>
              
              {/* パスキー認証の場合のUI */}
              {isPasskey && (
                <div className="text-center animate-fade-in space-y-4 py-4">
                  <Fingerprint className="h-14 w-14 text-blue-600 mx-auto" />
                  <p className="text-sm font-bold text-gray-900">生体認証（パスキー）</p>
                  <p className="text-xs text-gray-500 px-4">
                    この端末に登録されている指紋・顔認証やPINコードを使用して安全にログインします。
                  </p>
                  <button
                    type="button"
                    onClick={handlePasskeyAuth}
                    disabled={isVerifyingPasskey}
                    className="mt-6 w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white transition-all bg-blue-600 hover:bg-blue-700"
                  >
                    {isVerifyingPasskey ? <Loader2 className="animate-spin h-5 w-5" /> : "生体認証を起動する"}
                  </button>
                </div>
              )}

              {/* メールまたはTOTP認証の場合のUI */}
              {(isEmail || isTotp) && (
                <>
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
                      required={!isPasskey}
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
                </>
              )}

              <div className="mt-4 text-center">
                <button 
                  type="button" 
                  onClick={() => setMfaState({ ...mfaState, selectedMethod: "" })} 
                  className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  他の認証方法を選ぶ
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center border-t border-gray-100 pt-6">
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