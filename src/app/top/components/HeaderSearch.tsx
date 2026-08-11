"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, limit, orderBy, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import * as LucideIcons from "lucide-react";
import { 
  Search, Loader2, ChevronRight, X
} from "lucide-react";

type SearchResult = {
  id: string;
  type: string; 
  title: string;
  subtitle: string;
  url: string;
  date: Date;
};

// アプリのカラー定義（サイドバーやインボックスと共通）
const APP_COLORS: Record<string, { color: string, bg: string }> = {
  indigo: { color: "text-indigo-600", bg: "bg-indigo-50" },
  blue: { color: "text-blue-600", bg: "bg-blue-50" },
  emerald: { color: "text-emerald-600", bg: "bg-emerald-50" },
  green: { color: "text-emerald-600", bg: "bg-emerald-50" },
  purple: { color: "text-purple-600", bg: "bg-purple-50" },
  orange: { color: "text-orange-600", bg: "bg-orange-50" },
  rose: { color: "text-rose-600", bg: "bg-rose-50" },
  amber: { color: "text-amber-600", bg: "bg-amber-50" },
  cyan: { color: "text-cyan-600", bg: "bg-cyan-50" },
  sky: { color: "text-sky-600", bg: "bg-sky-50" },
  teal: { color: "text-teal-600", bg: "bg-teal-50" },
  violet: { color: "text-violet-600", bg: "bg-violet-50" },
  pink: { color: "text-pink-600", bg: "bg-pink-50" },
  slate: { color: "text-slate-600", bg: "bg-slate-100" },
  default: { color: "text-gray-600", bg: "bg-gray-100" }
};

export default function HeaderSearch() {
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  
  const [userData, setUserData] = useState<any>(null);
  const [schoolData, setSchoolData] = useState<any>(null);
  const [systemApps, setSystemApps] = useState<any[]>([]);

  // 1. ユーザー情報およびテナント設定・アプリマスタの取得
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const uSnap = await getDocs(query(collection(db, "users"), where("id", "==", user.uid)));
          let uData: any = null;
          if (!uSnap.empty) {
            uData = { id: user.uid, ...uSnap.docs[0].data() };
          } else {
            const uDoc = await getDoc(doc(db, "users", user.uid));
            if (uDoc.exists()) uData = { id: user.uid, ...uDoc.data() };
          }

          if (uData) {
            setUserData(uData);
            if (uData.schoolId) {
              const sDoc = await getDoc(doc(db, "schools", uData.schoolId));
              if (sDoc.exists()) setSchoolData(sDoc.data());
            }
          }

          // アプリマスタ取得
          const appsSnap = await getDocs(collection(db, "apps"));
          if (!appsSnap.empty) {
            setSystemApps(appsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          } else {
            const sysAppsSnap = await getDocs(collection(db, "system_apps"));
            setSystemApps(sysAppsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        } catch (e) {
          console.error("検索用マスタの取得失敗:", e);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. 外部クリックでドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 日付データを安全にパースする関数
  const parseDate = (dateVal: any): Date => {
    if (!dateVal) return new Date();
    if (typeof dateVal.toDate === 'function') return dateVal.toDate();
    return new Date(dateVal);
  };

  // 文字列の安全な部分一致チェック
  const safeIncludes = (text: any, q: string) => {
    if (typeof text !== 'string') return false;
    return text.toLowerCase().includes(q);
  };

  // テナントのカスタム名やシステムマスタから設定情報を取得
  const getAppConfig = (appId: string) => {
    if (appId === "user") {
      return { icon: LucideIcons.User, color: APP_COLORS.default.color, bg: APP_COLORS.default.bg, label: "ユーザー" };
    }
    if (appId === "category") {
      return { icon: LucideIcons.Tags, color: APP_COLORS.teal.color, bg: APP_COLORS.teal.bg, label: "カテゴリ・設定" };
    }

    const normAppId = appId === "task" ? "tasks" : (appId === "equipment" ? "equipment" : appId);

    const appMeta = systemApps.find(a => a.id === normAppId || a.appId === normAppId);
    let iconName = appMeta?.icon || "Search";
    let colorKey = appMeta?.color || "default";
    let defaultLabel = appMeta?.displayName || appMeta?.name || normAppId;

    if (!appMeta) {
      switch (normAppId) {
        case "chat": iconName = "MessageCircle"; colorKey = "indigo"; defaultLabel = "チャット"; break;
        case "board": iconName = "FileText"; colorKey = "emerald"; defaultLabel = "連絡事項"; break;
        case "tasks": iconName = "CheckSquare"; colorKey = "amber"; defaultLabel = "タスク"; break;
        case "equipment": iconName = "Package"; colorKey = "blue"; defaultLabel = "備品管理"; break;
        case "system": iconName = "Settings"; colorKey = "slate"; defaultLabel = "システム"; break;
      }
    }

    const customName = schoolData?.customAppNames?.[normAppId];
    const label = customName || defaultLabel;
    const colors = APP_COLORS[colorKey] || APP_COLORS.default;
    const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.Search;

    return { icon: IconComponent, color: colors.color, bg: colors.bg, label };
  };

  // 3. 検索ロジック
  useEffect(() => {
    if (!searchQuery.trim() || !userData?.schoolId) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const qStr = searchQuery.toLowerCase();
        const foundItems: SearchResult[] = [];
        const schoolId = userData.schoolId;

        const boardQ = query(collection(db, "announcements"), where("schoolId", "==", schoolId), orderBy("createdAt", "desc"), limit(50));
        const taskQ = query(collection(db, "tasks"), where("schoolId", "==", schoolId), orderBy("createdAt", "desc"), limit(50));
        const sysQ = query(collection(db, "system_messages"), where("schoolId", "in", [schoolId, "SYSTEM"]), orderBy("createdAt", "desc"), limit(30));
        const equipQ = query(collection(db, "equipments"), where("schoolId", "==", schoolId), limit(50));
        const chatQ = query(collection(db, "chat_rooms"), where("schoolId", "==", schoolId), where("members", "array-contains", userData.id), limit(50));
        const userQ = query(collection(db, "users"), where("schoolId", "==", schoolId), limit(50));
        const extUserQ = query(collection(db, "external_users"), where("schoolId", "==", schoolId), limit(50));
        const catQ = query(collection(db, "equipment_categories"), where("schoolId", "==", schoolId));

        const [
          boardSnap, taskSnap, sysSnap, equipSnap, chatSnap, userSnap, extUserSnap, catSnap
        ] = await Promise.all([
          getDocs(boardQ), getDocs(taskQ), getDocs(sysQ), getDocs(equipQ), 
          getDocs(chatQ), getDocs(userQ), getDocs(extUserQ), getDocs(catQ)
        ]);

        boardSnap.forEach(docSnap => {
          const d = docSnap.data();
          if (safeIncludes(d.title, qStr) || safeIncludes(d.content, qStr)) {
            foundItems.push({
              id: docSnap.id, type: "board", title: d.title || "無題",
              subtitle: d.content ? d.content.substring(0, 40).replace(/\n/g, ' ') + "..." : "",
              url: `/top/board?tab=list&viewId=${docSnap.id}`, 
              date: parseDate(d.createdAt)
            });
          }
        });

        taskSnap.forEach(docSnap => {
          const d = docSnap.data();
          if (safeIncludes(d.title, qStr) || safeIncludes(d.description, qStr)) {
            foundItems.push({
              id: docSnap.id, type: "tasks", title: d.title || "無題",
              subtitle: d.description ? d.description.substring(0, 40).replace(/\n/g, ' ') + "..." : "",
              url: `/top/tasks/detail/${docSnap.id}`,
              date: parseDate(d.createdAt)
            });
          }
        });

        sysSnap.forEach(docSnap => {
          const d = docSnap.data();
          if (safeIncludes(d.title, qStr) || safeIncludes(d.content, qStr)) {
            foundItems.push({
              id: docSnap.id, type: "system", title: d.title || "無題",
              subtitle: d.content ? d.content.substring(0, 40).replace(/\n/g, ' ') + "..." : "",
              url: `/top?msgId=${docSnap.id}`,
              date: parseDate(d.createdAt)
            });
          }
        });

        equipSnap.forEach(docSnap => {
          const d = docSnap.data();
          if (safeIncludes(d.name, qStr) || safeIncludes(d.managementId, qStr) || safeIncludes(d.conditionNote, qStr)) {
            foundItems.push({
              id: docSnap.id, type: "equipment", title: d.name || "名称未設定",
              subtitle: `管理ID: ${d.managementId || "なし"} | 状態: ${d.condition === "good" ? "良好" : (d.conditionNote || "異常あり")}`,
              url: `/top/equipment?tab=inventory`,
              date: parseDate(d.createdAt)
            });
          }
        });

        catSnap.forEach(docSnap => {
          const d = docSnap.data();
          if (safeIncludes(d.name, qStr)) {
            foundItems.push({
              id: docSnap.id, type: "category", title: d.name,
              subtitle: "備品カテゴリ・設定",
              url: `/top/equipment?tab=categories`,
              date: parseDate(d.createdAt)
            });
          }
        });

        chatSnap.forEach(docSnap => {
          const d = docSnap.data();
          if (safeIncludes(d.name, qStr)) {
            foundItems.push({
              id: docSnap.id, type: "chat", title: d.name,
              subtitle: "トーク・チャットグループ",
              url: `/top/chat?room=${docSnap.id}`,
              date: parseDate(d.updatedAt || d.createdAt)
            });
          }
        });

        userSnap.forEach(docSnap => {
          const d = docSnap.data();
          if (safeIncludes(d.name, qStr) || safeIncludes(d.email, qStr)) {
            foundItems.push({
              id: docSnap.id, type: "user", title: d.name || "名無し",
              subtitle: `${d.role === "teacher" ? "教職員" : "生徒"} | ${d.email || "メールなし"}`,
              url: `/top/chat`,
              date: parseDate(d.createdAt)
            });
          }
        });
        extUserSnap.forEach(docSnap => {
          const d = docSnap.data();
          if (safeIncludes(d.name, qStr) || safeIncludes(d.affiliation, qStr)) {
            foundItems.push({
              id: docSnap.id, type: "user", title: d.name || "名無し",
              subtitle: `[外部ユーザー] ${d.affiliation || "所属なし"}`,
              url: `/top/chat`,
              date: parseDate(d.createdAt)
            });
          }
        });

        foundItems.sort((a, b) => b.date.getTime() - a.date.getTime());
        setResults(foundItems.slice(0, 30));

      } catch (error) {
        console.error("検索エラー:", error);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, userData]);

  const handleResultClick = (url: string) => {
    setIsOpen(false);
    setSearchQuery("");
    router.push(url);
  };

  return (
    <div className="relative" ref={searchRef}>
      {/* 検索入力フィールド */}
      <div className="relative flex items-center">
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" /> : <Search className="w-3.5 h-3.5" />}
        </div>
        <input 
          type="text" 
          placeholder="検索..." 
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (searchQuery.trim() || results.length > 0) setIsOpen(true);
          }}
          /* ★ 変更箇所：
             ・w-32 -> w-[140px] にして少し幅を拡張。PC表示で w-56, w-72 などに広がるように。
             ・プレースホルダーを小さくし（text-[11px]等）、文字サイズが強制16pxで巨大化するのをリセット（!text-[13px]） 
          */
          className="w-[140px] sm:w-48 md:w-56 lg:w-72 pl-8 pr-7 py-1.5 bg-gray-50 hover:bg-gray-100 focus:bg-white border border-transparent focus:border-indigo-300 rounded-full font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner placeholder:text-gray-400 placeholder:font-medium !text-[13px]"
        />
        {searchQuery && (
          <button 
            onClick={() => { setSearchQuery(""); setResults([]); setIsOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 検索結果ドロップダウン */}
      {isOpen && searchQuery.trim() !== "" && (
        <div className="fixed sm:absolute top-12 sm:top-full left-2 right-2 sm:left-auto sm:right-0 sm:mt-2 sm:w-[380px] bg-white border border-gray-200 rounded-2xl shadow-2xl z-[100] flex flex-col overflow-hidden animate-fade-in origin-top">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center">
            <span className="text-[11px] font-black text-gray-700 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-indigo-500" />
              「{searchQuery}」の検索結果
            </span>
            <span className="text-[10px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded-md border border-gray-200">
              {results.length}件
            </span>
          </div>

          {/* スマホで全画面になってもスクロールできるように高さを max-h-[60vh] 程度に制限 */}
          <div className="max-h-[60vh] sm:max-h-[400px] overflow-y-auto custom-scrollbar divide-y divide-gray-50">
            {isLoading ? (
              <div className="p-8 flex flex-col items-center justify-center text-gray-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <p className="text-[10px] font-bold">全体を検索中...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="p-8 flex flex-col items-center justify-center text-gray-400 gap-2">
                <Search className="w-8 h-8 opacity-20" />
                <p className="text-[11px] font-bold">一致する情報は見つかりませんでした</p>
                <p className="text-[9px] font-medium mt-1">別のキーワードでお試しください</p>
              </div>
            ) : (
              results.map((result) => {
                const conf = getAppConfig(result.type);
                const IconComponent = conf.icon;
                return (
                  <div 
                    key={result.id} 
                    onClick={() => handleResultClick(result.url)}
                    className="p-3 hover:bg-indigo-50/40 transition-colors cursor-pointer group flex gap-3 items-start"
                  >
                    <div className={`p-2 rounded-xl mt-0.5 flex-shrink-0 border border-black/5 ${conf.bg} ${conf.color}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border border-current/20 ${conf.color} bg-white`}>
                          {conf.label}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 ml-auto">
                          {result.date.toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                        {result.title}
                      </h4>
                      <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5 leading-relaxed font-medium">
                        {result.subtitle}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 self-center shrink-0 transition-colors" />
                  </div>
                );
              })
            )}
          </div>
          
          {results.length > 0 && (
            <div className="p-2 border-t border-gray-100 bg-gray-50 text-center text-[10px] font-bold text-gray-400">
              最新のデータから検索しています
            </div>
          )}
        </div>
      )}
    </div>
  );
}