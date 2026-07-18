"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, orderBy } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// データの型定義
type UserData = {
  id: string;
  name: string;
  email: string;
  schoolId: string;
  role: string;
  positionName?: string;
  isITManager?: boolean;
  accountStatus?: "active" | "pending" | "rejected";
};

type SchoolData = {
  id: string;
  name: string;
  schoolCode: string;
  adminName: string;
  adminEmail: string;
};

type Position = {
  id: string;
  name: string;
};

// UIアラートの型定義
type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null);
  
  // ユーザーリストをステータスごとに分割
  const [activeUsers, setActiveUsers] = useState<UserData[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserData[]>([]);
  
  const [availablePositions, setAvailablePositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // UIアラートとモーダル
  const [alert, setAlert] = useState<AlertState>({ show: false, type: "success", message: "" });
  
  // ユーザー編集モーダル用ステート
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editPositionName, setEditPositionName] = useState("");
  const [editIsITManager, setEditIsITManager] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // 承認・却下処理中の判定
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            // 1. ログイン中のユーザー情報を取得
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            if (userDocSnap.exists()) {
              const myData = { id: userDocSnap.id, ...userDocSnap.data() } as UserData;
              setCurrentUser(myData);

              // 2. 所属学校の情報を取得
              const schoolDocRef = doc(db, "schools", myData.schoolId);
              const schoolDocSnap = await getDoc(schoolDocRef);
              if (schoolDocSnap.exists()) {
                setSchoolData({ id: schoolDocSnap.id, ...schoolDocSnap.data() } as SchoolData);
              }

              // 3. 同じ学校に所属する全ユーザーを取得し、ステータスで振り分け
              const usersRef = collection(db, "users");
              const q = query(usersRef, where("schoolId", "==", myData.schoolId));
              const querySnapshot = await getDocs(q);
              
              const fetchedActive: UserData[] = [];
              const fetchedPending: UserData[] = [];

              querySnapshot.forEach((docSnap) => {
                const u = { id: docSnap.id, ...docSnap.data() } as UserData;
                if (u.accountStatus === "pending") {
                  fetchedPending.push(u);
                } else if (u.accountStatus !== "rejected") {
                  // active または accountStatus が無い過去のデータは active とみなす
                  fetchedActive.push(u);
                }
              });
              setActiveUsers(fetchedActive);
              setPendingUsers(fetchedPending);

              // 4. 役職マスタを取得（編集時のプルダウン用）
              const posRef = collection(db, "positions");
              const posQuery = query(posRef, where("schoolId", "==", myData.schoolId), orderBy("shokui", "asc"));
              const posSnapshot = await getDocs(posQuery);
              const positions = posSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
              setAvailablePositions(positions);

            } else {
              router.push("/login");
            }
          } catch (error) {
            console.error("Error fetching settings data:", error);
            showAlert("error", "データの読み込みに失敗しました。");
          } finally {
            setIsLoading(false);
          }
        } else {
          router.push("/login");
        }
      });
    };

    fetchData();
  }, [router]);

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => {
      setAlert((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  // 管理権限の判定（生徒会長、顧問、IT担当者）
  const canManageUsers = currentUser?.positionName === "生徒会長" || currentUser?.positionName === "顧問" || currentUser?.isITManager === true;

  // アカウントの承認・却下処理
  const handleAccountStatusChange = async (targetUser: UserData, newStatus: "active" | "rejected") => {
    if (!window.confirm(`${targetUser.name} さんのアカウントを${newStatus === "active" ? "承認" : "却下"}します。よろしいですか？`)) return;

    setProcessingId(targetUser.id);
    try {
      const userRef = doc(db, "users", targetUser.id);
      await updateDoc(userRef, { accountStatus: newStatus });
      
      // ローカルのステートを更新
      setPendingUsers(prev => prev.filter(u => u.id !== targetUser.id));
      if (newStatus === "active") {
        setActiveUsers(prev => [{ ...targetUser, accountStatus: "active" }, ...prev]);
        showAlert("success", `${targetUser.name} さんを承認し、システムへのアクセスを許可しました。`);
      } else {
        showAlert("success", `${targetUser.name} さんの申請を却下しました。`);
      }
    } catch (error) {
      console.error("Error updating account status:", error);
      showAlert("error", "ステータスの更新に失敗しました。");
    } finally {
      setProcessingId(null);
    }
  };

  const openEditModal = (user: UserData) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditPositionName(user.positionName || "");
    setEditIsITManager(user.isITManager || false);
  };

  const executeUpdateUser = async () => {
    if (!editingUser) return;
    setIsUpdating(true);

    try {
      const userRef = doc(db, "users", editingUser.id);
      await updateDoc(userRef, { 
        name: editName,
        role: editRole,
        positionName: editPositionName,
        isITManager: editIsITManager
      });
      
      setActiveUsers((prevList) => 
        prevList.map((u) => 
          u.id === editingUser.id ? { ...u, name: editName, role: editRole, positionName: editPositionName, isITManager: editIsITManager } : u
        )
      );
      
      showAlert("success", `${editName} さんの情報を更新しました。`);
      setEditingUser(null);
    } catch (error) {
      console.error("Error updating user:", error);
      showAlert("error", "ユーザー情報の更新に失敗しました。");
    } finally {
      setIsUpdating(false);
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "officer": return "生徒会役員";
      case "admin": return "アカウント管理者";
      case "teacher_watcher": return "見守り（教職員）";
      case "student": return "一般生徒";
      default: return "不明な権限";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 font-medium text-sm">設定を読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-12 relative">
      
      {/* ユーザー編集モーダル */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{editingUser.name} さんの情報編集</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">氏名</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">システム権限</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)} disabled={editingUser.id === currentUser?.id} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-white sm:text-sm text-gray-900">
                  <option value="student">一般生徒 (限定アクセス)</option>
                  <option value="officer">生徒会役員 (通常アクセス)</option>
                  <option value="teacher_watcher">見守り（教職員）</option>
                  <option value="admin">アカウント管理者</option>
                </select>
                {editingUser.id === currentUser?.id && <p className="text-xs text-red-500 mt-1">自分自身のシステム権限は変更できません。</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">役職</label>
                <select value={editPositionName} onChange={(e) => setEditPositionName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-white sm:text-sm text-gray-900">
                  <option value="">設定なし</option>
                  {availablePositions.map((pos) => (
                    <option key={pos.id} value={pos.name}>{pos.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center pt-2">
                <input type="checkbox" id="editItManager" checked={editIsITManager} onChange={(e) => setEditIsITManager(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                <label htmlFor="editItManager" className="ml-2 block text-sm font-bold text-gray-900">IT担当者として登録する</label>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">キャンセル</button>
              <button onClick={executeUpdateUser} disabled={isUpdating} className="px-4 py-2 border border-transparent rounded-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700">{isUpdating ? "更新中..." : "保存する"}</button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 truncate">学校・ユーザー管理</h1>
          <button
            onClick={() => router.push("/top")}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            &larr; トップに戻る
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {alert.show && (
          <div className={`mb-6 p-4 rounded-md text-sm shadow-sm ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {alert.message}
          </div>
        )}

        {/* 1. 承認待ちユーザーセクション（管理者のみ・承認待ちがいる場合のみ表示） */}
        {canManageUsers && pendingUsers.length > 0 && (
          <section className="bg-yellow-50 shadow sm:rounded-lg mb-8 border border-yellow-200 overflow-hidden">
            <div className="px-4 py-5 border-b border-yellow-200 sm:px-6 flex justify-between items-center">
              <h3 className="text-lg leading-6 font-bold text-yellow-900 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                承認待ちの申請
              </h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-200 text-yellow-800">
                {pendingUsers.length} 件
              </span>
            </div>
            <ul className="divide-y divide-yellow-200">
              {pendingUsers.map((user) => (
                <li key={user.id} className="p-4 sm:px-6 hover:bg-yellow-100 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="mb-4 sm:mb-0">
                      <div className="text-sm font-bold text-gray-900 mb-1">{user.name}</div>
                      <div className="text-xs text-gray-600">
                        希望役職: <span className="font-semibold text-gray-800">{user.positionName || "指定なし"}</span> / 
                        権限: <span className="font-semibold text-gray-800">{getRoleDisplayName(user.role)}</span>
                        {user.isITManager && <span className="ml-2 text-purple-600 font-bold">★ IT担当者希望</span>}
                      </div>
                    </div>
                    <div className="flex space-x-2 flex-shrink-0">
                      <button
                        onClick={() => handleAccountStatusChange(user, "active")}
                        disabled={processingId === user.id}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                      >
                        承認する
                      </button>
                      <button
                        onClick={() => handleAccountStatusChange(user, "rejected")}
                        disabled={processingId === user.id}
                        className="px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-bold text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                      >
                        却下する
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 2. 学校情報セクション */}
        <section className="bg-white shadow sm:rounded-lg mb-8 overflow-hidden">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">現在のテナント（学校）情報</h3>
              <p className="mt-1 text-sm text-gray-500">メンバーが自己登録する際は、以下の「学校コード」を伝えてください。</p>
            </div>
            {canManageUsers && (
              <button onClick={() => router.push('/top/positions')} className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-md text-sm font-bold hover:bg-blue-100 transition-colors">
                役職マスタを編集する
              </button>
            )}
          </div>
          <div className="px-4 py-5 sm:p-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">学校名</dt>
                <dd className="mt-1 text-sm text-gray-900">{schoolData?.name}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">学校コード</dt>
                <dd className="mt-2">
                  <div className="inline-flex items-center px-4 py-2 border border-blue-200 bg-blue-50 text-blue-800 rounded-md font-mono text-lg tracking-wider select-all">
                    {schoolData?.schoolCode}
                  </div>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* 3. ユーザー管理セクション */}
        <section className="bg-white shadow sm:rounded-lg overflow-hidden">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">登録メンバー一覧</h3>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              計 {activeUsers.length} 名
            </span>
          </div>
          
          <div className="bg-gray-50">
            {activeUsers.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                ユーザーが見つかりません。
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {activeUsers.map((user) => (
                  <li key={user.id} className="p-4 sm:px-6 bg-white hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      
                      {/* ユーザー情報 */}
                      <div className="flex items-center mb-4 sm:mb-0">
                        <div className="flex-shrink-0 bg-blue-100 rounded-full h-10 w-10 flex items-center justify-center text-blue-700 font-bold">
                          {user.name.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            {user.name} 
                            {user.id === currentUser?.id && <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">あなた</span>}
                            {user.isITManager && <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 font-bold">IT担当者</span>}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {user.positionName || "役職未設定"} / {getRoleDisplayName(user.role)}
                          </div>
                        </div>
                      </div>
                      
                      {/* 操作ボタン */}
                      <div className="sm:ml-4 flex-shrink-0">
                        {canManageUsers ? (
                          <button onClick={() => openEditModal(user)} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
                            情報を編集
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">編集権限なし</span>
                        )}
                      </div>

                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}