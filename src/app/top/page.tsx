"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, collection, getDocs, updateDoc, arrayUnion } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { 
  User as UserIcon, Settings, LogOut, LayoutDashboard, Loader2, 
  BellRing, X, AlertTriangle, ShieldBan, Building2, Menu, ChevronRight,
  ShieldCheck, Lock, Smartphone, CheckCircle2, ArrowRight
} from "lucide-react";
import Link from "next/link";

type UserData = {
  id: string;
  name: string;
  schoolName: string;
  role: string;
  schoolId: string;
  accountStatus: "active" | "pending" | "rejected" | "unaccessed";
  positionName?: string;
  isITManager?: boolean;
  // 強制設定チェック用のフィールド
  initialPassword?: string;
  lineConnectionEnforced?: boolean;
  lineUid?: string;
  requireMfa?: boolean;
  mfaSetupComplete?: boolean;
};

type SchoolData = {
  id: string;
  name: string;
  status: "active" | "suspended";
};

type SystemMessage = {
  id: string;
  title: string;
  content: string;
  targetType: "all" | "tenant" | "user";
  targetId: string;
  startAt: string;
  endAt: string;
  isDismissible: boolean;
  isImportant: boolean;
  createdAt: string;
  readBy: string[];
};

export default function PortalTopPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null);
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  // 必須設定のステータス管理
  const [setupStatus, setSetupStatus] = useState({
    needsPassword: false,
    needsLine: false,
    needsMfa: false,
    isBlocked: false
  });
  
  // メニューの開閉状態
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // 画面外クリックでメニューを閉じる処理
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsAppMenuOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (!userDocSnap.exists()) {
            setErrorMsg("ユーザーデータが見つかりません。管理者に連絡してください。");
            setIsLoading(false);
            return;
          }
          
          const uData = { id: userDocSnap.id, ...userDocSnap.data() } as UserData;
          setUserData(uData);

          // 必須設定のブロック判定ロジック
          const needsPassword = !!uData.initialPassword;
          const needsLine = !!uData.lineConnectionEnforced && !uData.lineUid;
          const needsMfa = !!uData.requireMfa && !uData.mfaSetupComplete;
          
          setSetupStatus({
            needsPassword,
            needsLine,
            needsMfa,
            isBlocked: needsPassword || needsLine || needsMfa
          });

          const schoolDocRef = doc(db, "schools", uData.schoolId);
          const schoolDocSnap = await getDoc(schoolDocRef);
          
          if (schoolDocSnap.exists()) {
            setSchoolData({ id: schoolDocSnap.id, ...schoolDocSnap.data() } as SchoolData);
          }

          if (uData.accountStatus === "active") {
            const messagesRef = collection(db, "system_messages");
            const mSnap = await getDocs(messagesRef);
            const fetchedMessages: SystemMessage[] = [];
            
            // タイムゾーンによるズレを防ぐため、ローカルの日付オブジェクトで比較
            const now = new Date();
            
            mSnap.forEach(doc => {
              const data = doc.data() as Omit<SystemMessage, 'id'>;
              
              // 1. 配信期間の判定
              const start = data.startAt ? new Date(data.startAt) : null;
              const end = data.endAt ? new Date(data.endAt) : null;

              const isStarted = !start || start <= now;
              const isNotEnded = !end || end >= now;

              if (!isStarted || !isNotEnded) return;

              // 2. ターゲット判定
              const isTargeted = 
                data.targetType === "all" || 
                (data.targetType === "tenant" && data.targetId === uData.schoolId) ||
                (data.targetType === "user" && data.targetId === user.uid);
              if (!isTargeted) return;

              // 3. 既読(削除済み)判定: isDismissible が true で、自分が readBy に入っていたら弾く
              if (data.isDismissible && data.readBy?.includes(user.uid)) return;

              fetchedMessages.push({ id: doc.id, ...data });
            });
            
            // ソート: 1.重要フラグ(trueが上) -> 2.作成日時の新しい順
            fetchedMessages.sort((a, b) => {
              if (a.isImportant && !b.isImportant) return -1;
              if (!a.isImportant && b.isImportant) return 1;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });

            setMessages(fetchedMessages);
          }

        } catch (error) {
          console.error("Error fetching data:", error);
          setErrorMsg("データの取得に失敗しました。通信環境を確認してください。");
        } finally {
          setIsLoading(false);
        }
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      setErrorMsg("ログアウトに失敗しました。");
    }
  };

  const markMessageAsRead = async (messageId: string) => {
    if (!userData) return;
    
    // UI上から即座に消す
    setMessages(messages.filter(m => m.id !== messageId));

    try {
      const messageRef = doc(db, "system_messages", messageId);
      await updateDoc(messageRef, {
        readBy: arrayUnion(userData.id)
      });
    } catch (error) {
      console.error("Failed to mark message as read:", error);
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "officer": return "生徒会役員";
      case "admin": return "テナント管理者";
      case "system_admin": return "特権管理者";
      case "guest": return "ゲストユーザー";
      case "student": return "一般生徒";
      default: return "一般ユーザー";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
      </div>
    );
  }

  // ブロック判定 1: テナント全体が停止中 (特権管理者は除く)
  if (schoolData?.status === "suspended" && userData?.role !== "system_admin") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white shadow sm:rounded-lg max-w-md w-full p-8 text-center border-t-4 border-red-600">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <Building2 className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">サービス提供停止中</h2>
          <p className="text-sm text-gray-600 mb-6">
            現在、所属する組織（{schoolData.name}）のシステム利用が一時的に停止されています。<br />
            詳細については組織の管理者にお問い合わせください。
          </p>
          <button onClick={handleLogout} className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            ログアウトして戻る
          </button>
        </div>
      </div>
    );
  }

  // ブロック判定 2: アカウントが承認待ち
  if (userData?.accountStatus === "pending") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white shadow sm:rounded-lg max-w-md w-full p-8 text-center border-t-4 border-yellow-400">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">管理者の承認待ちです</h2>
          <p className="text-sm text-gray-600 mb-6">
            あなたのアカウントは現在「承認待ち」の状態です。<br />
            管理者が承認を行うまで、ポータル機能を利用することはできません。
          </p>
          <button onClick={handleLogout} className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            ログアウトして戻る
          </button>
        </div>
      </div>
    );
  }

  // ブロック判定 3: アカウントが停止・却下
  if (userData?.accountStatus === "rejected") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white shadow sm:rounded-lg max-w-md w-full p-8 text-center border-t-4 border-red-500">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <ShieldBan className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">アクセスが拒否されました</h2>
          <p className="text-sm text-gray-600 mb-6">
            あなたのアカウントは管理者によって利用が停止されています。
          </p>
          <button onClick={handleLogout} className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            ログアウトして戻る
          </button>
        </div>
      </div>
    );
  }

  // ブロック判定 4: 必須設定チュートリアル（パスワード、MFA、LINE強制）
  if (setupStatus.isBlocked) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* ヘッダー */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-white opacity-10 rounded-full blur-xl"></div>
            <ShieldCheck className="h-16 w-16 text-white mx-auto mb-4 relative z-10" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white relative z-10 tracking-tight">初期設定を完了してください</h1>
            <p className="mt-3 text-blue-100 text-sm sm:text-base max-w-lg mx-auto relative z-10 font-medium leading-relaxed">
              組織のセキュリティポリシーにより、システムを利用する前に以下の必須設定を完了する必要があります。
            </p>
          </div>
          
          {/* 設定タスクリスト */}
          <div className="p-6 sm:p-8 space-y-4">
            
            {/* パスワード変更チェック */}
            <div className={`flex items-start p-5 rounded-xl border-2 transition-all ${setupStatus.needsPassword ? "border-red-200 bg-red-50/50" : "border-green-200 bg-green-50"}`}>
              <div className={`flex-shrink-0 mt-1 ${setupStatus.needsPassword ? "text-red-500" : "text-green-500"}`}>
                {setupStatus.needsPassword ? <Lock className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
              </div>
              <div className="ml-4 flex-1">
                <h3 className={`text-base font-bold ${setupStatus.needsPassword ? "text-red-900" : "text-green-900"}`}>
                  初期パスワードの変更
                </h3>
                <p className={`text-sm mt-1 ${setupStatus.needsPassword ? "text-red-700" : "text-green-700"}`}>
                  {setupStatus.needsPassword 
                    ? "セキュリティ保護のため、管理者から発行された初期パスワードを任意のパスワードに変更してください。" 
                    : "パスワードの変更は完了しています。"}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0 font-bold text-sm">
                {setupStatus.needsPassword ? <span className="text-red-600 bg-red-100 px-3 py-1 rounded-full">未完了</span> : <span className="text-green-600 bg-green-100 px-3 py-1 rounded-full">完了</span>}
              </div>
            </div>

            {/* 多要素認証チェック */}
            {(userData?.requireMfa || setupStatus.needsMfa) && (
              <div className={`flex items-start p-5 rounded-xl border-2 transition-all ${setupStatus.needsMfa ? "border-red-200 bg-red-50/50" : "border-green-200 bg-green-50"}`}>
                <div className={`flex-shrink-0 mt-1 ${setupStatus.needsMfa ? "text-red-500" : "text-green-500"}`}>
                  {setupStatus.needsMfa ? <ShieldCheck className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
                </div>
                <div className="ml-4 flex-1">
                  <h3 className={`text-base font-bold ${setupStatus.needsMfa ? "text-red-900" : "text-green-900"}`}>
                    多要素認証（MFA）の設定
                  </h3>
                  <p className={`text-sm mt-1 ${setupStatus.needsMfa ? "text-red-700" : "text-green-700"}`}>
                    {setupStatus.needsMfa 
                      ? "アカウントの安全性を高めるため、認証アプリまたはパスキーによる2段階認証の設定が必須です。" 
                      : "多要素認証の設定は完了しています。"}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0 font-bold text-sm">
                  {setupStatus.needsMfa ? <span className="text-red-600 bg-red-100 px-3 py-1 rounded-full">未完了</span> : <span className="text-green-600 bg-green-100 px-3 py-1 rounded-full">完了</span>}
                </div>
              </div>
            )}

            {/* LINE連携チェック */}
            {(userData?.lineConnectionEnforced || setupStatus.needsLine) && (
              <div className={`flex items-start p-5 rounded-xl border-2 transition-all ${setupStatus.needsLine ? "border-red-200 bg-red-50/50" : "border-green-200 bg-green-50"}`}>
                <div className={`flex-shrink-0 mt-1 ${setupStatus.needsLine ? "text-red-500" : "text-green-500"}`}>
                  {setupStatus.needsLine ? <Smartphone className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
                </div>
                <div className="ml-4 flex-1">
                  <h3 className={`text-base font-bold ${setupStatus.needsLine ? "text-red-900" : "text-green-900"}`}>
                    LINEアカウントとの連携
                  </h3>
                  <p className={`text-sm mt-1 ${setupStatus.needsLine ? "text-red-700" : "text-green-700"}`}>
                    {setupStatus.needsLine 
                      ? "重要な通知を即座に受け取るため、LINEアカウントの連携が必須とされています。" 
                      : "LINEアカウントの連携は完了しています。"}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0 font-bold text-sm">
                  {setupStatus.needsLine ? <span className="text-red-600 bg-red-100 px-3 py-1 rounded-full">未完了</span> : <span className="text-green-600 bg-green-100 px-3 py-1 rounded-full">完了</span>}
                </div>
              </div>
            )}

            {/* アクションボタン */}
            <div className="pt-6 mt-4 border-t border-gray-100">
              <button 
                onClick={() => router.push('/account')}
                className="w-full flex items-center justify-center px-6 py-4 border border-transparent rounded-xl shadow-md text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                アカウント設定画面へ進む
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
              
              <div className="mt-6 text-center">
                <button 
                  onClick={handleLogout} 
                  className="text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors inline-flex items-center"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  ログアウト
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  const canAccessSettings = 
    userData?.role === "admin" || 
    userData?.isITManager === true || 
    (userData?.positionName && (userData.positionName.includes("会長") || userData.positionName.includes("顧問")));

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* 新しいヘッダー UI (Google/Microsoft風) */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          <div className="flex items-center">
            {/* 三本線メニュー (モバイル・PC兼用アプリメニュー) */}
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsAppMenuOpen(!isAppMenuOpen)}
                className="p-2 mr-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                aria-label="メニュー"
              >
                <Menu className="h-6 w-6 text-gray-600" />
              </button>
              
              {/* アプリメニュー ドロップダウン */}
              {isAppMenuOpen && (
                <div className="absolute left-0 mt-2 w-64 rounded-xl shadow-xl bg-white ring-1 ring-black ring-opacity-5 z-50 overflow-hidden">
                  <div className="p-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">アプリ</h3>
                    <Link href="/top/board" className="flex items-center p-3 hover:bg-gray-50 rounded-lg group transition-colors">
                      <div className="bg-indigo-100 p-2 rounded-lg group-hover:bg-indigo-200 transition-colors"><LayoutDashboard className="h-5 w-5 text-indigo-600" /></div>
                      <span className="ml-3 text-sm font-bold text-gray-700 group-hover:text-gray-900">お知らせボード</span>
                    </Link>
                    <Link href="/top/tasks" className="flex items-center p-3 hover:bg-gray-50 rounded-lg group transition-colors">
                      <div className="bg-green-100 p-2 rounded-lg group-hover:bg-green-200 transition-colors"><AlertTriangle className="h-5 w-5 text-green-600" /></div>
                      <span className="ml-3 text-sm font-bold text-gray-700 group-hover:text-gray-900">タスク・プロジェクト</span>
                    </Link>
                    <Link href="/top/approvals" className="flex items-center p-3 hover:bg-gray-50 rounded-lg group transition-colors">
                      <div className="bg-purple-100 p-2 rounded-lg group-hover:bg-purple-200 transition-colors"><ShieldBan className="h-5 w-5 text-purple-600" /></div>
                      <span className="ml-3 text-sm font-bold text-gray-700 group-hover:text-gray-900">電子承認・稟議</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center">
              <LayoutDashboard className="h-6 w-6 text-blue-600 mr-2" />
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate max-w-[150px] sm:max-w-none">生徒会ポータルシステム</h1>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 sm:space-x-4">
            <span className="hidden sm:inline text-sm font-bold text-gray-600 truncate max-w-[200px]">
              {userData?.schoolName}
            </span>
            
            {/* アカウントアイコン & プロフィールメニュー */}
            <div className="relative" ref={profileRef}>
              <button 
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center focus:outline-none p-1 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="アカウントメニュー"
              >
                <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm border border-transparent">
                  {userData?.name.charAt(0) || <UserIcon className="h-5 w-5" />}
                </div>
              </button>

              {/* プロフィール ドロップダウン */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl shadow-2xl bg-white ring-1 ring-black ring-opacity-5 z-50 overflow-hidden border border-gray-100">
                  <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-inner flex-shrink-0">
                      {userData?.name.charAt(0)}
                    </div>
                    <div className="ml-3 overflow-hidden">
                      <p className="text-base font-extrabold text-gray-900 truncate">{userData?.name}</p>
                      <p className="text-xs font-medium text-gray-500 truncate">{userData?.schoolName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{userData ? getRoleDisplayName(userData.role) : ""}</p>
                    </div>
                  </div>
                  <div className="p-2">
                    <Link href="/account" className="flex items-center px-3 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors group">
                      <UserIcon className="h-5 w-5 mr-3 text-gray-400 group-hover:text-blue-600" />
                      マイアカウント設定
                      <ChevronRight className="h-4 w-4 ml-auto text-gray-300" />
                    </Link>
                    {canAccessSettings && (
                      <Link href="/top/admin" className="flex items-center px-3 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors group mt-1">
                        <Settings className="h-5 w-5 mr-3 text-gray-400 group-hover:text-gray-700" />
                        テナント管理
                        <ChevronRight className="h-4 w-4 ml-auto text-gray-300" />
                      </Link>
                    )}
                  </div>
                  <div className="p-2 border-t border-gray-100">
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors group"
                    >
                      <LogOut className="h-5 w-5 mr-3 text-red-500 group-hover:text-red-600" />
                      ログアウト
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        
        {/* UIアラート（エラー時） */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-md text-sm font-bold border border-red-200 flex items-start">
            <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* システムメッセージバナー領域 */}
        {messages.length > 0 && (
          <div className="space-y-4 mb-8">
            {messages.map(msg => {
              const bannerBg = msg.isImportant ? "bg-red-50 border-red-500" : "bg-orange-50 border-orange-500";
              const titleColor = msg.isImportant ? "text-red-900" : "text-orange-900";
              const textColor = msg.isImportant ? "text-red-800" : "text-orange-800";
              const dateColor = msg.isImportant ? "text-red-600/70" : "text-orange-600/70";
              const Icon = msg.isImportant ? AlertTriangle : BellRing;
              const iconColor = msg.isImportant ? "text-red-500" : "text-orange-500";

              return (
                <div key={msg.id} className={`relative border-l-4 p-4 rounded-r-md shadow-sm ${bannerBg}`}>
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <Icon className={`h-5 w-5 mt-0.5 ${iconColor}`} />
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <h3 className={`text-sm font-extrabold flex items-center flex-wrap gap-2 ${titleColor}`}>
                        {msg.title}
                        {msg.isImportant && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-600 text-white leading-none">重要</span>}
                      </h3>
                      <p className={`mt-1 text-sm whitespace-pre-wrap ${textColor}`}>{msg.content}</p>
                      <p className={`mt-2 text-xs ${dateColor}`}>
                        配信: {msg.startAt ? msg.startAt.replace("T", " ") : new Date(msg.createdAt).toLocaleString()}
                      </p>
                    </div>
                    
                    {msg.isDismissible && (
                      <div className="ml-4 flex-shrink-0 flex">
                        <button
                          onClick={() => markMessageAsRead(msg.id)}
                          className={`rounded-md inline-flex p-1 focus:outline-none transition-colors ${msg.isImportant ? "text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100" : "text-orange-400 hover:text-orange-600 bg-orange-50 hover:bg-orange-100"}`}
                          title="閉じる（既読にする）"
                        >
                          <span className="sr-only">閉じる</span>
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ユーザー歓迎メッセージ */}
        <div className="mb-6">
          <h2 className="text-2xl font-extrabold text-gray-900">こんにちは、{userData?.name} さん</h2>
          <p className="mt-1 text-sm text-gray-500 font-medium">
            今日も活動お疲れ様です。必要なツールを選択してください。
          </p>
        </div>

        {/* メインアプリアイコングリッド */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          
          <Link href="/top/board" className="bg-white overflow-hidden shadow-sm rounded-xl p-6 hover:shadow-md transition-all group border border-gray-100 flex flex-col items-center text-center">
            <div className="flex-shrink-0 bg-indigo-50 rounded-2xl p-4 mb-4 group-hover:scale-110 group-hover:bg-indigo-100 transition-all duration-300">
              <svg className="h-10 w-10 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900">お知らせボード</h3>
            <p className="text-sm text-gray-500 mt-2">全体や委員会向けの連絡事項</p>
          </Link>

          <Link href="/top/tasks" className="bg-white overflow-hidden shadow-sm rounded-xl p-6 hover:shadow-md transition-all group border border-gray-100 flex flex-col items-center text-center">
            <div className="flex-shrink-0 bg-green-50 rounded-2xl p-4 mb-4 group-hover:scale-110 group-hover:bg-green-100 transition-all duration-300">
              <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900">タスク・プロジェクト</h3>
            <p className="text-sm text-gray-500 mt-2">行事ごとのToDoと進捗管理</p>
          </Link>

          <Link href="/top/approvals" className="bg-white overflow-hidden shadow-sm rounded-xl p-6 hover:shadow-md transition-all group border border-gray-100 flex flex-col items-center text-center">
            <div className="flex-shrink-0 bg-purple-50 rounded-2xl p-4 mb-4 group-hover:scale-110 group-hover:bg-purple-100 transition-all duration-300">
              <svg className="h-10 w-10 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900">電子承認・稟議</h3>
            <p className="text-sm text-gray-500 mt-2">企画書や予算案のワークフロー</p>
          </Link>

          <Link href="/top/surveys" className="bg-white overflow-hidden shadow-sm rounded-xl p-6 hover:shadow-md transition-all group border border-gray-100 flex flex-col items-center text-center">
            <div className="flex-shrink-0 bg-yellow-50 rounded-2xl p-4 mb-4 group-hover:scale-110 group-hover:bg-yellow-100 transition-all duration-300">
              <svg className="h-10 w-10 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900">アンケート・目安箱</h3>
            <p className="text-sm text-gray-500 mt-2">生徒からの意見や回答の回収</p>
          </Link>

        </div>
      </main>
    </div>
  );
}