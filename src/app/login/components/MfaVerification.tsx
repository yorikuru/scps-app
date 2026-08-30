"use client";

import React, { useEffect } from "react";
import { Mail, Smartphone, Fingerprint, Loader2 } from "lucide-react";

type Props = {
  selectedMethod: string;
  mfaCode: string;
  setMfaCode: (val: string) => void;
  userData: any;
  isLoading: boolean;
  isVerifyingPasskey: boolean;
  handleMfaSubmit: (e: React.FormEvent) => void;
  handlePasskeyAuth: () => void;
  setMfaState: (state: any) => void;
};

export default function MfaVerification({
  selectedMethod, mfaCode, setMfaCode, userData, isLoading,
  isVerifyingPasskey, handleMfaSubmit, handlePasskeyAuth, setMfaState
}: Props) {
  
  // ★ パスキーが選択されたら自動的に生体認証待機にする
  useEffect(() => {
    if (selectedMethod === "passkey") {
      handlePasskeyAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMethod]);

  const handleResetSelection = () => {
    setMfaState((prev: any) => ({ ...prev, selectedMethod: "" }));
  };

  if (selectedMethod === "passkey") {
    return (
      <div className="text-center animate-fade-in transition-colors duration-300">
        <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-blue-100">
          <Fingerprint className="h-8 w-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-extrabold text-gray-900 mb-3">2段階認証 (MFA)</h3>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed font-medium px-4">
          Face ID、Touch ID等の生体認証を使用してログインします。<br/>
          {isVerifyingPasskey ? "端末の指示に従って認証を完了してください。" : "下のボタンを押して認証を開始してください。"}
        </p>

        <button
          onClick={handlePasskeyAuth}
          disabled={isVerifyingPasskey}
          className="w-full flex items-center justify-center py-4 px-4 border border-transparent rounded-xl shadow-md text-base font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-70 mb-4"
        >
          {isVerifyingPasskey ? (
            <><Loader2 className="animate-spin h-5 w-5 mr-2" /> 認証待機中...</>
          ) : (
            <><Fingerprint className="h-5 w-5 mr-2" /> 生体認証（パスキー）でログイン</>
          )}
        </button>
        <button onClick={handleResetSelection} className="text-sm font-bold text-gray-500 hover:text-gray-800">
          他の認証方法を選択する
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleMfaSubmit} className="text-center animate-fade-in transition-colors duration-300">
      <div className="mx-auto w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-indigo-100">
        {selectedMethod === "email" ? (
          <Mail className="h-8 w-8 text-indigo-600" />
        ) : (
          <Smartphone className="h-8 w-8 text-indigo-600" />
        )}
      </div>
      <h3 className="text-xl font-extrabold text-gray-900 mb-3">2段階認証 (MFA)</h3>
      
      {selectedMethod === "email" ? (
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          <span className="font-bold text-gray-800">{userData.email}</span> 宛に<br/>
          6桁の認証コードを送信しました。
        </p>
      ) : (
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          認証アプリ (Authenticator) に表示されている<br/>
          6桁の認証コードを入力してください。
        </p>
      )}

      <div className="mb-8">
        <input
          type="text"
          maxLength={6}
          required
          value={mfaCode}
          onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
          className="block w-full max-w-[240px] mx-auto text-center text-3xl tracking-[0.4em] font-mono border-2 border-gray-300 rounded-xl py-4 bg-gray-50 text-gray-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none shadow-inner"
          placeholder="000000"
          autoFocus
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || mfaCode.length !== 6}
        className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50 mb-4"
      >
        {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "コードを検証してログイン"}
      </button>

      <button type="button" onClick={handleResetSelection} className="text-sm font-bold text-gray-500 hover:text-gray-800">
        他の認証方法を選択する
      </button>
    </form>
  );
}