"use client";

import React, { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Calendar, CheckCircle2, Link as LinkIcon, Unlink } from "lucide-react";

// エラー回避のため、必要な型をここで直接定義します
export type UserData = {
  id: string;
  name: string;
  isGoogleCalendarLinked?: boolean;
  [key: string]: any; // その他のプロパティも許容
};

type Props = {
  userData: UserData | null;
  showAlert: (type: "success" | "error", message: string) => void;
};

export default function CalendarSettings({ userData, showAlert }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // コールバックから戻ってきた時のアラート表示
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success === "google_linked") {
      showAlert("success", "Googleカレンダーとの連携が完了しました！");
      router.replace("/account?tab=calendar");
    } else if (error) {
      showAlert("error", "カレンダー連携に失敗しました。もう一度お試しください。");
      router.replace("/account?tab=calendar");
    }
  }, [searchParams, router, showAlert]);

  const handleGoogleLink = () => {
    if (!userData) return;
    // 先ほど作ったOAuth APIへ遷移
    window.location.href = `/api/calendar/google/auth?uid=${userData.id}`;
  };

  const handleGoogleUnlink = async () => {
    // 連携解除の処理（次フェーズでAPI実装します）
    alert("連携解除処理は次フェーズで実装します");
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

      {/* Google カレンダー連携 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-4 sm:mb-0">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 mr-4">
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

        {userData?.isGoogleCalendarLinked ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
              <CheckCircle2 className="h-3 w-3 mr-1" /> 連携済み
            </span>
            <button onClick={handleGoogleUnlink} className="text-xs font-bold text-gray-500 hover:text-red-600 flex items-center transition-colors">
              <Unlink className="h-3 w-3 mr-1" /> 解除
            </button>
          </div>
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
  );
}