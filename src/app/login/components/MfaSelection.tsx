"use client";

import React from "react";
import { ShieldCheck, Mail, Smartphone, Fingerprint, ChevronRight, Loader2 } from "lucide-react";

type Props = {
  availableMethods: string[];
  userData: any;
  isLoading: boolean;
  selectMfaMethod: (method: string) => void;
};

export default function MfaSelection({ availableMethods, userData, isLoading, selectMfaMethod }: Props) {
  return (
    <div className="animate-fade-in transition-colors duration-300">
      <div className="text-center mb-8">
        <div className="mx-auto w-14 h-14 bg-indigo-50 dark:bg-indigo-900/50 rounded-full flex items-center justify-center mb-4 shadow-inner border border-indigo-100 dark:border-indigo-800">
          <ShieldCheck className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">2段階認証 (MFA)</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          セキュリティ保護のため、本人確認が必要です。<br />利用する認証方法を選択してください。
        </p>
      </div>

      <div className="space-y-3">
        {availableMethods.includes("passkey") && (
          <button
            onClick={() => selectMfaMethod("passkey")}
            disabled={isLoading}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/30 transition-all text-left group disabled:opacity-50"
          >
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-indigo-800 transition-colors">
                <Fingerprint className="h-5 w-5 text-gray-600 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-bold text-gray-900 dark:text-white">生体認証（パスキー）</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Face IDやTouch ID等の端末認証</p>
              </div>
            </div>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600" />}
          </button>
        )}

        {availableMethods.includes("totp") && (
          <button
            onClick={() => selectMfaMethod("totp")}
            disabled={isLoading}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/30 transition-all text-left group disabled:opacity-50"
          >
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-indigo-800 transition-colors">
                <Smartphone className="h-5 w-5 text-gray-600 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-bold text-gray-900 dark:text-white">認証アプリ (Authenticator)</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">スマホアプリに表示される6桁のコード</p>
              </div>
            </div>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600" />}
          </button>
        )}

        {availableMethods.includes("email") && (
          <button
            onClick={() => selectMfaMethod("email")}
            disabled={isLoading}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/30 transition-all text-left group disabled:opacity-50"
          >
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-indigo-800 transition-colors">
                <Mail className="h-5 w-5 text-gray-600 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-bold text-gray-900 dark:text-white">メール認証 (OTP)</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">登録メールアドレスにコードを送信</p>
              </div>
            </div>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600" />}
          </button>
        )}
      </div>
    </div>
  );
}