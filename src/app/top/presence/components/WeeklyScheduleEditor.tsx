"use client";

import React, { useState, useEffect, useMemo } from "react";
import { doc, setDoc, deleteDoc, serverTimestamp, writeBatch, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { db } from "@/lib/firebase";
import { PRESENCE_CONFIG, PresenceState, WeeklyDayRoutine, ScheduledPresence, PresenceLocation, TimeSlotRoutine } from "../types";
import { UserData } from "../../page";
import { RotateCcw, X, Save, Trash2, MapPin, Search, Plus, Calendar, Zap, ChevronDown, Users, ChevronLeft, ChevronRight, AlertTriangle, MessageSquareText,Loader2, Check } from "lucide-react";

type Props = {
  currentUser: UserData;
  tenantUsers: UserData[];
  canManageAll: boolean;
  locations: PresenceLocation[];
  schedules: ScheduledPresence[];
  onClose: () => void;
  showAlert: (type: "success" | "error", message: string) => void;
};

const DAYS_OF_WEEK = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];

export default function WeeklyScheduleEditor({ currentUser, tenantUsers, canManageAll, locations, schedules, onClose, showAlert }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const initialTab = (searchParams.get("tab") as "realtime_bulk" | "reservation" | "routine") || "reservation";
  const [activeTab, setActiveTab] = useState<"realtime_bulk" | "reservation" | "routine">(initialTab);

  const handleTabChange = (tab: "realtime_bulk" | "reservation" | "routine") => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [targetUserIds, setTargetUserIds] = useState<string[]>([currentUser.id]);
  const [userSearch, setUserSearch] = useState("");
  const [showMobileUserList, setShowMobileUserList] = useState(false); // スマホ用アコーディオン

  // リアルタイム
  const [bulkState, setBulkState] = useState<PresenceState>("available");
  const [bulkLocationId, setBulkLocationId] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkStateOpen, setBulkStateOpen] = useState(false);
  const [bulkLocOpen, setBulkLocOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  // カレンダー関連
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 予定フォーム
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null); 
  const [newStartTime, setNewStartTime] = useState("10:00");
  const [newEndTime, setNewEndTime] = useState("12:00");
  const [newState, setNewState] = useState<PresenceState>("available");
  const [newLocationId, setNewLocationId] = useState("");
  const [newNote, setNewNote] = useState("");
  const [resStateOpen, setResStateOpen] = useState(false);
  const [resLocOpen, setResLocOpen] = useState(false);

  const [routines, setRoutines] = useState<WeeklyDayRoutine[]>([
    { userId: currentUser.id, dayOfWeek: 0, slots: [] },
    { userId: currentUser.id, dayOfWeek: 1, slots: [] },
    { userId: currentUser.id, dayOfWeek: 2, slots: [] },
    { userId: currentUser.id, dayOfWeek: 3, slots: [] },
    { userId: currentUser.id, dayOfWeek: 4, slots: [] },
    { userId: currentUser.id, dayOfWeek: 5, slots: [] },
    { userId: currentUser.id, dayOfWeek: 6, slots: [] },
  ]);

  const [slotPicker, setSlotPicker] = useState<{ dayNum: number; slotId: string; type: 'state' | 'location' } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const qR = query(collection(db, "presence_weekly_templates"), where("userId", "==", currentUser.id));
        const snapR = await getDocs(qR);
        if (!snapR.empty) {
          const loadedRoutines: WeeklyDayRoutine[] = [];
          snapR.forEach((d) => loadedRoutines.push(d.data() as WeeklyDayRoutine));
          setRoutines(prev => prev.map(p => {
            const found = loadedRoutines.find(r => r.dayOfWeek === p.dayOfWeek);
            return found || p;
          }));
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, [currentUser.id]);

  const handleSaveBulkRealtime = async () => {
    if (targetUserIds.length === 0) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const nowIso = new Date().toISOString();

      for (const uid of targetUserIds) {
        const targetU = tenantUsers.find(u => u.id === uid);
        const ref = doc(db, "presence_statuses", uid);
        const payload: any = {
          userId: uid,
          schoolId: currentUser.schoolId,
          userName: targetU?.name || "",
          userPhotoURL: targetU?.photoURL || null,
          positionName: targetU?.positionName || "",
          role: targetU?.role || "officer",
          currentState: bulkState,
          statusMessage: bulkMessage.trim(),
          locationId: bulkLocationId || null,
          lastActiveAt: nowIso,
          statusUpdatedAt: nowIso,
          isAutoOnline: false,
          isManualOverride: true, 
          updatedAt: serverTimestamp(),
        };

        if (uid !== currentUser.id) {
          payload.updatedByUserId = currentUser.id;
          payload.updatedByUserName = currentUser.name;
        }

        batch.set(ref, payload, { merge: true });
      }

      await batch.commit();
      showAlert("success", `${targetUserIds.length} 名のリアルタイムステータスを一括更新しました！`);
      onClose();
    } catch (e) {
      showAlert("error", "一括更新に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  // ★ 1つの予定に複数メンバー（targetUserIds）をまとめて紐づけて保存
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;
    setIsSaving(true);
    try {
      if (editingScheduleId) {
        await updateDoc(doc(db, "presence_schedules", editingScheduleId), {
          userIds: targetUserIds,
          startTime: newStartTime,
          endTime: newEndTime,
          state: newState,
          locationId: newLocationId || null,
          note: newNote.trim(),
        });
        showAlert("success", "予定を更新しました。");
      } else {
        const docRef = doc(collection(db, "presence_schedules"));
        await setDoc(docRef, {
          id: docRef.id,
          userIds: targetUserIds,
          schoolId: currentUser.schoolId,
          date: selectedDate,
          startTime: newStartTime,
          endTime: newEndTime,
          state: newState,
          locationId: newLocationId || null,
          note: newNote.trim(),
          createdAt: serverTimestamp(),
        });
        showAlert("success", "予定を登録しました。");
      }
      setNewNote("");
      setEditingScheduleId(null);
    } catch (e) {
      showAlert("error", "予定の保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await deleteDoc(doc(db, "presence_schedules", id));
      if (editingScheduleId === id) setEditingScheduleId(null);
      showAlert("success", "予定を削除しました。");
    } catch (e) {
      showAlert("error", "削除に失敗しました。");
    }
  };

  // ★ 予定から1名のメンバーを削除（最後なら予定ごと削除するか確認）
  const handleRemoveUserFromSchedule = async (sched: ScheduledPresence, userIdToRemove: string) => {
    const currentMemberIds = sched.userIds || (sched.userId ? [sched.userId] : []);
    const nextMemberIds = currentMemberIds.filter(id => id !== userIdToRemove);

    if (nextMemberIds.length === 0) {
      const confirmDelete = window.confirm("参加メンバーが居なくなります。この予定自体を完全に削除しますか？");
      if (confirmDelete) {
        handleDeleteSchedule(sched.id);
      }
    } else {
      try {
        await updateDoc(doc(db, "presence_schedules", sched.id), {
          userIds: nextMemberIds
        });
        showAlert("success", "メンバーを削除しました。");
      } catch (e) {
        showAlert("error", "更新に失敗しました。");
      }
    }
  };

  const handleAddSlot = (dayNum: number) => {
    setRoutines((prev) => {
      const next = [...prev];
      let dayR = next.find((r) => r.dayOfWeek === dayNum);
      if (!dayR) {
        dayR = { userId: currentUser.id, dayOfWeek: dayNum, slots: [] };
        next.push(dayR);
      }
      dayR.slots.push({
        id: `slot_${Date.now()}_${Math.random()}`,
        startTime: "15:00",
        endTime: "18:00",
        state: "available",
        locationId: "",
        note: "",
      });
      return next;
    });
  };

  const handleRemoveSlot = (dayNum: number, slotId: string) => {
    setRoutines((prev) => {
      const next = [...prev];
      const dayR = next.find((r) => r.dayOfWeek === dayNum);
      if (dayR) {
        dayR.slots = dayR.slots.filter((s) => s.id !== slotId);
      }
      return next;
    });
  };

  const handleSlotChange = (dayNum: number, slotId: string, field: keyof TimeSlotRoutine, val: any) => {
    setRoutines((prev) => {
      const next = [...prev];
      const dayR = next.find((r) => r.dayOfWeek === dayNum);
      if (dayR) {
        const slot = dayR.slots.find((s) => s.id === slotId);
        if (slot) {
          (slot as any)[field] = val;
        }
      }
      return next;
    });
  };

  const handleSaveRoutines = async () => {
    if (targetUserIds.length === 0) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      for (const uid of targetUserIds) {
        for (const r of routines) {
          const docId = `${uid}_day_${r.dayOfWeek}`;
          const ref = doc(db, "presence_weekly_templates", docId);
          batch.set(ref, {
            userId: uid, schoolId: currentUser.schoolId, dayOfWeek: r.dayOfWeek,
            slots: r.slots, updatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
      showAlert("success", "1週間のタイムスロットパターンを保存しました！");
    } catch (e) {
      showAlert("error", "保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const visibleLocations = locations.filter(l => !l.isHidden);

  const filteredUsers = useMemo(() => {
    return tenantUsers
      .filter(u => u.name.includes(userSearch) || ((u as any).systemId || "").includes(userSearch))
      .sort((a, b) => {
        const idA = (a as any).systemId || "999999";
        const idB = (b as any).systemId || "999999";
        return idA.localeCompare(idB, undefined, { numeric: true });
      });
  }, [tenantUsers, userSearch]);

  const bulkStateConf = PRESENCE_CONFIG[bulkState];
  const bulkLocName = locations.find(l => l.id === bulkLocationId)?.name;
  const resStateConf = PRESENCE_CONFIG[newState];
  const resLocName = locations.find(l => l.id === newLocationId)?.name;

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  // ★ カレンダー描画
  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 sm:h-24 bg-gray-50/50 border border-transparent"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const isSelected = selectedDate === dateStr;

      // この日付に該当する全スケジュール
      const daySchedules = schedules.filter(s => s.date === dateStr);

      days.push(
        <div 
          key={d} 
          onClick={() => {
            setSelectedDate(isSelected ? null : dateStr);
            setEditingScheduleId(null);
          }}
          className={`h-16 sm:h-24 border p-1 sm:p-2 flex flex-col cursor-pointer transition-all ${
            isSelected ? 'border-indigo-500 bg-indigo-50/80 shadow-md ring-2 ring-indigo-500/20 z-10' : 
            isToday ? 'border-amber-300 bg-amber-50/40' : 
            'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <span className={`text-[10px] sm:text-xs font-black w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-amber-500 text-white' : 'text-gray-700'}`}>
            {d}
          </span>

          <div className="flex-1 mt-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
            {daySchedules.map(s => {
              const uIds = s.userIds || (s.userId ? [s.userId] : []);
              const isEmpty = uIds.length === 0;
              const conf = PRESENCE_CONFIG[s.state];

              return (
                <div 
                  key={s.id} 
                  className={`text-[8px] sm:text-[10px] font-bold p-0.5 sm:p-1 rounded border truncate flex items-center justify-between ${
                    isEmpty ? 'bg-gray-100 text-gray-400 border-dashed border-gray-300' : 'bg-indigo-50 text-indigo-900 border-indigo-200'
                  }`}
                >
                  <span className="truncate">{s.startTime} {conf.label}</span>
                  <span className={`px-1 rounded text-[8px] shrink-0 font-black ${isEmpty ? 'bg-gray-200 text-gray-500' : 'bg-indigo-200 text-indigo-800'}`}>
                    {isEmpty ? '0名' : `${uIds.length}名`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-200 text-[10px] sm:text-xs font-black text-gray-600 text-center divide-x divide-gray-200">
          {DAYS_OF_WEEK.map(day => <div key={day} className="py-2.5">{day.slice(0, 1)}</div>)}
        </div>
        <div className="grid grid-cols-7 bg-gray-200 gap-px">
          {days}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fade-in print:hidden">
      {/* ★ 幅を max-w-6xl に拡大 */}
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-6xl h-[95vh] sm:h-[88vh] flex flex-col overflow-hidden border border-gray-200 animate-slide-up sm:animate-fade-in">
        
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
          <div>
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600" /> カレンダー予約・一括動静設定
            </h3>
            <p className="text-[10px] font-bold text-gray-500 mt-0.5">時間指定の動静予約や、複数メンバーへの一括適用が可能です</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex border-b border-gray-100 bg-white shrink-0 px-2 sm:px-5 pt-2 overflow-x-auto custom-scrollbar">
          {canManageAll && (
            <button onClick={() => handleTabChange("realtime_bulk")} className={`pb-2.5 px-4 text-[11px] sm:text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${activeTab === "realtime_bulk" ? "border-amber-500 text-amber-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
              <Zap className="w-3.5 h-3.5" /> リアルタイム一括更新
            </button>
          )}
          <button onClick={() => handleTabChange("routine")} className={`pb-2.5 px-4 text-[11px] sm:text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${activeTab === "routine" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            <RotateCcw className="w-3.5 h-3.5" /> 1週間の時間帯パターン
          </button>
          <button onClick={() => handleTabChange("reservation")} className={`pb-2.5 px-4 text-[11px] sm:text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${activeTab === "reservation" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            <Calendar className="w-3.5 h-3.5" /> カレンダーで予約
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full min-h-0">
          
          {/* 左：対象メンバー選択（スマホでは折りたたみ可能） */}
          {canManageAll && (
            <div className={`w-full md:w-[240px] border-r border-gray-200 bg-[#f8fafc] flex flex-col shrink-0 ${activeTab !== 'reservation' ? 'min-h-[160px] md:min-h-0' : 'min-h-0'}`}>
              <div 
                onClick={() => setShowMobileUserList(!showMobileUserList)}
                className="p-3 border-b border-gray-200 flex items-center justify-between bg-white cursor-pointer md:cursor-default"
              >
                <span className="text-[11px] font-black text-gray-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600"/> 対象メンバー ({targetUserIds.length})
                </span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={(e) => { e.stopPropagation(); setTargetUserIds(targetUserIds.length === tenantUsers.length ? [currentUser.id] : tenantUsers.map(u=>u.id)); }} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 transition-colors">
                    {targetUserIds.length === tenantUsers.length ? "解除" : "全選択"}
                  </button>
                  <ChevronDown className={`w-4 h-4 text-gray-400 md:hidden transition-transform ${showMobileUserList ? 'rotate-180' : ''}`} />
                </div>
              </div>

              <div className={`p-2 border-b border-gray-200 bg-white ${showMobileUserList ? 'block' : 'hidden md:block'}`}>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="名前・番号で検索" value={userSearch} onChange={e=>setUserSearch(e.target.value)} className="w-full pl-8 pr-2 py-1.5 text-[16px] sm:text-xs font-bold border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-gray-50 focus:bg-white" />
                </div>
              </div>

              <div className={`flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 max-h-40 md:max-h-none ${showMobileUserList ? 'block' : 'hidden md:block'}`}>
                {filteredUsers.map(u => (
                  <label key={u.id} className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors shadow-2xs border ${targetUserIds.includes(u.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <input type="checkbox" checked={targetUserIds.includes(u.id)} onChange={e => setTargetUserIds(prev => e.target.checked ? [...prev, u.id] : prev.filter(id=>id!==u.id))} className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 shrink-0 cursor-pointer" />
                      <div className="min-w-0">
                        <span className="text-xs font-black text-gray-900 truncate block">{u.name}</span>
                        <span className="text-[9px] font-mono text-gray-500 font-bold block truncate">ID: {(u as any).systemId || '未設定'}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 右：メインコンテンツ */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 bg-white w-full min-h-0">
            
            {/* リアルタイム一括更新 */}
            {activeTab === "realtime_bulk" && canManageAll && (
              <div className="space-y-4 max-w-lg mx-auto">
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 shadow-2xs">
                  <span className="text-sm font-black flex items-center gap-1.5 mb-1"><Zap className="w-4 h-4 text-amber-600" /> リアルタイム即時一括更新</span>
                  <p className="text-[11px] font-bold text-amber-800 leading-relaxed">左側で選択した {targetUserIds.length} 名のステータスを今すぐ強制的に書き換えます。</p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="relative">
                    <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase">一括設定するステータス</label>
                    <button type="button" onClick={() => setBulkStateOpen(!bulkStateOpen)} className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors">
                      <span className={`flex items-center gap-2 ${bulkStateConf.colorClass}`}>
                        <bulkStateConf.icon className={`w-4 h-4 ${bulkStateConf.fillClass}`} />
                        {bulkStateConf.label}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                    {bulkStateOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1">
                        {(Object.keys(PRESENCE_CONFIG) as PresenceState[]).map(st => {
                          const conf = PRESENCE_CONFIG[st];
                          return (
                            <button key={st} type="button" onClick={() => { setBulkState(st); setBulkStateOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold hover:bg-gray-50 text-left transition-colors">
                              <conf.icon className={`w-4 h-4 ${conf.fillClass}`} />
                              <span className={conf.colorClass}>{conf.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase">一括設定する勤務先</label>
                    <button type="button" onClick={() => setBulkLocOpen(!bulkLocOpen)} className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors">
                      <span className="flex items-center gap-2 text-gray-800">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {bulkLocName || "設定なし"}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                    {bulkLocOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto custom-scrollbar bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1">
                        <button type="button" onClick={() => { setBulkLocationId(""); setBulkLocOpen(false); }} className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 text-gray-600 transition-colors">設定なし</button>
                        {visibleLocations.map(l => (
                          <button key={l.id} type="button" onClick={() => { setBulkLocationId(l.id); setBulkLocOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold hover:bg-gray-50 text-left text-gray-800 transition-colors">
                            <MapPin className="w-4 h-4 text-gray-400" /> {l.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase">一括ステータスメッセージ</label>
                    <div className="relative">
                      <MessageSquareText className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" value={bulkMessage} onChange={e => setBulkMessage(e.target.value)} placeholder="例: 会議室で打合せ中" className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[16px] sm:text-xs font-bold text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all" />
                    </div>
                  </div>

                  <button onClick={handleSaveBulkRealtime} disabled={isSaving || targetUserIds.length===0} className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-black shadow-md transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:hover:bg-amber-500 hover:-translate-y-0.5">
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Zap className="w-5 h-5" />} 選択した {targetUserIds.length} 名の動静を今すぐ一括更新
                  </button>
                </div>
              </div>
            )}

            {/* 1週間の時間帯パターン */}
            {activeTab === "routine" && (
              <div className="space-y-6 max-w-3xl mx-auto">
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 shadow-2xs">
                  <h4 className="text-xs font-black text-indigo-900 flex items-center gap-1.5 mb-1"><RotateCcw className="w-4 h-4 text-indigo-600"/> 1週間の時間帯パターン設定</h4>
                  <p className="text-[10px] font-bold text-indigo-800 leading-relaxed">
                    曜日ごとに特定の時間帯（例: 10:00〜12:00 / 会議室）を設定できます。指定した時間になるとシステムが自動でステータスを適用します。
                  </p>
                </div>

                <div className="space-y-4">
                  {[0, 1, 2, 3, 4, 5, 6].map((dayNum) => {
                    const dayR = routines.find((r) => r.dayOfWeek === dayNum) || { userId: currentUser.id, dayOfWeek: dayNum, slots: [] };
                    const isWeekend = dayNum === 0 || dayNum === 6;

                    return (
                      <div key={dayNum} className={`p-4 rounded-2xl border shadow-sm ${isWeekend ? 'bg-red-50/20 border-red-200' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-sm font-black ${isWeekend ? 'text-red-600' : 'text-gray-900'}`}>{DAYS_OF_WEEK[dayNum]}</span>
                          <button type="button" onClick={() => handleAddSlot(dayNum)} className="px-3 py-1.5 bg-white border border-gray-200 hover:border-indigo-400 hover:text-indigo-600 text-gray-600 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" /> 時間帯を追加
                          </button>
                        </div>

                        {dayR.slots.length === 0 ? (
                          <p className="text-[11px] font-bold text-gray-400 py-1 pl-1">指定なし</p>
                        ) : (
                          <div className="space-y-2.5">
                            {dayR.slots.map((slot) => {
                              const sConf = PRESENCE_CONFIG[slot.state];
                              const sLocName = locations.find(l => l.id === slot.locationId)?.name || "勤務先未定";
                              const isThisSlotPicker = slotPicker?.dayNum === dayNum && slotPicker?.slotId === slot.id;

                              return (
                                <div key={slot.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 shadow-2xs flex flex-col xl:flex-row items-stretch xl:items-center gap-2.5 relative">
                                  <div className="flex items-center gap-1.5 shrink-0 bg-white p-1 rounded-lg border border-gray-200">
                                    <input type="time" value={slot.startTime} onChange={e => handleSlotChange(dayNum, slot.id, 'startTime', e.target.value)} className="bg-transparent px-1 py-0.5 text-[16px] sm:text-xs font-black text-gray-800 outline-none" />
                                    <span className="text-[10px] font-bold text-gray-400">〜</span>
                                    <input type="time" value={slot.endTime} onChange={e => handleSlotChange(dayNum, slot.id, 'endTime', e.target.value)} className="bg-transparent px-1 py-0.5 text-[16px] sm:text-xs font-black text-gray-800 outline-none" />
                                  </div>

                                  <div className="flex gap-2 flex-1 relative">
                                    <button type="button" onClick={() => setSlotPicker(isThisSlotPicker && slotPicker?.type === 'state' ? null : { dayNum, slotId: slot.id, type: 'state' })} className="flex-1 bg-white border border-gray-200 hover:border-indigo-300 rounded-lg px-3 py-2 text-xs font-bold text-left flex items-center justify-between transition-colors shadow-2xs">
                                      <span className={`flex items-center gap-1.5 ${sConf.colorClass}`}><sConf.icon className="w-4 h-4" />{sConf.label}</span>
                                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                    </button>

                                    <button type="button" onClick={() => setSlotPicker(isThisSlotPicker && slotPicker?.type === 'location' ? null : { dayNum, slotId: slot.id, type: 'location' })} className="flex-1 bg-white border border-gray-200 hover:border-indigo-300 rounded-lg px-3 py-2 text-xs font-bold text-left flex items-center justify-between transition-colors shadow-2xs">
                                      <span className="truncate text-gray-800">{sLocName}</span>
                                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                    </button>
                                  </div>

                                  <button type="button" onClick={() => handleRemoveSlot(dayNum, slot.id)} className="p-2 bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-lg shrink-0 transition-colors shadow-2xs">
                                    <Trash2 className="w-4 h-4" />
                                  </button>

                                  {isThisSlotPicker && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 p-2 space-y-1 animate-fade-in">
                                      {slotPicker.type === 'state' ? (
                                        (Object.keys(PRESENCE_CONFIG) as PresenceState[]).map(st => {
                                          const conf = PRESENCE_CONFIG[st];
                                          return (
                                            <button key={st} type="button" onClick={() => { handleSlotChange(dayNum, slot.id, 'state', st); setSlotPicker(null); }} className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg text-xs font-bold text-left transition-colors">
                                              <conf.icon className={`w-4 h-4 ${conf.fillClass}`} />
                                              <span className={conf.colorClass}>{conf.label}</span>
                                            </button>
                                          );
                                        })
                                      ) : (
                                        <>
                                          <button type="button" onClick={() => { handleSlotChange(dayNum, slot.id, 'locationId', ""); setSlotPicker(null); }} className="w-full text-left p-2 hover:bg-gray-50 rounded-lg text-xs font-bold text-gray-700 transition-colors">勤務先未定</button>
                                          {visibleLocations.map(l => (
                                            <button key={l.id} type="button" onClick={() => { handleSlotChange(dayNum, slot.id, 'locationId', l.id); setSlotPicker(null); }} className="w-full text-left p-2 hover:bg-gray-50 rounded-lg text-xs font-bold text-gray-800 transition-colors">
                                              {l.name}
                                            </button>
                                          ))}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="pt-6 border-t border-gray-100 flex justify-end pb-12 sm:pb-0">
                  <button type="button" onClick={handleSaveRoutines} disabled={isSaving || targetUserIds.length===0} className="w-full sm:w-auto px-8 py-3.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 hover:-translate-y-0.5">
                    <Save className="w-4 h-4" /> パターンを保存
                  </button>
                </div>
              </div>
            )}

            {/* カレンダー予約メイン機能 */}
            {activeTab === "reservation" && (
              <div className="flex flex-col xl:flex-row gap-6 h-full pb-12 sm:pb-0">
                
                {/* カレンダー本体 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-indigo-500" /> カレンダー予約
                    </h4>
                    <div className="flex items-center gap-2">
                      <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
                      <span className="text-sm font-black w-24 text-center">{currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月</span>
                      <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
                    </div>
                  </div>

                  {renderCalendar()}
                </div>

                {/* 右側：指定日の予定リスト ＆ 作成フォーム */}
                {selectedDate && (
                  <div className="w-full xl:w-[340px] shrink-0 flex flex-col gap-4 animate-slide-up sm:animate-fade-in">
                    <div className="bg-indigo-50/50 border border-indigo-200 rounded-2xl p-4 shadow-sm">
                      <h5 className="text-sm font-black text-indigo-900 mb-3 border-b border-indigo-100 pb-2 flex justify-between items-center">
                        <span>{selectedDate.replace(/-/g, '/')} の予定</span>
                        <button onClick={() => setSelectedDate(null)} className="text-indigo-400 hover:text-indigo-600"><X className="w-4 h-4"/></button>
                      </h5>
                      
                      {/* この日の全予定一覧 */}
                      <div className="space-y-2 mb-4 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                        {schedules.filter(s => s.date === selectedDate).length === 0 ? (
                          <p className="text-[10px] font-bold text-gray-400 text-center py-4 bg-white/60 rounded-xl border border-dashed border-gray-200">この日の予定はありません</p>
                        ) : (
                          schedules.filter(s => s.date === selectedDate).map(s => {
                            const conf = PRESENCE_CONFIG[s.state];
                            const uIds = s.userIds || (s.userId ? [s.userId] : []);
                            const isEmpty = uIds.length === 0;

                            return (
                              <div 
                                key={s.id} 
                                onClick={() => {
                                  setEditingScheduleId(s.id);
                                  setNewStartTime(s.startTime); setNewEndTime(s.endTime);
                                  setNewState(s.state); setNewLocationId(s.locationId || ""); setNewNote(s.note || "");
                                  if (uIds.length > 0) setTargetUserIds(uIds);
                                }} 
                                className={`p-3 bg-white rounded-xl border cursor-pointer hover:border-indigo-400 transition-all shadow-2xs space-y-2 ${
                                  editingScheduleId === s.id ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md' : 'border-gray-200'
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-1.5">
                                    <conf.icon className={`w-4 h-4 ${conf.colorClass}`} />
                                    <span className="text-xs font-black text-gray-900">{s.startTime} 〜 {s.endTime}</span>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(s.id); }} className="text-gray-300 hover:text-red-500 p-0.5" title="予定自体を削除"><Trash2 className="w-3.5 h-3.5"/></button>
                                </div>

                                <div className="text-[10px] font-bold text-gray-600 flex items-center justify-between bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                                  <span className={conf.colorClass}>{conf.label}</span>
                                  {s.note && (
                                    <span className="truncate max-w-[120px] text-gray-500 flex items-center gap-1">
                                      <MessageSquareText className="w-3 h-3 text-gray-400" /> {s.note}
                                    </span>
                                  )}
                                </div>

                                {/* ★ 参加メンバーバッジリスト */}
                                <div className="pt-1 flex flex-wrap gap-1">
                                  {isEmpty ? (
                                    <span className="text-[9px] font-bold text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                      <AlertTriangle className="w-2.5 h-2.5"/> メンバー未登録
                                    </span>
                                  ) : (
                                    uIds.map(uid => {
                                      const u = tenantUsers.find(tu => tu.id === uid);
                                      return (
                                        <span key={uid} className="inline-flex items-center gap-1 text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">
                                          {u?.name || "メンバー"}
                                          <button 
                                            type="button" 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemoveUserFromSchedule(s, uid);
                                            }}
                                            className="hover:text-red-600 text-indigo-400"
                                            title="このメンバーを外す"
                                          >
                                            <X className="w-2.5 h-2.5" />
                                          </button>
                                        </span>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>

                      {/* 予定の新規追加 / 編集フォーム */}
                      <form onSubmit={handleSaveSchedule} className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-sm space-y-3 relative">
                        {editingScheduleId && (
                          <div className="flex justify-between items-center bg-indigo-100/50 p-1.5 rounded-lg border border-indigo-200">
                            <span className="text-[10px] font-black text-indigo-900">予定の編集モード中</span>
                            <button type="button" onClick={() => { setEditingScheduleId(null); setNewNote(""); }} className="text-[10px] text-indigo-600 font-bold hover:underline">新規作成に戻る</button>
                          </div>
                        )}
                        
                        <div className="flex gap-1.5 items-center bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                          <input type="time" required value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} className="bg-transparent px-1 py-1 text-[16px] sm:text-xs font-bold outline-none w-full" />
                          <span className="text-[10px] text-gray-400 font-bold">〜</span>
                          <input type="time" required value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} className="bg-transparent px-1 py-1 text-[16px] sm:text-xs font-bold outline-none w-full" />
                        </div>

                        <div className="relative">
                          <button type="button" onClick={() => setResStateOpen(!resStateOpen)} className="w-full flex items-center justify-between px-2.5 py-1.5 bg-gray-50 border border-gray-200 hover:bg-white focus:bg-white rounded-lg text-xs font-bold shadow-2xs transition-colors">
                            <span className={`flex items-center gap-1.5 ${resStateConf.colorClass}`}><resStateConf.icon className="w-3.5 h-3.5" />{resStateConf.label}</span>
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                          {resStateOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1">
                              {(Object.keys(PRESENCE_CONFIG) as PresenceState[]).map(st => {
                                const conf = PRESENCE_CONFIG[st];
                                return (
                                  <button key={st} type="button" onClick={() => { setNewState(st); setResStateOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-gray-50 text-left transition-colors">
                                    <conf.icon className={`w-3.5 h-3.5 ${conf.fillClass}`} />
                                    <span className={conf.colorClass}>{conf.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="relative">
                          <button type="button" onClick={() => setResLocOpen(!resLocOpen)} className="w-full flex items-center justify-between px-2.5 py-1.5 bg-gray-50 border border-gray-200 hover:bg-white focus:bg-white rounded-lg text-xs font-bold shadow-2xs transition-colors">
                            <span className="text-gray-800 truncate">{resLocName || "勤務先 未設定"}</span>
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          </button>
                          {resLocOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto custom-scrollbar bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1">
                              <button type="button" onClick={() => { setNewLocationId(""); setResLocOpen(false); }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-50 transition-colors">未設定</button>
                              {visibleLocations.map(l => (
                                <button key={l.id} type="button" onClick={() => { setNewLocationId(l.id); setResLocOpen(false); }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-50 transition-colors truncate">{l.name}</button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="relative">
                          <MessageSquareText className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <input type="text" placeholder="メモ (任意)" value={newNote} onChange={(e) => setNewNote(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-2.5 py-1.5 text-[16px] sm:text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs" />
                        </div>

                        <button type="submit" disabled={isSaving || targetUserIds.length===0} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-black hover:bg-indigo-700 shadow-md flex items-center justify-center transition-all disabled:opacity-50">
                          {editingScheduleId ? "選択中のメンバーで更新" : `選択中（${targetUserIds.length}名）で新規登録`}
                        </button>
                      </form>

                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}