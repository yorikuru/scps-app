"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { 
  Settings, ShieldCheck, LogOut, MapPin, MessageSquareText, Save, ChevronDown, Check, RotateCcw
} from "lucide-react";
import { doc, collection, query, where, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserData } from "../page";
import { useDialog } from "@/components/DialogContext";
import { PRESENCE_CONFIG, PresenceState, PresenceLocation, UserPresence, ScheduledPresence, WeeklyDayRoutine, getEffectivePresence } from "../presence/types";

type Props = {
  userData: UserData | null;
  schoolData: any;
  isProfileMenuOpen: boolean;
  setIsProfileMenuOpen: (open: boolean) => void;
  canAccessSettings: boolean;
  handleLogout: () => void;
};

export default function ProfileMenu({
  userData, schoolData, isProfileMenuOpen, setIsProfileMenuOpen, canAccessSettings, handleLogout
}: Props) {
  const { showAlert } = useDialog();
  const profileRef = useRef<HTMLDivElement>(null);

  const [rawPresence, setRawPresence] = useState<UserPresence | null>(null);
  const [schedules, setSchedules] = useState<ScheduledPresence[]>([]);
  const [routines, setRoutines] = useState<WeeklyDayRoutine[]>([]);
  const [locations, setLocations] = useState<PresenceLocation[]>([]);
  
  const [isPresenceQuickEditOpen, setIsPresenceQuickEditOpen] = useState(false);
  const [quickState, setQuickState] = useState<PresenceState>("available");
  const [quickMessage, setQuickMessage] = useState("");
  const [quickLocationId, setQuickLocationId] = useState("");
  const [isUpdatingPresence, setIsUpdatingPresence] = useState(false);

  const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const myPresence = useMemo(() => getEffectivePresence(rawPresence, schedules, routines, new Date()), [rawPresence, schedules, routines, tick]);

  const isPresenceEnabled = useMemo(() => {
    if (!schoolData || !userData) return false;
    const exSchool = schoolData as any;
    const isTenantAllowed = exSchool.availableModules?.includes("presence");
    if (!isTenantAllowed) return false;
    const isUserAllowed = (userData as any).allowedModules?.includes("presence");
    if (!isUserAllowed) return false;
    const roleKey = (userData.role || "guest") as string;
    const perms = exSchool.appPermissions?.["presence"] || { admin: true, it_manager: true, teacher: true, officer: true, guest: false };
    if (perms[roleKey] === false) return false;
    return true;
  }, [schoolData, userData]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { 
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setIsProfileMenuOpen]);

  useEffect(() => {
    if (!userData?.id || !userData?.schoolId || !isPresenceEnabled) return;

    const unsubPresence = onSnapshot(doc(db, "presence_statuses", userData.id), (snap) => {
      if (snap.exists()) {
        setRawPresence({ id: snap.id, ...snap.data() } as UserPresence);
      }
    });

    const unsubSchedules = onSnapshot(query(collection(db, "presence_schedules"), where("schoolId", "==", userData.schoolId)), (snap) => {
      const list: ScheduledPresence[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as ScheduledPresence));
      setSchedules(list);
    });

    const unsubRoutines = onSnapshot(query(collection(db, "presence_weekly_templates"), where("schoolId", "==", userData.schoolId)), (snap) => {
      const list: WeeklyDayRoutine[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as WeeklyDayRoutine));
      setRoutines(list);
    });

    const qLoc = query(collection(db, "presence_locations"), where("schoolId", "==", userData.schoolId));
    const unsubLoc = onSnapshot(qLoc, (snap) => {
      const locList: PresenceLocation[] = [];
      snap.forEach(d => locList.push({ id: d.id, ...d.data() } as PresenceLocation));
      setLocations(locList);
    });

    return () => { unsubPresence(); unsubSchedules(); unsubRoutines(); unsubLoc(); };
  }, [userData, isPresenceEnabled]);

  useEffect(() => {
    if (myPresence) {
      setQuickState(myPresence.currentState || "available");
      setQuickMessage(myPresence.statusMessage || "");
      setQuickLocationId(myPresence.locationId || "");
    }
  }, [myPresence]);

  const handleQuickPresenceSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !isPresenceEnabled) return;
    setIsUpdatingPresence(true);
    try {
      const ref = doc(db, "presence_statuses", userData.id);
      await setDoc(ref, {
        userId: userData.id,
        schoolId: userData.schoolId,
        userName: userData.name,
        userPhotoURL: userData.photoURL || null,
        positionName: userData.positionName || "",
        role: userData.role,
        currentState: quickState,
        statusMessage: quickMessage.trim(),
        locationId: quickLocationId || null,
        lastActiveAt: new Date().toISOString(),
        statusUpdatedAt: new Date().toISOString(),
        isAutoOnline: false,
        isManualOverride: true, 
        updatedAt: serverTimestamp(),
      }, { merge: true });
      showAlert("ステータスを手動更新しました。", "success"); 
      setIsProfileMenuOpen(false);
      setIsPresenceQuickEditOpen(false);
    } catch (e) {
      showAlert("更新に失敗しました。", "error"); 
    } finally {
      setIsUpdatingPresence(false);
    }
  };

  const handleClearManualOverride = async () => {
    if (!userData || !isPresenceEnabled) return;
    setIsUpdatingPresence(true);
    try {
      const ref = doc(db, "presence_statuses", userData.id);
      await setDoc(ref, {
        currentState: "available",
        statusMessage: "",
        locationId: null,
        isAutoOnline: true,
        isManualOverride: false, 
        lastActiveAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      showAlert("スケジュールに従うように設定しました。", "success"); 
      setIsProfileMenuOpen(false);
      setIsPresenceQuickEditOpen(false);
    } catch (e) {
      showAlert("更新に失敗しました。", "error"); 
    } finally {
      setIsUpdatingPresence(false);
    }
  };

  const currentPresenceState = myPresence?.currentState || "available";
  const activeConfig = PRESENCE_CONFIG[currentPresenceState] || PRESENCE_CONFIG.available;
  const activeLocationName = locations.find(l => l.id === myPresence?.locationId)?.name;
  const visibleLocations = locations.filter(l => !l.isHidden || l.id === quickLocationId);
  const quickStateConfig = PRESENCE_CONFIG[quickState] || PRESENCE_CONFIG.available;
  const quickLocationName = locations.find(l => l.id === quickLocationId)?.name;

  return (
    <div className="relative" ref={profileRef}>
      <button 
        onClick={() => { setIsProfileMenuOpen(!isProfileMenuOpen); setIsPresenceQuickEditOpen(false); setIsStateDropdownOpen(false); setIsLocationDropdownOpen(false); }} 
        className="flex items-center p-0.5 rounded-full hover:bg-gray-100 transition-colors ml-1 relative group"
        title="プロフィール設定"
      >
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 shadow-sm relative">
          {(userData as any)?.photoURL ? (
            <img src={(userData as any).photoURL} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
              {userData?.name?.charAt(0) || "U"}
            </div>
          )}
        </div>
        {isPresenceEnabled && (
          <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-[1px] shadow-sm">
            <activeConfig.icon className={`w-3.5 h-3.5 ${activeConfig.fillClass}`} />
          </div>
        )}
      </button>
      
      {isProfileMenuOpen && (
        <div className="absolute right-[-10px] sm:right-0 top-full mt-2 w-72 sm:w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl p-3 z-50 animate-fade-in origin-top-right">
          
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
            <div className="relative shrink-0">
              {(userData as any)?.photoURL ? (
                <img src={(userData as any).photoURL} alt="Avatar" className="w-11 h-11 rounded-full object-cover border border-gray-100" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                  {userData?.name?.charAt(0) || "U"}
                </div>
              )}
              {isPresenceEnabled && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-[1px] shadow-sm">
                  <activeConfig.icon className={`w-3.5 h-3.5 ${activeConfig.fillClass}`} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-gray-900 truncate">{userData?.name}</p>
              {isPresenceEnabled ? (
                <p className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 mt-0.5">
                  <span className={activeConfig.colorClass}>{activeConfig.label}</span>
                  {activeLocationName && <span className="text-gray-400">・ {activeLocationName}</span>}
                </p>
              ) : (
                <p className="text-[10px] font-bold text-gray-500 truncate mt-0.5">{userData?.email || "メール未設定"}</p>
              )}
              {isPresenceEnabled && myPresence?.statusMessage && (
                <p className="text-[9px] font-medium text-gray-500 truncate mt-0.5 flex items-center gap-1">
                  <MessageSquareText className="w-3 h-3 text-gray-400" /> {myPresence.statusMessage}
                </p>
              )}
            </div>
          </div>

          {isPresenceEnabled && (
            !isPresenceQuickEditOpen ? (
              <div className="py-2.5">
                <button 
                  type="button" 
                  onClick={() => setIsPresenceQuickEditOpen(true)}
                  className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <MessageSquareText className="w-3.5 h-3.5" /> ステータス・勤務先を変更する
                </button>
                {rawPresence?.isManualOverride && (
                  <button type="button" onClick={handleClearManualOverride} className="mt-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-100 py-1.5 px-2 w-full flex items-center justify-center gap-1 transition-colors shadow-2xs">
                    <RotateCcw className="w-3.5 h-3.5" /> 手動設定を解除しスケジュールに従う
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleQuickPresenceSave} className="py-2.5 space-y-2.5 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-700">動静ステータス変更</span>
                  <button type="button" onClick={() => { setIsPresenceQuickEditOpen(false); setIsStateDropdownOpen(false); setIsLocationDropdownOpen(false); }} className="text-[10px] font-bold text-gray-400 hover:text-gray-600">戻る</button>
                </div>

                <div className="relative">
                  <label className="block text-[9px] font-bold text-gray-400 mb-1">状態</label>
                  <button
                    type="button"
                    onClick={() => { setIsStateDropdownOpen(!isStateDropdownOpen); setIsLocationDropdownOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
                  >
                    <span className={`flex items-center gap-2 ${quickStateConfig.colorClass}`}>
                      <quickStateConfig.icon className={`w-4 h-4 ${quickStateConfig.fillClass}`} />
                      {quickStateConfig.label}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isStateDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isStateDropdownOpen && (
                    <div className="mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg py-1 space-y-0.5 z-20">
                      {(Object.keys(PRESENCE_CONFIG) as PresenceState[]).map(st => {
                        const conf = PRESENCE_CONFIG[st];
                        const isSelected = quickState === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => { setQuickState(st); setIsStateDropdownOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-900 font-black' : 'hover:bg-gray-50 text-gray-700'}`}
                          >
                            <span className={`flex items-center gap-2 ${conf.colorClass}`}>
                              <conf.icon className={`w-4 h-4 ${conf.fillClass}`} />
                              {conf.label}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className="block text-[9px] font-bold text-gray-400 mb-1">勤務先</label>
                  <button
                    type="button"
                    onClick={() => { setIsLocationDropdownOpen(!isLocationDropdownOpen); setIsStateDropdownOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
                  >
                    <span className="flex items-center gap-2 truncate text-gray-700">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {quickLocationName || "勤務先を設定しない"}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isLocationDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isLocationDropdownOpen && (
                    <div className="mt-1 w-full max-h-48 overflow-y-auto custom-scrollbar bg-white border border-gray-200 rounded-xl shadow-lg py-1 space-y-0.5 z-20">
                      <button
                        type="button"
                        onClick={() => { setQuickLocationId(""); setIsLocationDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${!quickLocationId ? 'bg-indigo-50 text-indigo-900 font-black' : 'hover:bg-gray-50 text-gray-700'}`}
                      >
                        勤務先を設定しない
                      </button>
                      {visibleLocations.map(l => {
                        const isSelected = quickLocationId === l.id;
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => { setQuickLocationId(l.id); setIsLocationDropdownOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-900 font-black' : 'hover:bg-gray-50 text-gray-700'}`}
                          >
                            <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {l.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-gray-400 mb-1">メッセージ</label>
                  <input
                    type="text" value={quickMessage} onChange={e => setQuickMessage(e.target.value)}
                    placeholder="ステータスメッセージ..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-800 outline-none"
                  />
                </div>

                <button type="submit" disabled={isUpdatingPresence} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 mt-1">
                  <Save className="w-3.5 h-3.5" /> 保存する
                </button>
              </form>
            )
          )}

          <div className="space-y-1 pt-1 border-t border-gray-100">
            <Link href="/top/account" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-2 px-2.5 py-2 text-[11px] font-bold text-gray-700 hover:bg-gray-100 hover:text-indigo-600 rounded-md transition-colors">
              <Settings className="w-3.5 h-3.5" /> マイアカウント設定
            </Link>
            {canAccessSettings && (
              <Link href="/top/admin" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-2 px-2.5 py-2 text-[11px] font-bold text-gray-700 hover:bg-gray-100 hover:text-indigo-600 rounded-md transition-colors">
                <ShieldCheck className="w-3.5 h-3.5" /> テナント管理
              </Link>
            )}
            <button onClick={handleLogout} className="sm:hidden w-full flex items-center gap-2 px-2.5 py-2 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded-md transition-colors mt-1 border-t border-gray-100">
              <LogOut className="w-3.5 h-3.5" /> ログアウト
            </button>
          </div>

        </div>
      )}
    </div>
  );
}