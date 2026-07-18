"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { 
  Building2, Users, BellRing, LayoutDashboard, 
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, UserCog ,ShieldAlert
} from "lucide-react";

import Dashboard from "./components/Dashboard";
import TenantManagement from "./components/TenantManagement";
import GlobalUserManagement from "./components/GlobalUserManagement";
import MessageDelivery from "./components/MessageDelivery";
import Line from "./components/line";
import SystemAccount from "./components/SystemAccount";

export type TenantData = {
  id: string;
  name: string;
  schoolCode: string;
  adminName: string;
  adminEmail: string;
  schoolType?: string;
  allowedAuthProviders: string[];
  availableModules: string[];
  status: "active" | "suspended";
  createdAt?: string;
};

export type GlobalUserData = {
  id: string;
  name: string;
  email: string;
  schoolId: string;
  role: string;
  accountStatus: "active" | "pending" | "rejected";
  nameKana?: string;
  gender?: string;
  birthDate?: string;
  systemId?: string;
  studentId?: string;
  previousSchool?: string;
  grade?: string;
  classNumber?: string;
  attendanceNumber?: string;
  department?: string;
  club?: string;
  positionName?: string;
  isITManager?: boolean;
  phoneNumber?: string;
  organizationAddress?: string;
  createdAt?: string;
};

export const SYSTEM_MODULES = [
  { id: "board", name: "お知らせボード" },
  { id: "tasks", name: "タスク・プロジェクト" },
  { id: "approvals", name: "電子承認・稟議" },
  { id: "surveys", name: "アンケート・目安箱" }
];

export default function SystemAdminPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "tenants" | "users" | "messages" | "line" | "account">("dashboard");
  
  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [users, setUsers] = useState<GlobalUserData[]>([]);

  const [alert, setAlert] = useState<{ show: boolean; type: "success" | "error"; message: string }>({ 
    show: false, type: "success", message: "" 
  });

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert((prev) => ({ ...prev, show: false })), 4000);
  };

  const fetchAllData = async () => {
    try {
      const tenantsSnap = await getDocs(collection(db, "schools"));
      const tData: TenantData[] = [];
      tenantsSnap.forEach(doc => tData.push({ id: doc.id, ...doc.data() } as TenantData));
      setTenants(tData);

      const usersSnap = await getDocs(collection(db, "users"));
      const uData: GlobalUserData[] = [];
      usersSnap.forEach(doc => uData.push({ id: doc.id, ...doc.data() } as GlobalUserData));
      setUsers(uData);
    } catch (error) {
      console.error("Data fetch error:", error);
      showAlert("error", "システムデータの取得に失敗しました。");
    }
  };

  useEffect(() => {
    const init = async () => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
              const myData = userDoc.data();
              if (myData.role !== "system_admin") {
                router.push("/top");
                return;
              }
              await fetchAllData();
            } else {
              router.push("/login");
            }
          } catch (error) {
            showAlert("error", "権限の確認に失敗しました。");
          } finally {
            setIsLoading(false);
          }
        } else {
          router.push("/login");
        }
      });
    };
    init();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row text-gray-900">
      {/* サイドバー */}
      <div className="md:w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center">
          <div className="bg-blue-600 rounded p-1.5 mr-2">
            <ShieldAlert className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-gray-900 leading-tight">YORIKURU</h2>
            <p className="text-xs text-blue-600 font-bold">特権システム管理</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 md:p-4 flex flex-row md:flex-col gap-1 md:gap-2 overflow-x-auto md:overflow-visible no-scrollbar">
          <button onClick={() => setActiveTab("dashboard")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "dashboard" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <LayoutDashboard className="h-5 w-5 mr-3 md:inline hidden" /> ダッシュボード
          </button>
          <button onClick={() => setActiveTab("tenants")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "tenants" ? "bg-purple-50 text-purple-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <Building2 className="h-5 w-5 mr-3 md:inline hidden" /> テナント管理
          </button>
          <button onClick={() => setActiveTab("users")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "users" ? "bg-emerald-50 text-emerald-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <Users className="h-5 w-5 mr-3 md:inline hidden" /> 全ユーザー管理
          </button>
          <button onClick={() => setActiveTab("messages")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "messages" ? "bg-orange-50 text-orange-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <BellRing className="h-5 w-5 mr-3 md:inline hidden" /> システム配信
          </button>
          <button onClick={() => setActiveTab("line")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "line" ? "bg-orange-50 text-orange-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <BellRing className="h-5 w-5 mr-3 md:inline hidden" /> LINE通知連携機能
          </button>
          <button onClick={() => setActiveTab("account")} className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "account" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"}`}>
            <UserCog className="h-5 w-5 mr-3 md:inline hidden" /> 管理者アカウント
          </button>
        </nav>
        <div className="p-4 border-t border-gray-200 hidden md:block">
          <button onClick={() => router.push("/login")} className="flex items-center text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" /> ログアウト
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50">
        {alert.show && (
          <div className={`mb-6 p-4 rounded-md text-sm font-bold flex items-center shadow-sm ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {alert.type === "success" ? <CheckCircle2 className="mr-2 h-5 w-5 flex-shrink-0" /> : <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />}
            {alert.message}
          </div>
        )}

        {activeTab === "dashboard" && <Dashboard tenants={tenants} users={users} />}
        {activeTab === "tenants" && <TenantManagement tenants={tenants} setTenants={setTenants} showAlert={showAlert} />}
        {activeTab === "users" && <GlobalUserManagement users={users} setUsers={setUsers} tenants={tenants} showAlert={showAlert} />}
        {activeTab === "messages" && <MessageDelivery tenants={tenants} users={users} showAlert={showAlert} />}
        {activeTab === "line" && <Line tenants={tenants} users={users} showAlert={showAlert} />}
        {activeTab === "account" && <SystemAccount showAlert={showAlert} />}
      </div>
    </div>
  );
}