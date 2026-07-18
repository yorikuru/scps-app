"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  AuthProvider,
  signOut
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { 
  auth, 
  db, 
  googleProvider, 
  microsoftProvider 
} from "@/lib/firebase";

import { Mail, Key, Loader2 } from "lucide-react";

type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>({ show: false, type: "success", message: "" });

  const checkUserAndTenantSettings = async (uid: string, providerId: string) => {
    try {
      const userDocRef = doc(db, "users", uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        throw new Error("ユーザー情報が見つかりません。アカウントが未登録か削除されています。");
      }
      
      const userData = userDoc.data();
      
      // システム管理者の場合はテナントチェックをスキップ
      if (userData.role === "system_admin") {
        return { isSystemAdmin: true, userData };
      }

      const schoolId = userData.schoolId;
      if (!schoolId) {
        throw new Error("所属する学校テナントが設定されていません。");
      }

      const schoolDocRef = doc(db, "schools", schoolId);
      const schoolDoc = await getDoc(schoolDocRef);
      
      if (!schoolDoc.exists()) {
        throw new Error("所属する学校テナントが見つかりません。");
      }

      const schoolData = schoolDoc.data();
      const allowedProviders = schoolData.allowedAuthProviders || ["password"]; 

      let currentProviderType = "password";
      if (providerId === "google.com") currentProviderType = "google";
      if (providerId === "microsoft.com") currentProviderType = "microsoft";

      if (!allowedProviders.includes(currentProviderType) && !allowedProviders.includes("all")) {
        throw new Error(`この組織では ${currentProviderType} によるログインは許可されていません。管理者に確認してください。`);
      }

      return { isSystemAdmin: false, userData };

    } catch (error: any) {
      await signOut(auth);
      throw error;
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert({ show: false, type: "success", message: "" });
    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      const { isSystemAdmin } = await checkUserAndTenantSettings(userCredential.user.uid, "password");

      setAlert({ show: true, type: "success", message: "ログインに成功しました。移動します..." });
      
      setTimeout(() => {
        if (isSystemAdmin) {
          router.push("/system-admin");
        } else {
          router.push("/top");
        }
      }, 1000);
      
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMsg = "ログインに失敗しました。";
      if (error.code === "auth/invalid-credential") {
        errorMsg = "メールアドレスまたはパスワードが間違っています。";
      } else if (error.message) {
        errorMsg = error.message; 
      }
      setAlert({ show: true, type: "error", message: errorMsg });
      setIsLoading(false);
    } 
  };

  const handleSocialLogin = async (provider: AuthProvider) => {
    setAlert({ show: false, type: "success", message: "" });
    setIsLoading(true);

    try {
      const userCredential = await signInWithPopup(auth, provider);
      
      const { isSystemAdmin } = await checkUserAndTenantSettings(userCredential.user.uid, provider.providerId);

      setAlert({ show: true, type: "success", message: "ログインに成功しました。移動します..." });
      
      setTimeout(() => {
        if (isSystemAdmin) {
          router.push("/system-admin");
        } else {
          router.push("/top");
        }
      }, 1000);
      
    } catch (error: any) {
      console.error("Social login error:", error);
      let errorMsg = "ソーシャルログインに失敗しました。";
      if (error.code === "auth/popup-closed-by-user") {
        errorMsg = "ログイン画面が閉じられました。";
      } else if (error.message) {
        errorMsg = error.message; 
      }
      setAlert({ show: true, type: "error", message: errorMsg });
      setIsLoading(false);
    } 
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <h2 className="text-3xl font-extrabold text-gray-900">SCPS ログイン</h2>
        <p className="mt-2 text-sm text-gray-600">生徒会ポータルシステムへようこそ</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        
        {alert.show && (
          <div className={`mb-6 p-4 rounded-md text-sm font-bold ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {alert.message}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleEmailLogin}>
          <div>
            <label className="block text-sm font-bold text-gray-700">メールアドレス</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)} 
                className="block w-full pl-10 border border-gray-300 rounded-md py-3 px-3 focus:ring-blue-500 focus:border-blue-500 text-sm" 
                placeholder="you@example.com" 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700">パスワード</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)} 
                className="block w-full pl-10 border border-gray-300 rounded-md py-3 px-3 focus:ring-blue-500 focus:border-blue-500 text-sm" 
                placeholder="••••••••" 
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-bold text-white ${
              isLoading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            }`}
          >
            {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "ログイン"}
          </button>
        </form>

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500 font-bold">または連携アカウントでログイン</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3">
            <button
              onClick={() => handleSocialLogin(googleProvider)}
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google でログイン
            </button>

            <button
              onClick={() => handleSocialLogin(microsoftProvider)}
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 21 21">
                <path d="M0 0h10v10H0z" fill="#f25022"/><path d="M11 0h10v10H11z" fill="#7fba00"/><path d="M0 11h10v10H0z" fill="#00a4ef"/><path d="M11 11h10v10H11z" fill="#ffb900"/>
              </svg>
              Microsoft でログイン
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}