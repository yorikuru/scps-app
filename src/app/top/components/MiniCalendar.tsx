"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

type Props = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
};

export default function MiniCalendar({ selectedDate, onSelectDate }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [holidays, setHolidays] = useState<Record<string, string>>({});

  // 祝日APIからデータを取得
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

  const calendarCells = [];
  for (let i = 0; i < firstDay; i++) {
    calendarCells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(day);
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
        <h3 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center">
          <CalendarIcon className="h-4 w-4 mr-2 text-blue-600" /> {year}年 {month + 1}月
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={nextMonth} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold mb-3">
          <div className="text-red-500">日</div>
          <div className="text-gray-400">月</div>
          <div className="text-gray-400">火</div>
          <div className="text-gray-400">水</div>
          <div className="text-gray-400">木</div>
          <div className="text-gray-400">金</div>
          <div className="text-blue-500">土</div>
        </div>

        {/* 日付グリッド */}
        <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center text-xs">
          {calendarCells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="h-8"></div>;
            }

            const dateStr = getFormattedDate(day);
            const holidayName = holidays[dateStr];
            const isHoliday = !!holidayName;
            const isSun = idx % 7 === 0;
            const isSat = idx % 7 === 6;
            const isCurrentToday = isToday(day);
            
            // 選択中かどうかの判定
            const isSelected = 
              selectedDate.getFullYear() === year && 
              selectedDate.getMonth() === month && 
              selectedDate.getDate() === day;

            let textClass = "text-gray-700 dark:text-gray-300";
            if (isHoliday || isSun) textClass = "text-red-500 dark:text-red-400 font-extrabold";
            else if (isSat) textClass = "text-blue-500 dark:text-blue-400 font-extrabold";

            let bgClass = "hover:bg-gray-100 dark:hover:bg-gray-800";
            
            // スタイルの上書きロジック（選択状態と今日）
            if (isSelected) {
              if (isCurrentToday) {
                bgClass = "bg-blue-600 shadow-sm";
                textClass = "text-white font-extrabold";
              } else {
                bgClass = "bg-amber-500 shadow-sm"; // 選択日はオレンジ色
                textClass = "text-white font-extrabold";
              }
            } else if (isCurrentToday) {
              // 今日だが選択されていない場合は薄い青背景
              bgClass = "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800";
              textClass = "text-blue-600 dark:text-blue-400 font-extrabold";
            }

            return (
              <div 
                key={day} 
                className="h-8 flex flex-col items-center justify-start relative group cursor-pointer" 
                title={holidayName || undefined}
                onClick={() => onSelectDate(new Date(year, month, day))}
              >
                <span
                  className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${bgClass} ${textClass}`}
                >
                  {day}
                </span>
                
                {isHoliday && (
                  <span className={`absolute bottom-0 w-1 h-1 rounded-full ${isSelected || isCurrentToday ? "bg-transparent" : "bg-red-500"}`}></span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}