"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, onSnapshot, getDocs, updateDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { 
  Globe, Search, Filter, ArrowUpDown, UserPlus, ShieldAlert, 
  Loader2, Shield, CheckSquare, Square, Users, Sliders, XCircle,
  LayoutGrid, Settings2
} from "lucide-react";

import { useDialog } from "@/components/DialogContext";
import { ChatPermissions, getDefaultChatPermissions } from "@/app/top/chat/types";
import { ExternalUser } from "@/app/types/external";
import CustomSelect from "@/components/CustomSelect"; // ★ CustomSelectをインポート

import ExternalUserList from "./components/ExternalUserList";
import ExternalUserForm from "./components/ExternalUserForm";
import ExternalAppManagementTab from "./components/ExternalAppManagementTab";

type UserData = any; 
type SystemApp = any;

const EXTERNAL_PERMISSIONS: { id: keyof ChatPermissions; name: string; icon: any; desc: string }[] = [
  { id: "canCreateExternalUser", name: "ゲスト登録", icon: UserPlus, desc: "外部ゲストの新規登録" },
  { id: "canViewExternalUser", name: "ゲスト参照", icon: Globe, desc: "外部ユーザー情報の閲覧" },
  { id: "canEditExternalUser", name: "ゲスト編集", icon: Sliders, desc: "外部ユーザー情報の変更" },
  { id: "canDeleteExternalUser", name: "ゲスト削除", icon: XCircle, desc: "外部ユーザーの削除" }, 
];

export default function ExternalUsersPage() {
  const router = useRouter();
  const { showAlert } = useDialog();
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]);
  const [schoolData, setSchoolData] = useState<any>(null);
  const [externalUsers, setExternalUsers] = useState<ExternalUser[]>([]);
  const [systemApps, setSystemApps] = useState<SystemApp[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(true);

  const [activeTab, setActiveTab] = useState<"list" | "permissions" | "apps">("list");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"created_desc" | "name_asc" | "valid_asc">("created_desc");

  const [permSearchQuery, setPermSearchQuery] = useState("");
  const [bulkTarget, setBulkTarget] = useState<string>("");
  const [bulkTargetItem, setBulkTargetItem] = useState<string>("all"); 
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const [manageMode, setManageMode] = useState<{
    show: boolean;
    mode: "create" | "edit" | "view";
    targetUser?: ExternalUser | null;
  }>({ show: false, mode: "view", targetUser: null });

  useEffect(() => {
    let unsubExt: () => void;
    let unsubUsers: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocSnap = await getDoc(doc(db, "users", user.uid));
          if (!userDocSnap.exists()) { router.push("/login"); return; }
          const currentUserData = { id: user.uid, ...userDocSnap.data() } as UserData;
          setUserData(currentUserData);

          const schoolDocSnap = await getDoc(doc(db, "schools", currentUserData.schoolId));
          if (schoolDocSnap.exists()) {
            setSchoolData(schoolDocSnap.data());
          }

          const userPerms = getDefaultChatPermissions(currentUserData);
          const isAdmin = currentUserData.role === "admin" || currentUserData.role === "system_admin" || currentUserData.isITManager;
          
          const canCreateExt = isAdmin || userPerms.canCreateExternalUser;
          const canViewExt = isAdmin || userPerms.canViewExternalUser;

          if (!canCreateExt && !canViewExt && !isAdmin) {
            setHasPermission(false);
            setIsLoading(false);
            return;
          }

          const appsSnap = await getDocs(collection(db, "system_apps"));
          setSystemApps(appsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));

          const qExt = query(collection(db, "external_users"), where("schoolId", "==", currentUserData.schoolId));
          unsubExt = onSnapshot(qExt, (snapshot) => {
            const fetched: ExternalUser[] = [];
            snapshot.forEach(d => fetched.push({ id: d.id, ...d.data() } as ExternalUser));
            setExternalUsers(fetched);
          });

          if (isAdmin) {
            const qUsers = query(collection(db, "users"), where("schoolId", "==", currentUserData.schoolId));
            unsubUsers = onSnapshot(qUsers, (snapshot) => {
              const fetchedU: UserData[] = [];
              snapshot.forEach(d => fetchedU.push({ id: d.id, ...d.data() }));
              setTenantUsers(fetchedU);
            });
          }

          setIsLoading(false);
        } catch (error) {
          console.error(error);
          setIsLoading(false);
        }
      } else {
        router.push("/login");
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubExt) unsubExt();
      if (unsubUsers) unsubUsers();
    };
  }, [router]);

  const userPerms = userData ? getDefaultChatPermissions(userData) : null;
  const isSuperAdmin = userData?.role === "admin" || userData?.role === "system_admin" || userData?.isITManager;
  
  const canCreateExt = isSuperAdmin || (userPerms?.canCreateExternalUser ?? false);
  const canViewExt = isSuperAdmin || (userPerms?.canViewExternalUser ?? false);

  const filteredUsers = useMemo(() => {
    return externalUsers.filter(e => {
      const matchName = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (e.nameKana || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (e.affiliation || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = categoryFilter === "all" || e.category === categoryFilter;
      return matchName && matchCat;
    }).sort((a, b) => {
      if (sortOrder === "name_asc") return a.name.localeCompare(b.name, "ja");
      if (sortOrder === "valid_asc") return (a.validUntil || "9999").localeCompare(b.validUntil || "9999");
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [externalUsers, searchQuery, categoryFilter, sortOrder]);

  const processedPermUsers = useMemo(() => {
    let filtered = tenantUsers.filter(user => 
      permSearchQuery === "" || 
      user.name.toLowerCase().includes(permSearchQuery.toLowerCase()) || 
      ((user as any).systemId && String((user as any).systemId).includes(permSearchQuery))
    );

    filtered.sort((a, b) => {
      const aVal = (a as any).systemId ? String((a as any).systemId).padStart(6, '0') : "999999";
      const bVal = (b as any).systemId ? String((b as any).systemId).padStart(6, '0') : "999999";
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
      return a.name.localeCompare(b.name, "ja");
    });
    return filtered;
  }, [tenantUsers, permSearchQuery]);

  const availablePositions = useMemo(() => {
    const posNames = tenantUsers.map(u => (u as any).positionName).filter(Boolean) as string[];
    return Array.from(new Set(posNames));
  }, [tenantUsers]);

  const togglePermission = async (userId: string, permId: keyof ChatPermissions, currentPerms: ChatPermissions, isAdmin?: boolean) => {
    if (isAdmin) return; 
    setUpdatingUserId(userId);
    try {
      const newPerms = { ...currentPerms, [permId]: !currentPerms[permId] };
      if (permId === "canViewExternalUser" && !newPerms.canViewExternalUser) {
        newPerms.canEditExternalUser = false;
        newPerms.canDeleteExternalUser = false;
      }
      await updateDoc(doc(db, "users", userId), { chatPermissions: newPerms });
    } catch (e) {
      showAlert("権限の更新に失敗しました。", "error");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const toggleCategoryAllForUser = async (userId: string, allowAll: boolean, currentPerms: ChatPermissions, isAdmin?: boolean) => {
    if (isAdmin) return;
    setUpdatingUserId(userId);
    try {
      const newPerms = { ...currentPerms };
      EXTERNAL_PERMISSIONS.forEach(item => { newPerms[item.id] = allowAll; });
      await updateDoc(doc(db, "users", userId), { chatPermissions: newPerms });
    } catch (e) {
      showAlert("更新に失敗しました。", "error");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleBulkUpdate = async (isAllow: boolean) => {
    if (!bulkTarget) return showAlert("一括操作の対象グループを選択してください。", "warning");

    setIsBulkUpdating(true);
    try {
      const targetUsers = processedPermUsers.filter(u => {
        if (bulkTarget === "all") return true;
        if (bulkTarget === "manager") return (u as any).isManager;
        if (bulkTarget.startsWith("role_")) return u.role === bulkTarget.replace("role_", "");
        if (bulkTarget.startsWith("pos_")) return (u as any).positionName === bulkTarget.replace("pos_", "");
        return false;
      });

      const validTargets = targetUsers.filter(u => !(u.role === "admin" || u.role === "system_admin" || (u as any).isITManager));

      if (validTargets.length === 0) {
        showAlert("変更可能な対象ユーザーがいません（管理者は変更できません）。", "warning");
        setIsBulkUpdating(false);
        return;
      }
      
      const batch = writeBatch(db);

      validTargets.forEach(u => {
        const currentPerms = getDefaultChatPermissions(u);
        const newPerms = { ...currentPerms };

        if (bulkTargetItem === "all") {
          EXTERNAL_PERMISSIONS.forEach(item => { newPerms[item.id] = isAllow; });
        } else {
          newPerms[bulkTargetItem as keyof ChatPermissions] = isAllow;
          if (bulkTargetItem === "canViewExternalUser" && !isAllow) {
            newPerms.canEditExternalUser = false;
            newPerms.canDeleteExternalUser = false;
          }
        }
        batch.update(doc(db, "users", u.id), { chatPermissions: newPerms });
      });

      await batch.commit();

      const targetItemName = bulkTargetItem === "all" ? "すべてのゲスト管理権限" : EXTERNAL_PERMISSIONS.find(m => m.id === bulkTargetItem)?.name || "指定項目";
      showAlert(`${validTargets.length}名の「${targetItemName}」を一括${isAllow ? "許可" : "解除"}しました。`, "success");
    } catch (error) {
      showAlert("一括更新に失敗しました。", "error");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  if (isLoading) return <div className="h-full flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  if (!hasPermission) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-xl font-black text-gray-800 mb-2">アクセス権限がありません</h1>
        <p className="text-[11px] sm:text-xs font-bold text-gray-500 mb-6 text-center leading-relaxed">外部ユーザーを閲覧・管理する権限が付与されていません。</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col min-h-0 font-sans text-gray-900 bg-[#F9FAFB] relative overflow-hidden">
      <main className="flex-1 w-full max-w-6xl mx-auto p-2 sm:p-4 lg:p-6 flex flex-col min-h-0">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 mb-2.5 sm:mb-4 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2.5 bg-amber-100 text-amber-600 rounded-lg sm:rounded-xl shadow-sm">
              <Globe className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-sm sm:text-lg lg:text-xl font-black text-gray-900 tracking-tight">ゲスト・外部連携ユーザー管理</h1>
              <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 mt-0.5">テナント外のユーザーアカウントを発行・権限管理します</p>
            </div>
          </div>
          {activeTab === "list" && canCreateExt && (
            <button 
              onClick={() => setManageMode({ show: true, mode: "create" })}
              className="px-3 sm:px-4 py-1.5 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-1.5 sm:gap-2 hover:-translate-y-0.5"
            >
              <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 新規ゲスト登録
            </button>
          )}
        </div>

        {isSuperAdmin && (
          <div className="flex border-b border-gray-200 mb-2 sm:mb-4 shrink-0 overflow-x-auto custom-scrollbar">
            <button 
              onClick={() => setActiveTab("list")}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${activeTab === "list" ? "border-amber-500 text-amber-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              ゲストユーザー一覧
            </button>
            <button 
              onClick={() => setActiveTab("permissions")}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-sm font-bold transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${activeTab === "permissions" ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> メンバーの管理権限設定
            </button>
            <button 
              onClick={() => setActiveTab("apps")}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-sm font-bold transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${activeTab === "apps" ? "border-emerald-500 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 外部連携アプリマネジメント
            </button>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          
          {/* TAB 1: ゲストユーザー一覧 */}
          {activeTab === "list" && (
            canViewExt ? (
              <>
                <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 mb-2.5 sm:mb-4 flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" placeholder="名前や所属で検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 sm:pl-9 pr-2.5 sm:pr-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xs"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    <div className="flex-1 sm:flex-none flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2 sm:px-3 py-1.5 shadow-2xs min-w-[130px]">
                      <Filter className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      <CustomSelect 
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                        options={[
                          { value: "all", label: "すべての区分" },
                          { value: "student", label: "生徒" },
                          { value: "teacher", label: "教職員" },
                          { value: "other", label: "その他" }
                        ]}
                        buttonClassName="bg-transparent border-none p-0 text-[10px] sm:text-xs font-bold text-gray-700 focus:ring-0 cursor-pointer w-full outline-none flex items-center justify-between"
                      />
                    </div>
                    <div className="flex-1 sm:flex-none flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2 sm:px-3 py-1.5 shadow-2xs min-w-[140px]">
                      <ArrowUpDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      <CustomSelect 
                        value={sortOrder}
                        onChange={(val) => setSortOrder(val as any)}
                        options={[
                          { value: "created_desc", label: "登録日(新)" },
                          { value: "name_asc", label: "名前順(昇)" },
                          { value: "valid_asc", label: "有効期限(近)" }
                        ]}
                        buttonClassName="bg-transparent border-none p-0 text-[10px] sm:text-xs font-bold text-gray-700 focus:ring-0 cursor-pointer w-full outline-none flex items-center justify-between"
                      />
                    </div>
                  </div>
                </div>

                <ExternalUserList 
                  users={filteredUsers}
                  systemApps={systemApps}
                  onRowClick={(user) => {
                    if (canViewExt) {
                      setManageMode({ show: true, mode: "view", targetUser: user });
                    }
                  }}
                />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl sm:rounded-2xl border border-dashed border-gray-300 p-6 sm:p-8 shadow-sm">
                <Globe className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mb-3 sm:mb-4" />
                <h2 className="text-xs sm:text-sm font-black text-gray-700 mb-1.5 sm:mb-2">参照権限がありません</h2>
                <p className="text-[10px] sm:text-xs font-bold text-gray-500 mb-4 sm:mb-6 text-center leading-relaxed">
                  外部ユーザーのリストを表示・閲覧する権限が付与されていません。<br/>
                  {canCreateExt && "新しいゲストの登録操作のみ実行可能です。"}
                </p>
                {canCreateExt && (
                  <button 
                    onClick={() => setManageMode({ show: true, mode: "create" })}
                    className="px-5 sm:px-6 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 新規ゲスト登録
                  </button>
                )}
              </div>
            )
          )}

          {/* TAB 2: メンバーの管理権限設定 */}
          {activeTab === "permissions" && isSuperAdmin && (
            <div className="flex-1 flex flex-col min-w-0 bg-white border border-gray-200 rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
              <div className="p-2.5 sm:p-4 border-b border-gray-200 bg-gray-50/50">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
                  <div className="relative w-full lg:max-w-xs">
                    <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:w-4 sm:h-4 text-gray-400" />
                    <input 
                      type="text" placeholder="内部ユーザーを検索..." value={permSearchQuery} onChange={(e) => setPermSearchQuery(e.target.value)} 
                      className="block w-full pl-8 sm:pl-9 pr-2.5 sm:pr-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors shadow-2xs" 
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap">
                    <span className="text-[10px] sm:text-xs font-bold text-indigo-800 whitespace-nowrap flex items-center gap-1"><Settings2 className="w-3.5 h-3.5" /> 一括操作:</span>
                    <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto flex-wrap">
                      <div className="flex-1 sm:flex-none min-w-[140px]">
                        <CustomSelect 
                          value={bulkTarget} 
                          onChange={val => {
                            if (val.startsWith('disabled_')) return;
                            setBulkTarget(val);
                          }} 
                          options={[
                            { value: "", label: "対象グループを選択" },
                            { value: "all", label: `全ユーザー (${processedPermUsers.length}名)` },
                            { value: "manager", label: "マネージャー権限" },
                            { value: "disabled_role", label: "--- 権限ロール ---" },
                            { value: "role_teacher", label: "  教職員" },
                            { value: "role_officer", label: "  生徒会役員" },
                            ...(availablePositions.length > 0 ? [
                              { value: "disabled_pos", label: "--- 役職別 ---" },
                              ...availablePositions.map(pos => ({ value: `pos_${pos}`, label: `  ${pos}` }))
                            ] : [])
                          ]}
                          buttonClassName="w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold border border-gray-300 bg-white outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-between shadow-2xs"
                        />
                      </div>

                      <div className="flex-1 sm:flex-none min-w-[140px]">
                        <CustomSelect 
                          value={bulkTargetItem} 
                          onChange={setBulkTargetItem} 
                          options={[
                            { value: "all", label: "ゲスト管理すべての権限" },
                            ...EXTERNAL_PERMISSIONS.map(item => ({ value: item.id, label: item.name }))
                          ]}
                          buttonClassName="w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold border border-gray-300 bg-white outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-between shadow-2xs"
                        />
                      </div>
                    </div>

                    <div className="flex gap-1.5 sm:gap-2 w-full sm:w-auto ml-auto mt-1 sm:mt-0">
                      <button onClick={() => handleBulkUpdate(true)} disabled={isBulkUpdating || !bulkTarget} className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center shadow-2xs">
                        {isBulkUpdating ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : "一括許可"}
                      </button>
                      <button onClick={() => handleBulkUpdate(false)} disabled={isBulkUpdating || !bulkTarget} className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-300 text-gray-700 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center shadow-2xs">
                        {isBulkUpdating ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : "一括解除"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar relative">
                <table className="min-w-full divide-y divide-gray-200 text-left whitespace-nowrap">
                  <thead className="bg-gray-50 text-[9px] sm:text-[10px] font-black text-gray-500 sticky top-0 z-10 shadow-2xs">
                    <tr>
                      <th scope="col" className="px-3 sm:px-4 py-2 sm:py-3 w-16 sm:w-24 border-r border-gray-200 bg-gray-50">利用番号</th>
                      <th scope="col" className="px-3 sm:px-4 py-2 sm:py-3 border-r border-gray-200 min-w-[150px] sm:min-w-[200px] bg-gray-50">ユーザー名 / 役職</th>
                      <th scope="col" className="px-3 sm:px-4 py-2 sm:py-3 text-center border-r border-gray-200 w-20 sm:w-28 bg-gray-50">一括切替</th>
                      {EXTERNAL_PERMISSIONS.map(item => {
                        const Icon = item.icon;
                        return (
                          <th key={item.id} scope="col" className="px-2 sm:px-3 py-2 text-center min-w-[70px] sm:min-w-[100px] border-r border-gray-100 last:border-0 bg-gray-50">
                            <div className="flex flex-col items-center gap-1 sm:gap-1.5"><Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" /><span className="text-[8px] sm:text-[10px] font-black">{item.name}</span></div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-[11px] sm:text-xs font-bold">
                    {processedPermUsers.map((user) => {
                      const userPerms = getDefaultChatPermissions(user);
                      const isAdmin = user.role === "admin" || user.role === "system_admin" || (user as any).isITManager === true;
                      const isAllCategoryAllowed = EXTERNAL_PERMISSIONS.every(item => userPerms[item.id] === true);
                      const isProcessing = updatingUserId === user.id;

                      return (
                        <tr key={user.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-3 sm:px-4 py-2 sm:py-3 font-mono text-[10px] sm:text-xs text-gray-600 border-r border-gray-200">
                            {(user as any).systemId ? String((user as any).systemId).padStart(6, '0') : "未設定"}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 border-r border-gray-200">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200">
                                {user.photoURL ? <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" /> : <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-gray-900 font-bold text-[11px] sm:text-sm truncate">{user.name}</span>
                                <div className="flex items-center gap-1 mt-0.5 sm:mt-1">
                                  {isAdmin ? <span className="text-[8px] sm:text-[9px] text-rose-700 bg-rose-50 px-1 sm:px-1.5 py-0.5 rounded border border-rose-200 truncate">システム管理者</span> : (user as any).positionName ? <span className="text-[8px] sm:text-[9px] text-indigo-600 bg-indigo-50 px-1 sm:px-1.5 py-0.5 rounded border border-indigo-100 truncate">{(user as any).positionName}</span> : <span className="text-[8px] sm:text-[9px] text-gray-400">一般</span>}
                                  {(user as any).isManager && <span className="text-[7px] sm:text-[9px] text-emerald-600 bg-emerald-50 px-1 sm:px-1.5 py-0.5 rounded border border-emerald-100 shrink-0">マネ</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center border-r border-gray-200">
                            <button onClick={() => toggleCategoryAllForUser(user.id, !isAllCategoryAllowed, userPerms, isAdmin)} disabled={isProcessing || isAdmin} className={`px-2 sm:px-3 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-colors border w-full sm:w-auto ${isAdmin ? "bg-gray-100 text-gray-400 border-gray-200 opacity-50 cursor-not-allowed" : isAllCategoryAllowed ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}>
                              {isProcessing ? <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin mx-auto" /> : (isAdmin ? "固定許可" : isAllCategoryAllowed ? "全解除" : "全許可")}
                            </button>
                          </td>
                          {EXTERNAL_PERMISSIONS.map(item => {
                            const hasPermission = userPerms[item.id];
                            const isDependent = item.id === "canEditExternalUser" || item.id === "canDeleteExternalUser";
                            const isDisabled = isProcessing || isAdmin || (isDependent && !userPerms.canViewExternalUser);

                            return (
                              <td key={item.id} className="px-2 sm:px-3 py-2 sm:py-3 text-center hover:bg-gray-50 transition-colors border-r border-gray-100 last:border-0">
                                <button onClick={() => togglePermission(user.id, item.id, userPerms, isAdmin)} disabled={isDisabled} className={`p-1 sm:p-1.5 rounded-lg transition-colors inline-flex items-center justify-center focus:outline-none ${isDisabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-gray-200'}`}>
                                  {hasPermission ? <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" /> : <Square className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300" />}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {processedPermUsers.length === 0 && (
                      <tr>
                        <td colSpan={3 + EXTERNAL_PERMISSIONS.length} className="px-4 py-8 text-center text-[10px] sm:text-xs text-gray-400">
                          条件に一致するユーザーが見つかりません。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: 外部連携アプリマネジメント */}
          {activeTab === "apps" && isSuperAdmin && (
            <ExternalAppManagementTab 
              systemApps={systemApps}
              schoolData={schoolData}
              setSchoolData={setSchoolData}
              externalUsers={externalUsers}
              setManageMode={setManageMode}
            />
          )}

        </div>
      </main>

      {manageMode.show && (
        <div className="absolute inset-0 z-[100] flex justify-center items-end sm:items-center bg-black/40 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-4xl h-[95vh] sm:h-[85vh] animate-slide-up sm:animate-fade-in flex flex-col">
            <ExternalUserForm 
              userData={userData}
              mode={manageMode.mode}
              targetUser={manageMode.targetUser}
              onClose={() => setManageMode({ show: false, mode: "view", targetUser: null })}
              onSuccess={() => {}}
              systemApps={systemApps}
              schoolData={schoolData}
              setMode={(newMode: any) => setManageMode(prev => ({ ...prev, mode: newMode }))}
            />
          </div>
        </div>
      )}

    </div>
  );
}