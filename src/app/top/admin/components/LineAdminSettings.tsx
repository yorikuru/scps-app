// src/app/top/admin/components/LineAdminSettings.tsx
"use client";

import React, { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  MessageCircle, Send, CheckCircle, AlertCircle, 
  Loader2, Info, Settings, Smartphone, UserCheck, Link as LinkIcon, Bell, BellOff, ShieldAlert
} from "lucide-react";
import { sendLineToAdmin, sendLineMessage, sendNotificationToUser } from "@/lib/line";
import { UserData, SchoolData } from "../page";
import { useDialog } from "@/components/DialogContext"; // ★追加

type Props = {
  userData: UserData | null;
  schoolData: SchoolData | null;
  showAlert: (type: "success" | "error" | "warning", message: string) => void;
};

export default function LineAdminSettings({ userData, schoolData, showAlert }: Props) {
  const [currentUserData, setCurrentUserData] = useState<UserData | null>(userData);
  const [testMessage, setTestMessage] = useState("これはSCPSからのテスト通知です。正常に連携が完了しました！");
  const [customUserId, setCustomUserId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { showConfirm } = useDialog(); // ★追加

  useEffect(() => {
    setCurrentUserData(userData);
  }, [userData]);

  // LINEログイン開始
  const startLineLinking = () => {
    const clientId = process.env.NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID || "2010747597";
    const redirectUri = encodeURIComponent(`${window.location.origin}/top/settings/notifications`);
    const state = currentUserData?.id || "random_state";
    window.location.href = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=profile&bot_prompt=aggressive`;
  };

  // 通知ON/OFF切り替え
  const toggleNotification = async (enabled: boolean) => {
    if (!currentUserData) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", currentUserData.id), {
        lineNotificationEnabled: enabled,
      });
      setCurrentUserData(prev => prev ? { ...prev, lineNotificationEnabled: enabled } : null);
      showAlert("success", enabled ? "LINE通知をオンにしました。" : "LINE通知をオフにしました。");
    } catch (error) {
      console.error("Update error:", error);
      showAlert("error", "設定の保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  // LINE連携解除の実行本体
  const executeUnlinkLine = async () => {
    if (!currentUserData) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", currentUserData.id), {
        lineUserId: null,
      });
      setCurrentUserData(prev => prev ? { ...prev, lineUserId: undefined, lineNotificationEnabled: false } : null);
      showAlert("success", "LINE連携を解除しました。");
    } catch (error) {
      console.error("Unlink error:", error);
      showAlert("error", "解除に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  // LINE連携解除（確認ダイアログ呼び出し）
  const unlinkLine = () => {
    if (!currentUserData) return;
    // ★ window.showConfirm を共通の showConfirm に置換
    showConfirm(
      "LINE連携を解除しますか？\nシステムの通知がLINEに届かなくなります。",
      executeUnlinkLine,
      "danger",
      "LINE連携解除の確認"
    );
  };

  // テスト送信1: 自分宛て
  const handleSendToSelf = async () => {
    if (!currentUserData?.id) {
      showAlert("error", "ユーザー情報が取得できません。");
      return;
    }
    if (!currentUserData.lineUserId) {
      showAlert("error", "LINE連携が完了していません。まずLINEと連携してください。");
      return;
    }
    if (!testMessage.trim()) {
      showAlert("error", "メッセージを入力してください。");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await sendNotificationToUser(
        currentUserData.id,
        `【SCPS 自分宛てテスト】\nこんにちは、${currentUserData.name}さん！\n\n${testMessage}`,
        false
      );
      
      if (result.success) {
        showAlert("success", "あなたのLINEアカウント宛てに通知を送信しました！");
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

  // テスト送信2: 管理者宛て
  const handleSendToAdmin = async () => {
    if (!testMessage.trim()) {
      showAlert("error", "メッセージを入力してください。");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await sendLineToAdmin(`【SCPS 通知テスト】\n送信者: ${currentUserData?.name}\n\n${testMessage}`);
      if (result.success) {
        showAlert("success", "管理者（LINE_TEST_USER_ID）宛にLINE通知を送信しました！");
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

  // テスト送信3: カスタムID宛て
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
        `【SCPS カスタム通知】\n送信者: ${currentUserData?.name}\n\n${testMessage}`
      );
      
      if (result.success) {
        showAlert("success", "指定されたID宛にLINE通知を送信しました。");
        setCustomUserId("");
      } else {
        showAlert("error", 'error' in result && result.error ? String(result.error) : "送信に失敗しました。ユーザーIDを確認してください。");
      }
    } catch (error) {
      console.error(error);
      showAlert("error", "予期せぬエラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLinked = !!currentUserData?.lineUserId;
  const isEnabled = currentUserData?.lineNotificationEnabled !== false;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 個人アカウント連携カード */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center text-gray-900 font-black text-sm">
            <MessageCircle className="h-5 w-5 mr-2 text-[#06C755]" fill="currentColor" stroke="none" />
            管理者個人のLINE連携ステータス
          </div>
          {isLinked ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#e6faed] text-[#00993c]">
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> 連携済み
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-600">
              未連携
            </span>
          )}
        </div>
        
        <div className="p-6">
          {!isLinked ? (
            <div className="text-center py-4">
              <Smartphone className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-gray-900 mb-1">LINEアカウントを連携して通知テストを行う</h3>
              <p className="text-xs text-gray-500 mb-5 max-w-md mx-auto leading-relaxed">
                自身のLINEと連携することで、本番同等の受信テストや管理者宛の通知を受け取ることができます。
              </p>
              <button
                onClick={startLineLinking}
                className="inline-flex items-center px-5 py-2.5 rounded-full shadow-sm text-xs font-black text-white bg-[#06C755] hover:bg-[#05b34c] transition-colors cursor-pointer"
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                LINEと連携する
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#f0fbf4] rounded-xl p-4 border border-[#b3efca]">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 mb-0.5">現在のアカウントはLINEと正常に連携されています</h3>
                  <p className="text-[11px] font-bold text-gray-600">システム内の各種通知（アンケート、目安箱、リマインド等）をLINEで受領できます。</p>
                </div>
                <button
                  onClick={unlinkLine}
                  disabled={isSaving}
                  className="whitespace-nowrap text-xs font-bold text-gray-500 hover:text-red-600 transition-colors px-3 py-1.5 border border-gray-300 hover:border-red-200 rounded-lg bg-white disabled:opacity-50 cursor-pointer"
                >
                  連携を解除
                </button>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center pr-4">
                    <div className={`p-2 rounded-xl mr-3 ${isEnabled ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                      {isEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900">通常のお知らせ・リマインダー通知</div>
                      <div className="text-[10px] text-gray-500 font-bold mt-0.5">個人のLINE宛に定期通知を送るかどうかを設定します。</div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => toggleNotification(!isEnabled)}
                    disabled={isSaving}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${isEnabled ? 'bg-purple-600' : 'bg-gray-200'} disabled:opacity-50`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* LINE API テスト送信カード */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <h2 className="text-sm font-black text-gray-900 flex items-center mb-1">
            <Settings className="h-4 w-4 text-gray-500 mr-2" />
            LINE Messaging API 接続テスト
          </h2>
          <p className="text-[11px] text-gray-500 font-bold leading-relaxed">
            サーバー側で構築した汎用LINE通知モジュール（<code>src/lib/line.ts</code>）の挙動を確認できます。
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1">送信テスト用メッセージ</label>
            <textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-gray-800">1. 自分宛てに送信</h3>
                {isLinked ? (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700">連携済</span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-gray-200 text-gray-600">未連携</span>
                )}
              </div>
              <p className="text-[10px] font-bold text-gray-500">ログイン中の管理者自身のLINEへ送信テストを行います。</p>
              <button
                onClick={handleSendToSelf}
                disabled={isSubmitting || !isLinked}
                className="w-full py-2 px-4 border border-transparent rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                自分宛てに送信
              </button>
            </div>

            <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-gray-800">2. システム管理者宛てに送信</h3>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700">.env 設定</span>
              </div>
              <p className="text-[10px] font-bold text-gray-500"><code>LINE_TEST_USER_ID</code> に定義された固定アカウントへ送信します。</p>
              <button
                onClick={handleSendToAdmin}
                disabled={isSubmitting}
                className="w-full py-2 px-4 border border-transparent rounded-xl text-xs font-bold text-white bg-[#06C755] hover:bg-[#05b34c] transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                システム管理者に送信
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <h3 className="text-xs font-black text-gray-800 mb-2">3. 任意のLINEユーザーID指定送信</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={customUserId}
                onChange={(e) => setCustomUserId(e.target.value)}
                placeholder="Uから始まるLINEユーザーIDを入力"
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                onClick={handleSendToCustom}
                disabled={isSubmitting || !customUserId}
                className="px-5 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isSubmitting ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                送信
              </button>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}