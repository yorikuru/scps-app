"use client";

import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { X, ShieldCheck, Loader2, Mail, ScanLine, Fingerprint, User as UserIcon, Lock, Star } from "lucide-react";
import { UserData, SchoolData, MfaPolicy } from "../page";
import { Position } from "./UserManagement";

export type ExtendedUserData = UserData & {
  systemId?: string;
  studentId?: string;
  nameKana?: string;
  attendanceNumber?: string;
  birthDate?: string;
  classNumber?: string;
  club?: string;
  department?: string;
  gender?: string;
  grade?: string;
  organizationAddress?: string;
  phoneNumber?: string;
  previousSchool?: string;
  accountValidStartDate?: string;
  accountValidEndDate?: string;
  lineConnectionAllowed?: boolean;
  lineConnectionEnforced?: boolean;
  lineNotificationEnabled?: boolean;
  isITManager?: boolean;
  isManager?: boolean; 
  accountStatus: "active" | "pending" | "rejected" | "unaccessed";
  requireMfa?: boolean;
  useCustomMfaPolicy?: boolean;
  initialPassword?: string;
  mfaPolicies?: {
    email: MfaPolicy;
    totp: MfaPolicy;
    passkey: MfaPolicy;
  };
};

type Props = {
  user: ExtendedUserData;
  schoolData: SchoolData | null;
  positions: Position[];
  onClose: () => void;
  showAlert: (type: "success" | "error" | "warning", message: string) => void;
  onUpdateUser: (updatedUser: ExtendedUserData) => void;
};

export default function UserDetailsModal({ user, schoolData, positions, onClose, showAlert, onUpdateUser }: Props) {
  const [activeTab, setActiveTab] = useState<"basic" | "profile" | "security">("basic");
  const [editData, setEditData] = useState<ExtendedUserData>(user);
  const [isUpdating, setIsUpdating] = useState(false);
  const [useCustomMfaPolicy, setUseCustomMfaPolicy] = useState(user.useCustomMfaPolicy || false);

  const sortedStudents = positions.filter(p => p.isInternal && p.isStudent).sort((a,b) => a.shokui - b.shokui || a.displayOrder - b.displayOrder);
  const sortedTeachers = positions.filter(p => p.isInternal && !p.isStudent).sort((a,b) => a.shokui - b.shokui || a.displayOrder - b.displayOrder);
  const sortedExternals = positions.filter(p => !p.isInternal).sort((a,b) => a.displayOrder - b.displayOrder);

  const leaderPositions = positions.filter(p => p.leaderUserId === editData.id);

  const getMfaPolicy = (methodKey: "email" | "totp" | "passkey") => {
    if (useCustomMfaPolicy && editData.mfaPolicies && editData.mfaPolicies[methodKey]) {
      return editData.mfaPolicies[methodKey];
    }
    if (schoolData?.mfaPolicies && schoolData.mfaPolicies[methodKey]) {
      return schoolData.mfaPolicies[methodKey];
    }
    return { allowSetup: false, forceSetup: false, allowUsage: false };
  };

  const handlePolicyChange = (methodKey: "email" | "totp" | "passkey", field: keyof MfaPolicy, value: boolean) => {
    if (!useCustomMfaPolicy) return;
    setEditData((prev) => {
      const currentPolicies = prev.mfaPolicies || {
        email: { allowSetup: false, forceSetup: false, allowUsage: false },
        totp: { allowSetup: false, forceSetup: false, allowUsage: false },
        passkey: { allowSetup: false, forceSetup: false, allowUsage: false },
      };
      return {
        ...prev,
        mfaPolicies: {
          ...currentPolicies,
          [methodKey]: { ...currentPolicies[methodKey], [field]: value }
        }
      };
    });
  };

  const handleSave = async () => {
    setIsUpdating(true);
    try {
      const dataToSave = { ...editData, useCustomMfaPolicy };
      
      let validPosIds = [...(dataToSave.positionIds || [])];
      validPosIds = validPosIds.filter(pid => {
        const pObj = positions.find(p => p.id === pid);
        if (!pObj) return false;
        if (pObj.isInternal) {
          if (pObj.isStudent && !["admin", "guest", "student", "officer"].includes(dataToSave.role)) return false;
          if (!pObj.isStudent && !["admin", "guest", "teacher"].includes(dataToSave.role)) return false;
        }
        return true;
      });
      dataToSave.positionIds = validPosIds;
      if (!validPosIds.includes(dataToSave.primaryPositionId || "")) {
        dataToSave.primaryPositionId = validPosIds.length > 0 ? validPosIds[0] : "";
        dataToSave.positionName = validPosIds.length > 0 ? positions.find(p => p.id === validPosIds[0])?.name : "";
      }

      await updateDoc(doc(db, "users", editData.id), dataToSave);
      onUpdateUser(dataToSave);
      showAlert("success", "ユーザー情報を更新しました。");
      onClose();
    } catch (error) {
      showAlert("error", "更新に失敗しました。");
    } finally {
      setIsUpdating(false);
    }
  };

  const togglePosition = (posId: string, val: boolean) => {
    setEditData(prev => {
      let newIds = [...(prev.positionIds || [])];
      let newPrimary = prev.primaryPositionId || "";
      if (val) {
        if (!newIds.includes(posId)) newIds.push(posId);
        if (!newPrimary) newPrimary = posId;
      } else {
        newIds = newIds.filter(id => id !== posId);
        if (newPrimary === posId) newPrimary = newIds.length > 0 ? newIds[0] : "";
      }
      const newName = positions.find(p => p.id === newPrimary)?.name || "";
      return { ...prev, positionIds: newIds, primaryPositionId: newPrimary, positionName: newName };
    });
  };

  const setPrimaryPosition = (posId: string) => {
    const newName = positions.find(p => p.id === posId)?.name || "";
    setEditData(prev => ({ ...prev, primaryPositionId: posId, positionName: newName }));
  };

  const renderPositionGroup = (title: string, list: Position[], color: string) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-4">
        <h4 className={`text-[10px] font-black text-${color}-700 mb-1.5 border-b border-${color}-100 pb-1`}>{title}</h4>
        <div className="space-y-1.5">
          {list.map(p => {
            const hasPos = editData.positionIds?.includes(p.id) || false;
            const isPrimary = editData.primaryPositionId === p.id;
            const isLeader = p.leaderUserId === editData.id;
            return (
              <div key={p.id} className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-colors ${hasPos ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                <div className="flex items-center gap-2">
                  <label className="flex items-center text-xs font-bold text-gray-800 cursor-pointer">
                    <input type="checkbox" checked={hasPos} onChange={e => togglePosition(p.id, e.target.checked)} className="mr-2 text-indigo-600 rounded cursor-pointer w-4 h-4" />
                    {p.name}
                  </label>
                  {isLeader && (
                    <span className="text-[9px] font-black text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 fill-indigo-600"/> 役職長 ({p.leaderTitle || '長'})
                    </span>
                  )}
                </div>
                {hasPos && (
                  <label className="flex items-center text-[10px] font-bold text-amber-600 cursor-pointer animate-fade-in bg-white px-2 py-0.5 rounded shadow-sm border border-amber-100">
                    <input type="radio" checked={isPrimary} onChange={() => setPrimaryPosition(p.id)} className="mr-1.5 text-amber-500 cursor-pointer w-3 h-3" />
                    優先
                  </label>
                )}
              </div>
            )
          })}
        </div>
      </div>
    );
  };

  const PolicyRow = ({ methodKey, name, icon: Icon }: { methodKey: "email" | "totp" | "passkey", name: string, icon: any }) => {
    const policy = getMfaPolicy(methodKey);
    return (
      <div className={`p-3 sm:p-4 rounded-xl border transition-colors ${useCustomMfaPolicy ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-70'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-4 w-4 text-gray-500" />
          <h4 className="text-xs font-bold text-gray-900">{name}</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <label className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-1.5 cursor-pointer">
            <span className="text-[10px] font-bold text-gray-500">初期設定の許可</span>
            <div className={`px-2 py-1.5 rounded text-[10px] font-bold text-center border transition-colors w-full sm:w-auto ${policy.allowSetup ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-400'}`}>
              <input type="checkbox" className="hidden" checked={policy.allowSetup} onChange={(e) => handlePolicyChange(methodKey, "allowSetup", e.target.checked)} disabled={!useCustomMfaPolicy} />
              {policy.allowSetup ? "許可する" : "許可しない"}
            </div>
          </label>
          <label className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-1.5 cursor-pointer">
            <span className="text-[10px] font-bold text-gray-500">設定の強制</span>
            <div className={`px-2 py-1.5 rounded text-[10px] font-bold text-center border transition-colors w-full sm:w-auto ${policy.forceSetup ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-200 text-gray-400'}`}>
              <input type="checkbox" className="hidden" checked={policy.forceSetup} onChange={(e) => handlePolicyChange(methodKey, "forceSetup", e.target.checked)} disabled={!useCustomMfaPolicy || !policy.allowSetup} />
              {policy.forceSetup ? "強制する" : "任意"}
            </div>
          </label>
          <label className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-1.5 cursor-pointer">
            <span className="text-[10px] font-bold text-gray-500">ログイン利用</span>
            <div className={`px-2 py-1.5 rounded text-[10px] font-bold text-center border transition-colors w-full sm:w-auto ${policy.allowUsage ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-400'}`}>
              <input type="checkbox" className="hidden" checked={policy.allowUsage} onChange={(e) => handlePolicyChange(methodKey, "allowUsage", e.target.checked)} disabled={!useCustomMfaPolicy} />
              {policy.allowUsage ? "許可する" : "許可しない"}
            </div>
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-3xl h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 flex-shrink-0">
          <div>
            <h3 className="text-xs sm:text-sm font-black text-gray-900">{editData.name} の設定</h3>
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 truncate max-w-[200px] sm:max-w-none">{editData.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex border-b border-gray-100 flex-shrink-0 bg-white overflow-x-auto custom-scrollbar">
          <button onClick={() => setActiveTab("basic")} className={`flex-1 min-w-[100px] py-3 text-[11px] sm:text-xs font-bold transition-colors whitespace-nowrap ${activeTab === "basic" ? "border-b-2 border-indigo-500 text-indigo-600" : "text-gray-500 hover:bg-gray-50"}`}>
            基本情報・役職
          </button>
          <button onClick={() => setActiveTab("profile")} className={`flex-1 min-w-[100px] py-3 text-[11px] sm:text-xs font-bold transition-colors whitespace-nowrap ${activeTab === "profile" ? "border-b-2 border-indigo-500 text-indigo-600" : "text-gray-500 hover:bg-gray-50"}`}>
            プロフィール
          </button>
          <button onClick={() => setActiveTab("security")} className={`flex-1 min-w-[100px] py-3 text-[11px] sm:text-xs font-bold transition-colors whitespace-nowrap ${activeTab === "security" ? "border-b-2 border-indigo-500 text-indigo-600" : "text-gray-500 hover:bg-gray-50"}`}>
            セキュリティ
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white custom-scrollbar pb-24 sm:pb-6">
          
          {/* ========== 基本情報・役職タブ ========== */}
          <div className={activeTab === "basic" ? "block" : "hidden"}>
            <div className="space-y-4 sm:space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">名前 <span className="text-red-500">*</span></label>
                  <input type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 bg-white"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">メールアドレス</label>
                  <input type="text" value={editData.email} disabled className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-sm font-bold bg-gray-50 text-gray-500"/>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">権限ロール</label>
                  <select value={editData.role} onChange={(e) => setEditData({ ...editData, role: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    <option value="admin">テナント管理者</option>
                    <option value="officer">生徒会役員</option>
                    <option value="teacher">教職員・顧問</option>
                    <option value="student">一般生徒</option>
                    <option value="guest">ゲスト</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 pt-1 sm:pt-5 border-t sm:border-t-0 border-gray-100 mt-2 sm:mt-0">
                  <label className="flex items-center text-xs font-bold text-gray-700 cursor-pointer p-2 sm:p-0 hover:bg-gray-50 rounded-lg">
                    <input type="checkbox" checked={!!editData.isITManager} onChange={(e) => setEditData({ ...editData, isITManager: e.target.checked })} className="mr-2 w-4 h-4 text-purple-600 rounded cursor-pointer" />
                    IT管理者権限を付与する
                  </label>
                  <label className="flex items-center text-xs font-bold text-gray-700 cursor-pointer p-2 sm:p-0 hover:bg-gray-50 rounded-lg">
                    <input type="checkbox" checked={!!editData.isManager} onChange={(e) => setEditData({ ...editData, isManager: e.target.checked })} className="mr-2 w-4 h-4 text-emerald-600 rounded cursor-pointer" />
                    マネージャー権限を付与する
                  </label>
                </div>
              </div>

              {leaderPositions.length > 0 && (
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <span className="text-[10px] font-black text-indigo-800 block mb-1 flex items-center gap-1"><Star className="w-3 h-3 fill-indigo-600"/> 役職長としての担当役職</span>
                  <div className="flex flex-wrap gap-1.5">
                    {leaderPositions.map(lp => (
                      <span key={lp.id} className="text-xs font-bold text-indigo-900 bg-white px-2 py-1 rounded-lg border border-indigo-200 shadow-xs">
                        {lp.name} ({lp.leaderTitle || '長'})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-2">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 flex items-center justify-between">
                  付与する役職
                  <span className="text-[9px] text-gray-400 hidden sm:inline">チェックで付与 / 優先は画面上の表示名になります</span>
                </label>
                <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 max-h-60 overflow-y-auto custom-scrollbar">
                  {["admin", "guest", "student", "officer"].includes(editData.role) && renderPositionGroup("生徒の役職", sortedStudents, "emerald")}
                  {["admin", "guest", "teacher"].includes(editData.role) && renderPositionGroup("教職員・管理職の役職", sortedTeachers, "purple")}
                  {renderPositionGroup("外部組織等の役職", sortedExternals, "orange")}
                  {positions.length === 0 && <p className="text-[10px] font-bold text-gray-400 text-center py-2">役職マスタが登録されていません</p>}
                </div>
              </div>
            </div>
          </div>

          {/* ========== プロフィール詳細タブ ========== */}
          <div className={activeTab === "profile" ? "block animate-fade-in" : "hidden"}>
            <div className="space-y-4 sm:space-y-5">
              <div className="flex items-center gap-2 mb-2 sm:mb-4 pb-2 border-b border-gray-100">
                <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                <h4 className="text-xs sm:text-sm font-black text-gray-900">詳細プロフィール情報</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">システム利用番号</label>
                  <input type="text" value={editData.systemId || ""} disabled className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none bg-gray-50 text-gray-500"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">学籍・教職員番号</label>
                  <input type="text" value={editData.studentId || ""} onChange={(e) => setEditData({ ...editData, studentId: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">氏名 (フリガナ)</label>
                  <input type="text" value={editData.nameKana || ""} onChange={(e) => setEditData({ ...editData, nameKana: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">性別</label>
                    <select value={editData.gender || ""} onChange={(e) => setEditData({ ...editData, gender: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">未設定</option>
                      <option value="male">男性</option>
                      <option value="female">女性</option>
                      <option value="other">その他・答えない</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">生年月日</label>
                    <input type="date" value={editData.birthDate || ""} onChange={(e) => setEditData({ ...editData, birthDate: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">所属 (学科等)</label>
                  <input type="text" value={editData.department || ""} onChange={(e) => setEditData({ ...editData, department: e.target.value })} placeholder="例: 普通科" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">学年</label>
                  <input type="text" value={editData.grade || ""} onChange={(e) => setEditData({ ...editData, grade: e.target.value })} placeholder="例: 2" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div className="grid grid-cols-2 gap-2 col-span-2 sm:col-span-1">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">組</label>
                    <input type="text" value={editData.classNumber || ""} onChange={(e) => setEditData({ ...editData, classNumber: e.target.value })} placeholder="例: 4" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">出席番号</label>
                    <input type="text" value={editData.attendanceNumber || ""} onChange={(e) => setEditData({ ...editData, attendanceNumber: e.target.value })} placeholder="例: 38" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">部活動・同好会</label>
                  <input type="text" value={editData.club || ""} onChange={(e) => setEditData({ ...editData, club: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">出身校・前所属</label>
                  <input type="text" value={editData.previousSchool || ""} onChange={(e) => setEditData({ ...editData, previousSchool: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">電話番号</label>
                  <input type="tel" value={editData.phoneNumber || ""} onChange={(e) => setEditData({ ...editData, phoneNumber: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">居住地</label>
                  <input type="text" value={editData.organizationAddress || ""} onChange={(e) => setEditData({ ...editData, organizationAddress: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">アカウント有効期間 (開始)</label>
                  <input type="date" value={editData.accountValidStartDate || ""} onChange={(e) => setEditData({ ...editData, accountValidStartDate: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">アカウント有効期間 (終了)</label>
                  <input type="date" value={editData.accountValidEndDate || ""} onChange={(e) => setEditData({ ...editData, accountValidEndDate: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
              </div>

            </div>
          </div>

          {/* ========== 認証・セキュリティタブ ========== */}
          <div className={activeTab === "security" ? "block animate-fade-in" : "hidden"}>
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
                <div className="flex items-center mb-2">
                  <ShieldCheck className="h-4 w-4 text-gray-500 mr-2" />
                  <h4 className="text-xs font-bold text-gray-900">アカウント状態</h4>
                </div>
                <select value={editData.accountStatus} onChange={(e) => setEditData({ ...editData, accountStatus: e.target.value as any })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[16px] sm:text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="active">アクティブ</option>
                  <option value="pending">承認待ち</option>
                  <option value="rejected">停止中 (アクセス不可)</option>
                  <option value="unaccessed">未アクセス</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2 sm:mb-3">
                  <h4 className="text-xs sm:text-sm font-black text-gray-900 flex items-center"><Lock className="h-4 w-4 mr-1.5 text-indigo-600"/> MFA 個人ポリシー設定</h4>
                </div>
                
                <div className="bg-gray-100 p-1 rounded-xl flex flex-col sm:flex-row mb-4 border border-gray-200">
                  <button onClick={() => setUseCustomMfaPolicy(false)} className={`flex-1 py-2 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${!useCustomMfaPolicy ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>組織設定に同期</button>
                  <button onClick={() => setUseCustomMfaPolicy(true)} className={`flex-1 py-2 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${useCustomMfaPolicy ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>個人設定を優先</button>
                </div>

                <div className="space-y-3 relative">
                  {!useCustomMfaPolicy && <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[1px] rounded-xl flex items-center justify-center"><span className="text-xs font-bold text-gray-600 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">組織設定に同期中です</span></div>}
                  <PolicyRow methodKey="passkey" name="パスキー (生体認証)" icon={Fingerprint} />
                  <PolicyRow methodKey="totp" name="認証アプリ (TOTP)" icon={ScanLine} />
                  <PolicyRow methodKey="email" name="メール認証" icon={Mail} />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* スマホでキーボードが出ても隠れないように絶対配置で下部に固定 */}
        <div className="absolute bottom-0 inset-x-0 sm:relative px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 bg-white sm:bg-gray-50 flex justify-end gap-2 z-20">
          <button onClick={onClose} disabled={isUpdating} className="flex-1 sm:flex-none px-4 py-3 sm:py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-xs sm:text-sm font-bold hover:bg-gray-100 transition-colors disabled:opacity-50">キャンセル</button>
          <button onClick={handleSave} disabled={isUpdating} className="flex-1 sm:flex-none px-4 py-3 sm:py-2.5 bg-indigo-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-indigo-700 shadow-sm transition-colors flex items-center justify-center disabled:opacity-50">
            {isUpdating && <Loader2 className="animate-spin h-4 w-4 mr-2" />} 変更を保存
          </button>
        </div>
      </div>
    </div>
  );
}