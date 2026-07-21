"use client";

import React from "react";
import { Fingerprint, ScanLine, Mail, ShieldAlert } from "lucide-react";

type Props = {
  availableMethods: string[];
  userData: any;
  isLoading: boolean;
  selectMfaMethod: (method: string) => void;
};

export default function MfaSelection({ availableMethods, userData, isLoading, selectMfaMethod }: Props) {
  // パスキー -> アプリ -> メールの順序に厳密ソート
  const order = ["passkey", "totp", "email"];
  
  const validMethods = order.filter(method => {
    if (!availableMethods.includes(method)) return false;
    if (method === "email") return !!userData?.email;
    if (method === "totp") return !!userData?.totpSecret;
    if (method === "passkey") return Array.isArray(userData?.passkeys) && userData.passkeys.length > 0;
    return false;
  });

  return (
    <div className="w-full max-w-md mx-auto space-y-4 animate-fade-in">
      <h3 className="text-center font-extrabold text-gray-900 text-lg mb-4">認証方法を選択</h3>
      
      {validMethods.length === 0 ? (
        <div className="text-center p-5 bg-red-50 rounded-2xl border border-red-200">
          <ShieldAlert className="h-6 w-6 text-red-600 mx-auto mb-2" />
          <p className="text-sm text-red-700 font-bold mb-1">利用可能な認証手段がありません</p>
          <p className="text-xs text-red-500 leading-relaxed">学校のセキュリティ設定をご確認ください。</p>
        </div>
      ) : (
        validMethods.map(method => (
          <button 
            key={method}
            onClick={() => selectMfaMethod(method)} 
            disabled={isLoading}
            className="w-full flex items-center p-4 border border-gray-200 rounded-2xl bg-white hover:bg-blue-50/40 hover:border-blue-300 transition-all text-left shadow-sm active:scale-[0.99]"
          >
            <div className="bg-blue-50 p-3 rounded-xl mr-4 flex-shrink-0 text-blue-600">
              {method === 'passkey' && <Fingerprint className="h-6 w-6"/>}
              {method === 'totp' && <ScanLine className="h-6 w-6"/>}
              {method === 'email' && <Mail className="h-6 w-6"/>}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                {method === 'passkey' && 'パスキー認証'}
                {method === 'totp' && '認証アプリコード認証'}
                {method === 'email' && 'メールアドレス認証'}
              </p>
              <p className="text-xs text-gray-400 mt-1 leading-normal">
                {method === 'passkey' && '端末のTouchID・FaceIDやPINコードなどで安全・高速にログイン'}
                {method === 'totp' && 'GoogleやMicrosoft等のアプリに表示される6桁のコードを入力'}
                {method === 'email' && '登録済みのメールアドレス宛に届く8桁のワンタイムコード'}
              </p>
            </div>
          </button>
        ))
      )}
    </div>
  );
}