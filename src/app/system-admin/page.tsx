"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, orderBy } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { 
  Building2, Users, BellRing, LayoutDashboard, 
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, UserCog, ShieldAlert, Scale, LayoutGrid
} from "lucide-react";

import Dashboard from "./components/Dashboard";
import TenantManagement from "./components/TenantManagement";
import GlobalUserManagement from "./components/GlobalUserManagement";
import MessageDelivery from "./components/MessageDelivery";
import Line from "./components/line";
import SystemAccount from "./components/SystemAccount";
import LegalManagement from "./components/LegalManagement";
import AppManagement, { SystemApp } from "./components/AppManagement";

import { useDialog } from "@/components/DialogContext";

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
  lineFeatureEnabled?: boolean;
  mfaPolicies?: any;
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
  lineConnectionAllowed?: boolean;
  lineUserId?: string | null;
  lineNotificationEnabled?: boolean;
  requireMfa?: boolean;
  totpSecret?: string | null;
  passkeys?: any[];
  mfaPolicies?: any;
  useCustomMfaPolicy?: boolean;
};

export default function SystemAdminPage() {
  const router = useRouter();
  
  const { showAlert } = useDialog();

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "tenants" | "users" | "apps" | "messages" | "line" | "legal" | "account">("dashboard");
  
  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [users, setUsers] = useState<GlobalUserData[]>([]);
  const [systemApps, setSystemApps] = useState<SystemApp[]>([]);

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

      const appsQuery = query(collection(db, "system_apps"), orderBy("order", "asc"));
      const appsSnap = await getDocs(appsQuery);
      const appData: SystemApp[] = [];
      appsSnap.forEach(doc => appData.push({ id: doc.id, ...doc.data() } as SystemApp));
      setSystemApps(appData);

    } catch (error) {
      console.error("Data fetch error:", error);
      showAlert("システムデータの取得に失敗しました。", "error");
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
            showAlert("権限の確認に失敗しました。", "error");
          } finally {
            setIsLoading(false);
          }
        } else {
          router.push("/login");
        }
      });
    };
    init();
  }, [router, showAlert]);

  if (isLoading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    // ★ 全体を h-[100dvh] で固定し、外側のスクロールを防ぐ
    <div className="h-[100dvh] bg-gray-100 flex flex-col md:flex-row text-gray-900 overflow-hidden font-sans">
      
      {/* サイドバー (スマホ時は上部固定ヘッダー 兼 横スクロールメニュー) */}
      <div className="md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex-shrink-0 flex flex-col z-10 min-h-0">
        <div className="p-3 md:p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center">
            <div className="bg-blue-600 rounded p-1.5 mr-2">
              <ShieldAlert className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm md:text-lg font-extrabold text-gray-900 leading-tight tracking-tight">YORIKURU</h2>
              <p className="text-[9px] md:text-xs text-blue-600 font-bold">特権システム管理</p>
            </div>
          </div>
          {/* スマホ用ログアウトボタン */}
          <button onClick={() => router.push("/login")} className="md:hidden p-1.5 text-gray-400 hover:text-gray-700 bg-gray-50 rounded-lg border border-gray-200">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>

        {/* メニュー (スマホ時は横スクロール、PC時は縦スクロール) */}
        <nav className="flex md:flex-col overflow-x-auto md:overflow-y-auto custom-scrollbar p-1.5 md:p-3 gap-1 flex-shrink-0 md:flex-1 bg-white">
          <button onClick={() => setActiveTab("dashboard")} className={`flex items-center justify-center md:justify-start px-3 py-2.5 md:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === "dashboard" ? "bg-blue-50 text-blue-700 shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
            <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" /> ダッシュボード
          </button>
          <button onClick={() => setActiveTab("tenants")} className={`flex items-center justify-center md:justify-start px-3 py-2.5 md:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === "tenants" ? "bg-purple-50 text-purple-700 shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
            <Building2 className="h-3.5 w-3.5 mr-1.5" /> テナント管理
          </button>
          <button onClick={() => setActiveTab("users")} className={`flex items-center justify-center md:justify-start px-3 py-2.5 md:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === "users" ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
            <Users className="h-3.5 w-3.5 mr-1.5" /> 全ユーザー管理
          </button>
          <button onClick={() => setActiveTab("apps")} className={`flex items-center justify-center md:justify-start px-3 py-2.5 md:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === "apps" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
            <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> プラグイン・アプリ
          </button>
          <button onClick={() => setActiveTab("messages")} className={`flex items-center justify-center md:justify-start px-3 py-2.5 md:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === "messages" ? "bg-amber-50 text-amber-700 shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
            <BellRing className="h-3.5 w-3.5 mr-1.5" /> システム配信
          </button>
          <button onClick={() => setActiveTab("line")} className={`flex items-center justify-center md:justify-start px-3 py-2.5 md:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === "line" ? "bg-green-50 text-green-700 shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
            <BellRing className="h-3.5 w-3.5 mr-1.5" /> LINE通知連携
          </button>
          <button onClick={() => setActiveTab("legal")} className={`flex items-center justify-center md:justify-start px-3 py-2.5 md:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === "legal" ? "bg-rose-50 text-rose-700 shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
            <Scale className="h-3.5 w-3.5 mr-1.5" /> 法務・規約管理
          </button>
          <button onClick={() => setActiveTab("account")} className={`flex items-center justify-center md:justify-start px-3 py-2.5 md:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === "account" ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
            <UserCog className="h-3.5 w-3.5 mr-1.5" /> 管理者アカウント
          </button>
        </nav>

        {/* PC用ログアウトボタン */}
        <div className="p-4 border-t border-gray-100 hidden md:block shrink-0">
          <button onClick={() => router.push("/login")} className="flex items-center text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors bg-gray-50 w-full px-3 py-2 rounded-xl border border-gray-200">
            <ArrowLeft className="h-4 w-4 mr-2" /> ログアウト
          </button>
        </div>
      </div>

      {/* メインコンテンツ (ここだけ縦スクロール) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 md:p-8 bg-gray-50 relative min-h-0 pb-16 md:pb-8">
        {activeTab === "dashboard" && <Dashboard tenants={tenants} users={users} />}
        {activeTab === "tenants" && <TenantManagement tenants={tenants} setTenants={setTenants} systemApps={systemApps} />}
        {activeTab === "users" && <GlobalUserManagement users={users} setUsers={setUsers} tenants={tenants} />}
        {activeTab === "apps" && <AppManagement />}
        {activeTab === "messages" && <MessageDelivery tenants={tenants} users={users} />}
        {activeTab === "line" && <Line tenants={tenants} users={users} />}
        {activeTab === "legal" && <LegalManagement />}
        {activeTab === "account" && <SystemAccount />}
      </div>
    </div>
  );
}