"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  AuthProvider,
  signOut
} from "firebase/auth";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db, googleProvider, microsoftProvider } from "@/lib/firebase";
import { ArrowLeft } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";

import LoginForm from "./components/LoginForm";
import MfaSelection from "./components/MfaSelection";
import MfaVerification from "./components/MfaVerification";

type AlertState = { show: boolean; type: "success" | "error"; message: string; };
type MfaState = { isRequired: boolean; uid: string; userData: any; isSystemAdmin: boolean; availableMethods: string[]; selectedMethod: string; };

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

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert((prev) => ({ ...prev, show: false })), 6000);
  };

  // IPv6とIPv4の両方に完全対応したAPIを使用
  const getClientIp = async (): Promise<string> => {
    try {
      const res = await fetch("https://api64.ipify.org?format=json");
      const data = await res.json();
      return data.ip;
    } catch {
      return "";
    }
  };

  const generateAndSendEmailOTP = async (uid: string, userEmail: string) => {
    try {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      const code = (array[0] % 90000000 + 10000000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      
      await updateDoc(doc(db, "users", uid), {
        mfaTempCode: code,
        mfaExpiresAt: expiresAt.toISOString()
      });

      const res = await fetch("/api/send-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, code }),
      });
      if (!res.ok) throw new Error();
    } catch {
      throw new Error("メールの送信に失敗しました。");
    }
  };

  const checkUserAndTenantSettings = async (uid: string, providerId: string) => {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (!userDoc.exists()) throw new Error("ユーザー情報が見つかりません。");
    const userData = userDoc.data();
    
    if (userData.role === "system_admin") {
      return { isSystemAdmin: true, userData, isMfaRequired: false, isSafeIpSkipped: false, allowedMfaMethods: [] };
    }

    const schoolDoc = await getDoc(doc(db, "schools", userData.schoolId));
    if (!schoolDoc.exists()) throw new Error("組織データがありません。");
    const schoolData = schoolDoc.data();

    let isMfaRequired = false;
    let isSafeIpSkipped = false;
    const allowedMfaMethods = schoolData.allowedMfaMethods || ["email"];
    
    if (userData.accountStatus !== "unaccessed") {
      // 取得したIPと登録IPを小文字化・空白除去して厳密に比較する
      const rawClientIp = await getClientIp();
      const clientIp = rawClientIp.trim().toLowerCase();
      
      const safeIps: string[] = schoolData.safeIps || [];
      const safeNetworkIps = Array.isArray(schoolData.safeNetworks) ? schoolData.safeNetworks.map((n: any) => n.ip) : [];
      
      // 統合してすべて小文字・空白除去で統一
      const allSafeIps = [...safeIps, ...safeNetworkIps].map(ip => ip.trim().toLowerCase());
      
      console.log("--- IP Verification Debug ---");
      console.log("Current Client IP:", clientIp);
      console.log("Registered Safe IPs:", allSafeIps);
      
      const isSafeIp = allSafeIps.includes(clientIp) && clientIp !== "";
      
      const tenantRequiresMfa = schoolData.requireMfa === true;
      const userRequiresMfa = userData.requireMfa === true;

      if (tenantRequiresMfa || userRequiresMfa) {
        if (isSafeIp) {
          isSafeIpSkipped = true;
          console.log("MATCH! Skipping 2FA...");
        } else {
          isMfaRequired = true;
          console.log("NO MATCH. 2FA is required.");
        }
      }
    }

    return { isSystemAdmin: false, userData, isMfaRequired, allowedMfaMethods, isSafeIpSkipped };
  };

  const handlePostLogin = (uid: string, userData: any, isSystemAdmin: boolean) => {
    showAlert("success", "ログインに成功しました。移動します...");
    setTimeout(() => {
      if (userData.accountStatus === "unaccessed") {
        router.push(`/password-reset?uid=${uid}`);
      } else {
        router.push(isSystemAdmin ? "/system-admin" : "/top");
      }
    }, 1000);
  };

  const processLoginFlow = async (userCredential: any, currentProviderType: string, userDataParam?: any) => {
    try {
      const { isSystemAdmin, userData, isMfaRequired, allowedMfaMethods, isSafeIpSkipped } = await checkUserAndTenantSettings(userCredential.user.uid, currentProviderType);
      const finalUserData = userDataParam || userData;

      if (isSafeIpSkipped) {
        showAlert("success", "学校内（許可済み）ネットワークからのアクセスのため、2段階認証を自動的にスキップしました。");
        setTimeout(() => handlePostLogin(userCredential.user.uid, finalUserData, isSystemAdmin), 1500);
        return;
      }

      if (isMfaRequired) {
        setMfaState({
          isRequired: true, uid: userCredential.user.uid, userData: finalUserData,
          isSystemAdmin, availableMethods: allowedMfaMethods, selectedMethod: ""
        });
        setIsLoading(false);
        return;
      }

      handlePostLogin(userCredential.user.uid, finalUserData, isSystemAdmin);
    } catch (e: any) {
      showAlert("error", e.message || "ログイン処理に失敗しました。");
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await processLoginFlow(userCredential, "password");
    } catch {
      showAlert("error", "メールアドレスまたはパスワードが間違っています。");
      setIsLoading(false);
    }
  };

  const handleSystemLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const schoolQ = query(collection(db, "schools"), where("schoolCode", "==", `SCPS-${tenantId}`));
      const schoolSnap = await getDocs(schoolQ);
      if (schoolSnap.empty) throw new Error("テナントIDが無効です。");
      
      const schoolId = schoolSnap.docs[0].id;
      const userQ = query(collection(db, "users"), where("schoolId", "==", schoolId), where("systemId", "==", systemId));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty) throw new Error("利用番号またはパスワードが違います。");
      
      const userDoc = userSnap.docs[0];
      const userData = userDoc.data();

      if (userData.accountStatus === "unaccessed") {
        if (userData.initialPassword !== password) throw new Error("利用番号または初期パスワードが違います。");
        handlePostLogin(userDoc.id, userData, false);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, userData.email, password);
        await processLoginFlow(userCredential, "password", userData);
      }
    } catch (err: any) {
      showAlert("error", err.message || "ログイン失敗");
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: AuthProvider) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithPopup(auth, provider);
      await processLoginFlow(userCredential, provider.providerId);
    } catch {
      showAlert("error", "外部連携ログインがキャンセルされました。");
      setIsLoading(false);
    }
  };

  const selectMfaMethod = async (method: string) => {
    if (!mfaState) return;
    setMfaCode("");
    setMfaState({ ...mfaState, selectedMethod: method });
    if (method === "email") {
      setIsLoading(true);
      try {
        await generateAndSendEmailOTP(mfaState.uid, mfaState.userData.email);
        showAlert("success", "認証コードを送信しました。");
      } catch (e: any) {
        showAlert("error", e.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handlePasskeyAuth = async () => {
    if (!mfaState) return;
    setIsVerifyingPasskey(true);
    try {
      const targetUid = String(mfaState.uid);
      const optionsResp = await fetch('/api/webauthn/auth-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: targetUid })
      });
      const optionsJSON = await optionsResp.json();
      if (!optionsResp.ok) throw new Error(optionsJSON.error || "鍵オプション生成失敗");

      const asseResp = await startAuthentication({ optionsJSON });
      const verifyResp = await fetch('/api/webauthn/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: targetUid, response: asseResp })
      });
      if (!verifyResp.ok) throw new Error();

      handlePostLogin(targetUid, mfaState.userData, mfaState.isSystemAdmin);
    } catch {
      showAlert("error", "生体認証ポップアップが閉じられたか、認証に失敗しました。");
    } finally {
      setIsVerifyingPasskey(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaState) return;
    setIsLoading(true);
    try {
      if (mfaState.selectedMethod === "email") {
        const userDoc = await getDoc(doc(db, "users", mfaState.uid));
        const data = userDoc.data();
        if (data?.mfaTempCode !== mfaCode || new Date() > new Date(data?.mfaExpiresAt)) {
          throw new Error("コードが正しくないか、有効期限切れです。");
        }
        await updateDoc(doc(db, "users", mfaState.uid), { mfaTempCode: null, mfaExpiresAt: null });
        handlePostLogin(mfaState.uid, mfaState.userData, mfaState.isSystemAdmin);
        
      } else if (mfaState.selectedMethod === "totp") {
        if (!mfaState.userData.totpSecret) {
          throw new Error("認証アプリが設定されていません。");
        }
        const res = await fetch('/api/totp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: mfaCode, secret: mfaState.userData.totpSecret })
        });
        
        if (!res.ok) throw new Error("認証コードが一致しません。");
        handlePostLogin(mfaState.uid, mfaState.userData, mfaState.isSystemAdmin);
      }
    } catch (err: any) {
      showAlert("error", err.message || "検証エラー");
    } finally {
      setIsLoading(false);
    }
  };

  const cancelMfa = async () => {
    await signOut(auth);
    setMfaState(null); 
    setMfaCode(""); 
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-blue-50/30 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        {/* ロゴ画像を復活 */}
        <div className="flex items-center justify-center mb-4">
          <img 
            src="/icon.png" 
            alt="SCPS Icon" 
            className="h-14 w-14 object-cover rounded-full shadow-sm border border-gray-200" 
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">生徒会ポータルシステム</h2>
        <p className="text-xs text-gray-400 font-bold mt-1.5 uppercase tracking-widest">Student Council Portal System</p>
      </div>

      <div className="w-full sm:max-w-md mx-auto relative z-10">
        {alert.show && (
          <div className={`mb-4 p-4 rounded-xl text-xs font-bold shadow-sm flex items-center border animate-fade-in ${alert.type === "success" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"}`}>
            {alert.message}
          </div>
        )}

        {mfaState?.isRequired ? (
          <div className="bg-white/90 backdrop-blur-md py-8 px-4 sm:px-10 shadow-xl shadow-gray-200/60 rounded-2xl border border-gray-100/90">
            {!mfaState.selectedMethod ? (
              <MfaSelection availableMethods={mfaState.availableMethods} userData={mfaState.userData} isLoading={isLoading} selectMfaMethod={selectMfaMethod} />
            ) : (
              <MfaVerification selectedMethod={mfaState.selectedMethod} mfaCode={mfaCode} setMfaCode={setMfaCode} userData={mfaState.userData} isLoading={isLoading} isVerifyingPasskey={isVerifyingPasskey} handleMfaSubmit={handleMfaSubmit} handlePasskeyAuth={handlePasskeyAuth} setMfaState={setMfaState} />
            )}
            <div className="mt-6 text-center border-t border-gray-100 pt-5">
              <button onClick={cancelMfa} className="inline-flex items-center text-xs font-bold text-gray-400 hover:text-gray-700 transition-colors">
                <ArrowLeft className="h-4 w-4 mr-1" /> ログイン画面に戻る
              </button>
            </div>
          </div>
        ) : (
          <LoginForm loginMode={loginMode} setLoginMode={setLoginMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} tenantId={tenantId} setTenantId={setTenantId} systemId={systemId} setSystemId={setSystemId} isLoading={isLoading} handleEmailLogin={handleEmailLogin} handleSystemLogin={handleSystemLogin} handleSocialLogin={handleSocialLogin} googleProvider={googleProvider} microsoftProvider={microsoftProvider} />
        )}
      </div>
    </div>
  );
}