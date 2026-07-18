"use client";

import React, { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ShieldAlert, Loader2, CheckCircle2, AlertCircle, Key, Mail, User as UserIcon } from "lucide-react";

type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

export default function InitAdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("システム管理者");
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>({ show: false, type: "success", message: "" });

  const handleCreateOrUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert({ show: false, type: "success", message: "" });
    setIsLoading(true);

    try {
      let userUid = "";

      // 1. アカウントの作成またはログインを試行
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        userUid = userCredential.user.uid;
      } catch (authError: any) {
        if (authError.code === "auth/email-already-in-use") {
          // 既に存在する場合はログインしてUIDを取得
          const loginCredential = await signInWithEmailAndPassword(auth, email, password);
          userUid = loginCredential.user.uid;
        } else {
          throw authError;
        }
      }

      // 2. Firestoreに特権管理者としてのデータを書き込む（上書き）
      const userDocRef = doc(db, "users", userUid);
      await setDoc(userDocRef, {
        name: name,
        email: email,
        role: "system_admin",
        schoolId: "YORIKURU_SYSTEM", // システム管理者専用のダミーテナントID
        accountStatus: "active",
        createdAt: new Date().toISOString()
      }, { merge: true });

      setAlert({ show: true, type: "success", message: "特権管理者アカウントの初期化が完了しました。システム管理者ダッシュボードにログインできます。" });
      
    } catch (error: any) {
      console.error("Setup error:", error);
      let errorMsg = "アカウントのセットアップに失敗しました。";
      if (error.code === "auth/weak-password") errorMsg = "パスワードは6文字以上で入力してください。";
      if (error.code === "auth/wrong-password") errorMsg = "既存アカウントのパスワードが間違っています。";
      setAlert({ show: true, type: "error", message: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <ShieldAlert className="mx-auto h-12 w-12 text-blue-500" />
        <h2 className="mt-4 text-3xl font-extrabold text-white">YORIKURU 初期セットアップ</h2>
        <p className="mt-2 text-sm text-gray-400">特権管理者（system_admin）アカウントを生成します。</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md bg-gray-800 py-8 px-4 shadow-2xl sm:rounded-lg sm:px-10 border border-gray-700">
        
        {alert.show && (
          <div className={`mb-6 p-4 rounded-md text-sm font-bold flex items-center ${alert.type === "success" ? "bg-green-900 text-green-200 border border-green-700" : "bg-red-900 text-red-200 border border-red-700"}`}>
            {alert.type === "success" ? <CheckCircle2 className="mr-2 h-5 w-5 flex-shrink-0" /> : <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />}
            {alert.message}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleCreateOrUpdateAdmin}>
          <div>
            <label className="block text-sm font-bold text-gray-300">管理者名</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-gray-500" />
              </div>
              <input 
                type="text" required value={name} onChange={(e) => setName(e.target.value)} 
                className="block w-full pl-10 border border-gray-600 bg-gray-700 rounded-md py-3 px-3 text-white focus:ring-blue-500 focus:border-blue-500 text-sm" 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-300">メールアドレス</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-500" />
              </div>
              <input 
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)} 
                className="block w-full pl-10 border border-gray-600 bg-gray-700 rounded-md py-3 px-3 text-white focus:ring-blue-500 focus:border-blue-500 text-sm" 
                placeholder="admin@example.com" 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-300">パスワード（新規設定または既存パスワード）</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="h-5 w-5 text-gray-500" />
              </div>
              <input 
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)} 
                className="block w-full pl-10 border border-gray-600 bg-gray-700 rounded-md py-3 px-3 text-white focus:ring-blue-500 focus:border-blue-500 text-sm" 
                placeholder="••••••••" minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-bold text-white transition-colors ${
              isLoading ? "bg-blue-800 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isLoading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <ShieldAlert className="h-5 w-5 mr-2" />}
            {isLoading ? "処理中..." : "特権管理者を生成・上書きする"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">※完了後はこのページを削除してください。</p>
          <a href="/login" className="mt-2 inline-block text-sm font-bold text-blue-400 hover:text-blue-300">ログイン画面へ戻る</a>
        </div>
      </div>
    </div>
  );
}