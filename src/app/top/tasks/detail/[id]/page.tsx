"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { 
  ArrowLeft, CheckCircle2, AlertCircle, Calendar as CalendarIcon, 
  User as UserIcon, Flag, AlertTriangle, Loader2, Star, Trash2, Edit3, X, Search, ChevronRight
} from "lucide-react";
import CustomSelect from "@/components/CustomSelect"; 
import LoadingScreen from "@/components/LoadingScreen";

type UserData = { id: string; name: string; schoolId: string; role: string; };
type TaskStatus = "not_started" | "in_progress" | "waiting" | "pending" | "done";
type TaskPriority = "urgent" | "high" | "medium" | "low";
type CompletionReq = "anyone" | "all" | "leader";

type Task = {
  id: string; title: string; description: string; status: TaskStatus; priority: TaskPriority;
  startDate: string | null; dueDate: string | null; dueTime?: string | null;
  completedAt?: string | null; // ★ 完了日を追加
  assignees: string[]; leaderId: string | null; completionRequirement: CompletionReq;
  completedBy: string[]; createdAt: string;
};

const STATUS_CONFIG: Record<TaskStatus, { label: string, color: string, iconColor: string }> = {
  not_started: { label: "未着手", color: "bg-gray-100 text-gray-700 border-gray-300", iconColor: "text-gray-500" },
  in_progress: { label: "進行中", color: "bg-blue-100 text-blue-700 border-blue-300", iconColor: "text-blue-500" },
  waiting: { label: "確認待ち", color: "bg-amber-100 text-amber-700 border-amber-300", iconColor: "text-amber-500" },
  pending: { label: "保留", color: "bg-purple-100 text-purple-700 border-purple-300", iconColor: "text-purple-500" },
  done: { label: "完了", color: "bg-emerald-100 text-emerald-700 border-emerald-300", iconColor: "text-emerald-500" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string, color: string, icon: React.ReactNode }> = {
  urgent: { label: "緊急", color: "text-red-700 bg-red-100 border-red-500 font-black", icon: <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> },
  high: { label: "高", color: "text-orange-700 bg-orange-100 border-orange-300", icon: <Flag className="w-3.5 h-3.5 text-orange-600" /> },
  medium: { label: "中", color: "text-blue-700 bg-blue-100 border-blue-300", icon: <Flag className="w-3.5 h-3.5 text-blue-600" /> },
  low: { label: "低", color: "text-gray-600 bg-gray-100 border-gray-300", icon: <Flag className="w-3.5 h-3.5 text-gray-500" /> },
};

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [userData, setUserData] = useState<UserData | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formStatus, setFormStatus] = useState<TaskStatus>("not_started");
  const [formPriority, setFormPriority] = useState<TaskPriority>("medium");
  const [formStartDate, setFormStartDate] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formDueTime, setFormDueTime] = useState("");
  const [formAssignees, setFormAssignees] = useState<string[]>([]);
  const [formLeaderId, setFormLeaderId] = useState<string | null>(null);
  const [formCompletionReq, setFormCompletionReq] = useState<CompletionReq>("anyone");
  const [formCompletedBy, setFormCompletedBy] = useState<string[]>([]);
  
  const [searchUserQuery, setSearchUserQuery] = useState("");
  const [isSearchUserFocused, setIsSearchUserFocused] = useState(false);
  const userSearchRef = useRef<HTMLDivElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ show: boolean, message: string, type: "success" | "error" }>({ show: false, message: "", type: "success" });
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocSnap = await getDoc(doc(db, "users", user.uid));
          if (!userDocSnap.exists()) { router.push("/login"); return; }
          const uData = { id: user.uid, ...userDocSnap.data() } as UserData;
          setUserData(uData);

          const qUsers = query(collection(db, "users"), where("schoolId", "==", uData.schoolId));
          const usersSnap = await getDocs(qUsers);
          const usersList: UserData[] = [];
          usersSnap.forEach(d => usersList.push({ id: d.id, ...d.data() } as UserData));
          setTenantUsers(usersList);

          const taskDocSnap = await getDoc(doc(db, "tasks", taskId));
          if (taskDocSnap.exists()) {
            const td = taskDocSnap.data();
            const loadedTask: Task = {
              id: taskDocSnap.id, title: td.title, description: td.description || "",
              status: td.status || "not_started", priority: td.priority || "medium",
              startDate: td.startDate || null, dueDate: td.dueDate || null, dueTime: td.dueTime || null,
              completedAt: td.completedAt || null,
              assignees: td.assignees || (td.assigneeId ? [td.assigneeId] : []),
              leaderId: td.leaderId || null, completionRequirement: td.completionRequirement || "anyone",
              completedBy: td.completedBy || [],
              createdAt: td.createdAt ? td.createdAt.toDate().toISOString() : new Date().toISOString(),
            };
            setTask(loadedTask);
            setFormValues(loadedTask);
          } else { showToast("error", "指定されたタスクが見つかりません。"); }
        } catch (error) { console.error(error); } finally { setIsLoading(false); }
      } else { router.push("/login"); }
    });
    return () => unsubscribeAuth();
  }, [taskId, router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userSearchRef.current && !userSearchRef.current.contains(e.target as Node)) setIsSearchUserFocused(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!formLeaderId && formCompletionReq === "leader") setFormCompletionReq("anyone");
  }, [formLeaderId, formCompletionReq]);

  const setFormValues = (t: Task) => {
    setFormTitle(t.title); setFormDesc(t.description); setFormStatus(t.status); setFormPriority(t.priority);
    setFormStartDate(t.startDate || ""); setFormDueDate(t.dueDate || ""); setFormDueTime(t.dueTime || "");
    setFormAssignees(t.assignees); setFormLeaderId(t.leaderId); setFormCompletionReq(t.completionRequirement);
    setFormCompletedBy(t.completedBy);
  };

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !userData) { showToast("error", "タスク名を入力してください。"); return; }
    setIsSubmitting(true);

    const payload: any = {
      title: formTitle.trim(), description: formDesc.trim(), status: formStatus, priority: formPriority,
      startDate: formStartDate || null, dueDate: formDueDate || null, dueTime: formDueTime || null,
      assignees: formAssignees, leaderId: formAssignees.includes(formLeaderId || "") ? formLeaderId : null,
      completionRequirement: formAssignees.length > 1 ? formCompletionReq : "anyone",
    };

    // ★ 完了になった場合は、手動編集画面からの変更であっても完了日を記録
    if (formStatus === "done" && task?.status !== "done") {
      payload.completedAt = new Date().toISOString().split("T")[0];
    } else if (formStatus !== "done" && task?.status === "done") {
      payload.completedAt = null;
      payload.completedBy = [];
    }

    try {
      await updateDoc(doc(db, "tasks", taskId), payload);
      setTask(prev => prev ? { ...prev, ...payload } : null);

      const batch = writeBatch(db);
      let batchCount = 0;
      const now = new Date();

      const qNotifs = query(collection(db, "notifications"), where("linkUrl", "==", `/top/tasks/detail/${taskId}`));
      const notifsSnap = await getDocs(qNotifs);
      notifsSnap.forEach(d => {
        const data = d.data();
        const cTime = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : new Date(data.createdAt).getTime();
        if (cTime > now.getTime() && batchCount < 490) {
          batch.delete(d.ref);
          batchCount++;
        }
      });

      const isImportant = formPriority === "high" || formPriority === "urgent";
      const targets = tenantUsers.filter(u => formAssignees.includes(u.id) || isImportant);

      targets.forEach(u => {
        if (batchCount >= 490) return;
        const notifRef = doc(collection(db, "notifications"));
        batch.set(notifRef, {
          userId: u.id,
          schoolId: userData.schoolId,
          title: isImportant ? `【重要・更新】${formTitle.trim()}` : `【タスク更新】${formTitle.trim()}`,
          body: `${userData.name}さんがタスクの内容を更新しました。`,
          sourceApp: "task",
          linkUrl: `/top/tasks/detail/${taskId}`,
          isRead: false,
          isFlagged: false,
          createdAt: now,
        });
        batchCount++;
      });

      if (formStatus !== "done" && formDueDate) {
        const timeStr = formDueTime || "23:59";
        const dueDateTime = new Date(`${formDueDate}T${timeStr}:00`);
        if (!isNaN(dueDateTime.getTime())) {
          const reminderTime = new Date(dueDateTime.getTime() - 24 * 60 * 60 * 1000);
          
          targets.forEach(u => {
            if (reminderTime > now && batchCount < 490) {
              const remRef = doc(collection(db, "notifications"));
              batch.set(remRef, {
                userId: u.id,
                schoolId: userData.schoolId,
                title: `【期限24時間前】${formTitle.trim()}`,
                body: `このタスクの期限が24時間後に迫っています。`,
                sourceApp: "task",
                linkUrl: `/top/tasks/detail/${taskId}`,
                isRead: false,
                isFlagged: false,
                createdAt: reminderTime,
              });
              batchCount++;
            }
            if (dueDateTime > now && batchCount < 490) {
              const overRef = doc(collection(db, "notifications"));
              batch.set(overRef, {
                userId: u.id,
                schoolId: userData.schoolId,
                title: `【期限切れ】${formTitle.trim()}`,
                body: `このタスクの期限が過ぎました。進捗を確認してください。`,
                sourceApp: "task",
                linkUrl: `/top/tasks/detail/${taskId}`,
                isRead: false,
                isFlagged: false,
                createdAt: dueDateTime,
              });
              batchCount++;
            }
          });
        }
      }

      if (batchCount > 0) await batch.commit();

      setIsEditing(false);
      showToast("success", "タスク内容を更新しました。");
    } catch (error) { 
      showToast("error", "更新に失敗しました。"); 
      console.error(error);
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleDelete = async () => {
    try { await deleteDoc(doc(db, "tasks", taskId)); router.push("/top/tasks"); } 
    catch (error) { showToast("error", "削除に失敗しました。"); }
  };

  const changeTaskStatus = async (newStatus: TaskStatus) => {
    if (!task || !userData || task.status === newStatus) return;
    setStatusModalOpen(false);

    const payload: any = {};
    let finalStatus = newStatus;

    if (newStatus === "done") {
      if (task.assignees.length > 1) {
        if (task.completionRequirement === "leader") {
          if (userData.id !== task.leaderId) { 
            showToast("error", "タスク主任のみ完了報告ができます。"); 
            return; 
          }
        } else if (task.completionRequirement === "all") {
          if (!task.completedBy.includes(userData.id)) {
            const newCompletedBy = [...task.completedBy, userData.id];
            payload.completedBy = newCompletedBy;
            const allDone = task.assignees.every(id => newCompletedBy.includes(id));
            if (!allDone) { 
              finalStatus = task.status; 
              showToast("success", "完了報告を記録しました。全員の報告が必要です。"); 
            } else { 
              showToast("success", "全員の報告が揃い、完了しました！"); 
            }
          } else { 
            showToast("error", "すでに完了報告済みです。"); 
            return; 
          }
        }
      }
    }
    
    // ★ 完了以外に戻す場合は完了日をリセット
    if (task.status === "done" && newStatus !== "done") {
      payload.completedBy = [];
      payload.completedAt = null;
    }
    
    if (finalStatus !== task.status) {
      payload.status = finalStatus;
      // ★ 完了になった場合は完了日を記録
      if (finalStatus === "done") {
        payload.completedAt = new Date().toISOString().split("T")[0];
      }
    }
    
    if (Object.keys(payload).length > 0) {
      try { 
        await updateDoc(doc(db, "tasks", task.id), payload);
        setTask(prev => prev ? { ...prev, ...payload } : null);
        setFormStatus(finalStatus);
        if (payload.completedBy) setFormCompletedBy(payload.completedBy);
      } catch (error) { 
        showToast("error", "ステータス変更に失敗しました。"); 
      }
    }
  };

  // ★ 経過日数の計算ロジック
  const getElapsedDaysText = () => {
    if (!task || !task.startDate) return null;
    const start = new Date(task.startDate);
    start.setHours(0,0,0,0);
    
    const endStr = task.status === "done" && task.completedAt ? task.completedAt : new Date().toISOString().split("T")[0];
    const end = new Date(endStr);
    end.setHours(0,0,0,0);

    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (task.status === "done") {
      return `所要日数: ${diffDays + 1}日`;
    } else {
      return diffDays >= 0 ? `経過日数: ${diffDays}日` : `開始前 (あと${Math.abs(diffDays)}日)`;
    }
  };

  if (isLoading) return <LoadingScreen message="タスク詳細を読み込み中..." />;

  if (!task) return (
    <div className="h-[100dvh] bg-[#F9FAFB] flex flex-col items-center justify-center p-4">
      <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mb-3" />
      <h1 className="text-sm sm:text-base font-black text-gray-800 mb-2">タスクが見つかりませんでした</h1>
      <button onClick={() => router.push("/top/tasks")} className="px-4 py-2 bg-indigo-600 text-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold shadow-sm">一覧に戻る</button>
    </div>
  );

  const isAllRequirement = task.completionRequirement === "all" && task.assignees.length > 1;
  const hasReported = isAllRequirement && task.completedBy.includes(userData?.id || "");

  return (
    <div className="flex-1 h-full w-full bg-[#F9FAFB] font-sans flex flex-col text-gray-900 overflow-hidden relative min-h-0 overscroll-none">

      {toast.show && (
        <div className="absolute top-4 right-4 z-[100] animate-fade-in w-fit max-w-sm">
          <div className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold flex items-center shadow-lg ${toast.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-green-400" /> : <AlertCircle className="w-3.5 h-3.5 mr-1.5" />} {toast.message}
          </div>
        </div>
      )}

      {/* スマホ用戻るボタン（固定領域） */}
      <div className="sm:hidden px-2 pt-2 pb-1 shrink-0">
        <button onClick={() => router.back()} className="flex items-center text-[11px] font-bold text-gray-500 bg-white px-2.5 py-1.5 rounded-lg shadow-2xs border border-gray-200 w-fit transition-colors hover:bg-gray-50">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> 戻る
        </button>
      </div>

      <main className="flex-1 overflow-y-auto custom-scrollbar w-full p-2 sm:p-4 lg:p-6 pb-20 md:pb-6 relative min-h-0">
        <div className="max-w-4xl mx-auto bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-0">
          
          <div className="px-3 sm:px-5 py-3 sm:py-4 bg-gray-50/80 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {!isEditing ? (
                <button 
                  onClick={() => setStatusModalOpen(true)}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold border shadow-2xs hover:opacity-80 transition-opacity flex items-center gap-1.5 ${STATUS_CONFIG[task.status].color}`}
                  title="ステータスを変更"
                >
                  {task.status === "done" && <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                  {STATUS_CONFIG[task.status].label}
                  <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 opacity-60 ml-0.5" />
                </button>
              ) : (
                <span className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-bold border ${STATUS_CONFIG[task.status].color}`}>
                  {STATUS_CONFIG[task.status].label}
                </span>
              )}
              
              <span className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold flex items-center gap-1 border ${PRIORITY_CONFIG[task.priority].color}`}>
                {PRIORITY_CONFIG[task.priority].icon} {PRIORITY_CONFIG[task.priority].label}
              </span>

              {!isEditing && isAllRequirement && (
                <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg text-[9px] sm:text-[10px] font-bold shadow-2xs">
                  完了報告: {task.completedBy.length} / {task.assignees.length} 名
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-2 justify-end">
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold flex items-center transition-colors shadow-2xs">
                  <Edit3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1" /> 編集する
                </button>
              ) : (
                <button onClick={() => { setIsEditing(false); setFormValues(task); }} className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold transition-colors">
                  キャンセル
                </button>
              )}
              <button onClick={() => setDeleteConfirm(true)} className="p-1 sm:p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg sm:rounded-xl transition-colors shadow-2xs" title="削除">
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button onClick={() => router.back()} className="hidden sm:flex p-1 sm:p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg sm:rounded-xl transition-colors ml-1 shadow-2xs" title="戻る">
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {!isEditing ? (
            <div className="p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 flex-1 overflow-y-auto custom-scrollbar">
              <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 leading-snug">{task.title}</h1>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50/80 rounded-xl sm:rounded-2xl border border-gray-100">
                <div className="space-y-1">
                  <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider block">実施期間・期限</span>
                  <div className="text-[10px] sm:text-[11px] font-bold text-gray-800 flex flex-col gap-1 sm:gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500 flex-shrink-0" />
                      {/* ★ 完了日の表示 */}
                      <span>{task.startDate || "開始日未設定"} 〜 {task.status === "done" && task.completedAt ? `${task.completedAt} (完了)` : (task.dueDate || "期限未設定")} {task.status !== "done" ? (task.dueTime || "") : ""}</span>
                    </div>
                    {/* ★ 経過日数の表示 */}
                    {task.startDate && (
                      <div className="text-[9px] font-bold text-gray-500 ml-5">
                        {getElapsedDaysText()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider block">担当メンバー ({task.assignees.length}名)</span>
                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
                    {task.assignees.map(id => {
                      const u = tenantUsers.find(tu => tu.id === id);
                      const isLeader = id === task.leaderId;
                      return (
                        <span key={id} className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-bold border flex items-center gap-1 ${isLeader ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-white text-gray-700 border-gray-200'}`}>
                          {isLeader && <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 fill-current" />}
                          {u?.name || "不明"}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <h3 className="text-[10px] sm:text-[11px] font-bold text-gray-500">詳細メモ・注意事項</h3>
                <div className="p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl border border-gray-100 text-[11px] sm:text-xs leading-relaxed whitespace-pre-wrap font-medium text-gray-800 min-h-[100px] sm:min-h-[120px]">
                  {task.description || "メモはありません。"}
                </div>
              </div>

              {task.status !== "done" && task.assignees.includes(userData?.id || "") && (
                <div className="pt-4 sm:pt-6 flex justify-center">
                   <button 
                     onClick={() => changeTaskStatus("done")}
                     className="px-6 sm:px-8 py-2.5 sm:py-3 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-500 hover:text-white rounded-xl shadow-sm text-[11px] sm:text-xs font-black transition-all flex items-center gap-1.5 sm:gap-2 hover:-translate-y-0.5"
                   >
                     <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                     {isAllRequirement && !hasReported ? "自分の作業の完了を報告する" : "このタスクを「完了」にする"}
                   </button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleUpdate} className="p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 flex-1 overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">タスク名 <span className="text-red-500">*</span></label>
                <input type="text" required value={formTitle} onChange={e => setFormTitle(e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-black text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs transition-shadow" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">ステータス</label>
                  <CustomSelect 
                    value={formStatus} 
                    onChange={(val) => setFormStatus(val as any)}
                    options={Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
                    buttonClassName="w-full bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-bold text-gray-900 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs flex items-center justify-between transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">優先度</label>
                  <CustomSelect 
                    value={formPriority} 
                    onChange={(val) => setFormPriority(val as any)}
                    options={Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
                    buttonClassName="w-full bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-bold text-gray-900 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs flex items-center justify-between transition-colors"
                  />
                </div>
              </div>

              <div className="bg-gray-50/50 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-200 space-y-3 sm:space-y-4">
                <label className="block text-[10px] sm:text-xs font-bold text-gray-700">担当メンバー・タスク主任の設定</label>
                <div className="relative" ref={userSearchRef}>
                  <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input 
                    type="text" placeholder="メンバーを検索して追加..." value={searchUserQuery} 
                    onChange={e => { setSearchUserQuery(e.target.value); setIsSearchUserFocused(true); }}
                    onFocus={() => setIsSearchUserFocused(true)}
                    className="w-full pl-8 sm:pl-9 pr-2.5 sm:pr-3 py-1.5 sm:py-2 bg-white border border-gray-300 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs transition-shadow" 
                  />
                  {isSearchUserFocused && searchUserQuery.trim() !== "" && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 shadow-xl rounded-lg sm:rounded-xl max-h-40 overflow-y-auto z-50 custom-scrollbar">
                      {tenantUsers.filter(u => !formAssignees.includes(u.id) && u.name.toLowerCase().includes(searchUserQuery.toLowerCase())).length === 0 ? (
                        <div className="p-3 text-[10px] sm:text-[11px] text-gray-400 text-center font-bold">該当メンバーが見つかりません</div>
                      ) : (
                        tenantUsers.filter(u => !formAssignees.includes(u.id) && u.name.toLowerCase().includes(searchUserQuery.toLowerCase())).map(u => (
                          <div key={u.id} onClick={() => { setFormAssignees(prev => [...prev, u.id]); setSearchUserQuery(""); setIsSearchUserFocused(false); }} className="px-3 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-[11px] font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer flex items-center gap-1.5 border-b border-gray-50 last:border-0 transition-colors">
                            <UserIcon className="w-3.5 h-3.5 text-gray-400" /> {u.name}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1">
                  {formAssignees.length === 0 ? (
                    <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 px-1 py-0.5">未割り当て</span>
                  ) : (
                    formAssignees.map(id => {
                      const u = tenantUsers.find(user => user.id === id);
                      const isLeader = id === formLeaderId;
                      return (
                        <div key={id} className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border text-[9px] sm:text-[10px] font-bold transition-colors ${isLeader ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-sm' : 'bg-white border-gray-200 text-gray-700'}`}>
                          <span>{u?.name}</span>
                          <button type="button" onClick={() => setFormLeaderId(isLeader ? null : id)} className={`p-0.5 sm:p-1 rounded transition-colors ${isLeader ? 'text-amber-500 hover:bg-amber-100' : 'text-gray-300 hover:text-amber-500 hover:bg-gray-100'}`} title={isLeader ? "タスク主任を解除" : "タスク主任に設定"}><Star className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isLeader ? 'fill-current' : ''}`} /></button>
                          <div className="w-px h-3 sm:h-4 bg-gray-200"></div>
                          <button type="button" onClick={() => { setFormAssignees(prev => prev.filter(aid => aid !== id)); if(isLeader) setFormLeaderId(null); setFormCompletedBy(prev => prev.filter(c => c !== id)); }} className="text-gray-400 hover:text-red-500 transition-colors"><X className="w-3 h-3 sm:w-3.5 sm:h-3.5" /></button>
                        </div>
                      )
                    })
                  )}
                </div>

                {formAssignees.length > 1 && (
                  <div className="pt-3 border-t border-gray-200">
                    <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">完了報告の種類</label>
                    <CustomSelect 
                      value={formCompletionReq} 
                      onChange={(val) => setFormCompletionReq(val as any)}
                      options={[
                        { value: "anyone", label: "誰か一人の完了報告が必要" },
                        { value: "all", label: "全員の完了報告が必要" },
                        ...(formLeaderId ? [{ value: "leader", label: "タスク主任の完了報告が必要" }] : [])
                      ]}
                      buttonClassName="w-full bg-white border border-gray-200 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs transition-colors flex items-center justify-between"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">開始日</label>
                  <input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-gray-900 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs transition-colors" />
                </div>
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">期限 (日付・時間)</label>
                  <div className="flex gap-1.5 sm:gap-2">
                    <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-gray-900 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs transition-colors" />
                    <input type="time" value={formDueTime} onChange={e => setFormDueTime(e.target.value)} className="w-24 sm:w-28 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-gray-900 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs transition-colors" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">詳細メモ (任意)</label>
                <textarea rows={4} value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="タスクの具体的な内容や備考を記入..." className="w-full bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-2 sm:py-3 text-[11px] sm:text-xs font-medium text-gray-900 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500 resize-none custom-scrollbar shadow-2xs transition-colors" />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2 sm:gap-3 pb-4 sm:pb-6">
                <button type="button" onClick={() => { setIsEditing(false); setFormValues(task); }} className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg sm:rounded-xl transition-colors shadow-2xs">キャンセル</button>
                <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto justify-center px-5 sm:px-6 py-2 sm:py-2.5 disabled:opacity-50 text-white text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl shadow-sm bg-amber-600 hover:bg-amber-700 transition-all hover:-translate-y-0.5 flex items-center">
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />} 保存して完了
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* ステータス変更モーダル */}
      {statusModalOpen && task && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-xs flex flex-col overflow-hidden animate-slide-up sm:animate-fade-in border border-gray-100">
            <div className="p-3 sm:p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <div>
                <h3 className="text-[11px] sm:text-sm font-black text-gray-900">ステータスの変更</h3>
                <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 font-bold">現在の状態: <span className="text-gray-700">{STATUS_CONFIG[task.status].label}</span></p>
              </div>
              <button onClick={() => setStatusModalOpen(false)} className="p-1 sm:p-1.5 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors">
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            
            <div className="p-3 sm:p-4 flex flex-col gap-2 sm:gap-2.5 bg-[#FAFAFA]">
              {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map(statusKey => {
                const conf = STATUS_CONFIG[statusKey];
                const isCurrent = task.status === statusKey;
                
                return (
                  <button
                    key={statusKey}
                    onClick={() => changeTaskStatus(statusKey)}
                    disabled={isCurrent}
                    className={`w-full text-left flex items-center justify-between p-2.5 sm:p-3.5 rounded-lg sm:rounded-xl border-2 transition-all ${
                      isCurrent 
                        ? `${conf.color.replace('border-', 'border-')} border-current bg-white opacity-50 cursor-default shadow-sm` 
                        : `border-gray-200 bg-white hover:${conf.color.split(' ')[0]} hover:border-${conf.color.split(' ')[2].split('-')[1]}-300 shadow-sm`
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${conf.iconColor.replace('text-', 'bg-')}`}></div>
                      <span className={`text-[11px] sm:text-sm font-black ${isCurrent ? 'text-gray-900' : 'text-gray-700'}`}>{conf.label}</span>
                    </div>
                    {isCurrent && <span className="text-[9px] sm:text-[10px] font-bold text-gray-400">現在</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-2xl max-w-xs sm:max-w-sm w-full space-y-3 sm:space-y-4">
            <h3 className="text-xs sm:text-sm font-black text-gray-900">このタスクを削除しますか？</h3>
            <p className="text-[10px] sm:text-[11px] text-gray-500 font-bold leading-relaxed">削除されたデータは復元できません。</p>
            <div className="flex justify-end gap-1.5 sm:gap-2 pt-2">
              <button onClick={() => setDeleteConfirm(false)} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] sm:text-[11px] font-bold rounded-lg sm:rounded-xl transition-colors shadow-2xs">キャンセル</button>
              <button onClick={handleDelete} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white text-[10px] sm:text-[11px] font-bold rounded-lg sm:rounded-xl shadow-sm transition-colors">削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}