"use client";

import React, { useEffect, useRef } from "react";
import { Fingerprint, Loader2 } from "lucide-react";

type Props = {
  selectedMethod: string;
  mfaCode: string;
  setMfaCode: (val: string) => void;
  userData: any;
  isLoading: boolean;
  isVerifyingPasskey: boolean;
  handleMfaSubmit: (e: React.FormEvent) => void;
  handlePasskeyAuth: () => void;
  setMfaState: any;
};

export default function MfaVerification({
  selectedMethod, mfaCode, setMfaCode, userData,
  isLoading, isVerifyingPasskey, handleMfaSubmit, handlePasskeyAuth, setMfaState
}: Props) {
  const isEmail = selectedMethod === "email";
  const isTotp = selectedMethod === "totp";
  const isPasskey = selectedMethod === "passkey";

  const hasTriggered = useRef(false);
  
  useEffect(() => {
    if (isPasskey && !hasTriggered.current) {
      hasTriggered.current = true;
      handlePasskeyAuth();
    }
    return () => { if (!isPasskey) hasTriggered.current = false; };
  }, [isPasskey]);

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in">
      {isPasskey && (
        <div className="text-center space-y-4 py-4">
          <div className="relative inline-block">
            <Fingerprint className={`h-16 w-14 text-blue-600 mx-auto ${isVerifyingPasskey ? 'animate-pulse' : ''}`} />
            {isVerifyingPasskey && <Loader2 className="h-5 w-5 text-blue-600 animate-spin absolute -top-1 -right-1" />}
          </div>
          <p className="text-sm font-bold text-gray-900">生体認証（パスキー）</p>
          <p className="text-xs text-gray-400 px-4 leading-relaxed">
            端末の顔認証・指紋認証プロンプトが自動で立ち上がります。認証を完了させてください。
          </p>
          
          {!isVerifyingPasskey && (
            <button
              type="button" onClick={handlePasskeyAuth}
              className="mt-6 w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all"
            >
              生体認証を再起動する
            </button>
          )}
        </div>
      )}

      {(isEmail || isTotp) && (
        <form className="space-y-5" onSubmit={handleMfaSubmit}>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2 text-center">
              {isEmail ? "メールで受信した8桁のコード" : "アプリに表示された6桁のコード"}
            </label>
            <input 
              type="text" required maxLength={isEmail ? 8 : 6} value={mfaCode} 
              onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
              className={`block w-full text-center tracking-[0.2em] font-mono border border-gray-200 rounded-xl py-3.5 px-3 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-gray-50 focus:bg-white outline-none ${isEmail ? 'text-2xl' : 'text-3xl'}`} 
              placeholder={isEmail ? "00000000" : "000000"} 
              autoFocus
            />
            {isEmail && (
              <p className="text-[11px] text-center text-gray-400 mt-2 font-medium">
                {userData?.email?.replace(/(.{2})(.*)(?=@)/, "$1***")} 宛に送信しました
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || (isEmail ? mfaCode.length !== 8 : mfaCode.length !== 6)}
            className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white transition-all bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "認証を確認する"}
          </button>
        </form>
      )}

      <div className="mt-5 text-center">
        <button 
          type="button" 
          onClick={() => { setMfaState((prev: any) => prev ? { ...prev, selectedMethod: "" } : null); setMfaCode(""); }} 
          className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
        >
          別の認証方法を選択し直す
        </button>
      </div>
    </div>
  );
}