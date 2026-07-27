"use client";

import React from "react";
import { Mail, Smartphone, Fingerprint, Loader2, KeyRound } from "lucide-react";

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
  
  const handleResetSelection = () => {
    setMfaState((prev: any) => ({ ...prev, selectedMethod: "" }));
  };

  if (selectedMethod === "passkey") {
    return (
      <div className="text-center animate-fade-in transition-colors duration-300">
        <div className="mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-blue-100 dark:border-blue-800">
          <Fingerprint className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-3">2段階認証 (MFA)</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed font-medium px-4">
          Face ID、Touch ID等の生体認証を使用してログインします。<br/>下のボタンを押して認証を開始してください。
        </p>

        <button
          onClick={handlePasskeyAuth}
          disabled={isVerifyingPasskey}
          className="w-full flex items-center justify-center py-4 px-4 border border-transparent rounded-xl shadow-md text-base font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-all active:scale-[0.98] disabled:opacity-70 mb-4"
        >
          {isVerifyingPasskey ? (
            <><Loader2 className="animate-spin h-5 w-5 mr-2" /> 検証中...</>
          ) : (
            <><Fingerprint className="h-5 w-5 mr-2" /> 生体認証（パスキー）でログイン</>
          )}
        </button>
        <button onClick={handleResetSelection} className="text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
          他の認証方法を選択する
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleMfaSubmit} className="text-center animate-fade-in transition-colors duration-300">
      <div className="mx-auto w-16 h-16 bg-indigo-50 dark:bg-indigo-900/50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-indigo-100 dark:border-indigo-800">
        {selectedMethod === "email" ? (
          <Mail className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
        ) : (
          <Smartphone className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
        )}
      </div>
      <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-3">2段階認証 (MFA)</h3>
      
      {selectedMethod === "email" ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
          <span className="font-bold text-gray-800 dark:text-gray-200">{userData.email}</span> 宛に<br/>
          6桁の認証コードを送信しました。
        </p>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
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
          className="block w-full max-w-[240px] mx-auto text-center text-3xl tracking-[0.4em] font-mono border-2 border-gray-300 dark:border-gray-600 rounded-xl py-4 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none shadow-inner"
          placeholder="000000"
          autoFocus
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || mfaCode.length !== 6}
        className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-all active:scale-[0.98] disabled:opacity-50 mb-4"
      >
        {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "コードを検証してログイン"}
      </button>

      <button type="button" onClick={handleResetSelection} className="text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
        他の認証方法を選択する
      </button>
    </form>
  );
}