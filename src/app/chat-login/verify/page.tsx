"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, getDocs, collection, query, where, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { Loader2, CheckCircle2, Lock, AlertCircle, MessageCircle } from "lucide-react";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState(""); 
  const [formError, setFormError] = useState("");     
  
  const [userData, setUserData] = useState<any>(null);

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: ""
  });

  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      if (!uid) {
        setGlobalError("無効なリンクです。URLが正しくコピーされているか確認してください。");
        setIsLoading(false);
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, "external_users", uid));
        if (!userDoc.exists()) throw new Error("ユーザー情報が見つかりません。");

        const data = userDoc.data();
        
        if (data.status === "verified") {
          setUserData(data);
          setIsLoading(false);
          return;
        }

        if (data.status !== "verifying" || data.emailVerifyToken !== token) {
          throw new Error("このリンクは既に無効になっているか、使用済みです。");
        }
        if (new Date() > new Date(data.emailVerifyExpires)) {
          throw new Error("リンクの有効期限(24時間)が切れています。もう一度最初からやり直してください。");
        }

        await updateDoc(doc(db, "external_users", uid), {
          status: "verified",
          emailVerifyToken: null,
          emailVerifyExpires: null
        });

        setUserData({...data, status: "verified"});

      } catch (err: any) {
        setGlobalError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    verifyToken();
  }, [uid, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(""); 

    if (formData.newPassword !== formData.confirmPassword) {
      setFormError("パスワードが一致しません。");
      return;
    }
    if (formData.newPassword.length < 8) {
      setFormError("パスワードは8文字以上で設定してください。");
      return;
    }

    setIsSubmitting(true);

    try {
      let authUser;

      try {
        // 1. 新規アカウント作成を試みる
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, formData.newPassword);
        authUser = userCredential.user;
      } catch (authError: any) {
        // 2. すでにFirebase Authにアカウントが存在している場合
        if (authError.code === 'auth/email-already-in-use') {
          // 初期パスワードまたは既存の初期パスワードでログインして、新しいパスワードに更新する
          const userCredential = await signInWithEmailAndPassword(auth, userData.email, userData.initialPassword || formData.newPassword);
          authUser = userCredential.user;
          await updatePassword(authUser, formData.newPassword);
        } else {
          throw authError;
        }
      }

      await updateDoc(doc(db, "external_users", uid!), {
        authUid: authUser.uid,
        status: "active",
        initialPassword: ""
      });

      // ★ ユーザー作成者がいる場合、自動的にチャットルームを作成する
      if (userData.createdBy) {
        const qRoom = query(collection(db, "chat_rooms"), 
          where("type", "==", "direct"),
          where("members", "array-contains", uid)
        );
        const roomsSnap = await getDocs(qRoom);
        const existingRoom = roomsSnap.docs.find(d => d.data().members.includes(userData.createdBy));

        if (!existingRoom) {
          const sysMessageText = `${userData.name}さんがアカウントのセットアップを完了し、チャットに参加しました。`;
          const roomRef = await addDoc(collection(db, "chat_rooms"), {
            schoolId: userData.schoolId,
            type: "direct",
            isOfficial: false,
            name: "",
            members: [uid, userData.createdBy],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: sysMessageText,
            pinnedBy: [],
            unreadCount: {
              [userData.createdBy]: 1 // 作成者側の未読バッジを1にする
            }
          });
          await addDoc(collection(db, "chat_messages"), { 
            roomId: roomRef.id, 
            senderId: "system", 
            text: sysMessageText, 
            readBy: [uid], 
            createdAt: serverTimestamp() 
          });
        }
      }

      await fetch("/api/send-security-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userData.email,
          name: userData.name,
          action: "setup"
        })
      });

      setShowSuccessModal(true);

    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "登録処理に失敗しました。再度お試しください。");
      setIsSubmitting(false); 
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex justify-center items-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (globalError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center font-sans">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-black text-gray-900 mb-2">リンクが無効です</h1>
        <p className="text-sm font-bold text-gray-500 mb-6 leading-relaxed max-w-md">{globalError}</p>
        <button onClick={() => router.push("/chat-login")} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-blue-700 transition-colors">ログイン画面へ戻る</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 font-sans relative">
      <div className="w-full max-w-md relative z-10">
        
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-blue-200">
            <MessageCircle className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">パスワードの設定</h1>
          <p className="text-[11px] font-bold text-gray-500 mt-2">アカウントの有効化 (ステップ 2/2)</p>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 sm:p-10">
          
          <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-xs font-bold text-blue-800 leading-relaxed">
              メールアドレスの確認が完了しました。<br/>
              最後に、今後のログインで使用する「新しいパスワード」を設定してください。
            </p>
          </div>

          {formError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-red-700 leading-relaxed">{formError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">新しいパスワード <span className="text-red-500">*</span></label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={formData.newPassword}
                  onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  placeholder="8文字以上の英数字"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">パスワード (確認用) <span className="text-red-500">*</span></label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  placeholder="もう一度入力してください"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !formData.newPassword || !formData.confirmPassword}
              className={`w-full py-3.5 rounded-xl text-sm font-bold text-white shadow-md transition-all flex justify-center items-center gap-2 mt-8 ${
                isSubmitting || !formData.newPassword || !formData.confirmPassword 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5'
              }`}
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> 設定してチャットを開始する</>}
            </button>
          </form>
        </div>
      </div>

      {/* ＝＝＝ 完了UIモーダル ＝＝＝ */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center transform transition-transform animate-slide-up">
            <div className="p-8">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-emerald-100">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">セットアップ完了！</h2>
              <p className="text-xs font-bold text-gray-500 leading-relaxed">
                パスワードの設定が完了しました。<br/>
                生徒会ポータルシステム<br/> ゲストチャットへ移動します。
              </p>
            </div>
            <div className="p-5 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => router.push("/ext-chat")}
                className="w-full py-3.5 bg-blue-600 text-white font-bold text-sm rounded-xl shadow-md hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                チャットを始める
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExternalChatVerify() {
  return (
    <Suspense fallback={<div className="min-h-screen flex justify-center items-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
      <VerifyContent />
    </Suspense>
  );
}