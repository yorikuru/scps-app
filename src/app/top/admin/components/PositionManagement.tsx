"use client";

import React, { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SchoolData } from "../page";
import { Loader2, Plus, Edit, Trash2, X, Users, UserCog, Building2, EyeOff, Eye, CheckCircle2, Briefcase, Star, Search } from "lucide-react";
import CustomSelect from "@/components/CustomSelect"; // ★ CustomSelect をインポート

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

  const [orgModal, setOrgModal] = useState<{ show: boolean; data: Partial<Organization> }>({ show: false, data: {} });

  const [assignModal, setAssignModal] = useState<{ show: boolean; position: Position | null }>({ show: false, position: null });
  const [assignForm, setAssignForm] = useState<Record<string, { hasPosition: boolean, isPrimary: boolean, isLeader: boolean, leaderTitle: string }>>({});
  const [assignSearch, setAssignSearch] = useState("");

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
    <div className="space-y-4 sm:space-y-6 animate-fade-in relative min-w-0 pb-12">
      
      {/* 削除確認モーダル */}
      {positionToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-sm border border-gray-100 animate-fade-in">
            <h3 className="text-sm font-black text-red-700 mb-2">役職の削除</h3>
            <p className="text-[11px] sm:text-xs text-gray-600 mb-5 sm:mb-6 font-bold leading-relaxed">この役職を削除します。元に戻せません。</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPositionToDelete(null)} className="flex-1 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-2xs">キャンセル</button>
              <button onClick={handleDeletePosition} className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm">削除する</button>
            </div>
          </div>
        </div>
      )}

      {orgToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-sm border border-gray-100 animate-fade-in">
            <h3 className="text-sm font-black text-red-700 mb-2">組織の削除</h3>
            <p className="text-[11px] sm:text-xs text-gray-600 mb-5 sm:mb-6 font-bold leading-relaxed">この組織を削除します。関連する役職の組織名が空白になります。</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setOrgToDelete(null)} className="flex-1 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-2xs">キャンセル</button>
              <button onClick={handleDeleteOrg} className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm">削除する</button>
            </div>
          </div>
        </div>
      )}

      {/* トップヘッダー */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5 sm:gap-3 mb-2 border-b border-gray-200 pb-2.5 sm:pb-3">
        <div>
          <h2 className="text-sm sm:text-base font-black text-gray-900 flex items-center gap-1.5"><UserCog className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600"/> 役職・組織・メンバー設定</h2>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 mt-1">テナント内の権限や組織を定義し、メンバーに割り当てます。</p>
        </div>
        <div className="flex flex-wrap gap-1 bg-gray-100 p-1.5 rounded-xl w-full sm:w-auto shadow-inner">
          <button onClick={() => setActiveSubTab("positions")} className={`flex-auto px-3 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap text-center ${activeSubTab === 'positions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>役職マスタ</button>
          <button onClick={() => setActiveSubTab("organizations")} className={`flex-auto px-3 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap text-center ${activeSubTab === 'organizations' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>組織マスタ</button>
          <button onClick={() => setActiveSubTab("members")} className={`flex-auto px-3 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap text-center ${activeSubTab === 'members' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>メンバー設定</button>
        </div>
      </div>

      {activeSubTab === "positions" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 xl:gap-6 items-start min-w-0">
          
          {/* 左：役職作成フォーム */}
          <div className="xl:col-span-4 lg:sticky lg:top-4 z-10 w-full">
            <div className={`shadow-sm rounded-xl sm:rounded-2xl p-3.5 sm:p-5 border min-w-0 ${editingPositionId ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-gray-200'}`}>
              <div className="flex justify-between items-center mb-3 sm:mb-4 border-b border-gray-100 pb-2.5 sm:pb-3">
                <h3 className={`text-xs sm:text-sm font-black ${editingPositionId ? 'text-amber-800' : 'text-gray-900'}`}>{editingPositionId ? "役職の編集" : "新しい役職を登録"}</h3>
                {editingPositionId && <button onClick={resetForm} className="text-[9px] sm:text-[10px] font-bold text-gray-500 hover:text-gray-800 bg-white px-2 py-1 rounded-lg border border-gray-200 shadow-2xs">キャンセル</button>}
              </div>

              <form onSubmit={handleSubmitPosition} className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 border-b border-gray-100 pb-3 sm:pb-4">
                  <div>
                    <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1.5 sm:mb-2">所属エリア</label>
                    <div className="flex flex-row sm:flex-col gap-3 sm:gap-2">
                      <label className="flex items-center text-[10px] sm:text-xs font-bold text-gray-700 cursor-pointer"><input type="radio" checked={newIsInternal} onChange={() => { setNewIsInternal(true); }} className="mr-1.5 sm:mr-2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" /> 生徒会内部</label>
                      <label className="flex items-center text-[10px] sm:text-xs font-bold text-gray-700 cursor-pointer"><input type="radio" checked={!newIsInternal} onChange={() => { setNewIsInternal(false); setNewShokui(""); }} className="mr-1.5 sm:mr-2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" /> 外部組織等</label>
                    </div>
                  </div>
                  {newIsInternal && (
                    <div className="animate-fade-in mt-1 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                      <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1.5 sm:mb-2">対象属性</label>
                      <div className="flex flex-row sm:flex-col gap-3 sm:gap-2">
                        <label className="flex items-center text-[10px] sm:text-xs font-bold text-gray-700 cursor-pointer"><input type="radio" checked={newIsStudent} onChange={() => setNewIsStudent(true)} className="mr-1.5 sm:mr-2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" /> 生徒</label>
                        <label className="flex items-center text-[10px] sm:text-xs font-bold text-gray-700 cursor-pointer"><input type="radio" checked={!newIsStudent} onChange={() => setNewIsStudent(false)} className="mr-1.5 sm:mr-2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" /> 教職員</label>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">役職名 <span className="text-red-500">*</span></label>
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="例: 会長、顧問" className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"/>
                </div>

                <div>
                  <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">組織 <span className="text-red-500">*</span></label>
                  {/* ★ CustomSelect を使用 */}
                  <CustomSelect
                    value={newOrgId}
                    onChange={setNewOrgId}
                    options={[
                      { value: "", label: "組織を選択してください" },
                      ...organizations.filter(o => !o.isHidden).map(o => ({ value: o.id, label: o.name }))
                    ]}
                    buttonClassName="w-full border border-gray-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm flex items-center justify-between"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                  {newIsInternal && (
                    <div className="animate-fade-in">
                      <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">職位 (数字小が上) <span className="text-red-500">*</span></label>
                      <input type="number" min="1" value={newShokui} onChange={(e) => setNewShokui(e.target.value === "" ? "" : Number(e.target.value))} required className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"/>
                    </div>
                  )}
                  <div className={newIsInternal ? "" : "col-span-2"}>
                    <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">表示順 <span className="text-red-500">*</span></label>
                    <input type="number" min="1" value={newDisplayOrder} onChange={(e) => setNewDisplayOrder(e.target.value === "" ? "" : Number(e.target.value))} required className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"/>
                  </div>
                </div>

                <div className="bg-gray-50 p-2.5 sm:p-3 rounded-lg sm:rounded-xl border border-gray-200">
                  <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">定員</label>
                  <input type="number" min="1" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value === "" ? "" : Number(e.target.value))} disabled={isCapacityLimitless} className="w-full border border-gray-300 rounded-md sm:rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold outline-none disabled:bg-gray-100 shadow-sm"/>
                  <label className="flex items-center text-[10px] sm:text-xs font-bold text-gray-700 mt-2 cursor-pointer">
                    <input type="checkbox" checked={isCapacityLimitless} onChange={(e) => { setIsCapacityLimitless(e.target.checked); if(e.target.checked) setNewCapacity(""); }} className="mr-1.5 sm:mr-2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 rounded"/> 設定なし(無制限)
                  </label>
                </div>

                <button type="submit" disabled={isSubmitting} className={`w-full py-2.5 sm:py-2.5 rounded-lg sm:rounded-xl shadow-sm text-[11px] sm:text-sm font-bold text-white transition-all hover:-translate-y-0.5 flex justify-center items-center ${isSubmitting ? "bg-indigo-400" : editingPositionId ? "bg-amber-600 hover:bg-amber-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin mr-1.5"/> : (editingPositionId ? <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5"/> : <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5"/>)}
                  {editingPositionId ? "変更を保存する" : "役職を登録"}
                </button>
              </form>
            </div>
          </div>

          {/* 右：役職リスト */}
          <div className="xl:col-span-8 flex flex-col gap-2.5 sm:gap-4 w-full min-w-0">
            
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-1 overflow-x-auto custom-scrollbar">
              <button onClick={() => setActivePositionTab("student")} className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-black transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 ${activePositionTab === "student" ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
                <Users className="w-3 h-3 sm:w-4 sm:h-4"/> 生徒の役職
              </button>
              <button onClick={() => setActivePositionTab("teacher")} className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-black transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 ${activePositionTab === "teacher" ? "bg-purple-600 text-white shadow-sm" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
                <Building2 className="w-3 h-3 sm:w-4 sm:h-4"/> 教職員の役職
              </button>
              <button onClick={() => setActivePositionTab("external")} className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-black transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 ${activePositionTab === "external" ? "bg-orange-600 text-white shadow-sm" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
                <Briefcase className="w-3 h-3 sm:w-4 sm:h-4"/> 外部組織等
              </button>
            </div>

            <div className="bg-white shadow-sm border border-gray-200 rounded-xl sm:rounded-2xl overflow-hidden animate-fade-in w-full min-w-0">
              <div className={`px-3 sm:px-4 py-2 sm:py-3 border-b flex items-center justify-between ${
                activePositionTab === "student" ? "bg-emerald-50/50 border-emerald-100" :
                activePositionTab === "teacher" ? "bg-purple-50/50 border-purple-100" :
                "bg-orange-50/50 border-orange-100"
              }`}>
                <h3 className={`text-[11px] sm:text-sm font-black flex items-center ${
                  activePositionTab === "student" ? "text-emerald-800" :
                  activePositionTab === "teacher" ? "text-purple-800" :
                  "text-orange-800"
                }`}>
                  {activePositionTab === "student" ? "生徒の役職リスト" : activePositionTab === "teacher" ? "教職員・管理職リスト" : "外部組織リスト"}
                </h3>
                <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full ${
                  activePositionTab === "student" ? "text-emerald-600 bg-emerald-100" :
                  activePositionTab === "teacher" ? "text-purple-600 bg-purple-100" :
                  "text-orange-600 bg-orange-100"
                }`}>{activePositionList.length} 件</span>
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left min-w-[500px]">
                  <thead className="bg-gray-50 border-b border-gray-100 text-[9px] sm:text-[10px] font-black text-gray-500 whitespace-nowrap">
                    <tr>
                      {activePositionTab !== "external" && <th className="p-2 sm:p-3 w-8 sm:w-12 text-center">職位</th>}
                      <th className="p-2 sm:p-3 w-8 sm:w-12 text-center">順序</th>
                      <th className="p-2 sm:p-3">役職名 / 組織</th>
                      <th className="p-2 sm:p-3">所属メンバー (長 / その他)</th>
                      <th className="p-2 sm:p-3 text-center">定員</th>
                      <th className="p-2 sm:p-3 text-right">アクション</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activePositionList.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-[10px] sm:text-xs font-bold text-gray-400">登録されていません</td></tr> : activePositionList.map(pos => {
                      const org = organizations.find(o => o.id === pos.organizationId);
                      const members = tenantUsers.filter(u => u.positionIds?.includes(pos.id));
                      const leader = members.find(u => u.id === pos.leaderUserId);
                      const normalMembers = members.filter(u => u.id !== pos.leaderUserId);

                      return (
                        <tr key={pos.id} className="hover:bg-gray-50/50 transition-colors group">
                          {activePositionTab !== "external" && <td className="p-2 sm:p-3 text-center text-[11px] sm:text-sm font-black text-gray-900">{pos.shokui}</td>}
                          <td className="p-2 sm:p-3 text-center text-[9px] sm:text-xs font-bold text-gray-400">{pos.displayOrder}</td>
                          <td className="p-2 sm:p-3 min-w-[120px]">
                            <div className="text-[11px] sm:text-sm font-black text-gray-900 truncate max-w-[120px] sm:max-w-[150px]">{pos.name}</div>
                            <div className="text-[8px] sm:text-[9px] font-bold text-gray-500 mt-0.5 truncate max-w-[120px] sm:max-w-[150px]">{org?.name || "未設定"}</div>
                          </td>
                          <td className="p-2 sm:p-3 min-w-[140px] sm:min-w-[150px] max-w-[180px] sm:max-w-[200px]">
                            {leader ? (
                              <div className="flex flex-col items-start mb-1">
                                <span className="text-[8px] sm:text-[9px] sm:text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-0.5 truncate max-w-full">
                                  <Star className="w-2.5 h-2.5 fill-indigo-500 flex-shrink-0"/>{leader.name} {pos.leaderTitle && `(${pos.leaderTitle})`}
                                </span>
                              </div>
                            ) : <span className="text-gray-400 text-[8px] sm:text-[9px] block mb-1">役職長なし</span>}
                            
                            {normalMembers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {normalMembers.map(m => (
                                  <span key={m.id} className="text-[7px] sm:text-[8px] sm:text-[9px] font-bold text-gray-600 bg-gray-100 px-1 py-0.5 rounded border border-gray-200 truncate max-w-full">
                                    {m.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-2 sm:p-3 text-center text-[9px] sm:text-[10px] sm:text-xs font-bold text-gray-700 whitespace-nowrap">
                            {members.length} <span className="text-[8px] sm:text-[9px] sm:text-[10px] text-gray-400 font-normal">/ {pos.capacity || "∞"}</span>
                          </td>
                          <td className="p-2 sm:p-3 text-right">
                            <div className="flex items-center justify-end gap-1 sm:gap-1.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setAssignModal({show: true, position: pos})} className="px-1.5 sm:px-2 py-1 text-[8px] sm:text-[9px] sm:text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200 whitespace-nowrap shadow-2xs">メンバー管理</button>
                              <button onClick={() => handleEditClick(pos)} className="p-1 sm:p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg"><Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4"/></button>
                              <button onClick={() => setPositionToDelete(pos.id)} className="p-1 sm:p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4"/></button>
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
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 p-3.5 sm:p-6 animate-fade-in w-full max-w-4xl mx-auto overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2.5 sm:gap-3 mb-3.5 sm:mb-6">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-gray-900">組織マスタ</h3>
              <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 mt-0.5 sm:mt-1">テナント内の部署や組織を管理します。初期デフォルト組織は削除できません。</p>
            </div>
            <button onClick={() => setOrgModal({show: true, data: {}})} className="w-full sm:w-auto px-3.5 sm:px-4 py-2 sm:py-2.5 bg-indigo-600 text-white text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl shadow-sm hover:bg-indigo-700 flex items-center justify-center transition-transform hover:-translate-y-0.5">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1"/> 組織を追加
            </button>
          </div>

          <div className="border border-gray-200 rounded-lg sm:rounded-xl overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[400px]">
              <thead className="bg-gray-50 border-b border-gray-200 text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">
                <tr>
                  <th className="p-2 sm:p-3 w-10 sm:w-16 text-center">表示順</th>
                  <th className="p-2 sm:p-3">組織名称</th>
                  <th className="p-2 sm:p-3 text-center">状態</th>
                  <th className="p-2 sm:p-3 text-center">属性</th>
                  <th className="p-2 sm:p-3 text-right">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {organizations.map(o => {
                  const isDefaultOrg = DEFAULT_ORGS.includes(o.name) || o.isDefault;
                  return (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="p-2 sm:p-3 text-center font-black text-[11px] sm:text-xs sm:text-sm text-gray-900">{o.displayOrder}</td>
                      <td className={`p-2 sm:p-3 font-bold text-[10px] sm:text-[11px] sm:text-xs truncate max-w-[130px] sm:max-w-none ${o.isHidden ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{o.name}</td>
                      <td className="p-2 sm:p-3 text-center">
                        {o.isHidden ? <span className="px-1.5 sm:px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[7px] sm:text-[8px] sm:text-[9px] font-bold flex items-center justify-center gap-1 w-max mx-auto"><EyeOff className="w-2.5 h-2.5 sm:w-3 sm:h-3"/>非表示</span> : <span className="px-1.5 sm:px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[7px] sm:text-[8px] sm:text-[9px] font-bold flex items-center justify-center gap-1 w-max mx-auto"><Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3"/>有効</span>}
                      </td>
                      <td className="p-2 sm:p-3 text-center">
                        {isDefaultOrg ? <span className="text-[7px] sm:text-[8px] sm:text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 sm:px-2 py-0.5 rounded">デフォルト</span> : <span className="text-[7px] sm:text-[8px] sm:text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded">オリジナル</span>}
                      </td>
                      <td className="p-2 sm:p-3 text-right">
                        <div className="flex items-center justify-end gap-0.5 sm:gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setOrgModal({show: true, data: o})} className="p-1 sm:p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg"><Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4"/></button>
                          {!isDefaultOrg && <button onClick={() => setOrgToDelete(o.id)} className="p-1 sm:p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4"/></button>}
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
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in w-full min-w-0">
          <div className="px-3.5 sm:px-6 py-2.5 sm:py-4 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4 shrink-0">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-gray-900">メンバー別 役職設定</h3>
              <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 mt-0.5 sm:mt-1">ユーザーごとに、どの役職に就いているかを一括で確認・設定できます。</p>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
              <input type="text" placeholder="名前で検索..." value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} className="w-full pl-8 sm:pl-9 pr-2.5 sm:pr-3 py-1.5 sm:py-2 border bg-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs"/>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar w-full">
            <table className="w-full text-left min-w-[500px]">
              <thead className="bg-white border-b border-gray-200 text-[9px] sm:text-[10px] font-black text-gray-400 whitespace-nowrap">
                <tr>
                  <th className="p-2 sm:p-4 w-28 sm:w-48">ユーザー名</th>
                  <th className="p-2 sm:p-4 w-24 sm:w-40">メイン役職</th>
                  <th className="p-2 sm:p-4">所属している全役職</th>
                  <th className="p-2 sm:p-4 text-right">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenantUsers.filter(u => !memberSearch || u.name.includes(memberSearch)).map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-2.5 sm:p-4">
                      <div className="text-[11px] sm:text-xs sm:text-sm font-black text-gray-900 truncate max-w-[100px] sm:max-w-none">{u.name}</div>
                      <div className="text-[8px] sm:text-[9px] font-bold text-gray-500 mt-0.5">{u.role === 'student' ? '生徒' : '教職員・管理者'}</div>
                    </td>
                    <td className="p-2.5 sm:p-4">
                      {u.positionName ? (
                        <span className="text-[8px] sm:text-[9px] sm:text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md truncate block max-w-[80px] sm:max-w-[140px]">{u.positionName}</span>
                      ) : <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold">-</span>}
                    </td>
                    <td className="p-2.5 sm:p-4 min-w-[140px] sm:min-w-[160px] max-w-[200px] sm:max-w-sm">
                      <div className="flex flex-wrap gap-1 sm:gap-1.5">
                        {u.positionIds && u.positionIds.length > 0 ? u.positionIds.map(pid => {
                          const pObj = positions.find(p => p.id === pid);
                          if (!pObj) return null;
                          return (
                            <span key={pid} className="text-[7px] sm:text-[8px] sm:text-[9px] font-bold text-gray-600 bg-gray-100 border border-gray-200 px-1 sm:px-1.5 py-0.5 rounded truncate max-w-[100px] sm:max-w-[120px]">
                              {pObj.name}
                            </span>
                          )
                        }) : <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold">役職なし</span>}
                      </div>
                    </td>
                    <td className="p-2.5 sm:p-4 text-right">
                      <button onClick={() => openUserAssignModal(u)} className="px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] sm:text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md sm:rounded-lg border border-indigo-200 transition-colors whitespace-nowrap shadow-2xs">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col animate-fade-in border border-gray-100">
            <div className="p-3 sm:p-3.5 sm:p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <h3 className="text-xs sm:text-sm font-black text-gray-900">{orgModal.data.id ? "組織の編集" : "組織の追加"}</h3>
              <button onClick={() => setOrgModal({show:false, data:{}})} className="p-1 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"><X className="w-4 h-4 sm:w-5 sm:h-5"/></button>
            </div>
            <form onSubmit={handleSaveOrg} className="p-3.5 sm:p-4 sm:p-5 space-y-3 sm:space-y-4">
              <div>
                <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">組織名称 <span className="text-red-500">*</span></label>
                <input type="text" required value={orgModal.data.name || ""} onChange={e=>setOrgModal(p=>({show:true, data:{...p.data, name:e.target.value}}))} className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[16px] sm:text-xs sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"/>
              </div>
              <div>
                <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">表示順</label>
                <input type="number" value={orgModal.data.displayOrder || ""} onChange={e=>setOrgModal(p=>({show:true, data:{...p.data, displayOrder:Number(e.target.value)}}))} className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[16px] sm:text-xs sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"/>
              </div>
              <div className="flex items-center p-2.5 sm:p-3 bg-gray-50 rounded-lg sm:rounded-xl border border-gray-200">
                <input type="checkbox" id="isHidden" checked={!!orgModal.data.isHidden} onChange={e=>setOrgModal(p=>({show:true, data:{...p.data, isHidden:e.target.checked}}))} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 rounded cursor-pointer border-gray-300"/>
                <label htmlFor="isHidden" className="ml-2 text-[10px] sm:text-[11px] sm:text-xs font-bold text-gray-700 cursor-pointer">非表示にする（リストから除外）</label>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full py-2 sm:py-2.5 sm:py-3 mt-1 sm:mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] sm:text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl shadow-sm flex items-center justify-center transition-colors">
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin"/> : "保存する"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 役職ベースのメンバー割り当てモーダル */}
      {assignModal.show && assignModal.position && (
        <div className="fixed inset-0 z-[100] flex sm:justify-end items-end sm:items-start bg-black/50 backdrop-blur-sm sm:p-4">
          <div className="bg-white w-full sm:max-w-xl h-[90vh] sm:h-auto sm:max-h-full rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-slide-in-right overflow-hidden border border-gray-200">
            <div className="p-2.5 sm:p-3 sm:p-4 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="text-[11px] sm:text-xs sm:text-sm font-black text-gray-900 flex items-center"><UserCog className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5 text-indigo-600"/> メンバーの割り当て</h3>
                <p className="text-[8px] sm:text-[9px] sm:text-[10px] font-bold text-gray-500 mt-0.5 sm:mt-1 truncate max-w-[200px] sm:max-w-none">「{assignModal.position.name}」のメンバーを設定します</p>
              </div>
              <button onClick={() => setAssignModal({show:false, position:null})} className="p-1 sm:p-1.5 bg-white text-gray-400 hover:text-gray-700 rounded-md sm:rounded-lg shadow-2xs border border-gray-200 transition-colors"><X className="w-4 h-4 sm:w-5 sm:h-5"/></button>
            </div>
            
            <div className="p-2.5 sm:p-3 sm:p-4 border-b border-gray-100 flex-shrink-0 bg-white">
              <input type="text" placeholder="ユーザー名で検索..." value={assignSearch} onChange={e=>setAssignSearch(e.target.value)} className="w-full border border-gray-200 bg-gray-50 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[16px] sm:text-[11px] sm:text-xs font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors shadow-2xs"/>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 sm:p-4 custom-scrollbar bg-white">
              <div className="space-y-1.5 sm:space-y-2 sm:space-y-3">
                {tenantUsers.filter(u => !assignSearch || u.name.includes(assignSearch)).map(u => {
                  const state = assignForm[u.id] || { hasPosition: false, isPrimary: false, isLeader: false, leaderTitle: "" };
                  return (
                    <div key={u.id} className={`p-2 sm:p-2.5 sm:p-3 rounded-lg sm:rounded-xl border transition-all flex flex-col gap-1.5 sm:gap-2 ${state.hasPosition ? 'bg-indigo-50/30 border-indigo-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] sm:text-[11px] sm:text-xs font-black text-gray-900 truncate">{u.name}</div>
                          <div className="text-[8px] sm:text-[9px] font-bold text-gray-500 mt-0.5 flex items-center gap-0.5 sm:gap-1 truncate">
                            優先: {u.positionName || "なし"} 
                            {u.positionIds && u.positionIds.length > 0 && <span className="text-gray-400">({u.positionIds.length}役職)</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 sm:gap-4 shrink-0">
                          {state.hasPosition && (
                            <label className="flex items-center text-[8px] sm:text-[9px] sm:text-[10px] font-bold text-gray-700 cursor-pointer animate-fade-in bg-white px-1 sm:px-1.5 py-0.5 sm:py-1 rounded border border-gray-200 shadow-2xs">
                              <input type="checkbox" checked={state.isPrimary} onChange={(e) => toggleIsPrimary(u.id, e.target.checked)} className="mr-1 w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 focus:ring-amber-500 rounded-sm cursor-pointer"/> 優先
                            </label>
                          )}
                          <label className="flex items-center text-xs font-bold text-gray-900 cursor-pointer bg-white p-1 rounded-md sm:rounded-lg border border-gray-100 shadow-2xs">
                            <input type="checkbox" checked={state.hasPosition} onChange={(e) => toggleHasPosition(u.id, e.target.checked)} className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:w-5 sm:h-5 text-indigo-600 focus:ring-indigo-500 rounded cursor-pointer"/>
                          </label>
                        </div>
                      </div>

                      {state.hasPosition && (
                        <div className="mt-0.5 sm:mt-1 pt-1.5 sm:pt-2 border-t border-indigo-100/50 flex flex-col sm:flex-row sm:items-center justify-between animate-fade-in gap-1.5 sm:gap-2">
                          <label className="flex items-center text-[9px] sm:text-[10px] font-black text-indigo-700 cursor-pointer w-fit">
                            <input type="checkbox" checked={state.isLeader} onChange={(e) => toggleIsLeader(u.id, e.target.checked)} className="mr-1 sm:mr-1.5 w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-600 focus:ring-indigo-500 rounded-sm cursor-pointer"/> 役職長にする
                          </label>
                          {state.isLeader && (
                            <input type="text" placeholder="敬称 (例: 部長)" value={state.leaderTitle} onChange={(e) => setAssignForm(p => ({...p, [u.id]: {...p[u.id], leaderTitle: e.target.value}}))} className="border border-indigo-200 rounded-md sm:rounded-lg px-1.5 sm:px-2 py-1 sm:py-1.5 sm:py-1 text-[16px] sm:text-[9px] sm:text-[10px] font-bold outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-32 bg-white shadow-2xs" />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-2.5 sm:p-3 sm:p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0 flex justify-end gap-1.5 sm:gap-2 pb-5 sm:pb-6 sm:pb-4">
              <button onClick={() => setAssignModal({show:false, position:null})} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-300 text-gray-700 text-[10px] sm:text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl hover:bg-gray-100 transition-colors flex-1 sm:flex-none text-center shadow-2xs">キャンセル</button>
              <button onClick={handleSaveAssignments} disabled={isSubmitting} className="px-4 sm:px-5 py-1.5 sm:py-2 bg-indigo-600 text-white text-[10px] sm:text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl shadow-sm hover:bg-indigo-700 transition-colors flex items-center justify-center flex-1 sm:flex-none disabled:opacity-50">
                {isSubmitting ? <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin mr-1 sm:mr-1.5"/> : <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5"/>} 保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ユーザーベースのメンバー役職設定モーダル */}
      {userAssignModal.show && userAssignModal.user && (
        <div className="fixed inset-0 z-[100] flex sm:justify-end items-end sm:items-start bg-black/50 backdrop-blur-sm sm:p-4">
          <div className="bg-white w-full sm:max-w-lg h-[90vh] sm:h-auto sm:max-h-full rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-slide-in-right overflow-hidden border border-gray-200">
            <div className="p-2.5 sm:p-3 sm:p-4 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="text-[11px] sm:text-xs sm:text-sm font-black text-gray-900 flex items-center"><UserCog className="w-3.5 h-3.5 sm:w-4 h-4 mr-1 sm:mr-1.5 text-indigo-600"/> 個人の役職設定</h3>
                <p className="text-[8px] sm:text-[9px] sm:text-[10px] font-bold text-gray-500 mt-0.5 sm:mt-1 truncate max-w-[200px] sm:max-w-none"><span className="text-indigo-600 font-black">{userAssignModal.user.name}</span> の所属役職を選択します</p>
              </div>
              <button onClick={() => setUserAssignModal({show:false, user:null})} className="p-1 sm:p-1.5 bg-white text-gray-400 hover:text-gray-700 rounded-md sm:rounded-lg shadow-2xs border border-gray-200 transition-colors"><X className="w-4 h-4 sm:w-5 sm:h-5"/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 sm:p-4 custom-scrollbar bg-white space-y-3 sm:space-y-4 sm:space-y-6">
              
              {[
                { title: "生徒の役職", list: studentPositions, color: "emerald" },
                { title: "教職員・管理職の役職", list: teacherPositions, color: "purple" },
                { title: "外部組織等の役職", list: externalPositions, color: "orange" }
              ].map(group => {
                if (group.list.length === 0) return null;
                return (
                  <div key={group.title}>
                    <h4 className={`text-[10px] sm:text-[11px] sm:text-xs font-black mb-1.5 sm:mb-2 sm:mb-3 pb-0.5 sm:pb-1 border-b border-gray-100 text-${group.color}-800`}>{group.title}</h4>
                    <div className="space-y-1 sm:space-y-1.5 sm:space-y-2">
                      {group.list.map(pos => {
                        const isChecked = userAssignForm.positionIds.includes(pos.id);
                        const isPrimary = userAssignForm.primaryPositionId === pos.id;
                        return (
                          <div key={pos.id} className={`p-2 sm:p-2.5 sm:p-3 rounded-lg sm:rounded-xl border flex items-center justify-between transition-colors ${isChecked ? 'bg-indigo-50/30 border-indigo-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] sm:text-[11px] sm:text-xs font-black text-gray-900 truncate">{pos.name}</div>
                              <div className="text-[8px] sm:text-[9px] font-bold text-gray-500 mt-0.5 truncate">{organizations.find(o=>o.id===pos.organizationId)?.name || ""}</div>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 sm:gap-4 shrink-0">
                              {isChecked && (
                                <label className="flex items-center text-[8px] sm:text-[9px] sm:text-[10px] font-bold text-gray-700 cursor-pointer animate-fade-in bg-white px-1 sm:px-1.5 py-0.5 sm:py-1 rounded border border-gray-200 shadow-2xs">
                                  <input type="radio" checked={isPrimary} onChange={() => setUserAssignForm(p => ({...p, primaryPositionId: pos.id}))} className="mr-1 w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 focus:ring-amber-500 cursor-pointer"/> 優先
                                </label>
                              )}
                              <label className="flex items-center cursor-pointer bg-white p-1 rounded-md sm:rounded-lg border border-gray-100 shadow-2xs">
                                <input type="checkbox" checked={isChecked} onChange={(e) => toggleUserPosition(pos.id, e.target.checked)} className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:w-5 sm:h-5 text-indigo-600 focus:ring-indigo-500 rounded cursor-pointer"/>
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

            <div className="p-2.5 sm:p-3 sm:p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0 flex justify-end gap-1.5 sm:gap-2 pb-5 sm:pb-6 sm:pb-4">
              <button onClick={() => setUserAssignModal({show:false, user:null})} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-300 text-gray-700 text-[10px] sm:text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl hover:bg-gray-100 transition-colors flex-1 sm:flex-none text-center shadow-2xs">キャンセル</button>
              <button onClick={handleSaveUserAssignments} disabled={isSubmitting} className="px-4 sm:px-5 py-1.5 sm:py-2 bg-indigo-600 text-white text-[10px] sm:text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl shadow-sm hover:bg-indigo-700 transition-colors flex items-center justify-center flex-1 sm:flex-none disabled:opacity-50">
                {isSubmitting ? <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin mr-1 sm:mr-1.5"/> : <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5"/>} 保存
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}