"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { 
  ShieldCheck, Fingerprint, Smartphone, Mail, AlertTriangle, 
  CheckCircle2, ChevronRight, Loader2, ArrowLeft, Info, XCircle, ArrowRight
} from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";
import TotpSetupModal from "@/app/top/account/components/TotpSetupModal";

type MfaPolicy = { allowSetup: boolean; forceSetup: boolean; allowUsage: boolean; };

type UserData = {
  id: string;
  name: string;
  email: string;
  schoolId: string;
  requireMfa?: boolean | string;
  totpSecret?: string;
  passkeys?: any[];
  useCustomMfaPolicy?: boolean;
  mfaPolicies?: { email: MfaPolicy; totp: MfaPolicy; passkey: MfaPolicy; };
};

type SchoolData = {
  id: string;
  name: string;
  requireMfa?: boolean | string;
  mfaPolicies?: { email: MfaPolicy; totp: MfaPolicy; passkey: MfaPolicy; };
};

type AlertState = { show: boolean; type: "success" | "error"; message: string; };

export default function MfaSetupPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [alert, setAlert] = useState<AlertState>({ show: false, type: "success", message: "" });
  const [isProcessing, setIsProcessing] = useState(false);

  // 認証アプリ設定モーダルの表示フラグ
  const [showTotpModal, setShowTotpModal] = useState(false);

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert(prev => ({ ...prev, show: false })), 5000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) throw new Error("ユーザー情報が見つかりません。");
          
          const uData = { id: userDocSnap.id, ...userDocSnap.data() } as UserData;
          setUserData(uData);

          const schoolDocRef = doc(db, "schools", uData.schoolId);
          const schoolDocSnap = await getDoc(schoolDocRef);
          if (schoolDocSnap.exists()) {
            setSchoolData({ id: schoolDocSnap.id, ...schoolDocSnap.data() } as SchoolData);
          }
        } catch (error) {
          showAlert("error", "データの取得に失敗しました。");
        } finally {
          setIsLoading(false);
        }
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
      </div>
    );
  }

  if (!userData || !schoolData) return null;

  // 有効なポリシーを判定（個別設定優先）
  const activePolicies = userData.useCustomMfaPolicy && userData.mfaPolicies 
    ? userData.mfaPolicies 
    : (schoolData.mfaPolicies || {
        email: { allowSetup: true, forceSetup: false, allowUsage: true },
        totp: { allowSetup: false, forceSetup: false, allowUsage: false },
        passkey: { allowSetup: false, forceSetup: false, allowUsage: false },
      });

  const isMfaGloballyRequired = schoolData.requireMfa === true || String(schoolData.requireMfa) === "true" || userData.requireMfa === true || String(userData.requireMfa) === "true";

  const hasEmail = !!userData.email;
  const hasTotp = !!userData.totpSecret;
  const hasPasskey = Array.isArray(userData.passkeys) && userData.passkeys.length > 0;

  // パスキーの登録処理
  const handleRegisterPasskey = async () => {
    setIsProcessing(true);
    try {
      const optionsResp = await fetch('/api/webauthn/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userData.id, email: userData.email, name: userData.name })
      });
      const optionsJSON = await optionsResp.json();
      if (!optionsResp.ok) throw new Error(optionsJSON.error || "設定の初期化に失敗しました。");

      const attResp = await startRegistration({ optionsJSON });

      const verifyResp = await fetch('/api/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userData.id, response: attResp })
      });
      if (!verifyResp.ok) throw new Error("パスキーの検証・保存に失敗しました。");

      const updatedUserDoc = await getDoc(doc(db, "users", userData.id));
      setUserData({ id: updatedUserDoc.id, ...updatedUserDoc.data() } as UserData);
      showAlert("success", "パスキー（生体認証）の登録が完了しました。");
    } catch (error: any) {
      console.error(error);
      showAlert("error", error.message || "パスキーの登録がキャンセルされたか、失敗しました。");
    } finally {
      setIsProcessing(false);
    }
  };

  const MfaMethodCard = ({ 
    methodId, title, desc, icon: Icon, policy, isConfigured, onSetup 
  }: { 
    methodId: string, title: string, desc: string, icon: any, policy: MfaPolicy, isConfigured: boolean, onSetup: () => void 
  }) => {
    if (!policy.allowSetup) {
      return (
        <div className="flex items-center p-5 rounded-2xl border-2 border-gray-100 bg-gray-50 opacity-60">
          <div className="flex-shrink-0 text-gray-400"><XCircle className="h-8 w-8" /></div>
          <div className="ml-4 flex-1">
            <h3 className="text-base font-bold text-gray-600">{title}</h3>
            <p className="text-sm mt-1 text-gray-500">組織のポリシーにより許可されていません</p>
          </div>
        </div>
      );
    }

    const isForced = policy.forceSetup || (isMfaGloballyRequired && !hasEmail && !hasTotp && !hasPasskey);

    return (
      <div className={`flex flex-col sm:flex-row sm:items-center p-5 rounded-2xl border-2 transition-all duration-300 ${
        isConfigured 
          ? "border-green-200 bg-green-50/30" 
          : isForced 
            ? "border-red-200 bg-red-50/50" 
            : "border-gray-200 bg-white hover:border-blue-300"
      }`}>
        <div className="flex items-center flex-1 mb-4 sm:mb-0">
          <div className={`flex-shrink-0 p-3 rounded-xl ${isConfigured ? "bg-green-100 text-green-600" : "bg-blue-50 text-blue-600"}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <div className="flex items-center gap-2">
              <h3 className={`text-base font-bold ${isConfigured ? "text-green-900" : "text-gray-900"}`}>{title}</h3>
              {isConfigured ? (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 border border-green-200 rounded-md">設定済</span>
              ) : isForced ? (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 rounded-md">必須</span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 rounded-md">任意</span>
              )}
            </div>
            <p className={`text-sm mt-1 ${isConfigured ? "text-green-700" : "text-gray-500"}`}>{desc}</p>
          </div>
        </div>
        <div className="sm:ml-4 flex-shrink-0 w-full sm:w-auto">
          {isConfigured ? (
            <div className="flex items-center justify-center sm:justify-start text-green-600 font-bold text-sm bg-green-50 px-4 py-2 rounded-xl">
              <CheckCircle2 className="h-5 w-5 mr-1" /> 完了
            </div>
          ) : (
            <button 
              onClick={onSetup}
              disabled={isProcessing}
              className={`w-full sm:w-auto flex items-center justify-center px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isForced 
                  ? "bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-200" 
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
              } disabled:opacity-50`}
            >
              {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-1" /> : null}
              設定を開始する <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* ヘッダー戻るボタン */}
        <div>
          <button onClick={() => router.push("/top")} className="inline-flex items-center text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-1" /> トップページへ戻る
          </button>
        </div>

        {/* アラート */}
        {alert.show && (
          <div className={`p-4 rounded-xl text-sm font-bold shadow-sm flex items-center border animate-fade-in ${
            alert.type === "success" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"
          }`}>
            <Info className="h-5 w-5 mr-2 flex-shrink-0" />
            <span className="leading-relaxed">{alert.message}</span>
          </div>
        )}

        {/* TOTPセットアップ用モーダル */}
        {showTotpModal && (
          <TotpSetupModal 
            currentUser={currentUser}
            userData={userData}
            setUserData={setUserData as any}
            onClose={() => setShowTotpModal(false)}
          />
        )}

        <div className="bg-white shadow-xl shadow-gray-200/50 rounded-3xl overflow-hidden border border-gray-100 animate-fade-in">
          {/* タイトルエリア */}
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 sm:p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
            <div className="flex items-center mb-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/30 mr-4">
                <ShieldCheck className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">2段階認証 (MFA) 設定</h1>
                <p className="text-indigo-100 text-sm mt-1 font-medium">アカウントのセキュリティを強化するための初期設定を行います</p>
              </div>
            </div>
          </div>

          {/* ポリシー状況の表示 */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center text-sm">
              <span className="font-bold text-gray-700 mr-2">現在の適用ポリシー:</span>
              {userData.useCustomMfaPolicy ? (
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold">ユーザー個別設定</span>
              ) : (
                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold">組織（テナント）準拠</span>
              )}
            </div>
            {isMfaGloballyRequired && (
              <span className="px-2.5 py-1 bg-red-100 text-red-800 border border-red-200 rounded-lg text-xs font-bold flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" /> 学校外アクセス時 MFA必須
              </span>
            )}
          </div>

          {/* 設定リスト */}
          <div className="p-6 sm:p-8 space-y-4">
            
            <MfaMethodCard 
              methodId="passkey"
              title="パスキー (生体認証)"
              desc="Face IDやTouch ID等の端末機能を使った、最も安全で簡単な認証方法です。"
              icon={Fingerprint}
              policy={activePolicies.passkey}
              isConfigured={hasPasskey}
              onSetup={handleRegisterPasskey}
            />

            <MfaMethodCard 
              methodId="totp"
              title="認証アプリ (Authenticator)"
              desc="Google Authenticator等のアプリで生成される6桁のコードを使用します。"
              icon={Smartphone}
              policy={activePolicies.totp}
              isConfigured={hasTotp}
              onSetup={() => setShowTotpModal(true)}
            />

            <MfaMethodCard 
              methodId="email"
              title="メール認証 (OTP)"
              desc="登録されているメールアドレス宛に使い捨てコードを送信します。"
              icon={Mail}
              policy={activePolicies.email}
              isConfigured={hasEmail}
              onSetup={() => showAlert("error", "メールアドレスが未登録です。アカウント設定からメールを登録してください。")}
            />

          </div>

          {/* 完了ボタンエリア */}
          <div className="p-6 sm:p-8 border-t border-gray-100 bg-gray-50/50 flex justify-end">
            <button 
              onClick={() => router.push("/top")}
              className="px-8 py-3 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 flex items-center"
            >
              設定を終了してトップへ進む <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}