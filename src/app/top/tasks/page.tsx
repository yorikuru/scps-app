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

// タスクデータの型定義
type Task = {
  id: string;
  title: string;
  description: string;
  assignee: string;
  status: "todo" | "in_progress" | "done";
  createdAt: Date | null;
};

// UIアラートの型定義
type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

export default function TasksPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 新規タスク追加フォーム用ステート
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // UIアラートと削除確認モーダル用ステート
  const [alert, setAlert] = useState<AlertState>({ show: false, type: "success", message: "" });
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeTasks: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const data = userDocSnap.data() as UserData;
            setUserData(data);
            setNewAssignee(data.name); // デフォルトの担当者を自分にしておく

            // 所属学校のタスクをリアルタイム取得
            const tasksRef = collection(db, "tasks");
            const q = query(
              tasksRef,
              where("schoolId", "==", data.schoolId),
              orderBy("createdAt", "desc")
            );

            unsubscribeTasks = onSnapshot(q, (snapshot) => {
              const fetchedTasks: Task[] = [];
              snapshot.forEach((docSnap) => {
                const docData = docSnap.data();
                fetchedTasks.push({
                  id: docSnap.id,
                  title: docData.title,
                  description: docData.description,
                  assignee: docData.assignee,
                  status: docData.status,
                  createdAt: docData.createdAt ? docData.createdAt.toDate() : null,
                });
              });
              setTasks(fetchedTasks);
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
      if (unsubscribeTasks) unsubscribeTasks();
    };
  }, [router]);

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => {
      setAlert((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTitle.trim()) {
      showAlert("error", "タスク名を入力してください。");
      return;
    }

    if (!userData) return;

    setIsSubmitting(true);

    try {
      await addDoc(collection(db, "tasks"), {
        schoolId: userData.schoolId,
        title: newTitle.trim(),
        description: newDescription.trim(),
        assignee: newAssignee.trim() || "未定",
        status: "todo",
        createdAt: serverTimestamp(),
      });

      setNewTitle("");
      setNewDescription("");
      showAlert("success", "新しいタスクを追加しました。");
    } catch (error) {
      console.error("Error adding task:", error);
      showAlert("error", "タスクの追加に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, { status: newStatus });
      showAlert("success", "ステータスを更新しました。");
    } catch (error) {
      console.error("Error updating status:", error);
      showAlert("error", "ステータスの更新に失敗しました。");
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    
    try {
      const taskRef = doc(db, "tasks", taskToDelete);
      await deleteDoc(taskRef);
      showAlert("success", "タスクを削除しました。");
    } catch (error) {
      console.error("Error deleting task:", error);
      showAlert("error", "タスクの削除に失敗しました。");
    } finally {
      setTaskToDelete(null);
    }
  };

  // ステータスに応じたバッジの色を決定する関数
  const getStatusColor = (status: string) => {
    switch (status) {
      case "todo": return "bg-gray-100 text-gray-800";
      case "in_progress": return "bg-blue-100 text-blue-800";
      case "done": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "todo": return "未着手";
      case "in_progress": return "進行中";
      case "done": return "完了";
      default: return "不明";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 font-medium text-sm">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-12 relative">
      {/* 削除確認モーダル (UIアラートの一環) */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-2">タスクの削除</h3>
            <p className="text-sm text-gray-500 mb-6">
              このタスクを削除してもよろしいですか？この操作は元に戻せません。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setTaskToDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteTask}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 truncate">タスク・プロジェクト管理</h1>
          <button
            onClick={() => router.push("/top")}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            &larr; トップに戻る
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 左カラム：新規タスク追加フォーム */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">新規タスク追加</h3>
                <form onSubmit={handleAddTask} className="space-y-4">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      タスク名 <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        id="title"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        required
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border text-gray-900"
                        placeholder="例: 文化祭パンフレット作成"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      詳細・メモ
                    </label>
                    <div className="mt-1">
                      <textarea
                        id="description"
                        rows={3}
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border text-gray-900"
                        placeholder="具体的な作業内容など..."
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="assignee" className="block text-sm font-medium text-gray-700">
                      担当者
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        id="assignee"
                        value={newAssignee}
                        onChange={(e) => setNewAssignee(e.target.value)}
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border text-gray-900"
                        placeholder="例: 広報委員会"
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
                    {isSubmitting ? "追加中..." : "タスクを追加する"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* 右カラム：タスク一覧（スマホでは下に配置される） */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow sm:rounded-lg overflow-hidden">
              <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">現在のタスク一覧</h3>
              </div>
              
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  登録されているタスクはありません。
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {tasks.map((task) => (
                    <li key={task.id} className="p-4 sm:px-6 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        {/* タスク情報 */}
                        <div className="flex-1 min-w-0 mb-4 sm:mb-0">
                          <div className="flex items-center mb-1">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(task.status)}`}>
                              {getStatusLabel(task.status)}
                            </span>
                            <span className="ml-3 text-xs text-gray-500 truncate">
                              担当: {task.assignee}
                            </span>
                          </div>
                          <h4 className="text-md font-bold text-gray-900 truncate">
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                        </div>
                        
                        {/* 操作パネル */}
                        <div className="flex items-center space-x-3 sm:ml-4 shrink-0">
                          <select
                            value={task.status}
                            onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                            className="block w-full pl-3 pr-8 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md text-gray-700 bg-white border"
                          >
                            <option value="todo">未着手</option>
                            <option value="in_progress">進行中</option>
                            <option value="done">完了</option>
                          </select>
                          
                          <button
                            onClick={() => setTaskToDelete(task.id)}
                            className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-md transition-colors"
                            title="削除する"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
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