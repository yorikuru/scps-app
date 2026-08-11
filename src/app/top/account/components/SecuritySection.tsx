"use client";

import React, { useState } from "react";
import { ShieldAlert, Fingerprint, Scan } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User } from "firebase/auth";
import { startRegistration } from "@simplewebauthn/browser";
import TotpSetupModal from "./TotpSetupModal";
import { useDialog } from "@/components/DialogContext";

type Props = {
  currentUser: User | null;
  userData: any;
  setUserData: React.Dispatch<React.SetStateAction<any>>;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
};

export default function SecuritySection({
  currentUser,
  userData,
  setUserData,
  isProcessing,
  setIsProcessing,
}: Props) {
  const [isSettingTotp, setIsSettingTotp] = useState(false);
  const { showAlert, showConfirm } = useDialog();

  const handleRegisterPasskey = async () => {
    if (!currentUser?.email) {
      showAlert("メールアドレスが登録されていません。", "error");
      return;
    }
    
    setIsProcessing(true);
    try {
      const optionsResp = await fetch('/api/webauthn/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.uid, email: currentUser.email })
      });
      const optionsJSON = await optionsResp.json();
      if (!optionsResp.ok) throw new Error(optionsJSON.error || "オプションの生成に失敗しました");

      const attResp = await startRegistration({ optionsJSON });

      const verifyResp = await fetch('/api/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.uid, response: attResp })
      });
      const verifyResult = await verifyResp.json();
      if (!verifyResp.ok) throw new Error(verifyResult.error || "検証に失敗しました");

      showAlert("現在の端末をパスキーとして登録しました！", "success");
      
      const newPasskeyObj = { createdAt: new Date().toISOString() };
      setUserData((prev: any) => prev ? { ...prev, passkeys: [...(prev.passkeys || []), newPasskeyObj] } : null);

      // セキュリティ通知メールの送信
      await fetch('/api/send-security-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, action: 'パスキー（生体認証）が新たに登録されました' })
      });

    } catch (error: any) {
      console.error("Passkey register error:", error);
      if (error.message.includes("timed out") || error.message.includes("not allowed") || error.name === "NotAllowedError") {
        showAlert("パスキーの登録がキャンセルされました。", "warning");
      } else {
        showAlert(error.message || "パスキーの登録に失敗しました。", "error");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const executeRemovePasskeys = async () => {
    if (!userData) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "users", userData.id), {
        passkeys: []
      });
      setUserData((prev: any) => prev ? { ...prev, passkeys: [] } : null);
      showAlert("すべてのパスキーを解除しました。", "success");
    } catch (error) {
      showAlert("パスキーの解除に失敗しました。", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePasskeys = () => {
    showConfirm(
      "登録されているすべてのパスキー（生体認証端末）を解除しますか？\n解除後はパスワード等でログインする必要があります。",
      executeRemovePasskeys,
      "danger",
      "パスキー解除の確認"
    );
  };

  const executeRemoveTotp = async () => {
    if (!userData) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "users", userData.id), {
        totpSecret: null
      });
      setUserData((prev: any) => prev ? { ...prev, totpSecret: null } : null);
      showAlert("認証アプリの連携を解除しました。", "success");
    } catch (error) {
      showAlert("連携解除に失敗しました。", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveTotp = () => {
    showConfirm(
      "本当に認証アプリの連携を解除しますか？",
      executeRemoveTotp,
      "danger",
      "TOTP解除の確認"
    );
  };

  return (
    <>
      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-white flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-gray-900 flex items-center">
            <ShieldAlert className="mr-2 text-blue-600 h-5 w-5" />
            2段階認証 (MFA)
          </h3>
        </div>
        <div className="p-6 space-y-4">
          
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
                  onClick={() => setIsSettingTotp(true)}
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

      {isSettingTotp && (
        <TotpSetupModal
          currentUser={currentUser}
          userData={userData}
          setUserData={setUserData}
          onClose={() => setIsSettingTotp(false)}
        />
      )}
    </>
  );
}