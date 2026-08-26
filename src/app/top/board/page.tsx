"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, serverTimestamp, deleteDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import * as LucideIcons from "lucide-react";
import { Loader2, AlertTriangle, List, PlusCircle, Settings, Globe, FileStack } from "lucide-react";

import { UserData, Announcement, Category, AppConfig, AlertState, COLOR_MAPPINGS, Attachment, Position, TargetType, ExtTargetType, ActionType } from "./types";
import BoardForm from "./components/BoardForm";
import BoardList from "./components/BoardList";
import BoardManagement from "./components/BoardManagement"; 
import CategoryManager from "./components/CategoryManager"; 
import { useDialog } from "@/components/DialogContext"; 
import { ExternalUser } from "@/app/types/external"; 

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

export default function BoardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { showConfirm } = useDialog(); 
  
  const currentTab = searchParams.get("tab") || "list";
  const editId = searchParams.get("editId");

  const [userData, setUserData] = useState<UserData | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]);
  const [externalUsers, setExternalUsers] = useState<ExternalUser[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  const [appConfig, setAppConfig] = useState<AppConfig>({ name: "連絡事項", icon: "MessageSquareText", color: "indigo" });
  const [hasPermission, setHasPermission] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uiAlert, setUiAlert] = useState<AlertState>({ show: false, type: "success", message: "" });

  const editingAnnouncement = editId ? announcements.find(a => a.id === editId) || null : null;
  const canManageSettings = Boolean(userData?.role === "admin" || userData?.role === "system_admin" || userData?.isITManager);

  useEffect(() => {
    let unsubAnnouncements: () => void;
    let unsubCategories: () => void;
    let unsubUsers: () => void;
    let unsubExternalUsers: () => void; 
    let unsubPositions: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocSnap = await getDoc(doc(db, "users", user.uid));
          if (!userDocSnap.exists()) { router.push("/login"); return; }
          const data = { id: user.uid, photoURL: user.photoURL, ...userDocSnap.data() } as any; 
          setUserData(data);

          const schoolDocSnap = await getDoc(doc(db, "schools", data.schoolId));
          if (!schoolDocSnap.exists()) { router.push("/login"); return; }
          const schoolData = schoolDocSnap.data() as any;

          const qApps = query(collection(db, "system_apps"), where("appId", "==", "board"));
          const appsSnap = await getDocs(qApps);
          let boardApp: any = null;
          if (!appsSnap.empty) {
            boardApp = appsSnap.docs[0].data();
          } else {
            boardApp = { appId: "board", name: "連絡事項", icon: "MessageSquareText", color: "indigo", isActive: true, defaultRoles: { admin: true, it_manager: true, teacher: true, officer: true, guest: false } };
          }

          let allowed = true;
          if (!boardApp.isActive) allowed = false;
          if (schoolData.availableModules && !schoolData.availableModules.includes("board")) allowed = false;
          
          const roleKey = data.role || "guest";
          const perms = schoolData.appPermissions?.["board"] || boardApp.defaultRoles;
          if (perms && perms[roleKey] === false) allowed = false;
          if (data.allowedModules && !data.allowedModules.includes("board")) allowed = false;

          if (!allowed) {
            setHasPermission(false);
            setIsLoading(false);
            return;
          }

          setAppConfig({
            name: (schoolData.customAppNames?.["board"]?.trim()) || boardApp.name,
            icon: boardApp.icon || "MessageSquareText",
            color: boardApp.color || "indigo"
          });

          const qUsers = query(collection(db, "users"), where("schoolId", "==", data.schoolId));
          unsubUsers = onSnapshot(qUsers, (snapshot) => {
            const fetchedUsers: UserData[] = [];
            snapshot.forEach(d => fetchedUsers.push({ id: d.id, ...d.data() } as UserData));
            setTenantUsers(fetchedUsers);
          });

          const qExtUsers = query(collection(db, "external_users"), where("schoolId", "==", data.schoolId));
          unsubExternalUsers = onSnapshot(qExtUsers, (snapshot) => {
            const fetchedExtUsers: ExternalUser[] = [];
            snapshot.forEach(d => {
              const extData = { id: d.id, ...d.data() } as ExternalUser;
              const isExpired = extData.expiresAt && (new Date(extData.expiresAt as string).getTime() < Date.now());
              if (extData.status === "active" && !isExpired && extData.allowedModules?.includes("board")) {
                fetchedExtUsers.push(extData);
              }
            });
            setExternalUsers(fetchedExtUsers);
          });

          const qPos = query(collection(db, "positions"), where("schoolId", "==", data.schoolId));
          unsubPositions = onSnapshot(qPos, (snapshot) => {
            const fetched: Position[] = [];
            snapshot.forEach(d => fetched.push({ id: d.id, ...d.data() } as Position));
            setPositions(fetched);
          });

          const qAnnouncements = query(collection(db, "announcements"), where("schoolId", "==", data.schoolId), orderBy("createdAt", "desc"));
          unsubAnnouncements = onSnapshot(qAnnouncements, (snapshot) => {
            const fetched: Announcement[] = [];
            snapshot.forEach((d) => {
              const docData = d.data();
              fetched.push({
                id: d.id,
                title: docData.title,
                content: docData.content,
                authorName: docData.authorName,
                authorId: docData.authorId,
                authorPhotoURL: docData.authorPhotoURL || docData.authorAvatarUrl,
                createdAt: docData.createdAt ? docData.createdAt.toDate().toISOString() : new Date().toISOString(),
                categoryId: docData.categoryId,
                isUrgent: docData.isUrgent,
                attachments: docData.attachments || [],
                publishStartDate: docData.publishStartDate || null,
                publishEndDate: docData.publishEndDate || null,
                isExternal: docData.isExternal || false,
                isInternalAlso: docData.isInternalAlso !== false,
                targetType: docData.targetType || "all",
                targetPositionIds: docData.targetPositionIds || [],
                targetUserIds: docData.targetUserIds || [],
                extTargetType: docData.extTargetType || "all",
                extTargetUserIds: docData.extTargetUserIds || [],
                requireAction: docData.requireAction || false, 
                actionType: docData.actionType || "all",       
                readByExternal: docData.readByExternal || [], 
                readByInternal: docData.readByInternal || [], 
                actionByExternal: docData.actionByExternal || [], 
                actionByInternal: docData.actionByInternal || [], 
              });
            });
            setAnnouncements(fetched);
          });

          const qCategories = query(collection(db, "board_categories"), where("schoolId", "==", data.schoolId));
          unsubCategories = onSnapshot(qCategories, (snapshot) => {
            const cats: Category[] = [];
            snapshot.forEach((d) => cats.push({ id: d.id, ...d.data() } as Category));
            setCategories(cats);
          });

          setIsLoading(false);
        } catch (error) { setIsLoading(false); }
      } else { router.push("/login"); }
    });

    return () => {
      unsubscribeAuth();
      if (unsubAnnouncements) unsubAnnouncements();
      if (unsubCategories) unsubCategories();
      if (unsubUsers) unsubUsers();
      if (unsubExternalUsers) unsubExternalUsers(); 
      if (unsubPositions) unsubPositions();
    };
  }, [router]);

  const c = COLOR_MAPPINGS[appConfig.color] || COLOR_MAPPINGS.default;

  const showToast = (type: "success" | "error", message: string) => {
    setUiAlert({ show: true, type, message });
    setTimeout(() => setUiAlert(prev => ({ ...prev, show: false })), 3000);
  };

  const setTab = (tab: "list" | "ext-list" | "management" | "form" | "categories", editId?: string, viewId?: string) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (editId) params.set("editId", editId);
    if (viewId) params.set("id", viewId);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePostSubmit = async (data: { 
    title: string; content: string; categoryId: string; isUrgent: boolean; 
    attachments: Attachment[]; publishStartDate: string; publishEndDate: string | null; 
    isExternal: boolean; isInternalAlso: boolean;
    targetType: TargetType; targetPositionIds: string[]; targetUserIds: string[];
    extTargetType: ExtTargetType; extTargetUserIds: string[];
    requireAction: boolean; actionType: ActionType;
  }) => {
    if (!userData) return;
    setIsSubmitting(true);
    try {
      const payload = {
        title: data.title.trim(), 
        content: data.content.trim(),
        categoryId: data.categoryId || null, 
        isUrgent: data.isUrgent,
        attachments: data.attachments,
        publishStartDate: data.publishStartDate,
        publishEndDate: data.publishEndDate,
        isExternal: data.isExternal,
        isInternalAlso: data.isInternalAlso,
        targetType: data.targetType,
        targetPositionIds: data.targetPositionIds,
        targetUserIds: data.targetUserIds,
        extTargetType: data.extTargetType,
        extTargetUserIds: data.extTargetUserIds,
        requireAction: data.requireAction, 
        actionType: data.actionType,       
      };

      if (editingAnnouncement) {
        await updateDoc(doc(db, "announcements", editingAnnouncement.id), payload);
        showToast("success", "連絡事項を更新しました。");

        const publishDate = data.publishStartDate ? new Date(data.publishStartDate) : new Date();
        const batch = writeBatch(db);
        let batchCount = 0;

        if (data.isInternalAlso !== false) {
          tenantUsers.forEach(user => {
            if (batchCount >= 490) return;
            
            let isTarget = false;
            if (data.targetType === "all") isTarget = true;
            else if (data.targetType === "individual") {
              isTarget = data.targetUserIds.includes(user.id);
            } else if (data.targetType === "position") {
              const pIds = data.targetPositionIds;
              if (pIds.includes("sys_admin") && (user.role === "admin" || user.role === "system_admin" || user.isITManager)) isTarget = true;
              else if (pIds.includes("sys_student") && user.role === "student") isTarget = true;
              else if (pIds.includes("sys_teacher") && user.role === "teacher") isTarget = true;
              else if (user.positionIds?.some(pid => pIds.includes(pid))) isTarget = true;
            }

            if (!isTarget) return;

            const notifRef = doc(collection(db, "notifications"));
            batch.set(notifRef, {
              userId: user.id,
              schoolId: userData.schoolId,
              title: payload.isUrgent ? `【緊急・更新】${payload.title}` : `【更新】${payload.title}`,
              body: `${userData.name}さんが連絡事項の内容を更新しました。`,
              sourceApp: "board",
              linkUrl: `/top/board?tab=list&id=${editingAnnouncement.id}`, 
              isRead: false,
              isFlagged: false,
              createdAt: publishDate 
            });
            batchCount++;
          });
        }

        if (batchCount > 0) await batch.commit();
        setTab("management", undefined, editingAnnouncement.id);

      } else {
        const docRef = await addDoc(collection(db, "announcements"), {
          ...payload, 
          schoolId: userData.schoolId, 
          authorName: userData.name,
          authorId: userData.id, 
          authorPhotoURL: userData.photoURL || null, 
          createdAt: serverTimestamp(),
          readByExternal: [], 
          readByInternal: [], 
          actionByExternal: [], 
          actionByInternal: [], 
        });
        showToast("success", "新しい連絡事項を配信しました。");
        const newId = docRef.id;

        const publishDate = data.publishStartDate ? new Date(data.publishStartDate) : new Date();
        const batch = writeBatch(db);
        let batchCount = 0;

        if (data.isInternalAlso !== false) {
          tenantUsers.forEach(user => {
            if (batchCount >= 490) return; 

            let isTarget = false;
            if (data.targetType === "all") isTarget = true;
            else if (data.targetType === "individual") {
              isTarget = data.targetUserIds.includes(user.id);
            } else if (data.targetType === "position") {
              const pIds = data.targetPositionIds;
              if (pIds.includes("sys_admin") && (user.role === "admin" || user.role === "system_admin" || user.isITManager)) isTarget = true;
              else if (pIds.includes("sys_student") && user.role === "student") isTarget = true;
              else if (pIds.includes("sys_teacher") && user.role === "teacher") isTarget = true;
              else if (user.positionIds?.some(pid => pIds.includes(pid))) isTarget = true;
            }

            if (!isTarget) return;

            const notifRef = doc(collection(db, "notifications"));
            batch.set(notifRef, {
              userId: user.id,
              schoolId: userData.schoolId,
              title: payload.isUrgent ? `【緊急】${payload.title}` : payload.title,
              body: `${userData.name}さんが新しい連絡事項を配信しました。`,
              sourceApp: "board",
              linkUrl: `/top/board?tab=list&id=${newId}`, 
              isRead: false,
              isFlagged: false,
              createdAt: publishDate 
            });
            batchCount++;
          });
        }

        if (batchCount > 0) await batch.commit();
        setTab("management", undefined, newId); 
      }
    } catch (error) { 
      showToast("error", "保存に失敗しました。"); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "announcements", id));
      showToast("success", "投稿を削除しました。");
      if (editingAnnouncement?.id === id) setTab("management");
    } catch (error) {
      showToast("error", "削除に失敗しました。");
    }
  };

  const handleAddCategory = async (name: string, color: string) => {
    if (!userData) return;
    try {
      await addDoc(collection(db, "board_categories"), { schoolId: userData.schoolId, name: name.trim(), color });
    } catch (error) { showToast("error", "カテゴリ追加に失敗しました。"); }
  };

  const handleEditCategory = async (id: string, name: string, color: string) => {
    try {
      await updateDoc(doc(db, "board_categories", id), { name: name.trim(), color });
      showToast("success", "カテゴリを更新しました。");
    } catch (error) { showToast("error", "カテゴリ更新に失敗しました。"); }
  };

  const executeDeleteCategory = async (id: string) => {
    try { 
      await deleteDoc(doc(db, "board_categories", id)); 
      showToast("success", "カテゴリを削除しました。");
    } catch (error) { 
      showToast("error", "カテゴリ削除に失敗しました。"); 
    }
  };

  const handleDeleteCategory = (id: string) => {
    showConfirm(
      "このカテゴリを削除しますか？",
      () => executeDeleteCategory(id),
      "danger",
      "カテゴリ削除の確認"
    );
  };

  if (isLoading) return <div className="h-full flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  if (!hasPermission) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-900 p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-black mb-2">アクセス権限がありません</h1>
        <p className="text-xs font-bold text-gray-500 mb-6">このアプリは現在システムで停止されているか、あなたの役職では利用が許可されていません。</p>
        <button onClick={() => router.push("/top")} className="px-5 py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-colors shadow-sm">
          ダッシュボードに戻る
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex-1 w-full flex flex-col min-h-0 font-sans text-gray-900 bg-[#F9FAFB] relative">
      <main className="flex-1 w-full max-w-7xl mx-auto p-2 sm:p-4 lg:p-6 flex flex-col min-h-0">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`p-2 sm:p-2.5 ${c.lightBg} ${c.text} rounded-xl shadow-sm`}>
              <DynamicIcon name={appConfig.icon} className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 tracking-tight">{appConfig.name}</h1>
              <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 mt-0.5">校内全体や委員会メンバーに連絡事項を配信します。</p>
            </div>
          </div>

          <div className="flex items-center shrink-0">
            <button 
              onClick={() => setTab("form")} 
              className={`px-4 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 whitespace-nowrap`}
            >
              <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 新しく配信
            </button>
          </div>
        </div>

        {/* タブメニュー（スマホで2カラムのグリッド化） */}
        {currentTab !== "form" && (
          <div className="grid grid-cols-2 md:flex bg-gray-200/60 p-1 rounded-xl w-full md:w-fit shadow-inner mb-3 sm:mb-4 shrink-0 gap-1">
            <button 
              onClick={() => setTab("list")} 
              className={`flex items-center justify-center px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${currentTab === "list" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
            >
              <List className="w-3.5 h-3.5 mr-1.5" /> <span className="truncate">あなたへの連絡</span>
            </button>
            {canManageSettings && (
              <button 
                onClick={() => setTab("ext-list")} 
                className={`flex items-center justify-center px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${currentTab === "ext-list" ? "bg-white shadow-sm text-blue-700" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
              >
                <Globe className="w-3.5 h-3.5 mr-1.5 text-blue-500" /> <span className="truncate">外部ユーザー配信</span>
              </button>
            )}
            <button 
              onClick={() => setTab("management")} 
              className={`flex items-center justify-center px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${currentTab === "management" ? "bg-white shadow-sm text-amber-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
            >
              <FileStack className="w-3.5 h-3.5 mr-1.5 text-amber-500" /> <span className="truncate">配信管理</span>
            </button>
            {canManageSettings && (
              <button 
                onClick={() => setTab("categories")} 
                className={`flex items-center justify-center px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${currentTab === "categories" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
              >
                <Settings className="w-3.5 h-3.5 mr-1.5" /> <span className="truncate">カテゴリ管理</span>
              </button>
            )}
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 relative bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          
          {currentTab === "list" && !editId && (
            <BoardList 
              announcements={announcements.filter(a => !a.isExternal || a.isInternalAlso !== false)} 
              categories={categories} 
              userData={userData}
              tenantUsers={tenantUsers} 
              appConfig={appConfig} 
              isExternalTab={false}
              externalUsers={externalUsers}
            />
          )}

          {currentTab === "ext-list" && !editId && canManageSettings && (
            <BoardList 
              announcements={announcements.filter(a => a.isExternal)} 
              categories={categories} 
              userData={userData}
              tenantUsers={tenantUsers} 
              appConfig={appConfig} 
              isExternalTab={true}
              externalUsers={externalUsers}
            />
          )}

          {currentTab === "management" && !editId && (
            <BoardManagement 
              announcements={announcements} 
              categories={categories} 
              userData={userData}
              tenantUsers={tenantUsers} 
              externalUsers={externalUsers}
              appConfig={appConfig} 
              onEdit={(a) => setTab("form", a.id)} 
              onDelete={handleDelete}
              canManageAll={canManageSettings}
            />
          )}
          
          {currentTab === "form" && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-4 pb-20 bg-gray-50/50">
              <div className="max-w-4xl w-full mx-auto h-full">
                <BoardForm 
                  appConfig={appConfig} categories={categories} editingAnnouncement={editingAnnouncement}
                  uiAlert={uiAlert} isSubmitting={isSubmitting} schoolId={userData?.schoolId || ""}
                  tenantUsers={tenantUsers} externalUsers={externalUsers} positions={positions}
                  onSubmit={handlePostSubmit} onCancelEdit={() => setTab("management")}
                />
              </div>
            </div>
          )}

          {currentTab === "categories" && canManageSettings && (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <CategoryManager 
                categories={categories} appConfig={appConfig}
                onAdd={handleAddCategory} 
                onEdit={handleEditCategory} 
                onDelete={handleDeleteCategory}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}