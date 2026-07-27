"use client";

import React, { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Clock, Calendar as CalendarIcon, Plus, X, Loader2, Save, 
  Trash2, MapPin, Video, Bell, Edit3, ExternalLink, AlertTriangle, AlignLeft 
} from "lucide-react";
import { UserData, SchoolData } from "../page";

type Props = {
  userData: UserData | null;
  schoolData: SchoolData | null;
  selectedDate: Date;
};

export type ScheduleEvent = {
  id: string;
  schoolId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  location?: string;
  meetingLink?: string;
  addMeetingLink?: boolean;
  reminderMinutes?: number;
  createdBy: string;
  createdAt: string;
  syncedGoogleEventId?: string | null;
};

export default function ScheduleWidget({ userData, schoolData, selectedDate }: Props) {
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly">("daily");
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingEvent, setViewingEvent] = useState<ScheduleEvent | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startAt: "",
    endAt: "",
    isAllDay: false,
    location: "",
    meetingLink: "",
    addMeetingLink: false,
    enableReminder: true,
    reminderMinutes: 10,
    syncedGoogleEventId: null as string | null | undefined,
  });

  // 基準日の計算
  const baseDate = new Date(selectedDate);
  baseDate.setHours(0, 0, 0, 0);
  
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + 1);
  
  const dayAfterNextDate = new Date(baseDate);
  dayAfterNextDate.setDate(dayAfterNextDate.getDate() + 2);

  const isTodayDate = baseDate.toDateString() === new Date().toDateString();

  // 祝日APIのフェッチ
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const res = await fetch("https://holidays-jp.github.io/api/v1/date.json");
        if (res.ok) {
          const data = await res.json();
          setHolidays(data);
        }
      } catch (error) {
        console.error("Failed to fetch holidays:", error);
      }
    };
    fetchHolidays();
  }, []);

  // 予定のフェッチ
  useEffect(() => {
    if (!schoolData) return;
    const q = query(collection(db, "events"), where("schoolId", "==", schoolData.id), orderBy("startAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEvents: ScheduleEvent[] = [];
      snapshot.forEach((docSnap) => {
        fetchedEvents.push({ id: docSnap.id, ...docSnap.data() } as ScheduleEvent);
      });
      setEvents(fetchedEvents);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [schoolData]);

  const handleStartAtChange = (newStartAt: string, isAllDay: boolean) => {
    setValidationError(null);
    if (!newStartAt) {
      setFormData(prev => ({ ...prev, startAt: newStartAt }));
      return;
    }

    let calculatedEndAt = "";
    if (isAllDay) {
      const startDate = new Date(newStartAt);
      startDate.setDate(startDate.getDate() + 1);
      calculatedEndAt = startDate.toISOString().split("T")[0];
    } else {
      const startDate = new Date(newStartAt);
      startDate.setHours(startDate.getHours() + 1);
      
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const day = String(startDate.getDate()).padStart(2, '0');
      const hours = String(startDate.getHours()).padStart(2, '0');
      const minutes = String(startDate.getMinutes()).padStart(2, '0');
      
      calculatedEndAt = `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    setFormData(prev => ({
      ...prev,
      startAt: newStartAt,
      endAt: calculatedEndAt,
      isAllDay: isAllDay
    }));
  };

  const handleAllDayToggle = (checked: boolean) => {
    if (formData.startAt) {
      handleStartAtChange(formData.startAt, checked);
    } else {
      setFormData(prev => ({ ...prev, isAllDay: checked }));
    }
  };

  const openViewModal = (event: ScheduleEvent) => {
    setViewingEvent(event);
    setIsViewModalOpen(true);
  };

  const openNewModal = () => {
    const now = new Date();
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    const hours = String(now.getHours() + 1).padStart(2, '0');
    const defaultStart = `${year}-${month}-${day}T${hours}:00`;

    setEditingEventId(null);
    setValidationError(null);
    setFormData({
      title: "",
      description: "",
      startAt: "",
      endAt: "",
      isAllDay: false,
      location: "",
      meetingLink: "",
      addMeetingLink: false,
      enableReminder: true,
      reminderMinutes: 10,
      syncedGoogleEventId: null,
    });
    handleStartAtChange(defaultStart, false);
    setIsModalOpen(true);
  };

  const openEditModal = (event: ScheduleEvent) => {
    setEditingEventId(event.id);
    setValidationError(null);
    setFormData({
      title: event.title,
      description: event.description || "",
      startAt: event.startAt,
      endAt: event.endAt,
      isAllDay: event.isAllDay,
      location: event.location || "",
      meetingLink: event.meetingLink || "",
      addMeetingLink: event.addMeetingLink || false,
      enableReminder: event.reminderMinutes !== undefined && event.reminderMinutes >= 0,
      reminderMinutes: event.reminderMinutes ?? 10,
      syncedGoogleEventId: event.syncedGoogleEventId,
    });
    setIsViewModalOpen(false);
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !schoolData) return;

    const start = new Date(formData.startAt).getTime();
    const end = new Date(formData.endAt).getTime();
    if (end < start) {
      setValidationError("終了日時は開始日時より後の日時を設定してください。");
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      const reminderVal = formData.enableReminder ? Number(formData.reminderMinutes) : -1;
      let syncedGoogleEventId = formData.syncedGoogleEventId;
      let generatedMeetingLink = formData.meetingLink;

      if (userData.isGoogleCalendarLinked) {
        try {
          const apiPath = editingEventId && syncedGoogleEventId
            ? "/api/calendar/google/update"
            : "/api/calendar/google/create";

          const syncRes = await fetch(apiPath, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid: userData.id,
              schoolId: schoolData.id,
              googleEventId: syncedGoogleEventId,
              title: formData.title,
              description: formData.description,
              startAt: formData.startAt,
              endAt: formData.endAt,
              isAllDay: formData.isAllDay,
              location: formData.location,
              addMeetingLink: formData.addMeetingLink,
              reminderMinutes: reminderVal,
            }),
          });
          const syncData = await syncRes.json();
          if (syncData.synced) {
            syncedGoogleEventId = syncData.googleEventId;
            if (syncData.hangoutLink) {
              generatedMeetingLink = syncData.hangoutLink;
            }
          }
        } catch (syncError) {
          console.error("Google Calendar Sync Warning:", syncError);
        }
      }

      const eventPayload = {
        schoolId: schoolData.id,
        title: formData.title,
        description: formData.description,
        startAt: formData.startAt,
        endAt: formData.endAt,
        isAllDay: formData.isAllDay,
        location: formData.location,
        meetingLink: generatedMeetingLink,
        addMeetingLink: formData.addMeetingLink,
        reminderMinutes: reminderVal,
        createdBy: userData.id,
        syncedGoogleEventId: syncedGoogleEventId || null,
        updatedAt: new Date().toISOString(),
      };

      if (editingEventId) {
        await updateDoc(doc(db, "events", editingEventId), eventPayload);
      } else {
        await addDoc(collection(db, "events"), {
          ...eventPayload,
          createdAt: new Date().toISOString(),
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to save event:", error);
      alert("予定の保存に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDelete = async (eventId: string, googleEventId?: string | null) => {
    if (!userData || !schoolData) return;
    if (!confirm("この予定を削除しますか？")) return;
    setIsDeleting(true);
    try {
      if (userData.isGoogleCalendarLinked && googleEventId) {
        try {
          await fetch("/api/calendar/google/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: userData.id, schoolId: schoolData.id, googleEventId }),
          });
        } catch (e) {
          console.error("Google delete error", e);
        }
      }
      await deleteDoc(doc(db, "events", eventId));
      setIsModalOpen(false);
      setIsViewModalOpen(false);
      setViewingEvent(null);
    } catch (error) {
      console.error("Failed to delete event:", error);
      alert("削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  };

  // 曜日・色のユーティリティ
  const getFormattedDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getDayName = (date: Date) => ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  const getDayColorClass = (date: Date, isHol: boolean) => {
    const d = date.getDay();
    if (isHol || d === 0) return "text-red-500 dark:text-red-400";
    if (d === 6) return "text-blue-500 dark:text-blue-400";
    return "text-gray-700 dark:text-gray-300";
  };

  const formatEventTime = (event: ScheduleEvent) => {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    const startStr = start.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
    if (event.isAllDay) {
      if (start.toDateString() === end.toDateString()) {
        return `${startStr} (終日)`;
      } else {
        const endStr = end.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
        return `${startStr} 〜 ${endStr} (終日)`;
      }
    } else {
      const startTimeStr = start.toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'});
      const endTimeStr = end.toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'});
      if (start.toDateString() === end.toDateString()) {
        return `${startStr} ${startTimeStr} 〜 ${endTimeStr}`;
      } else {
        const endStr = end.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
        return `${startStr} ${startTimeStr} 〜 ${endStr} ${endTimeStr}`;
      }
    }
  };

  // フィルタリング
  const baseDateEvents = events.filter(e => {
    const eventDate = new Date(e.startAt);
    return eventDate >= baseDate && eventDate < nextDate;
  });

  const nextDateEvents = events.filter(e => {
    const eventDate = new Date(e.startAt);
    return eventDate >= nextDate && eventDate < dayAfterNextDate;
  });

  const endOfWeek = new Date(baseDate);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const weeklyEvents = events.filter(e => {
    const eventDate = new Date(e.startAt);
    return eventDate >= baseDate && eventDate < endOfWeek;
  });

  // 日付ヘッダーコンポーネント（祝日判定・表示）
  const DateHeader = ({ date, label }: { date: Date, label: string }) => {
    const dateStr = getFormattedDateString(date);
    const holidayName = holidays[dateStr];
    const isHol = !!holidayName;
    const isToday = date.toDateString() === new Date().toDateString();

    return (
      <div className="mb-4 flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
         <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[10px] font-black uppercase tracking-wider ${isToday ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400"}`}>
              {label}
            </span>
            {!isToday && label.includes("選択") && (
              <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold shadow-sm border border-amber-200">
                ※カレンダー選択中
              </span>
            )}
         </div>
         <div className="flex items-center flex-wrap gap-2">
           <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
             {date.getMonth() + 1}月{date.getDate()}日
           </span>
           <span className={`text-sm font-black mt-0.5 ${getDayColorClass(date, isHol)}`}>
             ({getDayName(date)}{isHol && "・祝"})
           </span>
           {isHol && (
             <span className="px-2 py-0.5 mt-0.5 text-[10px] font-bold bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-md border border-red-200 dark:border-red-800 shadow-sm">
               {holidayName}
             </span>
           )}
         </div>
      </div>
    );
  };

  // モダンなイベントカードUI
  const EventCard = ({ e }: { e: ScheduleEvent }) => (
    <div onClick={() => openViewModal(e)} className="group relative flex flex-col p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all overflow-hidden mb-2">
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500 group-hover:bg-indigo-600 transition-colors"></div>
      <div className="ml-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-bold text-[11px] text-indigo-600 dark:text-indigo-400 tracking-wide bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
            {e.isAllDay ? "終日" : new Date(e.startAt).toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'})}
          </span>
          <div className="flex gap-1.5">
            {e.syncedGoogleEventId && <div className="flex items-center justify-center w-5 h-5 bg-blue-50 dark:bg-blue-900/40 rounded border border-blue-100 dark:border-blue-800" title="Googleカレンダー連携済"><CalendarIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" /></div>}
            {e.meetingLink && <div className="flex items-center justify-center w-5 h-5 bg-purple-50 dark:bg-purple-900/40 rounded border border-purple-100 dark:border-purple-800" title="WEB会議あり"><Video className="w-3 h-3 text-purple-600 dark:text-purple-400" /></div>}
            {e.location && <div className="flex items-center justify-center w-5 h-5 bg-rose-50 dark:bg-rose-900/40 rounded border border-rose-100 dark:border-rose-800" title={`場所: ${e.location}`}><MapPin className="w-3 h-3 text-rose-600 dark:text-rose-400" /></div>}
          </div>
        </div>
        <p className="text-sm font-extrabold text-gray-900 dark:text-white leading-snug group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{e.title}</p>
      </div>
    </div>
  );

  const EmptyState = ({ text }: { text: string }) => (
    <div className="flex flex-col items-center justify-center py-6 text-gray-400 dark:text-gray-500">
      <CalendarIcon className="h-8 w-8 mb-2 opacity-30" />
      <p className="text-xs font-bold">{text}</p>
    </div>
  );

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 mb-4 gap-3">
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-2 text-indigo-600" />
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">スケジュール・予定</h3>
            <button 
              onClick={openNewModal}
              className="ml-4 px-2.5 py-1 text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-400 rounded-md transition-colors flex items-center"
            >
              <Plus className="h-3 w-3 mr-1" /> 予定を追加
            </button>
          </div>

          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
            <button onClick={() => setViewMode("daily")} className={`px-3 py-1 rounded-lg transition-all ${viewMode === "daily" ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}>デイリー</button>
            <button onClick={() => setViewMode("weekly")} className={`px-3 py-1 rounded-lg transition-all ${viewMode === "weekly" ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}>週間</button>
            <button onClick={() => setViewMode("monthly")} className={`px-3 py-1 rounded-lg transition-all ${viewMode === "monthly" ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}>月間</button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-indigo-600" /></div>
        ) : (
          <>
            {viewMode === "daily" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                <div className={`p-4 rounded-2xl border ${isTodayDate ? "bg-indigo-50/30 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/50" : "bg-gray-50/50 dark:bg-gray-800/20 border-gray-200 dark:border-gray-800"}`}>
                  <DateHeader date={baseDate} label={isTodayDate ? "TODAY（本日）" : "選択された日付"} />
                  {baseDateEvents.length === 0 ? <EmptyState text="予定はありません" /> : (
                    <div>{baseDateEvents.map(e => <EventCard key={e.id} e={e} />)}</div>
                  )}
                </div>

                <div className="p-4 bg-gray-50/50 dark:bg-gray-800/20 rounded-2xl border border-gray-200 dark:border-gray-800">
                  <DateHeader date={nextDate} label={isTodayDate ? "TOMORROW（明日）" : "選択日の翌日"} />
                  {nextDateEvents.length === 0 ? <EmptyState text="予定はありません" /> : (
                    <div>{nextDateEvents.map(e => <EventCard key={e.id} e={e} />)}</div>
                  )}
                </div>
              </div>
            )}

            {viewMode === "weekly" && (
              <div className="space-y-3 animate-fade-in max-h-[28rem] overflow-y-auto pr-2">
                {weeklyEvents.length === 0 ? <EmptyState text="選択日からの1週間に予定はありません" /> : (
                  weeklyEvents.map(e => {
                    const eDate = new Date(e.startAt);
                    const isHol = !!holidays[getFormattedDateString(eDate)];
                    return (
                      <div key={e.id} onClick={() => openViewModal(e)} className="group relative p-3.5 bg-white dark:bg-gray-800 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 flex flex-col sm:flex-row justify-between sm:items-center text-xs cursor-pointer transition-all overflow-hidden shadow-sm hover:shadow-md">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-indigo-500 transition-colors"></div>
                        <div className="ml-1 mb-2 sm:mb-0">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="font-extrabold text-gray-700 dark:text-gray-300 text-[11px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                              {eDate.getMonth() + 1}/{eDate.getDate()}
                            </span>
                            <span className={`text-[10px] font-bold ${getDayColorClass(eDate, isHol)}`}>
                              ({getDayName(eDate)}{isHol && "・祝"})
                            </span>
                            {!e.isAllDay && (
                              <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[11px] ml-1">
                                {eDate.toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            )}
                            {e.isAllDay && <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[10px] ml-1">終日</span>}
                          </div>
                          <span className="font-extrabold text-gray-900 dark:text-white text-sm group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{e.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:ml-4">
                          {e.syncedGoogleEventId && <div className="flex items-center justify-center w-6 h-6 bg-blue-50 dark:bg-blue-900/40 rounded-full border border-blue-100 dark:border-blue-800" title="Google連携済"><CalendarIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /></div>}
                          {e.meetingLink && <div className="flex items-center justify-center w-6 h-6 bg-purple-50 dark:bg-purple-900/40 rounded-full border border-purple-100 dark:border-purple-800" title="WEB会議"><Video className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /></div>}
                          {e.location && <div className="flex items-center justify-center px-2 h-6 bg-rose-50 dark:bg-rose-900/40 rounded-full border border-rose-100 dark:border-rose-800" title={e.location}><MapPin className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 mr-1"/><span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 truncate max-w-[80px]">{e.location}</span></div>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {viewMode === "monthly" && (
              <div className="p-8 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 text-center animate-fade-in">
                <CalendarIcon className="h-10 w-10 text-indigo-300 dark:text-indigo-800 mx-auto mb-3" />
                <p className="text-sm font-extrabold text-gray-800 dark:text-gray-200 mb-1">選択月の登録予定件数: {events.length}件</p>
                <p className="text-xs font-bold text-gray-500 mt-1">※月間カレンダーは今後のアップデートで公開予定です</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 閲覧ビューモーダル */}
      {isViewModalOpen && viewingEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col">
            <div className="px-4 py-3 flex justify-end items-center gap-2 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <button onClick={() => openEditModal(viewingEvent)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors" title="編集">
                <Edit3 className="h-4 w-4" />
              </button>
              <button onClick={() => executeDelete(viewingEvent.id, viewingEvent.syncedGoogleEventId)} disabled={isDeleting} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors" title="削除">
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
              <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1"></div>
              <button onClick={() => setIsViewModalOpen(false)} className="p-2 text-gray-500 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-full transition-colors" title="閉じる">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
              <div className="flex items-start gap-4">
                <div className="mt-1"><div className="w-4 h-4 rounded bg-indigo-500"></div></div>
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900 dark:text-white leading-tight">{viewingEvent.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {viewingEvent.syncedGoogleEventId && (
                      <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/30 dark:border-blue-800/50 px-2.5 py-0.5 rounded-full font-bold flex items-center">
                        <CalendarIcon className="h-3 w-3 mr-1" /> Google連携済
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="text-sm font-bold text-gray-700 dark:text-gray-200">
                  {formatEventTime(viewingEvent)}
                </div>
              </div>

              {viewingEvent.location && (
                <div className="flex items-start gap-4">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="text-sm font-bold text-gray-700 dark:text-gray-200">
                    {viewingEvent.location}
                  </div>
                </div>
              )}

              {viewingEvent.meetingLink && (
                <div className="flex items-start gap-4">
                  <Video className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <a href={viewingEvent.meetingLink} target="_blank" rel="noreferrer" className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm">
                      <Video className="h-3 w-3 mr-2" /> 会議に参加する
                    </a>
                  </div>
                </div>
              )}

              {viewingEvent.reminderMinutes !== undefined && viewingEvent.reminderMinutes >= 0 && (
                <div className="flex items-start gap-4">
                  <Bell className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="text-sm font-bold text-gray-700 dark:text-gray-200">
                    {viewingEvent.reminderMinutes === 0 ? "イベント開始時" : 
                     viewingEvent.reminderMinutes < 60 ? `${viewingEvent.reminderMinutes}分前` : 
                     viewingEvent.reminderMinutes === 60 ? "1時間前" : 
                     viewingEvent.reminderMinutes === 1440 ? "1日前" : 
                     `${viewingEvent.reminderMinutes}分前`}に通知
                  </div>
                </div>
              )}

              {viewingEvent.description && (
                <div className="flex items-start gap-4">
                  <AlignLeft className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {viewingEvent.description}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 編集・作成モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 dark:border-gray-800 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center">
                {editingEventId ? <Edit3 className="h-4 w-4 mr-2 text-indigo-600" /> : <CalendarIcon className="h-4 w-4 mr-2 text-indigo-600" />}
                {editingEventId ? "予定の編集" : "新しい予定を追加"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:bg-gray-200/50 rounded-full p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEvent} className="p-6 space-y-4 overflow-y-auto flex-1">
              {validationError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs font-bold text-red-700 dark:text-red-300 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                  {validationError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">タイトル <span className="text-red-500">*</span></label>
                <input 
                  type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  placeholder="例: 文化祭実行委員会 第1回打ち合わせ"
                />
              </div>

              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                <input 
                  type="checkbox" id="isAllDay" checked={formData.isAllDay} onChange={e => handleAllDayToggle(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="isAllDay" className="text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer">終日の予定にする</label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">開始日時 <span className="text-red-500">*</span></label>
                  <input 
                    type={formData.isAllDay ? "date" : "datetime-local"} required 
                    value={formData.startAt} 
                    onChange={e => handleStartAtChange(e.target.value, formData.isAllDay)}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">終了日時 <span className="text-red-500">*</span></label>
                  <input 
                    type={formData.isAllDay ? "date" : "datetime-local"} required 
                    value={formData.endAt} 
                    onChange={e => { setValidationError(null); setFormData({...formData, endAt: e.target.value}); }}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                  <MapPin className="h-3.5 w-3.5 mr-1 text-gray-500" /> 場所・教室
                </label>
                <input 
                  type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50 space-y-2">
                <label className="block text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center">
                  <Video className="h-3.5 w-3.5 mr-1 text-blue-600" /> WEB会議（Teams / Google Meet）
                </label>
                
                {userData?.isGoogleCalendarLinked && (
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input 
                      type="checkbox" checked={formData.addMeetingLink} 
                      onChange={e => setFormData({...formData, addMeetingLink: e.target.checked})}
                      className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span className="text-xs font-bold text-blue-800 dark:text-blue-300">Google Meet リンクを自動発行する</span>
                  </label>
                )}

                {formData.meetingLink ? (
                  <div className="flex items-center justify-between pt-1">
                    <a href={formData.meetingLink} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center">
                      <ExternalLink className="h-3 w-3 mr-1" /> 会議に参加する
                    </a>
                    {editingEventId && (
                      <button type="button" onClick={() => setFormData({...formData, meetingLink: "", addMeetingLink: false})} className="text-[10px] font-bold text-red-500 hover:text-red-700">リンクを削除</button>
                    )}
                  </div>
                ) : (
                  <input 
                    type="url" value={formData.meetingLink} onChange={e => setFormData({...formData, meetingLink: e.target.value})}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-2 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="手動入力用URL (例: https://teams.microsoft.com/...)"
                  />
                )}
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center">
                    <Bell className="h-3.5 w-3.5 mr-1 text-orange-500" /> リマインド通知
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox" checked={formData.enableReminder} 
                      onChange={e => setFormData({...formData, enableReminder: e.target.checked})}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">通知を有効にする</span>
                  </label>
                </div>

                {formData.enableReminder && (
                  <select 
                    value={formData.reminderMinutes} onChange={e => setFormData({...formData, reminderMinutes: Number(e.target.value)})}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-2 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold"
                  >
                    <option value={0}>イベント開始時</option>
                    <option value={10}>10分前</option>
                    <option value={30}>30分前</option>
                    <option value={60}>1時間前</option>
                    <option value={1440}>1日前</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">詳細メモ</label>
                <textarea 
                  rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="アジェンダや注意事項などを入力..."
                />
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-xl">キャンセル</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center shadow-sm">
                  {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}