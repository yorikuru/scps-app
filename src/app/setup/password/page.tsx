"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Lock, CheckCircle2, ArrowRight, Loader2, Eye, EyeOff, AlertCircle, Key, Building2, User } from "lucide-react";

export default function SetupPasswordPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // リアルタイム・バリデーション用ステート
  const [validation, setValidation] = useState({
    isMinLength: false,
    hasThreeTypes: false,
    matchConfirm: false,
    isAllValid: false
  });

  // ログイン状態およびユーザー情報・テナント情報の取得
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        try {
          // 1. users コレクションからユーザー情報を取得
          const userDocRef = doc(db, "users", authUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          let fetchedUserData: any = {};
          if (userDoc.exists()) {
            fetchedUserData = userDoc.data();
          }

          // 2. 学校名（テナント名）がユーザーデータに直接ない場合、テナント情報等から補完する
          if (!fetchedUserData.schoolName && fetchedUserData.schoolId) {
            try {
              const schoolDocRef = doc(db, "schools", fetchedUserData.schoolId);
              const schoolDoc = await getDoc(schoolDocRef);
              if (schoolDoc.exists()) {
                fetchedUserData.schoolName = schoolDoc.data().name || schoolDoc.data().schoolName;
              }
            } catch (err) {
              console.warn("Failed to fetch school info:", err);
            }
          }

          setUserData(fetchedUserData);
        } catch (e) {
          console.error("Fetch user error:", e);
        } finally {
          setIsLoading(false);
        }
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // パスワードのリアルタイム検証ロジック
  useEffect(() => {
    const isMinLength = password.length >= 8;

    // 4つのキャラクタータイプチェック
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSymbol = /[@!?#$%&]/.test(password);

    // 何種類使われているかをカウント
    const typeCount = [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;
    const hasThreeTypes = typeCount >= 3;

    const matchConfirm = password.length > 0 && password === confirmPassword;

    setValidation({
      isMinLength,
      hasThreeTypes,
      matchConfirm,
      isAllValid: isMinLength && hasThreeTypes && matchConfirm
    });
  }, [password, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    if (!validation.isAllValid) {
      if (!validation.isMinLength) setAlert({ type: "error", message: "パスワードは8文字以上必要です。" });
      else if (!validation.hasThreeTypes) setAlert({ type: "error", message: "大文字・小文字・数字・記号のうち3種類以上を組み合わせてください。" });
      else if (!validation.matchConfirm) setAlert({ type: "error", message: "確認用パスワードが一致しません。" });
      return;
    }

    if (!user) {
      setAlert({ type: "error", message: "セッションが切れました。再度ログインしてください。" });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updatePassword",
          uid: user.uid,
          email: user.email,
          password: password,
          displayName: userData?.name || user.displayName || ""
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "パスワード更新APIでエラーが発生しました。");
      }

      await updateDoc(doc(db, "users", user.uid), {
        initialPassword: null,
        accountStatus: "active",
        updatedAt: new Date().toISOString()
      });

      setIsSuccess(true);
      setAlert({ type: "success", message: "パスワードを更新しました。" });
    } catch (error: any) {
      console.error("Password update error:", error);
      setAlert({ type: "error", message: error.message || "パスワードの変更に失敗しました。" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingScreen />
      </div>
    );
  }

  // テナント名（学校名）の解決
  const tenantName = userData?.schoolName || userData?.tenantName || userData?.schoolId || "所属テナント";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-indigo-50/30 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-indigo-100 rounded-2xl text-indigo-600">
            <Lock className="h-8 w-8" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">初期パスワードの変更</h2>
        <p className="text-xs text-gray-500 font-bold mt-1.5">
          {userData?.name ? `${userData.name} 様` : "アカウント初期セットアップ"}
        </p>
      </div>

      <div className="w-full sm:max-w-md mx-auto relative z-10">
        <div className="bg-white/90 backdrop-blur-md py-8 px-5 sm:px-10 shadow-xl shadow-gray-200/50 rounded-2xl border border-gray-100">
          
          {/* 所属組織・ユーザー表示カード */}
          {userData && (
            <div className="bg-gradient-to-br from-indigo-50/60 to-blue-50/40 p-4 rounded-xl border border-indigo-100/70 space-y-2 mb-5">
              <div className="flex items-center text-xs font-bold text-indigo-800">
                <Building2 className="h-3.5 w-3.5 mr-1.5 flex-shrink-0 text-indigo-500" />
                <span className="text-gray-500 mr-2">所属組織:</span>
                <span className="truncate text-gray-900">{tenantName}</span>
              </div>
              <div className="flex items-center text-sm font-black text-gray-900">
                <User className="h-4 w-4 mr-1.5 flex-shrink-0 text-indigo-500" />
                <span className="text-xs text-gray-500 font-bold mr-2">対象ユーザー:</span>
                <span className="tracking-wide">{userData.name || "一般ユーザー"} 様</span>
              </div>
            </div>
          )}

          {alert && (
            <div className={`mb-5 p-4 rounded-xl text-xs font-bold border flex items-center gap-2 ${
              alert.type === "success" 
                ? "bg-green-50 text-green-800 border-green-200" 
                : "bg-red-50 text-red-800 border-red-200"
            }`}>
              {alert.type === "success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{alert.message}</span>
            </div>
          )}

          {isSuccess ? (
            <div className="text-center py-6 space-y-5 animate-fade-in">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">変更が完了しました</h3>
                <p className="text-xs text-gray-500 mt-1.5 font-medium leading-relaxed">
                  初期パスワードの変更が正常に完了しました。<br/>セットアップ画面へ進みます。
                </p>
              </div>
              <button
                onClick={() => router.push("/top")}
                className="mt-6 w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-[0.98]"
              >
                初期セットアップを続ける
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">新しいパスワード</label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 border border-gray-200 rounded-xl py-3 text-sm transition-all bg-gray-50 text-gray-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-mono"
                    placeholder="新しいパスワードを入力"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">新しいパスワード（確認用）</label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-10 border border-gray-200 rounded-xl py-3 text-sm transition-all bg-gray-50 text-gray-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-mono"
                    placeholder="確認のためもう一度入力"
                  />
                </div>
              </div>

              {/* リアルタイムチェックリストUI */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2.5">
                <p className="text-xs font-extrabold text-gray-800 border-b border-gray-100 pb-1.5">🔐 パスワードの要件</p>
                
                <div className="flex items-center text-xs font-bold transition-colors">
                  <CheckCircle2 className={`h-4 w-4 mr-2 flex-shrink-0 transition-transform ${validation.isMinLength ? "text-green-500 scale-110" : "text-gray-300"}`} />
                  <span className={validation.isMinLength ? "text-green-700 line-through opacity-80" : "text-gray-600"}>8文字以上であること</span>
                </div>

                <div className="flex items-start text-xs font-bold transition-colors">
                  <CheckCircle2 className={`h-4 w-4 mr-2 flex-shrink-0 mt-0.5 transition-transform ${validation.hasThreeTypes ? "text-green-500 scale-110" : "text-gray-300"}`} />
                  <div className="flex flex-col">
                    <span className={validation.hasThreeTypes ? "text-green-700 line-through opacity-80" : "text-gray-600"}>
                      英大文字、英小文字、数字、記号のうちいずれか3種以上を使用
                    </span>
                  </div>
                </div>

                <div className="flex items-center text-xs font-bold transition-colors border-t border-gray-50 pt-2">
                  <CheckCircle2 className={`h-4 w-4 mr-2 flex-shrink-0 transition-transform ${validation.matchConfirm ? "text-green-500 scale-110" : "text-gray-300"}`} />
                  <span className={validation.matchConfirm ? "text-green-700" : "text-gray-600"}>パスワードが一致していること</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !validation.isAllValid}
                  className={`w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white transition-all active:scale-[0.98] ${
                    validation.isAllValid && !isSubmitting 
                      ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200" 
                      : "bg-gray-300 cursor-not-allowed shadow-none"
                  }`}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      パスワードを確定して保存
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

        </div>
      </div>
    </div>
  );
}