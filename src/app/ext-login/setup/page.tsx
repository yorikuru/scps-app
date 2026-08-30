"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";

import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, User, Mail, Phone, AlertCircle, MessageCircle, Send, ShieldCheck, CheckCircle2 } from "lucide-react";
import LoadingScreen from "@/components/LoadingScreen";

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isSent, setIsSent] = useState(false); 
  
  const [initialData, setInitialData] = useState<any>(null);

  const [formData, setFormData] = useState({
    nameKana: "",
    email: "",
    phoneNumber: "",
  });

  useEffect(() => {
    const fetchUserData = async () => {
      if (!uid) {
        setError("不正なアクセスです。ログイン画面からやり直してください。");
        setIsLoading(false);
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, "external_users", uid));
        if (!userDoc.exists()) throw new Error("ユーザー情報が見つかりません。");

        const data = userDoc.data();
        if (data.status === "active" || data.status === "suspended") {
          router.push("/ext-login");
          return;
        }

        // ★ すでにメールのURLをクリック済みの場合は直接パスワード設定へ
        if (data.status === "verified") {
          router.push(`/ext-login/verify?uid=${uid}`);
          return;
        }

        // ★ メール送信待ち状態で離脱していた場合は、送信済み画面を復元
        if (data.status === "verifying") {
          setIsSent(true);
        }

        setInitialData(data);
        setFormData(prev => ({
          ...prev,
          nameKana: data.nameKana || "",
          email: data.email || "",
          phoneNumber: data.phoneNumber || "",
        }));
      } catch (err: any) {
        setError(err.message || "データの取得に失敗しました。");
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, [uid, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.email || !formData.nameKana || !formData.phoneNumber) {
      setError("すべての項目を入力してください。");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); 

      await updateDoc(doc(db, "external_users", uid!), {
        nameKana: formData.nameKana,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        status: "verifying", 
        emailVerifyToken: token,
        emailVerifyExpires: expires
      });

      const baseUrl = window.location.origin;
      const verifyUrl = `${baseUrl}/ext-login/verify?uid=${uid}&token=${token}`;

      const res = await fetch("/api/send-verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          name: initialData.name,
          verifyUrl: verifyUrl
        })
      });

      if (!res.ok) throw new Error("メールの送信に失敗しました。");
      setIsSent(true);

    } catch (err: any) {
      console.error(err);
      setError("処理に失敗しました。再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isSent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 font-sans">
        <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-xl border border-gray-100 text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Send className="w-10 h-10 text-blue-600 ml-1" />
          </div>
          <h1 className="text-xl font-black text-gray-900 mb-4 tracking-tight">確認メールを送信しました</h1>
          <p className="text-sm font-medium text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl">
            ご入力いただいたメールアドレスに、パスワード設定用のURLを送信しました。<br/><br/>
            メールをご確認いただき、記載されたURLをクリックしてセットアップを完了させてください。
          </p>
          
          {/* ★ アドレスを間違えた場合に戻れるボタン */}
          <button 
            onClick={() => setIsSent(false)} 
            className="mt-8 text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors underline"
          >
            メールが届かない場合は、アドレスを変更して再送信する
          </button>
        </div>
      </div>
    );
  }

  if (error && !initialData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 font-sans">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-black text-gray-900 mb-2">エラーが発生しました</h1>
        <p className="text-sm font-bold text-gray-500">{error}</p>
        <button onClick={() => router.push("/ext-login")} className="mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-blue-700 transition-colors">ログイン画面に戻る</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 font-sans">
      <div className="hidden md:flex flex-col justify-center w-1/2 bg-blue-700 p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-600 rounded-full blur-3xl opacity-50"></div>
        
        <div className="relative z-10 max-w-lg mx-auto w-full">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">アカウントの有効化</h1>
              <p className="text-sm font-bold text-blue-200 mt-1">生徒会ポータルシステム ゲストチャット 初回セットアップ (1/2)</p>
            </div>
          </div>
          
          <p className="text-base text-blue-50 leading-relaxed font-medium mb-8">
            アカウントを安全にご利用いただくために、連絡先の登録とメールアドレスの本人確認を行います。
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-blue-800/40 p-4 rounded-xl border border-blue-600/50">
              <Mail className="w-6 h-6 text-blue-300 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white mb-1">メールアドレスの登録・確認</h3>
                <p className="text-xs text-blue-200 leading-relaxed">
                  不正な利用を防ぐため、ご登録いただいたメールアドレス宛に確認用のURLを送信します。
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-blue-800/40 p-4 rounded-xl border border-blue-600/50">
              <ShieldCheck className="w-6 h-6 text-blue-300 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white mb-1">その後にパスワード設定</h3>
                <p className="text-xs text-blue-200 leading-relaxed">
                  メールのURLをクリックした先で、ご自身専用の新しいパスワードを設定していただきます。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 relative z-10 overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-lg">
          
          <div className="md:hidden text-center mb-8 mt-4">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm border border-blue-200">
              <MessageCircle className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">アカウントの有効化</h1>
            <p className="text-[11px] font-bold text-gray-500 mt-2">連絡先のご登録 (ステップ 1/2)</p>
          </div>

          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 sm:p-8">
            
            <div className="mb-8 p-5 bg-white border-l-4 border-blue-600 shadow-sm rounded-r-xl border-y border-r border-gray-100">
              <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-4">アカウント情報</h3>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 mb-0.5">お名前</span>
                  <span className="text-lg font-black text-gray-900">
                    {initialData?.name} <span className="text-xs font-bold text-gray-500 ml-1">様</span>
                  </span>
                </div>
                <div className="w-full h-px bg-gray-100"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 mb-0.5">所属・団体名</span>
                  <span className="text-sm font-bold text-gray-800">{initialData?.affiliation || "未設定"}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-700 leading-relaxed">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-5">
                <h3 className="text-xs font-black text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                  <User className="w-4 h-4 text-blue-500"/> 個人情報ご登録（全ての項目をご入力ください）
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1.5">ふりがな <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={formData.nameKana}
                      onChange={(e) => setFormData({...formData, nameKana: e.target.value})}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      placeholder="やまだ たろう"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1.5">電話番号 <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      required
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      placeholder="090-0000-0000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1.5">メールアドレス <span className="text-red-500">*</span></label>
                  <p className="text-[10px] text-gray-500 mb-2 font-medium">※確認メールを送信します。次回以降のログインにも使用します。</p>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      placeholder="yamada@example.com"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !formData.email || !formData.nameKana || !formData.phoneNumber}
                className={`w-full py-3.5 rounded-xl text-sm font-bold text-white shadow-md transition-all flex justify-center items-center gap-2 mt-8 ${
                  isSubmitting || !formData.email || !formData.nameKana || !formData.phoneNumber 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5'
                }`}
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> 確認メールを送信する</>}
              </button>
            </form>

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
    </div>
  );
}

export default function ExternalChatSetup() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SetupContent />
    </Suspense>
  );
}