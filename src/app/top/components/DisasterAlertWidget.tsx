"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, AlertOctagon, Activity, Radio, X, ExternalLink } from "lucide-react";
import { SchoolData } from "../page";

type Props = {
  schoolData: SchoolData | null;
};

// 災害データの型
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

  // 初回マウント時に、ローカルストレージから「非表示にしたアラートID」を読み込む
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
        // 気象庁の最新地震情報エンドポイントからデータを取得
        const quakeRes = await fetch("https://www.jma.go.jp/bosai/quake/data/list.json");
        if (!quakeRes.ok) throw new Error("Failed to fetch quake data");
        const quakeData = await quakeRes.json();
        
        const fetchedAlerts: DisasterAlert[] = [];

        if (quakeData && quakeData.length > 0) {
          const latest = quakeData[0]; 
          const maxInt = latest.maxi; // 最大震度文字列 (例: "3", "4", "5-", "5+", "6-", "6+", "7")
          
          if (maxInt) {
            // 震度3以上であるかを判定
            const isInt3OrMore = 
              maxInt.includes("3") || maxInt.includes("4") || 
              maxInt.includes("5") || maxInt.includes("6") || maxInt.includes("7");

            if (isInt3OrMore) {
              // 震度5弱以上は緊急レベル、震度3〜4は警告レベルとする
              const isEmergency = maxInt.includes("5") || maxInt.includes("6") || maxInt.includes("7");
              
              // ★重要：イベントID(eid)と発表日時(at)を組み合わせて一意のIDを作成
              // こうすることで、同じ地震でも情報が更新されたら再表示されるようになります
              const uniqueAlertId = latest.eid && latest.at ? `${latest.eid}_${latest.at}` : `eq_${Date.now()}`;

              fetchedAlerts.push({
                id: uniqueAlertId,
                type: "earthquake",
                level: isEmergency ? "emergency" : "warning",
                title: isEmergency ? "【緊急地震速報】強い揺れに警戒してください" : "【地震情報】震度3以上の地震を観測しました",
                description: `震源地: ${latest.en || "不明"} / 最大震度: ${maxInt.replace("-", "弱").replace("+", "強")}\n今後の情報に注意し、身の安全を確保してください。`,
                time: latest.at || new Date().toISOString(),
                source: "気象庁 地震火山部"
              });
            }
          }
        }

        if (isMounted) {
          setAlerts(fetchedAlerts);
        }
      } catch (error) {
        console.error("Disaster API Fetch Error:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDisasterData();
    // 60秒（1分）ごとに最新の気象庁データを自動ポーリング
    const intervalId = setInterval(fetchDisasterData, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [locationName]);

  // アラートを閉じた際に、そのIDをローカルストレージに記憶させる
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
        bg: "bg-red-600", border: "border-red-800", text: "text-white",
        iconBg: "bg-red-800/50 text-white", icon: <AlertOctagon className="w-6 h-6 animate-pulse" />,
        pulse: "animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.6)]"
      };
    }
    if (alert.level === "warning") {
      return {
        bg: "bg-amber-500", border: "border-amber-600", text: "text-gray-900",
        iconBg: "bg-amber-600/30 text-amber-900", icon: <AlertTriangle className="w-5 h-5" />,
        pulse: "shadow-md"
      };
    }
    return {
      bg: "bg-yellow-100", border: "border-yellow-300", text: "text-yellow-900",
      iconBg: "bg-yellow-200 text-yellow-700", icon: <Activity className="w-5 h-5" />,
      pulse: "shadow-sm"
    };
  };

  // 記憶された非表示リストに含まれないアラートのみを表示
  const visibleAlerts = alerts.filter(a => !hiddenAlerts.has(a.id));

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 w-full mb-4 relative z-40 animate-fade-in">
      {visibleAlerts.map(alert => {
        const ui = getAlertUI(alert);
        return (
          <div 
            key={alert.id} 
            className={`w-full rounded-2xl border-2 flex flex-col sm:flex-row overflow-hidden relative transition-all ${ui.bg} ${ui.border} ${ui.text} ${ui.pulse}`}
          >
            {/* 左側：アイコンエリア */}
            <div className={`p-4 sm:w-20 flex flex-col items-center justify-center shrink-0 ${ui.iconBg}`}>
              {ui.icon}
              <span className="text-[10px] font-black mt-1 uppercase tracking-widest">{alert.type}</span>
            </div>

            {/* 中央：テキスト情報 */}
            <div className="p-4 flex-1 flex flex-col justify-center pr-10">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-sm sm:text-base font-black tracking-tight leading-tight">
                  {alert.title}
                </h2>
                {alert.level === "emergency" && (
                  <span className="px-1.5 py-0.5 bg-white text-red-700 text-[10px] font-black rounded shadow-sm shrink-0">
                    命を守る行動を
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs font-bold opacity-90 leading-relaxed whitespace-pre-wrap">
                {alert.description}
              </p>
              
              <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-black/10">
                <span className="text-[10px] font-bold opacity-80 flex items-center">
                  <Radio className="w-3 h-3 mr-1" /> 情報元: {alert.source}
                </span>
                <span className="text-[10px] font-bold opacity-80">
                  発表: {new Date(alert.time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <a href="https://www.jma.go.jp/bosai/" target="_blank" rel="noopener noreferrer" className="ml-auto text-[10px] font-black underline flex items-center hover:opacity-70 transition-opacity">
                  詳細を見る <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
            </div>

            {/* 右上：閉じるボタン */}
            <button 
              onClick={() => handleDismiss(alert.id)}
              className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-black/10 transition-colors"
              title="今後この情報を表示しない"
            >
              <X className="w-5 h-5 opacity-70 hover:opacity-100" />
            </button>
          </div>
        );
      })}
    </div>
  );
}