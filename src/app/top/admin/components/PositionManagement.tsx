"use client";

import React, { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SchoolData } from "../page";
import { Loader2, Plus, Edit, Trash2, X, Users, UserCog, Building2, EyeOff, Eye, CheckCircle2, Briefcase, Star, Search } from "lucide-react";

type Organization = {
  id: string;
  schoolId: string;
  name: string;
  displayOrder: number;
  isHidden: boolean;
  isDefault?: boolean;
};

type Position = {
  id: string;
  schoolId: string;
  name: string;
  organizationId: string;
  isStudent: boolean;
  isInternal: boolean;
  shokui: number;
  displayOrder: number;
  capacity: number | null;
  description: string;
  leaderUserId?: string | null;
  leaderTitle?: string | null;
  createdAt: Date | null;
};

type TenantUser = {
  id: string;
  name: string;
  role: string;
  positionIds?: string[];
  primaryPositionId?: string;
  positionName?: string;
};

type Props = {
  schoolData: SchoolData | null;
  showAlert: (type: "success" | "error" | "warning", message: string) => void;
};

const DEFAULT_ORGS = ["生徒会本部・執行本部", "委員会・専門部", "部活動", "プロジェクトチーム"];

export default function PositionManagement({ schoolData, showAlert }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<"positions" | "organizations" | "members">("positions");
  const [activePositionTab, setActivePositionTab] = useState<"student" | "teacher" | "external">("student");
  
  const [positions, setPositions] = useState<Position[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orgsLoaded, setOrgsLoaded] = useState(false);

  // === 役職フォーム用 ===
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newOrgId, setNewOrgId] = useState("");
  const [newIsStudent, setNewIsStudent] = useState<boolean>(true);
  const [newIsInternal, setNewIsInternal] = useState<boolean>(true);
  const [newShokui, setNewShokui] = useState<number | "">("");
  const [newDisplayOrder, setNewDisplayOrder] = useState<number | "">("");
  const [newCapacity, setNewCapacity] = useState<number | "">("");
  const [isCapacityLimitless, setIsCapacityLimitless] = useState<boolean>(false);
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // === 組織マスタフォーム用 ===
  const [orgModal, setOrgModal] = useState<{ show: boolean; data: Partial<Organization> }>({ show: false, data: {} });

  // === 役職メンバー設定モーダル用 (役職ベース) ===
  const [assignModal, setAssignModal] = useState<{ show: boolean; position: Position | null }>({ show: false, position: null });
  const [assignForm, setAssignForm] = useState<Record<string, { hasPosition: boolean, isPrimary: boolean, isLeader: boolean, leaderTitle: string }>>({});
  const [assignSearch, setAssignSearch] = useState("");

  // === メンバー別役職設定モーダル用 (ユーザーベース) ===
  const [userAssignModal, setUserAssignModal] = useState<{ show: boolean; user: TenantUser | null }>({ show: false, user: null });
  const [userAssignForm, setUserAssignForm] = useState<{ positionIds: string[], primaryPositionId: string }>({ positionIds: [], primaryPositionId: "" });
  const [memberSearch, setMemberSearch] = useState("");

  const [positionToDelete, setPositionToDelete] = useState<string | null>(null);
  const [orgToDelete, setOrgToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolData) return;

    const orgsRef = collection(db, "organizations");
    const qOrgs = query(orgsRef, where("schoolId", "==", schoolData.id), orderBy("displayOrder", "asc"));
    const unsubOrgs = onSnapshot(qOrgs, (snap) => {
      const fetched: Organization[] = [];
      snap.forEach((d) => fetched.push({ id: d.id, ...d.data() } as Organization));
      setOrganizations(fetched);
      setOrgsLoaded(true);
    });

    const positionsRef = collection(db, "positions");
    const qPos = query(positionsRef, where("schoolId", "==", schoolData.id), orderBy("shokui", "asc"), orderBy("displayOrder", "asc"));
    const unsubPos = onSnapshot(qPos, (snap) => {
      const fetched: Position[] = [];
      snap.forEach((d) => {
        const docData = d.data();
        fetched.push({
          id: d.id,
          schoolId: docData.schoolId,
          name: docData.name,
          organizationId: docData.organizationId || docData.organizationType,
          isStudent: docData.isStudent ?? true,
          isInternal: docData.isInternal ?? true,
          shokui: docData.shokui ?? 99,
          displayOrder: docData.displayOrder ?? 0,
          capacity: docData.capacity,
          description: docData.description,
          leaderUserId: docData.leaderUserId || null,
          leaderTitle: docData.leaderTitle || null,
          createdAt: docData.createdAt ? docData.createdAt.toDate() : null,
        });
      });
      setPositions(fetched);
    });

    const usersRef = collection(db, "users");
    const qUsers = query(usersRef, where("schoolId", "==", schoolData.id));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const fetched: TenantUser[] = [];
      snap.forEach((d) => fetched.push({ id: d.id, ...d.data() } as TenantUser));
      setTenantUsers(fetched);
      setIsLoading(false);
    });

    return () => { unsubOrgs(); unsubPos(); unsubUsers(); };
  }, [schoolData]);

  useEffect(() => {
    if (orgsLoaded && organizations.length === 0 && schoolData) {
      const initializeOrgs = async () => {
        const batch = writeBatch(db);
        DEFAULT_ORGS.forEach((name, i) => {
          const newRef = doc(collection(db, "organizations"));
          batch.set(newRef, { schoolId: schoolData.id, name, displayOrder: i + 1, isHidden: false, isDefault: true });
        });
        await batch.commit();
      };
      initializeOrgs();
    }
  }, [orgsLoaded, organizations.length, schoolData]);

  useEffect(() => {
    if (organizations.length > 0 && !newOrgId) {
      const firstActive = organizations.find(o => !o.isHidden);
      if (firstActive) setNewOrgId(firstActive.id);
    }
  }, [organizations, newOrgId]);

  // ================= 役職管理の処理 =================
  const resetForm = () => {
    setEditingPositionId(null);
    setNewName("");
    const firstActive = organizations.find(o => !o.isHidden);
    setNewOrgId(firstActive ? firstActive.id : "");
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
    setNewOrgId(pos.organizationId);
    setNewIsStudent(pos.isStudent);
    setNewIsInternal(pos.isInternal);
    setNewShokui(pos.shokui === 999 ? "" : pos.shokui); 
    setNewDisplayOrder(pos.displayOrder);
    setNewCapacity(pos.capacity === null ? "" : pos.capacity);
    setIsCapacityLimitless(pos.capacity === null);
    setNewDescription(pos.description || "");
    // 編集中は表示タブを合わせる
    if (!pos.isInternal) setActivePositionTab("external");
    else if (pos.isStudent) setActivePositionTab("student");
    else setActivePositionTab("teacher");
  };

  const handleSubmitPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolData) return;
    if (!newName.trim() || newDisplayOrder === "" || !newOrgId) {
      showAlert("error", "必須項目を入力してください。");
      return;
    }
    if (newIsInternal && newShokui === "") {
      showAlert("error", "内部組織の場合は職位を入力してください。");
      return;
    }
    if (!isCapacityLimitless && newCapacity === "") {
      showAlert("error", "定員を入力するか、「設定なし」にチェックを入れてください。");
      return;
    }

    const isDuplicate = positions.some(p => {
      if (editingPositionId === p.id) return false;
      if (newIsInternal) {
        if (p.isInternal && p.isStudent === newIsStudent) {
          if (p.shokui === Number(newShokui) && p.displayOrder === Number(newDisplayOrder)) return true;
        }
      } else {
        if (!p.isInternal) {
          if (p.displayOrder === Number(newDisplayOrder)) return true;
        }
      }
      return false;
    });

    if (isDuplicate) {
      if (newIsInternal) {
        showAlert("error", `指定した「職位 ${newShokui}」の「表示順 ${newDisplayOrder}」はすでに登録されています。空いている表示順を指定してください。`);
      } else {
        showAlert("error", `指定した「表示順 ${newDisplayOrder}」はすでに登録されています。空いている表示順を指定してください。`);
      }
      return;
    }

    setIsSubmitting(true);
    const positionData = {
      schoolId: schoolData.id,
      name: newName.trim(),
      organizationId: newOrgId,
      isStudent: newIsInternal ? newIsStudent : false,
      isInternal: newIsInternal,
      shokui: newIsInternal ? Number(newShokui) : 999,
      displayOrder: Number(newDisplayOrder),
      capacity: isCapacityLimitless ? null : Number(newCapacity),
      description: newDescription.trim(),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingPositionId) {
        await updateDoc(doc(db, "positions", editingPositionId), positionData);
        showAlert("success", "役職マスタを更新しました。");
      } else {
        await addDoc(collection(db, "positions"), { ...positionData, createdAt: serverTimestamp() });
        showAlert("success", "新しい役職マスタを作成しました。");
      }
      resetForm();
    } catch (error) {
      showAlert("error", "保存に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePosition = async () => {
    if (!positionToDelete) return;
    try {
      await deleteDoc(doc(db, "positions", positionToDelete));
      showAlert("success", "役職マスタを削除しました。");
    } catch (error) {
      showAlert("error", "削除に失敗しました。");
    } finally {
      setPositionToDelete(null);
    }
  };

  // ================= 組織マスタの処理 =================
  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolData) return;
    const { id, name, displayOrder, isHidden } = orgModal.data;
    if (!name) return;

    setIsSubmitting(true);
    try {
      if (id) {
        await updateDoc(doc(db, "organizations", id), { name, displayOrder: Number(displayOrder), isHidden: !!isHidden });
        showAlert("success", "組織マスタを更新しました。");
      } else {
        await addDoc(collection(db, "organizations"), {
          schoolId: schoolData.id,
          name,
          displayOrder: Number(displayOrder || organizations.length + 1),
          isHidden: !!isHidden,
          isDefault: false
        });
        showAlert("success", "組織を追加しました。");
      }
      setOrgModal({ show: false, data: {} });
    } catch (e) {
      showAlert("error", "保存に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOrg = async () => {
    if (!orgToDelete) return;
    try {
      await deleteDoc(doc(db, "organizations", orgToDelete));
      showAlert("success", "組織を削除しました。");
    } catch (error) {
      showAlert("error", "削除に失敗しました。");
    } finally {
      setOrgToDelete(null);
    }
  };

  // ================= メンバー割り当ての処理 (役職ベース) =================
  useEffect(() => {
    if (assignModal.position && assignModal.show) {
      const initForm: Record<string, { hasPosition: boolean, isPrimary: boolean, isLeader: boolean, leaderTitle: string }> = {};
      tenantUsers.forEach(u => {
        const isLeader = assignModal.position!.leaderUserId === u.id;
        initForm[u.id] = {
          hasPosition: u.positionIds?.includes(assignModal.position!.id) || false,
          isPrimary: u.primaryPositionId === assignModal.position!.id || false,
          isLeader: isLeader,
          leaderTitle: isLeader ? (assignModal.position!.leaderTitle || "") : "",
        };
      });
      setAssignForm(initForm);
      setAssignSearch("");
    }
  }, [assignModal.show, assignModal.position, tenantUsers]);

  // ★ 削除してしまったトグル関数を復元 ★
  const toggleHasPosition = (userId: string, val: boolean) => {
    setAssignForm(p => ({ ...p, [userId]: { ...p[userId], hasPosition: val, isPrimary: val ? p[userId].isPrimary : false, isLeader: val ? p[userId].isLeader : false } }));
  };

  const toggleIsPrimary = (userId: string, val: boolean) => {
    setAssignForm(p => ({ ...p, [userId]: { ...p[userId], isPrimary: val, hasPosition: val ? true : p[userId].hasPosition } }));
  };

  const toggleIsLeader = (userId: string, val: boolean) => {
    setAssignForm(p => {
      const next = { ...p };
      if (val) {
        // 他のユーザーの役職長をオフにする（最大1人）
        Object.keys(next).forEach(k => { next[k] = { ...next[k], isLeader: false }; });
      }
      next[userId] = { ...next[userId], isLeader: val, hasPosition: val ? true : next[userId].hasPosition };
      return next;
    });
  };

  const handleSaveAssignments = async () => {
    if (!assignModal.position) return;
    setIsSubmitting(true);
    const posId = assignModal.position.id;
    const batch = writeBatch(db);

    let newLeaderUserId: string | null = null;
    let newLeaderTitle: string | null = null;

    try {
      for (const userId of Object.keys(assignForm)) {
        const state = assignForm[userId];
        const user = tenantUsers.find(u => u.id === userId);
        if (!user) continue;

        if (state.isLeader && state.hasPosition) {
          newLeaderUserId = userId;
          newLeaderTitle = state.leaderTitle || "";
        }

        let positionIds = [...(user.positionIds || [])];
        let primaryPositionId = user.primaryPositionId || "";
        let positionName = user.positionName || "";
        let changed = false;

        if (state.hasPosition) {
          if (!positionIds.includes(posId)) { positionIds.push(posId); changed = true; }
          if (state.isPrimary && primaryPositionId !== posId) {
            primaryPositionId = posId;
            positionName = assignModal.position.name;
            changed = true;
          } else if (!state.isPrimary && primaryPositionId === posId) {
            primaryPositionId = positionIds.filter(id => id !== posId)[0] || "";
            positionName = positions.find(p => p.id === primaryPositionId)?.name || "";
            changed = true;
          }
        } else {
          if (positionIds.includes(posId)) {
            positionIds = positionIds.filter(id => id !== posId);
            changed = true;
          }
          if (primaryPositionId === posId) {
            primaryPositionId = positionIds[0] || "";
            positionName = positions.find(p => p.id === primaryPositionId)?.name || "";
            changed = true;
          }
        }

        if (changed) {
          batch.update(doc(db, "users", userId), { positionIds, primaryPositionId, positionName });
        }
      }

      batch.update(doc(db, "positions", posId), { leaderUserId: newLeaderUserId, leaderTitle: newLeaderTitle });
      await batch.commit();
      showAlert("success", "メンバーの役職割り当てを更新しました。");
      setAssignModal({ show: false, position: null });
    } catch (e) {
      showAlert("error", "更新に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ================= メンバー別役職設定 (ユーザーベース) =================
  const openUserAssignModal = (user: TenantUser) => {
    setUserAssignForm({
      positionIds: user.positionIds || [],
      primaryPositionId: user.primaryPositionId || ""
    });
    setUserAssignModal({ show: true, user });
  };

  const toggleUserPosition = (posId: string, val: boolean) => {
    setUserAssignForm(p => {
      let nextIds = [...p.positionIds];
      let nextPrimary = p.primaryPositionId;
      if (val) {
        if (!nextIds.includes(posId)) nextIds.push(posId);
        if (!nextPrimary) nextPrimary = posId;
      } else {
        nextIds = nextIds.filter(id => id !== posId);
        if (nextPrimary === posId) nextPrimary = nextIds.length > 0 ? nextIds[0] : "";
      }
      return { positionIds: nextIds, primaryPositionId: nextPrimary };
    });
  };

  const handleSaveUserAssignments = async () => {
    if (!userAssignModal.user) return;
    setIsSubmitting(true);
    try {
      const primaryId = userAssignForm.primaryPositionId || (userAssignForm.positionIds.length > 0 ? userAssignForm.positionIds[0] : "");
      const primaryName = positions.find(p => p.id === primaryId)?.name || "";

      const batch = writeBatch(db);
      batch.update(doc(db, "users", userAssignModal.user.id), {
        positionIds: userAssignForm.positionIds,
        primaryPositionId: primaryId,
        positionName: primaryName
      });

      // リーダーだった役職から外れた場合、役職側のリーダー設定を解除
      positions.forEach(p => {
        if (p.leaderUserId === userAssignModal.user!.id && !userAssignForm.positionIds.includes(p.id)) {
          batch.update(doc(db, "positions", p.id), { leaderUserId: null, leaderTitle: null });
        }
      });

      await batch.commit();
      showAlert("success", `${userAssignModal.user.name} の役職を設定しました。`);
      setUserAssignModal({ show: false, user: null });
    } catch (e) {
      showAlert("error", "更新に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const studentPositions = positions.filter(p => p.isInternal && p.isStudent);
  const teacherPositions = positions.filter(p => p.isInternal && !p.isStudent);
  const externalPositions = positions.filter(p => !p.isInternal);

  const activePositionList = 
    activePositionTab === "student" ? studentPositions : 
    activePositionTab === "teacher" ? teacherPositions : externalPositions;

  return (
    <div className="space-y-6 animate-fade-in relative">
      
      {/* 削除確認モーダル群 */}
      {positionToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-black text-red-700 mb-2">役職の削除</h3>
            <p className="text-xs text-gray-600 mb-6 font-bold">この役職を削除します。元に戻せません。</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPositionToDelete(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 bg-white hover:bg-gray-50">キャンセル</button>
              <button onClick={handleDeletePosition} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700">削除する</button>
            </div>
          </div>
        </div>
      )}

      {orgToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-black text-red-700 mb-2">組織の削除</h3>
            <p className="text-xs text-gray-600 mb-6 font-bold">この組織を削除します。関連する役職の組織名が空白になります。</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setOrgToDelete(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 bg-white hover:bg-gray-50">キャンセル</button>
              <button onClick={handleDeleteOrg} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700">削除する</button>
            </div>
          </div>
        </div>
      )}

      {/* トップヘッダー */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2"><UserCog className="w-5 h-5 text-indigo-600"/> 役職・組織・メンバー設定</h2>
          <p className="text-[11px] font-bold text-gray-500 mt-1">テナント内の権限や組織を定義し、メンバーに割り当てます。</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveSubTab("positions")} className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${activeSubTab === 'positions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>役職マスタ</button>
          <button onClick={() => setActiveSubTab("organizations")} className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${activeSubTab === 'organizations' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>組織マスタ</button>
          <button onClick={() => setActiveSubTab("members")} className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${activeSubTab === 'members' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>メンバー別設定</button>
        </div>
      </div>

      {activeSubTab === "positions" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 items-start">
          
          {/* 左：役職作成フォーム (固定スクロール) */}
          <div className="xl:col-span-4 sticky top-24 z-10">
            <div className={`shadow-sm rounded-2xl p-5 border ${editingPositionId ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-gray-200'}`}>
              <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
                <h3 className={`text-sm font-black ${editingPositionId ? 'text-amber-800' : 'text-gray-900'}`}>{editingPositionId ? "役職の編集" : "新しい役職を登録"}</h3>
                {editingPositionId && <button onClick={resetForm} className="text-[10px] font-bold text-gray-500 hover:text-gray-800 underline">キャンセル</button>}
              </div>

              <form onSubmit={handleSubmitPosition} className="space-y-4">
                <div className="grid grid-cols-2 gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-2">所属エリア</label>
                    <div className="space-y-2">
                      <label className="flex items-center text-xs font-bold text-gray-700 cursor-pointer"><input type="radio" checked={newIsInternal} onChange={() => { setNewIsInternal(true); }} className="mr-2 text-indigo-600" /> 生徒会内部</label>
                      <label className="flex items-center text-xs font-bold text-gray-700 cursor-pointer"><input type="radio" checked={!newIsInternal} onChange={() => { setNewIsInternal(false); setNewShokui(""); }} className="mr-2 text-indigo-600" /> 外部組織等</label>
                    </div>
                  </div>
                  {newIsInternal && (
                    <div className="animate-fade-in">
                      <label className="block text-[10px] font-bold text-gray-500 mb-2">対象属性</label>
                      <div className="space-y-2">
                        <label className="flex items-center text-xs font-bold text-gray-700 cursor-pointer"><input type="radio" checked={newIsStudent} onChange={() => setNewIsStudent(true)} className="mr-2 text-indigo-600" /> 生徒</label>
                        <label className="flex items-center text-xs font-bold text-gray-700 cursor-pointer"><input type="radio" checked={!newIsStudent} onChange={() => setNewIsStudent(false)} className="mr-2 text-indigo-600" /> 教職員</label>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">役職名 <span className="text-red-500">*</span></label>
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="例: 会長、顧問" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"/>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">組織 <span className="text-red-500">*</span></label>
                  <select value={newOrgId} onChange={(e) => setNewOrgId(e.target.value)} required className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="" disabled>組織を選択してください</option>
                    {organizations.filter(o => !o.isHidden).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {newIsInternal && (
                    <div className="animate-fade-in">
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">職位 (数字が小さいほど上) <span className="text-red-500">*</span></label>
                      <input type="number" min="1" value={newShokui} onChange={(e) => setNewShokui(e.target.value === "" ? "" : Number(e.target.value))} required className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"/>
                    </div>
                  )}
                  <div className={newIsInternal ? "" : "col-span-2"}>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">表示順 (同リスト内の順序) <span className="text-red-500">*</span></label>
                    <input type="number" min="1" value={newDisplayOrder} onChange={(e) => setNewDisplayOrder(e.target.value === "" ? "" : Number(e.target.value))} required className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"/>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">定員</label>
                  <input type="number" min="1" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value === "" ? "" : Number(e.target.value))} disabled={isCapacityLimitless} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none disabled:bg-gray-100"/>
                  <label className="flex items-center text-xs font-bold text-gray-700 mt-2 cursor-pointer">
                    <input type="checkbox" checked={isCapacityLimitless} onChange={(e) => { setIsCapacityLimitless(e.target.checked); if(e.target.checked) setNewCapacity(""); }} className="mr-2 text-indigo-600 rounded"/> 設定なし(無制限)
                  </label>
                </div>

                <button type="submit" disabled={isSubmitting} className={`w-full py-2.5 rounded-xl shadow-sm text-xs font-bold text-white transition-colors flex justify-center items-center ${isSubmitting ? "bg-indigo-400" : editingPositionId ? "bg-amber-600 hover:bg-amber-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2"/>} {editingPositionId ? "変更を保存する" : "役職を登録"}
                </button>
              </form>
            </div>
          </div>

          {/* 右：役職リスト（クイック切り替え） */}
          <div className="xl:col-span-8 flex flex-col gap-4">
            
            <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar">
              <button onClick={() => setActivePositionTab("student")} className={`px-4 py-2 rounded-full text-xs font-black transition-all flex items-center gap-1.5 ${activePositionTab === "student" ? "bg-emerald-600 text-white shadow-md" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
                <Users className="w-4 h-4"/> 生徒の役職
              </button>
              <button onClick={() => setActivePositionTab("teacher")} className={`px-4 py-2 rounded-full text-xs font-black transition-all flex items-center gap-1.5 ${activePositionTab === "teacher" ? "bg-purple-600 text-white shadow-md" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
                <Building2 className="w-4 h-4"/> 教職員の役職
              </button>
              <button onClick={() => setActivePositionTab("external")} className={`px-4 py-2 rounded-full text-xs font-black transition-all flex items-center gap-1.5 ${activePositionTab === "external" ? "bg-orange-600 text-white shadow-md" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
                <Briefcase className="w-4 h-4"/> 外部組織等
              </button>
            </div>

            <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden animate-fade-in">
              <div className={`px-4 py-3 border-b flex items-center justify-between ${
                activePositionTab === "student" ? "bg-emerald-50/50 border-emerald-100" :
                activePositionTab === "teacher" ? "bg-purple-50/50 border-purple-100" :
                "bg-orange-50/50 border-orange-100"
              }`}>
                <h3 className={`text-sm font-black flex items-center ${
                  activePositionTab === "student" ? "text-emerald-800" :
                  activePositionTab === "teacher" ? "text-purple-800" :
                  "text-orange-800"
                }`}>
                  {activePositionTab === "student" ? "生徒の役職リスト" : activePositionTab === "teacher" ? "教職員・管理職の役職リスト" : "外部組織等の役職リスト"}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  activePositionTab === "student" ? "text-emerald-600 bg-emerald-100" :
                  activePositionTab === "teacher" ? "text-purple-600 bg-purple-100" :
                  "text-orange-600 bg-orange-100"
                }`}>{activePositionList.length} 件</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100 text-[9px] font-black text-gray-500">
                    <tr>
                      {activePositionTab !== "external" && <th className="p-3 w-12 text-center">職位</th>}
                      <th className="p-3 w-12 text-center">表示順</th>
                      <th className="p-3">役職名 / 組織</th>
                      <th className="p-3">所属メンバー (長 / その他)</th>
                      <th className="p-3 text-center">定員</th>
                      <th className="p-3 text-right">アクション</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activePositionList.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-xs font-bold text-gray-400">登録されていません</td></tr> : activePositionList.map(pos => {
                      const org = organizations.find(o => o.id === pos.organizationId);
                      const members = tenantUsers.filter(u => u.positionIds?.includes(pos.id));
                      const leader = members.find(u => u.id === pos.leaderUserId);
                      const normalMembers = members.filter(u => u.id !== pos.leaderUserId);

                      return (
                        <tr key={pos.id} className="hover:bg-gray-50/50 transition-colors group">
                          {activePositionTab !== "external" && <td className="p-3 text-center text-sm font-black text-gray-900">{pos.shokui}</td>}
                          <td className="p-3 text-center text-xs font-bold text-gray-400">{pos.displayOrder}</td>
                          <td className="p-3">
                            <div className="text-sm font-black text-gray-900">{pos.name}</div>
                            <div className="text-[9px] font-bold text-gray-500 mt-0.5">{org?.name || "未設定"}</div>
                          </td>
                          <td className="p-3 max-w-[200px]">
                            {leader ? (
                              <div className="flex flex-col items-start mb-1">
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-0.5">
                                  <Star className="w-2.5 h-2.5 fill-indigo-500"/>{leader.name} {pos.leaderTitle && `(${pos.leaderTitle})`}
                                </span>
                              </div>
                            ) : <span className="text-gray-400 text-[9px] block mb-1">役職長なし</span>}
                            
                            {normalMembers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {normalMembers.map(m => (
                                  <span key={m.id} className="text-[9px] font-bold text-gray-600 bg-gray-100 px-1 py-0.5 rounded border border-gray-200">
                                    {m.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center text-xs font-bold text-gray-700">
                            {members.length} <span className="text-[10px] text-gray-400 font-normal">/ {pos.capacity || "∞"}</span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setAssignModal({show: true, position: pos})} className="px-2.5 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200">メンバー管理</button>
                              <button onClick={() => handleEditClick(pos)} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg"><Edit className="w-3.5 h-3.5"/></button>
                              <button onClick={() => setPositionToDelete(pos.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 組織マスタ タブ */}
      {activeSubTab === "organizations" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 animate-fade-in max-w-4xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-black text-gray-900">組織マスタ</h3>
              <p className="text-[10px] font-bold text-gray-500 mt-1">テナント内の部署や組織を管理します。初期デフォルト組織は削除できません。</p>
            </div>
            <button onClick={() => setOrgModal({show: true, data: {}})} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-700 flex items-center">
              <Plus className="w-4 h-4 mr-1"/> 組織を追加
            </button>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="p-3 w-16 text-center">表示順</th>
                  <th className="p-3">組織名称</th>
                  <th className="p-3 text-center">状態</th>
                  <th className="p-3 text-center">属性</th>
                  <th className="p-3 text-right">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {organizations.map(o => {
                  const isDefaultOrg = DEFAULT_ORGS.includes(o.name) || o.isDefault;
                  return (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="p-3 text-center font-black text-sm text-gray-900">{o.displayOrder}</td>
                      <td className={`p-3 font-bold text-xs ${o.isHidden ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{o.name}</td>
                      <td className="p-3 text-center">
                        {o.isHidden ? <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] font-bold flex items-center justify-center gap-1 w-max mx-auto"><EyeOff className="w-3 h-3"/>非表示</span> : <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold flex items-center justify-center gap-1 w-max mx-auto"><Eye className="w-3 h-3"/>有効</span>}
                      </td>
                      <td className="p-3 text-center">
                        {isDefaultOrg ? <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">デフォルト</span> : <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">オリジナル</span>}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setOrgModal({show: true, data: o})} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg"><Edit className="w-4 h-4"/></button>
                          {!isDefaultOrg && <button onClick={() => setOrgToDelete(o.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* メンバー別設定 (ユーザーベース) タブ */}
      {activeSubTab === "members" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
          <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-gray-900">メンバー別 役職設定</h3>
              <p className="text-[10px] font-bold text-gray-500 mt-1">ユーザーごとに、どの役職に就いているかを一括で確認・設定できます。</p>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="名前で検索..." value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border bg-white rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"/>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white border-b border-gray-200 text-[10px] font-black text-gray-400">
                <tr>
                  <th className="p-4 w-48">ユーザー名</th>
                  <th className="p-4">優先(メイン)役職</th>
                  <th className="p-4">所属している全役職</th>
                  <th className="p-4 text-right">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenantUsers.filter(u => !memberSearch || u.name.includes(memberSearch)).map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4">
                      <div className="text-sm font-black text-gray-900">{u.name}</div>
                      <div className="text-[9px] font-bold text-gray-500 mt-0.5">{u.role === 'student' ? '生徒' : '教職員・管理者'}</div>
                    </td>
                    <td className="p-4">
                      {u.positionName ? (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md">{u.positionName}</span>
                      ) : <span className="text-[10px] text-gray-400 font-bold">-</span>}
                    </td>
                    <td className="p-4 max-w-sm">
                      <div className="flex flex-wrap gap-1.5">
                        {u.positionIds && u.positionIds.length > 0 ? u.positionIds.map(pid => {
                          const pObj = positions.find(p => p.id === pid);
                          if (!pObj) return null;
                          return (
                            <span key={pid} className="text-[9px] font-bold text-gray-600 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
                              {pObj.name}
                            </span>
                          )
                        }) : <span className="text-[10px] text-gray-400 font-bold">役職なし</span>}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => openUserAssignModal(u)} className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors">
                        役職を設定
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 組織マスタ編集モーダル */}
      {orgModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col animate-fade-in">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-sm font-black text-gray-900">{orgModal.data.id ? "組織の編集" : "組織の追加"}</h3>
              <button onClick={() => setOrgModal({show:false, data:{}})} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleSaveOrg} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">組織名称 <span className="text-red-500">*</span></label>
                <input type="text" required value={orgModal.data.name || ""} onChange={e=>setOrgModal(p=>({show:true, data:{...p.data, name:e.target.value}}))} className="w-full border rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"/>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">表示順</label>
                <input type="number" value={orgModal.data.displayOrder || ""} onChange={e=>setOrgModal(p=>({show:true, data:{...p.data, displayOrder:Number(e.target.value)}}))} className="w-full border rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"/>
              </div>
              <div className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                <input type="checkbox" id="isHidden" checked={!!orgModal.data.isHidden} onChange={e=>setOrgModal(p=>({show:true, data:{...p.data, isHidden:e.target.checked}}))} className="w-4 h-4 text-indigo-600 rounded cursor-pointer"/>
                <label htmlFor="isHidden" className="ml-2 text-xs font-bold text-gray-700 cursor-pointer">非表示にする（選択リストから除外）</label>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : "保存する"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 役職ベースのメンバー割り当てモーダル */}
      {assignModal.show && assignModal.position && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/30 backdrop-blur-sm sm:p-4">
          <div className="bg-white w-full max-w-xl h-full sm:h-auto sm:max-h-full sm:rounded-2xl shadow-2xl flex flex-col animate-slide-in-right overflow-hidden border border-gray-200">
            <div className="p-4 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="text-sm font-black text-gray-900 flex items-center"><UserCog className="w-4 h-4 mr-1.5 text-indigo-600"/> メンバーの割り当て</h3>
                <p className="text-[10px] font-bold text-gray-500 mt-1">「{assignModal.position.name}」のメンバーを設定します</p>
              </div>
              <button onClick={() => setAssignModal({show:false, position:null})} className="p-1.5 bg-white text-gray-400 hover:text-gray-700 rounded-lg shadow-sm border border-gray-200"><X className="w-4 h-4"/></button>
            </div>
            
            <div className="p-4 border-b border-gray-100 flex-shrink-0 bg-white">
              <input type="text" placeholder="ユーザー名で検索..." value={assignSearch} onChange={e=>setAssignSearch(e.target.value)} className="w-full border bg-gray-50 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"/>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white">
              <div className="space-y-3">
                {tenantUsers.filter(u => !assignSearch || u.name.includes(assignSearch)).map(u => {
                  const state = assignForm[u.id] || { hasPosition: false, isPrimary: false, isLeader: false, leaderTitle: "" };
                  return (
                    <div key={u.id} className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${state.hasPosition ? 'bg-indigo-50/30 border-indigo-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-black text-gray-900">{u.name}</div>
                          <div className="text-[9px] font-bold text-gray-500 mt-0.5 flex items-center gap-1">
                            優先役職: {u.positionName || "なし"} 
                            {u.positionIds && u.positionIds.length > 0 && <span className="text-gray-400">({u.positionIds.length}役職)</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {state.hasPosition && (
                            <label className="flex items-center text-[10px] font-bold text-gray-700 cursor-pointer animate-fade-in bg-white px-2 py-1 rounded-md border shadow-sm">
                              <input type="checkbox" checked={state.isPrimary} onChange={(e) => toggleIsPrimary(u.id, e.target.checked)} className="mr-1.5 text-amber-500 focus:ring-amber-500 rounded-sm cursor-pointer"/> 優先(メイン)
                            </label>
                          )}
                          <label className="flex items-center text-xs font-bold text-gray-900 cursor-pointer">
                            <input type="checkbox" checked={state.hasPosition} onChange={(e) => toggleHasPosition(u.id, e.target.checked)} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded cursor-pointer"/>
                          </label>
                        </div>
                      </div>

                      {/* 役職長の設定エリア */}
                      {state.hasPosition && (
                        <div className="mt-1 pt-2 border-t border-indigo-100 flex items-center justify-between animate-fade-in pl-1">
                          <label className="flex items-center text-[10px] font-black text-indigo-700 cursor-pointer">
                            <input type="checkbox" checked={state.isLeader} onChange={(e) => toggleIsLeader(u.id, e.target.checked)} className="mr-1.5 text-indigo-600 focus:ring-indigo-500 rounded-sm cursor-pointer"/> この人を役職長にする
                          </label>
                          {state.isLeader && (
                            <input type="text" placeholder="敬称 (例: 部長、委員長)" value={state.leaderTitle} onChange={(e) => setAssignForm(p => ({...p, [u.id]: {...p[u.id], leaderTitle: e.target.value}}))} className="border border-indigo-200 rounded-lg px-2 py-1 text-[10px] font-bold outline-none focus:ring-1 focus:ring-indigo-500 w-32 bg-white" />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0 flex justify-end gap-2">
              <button onClick={() => setAssignModal({show:false, position:null})} className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-100 transition-colors">キャンセル</button>
              <button onClick={handleSaveAssignments} disabled={isSubmitting} className="px-6 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors flex items-center">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5"/> : <CheckCircle2 className="w-4 h-4 mr-1.5"/>} 設定を保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ユーザーベースのメンバー役職設定モーダル */}
      {userAssignModal.show && userAssignModal.user && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/30 backdrop-blur-sm sm:p-4">
          <div className="bg-white w-full max-w-lg h-full sm:h-auto sm:max-h-full sm:rounded-2xl shadow-2xl flex flex-col animate-slide-in-right overflow-hidden border border-gray-200">
            <div className="p-4 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="text-sm font-black text-gray-900 flex items-center"><UserCog className="w-4 h-4 mr-1.5 text-indigo-600"/> 個人の役職設定</h3>
                <p className="text-[10px] font-bold text-gray-500 mt-1"><span className="text-indigo-600 font-black">{userAssignModal.user.name}</span> の所属役職を選択します</p>
              </div>
              <button onClick={() => setUserAssignModal({show:false, user:null})} className="p-1.5 bg-white text-gray-400 hover:text-gray-700 rounded-lg shadow-sm border border-gray-200"><X className="w-4 h-4"/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white space-y-6">
              
              {/* グループごとに役職を表示 */}
              {[
                { title: "生徒の役職", list: studentPositions, color: "emerald" },
                { title: "教職員・管理職の役職", list: teacherPositions, color: "purple" },
                { title: "外部組織等の役職", list: externalPositions, color: "orange" }
              ].map(group => {
                if (group.list.length === 0) return null;
                return (
                  <div key={group.title}>
                    <h4 className={`text-xs font-black mb-3 pb-1 border-b border-gray-100 text-${group.color}-800`}>{group.title}</h4>
                    <div className="space-y-2">
                      {group.list.map(pos => {
                        const isChecked = userAssignForm.positionIds.includes(pos.id);
                        const isPrimary = userAssignForm.primaryPositionId === pos.id;
                        return (
                          <div key={pos.id} className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${isChecked ? 'bg-indigo-50/30 border-indigo-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                            <div>
                              <div className="text-xs font-black text-gray-900">{pos.name}</div>
                              <div className="text-[9px] font-bold text-gray-500 mt-0.5">{organizations.find(o=>o.id===pos.organizationId)?.name || ""}</div>
                            </div>
                            <div className="flex items-center gap-4">
                              {isChecked && (
                                <label className="flex items-center text-[10px] font-bold text-gray-700 cursor-pointer animate-fade-in bg-white px-2 py-1 rounded-md border shadow-sm">
                                  <input type="radio" checked={isPrimary} onChange={() => setUserAssignForm(p => ({...p, primaryPositionId: pos.id}))} className="mr-1.5 text-amber-500 focus:ring-amber-500 cursor-pointer"/> 優先
                                </label>
                              )}
                              <label className="flex items-center cursor-pointer">
                                <input type="checkbox" checked={isChecked} onChange={(e) => toggleUserPosition(pos.id, e.target.checked)} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded cursor-pointer"/>
                              </label>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0 flex justify-end gap-2">
              <button onClick={() => setUserAssignModal({show:false, user:null})} className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-100 transition-colors">キャンセル</button>
              <button onClick={handleSaveUserAssignments} disabled={isSubmitting} className="px-6 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors flex items-center">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5"/> : <CheckCircle2 className="w-4 h-4 mr-1.5"/>} 設定を保存
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}