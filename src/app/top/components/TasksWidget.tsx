"use client";

import React from "react";
import { useRouter } from "next/navigation";
import * as LucideIcons from "lucide-react";
import { 
  ChevronRight, BarChart3, CheckCircle2, 
  Calendar as CalendarIcon, AlertTriangle, Flag 
} from "lucide-react";

type TaskStatus = "not_started" | "in_progress" | "waiting" | "pending" | "done";
type TaskPriority = "urgent" | "high" | "medium" | "low";

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string, color: string, dot: string }> = {
  not_started: { label: "未着手", color: "text-gray-600 bg-gray-100", dot: "bg-gray-400" },
  in_progress: { label: "進行中", color: "text-blue-700 bg-blue-100", dot: "bg-blue-500" },
  waiting: { label: "確認待ち", color: "text-amber-700 bg-amber-100", dot: "bg-amber-500" },
  pending: { label: "保留", color: "text-purple-700 bg-purple-100", dot: "bg-purple-500" },
  done: { label: "完了", color: "text-emerald-700 bg-emerald-100", dot: "bg-emerald-500" },
};

const TASK_PRIORITY_CONFIG: Record<TaskPriority, { label: string, color: string, icon: React.ReactNode }> = {
  urgent: { label: "緊急", color: "text-red-700 border-red-500 bg-red-50", icon: <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-600" /> },
  high: { label: "高", color: "text-orange-700 border-orange-200 bg-orange-50", icon: <Flag className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-orange-600" /> },
  medium: { label: "中", color: "text-blue-700 border-blue-200 bg-blue-50", icon: <Flag className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-600" /> },
  low: { label: "低", color: "text-gray-600 border-gray-200 bg-gray-50", icon: <Flag className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" /> },
};

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

type Props = {
  tasksApp: any;
  tasksC: any;
  totalTasks: number;
  statusCounts: Record<string, number>;
  myTasks: any[];
};

export default function TasksWidget({ tasksApp, tasksC, totalTasks, statusCounts, myTasks }: Props) {
  const router = useRouter();

  const isOverdue = (dueDate: string | null, dueTime: string | null | undefined, status: string) => {
    if (!dueDate || status === "done") return false;
    const now = new Date();
    const [year, month, day] = dueDate.split('-').map(Number);
    let hour = 23, minute = 59, second = 59;
    if (dueTime) { const [h, m] = dueTime.split(':').map(Number); hour = h; minute = m; second = 0; }
    const due = new Date(year, month - 1, day, hour, minute, second);
    return due < now;
  };

  if (!tasksApp) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col min-w-0">
      <div className="px-3.5 py-2.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h2 className="text-xs sm:text-sm font-black text-gray-900 flex items-center gap-1.5 truncate">
          <DynamicIcon name={tasksApp.icon} className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${tasksC.iconText}`} /> 
          {tasksApp.displayName}
        </h2>
        <button onClick={() => router.push(tasksApp.path)} className={`px-2 py-0.5 sm:px-2.5 sm:py-1 ${tasksC.lightBg} ${tasksC.text} ${tasksC.hoverBg} rounded-lg text-[10px] font-bold flex items-center transition-colors flex-shrink-0`}>
          開く <ChevronRight className="w-3 h-3 ml-0.5" />
        </button>
      </div>

      <div className="p-2.5 sm:p-4 flex flex-col gap-2.5 min-w-0">
        
        <div className="bg-gray-50 rounded-xl p-2 sm:p-2.5 border border-gray-100/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 flex items-center gap-1"><BarChart3 className="w-3 h-3" /> 全体の進捗状況</span>
            <span className="text-[8px] sm:text-[9px] font-bold text-gray-400">計 {totalTasks} 件</span>
          </div>
          {totalTasks === 0 ? (
            <div className="h-1.5 w-full bg-gray-200 rounded-full"></div>
          ) : (
            <div className="flex h-1.5 w-full rounded-full overflow-hidden gap-[1px]">
              {statusCounts.done > 0 && <div style={{width: `${(statusCounts.done/totalTasks)*100}%`}} className="bg-emerald-500" title={`完了: ${statusCounts.done}`}></div>}
              {statusCounts.in_progress > 0 && <div style={{width: `${(statusCounts.in_progress/totalTasks)*100}%`}} className="bg-blue-500" title={`進行中: ${statusCounts.in_progress}`}></div>}
              {statusCounts.waiting > 0 && <div style={{width: `${(statusCounts.waiting/totalTasks)*100}%`}} className="bg-amber-500" title={`確認待ち: ${statusCounts.waiting}`}></div>}
              {statusCounts.pending > 0 && <div style={{width: `${(statusCounts.pending/totalTasks)*100}%`}} className="bg-purple-500" title={`保留: ${statusCounts.pending}`}></div>}
              {statusCounts.not_started > 0 && <div style={{width: `${(statusCounts.not_started/totalTasks)*100}%`}} className="bg-gray-300" title={`未着手: ${statusCounts.not_started}`}></div>}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-[10px] sm:text-xs font-bold text-gray-700 flex items-center gap-1 mb-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> あなたの担当タスク
          </h3>
          <div className="space-y-1.5">
            {myTasks.length === 0 ? (
              <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 text-center py-2.5 border border-dashed border-gray-200 rounded-xl">担当中の未完了タスクはありません</p>
            ) : (
              myTasks.slice(0, 3).map(t => {
                const overdue = isOverdue(t.dueDate, t.dueTime, t.status);
                return (
                  <div key={t.id} onClick={() => router.push(`/top/tasks/detail/${t.id}`)} className={`p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 group min-w-0 ${overdue ? 'bg-red-50/80 border-red-300' : 'bg-white border-gray-200 hover:border-indigo-300'}`}>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className={`px-1 py-0.5 rounded text-[8px] font-bold border flex-shrink-0 ${TASK_PRIORITY_CONFIG[t.priority as TaskPriority].color}`}>
                        {TASK_PRIORITY_CONFIG[t.priority as TaskPriority].label}
                      </span>
                      <span className={`text-[10px] sm:text-xs font-black truncate group-hover:text-indigo-600 transition-colors ${overdue ? 'text-red-900' : 'text-gray-900'}`}>{t.title}</span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-1 ${TASK_STATUS_CONFIG[t.status as TaskStatus].color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${TASK_STATUS_CONFIG[t.status as TaskStatus].dot}`}></span>
                        <span className="hidden sm:inline">{TASK_STATUS_CONFIG[t.status as TaskStatus].label}</span>
                      </span>
                      {t.dueDate && (
                        <span className={`text-[8px] font-bold flex items-center gap-0.5 ${overdue ? 'text-red-600' : 'text-gray-400'}`}>
                          <CalendarIcon className="w-2.5 h-2.5" /> {new Date(t.dueDate).toLocaleDateString('ja-JP', {month:'numeric', day:'numeric'})}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}