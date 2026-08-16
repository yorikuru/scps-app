"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Loader2, ChevronRight, User, Globe, AlertCircle } from "lucide-react";
import * as LucideIcons from "lucide-react";

import ExtHeader from "./components/ExtHeader"; 

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

export default function ExtTopPage() {
  const router = useRouter();
  
  const [extUser, setExtUser] = useState<any>(null);
  const [schoolData, setSchoolData] = useState<any>(null);
  const [systemApps, setSystemApps] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState("こんにちは");

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour <= 10) {
      return "おはようございます";
    } else if (hour >= 11 && hour <= 17) {
      return "こんにちは";
    } else {
      return "こんばんは";
    }
  };

  useEffect(() => {
    setGreeting(getGreeting());

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const qExt = query(collection(db, "external_users"), where("authUid", "==", user.uid));
          const extSnap = await getDocs(qExt);
          
          if (!extSnap.empty) {
            const docData = extSnap.docs[0].data();
            const userData = { id: extSnap.docs[0].id, ...docData };
            setExtUser(userData);

            const schoolSnap = await getDoc(doc(db, "schools", docData.schoolId));
            if (schoolSnap.exists()) {
              setSchoolData(schoolSnap.data());
            }

            const appsSnap = await getDocs(collection(db, "system_apps"));
            setSystemApps(appsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            
            setIsLoading(false);
          } else {
            router.push("/top");
          }
        } catch (error) {
          console.error("データ取得エラー:", error);
          setIsLoading(false);
        }
      } else {
        router.push("/ext-login"); 
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/ext-login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!extUser) return null;

  const allowedModules: string[] = extUser.allowedModules || ["chat"];
  
  // ★ ここでシステムアプリの order を元にソートを行う
  const availableApps = allowedModules.map(appId => {
    const appMeta = systemApps.find(a => a.appId === appId || a.id === appId);
    const customName = schoolData?.customExternalAppNames?.[appId] || schoolData?.customAppNames?.[appId];
    const href = appMeta?.externalPath || (appId === "chat" ? "/ext-top/chat" : `/ext-top/${appId}`);
    
    return {
      id: appId,
      name: customName || appMeta?.name || appId,
      description: appMeta?.description || "許可されたアプリケーション",
      icon: appMeta?.icon || "Box",
      color: appMeta?.color || "indigo",
      href: href,
      order: appMeta?.order ?? 999
    };
  }).sort((a, b) => a.order - b.order); // ★ ソート処理

  return (
    <div className="min-h-[100dvh] bg-[#F4F7F6] font-sans text-gray-900 flex flex-col">
      
      <ExtHeader schoolData={schoolData} handleLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto w-full">
        <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm flex items-center gap-4 animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-yellow-400 to-amber-500 flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
              {extUser.name?.charAt(0) || "U"}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black text-gray-900 truncate">
                {greeting}、{extUser.name} さん
              </h2>
              <p className="text-xs sm:text-sm font-bold text-gray-500 mt-1 flex items-center gap-1.5 truncate">
                <User className="w-3.5 h-3.5 shrink-0" /> 
                <span className="truncate">{extUser.affiliation || "ゲストユーザー"}</span>
                <span className="text-gray-300 mx-1 shrink-0">|</span> 
                <span className="shrink-0">期限: {extUser.validUntil ? extUser.validUntil.replace(/-/g, '/') : "無期限"}</span>
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black text-gray-700 mb-3 ml-1 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-indigo-500" />
              ご利用可能なメニュー
            </h3>
            
            {availableApps.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-10 h-10 text-gray-300 mb-2" />
                <p className="text-sm font-black text-gray-600">現在利用可能なアプリがありません</p>
                <p className="text-xs font-bold text-gray-400 mt-1">管理者に権限の付与を依頼してください。</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {availableApps.map((app, idx) => (
                  <div 
                    key={idx}
                    onClick={() => router.push(app.href)}
                    className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all group flex items-center gap-4"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-${app.color}-50 text-${app.color}-600 group-hover:scale-110 transition-transform`}>
                      <DynamicIcon name={app.icon} className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-gray-900 group-hover:text-indigo-700 transition-colors truncate">
                        {app.name}
                      </h4>
                      <p className="text-[10px] sm:text-xs font-bold text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {app.description}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 shrink-0 transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
      <div className="flex flex-col gap-1.5 text-[9px] font-bold text-gray-500 text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
            <Link href="/legal/terms" className="hover:text-gray-300 transition-colors">利用規約</Link>
            <Link href="/legal/privacy" className="hover:text-gray-300 transition-colors">プライバシー</Link>
            <Link href="/legal/commercial" className="hover:text-gray-300 transition-colors">特定商取引法</Link>
          </div>
          <div className="text-[8px] text-gray-600 mt-0.5">
            &copy; {new Date().getFullYear()} YORIKURU / 生徒会ポータルシステム
          </div>
        </div>

    </div>
  );
}