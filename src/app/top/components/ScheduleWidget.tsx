"use client";

import React, { useState, useEffect } from "react";
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, orderBy 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Calendar as CalendarIcon, Plus, X, Loader2, Save, Trash2, MapPin, Video, Bell, 
  Edit3, AlignLeft, Clock, AlertTriangle, ExternalLink 
} from "lucide-react";
import { UserData, SchoolData } from "../page";
import { useDialog } from "@/components/DialogContext";

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
  syncedGoogleEventId?: string | null;
};

const BORDER_COLORS = [
  "border-l-indigo-500",
  "border-l-emerald-500",
  "border-l-rose-500",
  "border-l-amber-500",
  "border-l-blue-500",
  "border-l-purple-500"
];

type Props = {
  userData: UserData | null;
  schoolData: SchoolData | null;
  selectedDate: Date;
};

export default function ScheduleWidget({ userData, schoolData, selectedDate }: Props) {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [currentTime, setCurrentTime] = useState(new Date());

  const { showAlert, showConfirm } = useDialog();

  // モーダル・詳細用ステート
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

  // 選択された日付とその翌日の基準を作成
  const baseDate = new Date(selectedDate);
  baseDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    if (!schoolData) return;
    const q = query(collection(db, "events"), where("schoolId", "==", schoolData.id), orderBy("startAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEvents: ScheduleEvent[] = [];
      snapshot.forEach((docSnap) => fetchedEvents.push({ id: docSnap.id, ...docSnap.data() } as ScheduleEvent));
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
    setFormData(prev => ({ ...prev, startAt: newStartAt, endAt: calculatedEndAt, isAllDay }));
  };

  const openNewModal = () => {
    setEditingEventId(null);
    setValidationError(null);
    const now = new Date();
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    const hours = String(now.getHours() + 1).padStart(2, '0');
    const defaultStart = `${year}-${month}-${day}T${hours}:00`;
    
    handleStartAtChange(defaultStart, false);
    setFormData(prev => ({
      ...prev,
      title: "",
      description: "",
      location: "",
      meetingLink: "",
      addMeetingLink: false,
      enableReminder: true,
      reminderMinutes: 10,
      syncedGoogleEventId: null,
    }));
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
      syncedGoogleEventId: event.syncedGoogleEventId
    });
    setIsViewModalOpen(false);
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !schoolData) return;
    if (!formData.title.trim()) { setValidationError("タイトルを入力してください"); return; }
    if (!formData.startAt || !formData.endAt) { setValidationError("日時を正しく入力してください"); return; }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      const eventPayload = {
        schoolId: schoolData.id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        startAt: formData.startAt,
        endAt: formData.endAt,
        isAllDay: formData.isAllDay,
        location: formData.location.trim(),
        meetingLink: formData.addMeetingLink ? formData.meetingLink.trim() : "",
        addMeetingLink: formData.addMeetingLink,
        reminderMinutes: formData.enableReminder ? Number(formData.reminderMinutes) : -1,
        updatedAt: new Date().toISOString()
      };

      if (editingEventId) {
        await updateDoc(doc(db, "events", editingEventId), eventPayload);
        if (userData.isGoogleCalendarLinked && formData.syncedGoogleEventId) {
          try {
            await fetch("/api/calendar/google/update", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ uid: userData.id, schoolId: schoolData.id, googleEventId: formData.syncedGoogleEventId, event: eventPayload })
            });
          } catch (err) { console.error("Google update error", err); }
        }
      } else {
        let syncedGoogleId = null;
        if (userData.isGoogleCalendarLinked) {
          try {
            const res = await fetch("/api/calendar/google/add", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ uid: userData.id, schoolId: schoolData.id, event: eventPayload })
            });
            if (res.ok) {
              const data = await res.json();
              syncedGoogleId = data.googleEventId || null;
            }
          } catch (err) { console.error("Google add error", err); }
        }
        await addDoc(collection(db, "events"), {
          ...eventPayload,
          syncedGoogleEventId: syncedGoogleId,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      setValidationError("保存に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 削除の実行本体
  const performDelete = async (eventId: string, googleEventId?: string | null) => {
    if (!userData || !schoolData) return;
    setIsDeleting(true);
    try {
      if (userData.isGoogleCalendarLinked && googleEventId) {
        try {
          await fetch("/api/calendar/google/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: userData.id, schoolId: schoolData.id, googleEventId }),
          });
        } catch (e) { console.error("Google delete error", e); }
      }
      await deleteDoc(doc(db, "events", eventId));
      setIsModalOpen(false);
      setIsViewModalOpen(false);
      setViewingEvent(null);
      showAlert("予定を削除しました", "success");
    } catch (error) {
      showAlert("削除に失敗しました", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // ★ showConfirm を用いた削除確認
  const executeDelete = (eventId: string, googleEventId?: string | null) => {
    showConfirm(
      "この予定を削除しますか？",
      () => performDelete(eventId, googleEventId),
      "danger",
      "予定削除の確認"
    );
  };

  const getDayName = (date: Date) => ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  const getFormattedDateString = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const getDateStyle = (date: Date, isTargetBase: boolean) => {
    const dateStr = getFormattedDateString(date);
    const holidayName = holidays[dateStr];
    const isHoliday = !!holidayName;
    const dayOfWeek = date.getDay();

    let label = "";
    let badgeClass = "";

    const isCurrentToday = date.getTime() === today.getTime();
    const isCurrentTomorrow = date.getTime() === tomorrow.getTime();
    const isSelectedSame = date.getTime() === baseDate.getTime();

    if (isCurrentToday) {
      label = "今日";
      badgeClass = "bg-indigo-600 text-white";
    } else if (isCurrentTomorrow) {
      label = "明日";
      badgeClass = "bg-gray-200 text-gray-700";
    } else if (isSelectedSame) {
      label = isTargetBase ? "選択日" : "翌日";
      badgeClass = "bg-indigo-100 text-indigo-700";
    } else {
      label = `${date.getMonth() + 1}/${date.getDate()}`;
      badgeClass = "bg-gray-100 text-gray-600";
    }

    let textClass = "text-gray-900";
    if (isHoliday || dayOfWeek === 0) textClass = "text-red-600";
    else if (dayOfWeek === 6) textClass = "text-blue-600";

    return { label, badgeClass, textClass, holidayName };
  };

  const filterEventsForDate = (targetDate: Date) => {
    const targetStr = getFormattedDateString(targetDate);
    return events.filter(e => {
      const startDateStr = e.startAt.split("T")[0];
      const endDateStr = e.endAt.split("T")[0];
      return targetStr >= startDateStr && targetStr <= endDateStr;
    });
  };

  const datesToRender = [
    { date: baseDate, isBase: true },
    { date: nextDate, isBase: false }
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col w-full min-w-0">
      
      {/* ヘッダー部 */}
      <div className="px-3.5 py-2.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h2 className="text-xs sm:text-sm font-black text-gray-900 flex items-center gap-1.5 truncate">
          <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
          スケジュール ({baseDate.getMonth() + 1}月{baseDate.getDate()}日〜)
        </h2>
        <button 
          onClick={openNewModal}
          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors shadow-2xs flex-shrink-0"
        >
          <Plus className="w-3 h-3" /> 追加
        </button>
      </div>

      {/* スケジュール2カラム表示エリア */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 bg-white">
        {datesToRender.map(({ date, isBase }, index) => {
          const styleInfo = getDateStyle(date, isBase);
          const dayEvents = filterEventsForDate(date);

          return (
            <div key={index} className="p-3 sm:p-3.5 flex flex-col min-h-[140px] max-h-[220px] overflow-hidden">
              
              {/* 日付ヘッダー */}
              <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${styleInfo.badgeClass}`}>
                    {styleInfo.label}
                  </span>
                  <span className={`text-xs sm:text-sm font-black ${styleInfo.textClass}`}>
                    {date.getMonth() + 1}/{date.getDate()} ({getDayName(date)})
                  </span>
                  {styleInfo.holidayName && (
                    <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                      {styleInfo.holidayName}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold text-gray-400">
                  {dayEvents.length}件
                </span>
              </div>

              {/* イベントリスト */}
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                {isLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                  </div>
                ) : dayEvents.length === 0 ? (
                  <div className="text-center py-6 text-[10px] font-bold text-gray-400 border border-dashed border-gray-100 rounded-xl">
                    予定なし
                  </div>
                ) : (
                  dayEvents.map((ev, i) => {
                    const borderColor = BORDER_COLORS[i % BORDER_COLORS.length];
                    return (
                      <div 
                        key={ev.id}
                        onClick={() => { setViewingEvent(ev); setIsViewModalOpen(true); }}
                        className={`p-2 rounded-xl bg-gray-50/80 hover:bg-indigo-50/50 border border-gray-100 hover:border-indigo-200 cursor-pointer transition-all border-l-4 ${borderColor} group`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-black text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                            {ev.title}
                          </span>
                          <span className="text-[9px] font-bold text-gray-500 flex-shrink-0">
                            {ev.isAllDay ? "終日" : ev.startAt.split("T")[1]}
                          </span>
                        </div>
                        {ev.location && (
                          <div className="text-[9px] font-bold text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" /> {ev.location}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* 新規・編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-gray-200 max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-sm font-black text-gray-900">
                {editingEventId ? "予定の編集" : "新しい予定の追加"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400 hover:bg-gray-200 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEvent} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {validationError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {validationError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">タイトル <span className="text-red-500">*</span></label>
                <input 
                  type="text" required value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  placeholder="例: 生徒会執行部定例会" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-black text-gray-900 focus:bg-white outline-none focus:ring-1 focus:ring-indigo-500" 
                />
              </div>

              <div className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                <input 
                  type="checkbox" id="isAllDay" checked={formData.isAllDay} 
                  onChange={e => handleStartAtChange(formData.startAt, e.target.checked)} 
                  className="w-4 h-4 text-indigo-600 rounded" 
                />
                <label htmlFor="isAllDay" className="text-xs font-bold text-gray-800 cursor-pointer">終日の予定</label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">開始日時 <span className="text-red-500">*</span></label>
                  <input 
                    type={formData.isAllDay ? "date" : "datetime-local"} required value={formData.startAt} 
                    onChange={e => handleStartAtChange(e.target.value, formData.isAllDay)} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:bg-white outline-none focus:ring-1 focus:ring-indigo-500" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">終了日時 <span className="text-red-500">*</span></label>
                  <input 
                    type={formData.isAllDay ? "date" : "datetime-local"} required value={formData.endAt} 
                    onChange={e => setFormData({...formData, endAt: e.target.value})} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:bg-white outline-none focus:ring-1 focus:ring-indigo-500" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">場所</label>
                <input 
                  type="text" value={formData.location} 
                  onChange={e => setFormData({...formData, location: e.target.value})} 
                  placeholder="例: 第一会議室" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:bg-white outline-none focus:ring-1 focus:ring-indigo-500" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">詳細メモ</label>
                <textarea 
                  rows={3} value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  placeholder="アジェンダや持ち物など..." 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:bg-white outline-none focus:ring-1 focus:ring-indigo-500 resize-none custom-scrollbar" 
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                {editingEventId && (
                  <button 
                    type="button" disabled={isDeleting}
                    onClick={() => executeDelete(editingEventId, formData.syncedGoogleEventId)} 
                    className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-colors mr-auto flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 削除
                  </button>
                )}
                <button 
                  type="button" onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                >
                  キャンセル
                </button>
                <button 
                  type="submit" disabled={isSubmitting} 
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 詳細ビューモーダル */}
      {isViewModalOpen && viewingEvent && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
                予定詳細
              </span>
              <button onClick={() => setIsViewModalOpen(false)} className="p-1 text-gray-400 hover:bg-gray-200 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <h3 className="text-base font-black text-gray-900 leading-snug">{viewingEvent.title}</h3>
              
              <div className="space-y-2 text-xs font-bold text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span>{viewingEvent.startAt.replace("T", " ")} 〜 {viewingEvent.endAt.replace("T", " ")}</span>
                </div>
                {viewingEvent.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <span>{viewingEvent.location}</span>
                  </div>
                )}
              </div>

              {viewingEvent.description && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">詳細メモ</span>
                  <p className="text-xs font-bold text-gray-700 bg-gray-50 p-3 rounded-xl whitespace-pre-wrap leading-relaxed border border-gray-100">
                    {viewingEvent.description}
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <button 
                onClick={() => executeDelete(viewingEvent.id, viewingEvent.syncedGoogleEventId)}
                className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> 削除
              </button>
              <button 
                onClick={() => openEditModal(viewingEvent)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" /> 編集
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}