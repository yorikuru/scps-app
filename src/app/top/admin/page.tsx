"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Users, ShieldCheck, Settings, UserPlus, ArrowLeft, Loader2, CheckCircle2, AlertCircle, MessageCircle } from "lucide-react";

import UserManagement from "./components/UserManagement";
import PermissionManagement from "./components/PermissionManagement";
import GuestManagement from "./components/GuestManagement";
import TenantSettings from "./components/TenantSettings";
import LineSettings from "./components/LineSettings"; // ★追加

export type UserData = {
  id: string;
  name: string;
  email: string;
  schoolId: string;
  role: string;
  positionName?: string;
  isITManager?: boolean;
  accountStatus: "active" | "unaccessed" | "pending" | "rejected";
  allowedModules?: string[];
  expiresAt?: string;
  systemId?: string;
  // ★LINE連携用のプロパティを追加
  lineUserId?: string;
  lineConnectionAllowed?: boolean; 
};

export type SchoolData = {
  id: string;
  name: string;
  schoolCode: string;
  allowedAuthProviders: string[];
  availableModules: string[];
  // ★LINE連携用のプロパティを追加
  lineFeatureAllowed?: boolean;
  lineFeatureEnabled?: boolean;
  lineConnectionEnforced?: boolean;
};

export const SYSTEM_MODULES = [
  { id: "board", name: "お知らせボード" },
  { id: "tasks", name: "タスク・プロジェクト" },
  { id: "approvals", name: "電子承認・稟議" },
  { id: "surveys", name: "アンケート・目安箱" }
];

export default function TopAdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // ★ activeTab に "line" を追加
  const [activeTab, setActiveTab] = useState<"users" | "permissions" | "guests" | "settings" | "line">("users");
  
  const [alert, setAlert] = useState<{ show: boolean; type: "success" | "error"; message: string }>({ 
    show: false, type: "success", message: "" 
  });

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert((prev) => ({ ...prev, show: false })), 4000);
  };

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
      allowedModules: u.allowedModules || SYSTEM_MODULES.map(m => m.id)
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
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* サイドバー */}
      <div className="md:w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900 leading-tight">テナント管理</h2>
            <p className="text-xs text-gray-500 mt-1 truncate w-48">{schoolData?.name}</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 md:p-4 flex flex-row md:flex-col gap-1 md:gap-2 overflow-x-auto md:overflow-visible no-scrollbar">
          <button onClick={() => setActiveTab("users")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "users" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <Users className="h-5 w-5 mr-3 md:inline hidden" /> ユーザー管理
          </button>
          <button onClick={() => setActiveTab("permissions")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "permissions" ? "bg-purple-50 text-purple-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <ShieldCheck className="h-5 w-5 mr-3 md:inline hidden" /> 機能権限管理
          </button>
          <button onClick={() => setActiveTab("guests")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "guests" ? "bg-emerald-50 text-emerald-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <UserPlus className="h-5 w-5 mr-3 md:inline hidden" /> ゲスト発行
          </button>
          {/* ★LINE設定タブを追加 */}
          <button onClick={() => setActiveTab("line")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "line" ? "bg-[#e6faed] text-[#00993c]" : "text-gray-600 hover:bg-gray-50"}`}>
            <MessageCircle className="h-5 w-5 mr-3 md:inline hidden" /> LINE運用設定
          </button>
          <button onClick={() => setActiveTab("settings")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "settings" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"}`}>
            <Settings className="h-5 w-5 mr-3 md:inline hidden" /> テナント設定
          </button>
        </nav>
        <div className="p-4 border-t border-gray-200 hidden md:block">
          <button onClick={() => router.push("/top")} className="flex items-center text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" /> トップへ戻る
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        
        {alert.show && (
          <div className={`mb-6 p-4 rounded-md text-sm font-bold flex items-center shadow-sm ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {alert.type === "success" ? <CheckCircle2 className="mr-2 h-5 w-5 flex-shrink-0" /> : <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />}
            {alert.message}
          </div>
        )}

        {/* コンポーネント切り替え */}
        {activeTab === "users" && (
          <UserManagement users={users} setUsers={setUsers} schoolData={schoolData} fetchUsers={fetchUsers} showAlert={showAlert} />
        )}
        {activeTab === "permissions" && (
          <PermissionManagement users={users} setUsers={setUsers} schoolData={schoolData} showAlert={showAlert} />
        )}
        {activeTab === "guests" && (
          <GuestManagement schoolData={schoolData} fetchUsers={fetchUsers} showAlert={showAlert} />
        )}
        {activeTab === "line" && (
          <LineSettings schoolData={schoolData} users={users} setUsers={setUsers} showAlert={showAlert} />
        )}
        {activeTab === "settings" && (
          <TenantSettings schoolData={schoolData} showAlert={showAlert} />
        )}

      </div>
    </div>
  );
}