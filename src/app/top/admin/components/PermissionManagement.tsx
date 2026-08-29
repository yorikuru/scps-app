"use client";

import React, { useState, useMemo } from "react";
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Loader2, ShieldCheck, CheckSquare, Square, AppWindow, Settings2, User as UserIcon } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { UserData, SchoolData } from "../page";
import CustomSelect from "@/components/CustomSelect"; // ★ CustomSelect をインポート

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

type ExtendedSchoolData = SchoolData & {
  availableModules?: string[];
  customAppNames?: Record<string, string>;
};

type ExtendedUserData = UserData & {
  systemId?: string;
  role?: string;
  positionName?: string;
  isManager?: boolean;
  allowedModules?: string[];
  photoURL?: string; 
};

type Props = {
  users: UserData[];
  setUsers: React.Dispatch<React.SetStateAction<UserData[]>>;
  schoolData: SchoolData | null;
  availableApps?: any[]; 
  showAlert: (type: "success" | "error" | "warning", message: string) => void;
};

export default function PermissionManagement({ users, setUsers, schoolData, availableApps, showAlert }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const [bulkTarget, setBulkTarget] = useState<string>("");
  const [bulkTargetApp, setBulkTargetApp] = useState<string>("all"); 
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const exSchoolData = schoolData as ExtendedSchoolData;
  const exUsers = users as ExtendedUserData[];

  const tenantAllowedModules = useMemo(() => {
    if (!exSchoolData || !exSchoolData.availableModules || exSchoolData.availableModules.length === 0) {
      return []; 
    }
    
    return (availableApps || [])
      .filter((app: any) => exSchoolData.availableModules!.includes(app.appId))
      .map((app: any) => {
        const customName = exSchoolData.customAppNames?.[app.appId];
        return {
          ...app,
          id: app.appId,
          displayName: customName || app.name
        };
      })
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  }, [exSchoolData, availableApps]);

  const processedUsers = useMemo(() => {
    let filtered = exUsers.filter(user => 
      searchQuery === "" || 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (user.systemId && user.systemId.includes(searchQuery))
    );

    filtered.sort((a, b) => {
      const aVal = a.systemId ? String(a.systemId).padStart(10, '0') : "9999999999";
      const bVal = b.systemId ? String(b.systemId).padStart(10, '0') : "9999999999";
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
      return 0;
    });

    return filtered;
  }, [exUsers, searchQuery]);

  const availablePositions = useMemo(() => {
    const posNames = exUsers.map(u => u.positionName).filter(Boolean) as string[];
    return Array.from(new Set(posNames));
  }, [exUsers]);

  const toggleModule = async (userId: string, moduleId: string, currentAllowed: string[]) => {
    setUpdatingUserId(userId);
    try {
      const newAllowed = currentAllowed.includes(moduleId)
        ? currentAllowed.filter(id => id !== moduleId)
        : [...currentAllowed, moduleId];

      await updateDoc(doc(db, "users", userId), { allowedModules: newAllowed });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, allowedModules: newAllowed } : u));
    } catch (e) {
      console.error(e);
      showAlert("error", "権限の更新に失敗しました。");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const toggleAllForUser = async (userId: string, allowAll: boolean) => {
    setUpdatingUserId(userId);
    try {
      const newAllowed = allowAll ? tenantAllowedModules.map(m => m.id) : [];
      await updateDoc(doc(db, "users", userId), { allowedModules: newAllowed });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, allowedModules: newAllowed } : u));
    } catch (e) {
      console.error(e);
      showAlert("error", "更新に失敗しました。");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleBulkUpdate = async (isAllow: boolean) => {
    if (!bulkTarget) {
      showAlert("warning", "一括操作の対象グループを選択してください。");
      return;
    }

    setIsBulkUpdating(true);
    try {
      const targetUsers = processedUsers.filter(u => {
        if (bulkTarget === "all") return true;
        if (bulkTarget === "manager") return u.isManager;
        if (bulkTarget.startsWith("role_")) return u.role === bulkTarget.replace("role_", "");
        if (bulkTarget.startsWith("pos_")) return u.positionName === bulkTarget.replace("pos_", "");
        return false;
      });

      if (targetUsers.length === 0) {
        showAlert("warning", "表示中のリストに対象ユーザーがいません。");
        setIsBulkUpdating(false);
        return;
      }
      
      const batch = writeBatch(db);
      const newUsersState = [...users];

      targetUsers.forEach(u => {
        let newAllowed = [...(u.allowedModules || [])];

        if (bulkTargetApp === "all") {
          newAllowed = isAllow ? tenantAllowedModules.map(m => m.id) : [];
        } else {
          if (isAllow) {
            if (!newAllowed.includes(bulkTargetApp)) {
              newAllowed.push(bulkTargetApp);
            }
          } else {
            newAllowed = newAllowed.filter(id => id !== bulkTargetApp);
          }
        }

        batch.update(doc(db, "users", u.id), { allowedModules: newAllowed });
        
        const userIdx = newUsersState.findIndex(user => user.id === u.id);
        if (userIdx !== -1) {
          newUsersState[userIdx] = { ...newUsersState[userIdx], allowedModules: newAllowed };
        }
      });

      await batch.commit();
      setUsers(newUsersState);

      const targetAppName = bulkTargetApp === "all" ? "すべてのアプリ" : tenantAllowedModules.find(m => m.id === bulkTargetApp)?.displayName || "指定アプリ";
      showAlert("success", `${targetUsers.length}名の「${targetAppName}」利用権限を一括${isAllow ? "許可" : "解除"}しました。`);
    } catch (error) {
      console.error(error);
      showAlert("error", "一括更新に失敗しました。");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  if (!schoolData) return null;

  return (
    <div className="space-y-3 sm:space-y-4 animate-fade-in">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 border-b border-gray-200 pb-2 sm:pb-3">
        <div>
          <h3 className="text-sm sm:text-base font-black text-gray-900 flex items-center gap-1.5">
            <AppWindow className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
            アプリ利用権限の設定
          </h3>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 mt-0.5">
            ユーザーごとに、このテナントで利用可能なアプリへのアクセス権を設定します。
          </p>
        </div>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-xl sm:rounded-2xl overflow-hidden">
        <div className="p-2.5 sm:p-3 space-y-2 sm:space-y-3">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-gray-50 p-2.5 sm:p-3 rounded-lg sm:rounded-xl border border-gray-100">
            <div className="relative w-full lg:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input 
                type="text" 
                placeholder="名前や利用番号で検索..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="block w-full pl-8 pr-2.5 py-1.5 border border-gray-200 rounded-lg text-[11px] sm:text-xs font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors shadow-2xs" 
              />
            </div>

            {/* ★ 高度な一括操作 UI */}
            <div className="flex flex-col xl:flex-row items-start xl:items-center gap-2 flex-wrap w-full lg:w-auto">
              <div className="flex items-center text-[10px] sm:text-[11px] font-bold text-indigo-800 gap-1 whitespace-nowrap">
                <Settings2 className="w-3.5 h-3.5" />
                高度な一括操作:
              </div>
              
              <div className="flex flex-wrap items-center gap-1.5 w-full xl:w-auto">
                <div className="flex-1 min-w-[120px]">
                  <CustomSelect
                    value={bulkTarget}
                    onChange={val => {
                      if (val.startsWith('disabled_')) return;
                      setBulkTarget(val);
                    }}
                    options={[
                      { value: "", label: "対象グループを選択" },
                      { value: "all", label: `表示中の全ユーザー (${processedUsers.length}名)` },
                      { value: "manager", label: "マネージャー権限をもつユーザー" },
                      { value: "disabled_role", label: "--- 権限ロール ---" },
                      { value: "role_admin", label: "  管理者" },
                      { value: "role_officer", label: "  生徒会役員" },
                      { value: "role_teacher", label: "  教職員" },
                      { value: "role_student", label: "  一般生徒" },
                      ...(availablePositions.length > 0 ? [
                        { value: "disabled_pos", label: "--- 役職別 ---" },
                        ...availablePositions.map(pos => ({ value: `pos_${pos}`, label: `  ${pos}` }))
                      ] : [])
                    ]}
                    buttonClassName="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-[10px] sm:text-[11px] font-bold focus:ring-2 focus:ring-indigo-500 shadow-2xs flex items-center justify-between"
                  />
                </div>
                <span className="text-[9px] text-gray-400 font-bold whitespace-nowrap">の</span>
                
                <div className="flex-1 min-w-[120px]">
                  <CustomSelect
                    value={bulkTargetApp}
                    onChange={setBulkTargetApp}
                    options={[
                      { value: "all", label: "すべてのアプリ" },
                      ...tenantAllowedModules.map(mod => ({ value: mod.id, label: mod.displayName || mod.name }))
                    ]}
                    buttonClassName="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-[10px] sm:text-[11px] font-bold focus:ring-2 focus:ring-indigo-500 shadow-2xs flex items-center justify-between"
                  />
                </div>
                <span className="text-[9px] text-gray-400 font-bold whitespace-nowrap">を</span>
              </div>

              <div className="flex gap-2 w-full xl:w-auto mt-1 xl:mt-0 ml-auto">
                <button 
                  onClick={() => handleBulkUpdate(true)} 
                  disabled={isBulkUpdating || !bulkTarget} 
                  className="flex-1 xl:flex-none px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] sm:text-[11px] font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center shadow-2xs"
                >
                  {isBulkUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "一括許可"}
                </button>
                <button 
                  onClick={() => handleBulkUpdate(false)} 
                  disabled={isBulkUpdating || !bulkTarget} 
                  className="flex-1 xl:flex-none px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-[10px] sm:text-[11px] font-bold hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center shadow-2xs"
                >
                  {isBulkUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "一括解除"}
                </button>
              </div>
            </div>
          </div>

          {tenantAllowedModules.length === 0 ? (
            <div className="p-6 sm:p-8 text-center bg-gray-50 border border-dashed border-gray-300 rounded-xl">
              <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-[11px] sm:text-xs font-bold text-gray-500 mb-1">このテナントに許可されているアプリがありません。</p>
              <p className="text-[9px] sm:text-[10px] text-gray-400">※テナント全体の設定でアプリが許可されていない可能性があります。</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-xl relative custom-scrollbar">
              <table className="min-w-full divide-y divide-gray-200 text-left whitespace-nowrap">
                <thead className="bg-gray-50 text-[9px] sm:text-[10px] font-black text-gray-500">
                  <tr>
                    <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 w-16 sm:w-20 border-r border-gray-100 text-center">利用番号</th>
                    <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 border-r border-gray-100 min-w-[150px]">ユーザー名 / 役職</th>
                    <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-center border-r border-gray-100 w-16 sm:w-20">個人の一括</th>
                    
                    {tenantAllowedModules.map(mod => (
                      <th key={mod.id} scope="col" className="px-2 py-2 text-center min-w-[60px] sm:min-w-[70px]">
                        <div className="flex flex-col items-center gap-1">
                          <DynamicIcon name={mod.icon || "Box"} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
                          <span className="text-[8px] sm:text-[9px]">{mod.displayName || mod.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 text-[11px] sm:text-xs font-bold">
                  {processedUsers.map((user) => {
                    const userAllowed = user.allowedModules || [];
                    const isAllAllowed = tenantAllowedModules.length > 0 && tenantAllowedModules.every(m => userAllowed.includes(m.id));
                    const isProcessing = updatingUserId === user.id;

                    return (
                      <tr key={user.id} className="hover:bg-gray-50/70 transition-colors">
                        
                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 font-mono text-[9px] sm:text-[10px] text-gray-500 border-r border-gray-100 text-center">
                          {user.systemId || "-"}
                        </td>

                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 border-r border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-200">
                              {user.photoURL ? (
                                <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
                              ) : (
                                <UserIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                              )}
                            </div>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="text-gray-900 font-bold text-[10px] sm:text-xs truncate">{user.name}</span>
                              <div className="flex items-center gap-1 flex-wrap">
                                {user.positionName ? (
                                  <span className="text-[8px] sm:text-[9px] text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100 truncate max-w-[80px] sm:max-w-xs">{user.positionName}</span>
                                ) : <span className="text-[8px] sm:text-[9px] text-gray-400">役職なし</span>}
                                {user.isManager && <span className="text-[7px] sm:text-[8px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">マネ</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-center border-r border-gray-100">
                          <button
                            onClick={() => toggleAllForUser(user.id, !isAllAllowed)}
                            disabled={isProcessing}
                            className={`px-1.5 py-1 rounded text-[8px] sm:text-[9px] transition-colors border ${
                              isAllAllowed 
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" 
                                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                            } disabled:opacity-50 w-full sm:w-auto`}
                          >
                            {isProcessing ? <Loader2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin mx-auto" /> : (isAllAllowed ? "全解除" : "全許可")}
                          </button>
                        </td>

                        {tenantAllowedModules.map(mod => {
                          const hasPermission = userAllowed.includes(mod.id);
                          return (
                            <td key={mod.id} className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-center hover:bg-gray-50 transition-colors">
                              <button
                                onClick={() => toggleModule(user.id, mod.id, userAllowed)}
                                disabled={isProcessing}
                                className="p-1 rounded transition-colors disabled:opacity-50 inline-flex items-center justify-center focus:outline-none"
                              >
                                {hasPermission ? (
                                  <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300" />
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {processedUsers.length === 0 && (
                    <tr>
                      <td colSpan={3 + tenantAllowedModules.length} className="px-4 py-8 text-center text-[10px] sm:text-xs text-gray-400">
                        条件に一致するユーザーが見つかりません。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}