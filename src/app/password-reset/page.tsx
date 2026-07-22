"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ShieldCheck, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import ResetForm from "./components/ResetForm";

function PasswordResetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const oobCode = searchParams.get("oobCode"); 
  const directUid = searchParams.get("uid"); 
  
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // 対象アカウントの表示用情報を管理
  const [accountInfo, setAccountInfo] = useState<{ name: string; schoolName: string } | null>(null);

  // トークン検証と同時にFirestoreから該当ユーザー名と学校名を特定するエモいエフェクト
  useEffect(() => {
    const fetchAccountMetadata = async (targetEmail: string) => {
      try {
        const usersQ = query(collection(db, "users"), where("email", "==", targetEmail));
        const userSnap = await getDocs(usersQ);
        if (!userSnap.empty) {
          const uData = userSnap.docs[0].data();
          setAccountInfo({
            name: uData.name || "一般ユーザー",
            schoolName: uData.schoolName || "所属テナント"
          });
        }
      } catch (e) {
        console.error("Failed to fetch user metadata", e);
      }
    };

    if (oobCode) {
      setIsValidatingToken(true);
      verifyPasswordResetCode(auth, oobCode)
        .then((email) => {
          // トークンから判明したメールアドレスをキーに情報を引っ張る
          if (email) fetchAccountMetadata(email);
          setIsValidatingToken(false);
        })
        .catch(() => {
          setAlert({ type: "error", message: "この認証リンクは無効か、有効期限（1時間）が切れています。もう一度管理画面から発行し直してください。" });
          setIsValidatingToken(false);
        });
    } else if (directUid) {
      // 直接UIDルート（未アクセスユーザー等）の場合のフェッチ
      setIsValidatingToken(true);
      getDoc(doc(db, "users", directUid)).then((snap) => {
        if (snap.exists()) {
          const uData = snap.data();
          setAccountInfo({
            name: uData.name || "新規ユーザー",
            schoolName: uData.schoolName || "所属テナント"
          });
        }
        setIsValidatingToken(false);
      }).catch(() => setIsValidatingToken(false));
    }
  }, [oobCode, directUid]);

  const handlePasswordUpdate = async (newPassword: string) => {
    setIsLoading(true);
    setAlert(null);

    try {
      if (oobCode) {
        await confirmPasswordReset(auth, oobCode, newPassword);
        setIsSuccess(true);
      } else if (directUid) {
        await updateDoc(doc(db, "users", directUid), {
          initialPassword: null,
          updatedAt: new Date().toISOString()
        });
        setIsSuccess(true);
      } else {
        throw new Error("無効なアクセスです。認証情報が見つかりません。");
      }
    } catch (error: any) {
      console.error("Reset update error:", error);
      setAlert({ type: "error", message: error.message || "パスワードの更新に失敗しました。" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-blue-50/30 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="flex items-center justify-center mb-4">
          <img 
            src="/icon.png" 
            alt="SCPS Icon" 
            className="h-14 w-14 object-cover rounded-full shadow-sm border border-gray-200"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">生徒会ポータルシステム</h2>
        <p className="text-xs text-gray-400 font-bold mt-1.5 uppercase tracking-widest">Security Credentials Management</p>
      </div>

      <div className="w-full sm:max-w-md mx-auto relative z-10">
        <div className="bg-white/90 backdrop-blur-md py-8 px-5 sm:px-10 shadow-xl shadow-gray-200/60 rounded-2xl border border-gray-100/90">
          
          {alert && (
            <div className={`mb-5 p-4 rounded-xl text-xs font-bold border ${alert.type === "success" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"}`}>
              {alert.message}
            </div>
          )}

          {isSuccess ? (
            <div className="text-center py-6 space-y-5 animate-fade-in">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">パスワードを設定しました</h3>
                <p className="text-xs text-gray-400 mt-1.5 font-medium">
                  新しいパスワードの登録が完了しました。<br/>ログイン画面から新しいパスワードでアクセスしてください。
                </p>
              </div>
              <button
                onClick={() => router.push("/login")}
                className="mt-6 w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all active:scale-[0.98]"
              >
                ログイン画面へ進む
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </button>
            </div>
          ) : (
            <div>
              <div className="text-center mb-4">
                <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 mr-1.5 text-blue-600" />
                  パスワードの新規設定
                </h3>
              </div>
              <ResetForm onSubmit={handlePasswordUpdate} isLoading={isLoading} isValidatingToken={isValidatingToken} accountInfo={accountInfo} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PasswordResetPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
      </div>
    }>
      <PasswordResetContent />
    </Suspense>
  );
}