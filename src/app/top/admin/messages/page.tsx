"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
// ★ 不足していた CheckCircle2 と AlertCircle を追加
import { Loader2, ArrowLeft, ShieldAlert, CheckCircle2, AlertCircle } from "lucide-react";
import MessageDelivery from "../components/MessageDelivery";
// ★ 型のインポート先を Top ではなく Admin 側の page.tsx (../page) に修正
import { SchoolData, UserData } from "../page";

export default function TenantMessageDeliveryPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  const [alert, setAlert] = useState<{ show: boolean; type: "success" | "error" | "warning"; message: string }>({
    show: false,
    type: "success",
    message: "",
  });

  const showAlert = (type: "success" | "error" | "warning", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert(prev => ({ ...prev, show: false })), 4000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUser(user);

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
          router.push("/login");
          return;
        }
        const uData = { id: userDoc.id, ...userDoc.data() } as UserData;
        setUserData(uData);

        const canAccess = uData.role === "admin" || (uData as any)?.isITManager === true;
        if (!canAccess) {
          setLoading(false);
          return;
        }

        if (uData.schoolId) {
          const schoolDoc = await getDoc(doc(db, "schools", uData.schoolId));
          if (schoolDoc.exists()) {
            setSchoolData({ id: schoolDoc.id, ...schoolDoc.data() } as SchoolData);
          }

          const qUsers = query(collection(db, "users"), where("schoolId", "==", uData.schoolId));
          const usersSnap = await getDocs(qUsers);
          const fetchedUsers: UserData[] = [];
          usersSnap.forEach(d => fetchedUsers.push({ id: d.id, ...d.data() } as UserData));
          setTenantUsers(fetchedUsers);
        }
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const canAccess = userData?.role === "admin" || (userData as any)?.isITManager === true;
  if (!canAccess) {
    return (
      <div className="h-full flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200 max-w-sm w-full text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="text-sm font-black text-gray-900">アクセス権限がありません</h2>
          <p className="text-xs font-bold text-gray-500 leading-relaxed">
            この機能はテナント管理者またはIT担当者のみ利用可能です。
          </p>
          <button
            onClick={() => router.push("/top")}
            className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors"
          >
            ダッシュボードへ戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex-1 w-full flex flex-col font-sans text-gray-900 bg-[#F9FAFB] relative min-h-0">
      
      {/* アラート通知 */}
      {alert.show && (
        <div className="absolute top-4 inset-x-0 mx-auto w-fit z-50 px-4 py-2.5 rounded-xl shadow-lg border text-[11px] sm:text-xs font-bold transition-all animate-fade-in flex items-center gap-1.5">
          <div className={`p-1.5 rounded-full ${
            alert.type === "success" ? "bg-emerald-100 text-emerald-700" :
            alert.type === "warning" ? "bg-amber-100 text-amber-700" :
            "bg-red-100 text-red-700"
          }`}>
            {alert.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          </div>
          <span className="text-gray-800 pr-1">{alert.message}</span>
        </div>
      )}

      {/* スクロール領域 */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-4 lg:p-6 pb-20 md:pb-6 relative min-h-0 w-full">
        <div className="max-w-6xl mx-auto w-full">
          <MessageDelivery
            schoolData={schoolData}
            users={tenantUsers}
            currentUser={userData}
            showAlert={showAlert}
          />
        </div>
      </main>

    </div>
  );
}