"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { Loader2, Lock, AlertCircle, MessageCircle, User, CheckCircle2, ShieldCheck, HelpCircle, X, Send } from "lucide-react";

export default function ExternalChatLogin() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(""); 
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const extUsersRef = collection(db, "external_users");
      let qSearch = query(extUsersRef, where("loginId", "==", identifier));
      let querySnapshot = await getDocs(qSearch);

      if (querySnapshot.empty) {
        qSearch = query(extUsersRef, where("email", "==", identifier));
        querySnapshot = await getDocs(qSearch);
      }

      if (querySnapshot.empty) {
        qSearch = query(extUsersRef, where("phoneNumber", "==", identifier));
        querySnapshot = await getDocs(qSearch);
      }

      if (querySnapshot.empty) {
        throw new Error("ユーザーが見つかりません。ID、メールアドレス、または電話番号を確認してください。");
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      if (userData.status === "suspended") {
        throw new Error("このアカウントは現在停止されています。");
      }

      if (userData.status === "pending" || userData.status === "verifying") {
        if (userData.initialPassword !== password) throw new Error("パスワードが正しくありません。");
        router.push(`/chat-login/setup?uid=${userDoc.id}`);
      } else if (userData.status === "verified") {
        if (userData.initialPassword !== password) throw new Error("パスワードが正しくありません。");
        router.push(`/chat-login/verify?uid=${userDoc.id}`);
      } else {
        await signInWithEmailAndPassword(auth, userData.email, password);
        router.push("/ext-chat");
      }

    } catch (err: any) {
      setError(err.message || "ログインに失敗しました。入力内容をご確認ください。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setIsResetting(true);
    
    try {
      const qEmail = query(collection(db, "external_users"), where("email", "==", resetEmail));
      const querySnapshot = await getDocs(qEmail);

      if (querySnapshot.empty) {
        throw new Error("このメールアドレスを持つアカウントが見つかりません。");
      }
      
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      // ★ 自前のランダムな認証用トークンを生成してFirestoreに保存
      const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // 有効期限1時間

      await updateDoc(doc(db, "external_users", userDoc.id), {
        resetToken: resetToken,
        resetTokenExpires: expiresAt.toISOString()
      });

      const resetUrl = `${window.location.origin}/chat-login/reset-password?uid=${userDoc.id}&token=${resetToken}`;

      // ★ 新しく作ったMicrosoft Graph APIを呼び出して確実にお届け
      const response = await fetch('/api/send-reset-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail,
          name: userData.name || "ゲスト",
          resetUrl: resetUrl
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "メールの送信に失敗しました");
      }

      setResetSuccess(true);

    } catch (err: any) {
      setResetError(err.message || "認証メールの送信に失敗しました。");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 font-sans relative">
      
      <div className="hidden md:flex flex-col justify-center w-1/2 bg-blue-700 p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-600 rounded-full blur-3xl opacity-50"></div>
        
        <div className="relative z-10 max-w-lg mx-auto w-full">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">SCPS ゲストチャット</h1>
              <p className="text-sm font-bold text-blue-200 mt-1">生徒会ポータルシステム 外部連携用</p>
            </div>
          </div>
          
          <p className="text-base text-blue-50 leading-relaxed font-medium mb-10">
            このページは、生徒会ポータルシステム（SCPS）を利用している学校の生徒会役員から招待された、外部ユーザー（一般生徒・教職員・お取引先様など）専用のログインページです。
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-blue-800/40 p-4 rounded-xl border border-blue-600/50">
              <ShieldCheck className="w-6 h-6 text-blue-300 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white mb-1">セキュアな通信環境</h3>
                <p className="text-xs text-blue-200 leading-relaxed">
                  やり取りされるメッセージやファイルは暗号化され、安全に保護されています。
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-blue-800/40 p-4 rounded-xl border border-blue-600/50">
              <CheckCircle2 className="w-6 h-6 text-blue-300 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white mb-1">専用のアカウント発行</h3>
                <p className="text-xs text-blue-200 leading-relaxed">
                  生徒会役員から発行された「ログインID」と「初期パスワード」を使用してログインしてください。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10">
        <div className="w-full max-w-md">
          
          <div className="md:hidden text-center mb-10">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-blue-200">
              <MessageCircle className="w-7 h-7 text-blue-600" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">生徒会ポータルシステム<br/>ゲストチャット</h1>
            <p className="text-[11px] font-bold text-gray-500 mt-2">生徒会ポータルシステム 外部連携用</p>
          </div>

          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 sm:p-10">
            <h2 className="text-lg font-black text-gray-900 mb-6 text-center">ログイン</h2>
            
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-700 leading-relaxed">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">ログインID / メールアドレス / 電話番号</label>
                <div className="relative group">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    placeholder="いずれかを入力"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-gray-700">パスワード</label>
                  <button 
                    type="button" 
                    onClick={() => setShowForgotModal(true)}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    パスワードを忘れた場合
                  </button>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !identifier || !password}
                className={`w-full py-3.5 rounded-xl text-sm font-bold text-white shadow-md transition-all flex justify-center items-center gap-2 mt-8 ${
                  isLoading || !identifier || !password 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5'
                }`}
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "ログインして進む"}
              </button>
            </form>
          </div>
          
          <div className="mt-10 text-center">
            <p className="text-[9px] font-medium text-gray-400 leading-relaxed bg-gray-100/50 p-4 rounded-xl border text-red-600 border-gray-200/50">
              ※初回ログイン時の方は、仮登録時に発行された<br className="sm:hidden" />初期パスワードを入力してください。
            </p>
          </div>

          <div className="flex flex-col gap-1.5 text-[9px] font-bold text-gray-500 text-center">
            <br/><br/>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
              <Link href="/legal/terms" className="hover:text-gray-300 transition-colors">利用規約</Link>
              <Link href="/legal/privacy" className="hover:text-gray-300 transition-colors">プライバシー</Link>
              <Link href="/legal/commercial" className="hover:text-gray-300 transition-colors">特定商取引法</Link>
            </div>
            <div className="text-[8px] text-gray-600 mt-0.5">
              &copy; {new Date().getFullYear()} YORIKURU / 生徒会ポータルシステム
            </div>
          </div>

        </div>
      </div>

      {/* ＝＝ パスワード忘れ救済 モーダル ＝＝ */}
      {showForgotModal && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
            
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                パスワードの再設定
              </h3>
              <button 
                onClick={() => { setShowForgotModal(false); setResetSuccess(false); }} 
                className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {resetSuccess ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                    <Send className="w-7 h-7 text-blue-600 ml-1" />
                  </div>
                  <h4 className="text-base font-black text-gray-900 mb-2">認証メールを送信しました</h4>
                  <p className="text-xs font-medium text-gray-600 leading-relaxed mb-6">
                    入力されたアドレスに本人確認用の認証リンクを送信しました。メールをご確認ください。
                  </p>
                  <button 
                    onClick={() => { setShowForgotModal(false); setResetSuccess(false); }}
                    className="w-full py-2.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    閉じる
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <p className="text-[11px] font-medium text-gray-500 leading-relaxed mb-4 bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                    ご登録済みのメールアドレスを入力してください。<br/>
                    本人確認のためのメール認証リンクをお送りします。リンクからパスワードの再設定を行えます。
                  </p>

                  {resetError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-[10px] font-bold text-red-700 leading-relaxed">{resetError}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1.5">メールアドレス</label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="yamada@example.com"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isResetting || !resetEmail}
                    className={`w-full py-3 rounded-xl text-sm font-bold text-white transition-all flex justify-center items-center gap-2 mt-4 ${
                      isResetting || !resetEmail ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md'
                    }`}
                  >
                    {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : "認証メールを送信する"}
                  </button>
                </form>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}