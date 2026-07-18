"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ユーザーデータの型定義
type UserData = {
  name: string;
  schoolId: string;
  role: string;
};

// 承認（稟議）データの型定義
type Approval = {
  id: string;
  title: string;
  content: string;
  authorName: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date | null;
};

// UIアラートの型定義
type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

// 確認モーダルの型定義
type ConfirmModalState = {
  show: boolean;
  action: "approve" | "reject" | "delete" | null;
  targetId: string | null;
};

export default function ApprovalsPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 新規申請フォーム用ステート
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // UIアラートと確認モーダル用ステート
  const [alert, setAlert] = useState<AlertState>({ show: false, type: "success", message: "" });
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({ show: false, action: null, targetId: null });

  useEffect(() => {
    let unsubscribeApprovals: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const data = userDocSnap.data() as UserData;
            setUserData(data);

            // 所属学校の稟議データをリアルタイム取得
            const approvalsRef = collection(db, "approvals");
            const q = query(
              approvalsRef,
              where("schoolId", "==", data.schoolId),
              orderBy("createdAt", "desc")
            );

            unsubscribeApprovals = onSnapshot(q, (snapshot) => {
              const fetchedApprovals: Approval[] = [];
              snapshot.forEach((docSnap) => {
                const docData = docSnap.data();
                fetchedApprovals.push({
                  id: docSnap.id,
                  title: docData.title,
                  content: docData.content,
                  authorName: docData.authorName,
                  status: docData.status,
                  createdAt: docData.createdAt ? docData.createdAt.toDate() : null,
                });
              });
              setApprovals(fetchedApprovals);
              setIsLoading(false);
            });
          } else {
            router.push("/login");
          }
        } catch (error) {
          console.error("Error fetching data:", error);
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

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => {
      setAlert((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  const handleAddApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTitle.trim() || !newContent.trim()) {
      showAlert("error", "件名と申請内容を入力してください。");
      return;
    }

    if (!userData) return;

    setIsSubmitting(true);

    try {
      await addDoc(collection(db, "approvals"), {
        schoolId: userData.schoolId,
        title: newTitle.trim(),
        content: newContent.trim(),
        authorName: userData.name,
        status: "pending", // 初期ステータスは審査中
        createdAt: serverTimestamp(),
      });

      setNewTitle("");
      setNewContent("");
      showAlert("success", "新しい稟議を申請しました。");
    } catch (error) {
      console.error("Error adding approval:", error);
      showAlert("error", "申請に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeAction = async () => {
    if (!confirmModal.targetId || !confirmModal.action) return;

    try {
      const approvalRef = doc(db, "approvals", confirmModal.targetId);

      if (confirmModal.action === "approve") {
        await updateDoc(approvalRef, { status: "approved" });
        showAlert("success", "申請を承認しました。");
      } else if (confirmModal.action === "reject") {
        await updateDoc(approvalRef, { status: "rejected" });
        showAlert("success", "申請を却下しました。");
      } else if (confirmModal.action === "delete") {
        await deleteDoc(approvalRef);
        showAlert("success", "申請を取り下げ（削除）しました。");
      }
    } catch (error) {
      console.error("Error executing action:", error);
      showAlert("error", "処理に失敗しました。");
    } finally {
      setConfirmModal({ show: false, action: null, targetId: null });
    }
  };

  const openConfirmModal = (action: "approve" | "reject" | "delete", targetId: string) => {
    setConfirmModal({ show: true, action, targetId });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "送信中...";
    return new Intl.DateTimeFormat("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">審査中</span>;
      case "approved":
        return <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">承認済</span>;
      case "rejected":
        return <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 border border-red-200">却下</span>;
      default:
        return null;
    }
  };

  const getModalContent = () => {
    switch (confirmModal.action) {
      case "approve":
        return { title: "承認の確認", text: "この申請を「承認済」にします。よろしいですか？", btnClass: "bg-green-600 hover:bg-green-700", btnText: "承認する" };
      case "reject":
        return { title: "却下の確認", text: "この申請を「却下」にします。よろしいですか？", btnClass: "bg-yellow-600 hover:bg-yellow-700", btnText: "却下する" };
      case "delete":
        return { title: "取り下げの確認", text: "この申請を取り下げ（削除）します。この操作は元に戻せません。", btnClass: "bg-red-600 hover:bg-red-700", btnText: "削除する" };
      default:
        return { title: "", text: "", btnClass: "", btnText: "" };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 font-medium text-sm">読み込み中...</div>
      </div>
    );
  }

  const modalInfo = getModalContent();

  return (
    <div className="min-h-screen bg-gray-100 pb-12 relative">
      {/* 汎用確認モーダル (UIアラート) */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{modalInfo.title}</h3>
            <p className="text-sm text-gray-500 mb-6">{modalInfo.text}</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirmModal({ show: false, action: null, targetId: null })}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                キャンセル
              </button>
              <button
                onClick={executeAction}
                className={`px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white focus:outline-none ${modalInfo.btnClass}`}
              >
                {modalInfo.btnText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 truncate">電子承認・稟議</h1>
          <button
            onClick={() => router.push("/top")}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            &larr; トップに戻る
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* UIアラート */}
        {alert.show && (
          <div
            className={`mb-6 p-4 rounded-md text-sm shadow-sm ${
              alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {alert.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 左カラム：新規申請フォーム */}
          <div className="lg:col-span-4">
            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">新規稟議の申請</h3>
                <form onSubmit={handleAddApproval} className="space-y-4">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      件名 <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        id="title"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        required
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border text-gray-900"
                        placeholder="例: 文化祭備品購入の件"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="content" className="block text-sm font-medium text-gray-700">
                      申請内容・理由 <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <textarea
                        id="content"
                        rows={6}
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        required
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border text-gray-900"
                        placeholder="購入希望の品名、金額、理由などを詳細に記載してください。Google Driveの資料URLを貼ることも可能です。"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                      isSubmitting ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    }`}
                  >
                    {isSubmitting ? "申請中..." : "申請を提出する"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* 右カラム：申請一覧 */}
          <div className="lg:col-span-8">
            <div className="bg-white shadow sm:rounded-lg overflow-hidden">
              <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">申請一覧</h3>
              </div>
              
              {approvals.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  現在、申請されている稟議はありません。
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {approvals.map((approval) => (
                    <li key={approval.id} className="p-4 sm:px-6 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        {/* 申請内容 */}
                        <div className="flex-1 min-w-0 mb-4 sm:mb-0 pr-4">
                          <div className="flex items-center space-x-3 mb-2">
                            {getStatusBadge(approval.status)}
                            <span className="text-xs text-gray-500">
                              申請日: {formatDate(approval.createdAt)}
                            </span>
                            <span className="text-xs text-gray-500 truncate">
                              申請者: {approval.authorName}
                            </span>
                          </div>
                          <h4 className="text-md font-bold text-gray-900 mb-1">
                            {approval.title}
                          </h4>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-100">
                            {approval.content}
                          </p>
                        </div>
                        
                        {/* 操作ボタン */}
                        <div className="flex sm:flex-col items-center justify-end sm:items-end space-x-2 sm:space-x-0 sm:space-y-2 shrink-0 border-t sm:border-t-0 pt-4 sm:pt-0 mt-2 sm:mt-0">
                          {approval.status === "pending" && (
                            <>
                              <button
                                onClick={() => openConfirmModal("approve", approval.id)}
                                className="w-full sm:w-auto px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-green-600 hover:bg-green-700"
                              >
                                承認する
                              </button>
                              <button
                                onClick={() => openConfirmModal("reject", approval.id)}
                                className="w-full sm:w-auto px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-yellow-600 hover:bg-yellow-700"
                              >
                                却下する
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openConfirmModal("delete", approval.id)}
                            className="w-full sm:w-auto px-3 py-1.5 border border-gray-300 text-xs font-medium rounded shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                          >
                            取り下げ(削除)
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}