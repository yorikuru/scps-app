"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  createUserWithEmailAndPassword, 
} from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Key, Mail, Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

function PasswordResetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [alert, setAlert] = useState<{ show: boolean; type: "success" | "error"; message: string }>({ show: false, type: "success", message: "" });

  // 1. URLパラメータからユーザー情報を取得
  useEffect(() => {
    if (!uid) {
      setAlert({ show: true, type: "error", message: "無効なアクセスです。ログイン画面からやり直してください。" });
      setIsLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (!userDoc.exists()) {
          setAlert({ show: true, type: "error", message: "ユーザー情報が見つかりません。管理者に確認してください。" });
        } else {
          const data = userDoc.data();
          if (data.accountStatus !== "unaccessed") {
            setAlert({ show: true, type: "error", message: "このアカウントは既に有効化されています。通常のログイン画面からログインしてください。" });
          } else {
            setUserData(data);
            if (data.email) {
              setEmail(data.email);
            }
          }
        }
      } catch (error) {
        console.error("Fetch user error:", error);
        setAlert({ show: true, type: "error", message: "データの読み込みに失敗しました。" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [uid]);

  // 2. アカウントの有効化処理（Firebase Authに登録 ＆ Firestoreのデータを新UIDに移行）
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert({ show: false, type: "success", message: "" });

    if (!email) {
      setAlert({ show: true, type: "error", message: "メールアドレスを入力してください。" });
      return;
    }
    if (password !== passwordConfirm) {
      setAlert({ show: true, type: "error", message: "パスワードが一致しません。" });
      return;
    }
    if (password.length < 6) {
      setAlert({ show: true, type: "error", message: "パスワードは6文字以上で設定してください。" });
      return;
    }

    setIsSubmitting(true);

    try {
      // 2-1. 新しいメールアドレスとパスワードで Firebase Auth にアカウントを作成
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUid = userCredential.user.uid;

      // 2-2. 既存のデータを引き継ぎ、新しいUIDでFirestoreにドキュメントを作成
      const newUserData = {
        ...userData,
        email: email,
        accountStatus: "active", // ステータスを有効化
        authProviders: ["password"],
        updatedAt: new Date().toISOString()
      };
      // 移行が済んだため、初期パスワードのフィールドは削除
      delete newUserData.initialPassword;

      await setDoc(doc(db, "users", newUid), newUserData);

      // 2-3. CSV登録時に発行された古い仮のドキュメントを削除
      await deleteDoc(doc(db, "users", uid!));

      setAlert({ show: true, type: "success", message: "アカウントの有効化が完了しました！ トップページへ移動します..." });

      // 3. 完了後、トップページへリダイレクト
      setTimeout(() => {
        if (newUserData.role === "system_admin") {
          router.push("/system-admin");
        } else {
          router.push("/top");
        }
      }, 1500);

    } catch (error: any) {
      console.error("Setup error:", error);
      let errorMsg = "設定に失敗しました。";
      if (error.code === "auth/email-already-in-use") {
        errorMsg = "このメールアドレスは既に他のアカウントで登録されています。";
      } else if (error.code === "auth/invalid-email") {
        errorMsg = "メールアドレスの形式が正しくありません。";
      } else if (error.message) {
        errorMsg = error.message;
      }
      setAlert({ show: true, type: "error", message: errorMsg });
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px]">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600 mb-4" />
        <p className="text-gray-500 font-bold">アカウント情報を確認中...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
      <div className="bg-blue-600 px-6 py-8 text-center">
        <h2 className="text-2xl font-extrabold text-white tracking-tight">アカウントの有効化</h2>
        <p className="text-blue-100 text-sm mt-2 font-medium">初回設定を完了させてシステムを利用開始しましょう</p>
      </div>

      <div className="p-6 sm:p-8">
        {alert.show && (
          <div className={`mb-6 p-4 rounded-lg text-sm font-bold flex items-start shadow-sm animate-fade-in ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {alert.type === "success" ? <CheckCircle2 className="h-5 w-5 mr-2 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />}
            <span className="block">{alert.message}</span>
          </div>
        )}

        {userData && userData.accountStatus === "unaccessed" ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
              <p className="text-xs text-gray-500 font-bold mb-1">対象アカウント</p>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-gray-900 font-extrabold text-lg">{userData.name}</div>
                  <div className="text-gray-500 text-xs">{userData.schoolName}</div>
                </div>
                <div className="bg-white px-2 py-1 rounded border border-gray-300 text-xs font-mono font-bold text-gray-600">
                  {userData.systemId}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                メールアドレス <span className="text-red-500 ml-1 text-xs">*必須</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">次回以降のログインや通知の受け取りに使用します。</p>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)} 
                  className="block w-full pl-10 border border-gray-300 rounded-lg py-3 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-shadow bg-gray-50 focus:bg-white" 
                  placeholder="you@example.com" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                新しいパスワード <span className="text-red-500 ml-1 text-xs">*必須</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">セキュリティのため、初期パスワードから変更してください。（6文字以上）</p>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} 
                  className="block w-full pl-10 border border-gray-300 rounded-lg py-3 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-shadow bg-gray-50 focus:bg-white" 
                  placeholder="新しいパスワード" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">新しいパスワード（確認用）</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="password" required minLength={6} value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} 
                  className="block w-full pl-10 border border-gray-300 rounded-lg py-3 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-shadow bg-gray-50 focus:bg-white" 
                  placeholder="もう一度入力してください" 
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white transition-all ${
                isSubmitting ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              }`}
            >
              {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : <><CheckCircle2 className="h-5 w-5 mr-2" /> 設定を完了してログイン</>}
            </button>
          </form>
        ) : (
          <div className="text-center py-6">
            <button 
              onClick={() => router.push("/login")}
              className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-sm font-bold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              ログイン画面に戻る
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Next.jsのApp RouterでuseSearchParamsを使用するコンポーネントは、Suspenseで囲む必要があります。
export default function PasswordResetPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <div className="flex items-center justify-center mb-2">
          <img 
            src="/icon.png" 
            alt="SCPS Icon" 
            className="h-10 w-10 object-cover rounded-full shadow-sm mr-3 border border-gray-200" 
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">生徒会ポータルシステム</h2>
        </div>
      </div>
      
      <Suspense fallback={
        <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-xl h-64 flex items-center justify-center border border-gray-100">
          <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
        </div>
      }>
        <PasswordResetContent />
      </Suspense>
    </div>
  );
}