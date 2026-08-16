"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, AlertOctagon, Activity, Radio, X, ExternalLink } from "lucide-react";
import { SchoolData } from "../page";

type Props = {
  schoolData: SchoolData | null;
};

type DisasterAlert = {
  id: string;
  type: "earthquake" | "tsunami" | "weather" | "evacuation";
  level: "emergency" | "warning" | "advisory";
  title: string;
  description: string;
  time: string;
  source: string;
};

export default function DisasterAlertWidget({ schoolData }: Props) {
  const [alerts, setAlerts] = useState<DisasterAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hiddenAlerts, setHiddenAlerts] = useState<Set<string>>(new Set());

  const locationName = schoolData?.location || "熊本県熊本市";

  useEffect(() => {
    try {
      const stored = localStorage.getItem("scps_hidden_disasters");
      if (stored) {
        setHiddenAlerts(new Set(JSON.parse(stored)));
      }
    } catch (e) {
      console.error("Local storage read error", e);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchDisasterData = async () => {
      try {
        setIsLoading(true);
        // ★ 自作のプロキシAPIを叩く
        const quakeRes = await fetch("/api/disaster/quake");
        if (!quakeRes.ok) throw new Error("Failed to fetch quake data");
        const quakeData = await quakeRes.json();
        
        const fetchedAlerts: DisasterAlert[] = [];

        if (quakeData && quakeData.length > 0) {
          const latest = quakeData[0]; 
          const maxInt = latest.maxi; 
          
          if (maxInt) {
            const isInt3OrMore = 
              maxInt.includes("3") || maxInt.includes("4") || 
              maxInt.includes("5") || maxInt.includes("6") || maxInt.includes("7");

            if (isInt3OrMore) {
              const isEmergency = maxInt.includes("5") || maxInt.includes("6") || maxInt.includes("7");
              const uniqueAlertId = latest.eid && latest.at ? `${latest.eid}_${latest.at}` : `eq_${Date.now()}`;

              fetchedAlerts.push({
                id: uniqueAlertId,
                type: "earthquake",
                level: isEmergency ? "emergency" : "warning",
                title: isEmergency ? "【緊急地震速報】強い揺れに警戒" : "【地震情報】震度3以上の地震",
                description: `震源地: ${latest.en || "不明"} / 最大震度: ${maxInt.replace("-", "弱").replace("+", "強")}\n今後の情報に注意し、身の安全を確保してください。`,
                time: latest.at || new Date().toISOString(),
                source: "気象庁 地震火山部"
              });
            }
          }
        }

        if (isMounted) setAlerts(fetchedAlerts);
      } catch (error) {
        console.error("Disaster API Fetch Error:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDisasterData();
    const intervalId = setInterval(fetchDisasterData, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [locationName]);

  const handleDismiss = (id: string) => {
    setHiddenAlerts(prev => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem("scps_hidden_disasters", JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error("Local storage save error", e);
      }
      return next;
    });
  };

  const getAlertUI = (alert: DisasterAlert) => {
    if (alert.level === "emergency") {
      return {
        bg: "bg-red-600", border: "border-red-700", text: "text-white",
        iconBg: "bg-red-800/40 text-white", icon: <AlertOctagon className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />,
        pulse: "shadow-lg shadow-red-600/30"
      };
    }
    if (alert.level === "warning") {
      return {
        bg: "bg-amber-500", border: "border-amber-600", text: "text-white",
        iconBg: "bg-amber-600/50 text-white", icon: <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />,
        pulse: "shadow-md shadow-amber-500/20"
      };
    }
    return {
      bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-900",
      iconBg: "bg-yellow-200 text-yellow-700", icon: <Activity className="w-4 h-4 sm:w-5 sm:h-5" />,
      pulse: "shadow-sm"
    };
  };

  const visibleAlerts = alerts.filter(a => !hiddenAlerts.has(a.id));

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 w-full mb-4 relative z-40 animate-fade-in">
      {visibleAlerts.map(alert => {
        const ui = getAlertUI(alert);
        return (
          <div 
            key={alert.id} 
            // ★ スマホでも横並び（flex-row）を維持し、コンパクトに表示
            className={`w-full rounded-xl sm:rounded-2xl border flex relative overflow-hidden transition-all ${ui.bg} ${ui.border} ${ui.text} ${ui.pulse}`}
          >
            {/* 左側：アイコンエリア */}
            <div className={`w-12 sm:w-16 flex flex-col items-center justify-center shrink-0 ${ui.iconBg}`}>
              {ui.icon}
              <span className="text-[8px] sm:text-[10px] font-black mt-1 uppercase tracking-widest hidden sm:block">{alert.type}</span>
            </div>

            {/* 中央：テキスト情報 */}
            <div className="p-3 sm:p-4 flex-1 flex flex-col justify-center pr-10 sm:pr-12 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xs sm:text-base font-black tracking-tight leading-tight truncate">
                  {alert.title}
                </h2>
                {alert.level === "emergency" && (
                  <span className="hidden sm:inline-block px-1.5 py-0.5 bg-white text-red-700 text-[10px] font-black rounded shadow-sm shrink-0">
                    命を守る行動を
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-xs font-bold opacity-90 leading-relaxed whitespace-pre-wrap line-clamp-2 sm:line-clamp-none">
                {alert.description}
              </p>
              
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pt-2 border-t border-black/10">
                <span className="text-[9px] sm:text-[10px] font-bold opacity-80 flex items-center">
                  <Radio className="w-3 h-3 mr-1" /> {alert.source}
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold opacity-80">
                  発表: {new Date(alert.time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <a href="https://www.jma.go.jp/bosai/" target="_blank" rel="noopener noreferrer" className="ml-auto text-[9px] sm:text-[10px] font-black underline flex items-center hover:opacity-70 transition-opacity">
                  詳細 <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
            </div>

            {/* 右上：閉じるボタン */}
            <button 
              onClick={() => handleDismiss(alert.id)}
              className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 p-1.5 rounded-full hover:bg-black/10 transition-colors"
              title="今後この情報を表示しない"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 opacity-70 hover:opacity-100" />
            </button>
          </div>
        );
      })}
    </div>
  );
}