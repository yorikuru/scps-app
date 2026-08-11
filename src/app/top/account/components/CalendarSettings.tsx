"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Calendar, CheckCircle2, Link as LinkIcon, Unlink, ChevronDown, ChevronUp, Info, AlertTriangle, Loader2 } from "lucide-react";
import { useDialog } from "@/components/DialogContext";

// エラー回避のため、必要な型をここで直接定義します
export type UserData = {
  id: string;
  name: string;
  isGoogleCalendarLinked?: boolean;
  googleCalendarEmail?: string; 
  [key: string]: any; 
};

type Props = {
  userData: UserData | null;
  // ★ Propsから受け取っていた古い showAlert は削除します
  // （useDialog の showAlert を使うため）
};

export default function CalendarSettings({ userData }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // ★ DialogContext からフックを取得
  const { showAlert, showConfirm } = useDialog();
  
  // UIの状態管理
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  // コールバックから戻ってきた時のアラート表示
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success === "google_linked") {
      showAlert("Googleカレンダーとの連携が完了しました！", "success");
      router.replace("/top/account?tab=calendar");
    } else if (error) {
      showAlert("カレンダー連携に失敗しました。もう一度お試しください。", "error");
      router.replace("/top/account?tab=calendar");
    }
  }, [searchParams, router, showAlert]);

  // 連携処理へ遷移
  const handleGoogleLink = () => {
    if (!userData) return;
    window.location.href = `/api/calendar/google/auth?uid=${userData.id}`;
  };

  // 連携解除のAPI呼び出し
  const executeGoogleUnlink = async () => {
    if (!userData) return;
    setIsUnlinking(true);
    try {
      const response = await fetch(`/api/calendar/google/unlink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: userData.id }),
      });

      if (!response.ok) {
        throw new Error("連携解除に失敗しました");
      }

      showAlert("Googleカレンダーとの連携を解除しました。", "success");
      setIsExpanded(false);
      // 解除後のステータスを画面に反映するためリロード
      router.refresh(); 
    } catch (error) {
      console.error("Unlink error:", error);
      showAlert("連携の解除中にエラーが発生しました。", "error");
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleGoogleUnlink = () => {
    // ★ カスタムダイアログの仕様に合わせて修正
    showConfirm(
      "Googleカレンダーとの連携を解除しますか？\nSCPSからGoogleカレンダーへの予定の自動同期が停止します。",
      () => { executeGoogleUnlink(); },
      "danger",
      "連携解除の確認"
    );
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 animate-fade-in">
      <h3 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
        <Calendar className="h-5 w-5 mr-2 text-indigo-600" />
        外部カレンダー連携設定
      </h3>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
        生徒会ポータル（SCPS）で作成した予定を、普段お使いのGoogleカレンダーに自動で同期することができます。予定の見逃しを防ぎ、スケジュール管理を効率化しましょう。
      </p>

      {/* Google カレンダー連携 パネル */}
      <div className="flex flex-col bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300">
        
        {/* メインのヘッダー部分 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-gray-50 dark:bg-gray-800/80">
          <div className="flex items-center mb-4 sm:mb-0">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 mr-4 shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Google カレンダー</h4>
              <p className="text-xs text-gray-500 mt-0.5">@gmail.com または 学校のGoogleアカウント</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {userData?.isGoogleCalendarLinked ? (
              <>
                <span className="flex items-center text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-full border border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> 連携済み
                </span>
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center transition-colors px-2 py-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  詳細
                  {isExpanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                </button>
              </>
            ) : (
              <button 
                onClick={handleGoogleLink}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center transition-all active:scale-95"
              >
                <LinkIcon className="h-3 w-3 mr-1.5" /> 連携する
              </button>
            )}
          </div>
        </div>

        {/* 詳細情報・連携解除エリア（アコーディオン） */}
        {userData?.isGoogleCalendarLinked && isExpanded && (
          <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-in fade-in slide-in-from-top-2">
            <h5 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
              <Info className="h-4 w-4 mr-2 text-indigo-500" />
              連携アプリの詳細情報
            </h5>
            
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 mb-6 list-disc list-inside ml-1">
              <li><strong>連携アカウント:</strong> {userData.googleCalendarEmail || "（取得できませんでした）"}</li>
              <li><strong>許可されている操作:</strong> SCPS内で作成されたスケジュールのGoogleカレンダーへの追加・更新・削除</li>
              <li><strong>同期のタイミング:</strong> イベントの保存・変更時にバックグラウンドで自動同期されます。</li>
            </ul>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800/50">
              <div className="flex items-start mb-4 sm:mb-0">
                <AlertTriangle className="h-5 w-5 text-red-500 mr-3 shrink-0 mt-0.5" />
                <div>
                  <h6 className="text-sm font-bold text-red-800 dark:text-red-400 mb-1">連携の解除</h6>
                  <p className="text-xs text-red-600 dark:text-red-300 leading-relaxed pr-4">
                    連携を解除すると、SCPSからGoogleカレンダーへの自動同期が停止します。<br className="hidden sm:block" />
                    過去に同期された予定はGoogleカレンダー上に残ります。
                  </p>
                </div>
              </div>
              
              <button 
                onClick={handleGoogleUnlink}
                disabled={isUnlinking}
                className="shrink-0 w-full sm:w-auto px-4 py-2.5 bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors flex items-center justify-center shadow-sm disabled:opacity-50"
              >
                {isUnlinking ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-red-600 dark:text-red-400" />
                    処理中...
                  </>
                ) : (
                  <>
                    <Unlink className="h-3.5 w-3.5 mr-1.5" /> 連携を解除する
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}