"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { 
  doc, getDoc, getDocs, collection, query, where, onSnapshot, 
  updateDoc, deleteDoc 
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import * as LucideIcons from "lucide-react";
import { 
  ArrowLeft, Search, Plus, Trash2, CheckCircle2, 
  AlertCircle, Calendar as CalendarIcon, User as UserIcon, 
  Flag, AlertTriangle, ChevronDown, Loader2, Users, KanbanSquare, Clock
} from "lucide-react";

type UserData = { id: string; name: string; schoolId: string; role: string; };
type TaskStatus = "not_started" | "in_progress" | "waiting" | "pending" | "done";
type TaskPriority = "urgent" | "high" | "medium" | "low";
type CompletionReq = "anyone" | "all" | "leader";

type Task = {
  id: string; title: string; description: string; status: TaskStatus; priority: TaskPriority;
  startDate: string | null; dueDate: string | null; dueTime?: string | null;
  assignees: string[]; leaderId: string | null; completionRequirement: CompletionReq;
  completedBy: string[]; createdAt: string;
};

type AlertState = { show: boolean; type: "success" | "error"; message: string; };

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

const COLOR_MAPPINGS: Record<string, { bg: string, text: string, hover: string, border: string, lightBg: string, ring: string }> = {
  indigo: { bg: "bg-indigo-600", text: "text-indigo-600", hover: "hover:bg-indigo-700", border: "border-indigo-200", lightBg: "bg-indigo-100", ring: "ring-indigo-500" },
  blue: { bg: "bg-blue-600", text: "text-blue-600", hover: "hover:bg-blue-700", border: "border-blue-200", lightBg: "bg-blue-100", ring: "ring-blue-500" },
  green: { bg: "bg-emerald-600", text: "text-emerald-600", hover: "hover:bg-emerald-700", border: "border-emerald-200", lightBg: "bg-emerald-100", ring: "ring-emerald-500" },
  purple: { bg: "bg-purple-600", text: "text-purple-600", hover: "hover:bg-purple-700", border: "border-purple-200", lightBg: "bg-purple-100", ring: "ring-purple-500" },
  orange: { bg: "bg-orange-600", text: "text-orange-600", hover: "hover:bg-orange-700", border: "border-orange-200", lightBg: "bg-orange-100", ring: "ring-orange-500" },
  rose: { bg: "bg-rose-600", text: "text-rose-600", hover: "hover:bg-rose-700", border: "border-rose-200", lightBg: "bg-rose-100", ring: "ring-rose-500" },
  default: { bg: "bg-indigo-600", text: "text-indigo-600", hover: "hover:bg-indigo-700", border: "border-indigo-200", lightBg: "bg-indigo-100", ring: "ring-indigo-500" }
};

const STATUS_CONFIG: Record<TaskStatus, { label: string, color: string, badge: string, dot: string, barColor: string }> = {
  not_started: { label: "未着手", color: "bg-gray-50/80", badge: "bg-gray-200 text-gray-700 border border-gray-300", dot: "bg-gray-400", barColor: "bg-gray-400" },
  in_progress: { label: "進行中", color: "bg-blue-50/30", badge: "bg-blue-100 text-blue-700 border border-blue-200", dot: "bg-blue-500 animate-pulse", barColor: "bg-blue-500" },
  waiting: { label: "確認待ち", color: "bg-amber-50/30", badge: "bg-amber-100 text-amber-700 border border-amber-200", dot: "bg-amber-500", barColor: "bg-amber-500" },
  pending: { label: "保留", color: "bg-purple-50/30", badge: "bg-purple-100 text-purple-700 border border-purple-200", dot: "bg-purple-500", barColor: "bg-purple-500" },
  done: { label: "完了", color: "bg-emerald-50/30", badge: "bg-emerald-100 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500", barColor: "bg-emerald-500 opacity-60" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string, color: string, icon: React.ReactNode }> = {
  urgent: { label: "緊急", color: "text-red-700 bg-red-100 border-red-500 font-black shadow-2xs", icon: <AlertTriangle className="w-3 h-3 text-red-600" /> },
  high: { label: "高", color: "text-orange-700 bg-orange-100 border-orange-200", icon: <Flag className="w-3 h-3 text-orange-600" /> },
  medium: { label: "中", color: "text-blue-700 bg-blue-100 border-blue-200", icon: <Flag className="w-3 h-3 text-blue-600" /> },
  low: { label: "低", color: "text-gray-600 bg-gray-100 border-gray-200", icon: <Flag className="w-3 h-3 text-gray-500" /> },
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
    <div className="relative z-20" ref={ref}>
      <div 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
        className={`w-full flex justify-between items-center bg-white border rounded px-1.5 py-1 sm:py-0.5 text-[10px] font-bold cursor-pointer transition-all ${className} ${isOpen ? `ring-1 ${ringClass} border-transparent shadow-sm` : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
      >
        <span className={sel?.badgeClass || ""}>{sel?.label || ""}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <div className={`absolute left-0 right-0 ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'} bg-white border border-gray-200 rounded shadow-xl z-50 overflow-y-auto max-h-40 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-0.5`}>
          {options.map((o:any) => (
            <div 
              key={o.value} 
              onClick={(e) => { e.stopPropagation(); onChange(o.value); setIsOpen(false); }} 
              className={`px-2 py-1.5 sm:py-1 text-[10px] font-bold cursor-pointer rounded transition-colors ${o.value === value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <span className={o.badgeClass || ""}>{o.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]);
  const [appConfig, setAppConfig] = useState({ name: "タスク管理", icon: "CheckSquare", color: "indigo" });
  const [hasPermission, setHasPermission] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAssignee, setFilterAssignee] = useState<"all" | "my" | "unassigned">("all");
  const [uiAlert, setUiAlert] = useState<AlertState>({ show: false, type: "success", message: "" });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // スマホ表示用のステータスタブ
  const [activeMobileTab, setActiveMobileTab] = useState<TaskStatus>("not_started");

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
          let tasksApp: any = appsSnap.empty ? { appId: "tasks", name: "タスク管理", icon: "CheckSquare", color: "indigo", isActive: true, defaultRoles: { admin: true, it_manager: true, teacher: true, officer: true, guest: false } } : appsSnap.docs[0].data();

          let allowed = true;
          if (!tasksApp.isActive) allowed = false;
          if (schoolData.availableModules && !schoolData.availableModules.includes("tasks")) allowed = false;
          const roleKey = data.role || "guest";
          const perms = schoolData.appPermissions?.["tasks"] || tasksApp.defaultRoles;
          if (perms && perms[roleKey] === false) allowed = false;
          if (data.allowedModules && !data.allowedModules.includes("tasks")) allowed = false;

          if (!allowed) { setHasPermission(false); setIsLoading(false); return; }

          setAppConfig({
            name: (schoolData.customAppNames?.["tasks"] || tasksApp.name).trim() || tasksApp.name,
            icon: tasksApp.icon || "CheckSquare",
            color: tasksApp.color || "indigo"
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
                id: d.id, title: td.title, description: td.description || "",
                status: td.status || "not_started", priority: td.priority || "medium",
                startDate: td.startDate || null, dueDate: td.dueDate || null, dueTime: td.dueTime || null,
                assignees: td.assignees || (td.assigneeId ? [td.assigneeId] : []),
                leaderId: td.leaderId || null, completionRequirement: td.completionRequirement || "anyone",
                completedBy: td.completedBy || [],
                createdAt: td.createdAt ? td.createdAt.toDate().toISOString() : new Date().toISOString(),
              });
            });
            fetched.sort((a, b) => {
              if (a.priority === "urgent" && b.priority !== "urgent") return -1;
              if (a.priority !== "urgent" && b.priority === "urgent") return 1;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
            setTasks(fetched);
          });
          setIsLoading(false);
        } catch (error) { setIsLoading(false); }
      } else { router.push("/login"); }
    });
    return () => { unsubscribeAuth(); if (unsubTasks) unsubTasks(); };
  }, [router]);

  const c = COLOR_MAPPINGS[appConfig.color] || COLOR_MAPPINGS.default;
  const showToast = (type: "success" | "error", message: string) => { setUiAlert({ show: true, type, message }); setTimeout(() => setUiAlert((prev: AlertState) => ({ ...prev, show: false })), 3000); };

  const changeTaskStatus = async (task: Task, newStatus: TaskStatus) => {
    if (task.status === newStatus) return;
    const payload: any = {};
    let finalStatus = newStatus;

    if (newStatus === "done") {
      if (task.assignees.length > 1) {
        if (task.completionRequirement === "leader") {
          if (userData?.id !== task.leaderId) { showToast("error", "タスク主任のみ完了報告ができます。"); return; }
        } else if (task.completionRequirement === "all") {
          if (!task.completedBy.includes(userData!.id)) {
            const newCompletedBy = [...task.completedBy, userData!.id];
            payload.completedBy = newCompletedBy;
            const allDone = task.assignees.every(id => newCompletedBy.includes(id));
            if (!allDone) { finalStatus = task.status; showToast("success", "完了報告を記録しました。全員の報告が必要です。"); } 
            else { showToast("success", "全員の報告が揃い、完了しました！"); }
          } else { showToast("error", "すでに完了報告済みです。"); return; }
        }
      }
    }
    if (task.status === "done" && newStatus !== "done") payload.completedBy = [];
    if (finalStatus !== task.status) payload.status = finalStatus;
    if (Object.keys(payload).length > 0) {
      try { await updateDoc(doc(db, "tasks", task.id), payload); } 
      catch (error) { showToast("error", "ステータス変更に失敗しました。"); }
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try { await deleteDoc(doc(db, "tasks", deleteConfirmId)); showToast("success", "タスクを削除しました。"); } 
    catch (error) { showToast("error", "削除に失敗しました。"); } finally { setDeleteConfirmId(null); }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => { e.dataTransfer.setData("text/plain", taskId); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus) await changeTaskStatus(task, newStatus);
  };

  const isOverdue = (dueDate: string | null, dueTime: string | null | undefined, status: string) => {
    if (!dueDate || status === "done") return false;
    const now = new Date();
    const [year, month, day] = dueDate.split('-').map(Number);
    let hour = 23, minute = 59, second = 59;
    if (dueTime) { const [h, m] = dueTime.split(':').map(Number); hour = h; minute = m; second = 0; }
    const due = new Date(year, month - 1, day, hour, minute, second);
    return due < now;
  };

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase());
    let matchesAssignee = true;
    if (filterAssignee === "my") matchesAssignee = t.assignees.includes(userData?.id || "");
    if (filterAssignee === "unassigned") matchesAssignee = t.assignees.length === 0;
    return matchesSearch && matchesAssignee;
  });

  const columns: TaskStatus[] = ["not_started", "in_progress", "waiting", "pending", "done"];
  const assigneeOptions = [{label:"すべての担当者", value:"all"}, {label:"自分のタスク", value:"my"}, {label:"未割り当て", value:"unassigned"}];
  const statusOptions = Object.entries(STATUS_CONFIG).map(([key, conf]) => ({ label: conf.label, value: key, badgeClass: conf.badge.split(" ")[0] + " " + conf.badge.split(" ")[1] + " px-1.5 py-0.5 rounded-md border" }));

  if (isLoading) return <div className="min-h-screen bg-[#F9FAFB] flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (!hasPermission) return <div className="min-h-screen flex flex-col items-center justify-center p-4"><AlertTriangle className="w-12 h-12 text-red-500 mb-4" /><h1 className="text-xl font-black">アクセス権限がありません</h1></div>;

  const renderTaskCard = (t: Task) => {
    const overdue = isOverdue(t.dueDate, t.dueTime, t.status);
    const isAllRequirement = t.completionRequirement === "all" && t.assignees.length > 1;
    const hasReported = isAllRequirement && t.completedBy.includes(userData?.id || "");

    return (
      <div 
        key={t.id} 
        draggable onDragStart={(e) => handleDragStart(e, t.id)}
        onClick={() => router.push(`/top/tasks/detail/${t.id}`)} 
        className={`p-3 rounded-xl transition-all cursor-grab active:cursor-grabbing group flex flex-col gap-2 relative overflow-visible ${overdue ? 'bg-red-50/80 border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.2)]' : 'bg-white border border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow-md'}`}
      >
        {overdue && <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse rounded-t-xl"></div>}
        <div className="flex justify-between items-start pt-0.5">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {overdue && <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-600 text-white border border-red-700 animate-pulse"><AlertTriangle className="w-2.5 h-2.5 mr-0.5 inline" />期限超過</span>}
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center border ${PRIORITY_CONFIG[t.priority].color}`}>{PRIORITY_CONFIG[t.priority].icon} <span className="ml-0.5">{PRIORITY_CONFIG[t.priority].label}</span></span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(t.id); }} className="opacity-100 md:opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors absolute top-1 right-1 z-10"><Trash2 className="w-4 h-4" /></button>
        </div>
        <h4 className={`text-sm font-black leading-snug break-words pr-6 ${t.status === 'done' ? 'text-gray-400 line-through' : (overdue ? 'text-red-900' : 'text-gray-900')}`}>{t.title}</h4>
        
        <div className="flex flex-col gap-2 mt-1 pt-2 border-t border-gray-100/80">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {t.assignees.length === 0 ? <div className="w-5 h-5 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center"><UserIcon className="w-2.5 h-2.5 text-gray-400" /></div> : t.assignees.slice(0, 3).map(id => <div key={id} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-white ${id === t.leaderId ? 'bg-amber-500 z-10' : 'bg-gray-400'}`}>{tenantUsers.find(tu=>tu.id===id)?.name.charAt(0) || "?"}</div>)}
            </div>
            {t.dueDate && <div className={`flex items-center gap-1 text-[10px] font-bold ${overdue ? 'text-red-700' : 'text-gray-500'}`}><CalendarIcon className="w-3 h-3" /> {new Date(t.dueDate).toLocaleDateString('ja-JP', {month:'short', day:'numeric'})}</div>}
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
            <div onClick={e => e.stopPropagation()} className="w-24 sm:w-24 flex-shrink-0">
              <CustomSelect value={t.status} options={statusOptions} onChange={(val: any) => changeTaskStatus(t, val)} className="bg-gray-50 hover:bg-gray-100" dropUp={true} />
            </div>
            {t.status !== "done" && (
              <button onClick={(e) => { e.stopPropagation(); changeTaskStatus(t, "done"); }} className="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-200 hover:border-emerald-500 text-[10px] font-bold rounded-lg shadow-sm flex items-center transition-colors flex-shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 mr-0.5" />完了
              </button>
            )}
            {t.status === "done" && hasReported && <span className="text-[10px] font-bold text-emerald-600 flex items-center bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100"><CheckCircle2 className="w-3 h-3 mr-0.5" />完了済</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans flex flex-col text-gray-900 overflow-hidden">
      {/* ナビゲーションタブ */}
      <div className="px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`p-1.5 sm:p-2 ${c.lightBg} ${c.text} rounded-lg sm:rounded-xl shadow-2xs`}><DynamicIcon name={appConfig.icon} className="w-4 h-4 sm:w-5 sm:h-5" /></div>
          <div>
            <h1 className="text-sm sm:text-base font-black text-gray-900 tracking-tight">{appConfig.name}</h1>
            <p className="hidden sm:block text-[10px] font-bold text-gray-500">ドラッグ＆ドロップでステータス変更。詳細なタスク登録が可能。</p>
          </div>
        </div>
        
        {/* スマホ横スクロール対応タブ */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] whitespace-nowrap">
          <button className="px-3 py-1.5 text-xs font-bold bg-white text-indigo-600 rounded-lg shadow-2xs flex items-center gap-1">
            <KanbanSquare className="w-3.5 h-3.5" /> カンバン
          </button>
          <button onClick={() => router.push("/top/tasks/personal")} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-lg transition-colors flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> パーソナル
          </button>
          <button onClick={() => router.push("/top/tasks/timeline")} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-lg transition-colors flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> タイムライン
          </button>
        </div>
      </div>

      <main className="flex-1 flex flex-col h-[calc(100vh-100px)]">
        
        {/* コントロールバー（スマホで縦並び対応） */}
        <div className="px-3 sm:px-8 py-2 sm:py-3 bg-white border-b border-gray-100 flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex w-full sm:w-auto items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="タスク検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:bg-white transition-all ${c.ring}`} />
            </div>
            <div className="w-32 sm:w-36">
              <CustomSelect value={filterAssignee} options={assigneeOptions} onChange={(v: any) => setFilterAssignee(v)} ringClass={c.ring} />
            </div>
          </div>
          <button onClick={() => router.push("/top/tasks/new")} className={`w-full sm:w-auto px-4 py-2 sm:py-1.5 ${c.bg} ${c.hover} text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center`}><Plus className="w-4 h-4 mr-1" /> タスク作成</button>
        </div>

        {/* スマホ専用ステータスタブ */}
        <div className="md:hidden flex overflow-x-auto gap-2 p-3 bg-white border-b border-gray-200 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {columns.map(status => {
            const conf = STATUS_CONFIG[status];
            const colTasks = filteredTasks.filter(t => t.status === status);
            const isActive = activeMobileTab === status;
            return (
              <button 
                key={status} 
                onClick={() => setActiveMobileTab(status)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap text-xs font-bold transition-all ${isActive ? `${c.bg} text-white shadow-sm` : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
              >
                {conf.label} 
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {colTasks.length}
                </span>
              </button>
            )
          })}
        </div>

        {uiAlert.show && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50">
            <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center shadow-lg animate-fade-in ${uiAlert.type === "success" ? "bg-gray-900 text-white border border-gray-800" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {uiAlert.type === "success" ? <CheckCircle2 className="w-4 h-4 mr-1.5 text-green-400" /> : <AlertCircle className="w-4 h-4 mr-1.5" />} {uiAlert.message}
            </div>
          </div>
        )}

        {/* カンバンボード本体 */}
        <div className="flex-1 overflow-x-auto custom-scrollbar p-3 md:p-6 bg-gray-100/50">
          <div className="flex gap-4 md:gap-6 md:min-w-max h-full pb-2">
            {columns.map(status => {
              const conf = STATUS_CONFIG[status];
              const colTasks = filteredTasks.filter(t => t.status === status);
              const isMobileActive = activeMobileTab === status;

              return (
                <div 
                  key={status} 
                  onDragOver={handleDragOver} 
                  onDrop={(e) => handleDrop(e, status)} 
                  className={`${isMobileActive ? 'flex' : 'hidden'} md:flex w-full md:w-[300px] flex-col h-full ${conf.color} rounded-2xl border border-gray-200/60 overflow-hidden transition-colors hover:bg-gray-50/80`}
                >
                  <div className="p-3 border-b border-gray-200/60 flex items-center justify-between bg-white shadow-2xs pointer-events-none">
                    <h3 className="text-xs font-black text-gray-700 flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${conf.dot}`}></span> {conf.label}</h3>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${conf.badge.split(' ').slice(0, 2).join(' ')}`}>{colTasks.length}</span>
                  </div>
                  <div className="flex-1 p-2 md:p-2.5 overflow-y-auto custom-scrollbar space-y-2.5">
                    {colTasks.map(renderTaskCard)}
                    
                    {/* ★ 各カラムの一番下にタスク追加ボタン */}
                    <div className="p-1 pt-0">
                        <button onClick={() => router.push(`/top/tasks/new?status=${status}`)} className="w-full py-2 mt-2 border border-dashed border-gray-300 text-gray-500 rounded-xl text-xs font-bold hover:border-indigo-300 hover:text-indigo-600 hover:bg-white transition-colors flex items-center justify-center gap-1 shadow-sm">
                          <Plus className="w-3.5 h-3.5" /> タスクを追加
                        </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {deleteConfirmId && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-white/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden">
            <div className="p-5 flex items-start gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-full flex-shrink-0"><AlertCircle className="w-5 h-5" /></div>
              <div><h3 className="text-sm font-black text-gray-900 mb-1">タスクを削除しますか？</h3><p className="text-xs font-medium text-gray-500 leading-relaxed">この操作は取り消せません。</p></div>
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-1.5 text-xs font-bold text-gray-600 bg-white border hover:bg-gray-50 rounded-lg">キャンセル</button>
              <button onClick={executeDelete} className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg">削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}