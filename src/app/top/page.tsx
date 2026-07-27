"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, collection, getDocs, updateDoc, arrayUnion, query, orderBy, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Loader2, AlertTriangle, ShieldBan, Building2 } from "lucide-react";

import NormalTop from "./components/NormalTop";
import SetupTutorial from "./components/SetupTutorial";

export type MfaPolicy = { allowSetup: boolean; forceSetup: boolean; allowUsage: boolean; };

export type SystemApp = {
  id: string;
  appId: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  path: string;
  isActive: boolean;
  order: number;
};

export type UserData = {
  id: string;
  name: string;
  schoolName: string;
  role: string;
  schoolId: string;
  accountStatus: "active" | "pending" | "rejected" | "unaccessed";
  positionName?: string;
  isITManager?: boolean;
  email?: string;
  initialPassword?: string;
  lineConnectionEnforced?: boolean;
  lineUid?: string;
  requireMfa?: boolean | string;
  totpSecret?: string;
  passkeys?: any[];
  useCustomMfaPolicy?: boolean;
  mfaPolicies?: { email: MfaPolicy; totp: MfaPolicy; passkey: MfaPolicy; };
  allowedModules?: string[];
  userStatus?: string; // 在室ステータス
  // ★以下を追加：Googleカレンダー連携の型定義
  isGoogleCalendarLinked?: boolean;
  googleCalendarAccessToken?: string;
  googleCalendarRefreshToken?: string;
  googleCalendarTokenExpiry?: number;
};

export type SchoolData = {
  id: string;
  name: string;
  status: "active" | "suspended";
  requireMfa?: boolean | string;
  mfaPolicies?: { email: MfaPolicy; totp: MfaPolicy; passkey: MfaPolicy; };
  availableModules?: string[];
  sharedGoogleCalendarId?: string;
};

export type SystemMessage = {
  id: string;
  title: string;
  content: string;
  category?: "info" | "warning" | "maintenance" | "event";
  targetType: "all" | "tenant" | "user";
  targetId: string;
  startAt: string;
  endAt: string;
  isDismissible: boolean;
  isImportant: boolean;
  createdAt: string;
  readBy: string[];
  schoolId?: string;
  senderId?: string;
  senderName?: string;
  senderRole?: string;
  senderSchoolId?: string;
  showSenderName?: boolean;
};

export default function PortalTopPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null);
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [systemApps, setSystemApps] = useState<SystemApp[]>([]);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]); // ★自テナントユーザー一覧
  const [isLoading, setIsLoading] = useState(true);
  
  const [setupStatus, setSetupStatus] = useState({
    needsPassword: false,
    needsLine: false,
    needsMfa: false,
    isBlocked: false
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // 1. 動的アプリの取得
          const appsQ = query(collection(db, "system_apps"), orderBy("order", "asc"));
          const appsSnap = await getDocs(appsQ);
          const fetchedApps = appsSnap.docs.map(d => ({ id: d.id, ...d.data() } as SystemApp));
          setSystemApps(fetchedApps);

          // 2. ユーザー＆テナントデータの取得
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (!userDocSnap.exists()) {
            setIsLoading(false);
            return;
          }
          
          const uData = { id: userDocSnap.id, ...userDocSnap.data() } as UserData;
          setUserData(uData);

          const schoolDocRef = doc(db, "schools", uData.schoolId);
          const schoolDocSnap = await getDoc(schoolDocRef);
          let sData: SchoolData | null = null;
          
          if (schoolDocSnap.exists()) {
            sData = { id: schoolDocSnap.id, ...schoolDocSnap.data() } as SchoolData;
            setSchoolData(sData);
          }

          // ★3. テナント内全ユーザーの取得
          if (uData.schoolId) {
            const usersQ = query(collection(db, "users"), where("schoolId", "==", uData.schoolId));
            const usersSnap = await getDocs(usersQ);
            const fetchedUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserData));
            setTenantUsers(fetchedUsers);
          }

          // 4. ブロック判定
          const needsPassword = !!uData.initialPassword;
          const needsLine = !!uData.lineConnectionEnforced && !uData.lineUid;
          const hasTotp = !!uData.totpSecret;
          const hasPasskey = Array.isArray(uData.passkeys) && uData.passkeys.length > 0;
          const hasEmail = !!uData.email || !!user.email; 

          const activePolicies = uData.useCustomMfaPolicy && uData.mfaPolicies 
            ? uData.mfaPolicies 
            : (sData?.mfaPolicies || {
                email: { allowSetup: true, forceSetup: false, allowUsage: true },
                totp: { allowSetup: false, forceSetup: false, allowUsage: false },
                passkey: { allowSetup: false, forceSetup: false, allowUsage: false },
              });

          let needsMfa = false;

          const isTotpForced = activePolicies.totp?.forceSetup === true || String(activePolicies.totp?.forceSetup) === "true";
          const isPasskeyForced = activePolicies.passkey?.forceSetup === true || String(activePolicies.passkey?.forceSetup) === "true";
          const isEmailForced = activePolicies.email?.forceSetup === true || String(activePolicies.email?.forceSetup) === "true";

          if (isTotpForced && !hasTotp) needsMfa = true;
          if (isPasskeyForced && !hasPasskey) needsMfa = true;
          if (isEmailForced && !hasEmail) needsMfa = true;

          const isMfaGloballyRequired = 
            sData?.requireMfa === true || String(sData?.requireMfa) === "true" ||
            uData.requireMfa === true || String(uData.requireMfa) === "true";

          if (isMfaGloballyRequired && !needsMfa) {
            const hasValidMfa = 
              ((activePolicies.totp?.allowUsage === true || String(activePolicies.totp?.allowUsage) === "true") && hasTotp) ||
              ((activePolicies.passkey?.allowUsage === true || String(activePolicies.passkey?.allowUsage) === "true") && hasPasskey) ||
              ((activePolicies.email?.allowUsage === true || String(activePolicies.email?.allowUsage) === "true") && hasEmail);
              
            if (!hasValidMfa) needsMfa = true; 
          }
          
          setSetupStatus({
            needsPassword,
            needsLine,
            needsMfa,
            isBlocked: needsPassword || needsLine || needsMfa
          });

          // 5. メッセージの取得
          if (uData.accountStatus === "active") {
            const messagesRef = collection(db, "system_messages");
            const mSnap = await getDocs(messagesRef);
            const fetchedMessages: SystemMessage[] = [];
            const now = new Date();
            
            mSnap.forEach(doc => {
              const data = doc.data() as Omit<SystemMessage, 'id'>;
              const start = data.startAt ? new Date(data.startAt) : null;
              const end = data.endAt ? new Date(data.endAt) : null;
              const isStarted = !start || start <= now;
              const isNotEnded = !end || end >= now;

              if (!isStarted || !isNotEnded) return;

              const isTargeted = 
                data.targetType === "all" || 
                (data.targetType === "tenant" && data.targetId === uData.schoolId) ||
                (data.targetType === "user" && data.targetId === user.uid);
              if (!isTargeted) return;

              if (data.isDismissible && data.readBy?.includes(user.uid)) return;

              fetchedMessages.push({ id: doc.id, ...data } as SystemMessage);
            });
            
            fetchedMessages.sort((a, b) => {
              if (a.isImportant && !b.isImportant) return -1;
              if (!a.isImportant && b.isImportant) return 1;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });

            setMessages(fetchedMessages);
          }
        } catch (error) {
          console.error(error);
        } finally {
          setIsLoading(false);
        }
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const markMessageAsRead = async (messageId: string) => {
    if (!userData) return;
    setMessages(messages.filter(m => m.id !== messageId));
    try {
      await updateDoc(doc(db, "system_messages", messageId), {
        readBy: arrayUnion(userData.id)
      });
    } catch (error) {
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
      </div>
    );
  }

  if (schoolData?.status === "suspended" && userData?.role !== "system_admin") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-900 shadow rounded-lg max-w-md w-full p-8 text-center border-t-4 border-red-600">
          <Building2 className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">サービス提供停止中</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">現在、所属する組織のシステム利用が一時停止されています。</p>
          <button onClick={handleLogout} className="w-full py-2 bg-gray-100 dark:bg-gray-800 rounded-md font-bold text-sm">ログアウト</button>
        </div>
      </div>
    );
  }

  if (userData?.accountStatus === "pending") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-900 shadow rounded-lg max-w-md w-full p-8 text-center border-t-4 border-yellow-400">
          <AlertTriangle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">管理者の承認待ちです</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">承認されるまでログインできません。</p>
          <button onClick={handleLogout} className="w-full py-2 bg-gray-100 dark:bg-gray-800 rounded-md font-bold text-sm">ログアウト</button>
        </div>
      </div>
    );
  }

  if (userData?.accountStatus === "rejected") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-900 shadow rounded-lg max-w-md w-full p-8 text-center border-t-4 border-red-500">
          <ShieldBan className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">アクセスが拒否されました</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">このアカウントは現在利用停止されています。</p>
          <button onClick={handleLogout} className="w-full py-2 bg-gray-100 dark:bg-gray-800 rounded-md font-bold text-sm">ログアウト</button>
        </div>
      </div>
    );
  }

  if (setupStatus.isBlocked) {
    return <SetupTutorial setupStatus={setupStatus} userData={userData} handleLogout={handleLogout} />;
  }

  return (
    <NormalTop 
      userData={userData} 
      schoolData={schoolData} 
      messages={messages} 
      systemApps={systemApps} 
      tenantUsers={tenantUsers} // ★渡す
      markMessageAsRead={markMessageAsRead} 
      handleLogout={handleLogout} 
    />
  );
}