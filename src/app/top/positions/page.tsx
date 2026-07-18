"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type UserData = {
  name: string;
  schoolId: string;
  role: string;
};

type Position = {
  id: string;
  schoolId: string;
  name: string;
  organizationType: string;
  isStudent: boolean;
  isInternal: boolean;
  shokui: number;        // 職位（旧ランク）
  displayOrder: number;  // 表示順（同じ職位内の並び替え用）
  capacity: number | null;
  description: string;
  createdAt: Date | null;
};

type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

export default function PositionsMasterPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // フォーム用ステート
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newOrgType, setNewOrgType] = useState("committee");
  const [newIsStudent, setNewIsStudent] = useState<boolean>(true);
  const [newIsInternal, setNewIsInternal] = useState<boolean>(true);
  const [newShokui, setNewShokui] = useState<number | "">("");
  const [newDisplayOrder, setNewDisplayOrder] = useState<number | "">("");
  const [newCapacity, setNewCapacity] = useState<number | "">("");
  const [isCapacityLimitless, setIsCapacityLimitless] = useState<boolean>(false);
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [alert, setAlert] = useState<AlertState>({ show: false, type: "success", message: "" });
  const [positionToDelete, setPositionToDelete] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribePositions: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const data = userDocSnap.data() as UserData;
            if (data.role !== "admin" && data.role !== "officer") {
              router.push("/top");
              return;
            }
            setUserData(data);

            const positionsRef = collection(db, "positions");
            // 職位の昇順、さらに表示順の昇順で並び替え
            const q = query(positionsRef, where("schoolId", "==", data.schoolId), orderBy("shokui", "asc"), orderBy("displayOrder", "asc"));

            unsubscribePositions = onSnapshot(q, (snapshot) => {
              const fetchedPositions: Position[] = [];
              snapshot.forEach((docSnap) => {
                const docData = docSnap.data();
                fetchedPositions.push({
                  id: docSnap.id,
                  schoolId: docData.schoolId,
                  name: docData.name,
                  organizationType: docData.organizationType,
                  isStudent: docData.isStudent ?? true,
                  isInternal: docData.isInternal ?? true,
                  shokui: docData.shokui ?? docData.rank ?? 99, // 互換性のためrankも考慮
                  displayOrder: docData.displayOrder ?? 0,
                  capacity: docData.capacity,
                  description: docData.description,
                  createdAt: docData.createdAt ? docData.createdAt.toDate() : null,
                });
              });
              setPositions(fetchedPositions);
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
      if (unsubscribePositions) unsubscribePositions();
    };
  }, [router]);

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => {
      setAlert((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  const resetForm = () => {
    setEditingPositionId(null);
    setNewName("");
    setNewOrgType("committee");
    setNewIsStudent(true);
    setNewIsInternal(true);
    setNewShokui("");
    setNewDisplayOrder("");
    setNewCapacity("");
    setIsCapacityLimitless(false);
    setNewDescription("");
  };

  const handleEditClick = (pos: Position) => {
    setEditingPositionId(pos.id);
    setNewName(pos.name);
    setNewOrgType(pos.organizationType);
    setNewIsStudent(pos.isStudent);
    setNewIsInternal(pos.isInternal);
    setNewShokui(pos.shokui);
    setNewDisplayOrder(pos.displayOrder);
    setNewCapacity(pos.capacity === null ? "" : pos.capacity);
    setIsCapacityLimitless(pos.capacity === null);
    setNewDescription(pos.description || "");
    // 画面上部にスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newName.trim() || newShokui === "" || newDisplayOrder === "") {
      showAlert("error", "必須項目（役職名、職位、表示順）を入力してください。");
      return;
    }
    if (!isCapacityLimitless && newCapacity === "") {
      showAlert("error", "定員を入力するか、「設定なし」にチェックを入れてください。");
      return;
    }
    if (!userData) return;

    setIsSubmitting(true);

    const positionData = {
      schoolId: userData.schoolId,
      name: newName.trim(),
      organizationType: newOrgType,
      isStudent: newIsStudent,
      isInternal: newIsInternal,
      shokui: Number(newShokui),
      displayOrder: Number(newDisplayOrder),
      capacity: isCapacityLimitless ? null : Number(newCapacity),
      description: newDescription.trim(),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingPositionId) {
        // 編集処理
        const positionRef = doc(db, "positions", editingPositionId);
        await updateDoc(positionRef, positionData);
        showAlert("success", "役職マスタを更新しました。");
      } else {
        // 新規作成処理
        await addDoc(collection(db, "positions"), {
          ...positionData,
          createdAt: serverTimestamp(),
        });
        showAlert("success", "新しい役職マスタを作成しました。");
      }
      resetForm();
    } catch (error) {
      console.error("Error saving position:", error);
      showAlert("error", "保存に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePosition = async () => {
    if (!positionToDelete) return;
    try {
      const positionRef = doc(db, "positions", positionToDelete);
      await deleteDoc(positionRef);
      showAlert("success", "役職マスタを削除しました。");
    } catch (error) {
      console.error("Error deleting position:", error);
      showAlert("error", "削除に失敗しました。");
    } finally {
      setPositionToDelete(null);
    }
  };

  const getOrgTypeName = (type: string) => {
    switch (type) {
      case "council": return "生徒会本部";
      case "committee": return "委員会";
      case "club": return "部活動";
      case "department": return "部門・チーム";
      case "other": return "その他";
      default: return type;
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
      {positionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-2">役職の削除</h3>
            <p className="text-sm text-gray-500 mb-6">
              この役職マスタを削除します。この操作は元に戻せません。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setPositionToDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeletePosition}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 truncate">役職マスタ設定</h1>
          <button
            onClick={() => router.push("/top/settings")}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            &larr; 設定画面に戻る
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {alert.show && (
          <div className={`mb-6 p-4 rounded-md text-sm shadow-sm ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {alert.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 左カラム：新規作成・編集フォーム */}
          <div className="lg:col-span-4">
            <div className={`shadow sm:rounded-lg ${editingPositionId ? 'bg-yellow-50 border border-yellow-300' : 'bg-white'}`}>
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-bold text-gray-900">
                    {editingPositionId ? "役職の編集" : "新しい役職を定義する"}
                  </h3>
                  {editingPositionId && (
                    <button onClick={resetForm} className="text-xs text-gray-500 hover:text-gray-800 underline">キャンセル</button>
                  )}
                </div>
                <form onSubmit={handleSubmitPosition} className="space-y-5">
                  
                  <div className="grid grid-cols-2 gap-4 border-b border-gray-200 pb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">対象者</label>
                      <div className="flex flex-col space-y-2">
                        <label className="flex items-center text-sm">
                          <input type="radio" checked={newIsStudent} onChange={() => setNewIsStudent(true)} className="mr-2 text-blue-600 focus:ring-blue-500" /> 生徒
                        </label>
                        <label className="flex items-center text-sm">
                          <input type="radio" checked={!newIsStudent} onChange={() => setNewIsStudent(false)} className="mr-2 text-blue-600 focus:ring-blue-500" /> 教員・管理職
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">所属エリア</label>
                      <div className="flex flex-col space-y-2">
                        <label className="flex items-center text-sm">
                          <input type="radio" checked={newIsInternal} onChange={() => setNewIsInternal(true)} className="mr-2 text-blue-600 focus:ring-blue-500" /> 生徒会内部
                        </label>
                        <label className="flex items-center text-sm">
                          <input type="radio" checked={!newIsInternal} onChange={() => setNewIsInternal(false)} className="mr-2 text-blue-600 focus:ring-blue-500" /> 外部 (部活等)
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">役職名 <span className="text-red-500">*</span></label>
                    <input
                      type="text" id="name" value={newName} onChange={(e) => setNewName(e.target.value)} required
                      className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border text-gray-900 bg-white"
                      placeholder="例: 会長、顧問、放送部長"
                    />
                  </div>

                  <div>
                    <label htmlFor="orgType" className="block text-sm font-medium text-gray-700">組織称 <span className="text-red-500">*</span></label>
                    <select
                      id="orgType" value={newOrgType} onChange={(e) => setNewOrgType(e.target.value)}
                      className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border text-gray-900 bg-white"
                    >
                      <option value="council">生徒会本部</option>
                      <option value="committee">委員会</option>
                      <option value="club">部活動</option>
                      <option value="department">部門・チーム</option>
                      <option value="other">その他</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="shokui" className="block text-sm font-medium text-gray-700">職位 <span className="text-red-500">*</span></label>
                      <input
                        type="number" id="shokui" min="1" value={newShokui} onChange={(e) => setNewShokui(e.target.value === "" ? "" : Number(e.target.value))} required
                        className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border text-gray-900 bg-white"
                        placeholder="例: 1 (高い順)"
                      />
                      <p className="mt-1 text-xs text-gray-500">※同率も可能</p>
                    </div>
                    <div>
                      <label htmlFor="displayOrder" className="block text-sm font-medium text-gray-700">表示順 <span className="text-red-500">*</span></label>
                      <input
                        type="number" id="displayOrder" min="1" value={newDisplayOrder} onChange={(e) => setNewDisplayOrder(e.target.value === "" ? "" : Number(e.target.value))} required
                        className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border text-gray-900 bg-white"
                        placeholder="例: 1"
                      />
                      <p className="mt-1 text-xs text-gray-500">※同職位内の並び順</p>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="capacity" className="block text-sm font-medium text-gray-700">定員</label>
                    <input
                      type="number" id="capacity" min="1" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value === "" ? "" : Number(e.target.value))} disabled={isCapacityLimitless}
                      className={`mt-1 shadow-sm block w-full sm:text-sm rounded-md px-3 py-2 border text-gray-900 ${isCapacityLimitless ? "bg-gray-100 border-gray-200" : "bg-white focus:ring-blue-500 focus:border-blue-500 border-gray-300"}`}
                      placeholder="例: 2"
                    />
                    <div className="mt-2 flex items-center">
                      <input
                        id="limitless" type="checkbox" checked={isCapacityLimitless} onChange={(e) => { setIsCapacityLimitless(e.target.checked); if(e.target.checked) setNewCapacity(""); }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="limitless" className="ml-2 block text-xs text-gray-700">設定なし(無制限)</label>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">役職の概要</label>
                    <textarea
                      id="description" rows={2} value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
                      className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border text-gray-900 bg-white"
                    />
                  </div>

                  <button
                    type="submit" disabled={isSubmitting}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white ${isSubmitting ? "bg-blue-400 cursor-not-allowed" : editingPositionId ? "bg-yellow-500 hover:bg-yellow-600" : "bg-blue-600 hover:bg-blue-700"}`}
                  >
                    {isSubmitting ? "保存中..." : editingPositionId ? "変更を保存する" : "マスタに追加する"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* 右カラム：役職マスタ一覧 */}
          <div className="lg:col-span-8">
            <div className="bg-white shadow sm:rounded-lg overflow-hidden">
              <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">定義済みの役職一覧（職位・表示順）</h3>
              </div>
              
              <div className="overflow-x-auto">
                {positions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-500">登録されている役職マスタはありません。</div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">属性</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">職位</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">表示順</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">役職名</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">定員</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {positions.map((position) => (
                        <tr key={position.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex flex-col space-y-1">
                              <span className={`px-2 py-0.5 inline-flex text-[10px] leading-4 font-semibold rounded-sm w-max ${position.isStudent ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                                {position.isStudent ? "生徒" : "教員"}
                              </span>
                              <span className={`px-2 py-0.5 inline-flex text-[10px] leading-4 font-semibold rounded-sm w-max ${position.isInternal ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                                {position.isInternal ? "生徒会内部" : "外部組織"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">{position.shokui}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{position.displayOrder}</td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">{position.name}</div>
                            <div className="text-xs text-gray-500">{getOrgTypeName(position.organizationType)}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {position.capacity === null ? <span className="text-gray-400">設定なし</span> : `${position.capacity}名`}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                            <button onClick={() => handleEditClick(position)} className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded transition-colors border border-blue-100">編集</button>
                            <button onClick={() => setPositionToDelete(position.id)} className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded transition-colors border border-red-100">削除</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}