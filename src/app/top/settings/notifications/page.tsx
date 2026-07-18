"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { 
  ArrowLeft, Bell, BellOff, MessageCircle, AlertCircle, 
  CheckCircle, Loader2, Link as LinkIcon, Smartphone, ShieldAlert
} from "lucide-react";

type UserData = {
  id: string;
  name: string;
  lineUserId?: string;
  lineNotificationEnabled?: boolean;
};

function NotificationSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingLine, setIsProcessingLine] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error", message: string } | null>(null);

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = { ...userDoc.data(), id: userDoc.id } as UserData;
            setUserData(data);

            const code = searchParams.get("code");
            if (code && !data.lineUserId) {
              setIsProcessingLine(true);
              await handleLineCallback(code, user.uid);
            }
          } else {
            router.push("/login");
          }
        } catch (error) {
          console.error("Fetch error:", error);
          showAlert("error", "データの取得に失敗しました。");
        } finally {
          setIsLoading(false);
        }
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router, searchParams]);

  const handleLineCallback = async (code: string, uid: string) => {
    try {
      const redirectUri = `${window.location.origin}/top/settings/notifications`;
      
      const response = await fetch("/api/line/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, redirectUri }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "連携に失敗しました。");
      }

      const newLineUserId = data.lineUserId;

      await updateDoc(doc(db, "users", uid), {
        lineUserId: newLineUserId,
        lineNotificationEnabled: true,
      });

      setUserData(prev => prev ? { ...prev, lineUserId: newLineUserId, lineNotificationEnabled: true } : null);
      
      router.replace("/top/settings/notifications");
      showAlert("success", "LINEとの連携が完了しました！");

    } catch (error: any) {
      console.error("LINE linking error:", error);
      showAlert("error", error.message || "LINE連携処理中にエラーが発生しました。");
    } finally {
      setIsProcessingLine(false);
    }
  };

  const startLineLinking = () => {
    const clientId = process.env.NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID || "2010747597";
    const redirectUri = encodeURIComponent(`${window.location.origin}/top/settings/notifications`);
    const state = userData?.id || "random_state";
    
    // ★修正ポイント：URLの最後に &bot_prompt=aggressive を追加しました
    // これにより、連携画面の直後に「友だち追加しますか？」という画面が強制的に表示されます。
    window.location.href = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=profile&bot_prompt=aggressive`;
  };

  const toggleNotification = async (enabled: boolean) => {
    if (!userData) return;
    setIsSaving(true);
    
    try {
      await updateDoc(doc(db, "users", userData.id), {
        lineNotificationEnabled: enabled,
      });
      setUserData(prev => prev ? { ...prev, lineNotificationEnabled: enabled } : null);
      showAlert("success", enabled ? "LINE通知をオンにしました。" : "LINE通知をオフにしました。");
    } catch (error) {
      console.error("Update error:", error);
      showAlert("error", "設定の保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const unlinkLine = async () => {
    if (!userData) return;
    if (!window.confirm("LINE連携を解除しますか？\nシステムの通知がLINEに届かなくなります。")) return;
    
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", userData.id), {
        lineUserId: null,
      });
      setUserData(prev => prev ? { ...prev, lineUserId: undefined, lineNotificationEnabled: false } : null);
      showAlert("success", "LINE連携を解除しました。");
    } catch (error) {
      console.error("Unlink error:", error);
      showAlert("error", "解除に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || isProcessingLine) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin h-10 w-10 text-[#06C755] mb-4" />
        <p className="text-sm font-bold text-gray-500">
          {isProcessingLine ? "LINEと連携中..." : "データを読み込み中..."}
        </p>
      </div>
    );
  }

  const isLinked = !!userData?.lineUserId;
  const isEnabled = userData?.lineNotificationEnabled !== false;

  return (
    <div className="space-y-6">
      
      {alert && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className={`p-4 rounded-lg shadow-lg flex items-center border-l-4 ${alert.type === "success" ? "bg-white border-[#06C755] text-green-800" : "bg-white border-red-500 text-red-800"}`}>
            {alert.type === "success" ? <CheckCircle className="h-6 w-6 text-[#06C755] mr-3" /> : <AlertCircle className="h-6 w-6 text-red-500 mr-3" />}
            <span className="font-bold text-sm">{alert.message}</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center text-gray-900 font-extrabold">
            <MessageCircle className="h-5 w-5 mr-2 text-[#06C755]" fill="currentColor" stroke="none" />
            LINE連携ステータス
          </div>
          {isLinked ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#e6faed] text-[#00993c]">
              <CheckCircle className="h-3 w-3 mr-1" /> 連携済み
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-600">
              未連携
            </span>
          )}
        </div>
        
        <div className="p-6">
          {!isLinked ? (
            <div className="text-center py-6">
              <Smartphone className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-base font-bold text-gray-900 mb-2">LINEアカウントを連携して通知を受け取る</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto leading-relaxed">
                アンケートの回答期限や、生徒会からの重要なお知らせを使い慣れたLINEで直接受け取ることができます。
              </p>
              <button
                onClick={startLineLinking}
                className="inline-flex items-center px-6 py-3 border border-transparent rounded-full shadow-sm text-sm font-extrabold text-white bg-[#06C755] hover:bg-[#05b34c] focus:outline-none transition-colors"
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                LINEと連携する
              </button>
            </div>
          ) : (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#f0fbf4] rounded-lg p-4 border border-[#b3efca]">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">現在のアカウントはLINEと連携されています</h3>
                  <p className="text-xs text-gray-600">システムの通知が指定した設定に従ってLINEに送信されます。</p>
                </div>
                <button
                  onClick={unlinkLine}
                  disabled={isSaving}
                  className="whitespace-nowrap text-xs font-bold text-gray-500 hover:text-red-600 transition-colors px-3 py-1.5 border border-gray-300 hover:border-red-200 rounded-md bg-white disabled:opacity-50"
                >
                  連携を解除する
                </button>
              </div>

              <div className="mt-8">
                <h3 className="text-sm font-extrabold text-gray-900 mb-4 border-b border-gray-100 pb-2">
                  通知の受信設定
                </h3>
                
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center pr-4">
                    <div className={`p-2 rounded-full mr-4 ${isEnabled ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                      {isEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">通常のお知らせ・リマインダー</div>
                      <div className="text-xs text-gray-500 mt-0.5">アンケート等の一般的な通知をLINEで受け取ります。</div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => toggleNotification(!isEnabled)}
                    disabled={isSaving}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${isEnabled ? 'bg-purple-600' : 'bg-gray-200'} disabled:opacity-50`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="mt-4 flex items-start p-3 bg-blue-50 rounded-lg">
                  <ShieldAlert className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed font-medium">
                    管理者が指定した「重要なお知らせ」は、システム全体への確実な情報伝達のため、上記の受信設定がオフの場合でも強制的にLINEへ配信されます。あらかじめご了承ください。
                  </p>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default function NotificationsSettingsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <button
            onClick={() => router.back()}
            className="mr-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex items-center text-gray-900">
            <Bell className="h-5 w-5 mr-2 text-purple-600" />
            <h1 className="text-lg font-bold">通知設定</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="animate-spin h-8 w-8 text-purple-600" /></div>}>
          <NotificationSettingsContent />
        </Suspense>
      </main>
    </div>
  );
}