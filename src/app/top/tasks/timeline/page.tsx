"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import * as LucideIcons from "lucide-react";
import { ArrowLeft, Search, AlertTriangle, Users, KanbanSquare, Loader2, Clock, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

type UserData = { id: string; name: string; schoolId: string; role: string; };
type TaskStatus = "not_started" | "in_progress" | "waiting" | "pending" | "done";

type Task = {
  id: string; title: string; status: TaskStatus;
  startDate: string | null; dueDate: string | null; dueTime?: string | null;
  assignees: string[]; createdAt: string;
};

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

const STATUS_CONFIG: Record<TaskStatus, { label: string, barColor: string }> = {
  not_started: { label: "未着手", barColor: "bg-gray-400" },
  in_progress: { label: "進行中", barColor: "bg-blue-500" },
  waiting: { label: "確認待ち", barColor: "bg-amber-500" },
  pending: { label: "保留", barColor: "bg-purple-500" },
  done: { label: "完了", barColor: "bg-emerald-500 opacity-60" },
};

export default function TimelineTasksPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]);
  const [hasPermission, setHasPermission] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [appConfig, setAppConfig] = useState({ name: "タスク管理", icon: "CheckSquare", color: "indigo" });
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  
  // スマホ: 7日, PC: 14日
  const [daysCount, setDaysCount] = useState(14);
  const [startDateOffset, setStartDateOffset] = useState(0);

  useEffect(() => {
    const handleResize = () => setDaysCount(window.innerWidth < 768 ? 7 : 14);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const dateRange = Array.from({ length: daysCount }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + startDateOffset + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const actualToday = new Date();
    const isToday = d.getFullYear() === actualToday.getFullYear() && d.getMonth() === actualToday.getMonth() && d.getDate() === actualToday.getDate();

    return {
      dateStr, dayNum: d.getDate(), monthNum: d.getMonth() + 1,
      dayOfWeek: ["日", "月", "火", "水", "木", "金", "土"][d.getDay()],
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday, isHoliday: !!holidays[dateStr], holidayName: holidays[dateStr],
    };
  });

  useEffect(() => {
    fetch("https://holidays-jp.github.io/api/v1/date.json")
      .then(res => res.json()).then(data => setHolidays(data)).catch(console.error);

    let unsubTasks: () => void;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocSnap = await getDoc(doc(db, "users", user.uid));
          if (!userDocSnap.exists()) { router.push("/login"); return; }
          const data = { id: user.uid, ...userDocSnap.data() } as any;
          setUserData(data);

          const schoolDocSnap = await getDoc(doc(db, "schools", data.schoolId));
          const schoolData = schoolDocSnap.exists() ? schoolDocSnap.data() as any : {};

          const qApps = query(collection(db, "system_apps"), where("appId", "==", "tasks"));
          const appsSnap = await getDocs(qApps);
          let tasksApp: any = appsSnap.empty ? { appId: "tasks", isActive: true } : appsSnap.docs[0].data();

          let allowed = true;
          if (!tasksApp.isActive) allowed = false;
          if (schoolData.availableModules && !schoolData.availableModules.includes("tasks")) allowed = false;
          if (!allowed) { setHasPermission(false); setIsLoading(false); return; }

          setAppConfig({
            name: (schoolData.customAppNames?.["tasks"] || tasksApp.name || "タスク管理").trim(),
            icon: tasksApp.icon || "CheckSquare", color: tasksApp.color || "indigo"
          });

          const qUsers = query(collection(db, "users"), where("schoolId", "==", data.schoolId));
          const usersSnap = await getDocs(qUsers);
          const usersList: UserData[] = [];
          usersSnap.forEach(d => usersList.push({ id: d.id, ...d.data() } as UserData));
          setTenantUsers(usersList);

          const qTasks = query(collection(db, "tasks"), where("schoolId", "==", data.schoolId));
          unsubTasks = onSnapshot(qTasks, (snapshot) => {
            const fetched: Task[] = [];
            snapshot.forEach((d) => {
              const td = d.data();
              fetched.push({
                id: d.id, title: td.title, status: td.status || "not_started",
                startDate: td.startDate || null, dueDate: td.dueDate || null, dueTime: td.dueTime || null,
                assignees: td.assignees || [], createdAt: td.createdAt ? td.createdAt.toDate().toISOString() : new Date().toISOString(),
              });
            });
            setTasks(fetched);
          });
          setIsLoading(false);
        } catch (error) { setIsLoading(false); }
      } else { router.push("/login"); }
    });
    return () => { unsubscribeAuth(); if (unsubTasks) unsubTasks(); };
  }, [router]);

  const filteredTasks = tasks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));

  if (isLoading) return <div className="min-h-screen bg-[#F9FAFB] flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (!hasPermission) return <div className="min-h-screen flex flex-col items-center justify-center p-4"><AlertTriangle className="w-12 h-12 text-red-500 mb-4" /><h1 className="text-xl font-black">アクセス権限がありません</h1></div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans flex flex-col text-gray-900 overflow-hidden">

      <div className="px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 bg-indigo-100 text-indigo-600 rounded-lg sm:rounded-xl shadow-2xs"><Clock className="w-4 h-4 sm:w-5 sm:h-5" /></div>
          <div><h1 className="text-sm sm:text-base font-black text-gray-900 tracking-tight">タイムラインガント</h1></div>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] whitespace-nowrap">
          <button onClick={() => router.push("/top/tasks")} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-lg transition-colors flex items-center gap-1">
            <KanbanSquare className="w-3.5 h-3.5" /> カンバン
          </button>
          <button onClick={() => router.push("/top/tasks/personal")} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-lg transition-colors flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> パーソナル
          </button>
          <button className="px-3 py-1.5 text-xs font-bold bg-white text-indigo-600 rounded-lg shadow-2xs flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> タイムライン
          </button>
        </div>
      </div>

      <main className="flex-1 flex flex-col overflow-hidden p-2 sm:p-4">
        
        {/* 操作バー（スマホで縦並び対応） */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-3">
          <div className="flex items-center gap-1 bg-white border border-gray-200 p-1 rounded-xl shadow-sm w-full sm:w-auto justify-between sm:justify-start">
            <button onClick={() => setStartDateOffset(p => p - 7)} className="p-2 sm:p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors"><ChevronsLeft className="w-4 h-4" /></button>
            <button onClick={() => setStartDateOffset(p => p - 1)} className="p-2 sm:p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setStartDateOffset(0)} className="px-4 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded transition-colors flex-1 sm:flex-none text-center">今日</button>
            <button onClick={() => setStartDateOffset(p => p + 1)} className="p-2 sm:p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={() => setStartDateOffset(p => p + 7)} className="p-2 sm:p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors"><ChevronsRight className="w-4 h-4" /></button>
          </div>
          
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" placeholder="タスク検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-2 sm:py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm" />
          </div>
        </div>

        {/* タイムライン本体 */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-auto custom-scrollbar relative">
          {/* ヘッダー（上部固定、左列固定） */}
          <div className="flex border-b border-gray-200 bg-gray-50/90 backdrop-blur sticky top-0 z-30 min-w-max">
            <div className="w-24 sm:w-48 p-2 sm:p-3 border-r border-gray-200 flex-shrink-0 text-[10px] sm:text-xs font-black text-gray-700 bg-gray-50/90 sticky left-0 z-40 shadow-[2px_0_5px_rgba(0,0,0,0.05)] flex items-center">
              タスク / 担当
            </div>
            <div className="flex-1 flex min-w-[500px]">
              {dateRange.map(d => (
                <div key={d.dateStr} className={`group flex-1 text-center py-2 border-r border-gray-100 flex flex-col items-center relative min-w-[40px] sm:min-w-[45px] ${d.isToday ? 'bg-indigo-50/80 font-black' : ''} ${d.isHoliday || d.isWeekend ? 'text-red-500' : 'text-gray-700'}`}>
                  <span className="text-[9px] font-bold opacity-80">{d.monthNum}/{d.dayNum}</span>
                  <span className="text-[8px] font-bold opacity-60">({d.dayOfWeek})</span>
                  {d.holidayName && <span className="text-[7px] text-red-500 font-bold truncate w-full px-0.5 hidden sm:block">{d.holidayName}</span>}
                  {d.isToday && <span className="text-[8px] bg-indigo-600 text-white px-1 rounded font-bold mt-0.5 absolute top-1 right-1">今</span>}
                </div>
              ))}
            </div>
          </div>

          {/* 行データ */}
          <div className="divide-y divide-gray-100 min-w-max">
            {filteredTasks.length === 0 ? (
              <div className="p-12 text-center text-gray-400 font-bold text-xs sticky left-0 w-full">表示するタスクがありません</div>
            ) : (
              filteredTasks.map(t => {
                const sIndex = dateRange.findIndex(d => d.dateStr === (t.startDate || t.dueDate || dateRange[0].dateStr));
                const eIndex = dateRange.findIndex(d => d.dateStr === (t.dueDate || t.startDate || dateRange[daysCount - 1].dateStr));

                const startIndex = sIndex === -1 ? 0 : sIndex;
                const endIndex = eIndex === -1 ? daysCount - 1 : Math.max(startIndex, eIndex);
                const spanLength = (endIndex - startIndex) + 1;

                return (
                  <div key={t.id} onClick={() => router.push(`/top/tasks/detail/${t.id}`)} className="flex hover:bg-gray-50 transition-colors cursor-pointer group relative">
                    {/* 左固定: タスク基本情報 */}
                    <div className="w-24 sm:w-48 p-2 sm:p-3 border-r border-gray-200 flex-shrink-0 flex flex-col justify-center bg-white group-hover:bg-gray-50 sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.02)] transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 mb-1">
                        <span className={`px-1 rounded text-[8px] sm:text-[9px] font-bold ${STATUS_CONFIG[t.status].barColor} text-white w-max`}>{STATUS_CONFIG[t.status].label}</span>
                        <span className="text-[8px] sm:text-[9px] text-gray-400 font-bold truncate">
                          {t.assignees.map(aid => tenantUsers.find(u => u.id === aid)?.name.split(" ")[0]).join(", ") || "未割当"}
                        </span>
                      </div>
                      <h4 className="text-[10px] sm:text-xs font-black text-gray-900 line-clamp-2 sm:truncate group-hover:text-indigo-600">{t.title}</h4>
                    </div>

                    {/* 右: カレンダーセル ＆ 期間バー */}
                    <div className="flex-1 flex relative items-center py-2 min-w-[500px]">
                      {dateRange.map(d => (
                        <div key={d.dateStr} className={`flex-1 h-full border-r border-gray-100/60 min-w-[40px] sm:min-w-[45px] ${d.isToday ? 'bg-indigo-50/20' : ''}`}>
                          {/* ★ 日付セルをクリックして新規作成 */}
                          <div 
                            onClick={(e) => { e.stopPropagation(); router.push(`/top/tasks/new?startDate=${d.dateStr}`); }}
                            className="w-full h-full opacity-0 hover:opacity-100 bg-indigo-50/50 flex items-center justify-center transition-opacity"
                          >
                            <Plus className="w-3 h-3 text-indigo-400" />
                          </div>
                        </div>
                      ))}

                      {/* ガントチャートバー */}
                      <div 
                        className={`absolute h-6 sm:h-7 rounded-lg shadow-sm border border-white/40 flex items-center px-1.5 sm:px-2 text-[9px] sm:text-[10px] font-black text-white truncate transition-transform hover:scale-[1.02] ${STATUS_CONFIG[t.status].barColor} pointer-events-none`}
                        style={{ left: `${(startIndex / daysCount) * 100}%`, width: `${(spanLength / daysCount) * 100}%` }}
                      >
                        {t.title}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

    </div>
  );
}