"use client";

import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PRESENCE_CONFIG, PresenceState, WeeklyDayRoutine, ScheduledPresence, PresenceLocation, TimeSlotRoutine } from "../types";
import { UserData } from "../../page";
import { RotateCcw, X, Save, Trash2, CheckCircle2, Loader2, MapPin, Search, Plus, Calendar, Zap, ChevronDown, Check, Users } from "lucide-react";

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

  // インラインプルダウンの開閉管理ステート
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

  // ★ ユーザーを検索し、システム利用番号（systemId）順でソート
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

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fade-in print:hidden">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-slide-up sm:animate-fade-in">
        
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
          <div>
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-indigo-600" /> スケジュール・一括動静設定
            </h3>
            <p className="text-[10px] font-bold text-gray-500 mt-0.5">時間帯ごとのルーティン登録や、複数メンバーへの一括適用が可能です</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex border-b border-gray-100 bg-white shrink-0 px-2 sm:px-5 pt-2 overflow-x-auto custom-scrollbar">
          {canManageAll && (
            <button onClick={() => setActiveTab("realtime_bulk")} className={`pb-2.5 px-4 text-[11px] sm:text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${activeTab === "realtime_bulk" ? "border-amber-500 text-amber-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
              <Zap className="w-3.5 h-3.5" /> リアルタイム一括更新
            </button>
          )}
          <button onClick={() => setActiveTab("routine")} className={`pb-2.5 px-4 text-[11px] sm:text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${activeTab === "routine" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            <RotateCcw className="w-3.5 h-3.5" /> 1週間の時間帯パターン
          </button>
          <button onClick={() => setActiveTab("reservation")} className={`pb-2.5 px-4 text-[11px] sm:text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${activeTab === "reservation" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            <Calendar className="w-3.5 h-3.5" /> 特定日時の動静予約
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full min-h-0">
          
          {/* 左：一括対象メンバー選択（権限者のみ） */}
          {canManageAll && (
            <div className="w-full md:w-[280px] border-r border-gray-200 bg-[#f8fafc] flex flex-col shrink-0 min-h-[160px] md:min-h-0">
              <div className="p-3 border-b border-gray-200 flex flex-col gap-2 shrink-0 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-gray-800 flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-indigo-600"/> 対象メンバー ({targetUserIds.length}名)</span>
                  <button type="button" onClick={() => setTargetUserIds(targetUserIds.length === tenantUsers.length ? [currentUser.id] : tenantUsers.map(u=>u.id))} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 transition-colors">
                    {targetUserIds.length === tenantUsers.length ? "選択解除" : "全選択"}
                  </button>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="名前・システム番号で検索..." value={userSearch} onChange={e=>setUserSearch(e.target.value)} className="w-full pl-8 pr-2 py-1.5 text-[16px] sm:text-xs font-bold border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow bg-gray-50 focus:bg-white" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {filteredUsers.map(u => (
                  <label key={u.id} className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors shadow-2xs border ${targetUserIds.includes(u.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input type="checkbox" checked={targetUserIds.includes(u.id)} onChange={e => setTargetUserIds(prev => e.target.checked ? [...prev, u.id] : prev.filter(id=>id!==u.id))} className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 shrink-0 cursor-pointer" />
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

          {/* 右：設定コンテンツ */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-white w-full min-h-0">
            
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
                    <input type="text" value={bulkMessage} onChange={e => setBulkMessage(e.target.value)} placeholder="例: 会議室で打合せ中" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-[16px] sm:text-xs font-bold text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all" />
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
                    const dayR = routines.find((r) => r.dayOfWeek === dayNum) || { dayOfWeek: dayNum, slots: [] };
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
                                <div key={slot.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 relative">
                                  <div className="flex items-center gap-1.5 shrink-0 bg-white p-1 rounded-lg border border-gray-200">
                                    <input type="time" value={slot.startTime} onChange={e => handleSlotChange(dayNum, slot.id, 'startTime', e.target.value)} className="bg-transparent px-1 py-0.5 text-[16px] sm:text-xs font-black text-gray-800 outline-none" />
                                    <span className="text-[10px] font-bold text-gray-400">〜</span>
                                    <input type="time" value={slot.endTime} onChange={e => handleSlotChange(dayNum, slot.id, 'endTime', e.target.value)} className="bg-transparent px-1 py-0.5 text-[16px] sm:text-xs font-black text-gray-800 outline-none" />
                                  </div>

                                  <div className="flex gap-2 flex-1 relative">
                                    {/* スロット用ステータス変更ボタン */}
                                    <button type="button" onClick={() => setSlotPicker(isThisSlotPicker && slotPicker?.type === 'state' ? null : { dayNum, slotId: slot.id, type: 'state' })} className="flex-1 bg-white border border-gray-200 hover:border-indigo-300 rounded-lg px-3 py-2 text-xs font-bold text-left flex items-center justify-between transition-colors shadow-2xs">
                                      <span className={`flex items-center gap-1.5 ${sConf.colorClass}`}><sConf.icon className="w-4 h-4" />{sConf.label}</span>
                                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                    </button>

                                    {/* スロット用勤務先変更ボタン */}
                                    <button type="button" onClick={() => setSlotPicker(isThisSlotPicker && slotPicker?.type === 'location' ? null : { dayNum, slotId: slot.id, type: 'location' })} className="flex-1 bg-white border border-gray-200 hover:border-indigo-300 rounded-lg px-3 py-2 text-xs font-bold text-left flex items-center justify-between transition-colors shadow-2xs">
                                      <span className="truncate text-gray-800">{sLocName}</span>
                                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                    </button>
                                  </div>

                                  <button type="button" onClick={() => handleRemoveSlot(dayNum, slot.id)} className="p-2 bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-lg shrink-0 transition-colors shadow-2xs">
                                    <Trash2 className="w-4 h-4" />
                                  </button>

                                  {/* インラインピッカーポップアップ */}
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

            {/* 特定日時の予約 */}
            {activeTab === "reservation" && (
              <div className="space-y-6 max-w-3xl mx-auto">
                <form onSubmit={handleAddSchedule} className="p-5 sm:p-6 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><Calendar className="w-4 h-4"/></div>
                    <div>
                      <h4 className="text-sm font-black text-gray-900">特定日時の予約登録</h4>
                      <p className="text-[10px] font-bold text-gray-500">会議や出張など、ピンポイントで動静を予約できます。</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase">日付</label>
                      <input type="date" required value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-[16px] sm:text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-all shadow-2xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase">時間 (開始 〜 終了)</label>
                      <div className="flex gap-1.5 items-center bg-gray-50 border border-gray-200 rounded-xl px-2 py-1 shadow-2xs focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                        <input type="time" required value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} className="bg-transparent px-1 py-1.5 text-[16px] sm:text-xs font-bold outline-none w-full" />
                        <span className="text-[10px] text-gray-400 font-bold">〜</span>
                        <input type="time" required value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} className="bg-transparent px-1 py-1.5 text-[16px] sm:text-xs font-bold outline-none w-full" />
                      </div>
                    </div>

                    <div className="relative">
                      <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase">状態</label>
                      <button type="button" onClick={() => setResStateOpen(!resStateOpen)} className="w-full flex items-center justify-between px-3.5 py-2.5 bg-gray-50 border border-gray-200 hover:bg-white focus:bg-white rounded-xl text-xs font-bold shadow-2xs transition-colors">
                        <span className={`flex items-center gap-2 ${resStateConf.colorClass}`}><resStateConf.icon className="w-4 h-4" />{resStateConf.label}</span>
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </button>
                      {resStateOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1">
                          {(Object.keys(PRESENCE_CONFIG) as PresenceState[]).map(st => {
                            const conf = PRESENCE_CONFIG[st];
                            return (
                              <button key={st} type="button" onClick={() => { setNewState(st); setResStateOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold hover:bg-gray-50 text-left transition-colors">
                                <conf.icon className={`w-4 h-4 ${conf.fillClass}`} />
                                <span className={conf.colorClass}>{conf.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase">勤務先 (任意)</label>
                      <button type="button" onClick={() => setResLocOpen(!resLocOpen)} className="w-full flex items-center justify-between px-3.5 py-2.5 bg-gray-50 border border-gray-200 hover:bg-white focus:bg-white rounded-xl text-xs font-bold shadow-2xs transition-colors">
                        <span className="text-gray-800">{resLocName || "未設定"}</span>
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </button>
                      {resLocOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto custom-scrollbar bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1">
                          <button type="button" onClick={() => { setNewLocationId(""); setResLocOpen(false); }} className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 transition-colors">未設定</button>
                          {visibleLocations.map(l => (
                            <button key={l.id} type="button" onClick={() => { setNewLocationId(l.id); setResLocOpen(false); }} className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 transition-colors">{l.name}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 items-center pt-2">
                    <input type="text" placeholder="ステータスメッセージを追加..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="w-full flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[16px] sm:text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-all shadow-2xs" />
                    <button type="submit" disabled={isSaving || targetUserIds.length===0} className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-black shrink-0 hover:bg-indigo-700 shadow-md flex items-center justify-center transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:-translate-y-0">
                      予約登録
                    </button>
                  </div>
                </form>

                <div className="space-y-3 pb-12 sm:pb-0">
                  <span className="text-xs font-black text-gray-700 block border-b border-gray-200 pb-1.5 pl-1">予約済みスケジュール ({scheduledList.length}件)</span>
                  {scheduledList.length === 0 ? (
                    <p className="text-xs font-bold text-gray-400 text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">予約はありません</p>
                  ) : (
                    scheduledList.sort((a,b) => new Date(`${a.date}T${a.startTime}`).getTime() - new Date(`${b.date}T${b.startTime}`).getTime()).map((s) => {
                      const conf = PRESENCE_CONFIG[s.state];
                      const locName = locations.find(l => l.id === s.locationId)?.name;
                      return (
                        <div key={s.id} className="p-3.5 bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-shadow min-w-0 group">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 shrink-0">
                              <conf.icon className={`w-5 h-5 ${conf.colorClass}`} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs sm:text-sm font-black text-gray-900 truncate">{s.date.replace(/-/g, '/')} ({s.startTime}〜{s.endTime})</span>
                              <span className="text-[10px] font-bold text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                                <span className={conf.colorClass}>{conf.label}</span>
                                {locName && <><span className="w-1 h-1 bg-gray-300 rounded-full"></span><MapPin className="w-3 h-3 text-gray-400" />{locName}</>}
                                {s.note && <><span className="w-1 h-1 bg-gray-300 rounded-full"></span>💬 {s.note}</>}
                              </span>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteSchedule(s.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
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