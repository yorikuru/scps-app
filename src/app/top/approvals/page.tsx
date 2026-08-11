"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { 
  FileCheck2, 
  Plus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Search, 
  Filter, 
  User, 
  Calendar, 
  FileText, 
  Loader2, 
  AlertCircle, 
  X, 
  Check, 
  ChevronRight, 
  Sparkles,
  UserCheck
} from "lucide-react";

// ----------------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------------
type UserData = {
  name: string;
  schoolId: string;
  role: string;
  [key: string]: any;
};

type ApprovalStatus = "pending" | "approved" | "rejected";

type Approval = {
  id: string;
  schoolId: string;
  title: string;
  content: string;
  authorName: string;
  authorId?: string;
  status: ApprovalStatus;
  createdAt: Date | null;
  updatedAt?: Date | null;
};

type FilterTab = "all" | "pending" | "approved" | "rejected" | "my";

type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

type ConfirmModalState = {
  show: boolean;
  action: "approve" | "reject" | "delete" | null;
  targetId: string | null;
  title?: string;
};

export default function ApprovalsPage() {
  const router = useRouter();
  
  // 認証・ユーザーデータ
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // フィルター・検索ステート
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // 新規申請フォームステート
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 閲覧詳細モーダルステート
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);

  // 通知・確認モーダルステート
  const [alert, setAlert] = useState<AlertState>({ show: false, type: "success", message: "" });
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({ show: false, action: null, targetId: null });

  // ----------------------------------------------------------------------
  // Auth & Firestore リリアルタイム監視
  // ----------------------------------------------------------------------
  useEffect(() => {
    let unsubscribeApprovals: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const data = userDocSnap.data() as UserData;
            setUserData(data);

            const approvalsRef = collection(db, "approvals");
            const q = query(
              approvalsRef,
              where("schoolId", "==", data.schoolId),
              orderBy("createdAt", "desc")
            );

            unsubscribeApprovals = onSnapshot(q, (snapshot) => {
              const fetched: Approval[] = [];
              snapshot.forEach((docSnap) => {
                const d = docSnap.data();
                fetched.push({
                  id: docSnap.id,
                  schoolId: d.schoolId,
                  title: d.title || "",
                  content: d.content || "",
                  authorName: d.authorName || "不明",
                  authorId: d.authorId || "",
                  status: d.status || "pending",
                  createdAt: d.createdAt ? d.createdAt.toDate() : null,
                  updatedAt: d.updatedAt ? d.updatedAt.toDate() : null,
                });
              });
              setApprovals(fetched);
              setIsLoading(false);
            }, (err) => {
              console.error("Firestore Listener Error:", err);
              setIsLoading(false);
            });
          } else {
            router.push("/login");
          }
        } catch (error) {
          console.error("Error fetching user doc:", error);
          setIsLoading(false);
        }
      } else {
        router.push("/login");
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeApprovals) unsubscribeApprovals();
    };
  }, [router]);

  // ----------------------------------------------------------------------
  // 共通通知アラート表示
  // ----------------------------------------------------------------------
  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => {
      setAlert((prev) => ({ ...prev, show: false }));
    }, 3500);
  };

  // ----------------------------------------------------------------------
  // フィルタリング処理
  // ----------------------------------------------------------------------
  const filteredApprovals = useMemo(() => {
    return approvals.filter((item) => {
      // タブフィルター
      if (activeTab === "pending" && item.status !== "pending") return false;
      if (activeTab === "approved" && item.status !== "approved") return false;
      if (activeTab === "rejected" && item.status !== "rejected") return false;
      if (activeTab === "my" && item.authorId !== currentUserId) return false;

      // キーワード検索フィルター
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(query);
        const matchContent = item.content.toLowerCase().includes(query);
        const matchAuthor = item.authorName.toLowerCase().includes(query);
        return matchTitle || matchContent || matchAuthor;
      }

      return true;
    });
  }, [approvals, activeTab, searchQuery, currentUserId]);

  // 各ステータスの件数カウント
  const counts = useMemo(() => {
    return {
      all: approvals.length,
      pending: approvals.filter((a) => a.status === "pending").length,
      approved: approvals.filter((a) => a.status === "approved").length,
      rejected: approvals.filter((a) => a.status === "rejected").length,
      my: approvals.filter((a) => a.authorId === currentUserId).length,
    };
  }, [approvals, currentUserId]);

  // ----------------------------------------------------------------------
  // 稟議申請の提出
  // ----------------------------------------------------------------------
  const handleAddApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTitle.trim() || !newContent.trim()) {
      showAlert("error", "件名と申請内容を入力してください。");
      return;
    }

    if (!userData || !currentUserId) return;

    setIsSubmitting(true);

    try {
      await addDoc(collection(db, "approvals"), {
        schoolId: userData.schoolId,
        title: newTitle.trim(),
        content: newContent.trim(),
        authorName: userData.name,
        authorId: currentUserId,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNewTitle("");
      setNewContent("");
      setIsCreateModalOpen(false);
      showAlert("success", "新しい稟議を申請しました。");
    } catch (error) {
      console.error("Error adding approval:", error);
      showAlert("error", "申請に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------------------------------------
  // ステータス変更・削除実行
  // ----------------------------------------------------------------------
  const executeAction = async () => {
    if (!confirmModal.targetId || !confirmModal.action) return;

    try {
      const approvalRef = doc(db, "approvals", confirmModal.targetId);

      if (confirmModal.action === "approve") {
        await updateDoc(approvalRef, { 
          status: "approved",
          updatedAt: serverTimestamp() 
        });
        showAlert("success", "申請を「承認済」に更新しました。");
      } else if (confirmModal.action === "reject") {
        await updateDoc(approvalRef, { 
          status: "rejected",
          updatedAt: serverTimestamp() 
        });
        showAlert("success", "申請を「却下」に更新しました。");
      } else if (confirmModal.action === "delete") {
        await deleteDoc(approvalRef);
        showAlert("success", "申請を取り下げ（削除）しました。");
        if (selectedApproval?.id === confirmModal.targetId) {
          setSelectedApproval(null);
        }
      }
    } catch (error) {
      console.error("Error executing action:", error);
      showAlert("error", "処理に失敗しました。");
    } finally {
      setConfirmModal({ show: false, action: null, targetId: null });
    }
  };

  const openConfirmModal = (action: "approve" | "reject" | "delete", targetId: string, title?: string) => {
    setConfirmModal({ show: true, action, targetId, title });
  };

  // ----------------------------------------------------------------------
  // ヘルパー関数
  // ----------------------------------------------------------------------
  const formatDate = (date: Date | null) => {
    if (!date) return "処理中...";
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getStatusBadge = (status: ApprovalStatus) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
            <Clock className="w-3 h-3 mr-1 animate-pulse" /> 審査中
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
            <CheckCircle2 className="w-3 h-3 mr-1" /> 承認済
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
            <XCircle className="w-3 h-3 mr-1" /> 却下
          </span>
        );
    }
  };

  const modalInfo = useMemo(() => {
    switch (confirmModal.action) {
      case "approve":
        return {
          title: "稟議の承認",
          text: `「${confirmModal.title || "この申請"}」を承認します。よろしいですか？`,
          btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20",
          btnText: "承認する",
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        };
      case "reject":
        return {
          title: "稟議の却下",
          text: `「${confirmModal.title || "この申請"}」を却下します。よろしいですか？`,
          btnClass: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20",
          btnText: "却下する",
          icon: <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
        };
      case "delete":
        return {
          title: "申請の取り下げ（削除）",
          text: `「${confirmModal.title || "この申請"}」を取り下げて削除します。この操作は元に戻せません。`,
          btnClass: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20",
          btnText: "削除する",
          icon: <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
        };
      default:
        return { title: "", text: "", btnClass: "", btnText: "", icon: null };
    }
  }, [confirmModal]);

  // ----------------------------------------------------------------------
  // ローディング画面
  // ----------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400 mb-3" />
        <p className="text-sm font-bold tracking-wide">稟議ワークフローを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200 pb-16">
      
      {/* トーストアラート */}
      {alert.show && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-3 duration-300">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-bold ${
              alert.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800"
            }`}
          >
            {alert.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{alert.message}</span>
          </div>
        </div>
      )}

      {/* ヘッダーセクション */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-2xs">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                  稟議・ワークフロー
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                    Approvals
                  </span>
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  生徒会・校内予算や行事企画の電子申請と承認・決裁管理
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all"
            >
              <Plus className="w-4 h-4" />
              新規稟議を申請する
            </button>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* コントロールバー（検索 & フィルタータブ） */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          {/* タブ切り替え */}
          <div className="flex items-center gap-1 bg-gray-200/60 dark:bg-gray-900/80 p-1 rounded-xl overflow-x-auto border border-gray-200/50 dark:border-gray-800 scrollbar-none">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "all"
                  ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-2xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              すべて
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("pending")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "pending"
                  ? "bg-white dark:bg-gray-800 text-amber-600 dark:text-amber-400 shadow-2xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              審査中
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                {counts.pending}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("approved")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "approved"
                  ? "bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-2xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              承認済
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                {counts.approved}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("rejected")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "rejected"
                  ? "bg-white dark:bg-gray-800 text-rose-600 dark:text-rose-400 shadow-2xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-rose-600 dark:hover:text-rose-400"
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              却下
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                {counts.rejected}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("my")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "my"
                  ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              自分の申請
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                {counts.my}
              </span>
            </button>
          </div>

          {/* 検索入力 */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="件名・内容・申請者で検索..."
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 稟議カードグリッド */}
        {filteredApprovals.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center shadow-2xs">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
              該当する稟議申請が見つかりません
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              検索条件を変更するか、左上のボタンから新しい稟議を提出してください。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredApprovals.map((approval) => {
              const isOwner = approval.authorId === currentUserId;
              
              return (
                <div
                  key={approval.id}
                  onClick={() => setSelectedApproval(approval)}
                  className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700/60 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden"
                >
                  {/* アタッチバー（ステータスカラー） */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 ${
                      approval.status === "pending"
                        ? "bg-amber-500"
                        : approval.status === "approved"
                        ? "bg-emerald-500"
                        : "bg-rose-500"
                    }`}
                  />

                  <div>
                    {/* カードヘッダー */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      {getStatusBadge(approval.status)}
                      <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(approval.createdAt)}
                      </span>
                    </div>

                    {/* タイトル */}
                    <h3 className="text-base font-extrabold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 mb-2 leading-snug">
                      {approval.title}
                    </h3>

                    {/* 申請本文のプレビュー */}
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 mb-4 leading-relaxed bg-gray-50/60 dark:bg-gray-800/40 p-3 rounded-xl border border-gray-100 dark:border-gray-800/60">
                      {approval.content}
                    </p>
                  </div>

                  {/* カードフッター */}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 font-medium">
                      <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate max-w-[120px]">{approval.authorName}</span>
                      {isOwner && (
                        <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.2 rounded font-bold">
                          自分
                        </span>
                      )}
                    </div>

                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform flex items-center">
                      詳細 <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ---------------------------------------------------------------------- */}
      /* 閲覧・詳細モーダル */
      {/* ---------------------------------------------------------------------- */}
      {selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* モーダルヘッダー */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between bg-gray-50/50 dark:bg-gray-900/50">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  {getStatusBadge(selectedApproval.status)}
                  <span className="text-xs font-bold text-gray-400">
                    ID: {selectedApproval.id.slice(0, 8)}
                  </span>
                </div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white leading-snug">
                  {selectedApproval.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedApproval(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* モーダルボディ */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* メタ情報 */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 text-xs">
                <div>
                  <span className="text-gray-400 block mb-1 font-bold">申請者</span>
                  <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    {selectedApproval.authorName}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 block mb-1 font-bold">申請日時</span>
                  <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    {formatDate(selectedApproval.createdAt)}
                  </div>
                </div>
              </div>

              {/* 申請本文 */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  申請内容・理由
                </h4>
                <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed border border-gray-100 dark:border-gray-800/80">
                  {selectedApproval.content}
                </div>
              </div>
            </div>

            {/* モーダルアクションフッター */}
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <button
                  onClick={() => openConfirmModal("delete", selectedApproval.id, selectedApproval.title)}
                  className="inline-flex items-center px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  申請を取り下げ（削除）
                </button>
              </div>

              {selectedApproval.status === "pending" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const id = selectedApproval.id;
                      const title = selectedApproval.title;
                      setSelectedApproval(null);
                      openConfirmModal("reject", id, title);
                    }}
                    className="inline-flex items-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1.5" />
                    却下する
                  </button>
                  <button
                    onClick={() => {
                      const id = selectedApproval.id;
                      const title = selectedApproval.title;
                      setSelectedApproval(null);
                      openConfirmModal("approve", id, title);
                    }}
                    className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    承認する
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      /* 新規稟議申請モーダル */
      {/* ---------------------------------------------------------------------- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                  新規稟議の申請
                </h2>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddApproval} className="p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <label htmlFor="title" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  件名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  placeholder="例: 文化祭備品購入に関する承認の件"
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              <div>
                <label htmlFor="content" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  申請内容・理由 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="content"
                  rows={6}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  required
                  placeholder="購入希望の物品名、概算金額、使用目的、購入理由などを詳しく記入してください。関連資料（GoogleドライブのURL等）も記載可能です。"
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all leading-relaxed"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      送信中...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1.5" />
                      申請を提出する
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      /* 汎用確認ダイアログ (承認・却下・削除) */
      {/* ---------------------------------------------------------------------- */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              {modalInfo.icon}
            </div>
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white mb-2">
              {modalInfo.title}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              {modalInfo.text}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setConfirmModal({ show: false, action: null, targetId: null })}
                className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={executeAction}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${modalInfo.btnClass}`}
              >
                {modalInfo.btnText}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}