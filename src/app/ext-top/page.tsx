"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Loader2, ChevronRight, User, Globe, AlertCircle, Bell, FileText } from "lucide-react";
import * as LucideIcons from "lucide-react";

import { ExternalUser } from "@/app/types/external";
import ExtHeader from "./components/ExtHeader"; 

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

export default function ExtTopPage() {
  const router = useRouter();
  
  const [extUser, setExtUser] = useState<ExternalUser | null>(null);
  const [schoolData, setSchoolData] = useState<any>(null);
  const [systemApps, setSystemApps] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState("こんにちは");

  // アプリごとのバッジ・通知用ステート
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [hasMention, setHasMention] = useState(false);
  const [rentalsActiveCount, setRentalsActiveCount] = useState(0);
  const [hasOverdueRental, setHasOverdueRental] = useState(false);
  const [boardUnreadCount, setBoardUnreadCount] = useState(0);

  // ★ surveys 用のステートを追加
  const [surveysList, setSurveysList] = useState<any[]>([]);
  const [myRespondedIds, setMyRespondedIds] = useState<Set<string>>(new Set());
  const [surveysUnansweredCount, setSurveysUnansweredCount] = useState(0);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour <= 10) return "おはようございます";
    else if (hour >= 11 && hour <= 17) return "こんにちは";
    else return "こんばんは";
  };

  useEffect(() => {
    setGreeting(getGreeting());

    let unsubChatRooms: (() => void) | undefined;
    let unsubRentals: (() => void) | undefined;
    let unsubBoard: (() => void) | undefined;
    let unsubSurveys: (() => void) | undefined;
    let unsubMyResponses: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const qExt = query(collection(db, "external_users"), where("authUid", "==", user.uid));
          const extSnap = await getDocs(qExt);
          
          if (!extSnap.empty) {
            const docData = extSnap.docs[0].data();
            const userData = { id: extSnap.docs[0].id, ...docData } as ExternalUser;
            setExtUser(userData);

            const schoolSnap = await getDoc(doc(db, "schools", userData.schoolId));
            if (schoolSnap.exists()) {
              setSchoolData(schoolSnap.data());
            }

            const appsSnap = await getDocs(collection(db, "system_apps"));
            setSystemApps(appsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            
            const allowedModules: string[] = userData.allowedModules || [];

            if (allowedModules.includes("chat")) {
              const qChat = query(collection(db, "chat_rooms"), where("schoolId", "==", userData.schoolId), where("members", "array-contains", userData.id));
              unsubChatRooms = onSnapshot(qChat, (snapshot) => {
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

            // ★ アンケート (surveys) のバッジ処理（必須回答かつ未回答の数をカウント）
            if (allowedModules.includes("surveys")) {
              const qSurveys = query(collection(db, "surveys"), where("tenantId", "==", userData.schoolId));
              unsubSurveys = onSnapshot(qSurveys, (snapshot) => {
                const sList: any[] = [];
                snapshot.forEach(d => sList.push({ id: d.id, ...d.data() }));
                setSurveysList(sList);
              });

              const qResp = query(collection(db, "survey_responses"), where("respondentId", "==", userData.id));
              unsubMyResponses = onSnapshot(qResp, (snapshot) => {
                const ids = new Set<string>();
                snapshot.forEach(d => ids.add(d.data().surveyId));
                setMyRespondedIds(ids);
              });
            }

            setIsLoading(false);
          } else {
            router.push("/top");
          }
        } catch (error) {
          setIsLoading(false);
        }
      } else {
        router.push("/ext-login"); 
      }
    });

    return () => {
      unsubscribe();
      if (unsubChatRooms) unsubChatRooms();
      if (unsubRentals) unsubRentals();
      if (unsubBoard) unsubBoard();
      if (unsubSurveys) unsubSurveys();
      if (unsubMyResponses) unsubMyResponses();
    };
  }, [router]);

  // ★ Surveysの未回答数を計算
  useEffect(() => {
    if (!extUser) return;
    const now = Date.now();
    let count = 0;
    
    surveysList.forEach(s => {
      if (!s.settings?.acceptingResponses) return;
      const start = s.settings.startDate ? new Date(s.settings.startDate).getTime() : 0;
      const end = s.settings.endDate ? new Date(s.settings.endDate).getTime() : Infinity;
      if (now < start || now > end) return;
      
      const target = s.settings.accessTarget;
      // 自分が回答対象のアンケートか確認
      if (target === "external_users" || target === "public" || (target === "selected_users" && s.settings.respondentIds?.includes(extUser.id))) {
        // 必須回答者に含まれていて、まだ回答していない場合カウント
        if (s.settings.requiredRespondentIds?.includes(extUser.id) && !myRespondedIds.has(s.id)) {
          count++;
        }
      }
    });
    setSurveysUnansweredCount(count);
  }, [surveysList, myRespondedIds, extUser]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/ext-login");
  };

  if (isLoading) return <div className="min-h-screen flex justify-center items-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  if (!extUser) return null;

  const allowedModules: string[] = extUser.allowedModules || ["chat"];
  
  const availableApps = allowedModules.map(appId => {
    const appMeta = systemApps.find(a => a.appId === appId || a.id === appId);
    const customName = schoolData?.customExternalAppNames?.[appId] || schoolData?.customAppNames?.[appId];
    const customDesc = schoolData?.customAppDescriptions?.[appId];
    
    // ★ surveys の場合は、外部ユーザー用のアンケート一覧に飛ばすか、直接アプリを起動させる
    let href = appMeta?.externalPath || `/ext-top/${appId}`;
    if (appId === "chat") href = "/ext-top/chat";
    // もし外部ユーザー用の専用一覧ページ `/ext-top/surveys` を作っていない場合は、
    // ここで一旦トップレベルの `/top/surveys` に飛ばして権限確認させることも可能ですが、
    // セキュリティ上 `/ext-top/surveys` を作成して一覧表示させるのが王道です。

    return {
      id: appId,
      name: customName || appMeta?.name || appId,
      description: customDesc || appMeta?.description || "このアプリケーションは利用可能です",
      icon: appMeta?.icon || (appId === "surveys" ? "FileText" : "Box"),
      color: appMeta?.color || (appId === "surveys" ? "purple" : "indigo"),
      href: href,
      order: appMeta?.order ?? 999
    };
  }).sort((a, b) => a.order - b.order); 

  const renderAppBadge = (appId: string) => {
    if (appId === "chat" && chatUnreadCount > 0) return <span className={`px-2 py-0.5 text-[10px] font-black rounded-full shadow-sm flex items-center gap-1 ${hasMention ? 'bg-red-600 text-white animate-pulse' : 'bg-red-500 text-white'}`}><Bell className="w-2.5 h-2.5" />{chatUnreadCount}</span>;
    if (appId === "equipment" && rentalsActiveCount > 0) return <span className={`px-2 py-0.5 text-[10px] font-black rounded-full shadow-sm flex items-center gap-1 ${hasOverdueRental ? 'bg-red-600 text-white animate-pulse' : 'bg-blue-500 text-white'}`}><AlertCircle className="w-2.5 h-2.5" />{hasOverdueRental ? '期限超過' : `${rentalsActiveCount}件 貸出中`}</span>;
    if (appId === "board" && boardUnreadCount > 0) return <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full shadow-sm flex items-center gap-1">新着 {boardUnreadCount}</span>;
    
    // ★ surveys のバッジ
    if (appId === "surveys" && surveysUnansweredCount > 0) return <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full shadow-sm flex items-center gap-1 animate-pulse"><AlertCircle className="w-2.5 h-2.5" /> 必須 {surveysUnansweredCount}件</span>;
    
    return null;
  };

  return (
    <div className="h-[100dvh] bg-[#F4F7F6] font-sans text-gray-900 flex flex-col overflow-hidden">
      
      <ExtHeader 
        schoolData={schoolData} 
        handleLogout={handleLogout}
        appBadges={{
          chat: { unread: chatUnreadCount, mention: hasMention },
          equipment: { active: rentalsActiveCount, overdue: hasOverdueRental },
          board: { unread: boardUnreadCount },
          // Header側にsurveysバッジ表示機能があれば渡しておく
          surveys: { unread: surveysUnansweredCount } 
        }}
      />

      <main className="flex-1 overflow-y-auto w-full custom-scrollbar">
        <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm flex items-center gap-4 animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-yellow-400 to-amber-500 flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
              {extUser.name?.charAt(0) || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-black text-gray-900 truncate">
                {greeting}、{extUser.name} さん
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm font-bold text-gray-500 mt-1">
                <span className="flex items-center gap-1 min-w-0 truncate">
                  <User className="w-3.5 h-3.5 shrink-0" /> 
                  <span className="truncate">{extUser.affiliation || "ゲストユーザー"}</span>
                </span>
                <span className="text-gray-300 shrink-0 hidden sm:inline">|</span> 
                <span className="shrink-0 bg-gray-100 px-1.5 py-0.5 rounded-md text-[10px]">
                  期限: {extUser.validUntil ? extUser.validUntil.replace(/-/g, '/') : "無期限"}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black text-gray-700 mb-3 ml-1 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-indigo-500" /> ご利用可能なメニュー
            </h3>
            
            {availableApps.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-10 h-10 text-gray-300 mb-2" />
                <p className="text-sm font-black text-gray-600">現在利用可能なアプリがありません</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {availableApps.map((app, idx) => (
                  <div key={idx} onClick={() => router.push(app.href)} className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all group flex items-start gap-4 relative">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-${app.color}-50 text-${app.color}-600 group-hover:scale-110 transition-transform`}>
                      <DynamicIcon name={app.icon} className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-black text-gray-900 group-hover:text-indigo-700 transition-colors truncate">{app.name}</h4>
                        {renderAppBadge(app.id)}
                      </div>
                      <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 line-clamp-2 leading-relaxed">{app.description}</p>
                    </div>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center shrink-0">
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-[9px] font-bold text-gray-500 text-center pb-8 pt-4">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
            <Link href="/legal/terms" className="hover:text-gray-300 transition-colors">利用規約</Link>
            <Link href="/legal/privacy" className="hover:text-gray-300 transition-colors">プライバシー</Link>
            <Link href="/legal/commercial" className="hover:text-gray-300 transition-colors">特定商取引法</Link>
          </div>
          <div className="text-[8px] text-gray-600 mt-0.5">&copy; {new Date().getFullYear()} YORIKURU / 生徒会ポータルシステム</div>
        </div>
      </main>
    </div>
  );
}