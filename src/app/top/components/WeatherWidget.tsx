"use client";

import React, { useEffect, useState } from "react";
import { Cloud, CloudLightning, CloudRain, CloudSnow, Loader2, MapPin, Sun, AlertCircle, CalendarDays, Clock } from "lucide-react";
import { SchoolData } from "../page";
import { fetchWeatherByCoordinates, WeatherInfo } from "@/lib/weather";

type Props = {
  schoolData: SchoolData | null;
};

export default function WeatherWidget({ schoolData }: Props) {
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"hourly" | "daily">("hourly");

  const lat = schoolData?.latitude ?? 32.8032;
  const lon = schoolData?.longitude ?? 130.7079;
  const locationName = schoolData?.location || "熊本県熊本市";

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchWeatherByCoordinates(lat, lon, locationName);
        if (isMounted) setWeather(data);
      } catch (err: any) {
        if (isMounted) setError(err.message || "天気の取得に失敗しました");
      } finally { // ★ここにあったゴミテキストを削除して修正しました
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [lat, lon, locationName]);

  const getWeatherUI = (code: number) => {
    if (code === 0 || code === 1) return { label: "晴れ", gradient: "from-sky-400 to-blue-500", textColor: "text-white" };
    if (code === 2 || code === 3) return { label: "曇り", gradient: "from-slate-400 to-gray-500", textColor: "text-white" };
    if (code >= 45 && code <= 67) return { label: "雨", gradient: "from-blue-700 to-slate-800", textColor: "text-white" };
    if (code >= 71 && code <= 86) return { label: "雪", gradient: "from-sky-200 to-indigo-300", textColor: "text-slate-800" };
    if (code >= 95) return { label: "雷雨", gradient: "from-indigo-900 to-purple-900", textColor: "text-white" };
    return { label: "晴れ/曇り", gradient: "from-sky-400 to-blue-500", textColor: "text-white" };
  };

  const getWeatherIcon = (code: number, className: string) => {
    if (code === 0 || code === 1) return <Sun className={`${className} drop-shadow-md`} strokeWidth={2.5} />;
    if (code === 2 || code === 3) return <Cloud className={`${className} drop-shadow-md`} strokeWidth={2.5} />;
    if (code >= 45 && code <= 67) return <CloudRain className={`${className} drop-shadow-md`} strokeWidth={2.5} />;
    if (code >= 71 && code <= 86) return <CloudSnow className={`${className} drop-shadow-md`} strokeWidth={2.5} />;
    if (code >= 95) return <CloudLightning className={`${className} drop-shadow-md`} strokeWidth={2.5} />;
    return <Cloud className={`${className} drop-shadow-md`} strokeWidth={2.5} />;
  };

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}(${["日", "月", "火", "水", "木", "金", "土"][today.getDay()]})`;

  if (!schoolData) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-2xs overflow-hidden h-full flex flex-col relative group">
      
      {/* ＝＝ ヘッダー（さらにコンパクト化） ＝＝ */}
      <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 z-10 relative shrink-0">
        <h3 className="text-xs font-black text-gray-900 flex items-center gap-1">
          <MapPin className="w-3 h-3 text-indigo-500" />
          現在の天気
        </h3>
        {weather && (
          <div className="flex bg-gray-200/60 p-0.5 rounded-lg shadow-inner">
            <button 
              onClick={() => setViewMode("hourly")} 
              className={`flex items-center px-1.5 py-0.5 text-[8px] font-bold rounded-md transition-all ${viewMode === "hourly" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <Clock className="w-2.5 h-2.5 mr-0.5" /> 時間
            </button>
            <button 
              onClick={() => setViewMode("daily")} 
              className={`flex items-center px-1.5 py-0.5 text-[8px] font-bold rounded-md transition-all ${viewMode === "daily" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <CalendarDays className="w-2.5 h-2.5 mr-0.5" /> 週間
            </button>
          </div>
        )}
      </div>

      {/* ＝＝ コンテンツ ＝＝ */}
      <div className="flex-1 flex flex-col relative overflow-hidden min-h-[110px]">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50">
            <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
            <AlertCircle className="w-3.5 h-3.5 mb-1 text-red-500" />
            <p className="text-[9px] font-bold text-red-600 leading-tight">{error}</p>
          </div>
        ) : weather ? (
          <div className={`flex-1 w-full h-full bg-gradient-to-br ${getWeatherUI(weather.weatherCode).gradient} p-2.5 flex flex-col justify-between transition-all duration-700`}>
            
            {/* 上部分：地名・日付・気温・アイコンを横並びメインで超コンパクト配置 */}
            <div className="flex justify-between items-center w-full relative z-10">
              <div className="flex flex-col min-w-0 flex-1 pr-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[8px] font-bold opacity-90 drop-shadow-sm ${getWeatherUI(weather.weatherCode).textColor}`}>
                    {dateStr}
                  </span>
                  <span className={`text-xs font-black drop-shadow-sm leading-tight truncate ${getWeatherUI(weather.weatherCode).textColor}`} title={weather.locationName}>
                    {weather.locationName}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-[8px] font-bold opacity-90 drop-shadow-sm whitespace-nowrap ${getWeatherUI(weather.weatherCode).textColor}`}>
                    {getWeatherUI(weather.weatherCode).label} ({weather.tempMax}°/{weather.tempMin}°)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-3xl font-black drop-shadow-md tracking-tighter leading-none ${getWeatherUI(weather.weatherCode).textColor}`}>
                  {weather.temp}°
                </span>
                {getWeatherIcon(weather.weatherCode, `w-6 h-6 ${getWeatherUI(weather.weatherCode).textColor} drop-shadow-md`)}
              </div>
            </div>

            <div className="h-px w-full bg-white/30 my-1.5 shrink-0"></div>

            {/* 下部分：時間/週間予報リスト */}
            <div className={`relative h-[38px] w-full shrink-0 ${getWeatherUI(weather.weatherCode).textColor}`}>
              
              {/* 時間ごと */}
              {viewMode === "hourly" && (
                <div className="absolute inset-0 flex justify-between items-center px-0.5 animate-fade-in">
                  {weather.hourly.slice(0, 5).map((hour, idx) => {
                    const d = new Date(hour.time);
                    const timeStr = idx === 0 ? "今" : `${d.getHours()}時`;
                    return (
                      <div key={idx} className={`flex flex-col items-center justify-center gap-0.5 w-[18%] py-0.5 rounded ${idx === 0 ? 'bg-white/20 shadow-2xs border border-white/20' : 'hover:bg-white/10'} transition-colors cursor-default`}>
                        <span className="text-[7.5px] font-bold drop-shadow-sm">{timeStr}</span>
                        {getWeatherIcon(hour.weatherCode, "w-3.5 h-3.5")}
                        <span className="text-[8.5px] font-black drop-shadow-sm">{hour.temp}°</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 週間予報 */}
              {viewMode === "daily" && (
                <div className="absolute inset-0 flex justify-between items-center px-0.5 animate-fade-in">
                  {weather.forecast.map((day, idx) => {
                    const d = new Date(day.date);
                    const dayName = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
                    const dateDisplay = `${d.getMonth() + 1}/${d.getDate()}`;
                    return (
                      <div key={idx} className="flex flex-col items-center justify-center gap-0.5 w-[23%] py-0.5 hover:bg-white/10 rounded transition-colors cursor-default">
                        <span className="text-[7.5px] font-black drop-shadow-sm leading-tight">
                          {dateDisplay}<span className="font-medium text-[6.5px]">({dayName})</span>
                        </span>
                        {getWeatherIcon(day.weatherCode, "w-3.5 h-3.5")}
                        <div className="flex gap-0.5 text-[7.5px] font-bold drop-shadow-sm">
                          <span>{day.tempMax}°</span>
                          <span className="opacity-60">{day.tempMin}°</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
            </div>

          </div>
        ) : null}
      </div>
    </div>
  );
}