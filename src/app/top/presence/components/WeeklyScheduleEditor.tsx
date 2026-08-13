"use client";

import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PRESENCE_CONFIG, PresenceState, WeeklyDayRoutine, ScheduledPresence, PresenceLocation, TimeSlotRoutine } from "../types";
import { UserData } from "../../page";
import { RotateCcw, X, Save, Trash2, CheckCircle2, Loader2, MapPin, Search, Plus, Calendar, Zap, ChevronDown, Check } from "lucide-react";

type Props = {
  currentUser: UserData;
  tenantUsers: UserData[];
  canManageAll: boolean;
  locations: PresenceLocation[];
  onClose: () => void;
  showAlert: (type: "success" | "error", message: string) => void;
};

const DAYS_OF_WEEK = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];

export default function WeeklyScheduleEditor({ currentUser, tenantUsers, canManageAll, locations, onClose, showAlert }: Props) {
  const [activeTab, setActiveTab] = useState<"realtime_bulk" | "routine" | "reservation">("routine");
  const [targetUserIds, setTargetUserIds] = useState<string[]>([currentUser.id]);
  const [userSearch, setUserSearch] = useState("");
  
  // リアルタイム一括変更用
  const [bulkState, setBulkState] = useState<PresenceState>("available");
  const [bulkLocationId, setBulkLocationId] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");

  // 1週間の複数時間帯スロット用
  const [routines, setRoutines] = useState<WeeklyDayRoutine[]>([
    { dayOfWeek: 0, slots: [] },
    { dayOfWeek: 1, slots: [] },
    { dayOfWeek: 2, slots: [] },
    { dayOfWeek: 3, slots: [] },
    { dayOfWeek: 4, slots: [] },
    { dayOfWeek: 5, slots: [] },
    { dayOfWeek: 6, slots: [] },
  ]);

  const [scheduledList, setScheduledList] = useState<ScheduledPresence[]>([]);
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("10:00");
  const [newEndTime, setNewEndTime] = useState("12:00");
  const [newState, setNewState] = useState<PresenceState>("available");
  const [newLocationId, setNewLocationId] = useState("");
  const [newNote, setNewNote] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  // ★ インラインプルダウンの開閉管理ステート
  const [bulkStateOpen, setBulkStateOpen] = useState(false);
  const [bulkLocOpen, setBulkLocOpen] = useState(false);

  const [resStateOpen, setResStateOpen] = useState(false);
  const [resLocOpen, setResLocOpen] = useState(false);

  const [slotPicker, setSlotPicker] = useState<{ dayNum: number; slotId: string; type: 'state' | 'location' } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const qR = query(collection(db, "presence_weekly_templates"), where("userId", "==", currentUser.id));
        const snapR = await getDocs(qR);
        if (!snapR.empty) {
          const loadedRoutines: WeeklyDayRoutine[] = [];
          snapR.forEach((d) => loadedRoutines.push(d.data() as WeeklyDayRoutine));
          setRoutines(loadedRoutines);
        }

        const qS = query(collection(db, "presence_schedules"), where("userId", "==", currentUser.id));
        const snapS = await getDocs(qS);
        const loadedSchedules: ScheduledPresence[] = [];
        snapS.forEach((d) => loadedSchedules.push({ id: d.id, ...d.data() } as ScheduledPresence));
        setScheduledList(loadedSchedules);

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

  const handleAddSlot = (dayNum: number) => {
    setRoutines((prev) => {
      const next = [...prev];
      let dayR = next.find((r) => r.dayOfWeek === dayNum);
      if (!dayR) {
        dayR = { dayOfWeek: dayNum, slots: [] };
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

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || targetUserIds.length === 0) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const newSchedules: ScheduledPresence[] = [];
      
      for (const uid of targetUserIds) {
        const docRef = doc(collection(db, "presence_schedules"));
        const sched = {
          id: docRef.id, userId: uid, schoolId: currentUser.schoolId,
          date: newDate, startTime: newStartTime, endTime: newEndTime,
          state: newState, locationId: newLocationId || null, note: newNote.trim(), createdAt: serverTimestamp(),
        };
        batch.set(docRef, sched);
        if (uid === currentUser.id) newSchedules.push(sched as any);
      }
      await batch.commit();
      
      setScheduledList(prev => [...prev, ...newSchedules]);
      setNewDate(""); setNewNote("");
      showAlert("success", "特定日時の動静予約を一括登録しました。");
    } catch (e) {
      showAlert("error", "予約の登録に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await deleteDoc(doc(db, "presence_schedules", id));
      setScheduledList(prev => prev.filter(s => s.id !== id));
      showAlert("success", "予定を削除しました。");
    } catch (e) {
      showAlert("error", "削除に失敗しました。");
    }
  };

  const visibleLocations = locations.filter(l => !l.isHidden);
  const filteredUsers = tenantUsers.filter(u => u.name.includes(userSearch) || ((u as any).systemId || "").includes(userSearch));

  const bulkStateConf = PRESENCE_CONFIG[bulkState];
  const bulkLocName = locations.find(l => l.id === bulkLocationId)?.name;
  const resStateConf = PRESENCE_CONFIG[newState];
  const resLocName = locations.find(l => l.id === newLocationId)?.name;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-fade-in print:hidden">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-slide-up sm:animate-fade-in">
        
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
          <div>
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-indigo-600" /> スケジュール・一括動静設定
            </h3>
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 mt-0.5">時間帯ごとのルーティン登録や、複数メンバーへの一括適用が可能です</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex border-b border-gray-100 bg-white shrink-0 px-2 sm:px-4 pt-2 overflow-x-auto custom-scrollbar">
          {canManageAll && (
            <button onClick={() => setActiveTab("realtime_bulk")} className={`px-4 py-2.5 text-[11px] sm:text-xs font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === "realtime_bulk" ? "border-indigo-600 text-indigo-600 bg-indigo-50/30" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
              ⚡ 今すぐリアルタイム一括更新
            </button>
          )}
          <button onClick={() => setActiveTab("routine")} className={`px-4 py-2.5 text-[11px] sm:text-xs font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === "routine" ? "border-indigo-600 text-indigo-600 bg-indigo-50/30" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            1週間の時間帯パターン
          </button>
          <button onClick={() => setActiveTab("reservation")} className={`px-4 py-2.5 text-[11px] sm:text-xs font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === "reservation" ? "border-indigo-600 text-indigo-600 bg-indigo-50/30" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            特定日時の動静予約
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full min-h-0">
          
          {/* 左：一括対象メンバー選択（権限者のみ） */}
          {canManageAll && (
            <div className="w-full md:w-64 border-r border-gray-100 bg-gray-50/40 flex flex-col shrink-0 min-h-[140px] md:min-h-0">
              <div className="p-2.5 sm:p-3 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
                <span className="text-[10px] font-black text-gray-700">対象メンバー ({targetUserIds.length}名)</span>
                <button type="button" onClick={() => setTargetUserIds(targetUserIds.length === tenantUsers.length ? [currentUser.id] : tenantUsers.map(u=>u.id))} className="text-[9px] font-bold text-indigo-600 hover:underline">
                  {targetUserIds.length === tenantUsers.length ? "解除" : "全選択"}
                </button>
              </div>
              <div className="p-2 border-b border-gray-100 bg-white">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="名前・番号で検索..." value={userSearch} onChange={e=>setUserSearch(e.target.value)} className="w-full pl-8 pr-2 py-1.5 text-[16px] sm:text-xs font-bold border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {filteredUsers.map(u => (
                  <label key={u.id} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${targetUserIds.includes(u.id) ? 'bg-indigo-50/80 border border-indigo-200' : 'hover:bg-gray-100 border border-transparent'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <input type="checkbox" checked={targetUserIds.includes(u.id)} onChange={e => setTargetUserIds(prev => e.target.checked ? [...prev, u.id] : prev.filter(id=>id!==u.id))} className="w-3.5 h-3.5 text-indigo-600 rounded shrink-0" />
                      <span className="text-[11px] font-bold text-gray-800 truncate">{u.name}</span>
                    </div>
                    <span className="text-[8px] font-mono text-gray-400 font-bold shrink-0">#{(u as any).systemId || ''}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 右：設定コンテンツ */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-white w-full min-h-0">
            
            {/* リアルタイム一括更新 */}
            {activeTab === "realtime_bulk" && canManageAll && (
              <div className="space-y-4">
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 space-y-1">
                  <span className="text-xs font-black flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-600" /> リアルタイム即時一括更新</span>
                  <p className="text-[10px] font-bold text-amber-800 leading-relaxed">選択した {targetUserIds.length} 名のステータスを今すぐ書き換えます。</p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="relative">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">一括設定するステータス</label>
                    <button type="button" onClick={() => setBulkStateOpen(!bulkStateOpen)} className="w-full flex items-center justify-between px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold">
                      <span className={`flex items-center gap-2 ${bulkStateConf.colorClass}`}>
                        <bulkStateConf.icon className={`w-4 h-4 ${bulkStateConf.fillClass}`} />
                        {bulkStateConf.label}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    {bulkStateOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1">
                        {(Object.keys(PRESENCE_CONFIG) as PresenceState[]).map(st => {
                          const conf = PRESENCE_CONFIG[st];
                          return (
                            <button key={st} type="button" onClick={() => { setBulkState(st); setBulkStateOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold hover:bg-gray-50 text-left">
                              <conf.icon className={`w-4 h-4 ${conf.fillClass}`} />
                              <span className={conf.colorClass}>{conf.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">一括設定する勤務先</label>
                    <button type="button" onClick={() => setBulkLocOpen(!bulkLocOpen)} className="w-full flex items-center justify-between px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold">
                      <span className="flex items-center gap-2 text-gray-700">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {bulkLocName || "設定なし"}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    {bulkLocOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto custom-scrollbar bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1">
                        <button type="button" onClick={() => { setBulkLocationId(""); setBulkLocOpen(false); }} className="w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-gray-50">設定なし</button>
                        {visibleLocations.map(l => (
                          <button key={l.id} type="button" onClick={() => { setBulkLocationId(l.id); setBulkLocOpen(false); }} className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold hover:bg-gray-50 text-left">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" /> {l.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">一括ステータスメッセージ</label>
                    <input type="text" value={bulkMessage} onChange={e => setBulkMessage(e.target.value)} placeholder="例: 会議室で打合せ中" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold text-gray-900 outline-none" />
                  </div>

                  <button onClick={handleSaveBulkRealtime} disabled={isSaving || targetUserIds.length===0} className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2 mt-4">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4" />} 選択した {targetUserIds.length} 名の動静を今すぐ一括更新
                  </button>
                </div>
              </div>
            )}

            {/* 1週間の時間帯パターン */}
            {activeTab === "routine" && (
              <div className="space-y-5">
                <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed">
                  ※ 曜日ごとに「特定の時間帯（例: 10:00〜12:00 / 会議室）」を設定できます。
                </p>

                <div className="space-y-4">
                  {[0, 1, 2, 3, 4, 5, 6].map((dayNum) => {
                    const dayR = routines.find((r) => r.dayOfWeek === dayNum) || { dayOfWeek: dayNum, slots: [] };
                    const isWeekend = dayNum === 0 || dayNum === 6;

                    return (
                      <div key={dayNum} className={`p-3.5 rounded-2xl border ${isWeekend ? 'bg-red-50/20 border-red-100' : 'bg-gray-50/60 border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-black ${isWeekend ? 'text-red-600' : 'text-gray-900'}`}>{DAYS_OF_WEEK[dayNum]}</span>
                          <button type="button" onClick={() => handleAddSlot(dayNum)} className="px-2.5 py-1 bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1">
                            <Plus className="w-3 h-3" /> 時間帯を追加
                          </button>
                        </div>

                        {dayR.slots.length === 0 ? (
                          <p className="text-[10px] font-bold text-gray-400 py-1 pl-1">指定なし</p>
                        ) : (
                          <div className="space-y-2 mt-2">
                            {dayR.slots.map((slot) => {
                              const sConf = PRESENCE_CONFIG[slot.state];
                              const sLocName = locations.find(l => l.id === slot.locationId)?.name || "勤務先未定";
                              const isThisSlotPicker = slotPicker?.dayNum === dayNum && slotPicker?.slotId === slot.id;

                              return (
                                <div key={slot.id} className="p-2.5 bg-white rounded-xl border border-gray-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center gap-2 relative">
                                  <div className="flex items-center gap-1 shrink-0">
                                    <input type="time" value={slot.startTime} onChange={e => handleSlotChange(dayNum, slot.id, 'startTime', e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-1.5 py-1 text-[16px] sm:text-[11px] font-bold outline-none" />
                                    <span className="text-[10px] text-gray-400">〜</span>
                                    <input type="time" value={slot.endTime} onChange={e => handleSlotChange(dayNum, slot.id, 'endTime', e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-1.5 py-1 text-[16px] sm:text-[11px] font-bold outline-none" />
                                  </div>

                                  {/* スロット用ステータス変更ボタン */}
                                  <button type="button" onClick={() => setSlotPicker(isThisSlotPicker && slotPicker?.type === 'state' ? null : { dayNum, slotId: slot.id, type: 'state' })} className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-left flex items-center justify-between">
                                    <span className={`flex items-center gap-1.5 ${sConf.colorClass}`}><sConf.icon className="w-3.5 h-3.5" />{sConf.label}</span>
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                  </button>

                                  {/* スロット用勤務先変更ボタン */}
                                  <button type="button" onClick={() => setSlotPicker(isThisSlotPicker && slotPicker?.type === 'location' ? null : { dayNum, slotId: slot.id, type: 'location' })} className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-left flex items-center justify-between">
                                    <span className="truncate text-gray-700">{sLocName}</span>
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                  </button>

                                  <button type="button" onClick={() => handleRemoveSlot(dayNum, slot.id)} className="p-1 text-gray-400 hover:text-red-600 rounded-lg self-end sm:self-auto">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* インラインピッカーポップアップ */}
                                  {isThisSlotPicker && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 p-2 space-y-1 animate-fade-in">
                                      {slotPicker.type === 'state' ? (
                                        (Object.keys(PRESENCE_CONFIG) as PresenceState[]).map(st => {
                                          const conf = PRESENCE_CONFIG[st];
                                          return (
                                            <button key={st} type="button" onClick={() => { handleSlotChange(dayNum, slot.id, 'state', st); setSlotPicker(null); }} className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg text-xs font-bold text-left">
                                              <conf.icon className={`w-3.5 h-3.5 ${conf.fillClass}`} />
                                              <span className={conf.colorClass}>{conf.label}</span>
                                            </button>
                                          );
                                        })
                                      ) : (
                                        <>
                                          <button type="button" onClick={() => { handleSlotChange(dayNum, slot.id, 'locationId', ""); setSlotPicker(null); }} className="w-full text-left p-2 hover:bg-gray-50 rounded-lg text-xs font-bold text-gray-700">勤務先未定</button>
                                          {visibleLocations.map(l => (
                                            <button key={l.id} type="button" onClick={() => { handleSlotChange(dayNum, slot.id, 'locationId', l.id); setSlotPicker(null); }} className="w-full text-left p-2 hover:bg-gray-50 rounded-lg text-xs font-bold text-gray-700">
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

                <div className="pt-4 flex justify-end pb-8 sm:pb-0">
                  <button type="button" onClick={handleSaveRoutines} disabled={isSaving || targetUserIds.length===0} className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <Save className="w-4 h-4" /> パターンを保存
                  </button>
                </div>
              </div>
            )}

            {/* 特定日時の予約 */}
            {activeTab === "reservation" && (
              <div className="space-y-6">
                <form onSubmit={handleAddSchedule} className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                  <span className="text-[11px] font-black text-gray-700 block mb-2">＋ 特定日時の予約登録</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-gray-500 mb-1">日付</label>
                      <input type="date" required value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-gray-500 mb-1">時間 (開始 〜 終了)</label>
                      <div className="flex gap-1.5 items-center">
                        <input type="time" required value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-2 py-2 text-[16px] sm:text-xs font-bold outline-none w-full" />
                        <span className="text-[10px] text-gray-400">〜</span>
                        <input type="time" required value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-2 py-2 text-[16px] sm:text-xs font-bold outline-none w-full" />
                      </div>
                    </div>
                    <div className="relative">
                      <label className="block text-[9px] font-bold text-gray-500 mb-1">状態</label>
                      <button type="button" onClick={() => setResStateOpen(!resStateOpen)} className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold">
                        <span className={`flex items-center gap-2 ${resStateConf.colorClass}`}><resStateConf.icon className="w-4 h-4" />{resStateConf.label}</span>
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </button>
                      {resStateOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1">
                          {(Object.keys(PRESENCE_CONFIG) as PresenceState[]).map(st => {
                            const conf = PRESENCE_CONFIG[st];
                            return (
                              <button key={st} type="button" onClick={() => { setNewState(st); setResStateOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-gray-50 text-left">
                                <conf.icon className={`w-4 h-4 ${conf.fillClass}`} />
                                <span className={conf.colorClass}>{conf.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <label className="block text-[9px] font-bold text-gray-500 mb-1">勤務先 (任意)</label>
                      <button type="button" onClick={() => setResLocOpen(!resLocOpen)} className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold">
                        <span className="text-gray-700">{resLocName || "未設定"}</span>
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </button>
                      {resLocOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto custom-scrollbar bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1">
                          <button type="button" onClick={() => { setNewLocationId(""); setResLocOpen(false); }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-50">未設定</button>
                          {visibleLocations.map(l => (
                            <button key={l.id} type="button" onClick={() => { setNewLocationId(l.id); setResLocOpen(false); }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-50">{l.name}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 items-center pt-2">
                    <input type="text" placeholder="ステータスメッセージ" value={newNote} onChange={(e) => setNewNote(e.target.value)} className="w-full flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-[16px] sm:text-xs font-bold outline-none" />
                    <button type="submit" disabled={isSaving || targetUserIds.length===0} className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shrink-0 hover:bg-indigo-700 shadow-sm">
                      予約登録
                    </button>
                  </div>
                </form>

                <div className="space-y-3 pb-8 sm:pb-0">
                  <span className="text-[11px] font-black text-gray-700 block border-b border-gray-100 pb-1">予約済みスケジュール ({scheduledList.length}件)</span>
                  {scheduledList.length === 0 ? (
                    <p className="text-[10px] font-bold text-gray-400 text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">予約なし</p>
                  ) : (
                    scheduledList.map((s) => {
                      const conf = PRESENCE_CONFIG[s.state];
                      const locName = locations.find(l => l.id === s.locationId)?.name;
                      return (
                        <div key={s.id} className="p-3 bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <conf.icon className={`w-5 h-5 shrink-0 ${conf.colorClass}`} />
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] sm:text-xs font-black text-gray-900 truncate">{s.date} ({s.startTime}〜{s.endTime})</span>
                              <span className="text-[9px] font-bold text-gray-500 truncate">{conf.label} {locName && `・ ${locName}`}</span>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteSchedule(s.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}