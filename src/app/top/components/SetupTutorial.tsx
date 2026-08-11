"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Lock, Smartphone, CheckCircle2, ArrowRight, LogOut, AlertCircle } from "lucide-react";
import { auth } from "@/lib/firebase";
import { UserData } from "../page";

type Props = {
  // ★ layout.tsx から渡されなくてもエラーにならないように `?` (オプショナル) を付与
  setupStatus?: {
    needsPassword?: boolean;
    needsLine?: boolean;
    needsMfa?: boolean;
    isBlocked?: boolean;
  };
  userData: UserData | null;
  onCompleted?: () => void;
  handleLogout?: () => void; // ★ これもオプショナルに
};

export default function SetupTutorial({ setupStatus, userData, onCompleted, handleLogout }: Props) {
  
  // 親コンポーネントから setupStatus が渡されなかった場合のフォールバック（自動判定）
  const status = {
    needsPassword: setupStatus?.needsPassword ?? false, // ※必要に応じて userData から判定するロジックに変更可
    needsLine: setupStatus?.needsLine ?? false,
    needsMfa: setupStatus?.needsMfa ?? false,
    isBlocked: setupStatus?.isBlocked ?? false,
  };

  // 親コンポーネントから handleLogout が渡されなかった場合のフォールバック処理
  const doLogout = handleLogout || (async () => {
    await auth.signOut();
    window.location.href = "/login";
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-6 animate-fade-in z-50 relative">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-white opacity-10 rounded-full blur-xl"></div>
          <AlertCircle className="h-14 w-14 text-white mx-auto mb-4 relative z-10" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white relative z-10 tracking-tight">初期セットアップが必要です</h1>
          <p className="mt-3 text-blue-100 text-sm sm:text-base max-w-lg mx-auto relative z-10 font-medium leading-relaxed">
            システムを安全に利用するため、組織のセキュリティ要件に基づき以下の設定を完了してください。
          </p>
        </div>
        
        {/* 設定タスクリスト */}
        <div className="p-6 sm:p-8 space-y-4">
          
          {/* パスワード変更チェック */}
          {status.needsPassword ? (
            <Link href="/setup/password" className="block group">
              <div className="flex items-center p-5 rounded-xl border-2 border-red-200 bg-red-50/50 hover:bg-red-100 transition-all duration-300">
                <div className="flex-shrink-0 text-red-500">
                  <Lock className="h-7 w-7" />
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-base font-bold text-red-900 group-hover:underline">初期パスワードの変更</h3>
                  <p className="text-sm mt-1 text-red-700">管理者から発行された初期パスワードを変更してください。</p>
                </div>
                <div className="ml-4 flex-shrink-0 flex items-center text-red-600 font-bold">
                  設定する <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ) : (
            <div className="flex items-center p-5 rounded-xl border-2 border-green-200 bg-green-50 opacity-70">
              <div className="flex-shrink-0 text-green-500"><CheckCircle2 className="h-7 w-7" /></div>
              <div className="ml-4 flex-1">
                <h3 className="text-base font-bold text-green-900">初期パスワードの変更</h3>
                <p className="text-sm mt-1 text-green-700">設定完了済みです</p>
              </div>
            </div>
          )}

          {/* 多要素認証チェック */}
          {(userData?.requireMfa || status.needsMfa) && (
            status.needsMfa ? (
              <Link href="/setup/mfa" className="block group">
                <div className="flex items-center p-5 rounded-xl border-2 border-red-200 bg-red-50/50 hover:bg-red-100 transition-all duration-300">
                  <div className="flex-shrink-0 text-red-500">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-base font-bold text-red-900 group-hover:underline">2段階認証（MFA）の初期設定</h3>
                    <p className="text-sm mt-1 text-red-700">アカウント保護のため、認証アプリやパスキー等の登録が必要です。</p>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex items-center text-red-600 font-bold">
                    設定する <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ) : (
              <div className="flex items-center p-5 rounded-xl border-2 border-green-200 bg-green-50 opacity-70">
                <div className="flex-shrink-0 text-green-500"><CheckCircle2 className="h-7 w-7" /></div>
                <div className="ml-4 flex-1">
                  <h3 className="text-base font-bold text-green-900">2段階認証（MFA）の初期設定</h3>
                  <p className="text-sm mt-1 text-green-700">設定完了済みです</p>
                </div>
              </div>
            )
          )}

          {/* LINE連携チェック */}
          {(userData?.lineConnectionEnforced || status.needsLine) && (
            status.needsLine ? (
              <Link href="/top/account?tab=line" className="block group">
                <div className="flex items-center p-5 rounded-xl border-2 border-red-200 bg-red-50/50 hover:bg-red-100 transition-all duration-300">
                  <div className="flex-shrink-0 text-red-500">
                    <Smartphone className="h-7 w-7" />
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-base font-bold text-red-900 group-hover:underline">LINEアカウントとの連携</h3>
                    <p className="text-sm mt-1 text-red-700">重要な通知を受け取るため、LINE連携が必須とされています。</p>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex items-center text-red-600 font-bold">
                    設定する <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ) : (
              <div className="flex items-center p-5 rounded-xl border-2 border-green-200 bg-green-50 opacity-70">
                <div className="flex-shrink-0 text-green-500"><CheckCircle2 className="h-7 w-7" /></div>
                <div className="ml-4 flex-1">
                  <h3 className="text-base font-bold text-green-900">LINEアカウントとの連携</h3>
                  <p className="text-sm mt-1 text-green-700">連携完了済みです</p>
                </div>
              </div>
            )
          )}

          <div className="mt-8 text-center pt-6 border-t border-gray-100">
            <button 
              onClick={doLogout} 
              className="text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors duration-300 inline-flex items-center"
            >
              <LogOut className="h-4 w-4 mr-1" />
              ログアウトしてやり直す
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}