"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Loader2, AlertCircle, FileText, CheckCircle2, ArrowRight, Clock, CalendarIcon, LogOut, AlertTriangle } from "lucide-react";

import { ExternalUser } from "@/app/types/external";
import { Survey, sanitizeSurveyData, getDefaultSurveySettings } from "@/app/top/surveys/types";
import ExtHeader from "@/app/ext-top/components/ExtHeader";
import { useDialog } from "@/components/DialogContext";

export default function ExtSurveysPage() {
  const router = useRouter();
  const { showConfirm } = useDialog();
  
  const [extUser, setExtUser] = useState<ExternalUser | null>(null);
  const [schoolData, setSchoolData] = useState<any>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [myRespondedIds, setMyRespondedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 通知バッジ用ステート
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [hasMention, setHasMention] = useState(false);
  const [rentalsActiveCount, setRentalsActiveCount] = useState(0);
  const [hasOverdueRental, setHasOverdueRental] = useState(false);
  const [boardUnreadCount, setBoardUnreadCount] = useState(0);

  useEffect(() => {
    let unsubChat: (() => void) | undefined;
    let unsubRentals: (() => void) | undefined;
    let unsubBoard: (() => void) | undefined;
    let unsubSurveys: (() => void) | undefined;
    let unsubMyResponses: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const qExt = query(collection(db, "external_users"), where("authUid", "==", user.uid));
          const querySnapshot = await getDocs(qExt);
          
          if (querySnapshot.empty) {
            setError("外部ユーザーアカウントが見つかりません。");
            setIsLoading(false);
            return;
          }

          const extDoc = querySnapshot.docs[0];
          const userData = { id: extDoc.id, ...extDoc.data() } as ExternalUser;
          
          const nowTimeMs = Date.now();
          let isExpired = false;
          if (userData.expiresAt) {
            const expTime = typeof (userData.expiresAt as any).toDate === 'function' 
              ? (userData.expiresAt as any).toDate().getTime() 
              : new Date(userData.expiresAt).getTime();
            if (expTime < nowTimeMs) isExpired = true;
          }

          if (userData.status !== "active" || isExpired) {
            setError(isExpired ? "アカウントの有効期限が切れています。" : "アカウントが無効化されています。");
            setIsLoading(false);
            return;
          }

          const allowedModules = userData.allowedModules || [];
          if (!allowedModules.includes("surveys")) {
            setError("アンケート・投票アプリの利用権限が付与されていません。");
            setIsLoading(false);
            return;
          }

          setExtUser(userData);

          const schoolSnap = await getDoc(doc(db, "schools", userData.schoolId));
          if (schoolSnap.exists()) {
            setSchoolData(schoolSnap.data());
          }

          // 通知バッジ用の監視
          if (allowedModules.includes("chat")) {
            const qChat = query(collection(db, "chat_rooms"), where("schoolId", "==", userData.schoolId), where("members", "array-contains", userData.id));
            unsubChat = onSnapshot(qChat, (snapshot) => {
              let unreadTotal = 0;
              let mentionDetected = false;
              snapshot.forEach(d => {
                const rData = d.data();
                const myUnread = rData.unreadCount?.[userData.id] || 0;
                if (myUnread > 0) {
                  unreadTotal += myUnread;
                  if (rData.lastMessage && rData.lastMessage.includes(`@${userData.name}`)) mentionDetected = true;
                }
              });
              setChatUnreadCount(unreadTotal);
              setHasMention(mentionDetected);
            });
          }

          if (allowedModules.includes("equipment")) {
            const qRentals = query(collection(db, "rentals"), where("schoolId", "==", userData.schoolId), where("borrowerId", "==", userData.id));
            unsubRentals = onSnapshot(qRentals, (snapshot) => {
              let activeCount = 0;
              let overdueDetected = false;
              const now = new Date();
              snapshot.forEach(d => {
                const rData = d.data();
                if (rData.status === "active" || rData.status === "partial") {
                  activeCount++;
                  if (rData.endDate && new Date(`${rData.endDate}T23:59:59`) < now) overdueDetected = true;
                }
              });
              setRentalsActiveCount(activeCount);
              setHasOverdueRental(overdueDetected);
            });
          }

          if (allowedModules.includes("board")) {
            const qBoard = query(collection(db, "announcements"), where("schoolId", "==", userData.schoolId), where("isExternal", "==", true));
            unsubBoard = onSnapshot(qBoard, (snapshot) => {
              let unreadCount = 0;
              const nowTime = new Date().getTime();
              snapshot.forEach(d => {
                const bData = d.data();
                const start = bData.publishStartDate ? new Date(bData.publishStartDate).getTime() : new Date(bData.createdAt).getTime();
                const end = bData.publishEndDate ? new Date(bData.publishEndDate).getTime() : null;
                if (start <= nowTime && (!end || end >= nowTime)) {
                  const readByExternal: string[] = bData.readByExternal || [];
                  if (!readByExternal.includes(userData.id)) unreadCount++;
                }
              });
              setBoardUnreadCount(unreadCount);
            });
          }

          // アンケートデータの取得
          const qSurveys = query(collection(db, "surveys"), where("tenantId", "==", userData.schoolId));
          unsubSurveys = onSnapshot(qSurveys, (snapshot) => {
            const sData: Survey[] = [];
            const defaultSet = getDefaultSurveySettings();
            snapshot.forEach((d) => {
              sData.push(sanitizeSurveyData({ id: d.id, ...d.data() }, defaultSet));
            });
            setSurveys(sData);
          });

          const myRQ = query(collection(db, "survey_responses"), where("respondentId", "==", userData.id));
          unsubMyResponses = onSnapshot(myRQ, (snapshot) => {
            const myIds = new Set<string>();
            snapshot.forEach(d => myIds.add(d.data().surveyId));
            setMyRespondedIds(myIds);
          });

          setIsLoading(false);
        } catch (error) {
          setError("データの読み込みに失敗しました。");
          setIsLoading(false);
        }
      } else {
        router.push("/ext-login"); 
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubChat) unsubChat();
      if (unsubRentals) unsubRentals();
      if (unsubBoard) unsubBoard();
      if (unsubSurveys) unsubSurveys();
      if (unsubMyResponses) unsubMyResponses();
    };
  }, [router]);

  const handleLogout = () => {
    showConfirm(
      "ログアウトしますか？",
      async () => {
        await signOut(auth);
        router.push("/ext-login");
      },
      "warning",
      "ログアウトの確認"
    );
  };

  const now = Date.now();

  const isTarget = (s: Survey) => {
    if (!extUser) return false;
    const t = s.settings.accessTarget;
    if (t === "external_users" || t === "public") return true;
    if (t === "selected_users" && s.settings.respondentIds.includes(extUser.id)) return true;
    return false;
  };

  const isActive = (s: Survey) => {
    if (!s.settings.acceptingResponses) return false;
    const start = s.settings.startDate ? new Date(s.settings.startDate).getTime() : 0;
    const end = s.settings.endDate ? new Date(s.settings.endDate).getTime() : Infinity;
    if (now < start || now > end) return false;
    return true;
  };

  const targetSurveys = surveys.filter(s => isTarget(s));

  const requiredUnanswered = targetSurveys.filter(s => 
    isActive(s) && extUser && s.settings.requiredRespondentIds.includes(extUser.id) && !myRespondedIds.has(s.id)
  );

  const optionalUnanswered = targetSurveys.filter(s => 
    isActive(s) && (!extUser || !s.settings.requiredRespondentIds.includes(extUser.id)) && !myRespondedIds.has(s.id)
  );

  const respondedOrInactive = targetSurveys.filter(s => 
    myRespondedIds.has(s.id) || !isActive(s)
  );

  const calculateDeadline = (endDateStr: string | null | undefined) => {
    if (!endDateStr) return null;
    const end = new Date(endDateStr).getTime();
    const diff = end - now;
    if (diff < 0) return { label: "期限超過", overdue: true };
    const days = Math.floor(diff / (1000 * 3600 * 24));
    const hours = Math.floor(diff / (1000 * 3600));
    if (days === 0) return { label: `残り ${hours}時間`, overdue: false, urgent: true };
    if (days <= 3) return { label: `残り ${days}日`, overdue: false, urgent: true };
    return { label: `残り ${days}日`, overdue: false, urgent: false };
  };

  const getSurveyStatusLabel = (s: Survey, isCompleted: boolean) => {
    if (isCompleted) return { label: "回答済み", icon: <CheckCircle2 className="w-3 h-3 mr-1" />, color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    if (!s.settings.acceptingResponses) return { label: "受付終了", icon: <Clock className="w-3 h-3 mr-1" />, color: "bg-gray-200 text-gray-600 border-gray-300" };
    
    const start = s.settings.startDate ? new Date(s.settings.startDate).getTime() : 0;
    const end = s.settings.endDate ? new Date(s.settings.endDate).getTime() : Infinity;

    if (now < start) return { label: "受付前", icon: <CalendarIcon className="w-3 h-3 mr-1" />, color: "bg-amber-100 text-amber-700 border-amber-200" };
    if (now > end) return { label: "受付終了", icon: <Clock className="w-3 h-3 mr-1" />, color: "bg-gray-200 text-gray-600 border-gray-300" };
    
    return { label: "回答可能", icon: <FileText className="w-3 h-3 mr-1" />, color: "bg-blue-100 text-blue-700 border-blue-200" };
  };

  const renderSurveyCard = (survey: Survey, type: "required" | "optional" | "completed") => {
    const deadline = calculateDeadline(survey.settings.endDate);
    const isCompleted = myRespondedIds.has(survey.id);
    const statusInfo = getSurveyStatusLabel(survey, isCompleted);

    return (
      <Link 
        key={survey.id} 
        href={`/s/${survey.id}`}
        target="_blank"
        className={`block bg-white p-5 rounded-2xl shadow-sm border transition-all hover:-translate-y-0.5 hover:shadow-md relative group flex flex-col h-full ${
          type === "required" ? "border-red-300 bg-red-50/20" :
          type === "completed" ? "border-gray-200 opacity-70 hover:opacity-100 bg-gray-50" :
          "border-purple-200"
        }`}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            {type === "required" ? (
              <span className="flex items-center text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200 animate-pulse">
                <AlertCircle className="w-3 h-3 mr-1" /> 必須回答
              </span>
            ) : type === "completed" ? (
              <span className={`flex items-center text-[10px] font-black px-2 py-0.5 rounded border ${statusInfo.color}`}>
                {statusInfo.icon} {statusInfo.label}
              </span>
            ) : (
              <span className="flex items-center text-[10px] font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                <FileText className="w-3 h-3 mr-1" /> 任意回答
              </span>
            )}
            
            {deadline && type !== "completed" && (
              <span className={`text-[10px] font-bold flex items-center gap-1 ${
                deadline.overdue ? 'text-red-600 font-black' : deadline.urgent ? 'text-orange-600' : 'text-gray-500'
              }`}>
                <CalendarIcon className="w-3 h-3" /> {deadline.label}
              </span>
            )}
          </div>
          
          <ArrowRight className={`w-5 h-5 ${type === "required" ? "text-red-400 group-hover:text-red-600" : "text-gray-300 group-hover:text-purple-500"} transition-colors shrink-0`} />
        </div>

        <h3 className={`text-base font-extrabold line-clamp-2 mb-2 ${type === "required" ? 'text-red-900' : 'text-gray-900'}`}>
          {survey.title}
        </h3>
        <p className="text-xs text-gray-500 line-clamp-2 mb-4 flex-1">
          {survey.description || "説明はありません"}
        </p>

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
          <div className="flex gap-1.5 flex-wrap">
            {survey.settings.timeLimit && (
              <span className="text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5"/> {survey.settings.timeLimit}分制限
              </span>
            )}
            {survey.settings.limitToOneResponse && (
              <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                1回のみ
              </span>
            )}
            {survey.settings.allowEditResponse && (
              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                回答の編集可
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  };

  if (isLoading) return <div className="h-[100dvh] flex justify-center items-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  if (error || !extUser) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-black text-gray-900 mb-2">アクセスできません</h1>
        <p className="text-sm font-bold text-gray-500 mb-6">{error}</p>
        <button onClick={() => router.push("/ext-login")} className="px-5 py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-transform hover:-translate-y-0.5 shadow-sm">
          <LogOut className="w-4 h-4"/> 戻る
        </button>
      </div>
    );
  }

  const appConfig = { name: "アンケート・投票", icon: "FileText", color: "purple" };

  return (
    <div className="min-h-[100dvh] bg-[#F4F7F6] font-sans flex flex-col text-gray-900">
      
      {/* 共通の外部用ヘッダー */}
      <ExtHeader 
        schoolData={schoolData} 
        handleLogout={handleLogout} 
        appMeta={appConfig} 
        showBackButton={true} 
        appBadges={{
          chat: { unread: chatUnreadCount, mention: hasMention },
          equipment: { active: rentalsActiveCount, overdue: hasOverdueRental },
          board: { unread: boardUnreadCount }
        }}
      />

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="space-y-8 animate-fade-in pb-10">
          
          {requiredUnanswered.length > 0 && (
            <section>
              <h2 className="text-sm font-black text-red-600 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> 
                必ず回答してください ({requiredUnanswered.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {requiredUnanswered.map(s => renderSurveyCard(s, "required"))}
              </div>
            </section>
          )}

          {optionalUnanswered.length > 0 && (
            <section>
              <h2 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-500" /> 
                回答を受け付けています ({optionalUnanswered.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {optionalUnanswered.map(s => renderSurveyCard(s, "optional"))}
              </div>
            </section>
          )}

          {respondedOrInactive.length > 0 && (
            <section className="opacity-80">
              <h2 className="text-sm font-black text-gray-500 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> 
                回答済み・期間外 ({respondedOrInactive.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {respondedOrInactive.map(s => renderSurveyCard(s, "completed"))}
              </div>
            </section>
          )}

          {requiredUnanswered.length === 0 && optionalUnanswered.length === 0 && respondedOrInactive.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-600">現在、あなたが回答できるアンケートはありません。</p>
            </div>
          )}
          
        </div>
      </main>

      <div className="flex flex-col gap-1.5 text-[9px] font-bold text-gray-500 text-center pb-8 pt-4">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          <Link href="/legal/terms" className="hover:text-gray-300 transition-colors">利用規約</Link>
          <Link href="/legal/privacy" className="hover:text-gray-300 transition-colors">プライバシー</Link>
          <Link href="/legal/commercial" className="hover:text-gray-300 transition-colors">特定商取引法</Link>
        </div>
        <div className="text-[8px] text-gray-600 mt-0.5">
          &copy; {new Date().getFullYear()} YORIKURU / 生徒会ポータルシステム
        </div>
      </div>

    </div>
  );
}