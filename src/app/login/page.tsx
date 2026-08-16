// src/app/login/page.tsx
"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  AuthProvider,
  signOut
} from "firebase/auth";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db, googleProvider, microsoftProvider } from "@/lib/firebase";
import { ArrowLeft, ScanLine, QrCode, UserCheck } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";

import LoginForm from "./components/LoginForm";
import MfaSelection from "./components/MfaSelection";
import MfaVerification from "./components/MfaVerification";
import ScCodeScannerModal from "./components/ScCodeScannerModal";

type AlertState = { show: boolean; type: "success" | "error"; message: string; };
type MfaState = { isRequired: boolean; uid: string; userData: any; isSystemAdmin: boolean; availableMethods: string[]; selectedMethod: string; };

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  // SCコードスキャンモーダルの開閉管理
  const [isScScannerOpen, setIsScScannerOpen] = useState(false);

  useEffect(() => {
    const isScanParam = searchParams.get("scps_scan") === "true" || searchParams.get("scan") === "true";
    if (isScanParam) {
      setIsScScannerOpen(true);
    }
  }, [searchParams]);

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert((prev) => ({ ...prev, show: false })), 8000);
  };

  const getClientIp = async (): Promise<string> => {
    try {
      const res = await fetch("https://api64.ipify.org?format=json");
      const data = await res.json();
      return data.ip || "";
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

  // 内部メンバー / 外部ユーザーの検証と判定処理
  const checkUserAndTenantSettings = async (uid: string, providerId: string) => {
    // 1. まず内部ユーザー（usersコレクション）を検索
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      if (userData.accountStatus === "pending") {
        throw new Error("このアカウントは管理者の承認待ちです。承認が完了するまでログインできません。詳しくはテナント管理者へお問い合わせください。");
      }
      if (userData.accountStatus === "rejected") {
        throw new Error("このユーザーは管理者によってロック（利用停止）されています。詳しくはテナント管理者へお問い合わせください。");
      }

      if (userData.accountValidEndDate) {
        const today = new Date().toISOString().split("T")[0];
        if (userData.accountValidEndDate < today) {
          throw new Error("このアカウントの利用有効期限が切れています。詳しくはテナント管理者へお問い合わせください。");
        }
      }

      if (userData.accountStatus === "unaccessed") {
        return { isExternalUser: false, isSystemAdmin: false, userData, isMfaRequired: false, isSafeIpSkipped: true, isMfaSetupNeeded: false, allowedMfaMethods: [], isUnaccessed: true };
      }

      if (userData.role === "system_admin") {
        return { isExternalUser: false, isSystemAdmin: true, userData, isMfaRequired: false, isSafeIpSkipped: false, isMfaSetupNeeded: false, allowedMfaMethods: [], isUnaccessed: false };
      }

      if (!userData.schoolId) {
        throw new Error("所属組織が設定されていません。詳しくはテナント管理者へお問い合わせください。");
      }

      const schoolDoc = await getDoc(doc(db, "schools", userData.schoolId));
      if (!schoolDoc.exists()) throw new Error("所属する組織データが存在しません。");
      const schoolData = schoolDoc.data();

      if (schoolData.status === "suspended") {
        throw new Error("現在、所属する組織（テナント）のシステム利用が停止されています。詳しくはテナント管理者へお問い合わせください。");
      }

      let isMfaRequired = false;
      let isSafeIpSkipped = false;
      let isMfaSetupNeeded = false;
      let allowedMfaMethods: string[] = [];
      
      const tenantRequiresMfa = schoolData.requireMfa === true || schoolData.requireMfa === "true";
      const userRequiresMfa = userData.requireMfa === true || userData.requireMfa === "true";

      const activePolicies = userData.useCustomMfaPolicy && userData.mfaPolicies 
        ? userData.mfaPolicies 
        : (schoolData.mfaPolicies || {
            email: { allowUsage: true },
            totp: { allowUsage: false },
            passkey: { allowUsage: false },
          });

      if ((activePolicies.email?.allowUsage === true || activePolicies.email?.allowUsage === "true") && userData.email) {
        allowedMfaMethods.push("email");
      }
      if ((activePolicies.totp?.allowUsage === true || activePolicies.totp?.allowUsage === "true") && userData.totpSecret) {
        allowedMfaMethods.push("totp");
      }
      if ((activePolicies.passkey?.allowUsage === true || activePolicies.passkey?.allowUsage === "true") && Array.isArray(userData.passkeys) && userData.passkeys.length > 0) {
        allowedMfaMethods.push("passkey");
      }

      const rawClientIp = await getClientIp();
      const clientIp = rawClientIp.trim().toLowerCase();
      
      const safeIps: string[] = schoolData.safeIps || [];
      const safeNetworkIps = Array.isArray(schoolData.safeNetworks) ? schoolData.safeNetworks.map((n: any) => n.ip) : [];
      
      const allSafeIps = [...safeIps, ...safeNetworkIps].filter(Boolean).map(ip => ip.trim().toLowerCase());
      const isSafeIp = clientIp !== "" && allSafeIps.includes(clientIp);

      if (tenantRequiresMfa || userRequiresMfa) {
        if (isSafeIp) {
          isSafeIpSkipped = true; 
        } else {
          if (allowedMfaMethods.length === 0) {
            isMfaSetupNeeded = true;
            isMfaRequired = false;
          } else {
            isMfaRequired = true;
          }
        }
      }

      return { isExternalUser: false, isSystemAdmin: false, userData, isMfaRequired, allowedMfaMethods, isSafeIpSkipped, isMfaSetupNeeded, isUnaccessed: false };
    }

    // 2. 内部ユーザーに見つからなかった場合、外部ユーザー（external_usersコレクション）を検索
    const qExt = query(collection(db, "external_users"), where("authUid", "==", uid));
    const extSnap = await getDocs(qExt);

    if (!extSnap.empty) {
      const extDoc = extSnap.docs[0];
      // ★ エラー修正： as any を追加して型の認識エラーを回避
      const extUserData = { id: extDoc.id, ...extDoc.data() } as any;

      if (extUserData.status === "suspended") {
        throw new Error("このアカウントは現在停止されています。");
      }

      const now = Date.now();
      if (extUserData.expiresAt) {
        const expTime = typeof extUserData.expiresAt.toDate === "function"
          ? extUserData.expiresAt.toDate().getTime()
          : new Date(extUserData.expiresAt).getTime();
        if (expTime < now) {
          throw new Error("アカウントの有効期限が切れています。");
        }
      }

      return {
        isExternalUser: true,
        isSystemAdmin: false,
        userData: extUserData,
        isMfaRequired: false,
        allowedMfaMethods: [],
        isSafeIpSkipped: true,
        isMfaSetupNeeded: false,
        isUnaccessed: false,
      };
    }

    throw new Error("ユーザー情報が見つかりません。");
  };

  const handlePostLogin = (uid: string, userData: any, isSystemAdmin: boolean, isExternalUser: boolean) => {
    setTimeout(() => {
      if (isExternalUser) {
        router.push("/ext-top");
      } else if (isSystemAdmin) {
        router.push("/system-admin");
      } else {
        router.push("/top");
      }
    }, 1000);
  };

  const processLoginFlow = async (userCredential: any, currentProviderType: string, userDataParam?: any) => {
    try {
      const { isExternalUser, isSystemAdmin, userData, isMfaRequired, allowedMfaMethods, isSafeIpSkipped, isMfaSetupNeeded, isUnaccessed } = await checkUserAndTenantSettings(userCredential.user.uid, currentProviderType);
      const finalUserData = userDataParam || userData;

      if (isExternalUser) {
        showAlert("success", "ゲストログインに成功しました。外部ポータルへ移動します...");
        handlePostLogin(userCredential.user.uid, finalUserData, false, true);
        return;
      }

      if (isUnaccessed) {
        showAlert("success", "初回ログインを確認しました。パスワード設定画面へ移動します...");
        setTimeout(() => {
          router.push(`/setup/password`);
        }, 1200);
        return;
      }

      if (isMfaSetupNeeded) {
        showAlert("success", "2段階認証の初期設定が完了していません。セットアップ画面へ移動します...");
        handlePostLogin(userCredential.user.uid, finalUserData, isSystemAdmin, false);
        return;
      }

      if (isSafeIpSkipped) {
        showAlert("success", "許可済みネットワークからのアクセスのため、2段階認証をスキップしました。");
        handlePostLogin(userCredential.user.uid, finalUserData, isSystemAdmin, false);
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

      showAlert("success", "ログインに成功しました。移動します...");
      handlePostLogin(userCredential.user.uid, finalUserData, isSystemAdmin, false);
    } catch (e: any) {
      await signOut(auth);
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
    } catch (err: any) {
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        showAlert("error", "メールアドレスまたはパスワードが間違っています。");
      } else {
        showAlert("error", err.message || "ログインに失敗しました。");
      }
      setIsLoading(false);
    }
  };

  const handleSystemLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // 1. まず内部ユーザーとして組織コード・利用番号を検索
      const schoolQ = query(collection(db, "schools"), where("schoolCode", "==", `SCPS-${tenantId}`));
      const schoolSnap = await getDocs(schoolQ);
      
      if (!schoolSnap.empty) {
        const schoolId = schoolSnap.docs[0].id;
        const userQ = query(collection(db, "users"), where("schoolId", "==", schoolId), where("systemId", "==", systemId));
        const userSnap = await getDocs(userQ);
        
        if (!userSnap.empty) {
          const userDoc = userSnap.docs[0];
          const userData = userDoc.data();

          if (!userData.email) {
            throw new Error("このアカウントにはログイン用情報が同期されていません。管理者にCSVの再アップロードを依頼してください。");
          }

          if (userData.accountStatus === "unaccessed" && userData.initialPassword !== password) {
            throw new Error("利用番号または初期パスワードが違います。");
          }

          const userCredential = await signInWithEmailAndPassword(auth, userData.email, password);
          await processLoginFlow(userCredential, "password", userData);
          return;
        }
      }

      // 2. 内部ユーザーに見つからなかった場合、外部ユーザー（loginId）の可能性を検索
      const extUsersRef = collection(db, "external_users");
      const qExt = query(extUsersRef, where("loginId", "==", systemId));
      const extSnap = await getDocs(qExt);

      if (!extSnap.empty) {
        // ★ エラー修正： as any を追加
        const extData = extSnap.docs[0].data() as any;
        if (extData.status === "suspended") {
          throw new Error("このアカウントは現在停止されています。");
        }
        if (extData.status === "pending" || extData.status === "verifying") {
          if (extData.initialPassword !== password) throw new Error("パスワードが正しくありません。");
          router.push(`/ext-login/setup?uid=${extSnap.docs[0].id}`);
          return;
        } else if (extData.status === "verified") {
          if (extData.initialPassword !== password) throw new Error("パスワードが正しくありません。");
          router.push(`/ext-login/verify?uid=${extSnap.docs[0].id}`);
          return;
        } else {
          const userCredential = await signInWithEmailAndPassword(auth, extData.email, password);
          await processLoginFlow(userCredential, "password", extData);
          return;
        }
      }

      throw new Error("組織コード、利用番号（ログインID）、またはパスワードが正しくありません。");

    } catch (err: any) {
      await signOut(auth);
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/invalid-email") {
        showAlert("error", "ログイン情報が一致しないか、認証に失敗しました。");
      } else {
        showAlert("error", err.message || "ログインに失敗しました。");
      }
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: AuthProvider) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithPopup(auth, provider);
      await processLoginFlow(userCredential, provider.providerId);
    } catch (err: any) {
      await signOut(auth);
      showAlert("error", err.message || "外部連携ログインがキャンセルされたか、失敗しました。");
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
      if (!optionsResp.ok) throw new Error(optionsJSON.error || "鍵オプションの生成に失敗しました。");

      const asseResp = await startAuthentication({ optionsJSON });
      const verifyResp = await fetch('/api/webauthn/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: targetUid, response: asseResp })
      });
      if (!verifyResp.ok) throw new Error();

      showAlert("success", "認証に成功しました。移動します...");
      handlePostLogin(targetUid, mfaState.userData, mfaState.isSystemAdmin, false);
    } catch {
      showAlert("error", "生体認証（パスキー）がキャンセルされたか、検証に失敗しました。");
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
          throw new Error("認証コードが一致しないか、有効期限が切れています。");
        }
        await updateDoc(doc(db, "users", mfaState.uid), { mfaTempCode: null, mfaExpiresAt: null });
        showAlert("success", "認証に成功しました。移動します...");
        handlePostLogin(mfaState.uid, mfaState.userData, mfaState.isSystemAdmin, false);
        
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
        showAlert("success", "認証に成功しました。移動します...");
        handlePostLogin(mfaState.uid, mfaState.userData, mfaState.isSystemAdmin, false);
      }
    } catch (err: any) {
      showAlert("error", err.message || "認証コードの検証に失敗しました。");
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
      
      {/* SCコード用カメラモーダル */}
      {isScScannerOpen && (
        <ScCodeScannerModal 
          onClose={() => setIsScScannerOpen(false)}
          onLoginSuccess={async (emailAddress) => {
            setIsScScannerOpen(false);
            const userQ = query(collection(db, "users"), where("email", "==", emailAddress.toLowerCase()));
            const userSnap = await getDocs(userQ);
            if (!userSnap.empty) {
              const uData = userSnap.docs[0].data();
              processLoginFlow({ user: { uid: userSnap.docs[0].id } }, "password", uData);
            } else {
              router.push("/top");
            }
          }}
          showAlert={showAlert}
        />
      )}

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
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
          <div className={`mb-4 p-4 rounded-xl text-xs font-bold shadow-md flex items-start border animate-fade-in ${
            alert.type === "success" 
              ? "bg-green-50 text-green-800 border-green-200" 
              : "bg-red-50 text-red-800 border-red-200"
          }`}>
            <span className="leading-relaxed">{alert.message}</span>
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
          <div className="space-y-4">
            <LoginForm loginMode={loginMode} setLoginMode={setLoginMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} tenantId={tenantId} setTenantId={setTenantId} systemId={systemId} setSystemId={setSystemId} isLoading={isLoading} handleEmailLogin={handleEmailLogin} handleSystemLogin={handleSystemLogin} handleSocialLogin={handleSocialLogin} googleProvider={googleProvider} microsoftProvider={microsoftProvider} />
            
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsScScannerOpen(true)}
                className="inline-flex items-center text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 shadow-2xs transition-all gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5 text-indigo-500" />
                <span>SCコードで初回ログイン</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}