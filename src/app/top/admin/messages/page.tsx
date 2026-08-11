"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Loader2, ArrowLeft, ShieldAlert } from "lucide-react";
import MessageDelivery from "../components/MessageDelivery";
import { SchoolData, UserData } from "../page";

export default function TenantMessageDeliveryPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  // 通知アラート用
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
        router.push("/auth/login");
        return;
      }
      setCurrentUser(user);

      try {
        // ユーザーデータ取得
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
          router.push("/auth/login");
          return;
        }
        const uData = { id: userDoc.id, ...userDoc.data() } as UserData;
        setUserData(uData);

        // 権限チェック (テナント管理者 または IT担当者)
        const canAccess = uData.role === "admin" || (uData as any)?.isITManager === true;
        if (!canAccess) {
          setLoading(false);
          return;
        }

        // 学校データ取得
        if (uData.schoolId) {
          const schoolDoc = await getDoc(doc(db, "schools", uData.schoolId));
          if (schoolDoc.exists()) {
            setSchoolData({ id: schoolDoc.id, ...schoolDoc.data() } as SchoolData);
          }

          // 同一テナントの全ユーザー取得 (宛先選択用)
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // 権限がない場合のアクセス拒否画面
  const canAccess = userData?.role === "admin" || (userData as any)?.isITManager === true;
  if (!canAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-md w-full text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-black text-gray-900">アクセス権限がありません</h2>
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
    <div className="min-h-screen bg-[#F9FAFB] p-4 lg:p-8 font-sans">
      {/* アラート通知 */}
      {alert.show && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold transition-all animate-fade-in ${
          alert.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
          alert.type === "warning" ? "bg-amber-50 text-amber-800 border-amber-200" :
          "bg-red-50 text-red-800 border-red-200"
        }`}>
          {alert.message}
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <MessageDelivery
          schoolData={schoolData}
          users={tenantUsers}
          currentUser={userData}
          showAlert={showAlert}
        />
      </div>
    </div>
  );
}