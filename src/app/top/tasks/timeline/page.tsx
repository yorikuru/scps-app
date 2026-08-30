"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import * as LucideIcons from "lucide-react";
import { Search, AlertTriangle, Users, KanbanSquare, Clock, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CheckSquare ,Printer } from "lucide-react";
import LoadingScreen from "@/components/LoadingScreen";

type UserData = { id: string; name: string; schoolId: string; role: string; };
type TaskStatus = "not_started" | "in_progress" | "waiting" | "pending" | "done";
type TaskPriority = "urgent" | "high" | "medium" | "low";

type Task = {
  id: string; title: string; status: TaskStatus; priority: TaskPriority;
  startDate: string | null; dueDate: string | null; dueTime?: string | null;
  completedAt?: string | null; // ★ 完了日を追加
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

const PRIORITY_SCORE: Record<TaskPriority, number> = {
  urgent: 4, high: 3, medium: 2, low: 1
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
  const [showCompleted, setShowCompleted] = useState(false);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  
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
                id: d.id, title: td.title, status: td.status || "not_started", priority: td.priority || "medium",
                startDate: td.startDate || null, dueDate: td.dueDate || null, dueTime: td.dueTime || null,
                completedAt: td.completedAt || null,
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

  // ★ 完了済みのものは completedAt、それ以外は dueDate または startDate をバーの終了に設定してソート
  const filteredTasks = tasks
    .filter(t => {
      if (!showCompleted && t.status === "done") return false;
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const getStartDate = (t: Task) => t.startDate || t.dueDate || t.createdAt;
      const timeA = new Date(getStartDate(a)).getTime();
      const timeB = new Date(getStartDate(b)).getTime();
      
      if (timeA !== timeB) return timeA - timeB; 
      
      const pA = PRIORITY_SCORE[a.priority] || 0;
      const pB = PRIORITY_SCORE[b.priority] || 0;
      return pB - pA; 
    });

  if (isLoading) return <LoadingScreen message="タイムラインを準備中..." />;
  if (!hasPermission) return <div className="h-[100dvh] flex flex-col items-center justify-center p-4"><AlertTriangle className="w-12 h-12 text-red-500 mb-4" /><h1 className="text-xl font-black">アクセス権限がありません</h1></div>;

  return (
    <div className="h-[100dvh] flex-1 w-full bg-[#F9FAFB] font-sans flex flex-col text-gray-900 overflow-hidden relative min-h-0 overscroll-none">

      <div className="px-2 sm:px-6 py-1.5 sm:py-2 border-b border-gray-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 flex-shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg shadow-2xs"><Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></div>
          <div><h1 className="text-[11px] sm:text-xs font-black text-gray-900 tracking-tight">タイムラインガント</h1></div>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto custom-scrollbar whitespace-nowrap">
  <button onClick={() => router.push("/top/tasks")} className="px-2 py-1 text-[10px] font-bold text-gray-600 hover:text-gray-900 rounded-md transition-colors flex items-center gap-1">
    <KanbanSquare className="w-3 h-3" /> カンバン
  </button>
  <button onClick={() => router.push("/top/tasks/personal")} className="px-2 py-1 text-[10px] font-bold text-gray-600 hover:text-gray-900 rounded-md transition-colors flex items-center gap-1">
    <Users className="w-3 h-3" /> パーソナル
  </button>
  <button className="px-2 py-1 text-[10px] font-bold bg-white text-indigo-600 rounded-md shadow-2xs flex items-center gap-1">
    <Clock className="w-3 h-3" /> タイムライン
  </button>
  <button onClick={() => router.push("/top/tasks/print")} className="px-2 py-1 text-[10px] font-bold text-gray-600 hover:text-gray-900 rounded-md transition-colors flex items-center gap-1">
    <Printer className="w-3 h-3" /> 出力
  </button>
</div>      </div>

      <main className="flex-1 w-full max-w-[1600px] mx-auto flex flex-col overflow-hidden p-1.5 sm:p-4 pb-20 md:pb-6 min-h-0">
        
        <div className="px-2 py-1.5 bg-white border border-gray-200 rounded-t-lg sm:rounded-t-xl flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-sm">
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 p-0.5 rounded-lg w-full sm:w-auto justify-between sm:justify-start">
            <button onClick={() => setStartDateOffset(p => p - 7)} className="p-1.5 hover:bg-gray-200 rounded text-gray-600 transition-colors"><ChevronsLeft className="w-3.5 h-3.5" /></button>
            <button onClick={() => setStartDateOffset(p => p - 1)} className="p-1.5 hover:bg-gray-200 rounded text-gray-600 transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <button onClick={() => setStartDateOffset(0)} className="px-3 py-1 text-[10px] sm:text-xs font-bold text-gray-700 hover:bg-gray-200 rounded transition-colors flex-1 sm:flex-none text-center">今日</button>
            <button onClick={() => setStartDateOffset(p => p + 1)} className="p-1.5 hover:bg-gray-200 rounded text-gray-600 transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
            <button onClick={() => setStartDateOffset(p => p + 7)} className="p-1.5 hover:bg-gray-200 rounded text-gray-600 transition-colors"><ChevronsRight className="w-3.5 h-3.5" /></button>
          </div>
          
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px] justify-end">
            <div className="relative flex-1 max-w-[140px]">
              <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input type="text" placeholder="タスク名検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-5 pr-1.5 py-1 bg-gray-50 border border-gray-200 rounded-md text-[16px] sm:text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs" />
            </div>
            <button 
              onClick={() => setShowCompleted(!showCompleted)} 
              className={`px-2 py-1 text-[9px] font-bold rounded-md border shadow-2xs flex items-center gap-1 transition-colors ${showCompleted ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
            >
              <CheckSquare className="w-3 h-3" /> <span className="hidden sm:inline">完了済を</span>表示
            </button>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-b-lg sm:rounded-b-xl border border-gray-200 border-t-0 shadow-sm overflow-auto custom-scrollbar relative min-h-0">
          
          <div className="flex border-b border-gray-200 bg-gray-50/90 backdrop-blur sticky top-0 z-30 min-w-max">
            <div className="w-24 sm:w-48 p-1.5 sm:p-2 border-r border-gray-200 flex-shrink-0 text-[9px] sm:text-xs font-black text-gray-700 bg-gray-50/90 sticky left-0 z-40 shadow-[2px_0_5px_rgba(0,0,0,0.05)] flex items-center justify-center sm:justify-start">
              タスク / 担当
            </div>
            <div className="flex-1 flex min-w-[300px] sm:min-w-[500px]">
              {dateRange.map(d => (
                <div key={d.dateStr} className={`group flex-1 text-center py-1 sm:py-1.5 border-r border-gray-100 flex flex-col items-center justify-center relative min-w-[32px] sm:min-w-[45px] transition-colors ${d.isToday ? 'bg-indigo-50/80 font-black' : ''} ${d.isHoliday || d.isWeekend ? 'text-red-500' : 'text-gray-700'}`}>
                  
                  <div className="flex flex-col items-center transition-opacity group-hover:opacity-10">
                    <span className="text-[8px] sm:text-[9px] font-bold opacity-80">{d.monthNum}/{d.dayNum}</span>
                    <span className="text-[7px] sm:text-[8px] font-bold opacity-60">({d.dayOfWeek})</span>
                  </div>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); router.push(`/top/tasks/new?startDate=${d.dateStr}`); }}
                    className="absolute inset-0 m-auto w-4 h-4 sm:w-5 sm:h-5 rounded-md bg-indigo-100 text-indigo-600 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all shadow-sm cursor-pointer hover:bg-indigo-200"
                    title={`${d.monthNum}/${d.dayNum}のタスクを追加`}
                  >
                    <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>

                  {d.holidayName && <span className="text-[6px] sm:text-[7px] text-red-500 font-bold truncate w-full px-0.5 hidden sm:block absolute bottom-0 pb-0.5 transition-opacity group-hover:opacity-10">{d.holidayName}</span>}
                  {d.isToday && <span className="text-[6px] sm:text-[7px] bg-indigo-600 text-white px-0.5 sm:px-1 rounded font-bold mt-0.5 absolute top-0.5 right-0.5 transition-opacity group-hover:opacity-0">今</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="divide-y divide-gray-100 min-w-max pb-4">
            {filteredTasks.length === 0 ? (
              <div className="p-8 text-center text-gray-400 font-bold text-[10px] sm:text-xs sticky left-0 w-full">表示するタスクがありません</div>
            ) : (
              filteredTasks.map(t => {
                // ★ 完了済みなら completedAt、それ以外なら dueDate を使用
                const endDateToUse = t.status === "done" && t.completedAt ? t.completedAt : (t.dueDate || t.startDate || dateRange[daysCount - 1].dateStr);
                
                const sIndex = dateRange.findIndex(d => d.dateStr === (t.startDate || t.dueDate || dateRange[0].dateStr));
                const eIndex = dateRange.findIndex(d => d.dateStr === endDateToUse);

                let startIndex = sIndex === -1 ? 0 : sIndex;
                let endIndex = eIndex;
                
                // ガントの表示範囲内に収める補正
                if (eIndex === -1) {
                  const targetTime = new Date(endDateToUse).getTime();
                  const firstTime = new Date(dateRange[0].dateStr).getTime();
                  if (targetTime < firstTime) endIndex = 0;
                  else endIndex = daysCount - 1;
                }
                
                if (sIndex === -1) {
                  const targetTime = new Date(t.startDate || t.dueDate || "").getTime();
                  const firstTime = new Date(dateRange[0].dateStr).getTime();
                  if (targetTime < firstTime) startIndex = 0;
                  else startIndex = daysCount - 1;
                }

                endIndex = Math.max(startIndex, endIndex);
                const spanLength = (endIndex - startIndex) + 1;

                return (
                  <div key={t.id} onClick={() => router.push(`/top/tasks/detail/${t.id}`)} className="flex hover:bg-gray-50 transition-colors cursor-pointer group relative">
                    <div className="w-24 sm:w-48 px-1.5 py-1.5 sm:p-2 border-r border-gray-200 flex-shrink-0 flex flex-col justify-center bg-white group-hover:bg-gray-50 sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.02)] transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 mb-0.5">
                        <span className={`px-1 rounded text-[7px] font-bold ${STATUS_CONFIG[t.status].barColor} text-white w-max`}>{STATUS_CONFIG[t.status].label}</span>
                        <span className="text-[7px] sm:text-[8px] text-gray-400 font-bold truncate">
                          {t.assignees.map(aid => tenantUsers.find(u => u.id === aid)?.name.split(" ")[0]).join(", ") || "未割当"}
                        </span>
                      </div>
                      <h4 className={`text-[9px] sm:text-[11px] font-black leading-tight line-clamp-2 sm:truncate group-hover:text-indigo-600 ${t.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{t.title}</h4>
                    </div>

                    <div className="flex-1 flex relative items-center py-1 sm:py-2 min-w-[300px] sm:min-w-[500px]">
                      {dateRange.map(d => (
                        <div key={d.dateStr} className={`flex-1 h-full border-r border-gray-100/60 min-w-[32px] sm:min-w-[45px] ${d.isToday ? 'bg-indigo-50/20' : ''}`}>
                        </div>
                      ))}

                      {/* ガントチャートのバー */}
                      <div 
                        className={`absolute h-4 sm:h-6 rounded-md shadow-sm border border-white/40 flex items-center px-1.5 text-[8px] sm:text-[9px] font-black text-white truncate transition-transform hover:scale-[1.02] ${STATUS_CONFIG[t.status].barColor} pointer-events-none`}
                        style={{ left: `${(startIndex / daysCount) * 100}%`, width: `${(spanLength / daysCount) * 100}%` }}
                      >
                        {spanLength > 1 && t.title}
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