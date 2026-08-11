"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import * as LucideIcons from "lucide-react";
import { ArrowLeft, Search, Calendar as CalendarIcon, User as UserIcon, AlertTriangle, Users, KanbanSquare, Loader2, Star, Clock, Plus } from "lucide-react";

type UserData = { id: string; name: string; schoolId: string; role: string; };
type TaskStatus = "not_started" | "in_progress" | "waiting" | "pending" | "done";

type Task = {
  id: string; title: string; status: TaskStatus; dueDate: string | null; dueTime?: string | null;
  assignees: string[]; leaderId: string | null; createdAt: string;
};

const STATUS_CONFIG: Record<TaskStatus, { label: string, color: string }> = {
  not_started: { label: "未着手", color: "bg-gray-100 text-gray-700 border-gray-300" },
  in_progress: { label: "進行中", color: "bg-blue-100 text-blue-700 border-blue-300" },
  waiting: { label: "確認待ち", color: "bg-amber-100 text-amber-700 border-amber-300" },
  pending: { label: "保留", color: "bg-purple-100 text-purple-700 border-purple-300" },
  done: { label: "完了", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
};

export default function PersonalTasksPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]);
  const [hasPermission, setHasPermission] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredUsers = tenantUsers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (isLoading) return <div className="min-h-screen bg-[#F9FAFB] flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (!hasPermission) return <div className="min-h-screen flex flex-col items-center justify-center p-4"><AlertTriangle className="w-12 h-12 text-red-500 mb-4" /><h1 className="text-xl font-black">アクセス権限がありません</h1></div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans flex flex-col text-gray-900">

      {/* ナビゲーションサブバー */}
      <div className="px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 bg-indigo-100 text-indigo-600 rounded-lg sm:rounded-xl shadow-2xs"><Users className="w-4 h-4 sm:w-5 sm:h-5" /></div>
          <div><h1 className="text-sm sm:text-base font-black text-gray-900 tracking-tight">個人別タスク一覧</h1></div>
        </div>

        {/* スマホ横スクロール対応タブ */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] whitespace-nowrap">
          <button onClick={() => router.push("/top/tasks")} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-lg transition-colors flex items-center gap-1">
            <KanbanSquare className="w-3.5 h-3.5" /> カンバン
          </button>
          <button className="px-3 py-1.5 text-xs font-bold bg-white text-indigo-600 rounded-lg shadow-2xs flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> パーソナル
          </button>
          <button onClick={() => router.push("/top/tasks/timeline")} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-lg transition-colors flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> タイムライン
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full p-3 sm:p-4 lg:p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        <div className="relative w-full sm:w-64 self-end">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="メンバー名で検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 sm:py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm" />
        </div>

        <div className="space-y-4">
          {filteredUsers.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 sm:p-12 text-center text-gray-400 border border-gray-200"><Users className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 opacity-20" /><p className="text-xs font-bold">該当するメンバーがいません</p></div>
          ) : (
            filteredUsers.map(u => {
              const userTasks = tasks.filter(t => t.assignees.includes(u.id));
              const doneCount = userTasks.filter(t => t.status === "done").length;
              const progressRate = userTasks.length > 0 ? Math.round((doneCount / userTasks.length) * 100) : 0;
              const isCurrentUser = u.id === userData?.id;

              return (
                <div key={u.id} className={`bg-white rounded-2xl border transition-all overflow-hidden ${isCurrentUser ? 'border-indigo-400 shadow-md ring-1 ring-indigo-200' : 'border-gray-200 shadow-2xs'}`}>
                  {/* スマホで縦並びになるヘッダー */}
                  <div className="px-3 sm:px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-2xs ${isCurrentUser ? 'bg-indigo-600' : 'bg-gray-400'}`}>{u.name.charAt(0)}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-black text-gray-900">{u.name}</h3>
                          {isCurrentUser && <span className="px-1.5 py-0.2 text-[9px] font-black bg-indigo-600 text-white rounded-md">あなた</span>}
                        </div>
                        <span className="text-[10px] font-bold text-gray-400">{userTasks.length}件のタスクを担当中</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-1 sm:mt-0">
                      <button onClick={() => router.push(`/top/tasks/new?assignee=${u.id}`)} className="px-2.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 hover:text-indigo-600 rounded-lg text-[10px] font-bold text-gray-600 transition-colors flex items-center gap-1 shadow-sm"><Plus className="w-3 h-3" /> タスクを追加</button>
                      <div className="flex items-center gap-2">
                        <div className="w-24 sm:w-32 bg-gray-200 rounded-full h-2 overflow-hidden"><div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progressRate}%` }}></div></div>
                        <span className="text-[10px] font-black text-emerald-600 min-w-[36px]">{progressRate}%</span>
                      </div>
                    </div>
                  </div>

                  {/* タスク横スクロールエリア */}
                  <div className="p-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory">
                    {userTasks.length === 0 ? (
                      <p className="text-[11px] font-bold text-gray-400 py-3 text-center">現在担当しているタスクはありません</p>
                    ) : (
                      <div className="flex gap-3 min-w-max pb-2">
                        {userTasks.map(t => {
                          const overdue = isOverdue(t.dueDate, t.dueTime, t.status);
                          return (
                            <div key={t.id} onClick={() => router.push(`/top/tasks/detail/${t.id}`)} className={`w-[80vw] sm:w-64 snap-center p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 relative ${overdue ? 'bg-red-50/80 border-red-400 shadow-sm' : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md'}`}>
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-1">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${STATUS_CONFIG[t.status].color}`}>{STATUS_CONFIG[t.status].label}</span>
                                  {t.leaderId === u.id && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center"><Star className="w-2.5 h-2.5 mr-0.5 fill-current" /> 主任</span>}
                                </div>
                                {overdue && <span className="text-[9px] font-black text-red-600 flex items-center animate-pulse"><AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> 期限切れ</span>}
                              </div>
                              <h4 className={`text-xs font-black leading-snug truncate ${t.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{t.title}</h4>
                              <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[10px] font-bold text-gray-500">
                                {t.dueDate ? (
                                  <span className={`flex items-center gap-1 ${overdue ? 'text-red-700 font-black' : ''}`}><CalendarIcon className="w-3 h-3" /> {new Date(t.dueDate).toLocaleDateString('ja-JP', {month:'short', day:'numeric'})} {t.dueTime || ""}</span>
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