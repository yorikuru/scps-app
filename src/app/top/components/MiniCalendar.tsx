"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RotateCcw } from "lucide-react";

type ScheduleEvent = {
  startAt: string;
  [key: string]: any;
};

type Props = {
  selectedDate: Date | string; // 万が一文字列が来ても許容
  onSelectDate: (date: Date) => void;
  events?: ScheduleEvent[];
};

export default function MiniCalendar({ selectedDate, onSelectDate, events = [] }: Props) {
  // 安全にDate型として扱うためのパース
  const parsedSelected = new Date(selectedDate);
  
  // 表示中の月を管理するステート（初期値は選択された日の月）
  const [currentDate, setCurrentDate] = useState(new Date(parsedSelected.getFullYear(), parsedSelected.getMonth(), 1));
  const [holidays, setHolidays] = useState<Record<string, string>>({});

  // ★ 修正ポイント：親コンポーネント等で選択日が変更された際、カレンダーの表示月を自動で追従させる
  useEffect(() => {
    setCurrentDate((prev) => {
      // 既に同じ月を表示している場合は何もしない（無駄な再描画を防ぐ）
      if (prev.getFullYear() === parsedSelected.getFullYear() && prev.getMonth() === parsedSelected.getMonth()) {
        return prev;
      }
      return new Date(parsedSelected.getFullYear(), parsedSelected.getMonth(), 1);
    });
  }, [parsedSelected.getTime()]);

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

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // 「今日に戻る」ボタンの処理
  const jumpToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelectDate(today);
  };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const getFormattedDate = (day: number) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const eventDateSet = new Set(
    events.map((e) => {
      const d = new Date(e.startAt);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    })
  );

  const calendarCells = [];
  for (let i = 0; i < firstDay; i++) {
    calendarCells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(day);
  }

  return (
    <div className="bg-[#2C2C2E] text-gray-200 rounded-xl p-2.5 border border-[#3A3A3C] shadow-sm text-xs">
      <div className="flex justify-between items-center mb-2 px-1">
        <h3 className="text-[11px] font-bold text-gray-100 flex items-center">
          <CalendarIcon className="h-3 w-3 mr-1 text-indigo-400" /> {year}年 {month + 1}月
        </h3>
        <div className="flex items-center gap-1">
          <button 
            onClick={jumpToToday} 
            className="px-1.5 py-0.5 text-[9px] font-bold bg-[#3A3A3C] hover:bg-indigo-600 text-gray-300 hover:text-white rounded transition-colors flex items-center gap-0.5"
            title="今日に戻る"
          >
            <RotateCcw className="h-2.5 w-2.5" /> 今日
          </button>
          <div className="w-px h-3 bg-[#3A3A3C]"></div>
          <button onClick={prevMonth} className="p-0.5 text-gray-400 hover:text-white rounded hover:bg-[#3A3A3C]" title="前月">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={nextMonth} className="p-0.5 text-gray-400 hover:text-white rounded hover:bg-[#3A3A3C]" title="翌月">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-bold mb-1 text-gray-400">
        <div className="text-red-400">日</div>
        <div>月</div>
        <div>火</div>
        <div>水</div>
        <div>木</div>
        <div>金</div>
        <div className="text-blue-400">土</div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 text-center text-[10px]">
        {calendarCells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-6"></div>;
          }

          const dateStr = getFormattedDate(day);
          const holidayName = holidays[dateStr];
          const isHoliday = !!holidayName;
          const isSun = idx % 7 === 0;
          const isSat = idx % 7 === 6;
          const isCurrentToday = isToday(day);

          // ★ 修正ポイント：パース済みの確実な日付データを用いて判定する
          const isSelected =
            parsedSelected.getFullYear() === year &&
            parsedSelected.getMonth() === month &&
            parsedSelected.getDate() === day;

          const hasEvent = eventDateSet.has(dateStr);

          let textClass = "text-gray-300";
          if (isHoliday || isSun) textClass = "text-red-400 font-bold";
          else if (isSat) textClass = "text-blue-400 font-bold";

          let bgClass = "hover:bg-[#3A3A3C]";

          if (isSelected) {
            bgClass = "bg-indigo-600 text-white font-black shadow-sm";
            textClass = "text-white";
          } else if (isCurrentToday) {
            bgClass = "bg-indigo-950/60 border border-indigo-500/50";
            textClass = "text-indigo-300 font-bold";
          }

          return (
            <div
              key={day}
              className="h-6 flex flex-col items-center justify-center relative cursor-pointer"
              title={holidayName ? `祝日: ${holidayName}` : undefined}
              onClick={() => onSelectDate(new Date(year, month, day))}
            >
              <span className={`w-5 h-5 flex items-center justify-center rounded-full transition-all ${bgClass} ${textClass}`}>
                {day}
              </span>

              {hasEvent && (
                <span className={`absolute bottom-0 w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-indigo-400"}`}></span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}