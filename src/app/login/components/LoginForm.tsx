"use client";

import React from "react";
import { Mail, Key, Building, IdCard, LogIn, Loader2 } from "lucide-react";
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
  handleEmailLogin, handleSystemLogin, handleSocialLogin, googleProvider, microsoftProvider
}: Props) {
  return (
    <div className="w-full max-w-md mx-auto bg-white/80 backdrop-blur-md py-8 px-6 sm:px-10 shadow-xl shadow-gray-200/50 rounded-2xl border border-gray-100/80 transition-all">
      <div className="flex mb-6 bg-gray-100 p-1 rounded-xl">
        <button 
          onClick={() => setLoginMode("email")} 
          className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center ${loginMode === "email" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Mail className="h-4 w-4 mr-2" /> メールアドレス
        </button>
        <button 
          onClick={() => setLoginMode("system")} 
          className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center ${loginMode === "system" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          <IdCard className="h-4 w-4 mr-2" /> テナントIDログイン
        </button>
      </div>

      {loginMode === "email" ? (
        <form className="space-y-4" onSubmit={handleEmailLogin}>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">メールアドレス</label>
            <div className="relative rounded-lg shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-gray-400" />
              </div>
              <input 
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)} 
                className="block w-full pl-10 border border-gray-200 rounded-xl py-3 px-3 text-sm transition-all bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
                placeholder="you@example.com" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">パスワード</label>
            <div className="relative rounded-lg shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="h-4 w-4 text-gray-400" />
              </div>
              <input 
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)} 
                className="block w-full pl-10 border border-gray-200 rounded-xl py-3 px-3 text-sm transition-all bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
                placeholder="••••••••" 
              />
            </div>
          </div>

          <button
            type="submit" disabled={isLoading}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white transition-all bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <><LogIn className="h-4 w-4 mr-2" /> ログイン</>}
          </button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={handleSystemLogin}>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">テナントID (学校コード)</label>
            <div className="flex rounded-xl shadow-sm overflow-hidden">
              <span className="inline-flex items-center px-3 border border-r-0 border-gray-200 bg-gray-100 text-gray-500 font-bold text-xs font-mono">
                <Building className="h-4 w-4 mr-1 text-gray-400" /> SCPS-
              </span>
              <input 
                type="text" required value={tenantId} 
                onChange={(e) => setTenantId(e.target.value.replace(/[^0-9]/g, ''))}
                className="flex-1 block w-full border border-gray-200 py-3 px-3 text-sm font-mono transition-all bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
                placeholder="00000000" maxLength={10}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">システム利用番号</label>
            <div className="relative rounded-lg shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <IdCard className="h-4 w-4 text-gray-400" />
              </div>
              <input 
                type="text" required value={systemId} onChange={(e) => setSystemId(e.target.value)} 
                className="block w-full pl-10 border border-gray-200 rounded-xl py-3 px-3 text-sm font-mono transition-all bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
                placeholder="STU0001" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">パスワード</label>
            <div className="relative rounded-lg shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="h-4 w-4 text-gray-400" />
              </div>
              <input 
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)} 
                className="block w-full pl-10 border border-gray-200 rounded-xl py-3 px-3 text-sm transition-all bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
                placeholder="••••••••" 
              />
            </div>
          </div>

          <button
            type="submit" disabled={isLoading}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white transition-all bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <><LogIn className="h-4 w-4 mr-2" /> ログイン</>}
          </button>
        </form>
      )}

      <div className="mt-6">
        <div className="relative flex justify-center text-xs mb-4">
          <span className="px-3 bg-white text-gray-400 font-bold text-xs tracking-wider">または連携アカウントでログイン</span>
          <div className="absolute inset-y-1/2 left-0 right-0 border-t border-gray-200 -z-10" />
        </div>

        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => handleSocialLogin(googleProvider)} disabled={isLoading}
            className="w-full flex justify-center items-center py-2.5 px-4 border border-gray-200 rounded-xl shadow-sm bg-white text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            <svg className="h-4 w-4 mr-2.5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google でログイン
          </button>

          <button
            onClick={() => handleSocialLogin(microsoftProvider)} disabled={isLoading}
            className="w-full flex justify-center items-center py-2.5 px-4 border border-gray-200 rounded-xl shadow-sm bg-white text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            <svg className="h-4 w-4 mr-2.5" viewBox="0 0 21 21">
              <path d="M0 0h10v10H0z" fill="#f25022"/><path d="M11 0h10v10H11z" fill="#7fba00"/><path d="M0 11h10v10H0z" fill="#00a4ef"/><path d="M11 11h10v10H11z" fill="#ffb900"/>
            </svg>
            Microsoft でログイン
          </button>
        </div>
      </div>
    </div>
  );
}