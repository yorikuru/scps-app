"use client";

import React from "react";
import { Loader2, Mail, Building2, KeyRound } from "lucide-react";
import { AuthProvider } from "firebase/auth";

type Props = {
  loginMode: "email" | "system";
  setLoginMode: (mode: "email" | "system") => void;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  tenantId: string;
  setTenantId: (val: string) => void;
  systemId: string;
  setSystemId: (val: string) => void;
  isLoading: boolean;
  handleEmailLogin: (e: React.FormEvent) => void;
  handleSystemLogin: (e: React.FormEvent) => void;
  handleSocialLogin: (provider: AuthProvider) => void;
  googleProvider: AuthProvider;
  microsoftProvider: AuthProvider;
};

export default function LoginForm({
  loginMode, setLoginMode, email, setEmail, password, setPassword,
  tenantId, setTenantId, systemId, setSystemId, isLoading,
  handleEmailLogin, handleSystemLogin, handleSocialLogin,
  googleProvider, microsoftProvider
}: Props) {
  return (
    <div className="bg-white/90 backdrop-blur-md py-8 px-5 sm:px-10 shadow-xl shadow-gray-200/60 rounded-2xl border border-gray-100/90 animate-fade-in transition-colors duration-300">
      <div className="flex bg-gray-100/80 p-1 rounded-xl mb-8 border border-gray-200/50">
        <button
          onClick={() => setLoginMode("email")}
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
            loginMode === "email" 
              ? "bg-white text-blue-600 shadow-sm" 
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          メールアドレス
        </button>
        <button
          onClick={() => setLoginMode("system")}
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
            loginMode === "system" 
              ? "bg-white text-blue-600 shadow-sm" 
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          システム利用番号
        </button>
      </div>

      {loginMode === "email" ? (
        <form onSubmit={handleEmailLogin} className="space-y-5 animate-fade-in">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 ml-1">メールアドレス</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none"
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 ml-1">パスワード</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-mono"
                placeholder="••••••••"
              />
            </div>
          </div>
          <button
            type="submit" disabled={isLoading}
            className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-70 mt-2"
          >
            {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "ログインする"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSystemLogin} className="space-y-5 animate-fade-in">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 ml-1">組織コード（テナントID）</label>
            <div className="relative flex">
              <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-gray-300 bg-gray-100 text-gray-500 sm:text-sm font-bold">SCPS-</span>
              <input
                type="text" required value={tenantId} onChange={(e) => setTenantId(e.target.value.toUpperCase())}
                className="flex-1 block w-full min-w-0 rounded-none rounded-r-xl py-3 px-3 border border-gray-300 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-mono"
                placeholder="XXXXXXXX"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 ml-1">システム利用番号</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building2 className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text" required value={systemId} onChange={(e) => setSystemId(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-mono"
                placeholder="000000"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 ml-1">パスワード（初回は初期パスワード）</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none font-mono"
                placeholder="••••••••"
              />
            </div>
          </div>
          <button
            type="submit" disabled={isLoading}
            className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-70 mt-2"
          >
            {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "ログインする"}
          </button>
        </form>
      )}

      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-white text-gray-500 font-bold">外部アカウントでログイン</span>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => handleSocialLogin(googleProvider)}
            disabled={isLoading}
            className="w-full inline-flex justify-center items-center py-3 px-4 border border-gray-300 rounded-xl shadow-sm bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google
          </button>
          <button
            onClick={() => handleSocialLogin(microsoftProvider)}
            disabled={isLoading}
            className="w-full inline-flex justify-center items-center py-3 px-4 border border-gray-300 rounded-xl shadow-sm bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 21 21"><path d="M0 0h10v10H0z" fill="#f25022"/><path d="M11 0h10v10H11z" fill="#7fba00"/><path d="M0 11h10v10H0z" fill="#00a4ef"/><path d="M11 11h10v10H11z" fill="#ffb900"/></svg>
            Microsoft
          </button>
        </div>
      </div>
    </div>
  );
}