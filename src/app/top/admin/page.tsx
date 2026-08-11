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
  customAppNames?: Record<string, string>; // カスタムアプリ名
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
  const [availableApps, setAvailableApps] = useState<any[]>([]); // DBからのアプリ一覧
  const [isLoading, setIsLoading] = useState(true);
  
  // ★ "messages" タブを削除
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
    // ★ "messages" タブを削除
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

              // システム上の全アプリ(system_apps)を取得
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-10 w-10 text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      <div className="md:w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900 leading-tight">テナント管理</h2>
            <p className="text-xs text-gray-500 mt-1 truncate w-48">{schoolData?.name}</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 md:p-4 flex flex-row md:flex-col gap-1 md:gap-2 overflow-x-auto md:overflow-visible no-scrollbar">
          <button onClick={() => handleTabChange("users")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "users" ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <Users className="h-5 w-5 mr-3 md:inline hidden" /> ユーザー管理
          </button>
          
          <button onClick={() => handleTabChange("permissions")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "permissions" ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <ShieldCheck className="h-5 w-5 mr-3 md:inline hidden" /> 機能権限管理
          </button>
          
          <button onClick={() => handleTabChange("positions")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "positions" ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <UserCog className="h-5 w-5 mr-3 md:inline hidden" /> 役職マスタ設定
          </button>
          
          <button onClick={() => handleTabChange("security")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "security" ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <Lock className="h-5 w-5 mr-3 md:inline hidden" /> セキュリティ設定
          </button>
          
          {/* ★ メッセージ配信のタブと関連の処理を削除しました */}
          
          <button onClick={() => handleTabChange("line")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "line" ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <MessageCircle className="h-5 w-5 mr-3 md:inline hidden" /> LINE運用設定
          </button>
          
          <button onClick={() => handleTabChange("settings")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "settings" ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <Settings className="h-5 w-5 mr-3 md:inline hidden" /> テナント設定
          </button>
        </nav>
        <div className="p-4 border-t border-gray-200 hidden md:block">
          <button onClick={() => router.push("/top")} className="flex items-center text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" /> トップへ戻る
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        {alert.show && (
          <div className={`mb-6 p-4 rounded-md text-sm font-bold flex items-center shadow-sm ${
            alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : 
            alert.type === "warning" ? "bg-amber-50 text-amber-800 border border-amber-200" :
            "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {alert.type === "success" ? <CheckCircle2 className="mr-2 h-5 w-5 flex-shrink-0" /> : <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />}
            {alert.message}
          </div>
        )}

        {activeTab === "users" && (
          <UserManagement users={users} setUsers={setUsers} schoolData={schoolData} fetchUsers={fetchUsers} showAlert={showAlert} onNavigateTab={handleTabChange} />
        )}
        
        {activeTab === "permissions" && (
          <PermissionManagement users={users} setUsers={setUsers} schoolData={schoolData} availableApps={availableApps} showAlert={showAlert} />
        )}
        
        {activeTab === "positions" && (
          <PositionManagement schoolData={schoolData} showAlert={showAlert} />
        )}
                
        {activeTab === "security" && (
          <SecuritySettings schoolData={schoolData} showAlert={showAlert} />
        )}
        
        {/* ★ メッセージ配信のコンポーネント呼び出しを削除しました */}
        
        {activeTab === "line" && (
          <LineAdminSettings userData={currentUser} schoolData={schoolData} showAlert={showAlert} />
        )}
        
        {activeTab === "settings" && (
          <TenantSettings schoolData={schoolData} showAlert={showAlert} />
        )}
      </div>
    </div>
  );
}

export default function TopAdminPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-10 h-10 animate-spin text-indigo-600"/></div>}>
      <TopAdminPageContent />
    </Suspense>
  );
}