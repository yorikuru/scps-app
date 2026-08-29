"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, orderBy, onSnapshot, setDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import * as LucideIcons from "lucide-react";
import { Loader2, AlertTriangle, CalendarDays, MapPin, Printer } from "lucide-react";

import { UserData } from "../page";
import { UserPresence, PresenceState, PresenceLocation, ScheduledPresence, WeeklyDayRoutine } from "./types";
import StatusOverview from "./components/StatusOverview";
import MyStatusEditor from "./components/MyStatusEditor";
import WeeklyScheduleEditor from "./components/WeeklyScheduleEditor";
import LocationMaster from "./components/LocationMaster";

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

const DEFAULT_LOCATIONS = [
  { id: "default_1", name: "生徒会室", isDefault: true, isHidden: false, order: 1 },
  { id: "default_2", name: "会議室", isDefault: true, isHidden: false, order: 2 },
  { id: "default_3", name: "学校内", isDefault: true, isHidden: false, order: 3 },
  { id: "default_4", name: "職員室", isDefault: true, isHidden: false, order: 4 },
  { id: "default_5", name: "オフィス", isDefault: true, isHidden: false, order: 5 },
  { id: "default_6", name: "外部取引先", isDefault: true, isHidden: false, order: 6 },
  { id: "default_7", name: "自宅", isDefault: true, isHidden: false, order: 7 },
];

const isToday = (isoString?: string) => {
  if (!isoString) return false;
  const d = new Date(isoString);
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
};

export default function PresencePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]);
  const [appConfig, setAppConfig] = useState({ name: "メンバー動静", icon: "Users", color: "indigo" });
  const [hasPermission, setHasPermission] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const [presences, setPresences] = useState<UserPresence[]>([]);
  const [myPresence, setMyPresence] = useState<UserPresence | null>(null);
  const [locations, setLocations] = useState<PresenceLocation[]>([]);

  const [schedules, setSchedules] = useState<ScheduledPresence[]>([]);
  const [routines, setRoutines] = useState<WeeklyDayRoutine[]>([]);

  const modalParam = searchParams.get("modal"); 
  const proxyParam = searchParams.get("proxy"); 

  const showScheduleModal = modalParam === "schedule";
  const showLocationModal = modalParam === "location";

  const [toast, setToast] = useState<{ show: boolean; type: "success" | "error"; message: string }>({ show: false, type: "success", message: "" });
  const showAlert = (type: "success" | "error", message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 3000);
  };

  const openModal = (modalName: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("modal", modalName);
    router.push(`${pathname}?${params.toString()}`);
  };

  const closeModal = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("modal");
    params.delete("proxy");
    params.delete("tab");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const openProxy = (userId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("proxy", userId);
    router.push(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    let unsubUsers: (() => void) | undefined;
    let unsubPresences: (() => void) | undefined;
    let unsubLocations: (() => void) | undefined;
    let unsubSchedules: (() => void) | undefined;
    let unsubRoutines: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocSnap = await getDoc(doc(db, "users", user.uid));
          if (!userDocSnap.exists()) { router.push("/login"); return; }
          const uData = { id: user.uid, ...userDocSnap.data() } as UserData;
          setUserData(uData);

          const schoolDocSnap = await getDoc(doc(db, "schools", uData.schoolId));
          const schoolData = schoolDocSnap.exists() ? schoolDocSnap.data() as any : {};

          const qApps = query(collection(db, "system_apps"), where("appId", "==", "presence"));
          const appsSnap = await getDocs(qApps);
          let presenceApp: any = appsSnap.empty ? { appId: "presence", name: "メンバー動静", icon: "Users", color: "indigo", isActive: true } : appsSnap.docs[0].data();

          let allowed = true;
          if (!presenceApp.isActive) allowed = false;
          if (schoolData.availableModules && !schoolData.availableModules.includes("presence")) allowed = false;
          const roleKey = uData.role || "guest";
          const defaultRoles = presenceApp.defaultRoles || { admin: true, it_manager: true, teacher: true, officer: true, guest: false };
          const perms = schoolData.appPermissions?.["presence"] || defaultRoles;
          if (perms[roleKey] === false) allowed = false;

          if (!allowed) { setHasPermission(false); setIsLoading(false); return; }

          setAppConfig({
            name: (schoolData.customAppNames?.["presence"] || presenceApp.name || "メンバー動静").trim(),
            icon: presenceApp.icon || "Users", color: presenceApp.color || "indigo"
          });

          const qLoc = query(collection(db, "presence_locations"), where("schoolId", "==", uData.schoolId), orderBy("order", "asc"));
          unsubLocations = onSnapshot(qLoc, async (snap) => {
            if (snap.empty) {
              const batch = writeBatch(db);
              DEFAULT_LOCATIONS.forEach(loc => {
                const docRef = doc(db, "presence_locations", `${uData.schoolId}_${loc.id}`);
                batch.set(docRef, { ...loc, schoolId: uData.schoolId });
              });
              await batch.commit();
            } else {
              const locList: PresenceLocation[] = [];
              snap.forEach(d => locList.push({ id: d.id, ...d.data() } as PresenceLocation));
              setLocations(locList);
            }
          });

          unsubUsers = onSnapshot(query(collection(db, "users"), where("schoolId", "==", uData.schoolId)), (snap) => {
            const list: UserData[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() } as UserData));
            setTenantUsers(list);
          });

          unsubPresences = onSnapshot(query(collection(db, "presence_statuses"), where("schoolId", "==", uData.schoolId)), (snap) => {
            const presList: UserPresence[] = [];
            snap.forEach((d) => {
              const data = { id: d.id, ...d.data() } as UserPresence;
              if (data.statusUpdatedAt && !isToday(data.statusUpdatedAt)) {
                data.statusMessage = "";
                data.locationId = null;
              }
              presList.push(data);
            });
            setPresences(presList);
            const mine = presList.find((p) => p.userId === uData.id) || null;
            setMyPresence(mine);
          });

          unsubSchedules = onSnapshot(query(collection(db, "presence_schedules"), where("schoolId", "==", uData.schoolId)), (snap) => {
            const list: ScheduledPresence[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() } as ScheduledPresence));
            setSchedules(list);
          });

          unsubRoutines = onSnapshot(query(collection(db, "presence_weekly_templates"), where("schoolId", "==", uData.schoolId)), (snap) => {
            const list: WeeklyDayRoutine[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() } as WeeklyDayRoutine));
            setRoutines(list);
          });

          await sendHeartbeat(uData);
          setIsLoading(false);
        } catch (e) { setIsLoading(false); }
      } else { router.push("/login"); }
    });

    return () => { 
      unsubscribeAuth(); 
      if (unsubUsers) unsubUsers(); 
      if (unsubPresences) unsubPresences(); 
      if (unsubLocations) unsubLocations(); 
      if (unsubSchedules) unsubSchedules();
      if (unsubRoutines) unsubRoutines();
    };
  }, [router]);

  useEffect(() => {
    if (!userData?.id) return;

    const updateVisibilityState = async (newState: PresenceState) => {
      try {
        const ref = doc(db, "presence_statuses", userData.id);
        const snap = await getDoc(ref);
        const nowIso = new Date().toISOString();

        if (snap.exists()) {
          const data = snap.data();
          if (data.isManualOverride === true) return; 

          await setDoc(ref, {
            ...data,
            currentState: newState,
            isAutoOnline: true,
            lastActiveAt: nowIso,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      } catch (e) {
        console.error(e);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) updateVisibilityState("away");
      else updateVisibilityState("available");
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

  const sendHeartbeat = async (u: UserData) => {
    try {
      const ref = doc(db, "presence_statuses", u.id);
      const snap = await getDoc(ref);
      const nowIso = new Date().toISOString();
      if (!snap.exists()) {
        await setDoc(ref, {
          userId: u.id, schoolId: u.schoolId, userName: u.name, userPhotoURL: u.photoURL || null, positionName: u.positionName || "", role: u.role, systemId: (u as any).systemId || "",
          currentState: "available" as PresenceState, isAutoOnline: true, isManualOverride: false, lastActiveAt: nowIso, updatedAt: serverTimestamp(),
          statusUpdatedAt: nowIso, updatedByUserId: null, updatedByUserName: null
        });
      } else {
        const data = snap.data();
        let payload: any = { lastActiveAt: nowIso, updatedAt: serverTimestamp(), systemId: (u as any).systemId || data.systemId || "" };
        if (!data.isManualOverride && (data.currentState === "offline" || data.isAutoOnline)) {
          payload.currentState = "available";
          payload.isAutoOnline = true;
        }
        if (data.statusUpdatedAt && !isToday(data.statusUpdatedAt)) {
          payload.statusMessage = "";
          payload.locationId = null;
          payload.statusUpdatedAt = nowIso;
        }
        await setDoc(ref, { ...data, ...payload }, { merge: true });
      }
    } catch (e) { console.error(e); }
  };

  const canManageAll = userData?.role === "admin" || (userData as any)?.isITManager || (userData as any)?.isManager;

  const handlePrint = () => {
    const toggleBtn = document.getElementById("sidebar-toggle-btn") as HTMLButtonElement | null;
    if (toggleBtn) {
      toggleBtn.click();
      setTimeout(() => { window.print(); setTimeout(() => { toggleBtn.click(); }, 500); }, 400);
    } else {
      window.print();
    }
  };

  const proxyTargetUser = tenantUsers.find(u => u.id === proxyParam) || null;

  if (isLoading) return <div className="h-full bg-[#F9FAFB] flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (!hasPermission) return <div className="h-full flex flex-col items-center justify-center p-4"><AlertTriangle className="w-12 h-12 text-red-500 mb-4" /><h1 className="text-xl font-black">アクセス権限がありません</h1></div>;

  return (
    // ★ flex-1 h-full と overscroll-none を追加
    <div className="flex-1 h-full w-full flex flex-col min-h-0 font-sans text-gray-900 bg-[#F9FAFB] relative overflow-hidden overscroll-none print:bg-white print:overflow-visible print:h-auto print:block">
      
      {toast.show && (
        <div className="absolute top-4 right-4 z-50 animate-fade-in w-fit max-w-sm print:hidden">
          <div className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center shadow-lg ${toast.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {toast.message}
          </div>
        </div>
      )}

      {/* アプリヘッダー */}
      <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-gray-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 print:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shadow-2xs shrink-0">
            <DynamicIcon name={appConfig.icon} className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 pr-2">
            <h1 className="text-sm sm:text-base font-black text-gray-900 tracking-tight truncate">{appConfig.name}</h1>
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 truncate">メンバーの現在のステータスと勤務先・スケジュール管理</p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 shrink-0">
          <button onClick={handlePrint} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-[11px] sm:text-xs font-bold transition-colors shadow-2xs whitespace-nowrap">
            <Printer className="w-3.5 h-3.5 text-gray-500" /> 動静名簿を印刷/PDF
          </button>
          
          {canManageAll && (
            <button onClick={() => openModal("location")} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-[11px] sm:text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 whitespace-nowrap">
              <MapPin className="w-3.5 h-3.5" /> 勤務先マスタ
            </button>
          )}
          <button onClick={() => openModal("schedule")} className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] sm:text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 whitespace-nowrap">
            <CalendarDays className="w-3.5 h-3.5" /> スケジュール設定
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-2.5 sm:p-4 lg:p-6 space-y-4 pb-20 sm:pb-6 min-h-0 print:p-0 print:overflow-visible">
        <div className="max-w-7xl mx-auto space-y-4 print:max-w-none">
          
          <div className="print:hidden">
            {userData && (
              <MyStatusEditor
                targetUser={userData}
                currentUser={userData}
                initialPresence={myPresence}
                schedules={schedules} 
                routines={routines}   
                locations={locations}
                showAlert={showAlert}
                onClose={closeModal}
                isModal={false}
              />
            )}
          </div>

          {userData && (
            <StatusOverview
              presences={presences}
              schedules={schedules} 
              routines={routines}   
              tenantUsers={tenantUsers}
              locations={locations}
              currentUser={userData}
              canManageAll={canManageAll}
              onProxyEdit={(user) => openProxy(user.id)}
            />
          )}

        </div>
      </main>

      {proxyParam && proxyTargetUser && userData && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4 animate-fade-in print:hidden">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-visible animate-slide-up sm:animate-fade-in border border-gray-200">
            <MyStatusEditor
              targetUser={proxyTargetUser}
              currentUser={userData}
              initialPresence={presences.find(p => p.userId === proxyTargetUser.id) || null}
              schedules={schedules}
              routines={routines}
              locations={locations}
              showAlert={showAlert}
              onClose={closeModal}
              isModal={true}
            />
          </div>
        </div>
      )}

      {showScheduleModal && userData && (
        <WeeklyScheduleEditor
          currentUser={userData}
          tenantUsers={tenantUsers}
          canManageAll={canManageAll}
          locations={locations}
          schedules={schedules} 
          onClose={closeModal}
          showAlert={showAlert}
        />
      )}

      {showLocationModal && userData && canManageAll && (
        <LocationMaster
          schoolId={userData.schoolId}
          locations={locations}
          onClose={closeModal}
          showAlert={showAlert}
        />
      )}

    </div>
  );
}