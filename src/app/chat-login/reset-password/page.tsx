"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Lock, AlertCircle, CheckCircle2, MessageCircle } from "lucide-react";

export default function ExternalResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [status, setStatus] = useState<"verifying" | "input" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // APIに渡すための情報（アカウント新規作成用フォールバック）
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (!uid || !token) {
      setStatus("error");
      setErrorMessage("無効なリンクです。URLが正しくコピーされているか確認してください。");
      return;
    }

    const verifyToken = async () => {
      try {
        const userDoc = await getDoc(doc(db, "external_users", uid));
        if (!userDoc.exists()) throw new Error("ユーザーが見つかりません。");

        const data = userDoc.data();
        if (data.resetToken !== token) {
          throw new Error("認証トークンが無効か、すでに使用されています。");
        }

        if (data.resetTokenExpires && new Date(data.resetTokenExpires) < new Date()) {
          throw new Error("リンクの有効期限が切れています。もう一度パスワードリセットをやり直してください。");
        }

        // メールと名前を保持しておく
        setUserEmail(data.email || "");
        setUserName(data.name || "");

        setStatus("input");
      } catch (err: any) {
        setStatus("error");
        setErrorMessage(err.message || "トークンの検証に失敗しました。");
      }
    };

    verifyToken();
  }, [uid, token]);

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (newPassword !== confirmPassword) {
      setErrorMessage("パスワードが一致しません。");
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage("パスワードは6文字以上で設定してください。");
      return;
    }

    setIsSubmitting(true);

    try {
      if (!uid) throw new Error("UIDが不明です");

      // 1. APIを呼び出して、Firebase Auth側のパスワードを更新（または新規作成）する
      const res = await fetch("/api/update-ext-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          uid, 
          newPassword,
          email: userEmail,
          name: userName 
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "パスワードの更新に失敗しました。");
      }

      // 2. Firestoreのステータスを "active" にして完了とする（ループ防止）
      await updateDoc(doc(db, "external_users", uid), {
        status: "active",
        initialPassword: "", // 初期パスワードはクリアして無効化
        resetToken: null,
        resetTokenExpires: null,
        updatedAt: new Date().toISOString(),
      });

      setStatus("success");

    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "パスワードの設定に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-gray-50 font-sans">
      
      <div className="w-full max-w-md text-center mb-8">
        <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-blue-200">
          <MessageCircle className="w-7 h-7 text-blue-600" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">生徒会ポータルシステム <br/> ゲストチャット</h1>
        <p className="text-[11px] font-bold text-gray-500 mt-2">パスワードの再設定</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 sm:p-10">
        
        {status === "verifying" && (
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
            <p className="text-sm font-bold text-gray-600">認証リンクを確認しています...</p>
          </div>
        )}

        {status === "error" && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-lg font-black text-gray-900 mb-2">認証に失敗しました</h2>
            <p className="text-xs font-bold text-gray-600 leading-relaxed mb-8">{errorMessage}</p>
            <button
              onClick={() => router.push("/chat-login")}
              className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-md hover:bg-black transition-all"
            >
              ログイン画面に戻る
            </button>
          </div>
        )}

        {status === "success" && (
          <div className="text-center py-6 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-lg font-black text-gray-900 mb-2">再設定が完了しました</h2>
            <p className="text-xs font-medium text-gray-600 leading-relaxed mb-8">
              新しいパスワードが設定されました。<br />今後はこのパスワードを使用してログインしてください。
            </p>
            <button
              onClick={() => router.push("/chat-login")}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 transition-all"
            >
              ログイン画面へ進む
            </button>
          </div>
        )}

        {status === "input" && (
          <>
            <h2 className="text-base font-black text-gray-900 mb-6 text-center">新しいパスワードを設定</h2>
            
            {errorMessage && (
              <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-700 leading-relaxed">{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">新しいパスワード (6文字以上)</label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">パスワード (確認用)</label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    placeholder="もう一度入力"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !newPassword || !confirmPassword}
                className={`w-full py-3.5 rounded-xl text-sm font-bold text-white shadow-md transition-all flex justify-center items-center gap-2 mt-6 ${
                  isSubmitting || !newPassword || !confirmPassword 
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "パスワードを保存する"}
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  );
}