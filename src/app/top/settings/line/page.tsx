"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { 
  ArrowLeft, MessageCircle, Send, CheckCircle, AlertCircle, 
  Loader2, Info, Settings, Smartphone, UserCheck
} from "lucide-react";
import { sendLineToAdmin, sendLineMessage, sendNotificationToUser } from "@/lib/line";

type UserData = {
  id: string;
  name: string;
  role: string;
  lineUserId?: string;
  lineNotificationEnabled?: boolean;
};

export default function LineNotificationSettingsPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [testMessage, setTestMessage] = useState("これはSCPSからのテスト通知です。正常に連携が完了しました！");
  const [customUserId, setCustomUserId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [alert, setAlert] = useState<{ type: "success" | "error", message: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as Omit<UserData, "id">;
            setUserData({ ...data, id: userDoc.id });
          } else {
            router.push("/login");
          }
        } catch (error) {
          console.error("Auth error:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleSendToAdmin = async () => {
    if (!testMessage.trim()) {
      showAlert("error", "メッセージを入力してください。");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await sendLineToAdmin(`【SCPS 通知テスト】\n送信者: ${userData?.name}\n\n${testMessage}`);
      
      if (result.success) {
        showAlert("success", "管理者（LINE_TEST_USER_ID）宛にLINE通知を送信しました！スマホを確認してください。");
      } else {
        showAlert("error", 'error' in result && result.error ? String(result.error) : "送信に失敗しました。環境変数やトークンを確認してください。");
      }
    } catch (error) {
      console.error(error);
      showAlert("error", "予期せぬエラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendToCustom = async () => {
    if (!customUserId.trim()) {
      showAlert("error", "宛先のLINEユーザーIDを入力してください。");
      return;
    }
    if (!testMessage.trim()) {
      showAlert("error", "メッセージを入力してください。");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await sendLineMessage(
        customUserId, 
        `【SCPS カスタム通知】\n送信者: ${userData?.name}\n\n${testMessage}`
      );
      
      if (result.success) {
        showAlert("success", "指定されたID宛にLINE通知を送信しました。");
        setCustomUserId("");
      } else {
        showAlert("error", 'error' in result && result.error ? String(result.error) : "送信に失敗しました。ユーザーIDが間違っている可能性があります。");
      }
    } catch (error) {
      console.error(error);
      showAlert("error", "予期せぬエラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendToSelf = async () => {
    if (!userData?.id) {
      showAlert("error", "ユーザー情報が取得できません。");
      return;
    }
    if (!userData.lineUserId) {
      showAlert("error", "LINE連携が完了していません。「通知設定」から連携を行ってください。");
      return;
    }
    if (!testMessage.trim()) {
      showAlert("error", "メッセージを入力してください。");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await sendNotificationToUser(
        userData.id,
        `【SCPS 自分宛てテスト】\nこんにちは、${userData.name}さん！\n\n${testMessage}`,
        false
      );
      
      if (result.success) {
        if ('message' in result && result.message) {
          showAlert("success", String(result.message));
        } else {
          showAlert("success", "あなたのLINEアカウント宛てに通知を送信しました！");
        }
      } else {
        showAlert("error", 'error' in result && result.error ? String(result.error) : "送信に失敗しました。");
      }
    } catch (error) {
      console.error(error);
      showAlert("error", "予期せぬエラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-10 w-10 text-[#06C755]" />
      </div>
    );
  }

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
          <div className="flex items-center text-[#06C755]">
            <MessageCircle className="h-6 w-6 mr-2" fill="currentColor" stroke="none" />
            <h1 className="text-xl font-bold text-gray-900">LINE通知 連携設定・テスト</h1>
          </div>
        </div>
      </header>

      {alert && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className={`p-4 rounded-lg shadow-lg flex items-center border-l-4 ${alert.type === "success" ? "bg-white border-[#06C755] text-green-800" : "bg-white border-red-500 text-red-800"}`}>
            {alert.type === "success" ? <CheckCircle className="h-6 w-6 text-[#06C755] mr-3" /> : <AlertCircle className="h-6 w-6 text-red-500 mr-3" />}
            <span className="font-bold text-sm">{alert.message}</span>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h2 className="text-lg font-extrabold text-gray-900 flex items-center mb-4">
            <Info className="h-5 w-5 text-blue-500 mr-2" />
            LINE Messaging API 連携状況
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            この画面では、サーバー側で構築した汎用LINE通知モジュール（<code>src/lib/line.ts</code>）の動作確認を行います。ここでのテストが成功すれば、今後はシステム内のどの機能（アンケート、目安箱など）からでも一行のコードでLINE通知を送れるようになります。
          </p>
          <div className="bg-[#f0fbf4] rounded-lg p-4 border border-[#b3efca]">
            <div className="flex items-start">
              <Smartphone className="h-5 w-5 text-[#06C755] mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-[#00993c]">テスト送信を行う前に</h3>
                <p className="text-xs text-[#00732d] mt-1">
                  作成した公式LINEボットアカウントと事前に「友だち追加」を行っていないと、APIからのメッセージを受信することができません。LINE DevelopersコンソールのQRコードから友だち登録を済ませてください。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h2 className="text-base font-extrabold text-gray-900 flex items-center mb-6">
            <Settings className="h-5 w-5 text-gray-500 mr-2" />
            接続テスト
          </h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">送信するテストメッセージ</label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={3}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg focus:border-[#06C755] focus:bg-white focus:ring-2 focus:ring-[#c8f5d6] px-4 py-3 transition-colors text-sm font-medium"
              />
            </div>

            <div className="border-t border-gray-100 pt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800">パターン1：連携済みの自分宛てに送る（本番同等）</h3>
                {userData?.lineUserId ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#e6faed] text-[#00993c]">連携完了</span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500">未連携</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-4">
                通知設定画面で連携したあなた自身のLINEアカウントに、統合関数 <code>sendNotificationToUser</code> を経由して送信します。
              </p>
              <button
                onClick={handleSendToSelf}
                disabled={isSubmitting || !userData?.lineUserId}
                className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 focus:outline-none transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                自分宛てにテスト送信
              </button>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-sm font-bold text-gray-800 mb-3">パターン2：環境変数の管理者宛に送る</h3>
              <p className="text-xs text-gray-500 mb-4">
                <code>.env</code> に設定した <code>LINE_TEST_USER_ID</code> 宛に送信します。環境構築の初期テスト用です。
              </p>
              <button
                onClick={handleSendToAdmin}
                disabled={isSubmitting}
                className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-[#06C755] hover:bg-[#05b34c] focus:outline-none transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                システム管理者にテスト送信
              </button>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-sm font-bold text-gray-800 mb-3">パターン3：任意のLINEユーザーID宛に送る</h3>
              <p className="text-xs text-gray-500 mb-4">
                直接IDを指定して送信する挙動テスト用です。
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={customUserId}
                  onChange={(e) => setCustomUserId(e.target.value)}
                  placeholder="Uから始まるユーザーIDを入力"
                  className="flex-1 bg-gray-50 border border-gray-300 rounded-lg focus:border-[#06C755] focus:bg-white focus:ring-2 focus:ring-[#c8f5d6] px-4 py-2.5 transition-colors text-sm font-medium"
                />
                <button
                  onClick={handleSendToCustom}
                  disabled={isSubmitting || !customUserId}
                  className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-2.5 border border-gray-300 rounded-lg shadow-sm text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  指定IDに送信
                </button>
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}