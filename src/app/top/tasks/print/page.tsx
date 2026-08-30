"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import * as LucideIcons from "lucide-react";
import { 
  Search, Printer, AlertTriangle, Users, 
  KanbanSquare, Clock, CheckSquare, Filter, CheckCircle2, Square, Calendar, Check
} from "lucide-react";
import LoadingScreen from "@/components/LoadingScreen";

type UserData = { id: string; name: string; schoolId: string; role: string; };
type TaskStatus = "not_started" | "in_progress" | "waiting" | "pending" | "done";
type TaskPriority = "urgent" | "high" | "medium" | "low";

type Task = {
  id: string; title: string; description: string; status: TaskStatus; priority: TaskPriority;
  startDate: string | null; dueDate: string | null; dueTime?: string | null;
  completedAt?: string | null; // ★ 完了日を取得できるように追加
  assignees: string[]; createdAt: string;
};

const STATUS_CONFIG: Record<TaskStatus, { label: string, color: string }> = {
  not_started: { label: "未着手", color: "text-gray-600 bg-gray-100 border-gray-300" },
  in_progress: { label: "進行中", color: "text-blue-700 bg-blue-100 border-blue-300" },
  waiting: { label: "確認待ち", color: "text-amber-700 bg-amber-100 border-amber-300" },
  pending: { label: "保留", color: "text-purple-700 bg-purple-100 border-purple-300" },
  done: { label: "完了", color: "text-emerald-700 bg-emerald-100 border-emerald-300" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string, color: string }> = {
  urgent: { label: "緊急", color: "text-red-700 bg-red-50 border-red-300" },
  high: { label: "高", color: "text-orange-700 bg-orange-50 border-orange-300" },
  medium: { label: "中", color: "text-blue-700 bg-blue-50 border-blue-300" },
  low: { label: "低", color: "text-gray-600 bg-gray-50 border-gray-300" },
};

const PRIORITY_SCORE: Record<TaskPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

export default function TasksPrintPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]);
  const [hasPermission, setHasPermission] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // フィルター・選択設定
  const [searchQuery, setSearchQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  
  // 個別選択用
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let unsubTasks: () => void;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocSnap = await getDoc(doc(db, "users", user.uid));
          if (!userDocSnap.exists()) { router.push("/login"); return; }
          const data = { id: user.uid, ...userDocSnap.data() } as any;
          setUserData(data);

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
                completedAt: td.completedAt || null, // ★ 完了日データを取得
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

  // フィルタリング処理＆タイムラインと同じソート条件
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (!showCompleted && t.status === "done") return false;
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (selectedAssignee !== "all" && !t.assignees.includes(selectedAssignee)) return false;
      if (selectedStatus !== "all" && t.status !== selectedStatus) return false;
      return true;
    }).sort((a, b) => {
      // ★ タイムラインと同じ（開始日の昇順 → 優先度の降順）
      const getStartDate = (t: Task) => t.startDate || t.dueDate || t.createdAt;
      const timeA = new Date(getStartDate(a)).getTime();
      const timeB = new Date(getStartDate(b)).getTime();
      
      if (timeA !== timeB) return timeA - timeB; 
      
      const pA = PRIORITY_SCORE[a.priority] || 0;
      const pB = PRIORITY_SCORE[b.priority] || 0;
      return pB - pA;
    });
  }, [tasks, showCompleted, searchQuery, selectedAssignee, selectedStatus]);

  useEffect(() => {
    setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
  }, [filteredTasks]);

  const toggleTaskSelection = (id: string) => {
    const newSet = new Set(selectedTaskIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedTaskIds(newSet);
  };

  const handlePrint = () => {
    const toggleBtn = document.getElementById("sidebar-toggle-btn");
    const sidebar = document.querySelector("aside");
    let wasSidebarOpen = false;

    if (sidebar && sidebar.offsetWidth > 50) {
      wasSidebarOpen = true;
      toggleBtn?.click();
    }

    setTimeout(() => {
      window.print();
      if (wasSidebarOpen && toggleBtn) {
        setTimeout(() => {
          const currentSidebar = document.querySelector("aside");
          if (currentSidebar && currentSidebar.offsetWidth < 50) {
            toggleBtn.click();
          }
        }, 100);
      }
    }, 400); 
  };

  const printTargetTasks = filteredTasks.filter(t => selectedTaskIds.has(t.id));

  // 所要日数の計算
  const getElapsedDays = (task: Task) => {
    if (!task.startDate) return null;
    const start = new Date(task.startDate);
    start.setHours(0,0,0,0);
    
    const endStr = task.completedAt || new Date().toISOString().split("T")[0];
    const end = new Date(endStr);
    end.setHours(0,0,0,0);

    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= 0 ? diffDays + 1 : 1;
  };

  if (isLoading) return <LoadingScreen message="出力画面を準備中..." />;
  if (!hasPermission) return <div className="h-[100dvh] flex flex-col items-center justify-center p-4"><AlertTriangle className="w-12 h-12 text-red-500 mb-4" /><h1 className="text-xl font-black">アクセス権限がありません</h1></div>;

  return (
    <div className="h-[100dvh] flex flex-col w-full bg-[#F9FAFB] font-sans text-gray-900 overflow-hidden relative print:h-auto print:overflow-visible print:bg-white">

      <div className="flex flex-col shrink-0 print:hidden">
        <div className="px-2 sm:px-6 py-1.5 sm:py-2 border-b border-gray-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 shadow-sm z-20">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg"><Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></div>
            <div><h1 className="text-[11px] sm:text-xs font-black tracking-tight">タスク出力 (PDF/印刷)</h1></div>
          </div>
          
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto custom-scrollbar whitespace-nowrap">
            <button onClick={() => router.push("/top/tasks")} className="px-2 py-1 text-[10px] font-bold text-gray-600 hover:text-gray-900 rounded-md transition-colors flex items-center gap-1"><KanbanSquare className="w-3 h-3" /> カンバン</button>
            <button onClick={() => router.push("/top/tasks/personal")} className="px-2 py-1 text-[10px] font-bold text-gray-600 hover:text-gray-900 rounded-md transition-colors flex items-center gap-1"><Users className="w-3 h-3" /> パーソナル</button>
            <button onClick={() => router.push("/top/tasks/timeline")} className="px-2 py-1 text-[10px] font-bold text-gray-600 hover:text-gray-900 rounded-md transition-colors flex items-center gap-1"><Clock className="w-3 h-3" /> タイムライン</button>
            <button className="px-2 py-1 text-[10px] font-bold bg-white text-indigo-600 rounded-md shadow-2xs flex items-center gap-1"><Printer className="w-3 h-3" /> 出力</button>
          </div>
        </div>

        <div className="px-3 sm:px-6 py-2 bg-gray-50 border-b border-gray-200 flex flex-col gap-2 z-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <div className="relative max-w-[160px] w-full">
                <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input type="text" placeholder="キーワード..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-6 pr-2 py-1 bg-white border border-gray-300 rounded text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs" />
              </div>
              <select value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)} className="py-1 px-2 bg-white border border-gray-300 rounded text-[10px] font-bold shadow-2xs outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="all">全メンバー</option>
                {tenantUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              
              <select 
                value={selectedStatus} 
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedStatus(val);
                  if (val === "done" || val === "all") setShowCompleted(true);
                }} 
                className="py-1 px-2 bg-white border border-gray-300 rounded text-[10px] font-bold shadow-2xs outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">全ステータス</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>

              <button onClick={() => setShowCompleted(!showCompleted)} className={`px-2 py-1 text-[10px] font-bold rounded border flex items-center gap-1 transition-colors ${showCompleted ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-600'}`}>
                <CheckSquare className="w-3 h-3" /> 完了済を表示
              </button>
            </div>
            <button 
              onClick={handlePrint}
              disabled={printTargetTasks.length === 0}
              className="px-4 py-1.5 bg-gray-900 hover:bg-black disabled:opacity-50 text-white text-[11px] font-bold rounded-lg shadow flex items-center gap-1.5 transition-all"
            >
              <Printer className="w-3.5 h-3.5" /> A4縦で出力 ({printTargetTasks.length}件)
            </button>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] font-bold text-gray-500"><Filter className="w-3 h-3 inline mr-0.5" /> 抽出結果から選択:</span>
            <button onClick={() => setSelectedTaskIds(new Set(filteredTasks.map(t=>t.id)))} className="text-[9px] font-bold text-indigo-600 hover:underline">全選択</button>
            <span className="text-gray-300 text-[9px]">|</span>
            <button onClick={() => setSelectedTaskIds(new Set())} className="text-[9px] font-bold text-gray-500 hover:underline">全解除</button>
          </div>
          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto custom-scrollbar">
            {filteredTasks.map(t => (
              <button 
                key={t.id} 
                onClick={() => toggleTaskSelection(t.id)}
                className={`px-1.5 py-0.5 text-[9px] font-bold border rounded-md flex items-center gap-1 max-w-[150px] truncate ${selectedTaskIds.has(t.id) ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'bg-white border-gray-200 text-gray-400'}`}
              >
                {selectedTaskIds.has(t.id) ? <CheckCircle2 className="w-2.5 h-2.5 flex-shrink-0" /> : <Square className="w-2.5 h-2.5 flex-shrink-0" />}
                <span className="truncate">{t.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body { height: auto !important; overflow: visible !important; background-color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}} />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 bg-gray-200 print:p-0 print:bg-white print:overflow-visible print:block flex justify-center items-start">
        
        <div className="bg-white shadow-xl w-full max-w-[210mm] min-h-[297mm] print:min-h-0 print:shadow-none print:max-w-none print:w-full flex flex-col p-6 print:p-0">
          
          <div className="border-b-2 border-gray-800 mb-3 pb-2 flex justify-between items-end">
            <h1 className="text-xl font-black text-gray-900 tracking-wider">タスク詳細管理リスト</h1>
            <div className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> 出力日: {new Date().toLocaleDateString('ja-JP')}
            </div>
          </div>

          {printTargetTasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 font-bold text-xs">出力対象のタスクが選択されていません</div>
          ) : (
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-gray-100/80 text-[9px] text-gray-600 uppercase border-y border-gray-300">
                  <th className="py-1.5 px-1 w-[6%] font-black text-center">✔</th>
                  <th className="py-1.5 px-2 w-[28%] font-black">タスク名・担当・優先度</th>
                  <th className="py-1.5 px-2 w-[20%] font-black">期間・状態</th>
                  <th className="py-1.5 px-2 w-[46%] font-black border-l border-gray-300 pl-3">詳細内容・進行メモ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-[10px]">
                {printTargetTasks.map(t => {
                  const elapsedDays = getElapsedDays(t);
                  
                  return (
                    <tr key={t.id} className="break-inside-avoid">
                      {/* ★ 完了時の緑のチェックボックス */}
                      <td className="py-2 px-1 text-center align-top">
                        <div className={`w-3.5 h-3.5 rounded border mx-auto flex items-center justify-center mt-0.5 ${t.status === 'done' ? 'bg-emerald-500 border-emerald-600' : 'bg-white border-gray-400'}`}>
                          {t.status === 'done' && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                        </div>
                      </td>
                      
                      <td className="py-2 px-2 align-top pr-2">
                        <div className={`font-black leading-snug mb-1 text-[11px] break-words ${t.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{t.title}</div>
                        <div className="flex flex-wrap gap-1 items-center mt-1">
                          <span className={`px-1 py-0.5 rounded-[3px] text-[7px] font-bold border ${PRIORITY_CONFIG[t.priority]?.color || ''}`}>
                            {PRIORITY_CONFIG[t.priority]?.label || "中"}
                          </span>
                          <span className="text-[8px] font-bold text-gray-500">
                            {t.assignees.map(aid => tenantUsers.find(u => u.id === aid)?.name).join(", ") || "未割当"}
                          </span>
                        </div>
                      </td>
                      
                      <td className="py-2 px-2 align-top text-[9px] text-gray-600 font-bold space-y-1">
                        <div className="flex justify-between max-w-[95%]"><span className="text-gray-400">開始:</span> <span>{t.startDate ? new Date(t.startDate).toLocaleDateString('ja-JP', {month:'short', day:'numeric'}) : "未設定"}</span></div>
                        <div className="flex justify-between max-w-[95%]"><span className="text-gray-400">期限:</span> <span className={t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done" ? "text-red-600 font-black" : ""}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString('ja-JP', {month:'short', day:'numeric'}) : "未設定"}</span></div>
                        <div className="pt-0.5 flex flex-col gap-0.5">
                          <span className={`px-1 py-0.5 w-fit rounded-[3px] border text-[7px] ${STATUS_CONFIG[t.status].color}`}>{STATUS_CONFIG[t.status].label}</span>
                          
                          {/* ★ 完了済みの場合は所要日数を表示 */}
                          {t.status === "done" && elapsedDays && (
                            <span className="text-[7.5px] text-emerald-600 font-black tracking-tight mt-0.5">
                              (所要日数: {elapsedDays}日)
                            </span>
                          )}
                        </div>
                      </td>
                      
                      <td className="py-2 px-3 align-top border-l border-gray-300 relative text-[9px] text-gray-700 flex flex-col h-full min-h-[50px]">
                        {t.description ? (
                          <div className="line-clamp-3 mb-5 leading-relaxed break-words pr-1">{t.description}</div>
                        ) : (
                          <div className="text-gray-300 italic mb-5">詳細なし</div>
                        )}
                        
                        <div className="mt-auto w-full">
                          <div className="w-full border-b border-gray-200 border-dashed mb-3.5"></div>
                          <div className="w-full border-b border-gray-200 border-dashed mb-1.5"></div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}