"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, addDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ArrowLeft, CheckCircle2, AlertCircle, Search, User as UserIcon, Loader2, Star, X, CheckSquare } from "lucide-react";
import CustomSelect from "@/components/CustomSelect"; // ★ CustomSelect をインポート

type UserData = { id: string; name: string; schoolId: string; role: string; };
type TaskStatus = "not_started" | "in_progress" | "waiting" | "pending" | "done";
type TaskPriority = "urgent" | "high" | "medium" | "low";
type CompletionReq = "anyone" | "all" | "leader";

const STATUS_CONFIG: Record<TaskStatus, { label: string }> = {
  not_started: { label: "未着手" }, in_progress: { label: "進行中" }, waiting: { label: "確認待ち" }, pending: { label: "保留" }, done: { label: "完了" },
};
const PRIORITY_CONFIG: Record<TaskPriority, { label: string }> = {
  urgent: { label: "緊急" }, high: { label: "高" }, medium: { label: "中" }, low: { label: "低" },
};

export default function NewTaskPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
  
  const [searchUserQuery, setSearchUserQuery] = useState("");
  const [isSearchUserFocused, setIsSearchUserFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{show:boolean, type:"success"|"error", message:string}>({show:false, type:"success", message:""});
  const userSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocSnap = await getDoc(doc(db, "users", user.uid));
          if (!userDocSnap.exists()) { router.push("/login"); return; }
          const data = { id: user.uid, ...userDocSnap.data() } as UserData;
          setUserData(data);

          const qUsers = query(collection(db, "users"), where("schoolId", "==", data.schoolId));
          const usersSnap = await getDocs(qUsers);
          const usersList: UserData[] = [];
          usersSnap.forEach(d => usersList.push({ id: d.id, ...d.data() } as UserData));
          setTenantUsers(usersList);

          if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const initStatus = params.get("status") as TaskStatus;
            const initAssignee = params.get("assignee");
            const initStart = params.get("startDate");

            if (initStatus && STATUS_CONFIG[initStatus]) setFormStatus(initStatus);
            if (initAssignee) setFormAssignees([initAssignee]);
            else setFormAssignees([data.id]);
            if (initStart) setFormStartDate(initStart);
          }
        } catch (error) { console.error(error); } finally { setIsLoading(false); }
      } else { router.push("/login"); }
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userSearchRef.current && !userSearchRef.current.contains(e.target as Node)) setIsSearchUserFocused(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => { if (!formLeaderId && formCompletionReq === "leader") setFormCompletionReq("anyone"); }, [formLeaderId, formCompletionReq]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !userData) return;
    setIsSubmitting(true);

    try {
      const taskRef = await addDoc(collection(db, "tasks"), {
        title: formTitle.trim(), description: formDesc.trim(), status: formStatus, priority: formPriority,
        startDate: formStartDate || null, dueDate: formDueDate || null, dueTime: formDueTime || null,
        assignees: formAssignees, leaderId: formAssignees.includes(formLeaderId || "") ? formLeaderId : null,
        completionRequirement: formAssignees.length > 1 ? formCompletionReq : "anyone",
        completedBy: [], schoolId: userData.schoolId, creatorId: userData.id, createdAt: serverTimestamp(),
      });

      const taskId = taskRef.id;

      // 通知のバッチ処理
      const batch = writeBatch(db);
      let batchCount = 0;
      const now = new Date();
      
      const isImportant = formPriority === "high" || formPriority === "urgent";
      const targets = tenantUsers.filter(u => formAssignees.includes(u.id) || isImportant);

      targets.forEach(u => {
        if (batchCount >= 490) return;
        const notifRef = doc(collection(db, "notifications"));
        batch.set(notifRef, {
          userId: u.id,
          schoolId: userData.schoolId,
          title: isImportant ? `【重要・新規タスク】${formTitle.trim()}` : `【新規タスク】${formTitle.trim()}`,
          body: `${userData.name}さんが新しいタスクを作成しました。`,
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

      router.back();
    } catch (error) { 
      setToast({ show: true, type: "error", message: "作成に失敗しました。" }); 
      setIsSubmitting(false); 
    }
  };

  if (isLoading) return <div className="h-full bg-[#F9FAFB] flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="h-full flex-1 w-full bg-[#F9FAFB] font-sans flex flex-col text-gray-900 overflow-y-auto custom-scrollbar relative">

      {toast.show && (
        <div className="fixed top-4 right-4 z-[100] animate-fade-in w-fit max-w-sm">
          <div className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold flex items-center shadow-lg bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-3.5 h-3.5 mr-1.5" /> {toast.message}
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto w-full p-2 sm:p-4 lg:p-6 flex flex-col gap-3 sm:gap-4 pb-20">
        
        <button onClick={() => router.back()} className="sm:hidden flex items-center text-[11px] font-bold text-gray-500 bg-white px-2.5 py-1.5 rounded-lg shadow-2xs border border-gray-200 w-fit mt-1 ml-1 transition-colors hover:bg-gray-50">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> 戻る
        </button>

        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 overflow-visible relative">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between gap-2 shrink-0 rounded-t-xl sm:rounded-t-2xl">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
              <h1 className="text-xs sm:text-sm font-black text-gray-900">新規タスク作成</h1>
            </div>
            <button onClick={() => router.back()} className="hidden sm:flex items-center text-[10px] sm:text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors">
              キャンセル
            </button>
          </div>
          
          <form onSubmit={handleSave} className="p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-5">
            <div>
              <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">タスク名 <span className="text-red-500">*</span></label>
              <input type="text" required autoFocus value={formTitle} onChange={e => setFormTitle(e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-black text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs transition-shadow" placeholder="例: 体育館の機材チェック" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">ステータス</label>
                <CustomSelect 
                  value={formStatus} 
                  onChange={(val) => setFormStatus(val as any)}
                  options={Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
                  buttonClassName="w-full bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-bold text-gray-900 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs transition-colors flex items-center justify-between"
                />
              </div>
              <div>
                <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">優先度</label>
                <CustomSelect 
                  value={formPriority} 
                  onChange={(val) => setFormPriority(val as any)}
                  options={Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
                  buttonClassName="w-full bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-bold text-gray-900 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs transition-colors flex items-center justify-between"
                />
              </div>
            </div>

            <div className="bg-gray-50/50 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-200 space-y-3 sm:space-y-4">
              <label className="block text-[10px] sm:text-xs font-bold text-gray-700">担当メンバー・タスク主任の設定</label>
              <div className="relative" ref={userSearchRef}>
                <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input type="text" placeholder="メンバーを検索して追加..." value={searchUserQuery} onChange={e => { setSearchUserQuery(e.target.value); setIsSearchUserFocused(true); }} onFocus={() => setIsSearchUserFocused(true)} className="w-full pl-8 sm:pl-9 pr-2.5 sm:pr-3 py-1.5 sm:py-2 bg-white border border-gray-200 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs transition-shadow" />
                {isSearchUserFocused && searchUserQuery.trim() !== "" && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 shadow-xl rounded-xl max-h-48 overflow-y-auto z-50 custom-scrollbar">
                    {tenantUsers.filter(u => !formAssignees.includes(u.id) && u.name.toLowerCase().includes(searchUserQuery.toLowerCase())).length === 0 ? (
                      <div className="p-3 sm:p-4 text-[10px] sm:text-xs text-gray-400 text-center font-bold">該当メンバーが見つかりません</div>
                    ) : (
                      tenantUsers.filter(u => !formAssignees.includes(u.id) && u.name.toLowerCase().includes(searchUserQuery.toLowerCase())).map(u => (
                        <div key={u.id} onClick={() => { setFormAssignees(prev => [...prev, u.id]); setSearchUserQuery(""); setIsSearchUserFocused(false); }} className="px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer flex items-center gap-1.5 sm:gap-2 border-b border-gray-50 last:border-0 transition-colors">
                          <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" /> {u.name}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1">
                {formAssignees.length === 0 ? <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 px-1 py-0.5">未割り当て</span> : (
                  formAssignees.map(id => {
                    const u = tenantUsers.find(user => user.id === id);
                    const isLeader = id === formLeaderId;
                    return (
                      <div key={id} className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border text-[9px] sm:text-[11px] font-bold transition-colors ${isLeader ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-sm' : 'bg-white border-gray-200 text-gray-700'}`}>
                        <span>{u?.name}</span>
                        <button type="button" onClick={() => setFormLeaderId(isLeader ? null : id)} className={`p-0.5 sm:p-1 rounded transition-colors ${isLeader ? 'text-amber-500 hover:bg-amber-100' : 'text-gray-300 hover:text-amber-500 hover:bg-gray-100'}`} title={isLeader ? "タスク主任を解除" : "タスク主任に設定"}><Star className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isLeader ? 'fill-current' : ''}`} /></button>
                        <div className="w-px h-3 sm:h-4 bg-gray-200"></div>
                        <button type="button" onClick={() => { setFormAssignees(prev => prev.filter(aid => aid !== id)); if(isLeader) setFormLeaderId(null); }} className="p-0.5 sm:p-1 text-gray-400 hover:text-red-500 transition-colors"><X className="w-3 h-3 sm:w-3.5 sm:h-3.5" /></button>
                      </div>
                    )
                  })
                )}
              </div>

              {formAssignees.length > 1 && (
                <div className="pt-3 sm:pt-4 border-t border-gray-200">
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

            <div className="pt-3 border-t border-gray-100 flex justify-end pb-4 sm:pb-6">
              <button type="submit" disabled={isSubmitting || !formTitle.trim()} className="w-full sm:w-auto justify-center px-6 sm:px-8 py-2.5 sm:py-2.5 disabled:opacity-50 text-white text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl shadow-md bg-indigo-600 hover:bg-indigo-700 transition-all hover:-translate-y-0.5 flex items-center">
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />} 作成する
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}