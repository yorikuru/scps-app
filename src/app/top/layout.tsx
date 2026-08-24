"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, collection, query, where, onSnapshot, orderBy, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Loader2, ShieldAlert } from "lucide-react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import DisasterAlertWidget from "./components/DisasterAlertWidget";
import { UserData, SchoolData, SystemMessage, SystemApp } from "./page";
import { PresenceState } from "./presence/types";

type ExtendedSchoolData = SchoolData & {
  availableModules?: string[];
  customAppNames?: Record<string, string>;
  photoURL?: string; 
  logoURL?: string;  
};

export default function TopLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [schoolData, setSchoolData] = useState<ExtendedSchoolData | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]); 
  const [systemApps, setSystemApps] = useState<SystemApp[]>([]);
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  const [accessDeniedApp, setAccessDeniedApp] = useState<string | null>(null);
  const [accountStatusError, setAccountStatusError] = useState<string | null>(null);

  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [hasChatMention, setHasChatMention] = useState(false);
  const [activeRentalsCount, setActiveRentalsCount] = useState(0);
  const [hasOverdueRental, setHasOverdueRental] = useState(false);
  const [surveyUnansweredCount, setSurveyUnansweredCount] = useState(0);
  const [surveyRequiredUnansweredCount, setSurveyRequiredUnansweredCount] = useState(0);

  // ★ 修正：onAuthStateChanged の中のリスナーを適切に解除する仕組みに変更
  useEffect(() => {
    let unsubUser: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubUser = onSnapshot(
          doc(db, "users", user.uid), 
          (userDocSnap) => {
            if (!userDocSnap.exists()) { router.push("/login"); return; }
            const uData = { id: user.uid, ...userDocSnap.data() } as UserData;
            setUserData(uData);
          },
          (error) => {
            // ログアウト時などに発生する権限エラーを握りつぶす
            console.warn("User listener disconnected");
          }
        );
      } else {
        if (unsubUser) unsubUser();
        setUserData(null);
        router.push("/login");
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUser) unsubUser();
    };
  }, [router]);

  useEffect(() => {
    if (!userData?.id || !userData?.schoolId) return;

    const updatePresenceState = async (newState: PresenceState, isAuto: boolean) => {
      try {
        const ref = doc(db, "presence_statuses", userData.id);
        const snap = await getDoc(ref);
        const nowIso = new Date().toISOString();

        if (!snap.exists()) {
          await setDoc(ref, {
            userId: userData.id,
            schoolId: userData.schoolId,
            userName: userData.name,
            userPhotoURL: userData.photoURL || null,
            positionName: userData.positionName || "",
            role: userData.role,
            systemId: (userData as any).systemId || "",
            currentState: newState,
            isAutoOnline: isAuto,
            lastActiveAt: nowIso,
            updatedAt: serverTimestamp(),
          });
        } else {
          const data = snap.data();
          if (data.isAutoOnline !== false || newState === "offline") {
            await setDoc(ref, {
              ...data,
              currentState: newState,
              isAutoOnline: isAuto,
              lastActiveAt: nowIso,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          }
        }
      } catch (e) {
        // console.error(e);
      }
    };

    updatePresenceState("available", true);

    const handleVisibilityChange = () => {
      if (document.hidden) updatePresenceState("away", true);
      else updatePresenceState("available", true);
    };

    const handleBeforeUnload = () => {
      const ref = doc(db, "presence_statuses", userData.id);
      setDoc(ref, { currentState: "offline", isAutoOnline: true, lastActiveAt: new Date().toISOString() }, { merge: true }).catch(()=>{});
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [userData]);

  useEffect(() => {
    if (!userData) return;
    if (userData.accountStatus !== "active") {
      if (userData.accountStatus === "unaccessed" && (pathname.startsWith("/top/setup") || pathname.startsWith("/setup"))) {
        setAccountStatusError(null);
      } else {
        setAccountStatusError(userData.accountStatus);
      }
    } else {
      setAccountStatusError(null);
    }
  }, [userData, pathname]);

  // ★ 修正：すべてのリスナーにエラーハンドラーを追加し、ログアウト時のエラーを握りつぶす
  useEffect(() => {
    if (!userData?.schoolId) return;
    
    const unsubSchool = onSnapshot(
      doc(db, "schools", userData.schoolId), 
      (schoolDocSnap) => {
        const sData = schoolDocSnap.exists() ? { id: schoolDocSnap.id, ...schoolDocSnap.data() } as ExtendedSchoolData : null;
        setSchoolData(sData);
      },
      () => {} // ログアウト時のエラーを無視
    );

    const qTenantUsers = query(collection(db, "users"), where("schoolId", "==", userData.schoolId));
    const unsubTenantUsers = onSnapshot(
      qTenantUsers, 
      (snap) => {
        const users: UserData[] = [];
        snap.forEach(d => users.push({ id: d.id, ...d.data() } as UserData));
        setTenantUsers(users);
      },
      () => {}
    );

    return () => {
      unsubSchool();
      unsubTenantUsers();
    };
  }, [userData?.schoolId]);

  useEffect(() => {
    if (!userData?.schoolId) return;

    const qApps = query(collection(db, "system_apps"), orderBy("order", "asc"));
    const unsubApps = onSnapshot(
      qApps, 
      (snap) => {
        const appsList: SystemApp[] = [];
        snap.forEach(d => appsList.push({ id: d.id, appId: d.id, ...d.data() } as SystemApp));
        setSystemApps(appsList);
      },
      () => {}
    );

    const qMessages = query(collection(db, "system_messages"), where("targetTenants", "array-contains", userData.schoolId));
    const unsubMessages = onSnapshot(
      qMessages, 
      (snap) => {
         const msgs: SystemMessage[] = [];
         snap.forEach(d => msgs.push({ id: d.id, ...d.data() } as SystemMessage));
         setMessages(msgs);
      },
      () => {}
    );

    const qEvents = query(collection(db, "events"), where("schoolId", "==", userData.schoolId));
    const unsubEvents = onSnapshot(
      qEvents, 
      (snap) => {
         const evs: any[] = [];
         snap.forEach(d => evs.push({ id: d.id, ...d.data() }));
         setAllEvents(evs);
      },
      () => {}
    );

    return () => {
      unsubApps();
      unsubMessages();
      unsubEvents();
    };
  }, [userData?.schoolId]);

  useEffect(() => {
    if (!userData || !schoolData) return;

    const needsPassword = !!(userData as any).initialPassword;
    const needsLine = !!(userData as any).lineConnectionEnforced && !(userData as any).lineUid;
    const hasTotp = !!(userData as any).totpSecret;
    const hasPasskey = Array.isArray((userData as any).passkeys) && (userData as any).passkeys.length > 0;
    const hasEmail = !!userData.email || !!auth.currentUser?.email; 
    
    const activePolicies = (userData as any).useCustomMfaPolicy && (userData as any).mfaPolicies ? (userData as any).mfaPolicies : (schoolData?.mfaPolicies || { email: { allowSetup: true, forceSetup: false, allowUsage: true }, totp: { allowSetup: false, forceSetup: false, allowUsage: false }, passkey: { allowSetup: false, forceSetup: false, allowUsage: false }});
    
    let needsMfa = false;
    if (activePolicies.totp?.forceSetup && !hasTotp) needsMfa = true;
    if (activePolicies.passkey?.forceSetup && !hasPasskey) needsMfa = true;
    if (activePolicies.email?.forceSetup && !hasEmail) needsMfa = true;
    
    const isMfaGloballyRequired = schoolData?.requireMfa === true || String(schoolData?.requireMfa) === "true" || (userData as any).requireMfa === true || String((userData as any).requireMfa) === "true";
    if (isMfaGloballyRequired && !needsMfa) {
      const hasValidMfa = (activePolicies.totp?.allowUsage && hasTotp) || (activePolicies.passkey?.allowUsage && hasPasskey) || (activePolicies.email?.allowUsage && hasEmail);
      if (!hasValidMfa) needsMfa = true; 
    }
    
    setIsBlocked(needsPassword || needsLine || needsMfa);
    setIsLoading(false); 
  }, [userData, schoolData]);

  useEffect(() => {
    if (!userData || !schoolData) return;

    let unsubChatRooms: (() => void) | undefined;
    let unsubRentals: (() => void) | undefined;
    let unsubSurveys: (() => void) | undefined;
    let unsubSurveyResponses: (() => void) | undefined;

    if (userData.allowedModules?.includes("chat") || userData.role === "admin" || userData.role === "system_admin" || userData.isITManager) {
      const qChat = query(collection(db, "chat_rooms"), where("schoolId", "==", userData.schoolId), where("members", "array-contains", userData.id));
      unsubChatRooms = onSnapshot(
        qChat, 
        (snapshot) => {
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
          setHasChatMention(mentionDetected);
        },
        () => {}
      );
    }

    if (userData.allowedModules?.includes("equipment") || userData.role === "admin" || userData.role === "system_admin" || userData.isITManager) {
      const qRentals = query(collection(db, "rentals"), where("schoolId", "==", userData.schoolId));
      unsubRentals = onSnapshot(
        qRentals, 
        (snapshot) => {
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
          setActiveRentalsCount(activeCount);
          setHasOverdueRental(overdueDetected);
        },
        () => {}
      );
    }

    if (userData.allowedModules?.includes("surveys") || userData.role === "admin" || userData.role === "system_admin" || userData.isITManager) {
      let currentSurveys: any[] = [];
      let myRespondedIds = new Set<string>();

      const calculateSurveyBadges = () => {
        let requiredUnanswered = 0;
        let optionalUnanswered = 0;
        const now = new Date().getTime();

        currentSurveys.forEach(survey => {
          const sData = survey.settings || {};
          const accepting = sData.acceptingResponses ?? survey.isActive ?? true;
          if (!accepting) return;

          const startDate = sData.startDate ? new Date(sData.startDate).getTime() : 0;
          const endDate = sData.endDate ? new Date(sData.endDate).getTime() : Infinity;
          if (now < startDate || now > endDate) return;

          const accessTarget = sData.accessTarget ?? (survey.isPublic ? "public" : "tenant_members");
          let isTarget = false;
          if (["tenant_members", "external_users", "public"].includes(accessTarget)) isTarget = true;
          else if (accessTarget === "selected_users" && (sData.respondentIds || []).includes(userData.id)) isTarget = true;

          if (isTarget && !myRespondedIds.has(survey.id)) {
            if ((sData.requiredRespondentIds || []).includes(userData.id)) {
              requiredUnanswered++;
            } else {
              optionalUnanswered++;
            }
          }
        });

        setSurveyRequiredUnansweredCount(requiredUnanswered);
        setSurveyUnansweredCount(optionalUnanswered);
      };

      const qSurveys = query(collection(db, "surveys"), where("tenantId", "==", userData.schoolId));
      unsubSurveys = onSnapshot(
        qSurveys, 
        (snap) => {
          currentSurveys = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          calculateSurveyBadges();
        },
        () => {}
      );

      const qMyResponses = query(collection(db, "survey_responses"), where("respondentId", "==", userData.id));
      unsubSurveyResponses = onSnapshot(
        qMyResponses, 
        (snap) => {
          myRespondedIds = new Set(snap.docs.map(d => d.data().surveyId));
          calculateSurveyBadges();
        },
        () => {}
      );
    }

    return () => {
      if (unsubChatRooms) unsubChatRooms();
      if (unsubRentals) unsubRentals();
      if (unsubSurveys) unsubSurveys();
      if (unsubSurveyResponses) unsubSurveyResponses();
    };
  }, [userData, schoolData]);

  useEffect(() => {
    if (isLoading || !userData || !schoolData || systemApps.length === 0) return;

    const currentApp = systemApps.find(app => (app as any).path && pathname.startsWith((app as any).path) && (app as any).path !== "/top");

    if (currentApp) {
      const appId = (currentApp as any).appId || currentApp.id;

      const isTenantAllowed = schoolData.availableModules?.includes(appId);
      const isUserAllowed = (userData as any).allowedModules?.includes(appId);
      const roleKey = (userData.role || "guest") as string;
      const defaultRoles = (currentApp as any).defaultRoles || { admin: true, it_manager: true, teacher: true, officer: true, guest: false };
      const perms = (schoolData as any).appPermissions?.[appId] || defaultRoles;
      const isRoleAllowed = perms[roleKey] !== false;

      if (userData.role !== "system_admin" && (!isTenantAllowed || !isUserAllowed || !isRoleAllowed)) {
        const appName = schoolData.customAppNames?.[appId] || currentApp.name;
        setAccessDeniedApp(appName);
      } else {
        setAccessDeniedApp(null);
      }
    } else {
      setAccessDeniedApp(null);
    }
  }, [pathname, isLoading, userData, schoolData, systemApps]);

  const handleLogout = async () => {
    if (userData?.id) {
      try {
        const ref = doc(db, "presence_statuses", userData.id);
        await setDoc(ref, { currentState: "offline", isAutoOnline: true, lastActiveAt: new Date().toISOString() }, { merge: true });
      } catch (e) {}
    }
    await auth.signOut();
    router.push("/login");
  };

  if (isLoading) {
    return <div className="fixed inset-0 flex items-center justify-center bg-[#F9FAFB]"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  const isPrintPage = pathname.includes("/equipment/print");
  const hideLayoutPaths = ["/top/setup", "/top/status-standalone"]; 
  const isBlurNeeded = accessDeniedApp || accountStatusError;

  const renderModals = () => (
    <>
      {accountStatusError && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-gray-100 p-6 sm:p-8 text-center">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm border border-red-100">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-3">
              {accountStatusError === "pending" ? "承認待ちアカウント" :
               accountStatusError === "rejected" ? "アカウント利用停止" :
               accountStatusError === "unaccessed" ? "初期設定未完了" : "アクセス制限"}
            </h3>
            <p className="text-sm font-bold text-gray-500 mb-8 leading-relaxed">
              {accountStatusError === "pending" ? "あなたのアカウントは現在、管理者による承認待ちです。承認が完了するまでシステムを利用できません。" :
               accountStatusError === "rejected" ? "あなたのアカウントは管理者によって利用が停止されています。詳細はテナント管理者へお問い合わせください。" :
               accountStatusError === "unaccessed" ? "アカウントの初期設定が完了していません。初回ログインのセットアップを行ってください。" :
               "このアカウントは現在利用できません。"}
            </p>
            <div className="flex flex-col gap-3">
              {accountStatusError === "unaccessed" && (
                <button 
                  onClick={() => router.push("/setup/password")}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white text-sm font-black rounded-2xl shadow-lg active:scale-[0.98]"
                >
                  初期設定へ進む
                </button>
              )}
              <button 
                onClick={handleLogout} 
                className="w-full py-4 bg-gray-900 hover:bg-black transition-colors text-white text-sm font-black rounded-2xl shadow-lg active:scale-[0.98]"
              >
                ログアウトして戻る
              </button>
            </div>
          </div>
        </div>
      )}

      {accessDeniedApp && !accountStatusError && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-gray-100 p-6 sm:p-8 text-center">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm border border-red-100">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-3">アクセス権限がありません</h3>
            <p className="text-sm font-bold text-gray-500 mb-8 leading-relaxed">
              「<span className="text-gray-900">{accessDeniedApp}</span>」を利用する権限が付与されていません。<br/>
              テナント管理者によって権限が制限された可能性があります。
            </p>
            <button 
              onClick={() => {
                setAccessDeniedApp(null);
                router.replace("/top");
              }} 
              className="w-full py-4 bg-gray-900 hover:bg-black transition-colors text-white text-sm font-black rounded-2xl shadow-lg active:scale-[0.98]"
            >
              ダッシュボードへ戻る
            </button>
          </div>
        </div>
      )}
    </>
  );

  if (isBlocked || isPrintPage || hideLayoutPaths.includes(pathname)) {
    return (
      <>
        {renderModals()}
        <div className={`min-h-[100dvh] bg-white ${isBlurNeeded ? "pointer-events-none select-none blur-[4px] transition-all" : ""}`}>
          {children}
        </div>
      </>
    );
  }

  const canAccessSettings = Boolean(
    userData?.role === "admin" || 
    (userData as any)?.isITManager === true || 
    ((userData as any)?.positionName && ((userData as any).positionName.includes("会長") || (userData as any).positionName.includes("顧問")))
  );

  const availableApps = systemApps.filter(app => {
    if (!app.isActive) return false;
    const appId = (app as any).appId || app.id;

    if (schoolData?.availableModules && !schoolData.availableModules.includes(appId)) return false;
    if ((userData as any)?.allowedModules && !(userData as any).allowedModules.includes(appId)) return false;

    const roleKey = (userData?.role || "guest") as string;
    const defaultRoles = (app as any).defaultRoles || { admin: true, it_manager: true, teacher: true, officer: true, guest: false };
    const perms = (schoolData as any)?.appPermissions?.[appId] || defaultRoles;
    if (perms[roleKey] === false) return false;
    
    return true;
  }).map(app => {
    const appId = (app as any).appId || app.id;
    const customName = schoolData?.customAppNames?.[appId];
    return { ...app, displayName: (customName && customName.trim() !== "") ? customName : app.name };
  });

  return (
    <>
      {renderModals()}
      <div className="fixed inset-0 flex w-full bg-white text-gray-900 font-sans overflow-hidden">
        
        {/* @ts-ignore SidebarのPropsにappBadgesを追加するまで型エラーを無視 */}
        <Sidebar 
          isSidebarOpen={isSidebarOpen} 
          setIsSidebarOpen={setIsSidebarOpen}
          schoolData={schoolData} 
          userData={userData}
          availableApps={availableApps} 
          selectedDate={selectedDate} 
          setSelectedDate={setSelectedDate} 
          allEvents={allEvents} 
          appBadges={{
            chat: { unread: chatUnreadCount, mention: hasChatMention },
            equipment: { active: activeRentalsCount, overdue: hasOverdueRental },
            surveys: { required: surveyRequiredUnansweredCount, optional: surveyUnansweredCount }
          }}
        />
        
        <div className="flex-1 flex flex-col min-w-0 bg-[#F9FAFB] h-full overflow-hidden">
          <Header 
            isSidebarOpen={isSidebarOpen} 
            setIsSidebarOpen={setIsSidebarOpen}
            userData={userData} 
            messages={messages} 
            tenantUsers={tenantUsers} 
            canAccessSettings={canAccessSettings}
            handleLogout={handleLogout} 
            isProfileMenuOpen={isProfileMenuOpen} 
            setIsProfileMenuOpen={setIsProfileMenuOpen}
          />
          
          <main className="flex-1 min-h-0 w-full relative flex flex-col overflow-y-auto overscroll-contain">
            <div className={isBlurNeeded ? "pointer-events-none select-none blur-[4px] transition-all flex flex-col flex-1 min-h-full pb-20 md:pb-6" : "flex flex-col flex-1 min-h-full pb-20 md:pb-6"}>
              
              <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 lg:pt-6 empty:hidden flex-shrink-0 z-40">
                <DisasterAlertWidget schoolData={schoolData} />
              </div>

              {children}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}