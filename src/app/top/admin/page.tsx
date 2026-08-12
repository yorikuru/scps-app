"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Users, ShieldCheck, Settings, ArrowLeft, Loader2, CheckCircle2, AlertCircle, MessageCircle, Lock, UserCog } from "lucide-react";

import UserManagement from "./components/UserManagement";
import PermissionManagement from "./components/PermissionManagement";
import TenantSettings from "./components/TenantSettings";
import SecuritySettings from "./components/SecuritySettings";
import PositionManagement from "./components/PositionManagement";
import LineAdminSettings from "./components/LineAdminSettings";

export type UserData = {
  id: string;
  name: string;
  email: string;
  schoolId: string;
  role: string;
  positionIds?: string[];
  primaryPositionId?: string;
  positionName?: string;
  isITManager?: boolean;
  accountStatus: "active" | "unaccessed" | "pending" | "rejected";
  allowedModules?: string[];
  expiresAt?: string;
  systemId?: string;
  lineUserId?: string;
  lineConnectionAllowed?: boolean; 
  lineNotificationEnabled?: boolean;
  requireMfa?: boolean;
};

export type MfaPolicy = {
  allowSetup: boolean;
  forceSetup: boolean;
  allowUsage: boolean;
};

export type SchoolData = {
  id: string;
  name: string;
  schoolCode: string;
  allowedAuthProviders: string[];
  availableModules: string[];
  customAppNames?: Record<string, string>; 
  lineFeatureAllowed?: boolean;
  lineFeatureEnabled?: boolean;
  lineConnectionEnforced?: boolean;
  requireMfa?: boolean;
  safeIps?: string[];
  allowedMfaMethods?: string[];
  mfaPolicies?: {
    email: MfaPolicy;
    totp: MfaPolicy;
    passkey: MfaPolicy;
  };
  safeNetworks?: {
    ip: string;
    name: string;
    details?: string;
  }[];
};

function TopAdminPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [availableApps, setAvailableApps] = useState<any[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"users" | "permissions" | "positions" | "guests" | "security" | "line" | "settings">("users");
  
  const [alert, setAlert] = useState<{ show: boolean; type: "success" | "error" | "warning"; message: string }>({ 
    show: false, type: "success", message: "" 
  });

  const showAlert = (type: "success" | "error" | "warning", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert((prev) => ({ ...prev, show: false })), 4000);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as any);
    router.push(`?tab=${tab}`);
  };

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["users", "permissions", "positions", "guests", "security", "line", "settings"].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  const fetchUsers = async (schoolId: string) => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("schoolId", "==", schoolId));
    const querySnapshot = await getDocs(q);
    const fetchedUsers: UserData[] = [];
    querySnapshot.forEach((docSnap) => {
      fetchedUsers.push({ id: docSnap.id, ...docSnap.data() } as UserData);
    });
    const mappedUsers = fetchedUsers.map(u => ({
      ...u,
      allowedModules: u.allowedModules || []
    }));
    setUsers(mappedUsers);
  };

  useEffect(() => {
    const fetchData = async () => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
              const myData = { id: userDoc.id, ...userDoc.data() } as UserData;
              const isTenantAdmin = myData.role === "admin" || myData.isITManager || (myData.positionName && (myData.positionName.includes("会長") || myData.positionName.includes("顧問")));
              
              if (!isTenantAdmin) {
                router.push("/top");
                return;
              }
              
              setCurrentUser(myData);

              const schoolDoc = await getDoc(doc(db, "schools", myData.schoolId));
              if (schoolDoc.exists()) {
                setSchoolData({ id: schoolDoc.id, ...schoolDoc.data() } as SchoolData);
              }

              const appsRef = collection(db, "system_apps");
              const appsSnap = await getDocs(appsRef);
              const appsData = appsSnap.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
              setAvailableApps(appsData);

              await fetchUsers(myData.schoolId);
            } else {
              router.push("/login");
            }
          } catch (error) {
            console.error("Fetch error:", error);
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

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  return (
    // ★ h-full flex-1 w-full で親（TopLayout）にぴったり収まるようにし、スクロール崩れを防ぐ
    <div className="h-full flex-1 w-full flex flex-col md:flex-row bg-[#F9FAFB] font-sans relative min-h-0">
      
      {/* 左（スマホ時は上）メニュー：高さ固定 or 横スクロール */}
      <div className="md:w-56 lg:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex-shrink-0 flex flex-col min-h-0 z-10">
        <div className="p-3 md:p-4 border-b border-gray-100 hidden md:block">
          <h2 className="text-base font-extrabold text-gray-900 leading-tight">テナント管理</h2>
          <p className="text-[10px] text-gray-500 mt-1 truncate">{schoolData?.name}</p>
        </div>
        
        {/* スマホ時は横スクロール、PC時は縦リスト */}
        <nav className="flex md:flex-col overflow-x-auto md:overflow-y-auto custom-scrollbar p-1.5 md:p-3 gap-1 flex-shrink-0 md:flex-1 bg-white">
          <button onClick={() => handleTabChange("users")} className={`flex items-center justify-center md:justify-start px-3 py-2.5 md:py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === "users" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
            <Users className="h-3.5 w-3.5 mr-1.5" /> ユーザー管理
          </button>
          
          <button onClick={() => handleTabChange("permissions")} className={`flex items-center justify-center md:justify-start px-3 py-2.5 md:py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === "permissions" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> 機能権限
          </button>
          
          <button onClick={() => handleTabChange("positions")} className={`flex items-center justify-center md:justify-start px-3 py-2.5 md:py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === "positions" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
            <UserCog className="h-3.5 w-3.5 mr-1.5" /> 役職マスタ
          </button>
          
          <button onClick={() => handleTabChange("security")} className={`flex items-center justify-center md:justify-start px-3 py-2.5 md:py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === "security" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
            <Lock className="h-3.5 w-3.5 mr-1.5" /> セキュリティ
          </button>
          
          <button onClick={() => handleTabChange("line")} className={`flex items-center justify-center md:justify-start px-3 py-2.5 md:py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === "line" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
            <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> LINE設定
          </button>
          
          <button onClick={() => handleTabChange("settings")} className={`flex items-center justify-center md:justify-start px-3 py-2.5 md:py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === "settings" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
            <Settings className="h-3.5 w-3.5 mr-1.5" /> テナント設定
          </button>
        </nav>
      </div>

      {/* 右（スマホ時は下）コンテンツ：ここでだけ縦スクロールする */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-4 lg:p-6 pb-20 md:pb-6 relative min-h-0 bg-[#F9FAFB]">
        {alert.show && (
          <div className={`mb-4 sm:mb-6 p-3 rounded-xl text-xs font-bold flex items-center shadow-sm animate-fade-in ${
            alert.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : 
            alert.type === "warning" ? "bg-amber-50 text-amber-800 border border-amber-200" :
            "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {alert.type === "success" ? <CheckCircle2 className="mr-2 h-4 w-4 flex-shrink-0" /> : <AlertCircle className="mr-2 h-4 w-4 flex-shrink-0" />}
            {alert.message}
          </div>
        )}

        <div className="max-w-5xl mx-auto w-full">
          {activeTab === "users" && <UserManagement users={users} setUsers={setUsers} schoolData={schoolData} fetchUsers={fetchUsers} showAlert={showAlert} onNavigateTab={handleTabChange} />}
          {activeTab === "permissions" && <PermissionManagement users={users} setUsers={setUsers} schoolData={schoolData} availableApps={availableApps} showAlert={showAlert} />}
          {activeTab === "positions" && <PositionManagement schoolData={schoolData} showAlert={showAlert} />}
          {activeTab === "security" && <SecuritySettings schoolData={schoolData} showAlert={showAlert} />}
          {activeTab === "line" && <LineAdminSettings userData={currentUser} schoolData={schoolData} showAlert={showAlert} />}
          {activeTab === "settings" && <TenantSettings schoolData={schoolData} showAlert={showAlert} />}
        </div>
      </div>
    </div>
  );
}

export default function TopAdminPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-600"/></div>}>
      <TopAdminPageContent />
    </Suspense>
  );
}