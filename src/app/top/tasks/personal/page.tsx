"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import * as LucideIcons from "lucide-react";
import { Search, Calendar as CalendarIcon, User as UserIcon, AlertTriangle, Users, KanbanSquare, Star, Clock, Plus, ChevronDown, CheckSquare,Printer} from "lucide-react";
import LoadingScreen from "@/components/LoadingScreen";

type UserData = { id: string; name: string; schoolId: string; role: string; };
type TaskStatus = "not_started" | "in_progress" | "waiting" | "pending" | "done";

type Task = {
  id: string; title: string; status: TaskStatus; dueDate: string | null; dueTime?: string | null;
  completedAt?: string | null; // ★ 完了日を追加
  assignees: string[]; leaderId: string | null; createdAt: string;
};

const STATUS_CONFIG: Record<TaskStatus, { label: string, color: string }> = {
  not_started: { label: "未着手", color: "bg-gray-100 text-gray-700 border-gray-300" },
  in_progress: { label: "進行中", color: "bg-blue-100 text-blue-700 border-blue-300" },
  waiting: { label: "確認待ち", color: "bg-amber-100 text-amber-700 border-amber-300" },
  pending: { label: "保留", color: "bg-purple-100 text-purple-700 border-purple-300" },
  done: { label: "完了", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
};

function CustomSelect({ value, options, onChange, className, ringClass, dropUp = false }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clickOut = (e: any) => { if(ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener("mousedown", clickOut); 
    return () => document.removeEventListener("mousedown", clickOut);
  }, []);

  const sel = options.find((o:any) => o.value === value);

  return (
    <div className="relative z-20 w-full" ref={ref}>
      <div 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
        className={`w-full flex justify-between items-center bg-white border rounded px-1.5 py-1 text-[10px] font-bold cursor-pointer transition-all ${className} ${isOpen ? `ring-1 ${ringClass} border-transparent shadow-sm` : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
      >
        <span className="truncate">{sel?.label || ""}</span>
        <ChevronDown className={`w-3 h-3 text-gray-400 ml-1 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <div className={`absolute left-0 w-full ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'} bg-white border border-gray-200 rounded shadow-xl z-50 overflow-y-auto max-h-40 custom-scrollbar p-0.5`}>
          {options.map((o:any) => (
            <div 
              key={o.value} 
              onClick={(e) => { e.stopPropagation(); onChange(o.value); setIsOpen(false); }} 
              className={`px-1.5 py-1 text-[10px] font-bold cursor-pointer rounded transition-colors truncate ${o.value === value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PersonalTasksPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]);
  const [hasPermission, setHasPermission] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
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
          const roleKey = data.role || "guest";
          const perms = schoolData.appPermissions?.["tasks"] || tasksApp.defaultRoles;
          if (perms && perms[roleKey] === false) allowed = false;

          if (!allowed) { setHasPermission(false); setIsLoading(false); return; }

          const qUsers = query(collection(db, "users"), where("schoolId", "==", data.schoolId));
          const usersSnap = await getDocs(qUsers);
          const usersList: UserData[] = [];
          usersSnap.forEach(d => usersList.push({ id: d.id, ...d.data() } as UserData));

          usersList.sort((a, b) => {
            if (a.id === data.id) return -1;
            if (b.id === data.id) return 1;
            return a.name.localeCompare(b.name, "ja");
          });
          setTenantUsers(usersList);

          const qTasks = query(collection(db, "tasks"), where("schoolId", "==", data.schoolId));
          unsubTasks = onSnapshot(qTasks, (snapshot) => {
            const fetched: Task[] = [];
            snapshot.forEach((d) => {
              const td = d.data();
              fetched.push({
                id: d.id, title: td.title, status: td.status || "not_started",
                dueDate: td.dueDate || null, dueTime: td.dueTime || null,
                completedAt: td.completedAt || null,
                assignees: td.assignees || [], leaderId: td.leaderId || null,
                createdAt: td.createdAt ? td.createdAt.toDate().toISOString() : new Date().toISOString(),
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

  const isOverdue = (dueDate: string | null, dueTime: string | null | undefined, status: string) => {
    if (!dueDate || status === "done") return false;
    const now = new Date();
    const [year, month, day] = dueDate.split('-').map(Number);
    let hour = 23, minute = 59, second = 59;
    if (dueTime) { const [h, m] = dueTime.split(':').map(Number); hour = h; minute = m; second = 0; }
    const due = new Date(year, month - 1, day, hour, minute, second);
    return due < now;
  };

  const filteredUsers = tenantUsers.filter(u => {
    if (selectedUserId === "me" && u.id !== userData?.id) return false;
    if (selectedUserId !== "all" && selectedUserId !== "me" && u.id !== selectedUserId) return false;
    if (searchQuery && !u.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const memberOptions = [
    { value: "all", label: "全メンバー表示" },
    { value: "me", label: "自分のみ表示" },
    ...tenantUsers.map(u => ({ value: u.id, label: u.name }))
  ];

  if (isLoading) return <LoadingScreen message="タスクを準備中..." />;
  if (!hasPermission) return <div className="h-[100dvh] flex flex-col items-center justify-center p-4"><AlertTriangle className="w-12 h-12 text-red-500 mb-4" /><h1 className="text-xl font-black">アクセス権限がありません</h1></div>;

  return (
    <div className="h-[100dvh] flex-1 w-full bg-[#F9FAFB] font-sans flex flex-col text-gray-900 overflow-hidden relative min-h-0 overscroll-none">

      <div className="px-2 sm:px-6 py-1.5 sm:py-2 border-b border-gray-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 flex-shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg shadow-2xs"><Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></div>
          <div><h1 className="text-[11px] sm:text-xs font-black text-gray-900 tracking-tight">個人別タスク一覧</h1></div>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto custom-scrollbar whitespace-nowrap">
        <button onClick={() => router.push("/top/tasks")} className="px-2 py-1 text-[10px] font-bold text-gray-600 hover:text-gray-900 rounded-md transition-colors flex items-center gap-1">
    <KanbanSquare className="w-3 h-3" /> カンバン
  </button>
  <button className="px-2 py-1 text-[10px] font-bold bg-white text-indigo-600 rounded-md shadow-2xs flex items-center gap-1">
    <Users className="w-3 h-3" /> パーソナル
  </button>
  <button onClick={() => router.push("/top/tasks/timeline")} className="px-2 py-1 text-[10px] font-bold text-gray-600 hover:text-gray-900 rounded-md transition-colors flex items-center gap-1">
    <Clock className="w-3 h-3" /> タイムライン
  </button>
  <button onClick={() => router.push("/top/tasks/print")} className="px-2 py-1 text-[10px] font-bold text-gray-600 hover:text-gray-900 rounded-md transition-colors flex items-center gap-1">
    <Printer className="w-3 h-3" /> 出力
  </button>          </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full flex flex-col min-h-0">
        
        <div className="px-2 sm:px-4 py-1.5 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <div className="relative flex-1 max-w-[140px]">
              <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input type="text" placeholder="名前検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-5 pr-1.5 py-1 bg-gray-50 border border-gray-200 rounded-md text-[16px] sm:text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs" />
            </div>
            <div className="flex-1 max-w-[140px]">
              <CustomSelect 
                value={selectedUserId} 
                onChange={(val: any) => setSelectedUserId(val)}
                options={memberOptions}
                className="py-1 bg-gray-50"
                ringClass="ring-indigo-500"
              />
            </div>
          </div>
          <button 
            onClick={() => setShowCompleted(!showCompleted)} 
            className={`px-2 py-1 text-[9px] font-bold rounded-md border shadow-2xs flex items-center gap-1 transition-colors ${showCompleted ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
          >
            <CheckSquare className="w-3 h-3" /> 完了済を表示
          </button>
        </div>

        <div className="flex-1 p-2 sm:p-4 overflow-y-auto custom-scrollbar pb-20 md:pb-6 space-y-2.5">
          {filteredUsers.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400 border border-gray-200"><Users className="w-8 h-8 mx-auto mb-2 opacity-20" /><p className="text-[10px] font-bold">該当するメンバーがいません</p></div>
          ) : (
            filteredUsers.map(u => {
              const userTasks = tasks.filter(t => t.assignees.includes(u.id));
              const displayTasks = userTasks.filter(t => showCompleted || t.status !== "done");
              const doneCount = userTasks.filter(t => t.status === "done").length;
              const progressRate = userTasks.length > 0 ? Math.round((doneCount / userTasks.length) * 100) : 0;
              const isCurrentUser = u.id === userData?.id;

              return (
                <div key={u.id} className={`bg-white rounded-xl border transition-all overflow-hidden ${isCurrentUser ? 'border-indigo-400 shadow-sm ring-1 ring-indigo-100' : 'border-gray-200 shadow-2xs'}`}>
                  
                  <div className="px-2 py-1.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-2xs ${isCurrentUser ? 'bg-indigo-600' : 'bg-gray-400'}`}>{u.name.charAt(0)}</div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <h3 className="text-[11px] font-black text-gray-900">{u.name}</h3>
                          {isCurrentUser && <span className="px-1 py-0.5 text-[7px] font-black bg-indigo-600 text-white rounded-sm leading-none">あなた</span>}
                        </div>
                        <span className="text-[9px] font-bold text-gray-500">進捗: {progressRate}% ({doneCount}/{userTasks.length})</span>
                      </div>
                    </div>

                    <button onClick={() => router.push(`/top/tasks/new?assignee=${u.id}`)} className="px-2 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-indigo-600 rounded-md text-[9px] font-bold transition-colors flex items-center gap-0.5 shadow-2xs">
                      <Plus className="w-2.5 h-2.5" /> 追加
                    </button>
                  </div>

                  <div className="p-2 overflow-x-auto custom-scrollbar snap-x snap-mandatory">
                    {displayTasks.length === 0 ? (
                      <p className="text-[9px] font-bold text-gray-400 py-2 text-center border border-dashed border-gray-100 rounded-lg">表示するタスクはありません</p>
                    ) : (
                      <div className="flex gap-2 min-w-max pb-1">
                        {displayTasks.map(t => {
                          const overdue = isOverdue(t.dueDate, t.dueTime, t.status);
                          return (
                            <div key={t.id} onClick={() => router.push(`/top/tasks/detail/${t.id}`)} className={`w-[200px] shrink-0 snap-center p-2 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5 relative ${overdue ? 'bg-red-50/80 border-red-300 shadow-sm' : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md'}`}>
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-1">
                                  <span className={`px-1.5 py-0.5 rounded-sm text-[8px] font-bold border ${STATUS_CONFIG[t.status].color}`}>{STATUS_CONFIG[t.status].label}</span>
                                  {t.leaderId === u.id && <span className="px-1 py-0.5 rounded-sm text-[8px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center"><Star className="w-2 h-2 mr-0.5 fill-current" /> 主任</span>}
                                </div>
                                {overdue && <span className="text-[8px] font-black text-red-600 flex items-center animate-pulse"><AlertTriangle className="w-2 h-2 mr-0.5" /> 超過</span>}
                              </div>
                              <h4 className={`text-[10px] font-black leading-tight truncate ${t.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{t.title}</h4>
                              <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-[9px] font-bold text-gray-500">
                                {t.dueDate ? (
                                  <span className={`flex items-center gap-0.5 ${overdue ? 'text-red-700 font-black' : ''}`}><CalendarIcon className="w-2.5 h-2.5" /> {new Date(t.dueDate).toLocaleDateString('ja-JP', {month:'short', day:'numeric'})} {t.dueTime || ""}</span>
                                ) : (<span>期限未設定</span>)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}