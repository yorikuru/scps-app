"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { 
  Package, Calendar as CalendarIcon, MapPin, CheckCircle2, AlertCircle, Loader2, ArrowLeft,
  MessageSquareText, Search, FileText, ChevronLeft, LogOut, ArrowRightLeft, ShieldAlert,
  AlertTriangle, ScanLine, X, QrCode
} from "lucide-react";
import * as LucideIcons from "lucide-react";

import { useDialog } from "@/components/DialogContext";
import { ExternalUser } from "@/app/types/external";
import ExtHeader from "@/app/ext-top/components/ExtHeader";
import { Rental } from "@/app/top/equipment/types";

type AppConfig = { name: string; icon: string; color: string; };

const COLOR_MAPPINGS: Record<string, { bg: string, text: string, hover: string, border: string, lightBg: string, ring: string }> = {
  indigo: { bg: "bg-indigo-600", text: "text-indigo-600", hover: "hover:bg-indigo-700", border: "border-indigo-200", lightBg: "bg-indigo-100", ring: "focus:ring-indigo-500" },
  blue: { bg: "bg-blue-600", text: "text-blue-600", hover: "hover:bg-blue-700", border: "border-blue-200", lightBg: "bg-blue-100", ring: "focus:ring-blue-500" },
  green: { bg: "bg-emerald-600", text: "text-emerald-600", hover: "hover:bg-emerald-700", border: "border-emerald-200", lightBg: "bg-emerald-100", ring: "focus:ring-emerald-500" },
  purple: { bg: "bg-purple-600", text: "text-purple-600", hover: "hover:bg-purple-700", border: "border-purple-200", lightBg: "bg-purple-100", ring: "focus:ring-purple-500" },
  orange: { bg: "bg-orange-600", text: "text-orange-600", hover: "hover:bg-orange-700", border: "border-orange-200", lightBg: "bg-orange-100", ring: "focus:ring-orange-500" },
  rose: { bg: "bg-rose-600", text: "text-rose-600", hover: "hover:bg-rose-700", border: "border-rose-200", lightBg: "bg-rose-100", ring: "focus:ring-rose-500" },
  amber: { bg: "bg-amber-600", text: "text-amber-600", hover: "hover:bg-amber-700", border: "border-amber-200", lightBg: "bg-amber-100", ring: "focus:ring-amber-500" },
  cyan: { bg: "bg-cyan-600", text: "text-cyan-600", hover: "hover:bg-cyan-700", border: "border-cyan-200", lightBg: "bg-cyan-100", ring: "focus:ring-cyan-500" },
  sky: { bg: "bg-sky-600", text: "text-sky-600", hover: "hover:bg-sky-700", border: "border-sky-200", lightBg: "bg-sky-100", ring: "focus:ring-sky-500" },
  teal: { bg: "bg-teal-600", text: "text-teal-600", hover: "hover:bg-teal-700", border: "border-teal-200", lightBg: "bg-teal-100", ring: "focus:ring-teal-500" },
  violet: { bg: "bg-violet-600", text: "text-violet-600", hover: "hover:bg-violet-700", border: "border-violet-200", lightBg: "bg-violet-100", ring: "focus:ring-violet-500" },
  pink: { bg: "bg-pink-600", text: "text-pink-600", hover: "hover:bg-pink-700", border: "border-pink-200", lightBg: "bg-pink-100", ring: "focus:ring-pink-500" },
  default: { bg: "bg-indigo-600", text: "text-indigo-600", hover: "hover:bg-indigo-700", border: "border-indigo-200", lightBg: "bg-indigo-100", ring: "focus:ring-indigo-500" }
};

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

function ExternalEquipmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rentalQuery = searchParams.get("rental");

  const { showConfirm } = useDialog();
  
  const [extUser, setExtUser] = useState<ExternalUser | null>(null);
  const [schoolData, setSchoolData] = useState<any>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rentals, setRentals] = useState<Rental[]>([]);
  const [activeRentalId, setActiveRentalId] = useState<string | null>(null);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // ★ QRコード拡大ポップアップ用のステート
  const [showQrModal, setShowQrModal] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "returned">("active");

  const [appConfig, setAppConfig] = useState<AppConfig>({ name: "レンタル管理", icon: "Package", color: "indigo" });

  // リアルタイム時計の更新
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let unsubRentals: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const qExt = query(collection(db, "external_users"), where("authUid", "==", user.uid));
          const querySnapshot = await getDocs(qExt); 

          if (querySnapshot.empty) {
            setError("外部ユーザーアカウントが見つかりません。");
            setIsLoading(false);
            return;
          }

          const extDoc = querySnapshot.docs[0];
          const currentUserData = { id: extDoc.id, ...extDoc.data() } as ExternalUser;
          
          const now = Date.now();
          let isExpired = false;
          if (currentUserData.expiresAt) {
            const expTime = typeof (currentUserData.expiresAt as any).toDate === 'function' 
              ? (currentUserData.expiresAt as any).toDate().getTime() 
              : new Date(currentUserData.expiresAt).getTime();
            if (expTime < now) isExpired = true;
          }

          if (currentUserData.status !== "active" || isExpired) {
            setError(isExpired ? "アカウントの有効期限が切れています。" : "アカウントが有効化されていないか、停止されています。");
            setIsLoading(false);
            return;
          }

          const allowedModules = currentUserData.allowedModules || [];
          if (!allowedModules.includes("equipment")) {
            setError("このアプリの利用権限が付与されていません。");
            setIsLoading(false);
            return;
          }

          setExtUser(currentUserData);

          const schoolDocSnap = await getDoc(doc(db, "schools", currentUserData.schoolId));
          let currentSchoolData: any = {};
          if (schoolDocSnap.exists()) {
            currentSchoolData = schoolDocSnap.data();
            setSchoolData(currentSchoolData);
          }

          const qApps = query(collection(db, "system_apps"), where("appId", "==", "equipment"));
          const appsSnap = await getDocs(qApps);
          let appMeta: any = { icon: "Package", color: "indigo", name: "レンタル管理" };
          if (!appsSnap.empty) {
            appMeta = appsSnap.docs[0].data();
          }

          setAppConfig({
            name: currentSchoolData.customExternalAppNames?.["equipment"] || currentSchoolData.customAppNames?.["equipment"] || appMeta.name,
            icon: appMeta.icon,
            color: appMeta.color
          });

          const qRentals = query(
            collection(db, "rentals"), 
            where("schoolId", "==", currentUserData.schoolId),
            where("borrowerId", "==", currentUserData.id),
            orderBy("createdAt", "desc")
          );

          unsubRentals = onSnapshot(qRentals, (snapshot) => {
            const fetched: Rental[] = [];
            snapshot.forEach((d) => {
              fetched.push({ id: d.id, ...d.data() } as Rental);
            });
            setRentals(fetched);
          });

          setIsLoading(false);
        } catch (error) {
          console.error(error);
          setError("データの読み込みに失敗しました。");
          setIsLoading(false);
        }
      } else {
        router.push("/ext-login");
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubRentals) unsubRentals();
    };
  }, [router]);

  useEffect(() => {
    if (!isLoading && rentalQuery) {
      if (rentals.some(r => r.id === rentalQuery)) {
        setActiveRentalId(rentalQuery);
        if (window.innerWidth < 1024) setShowMobileDetail(true);
      } else {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("rental");
        router.replace(params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname);
      }
    }
  }, [rentalQuery, rentals, isLoading, router, searchParams]);

  const updateRentalUrl = (rId: string | null) => {
    setActiveRentalId(rId);
    const params = new URLSearchParams(searchParams.toString());
    if (rId) params.set("rental", rId);
    else params.delete("rental");
    router.replace(params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname);
  };

  const handleLogout = () => {
    showConfirm("ログアウトしますか？", async () => {
      await signOut(auth);
      router.push("/ext-login");
    }, "warning", "ログアウトの確認");
  };

  const handleErrorReturn = () => {
    if (error === "このアプリの利用権限が付与されていません。") {
      router.push("/ext-top");
    } else {
      signOut(auth).then(() => router.push("/ext-login"));
    }
  };

  if (isLoading) return <div className="h-[100dvh] flex justify-center items-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  if (error || !extUser) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-black text-gray-900 mb-2">アクセスできません</h1>
        <p className="text-sm font-bold text-gray-500 mb-6">{error}</p>
        <button onClick={handleErrorReturn} className="px-5 py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-transform hover:-translate-y-0.5 shadow-sm">
          <LogOut className="w-4 h-4"/> 戻る
        </button>
      </div>
    );
  }

  const c = COLOR_MAPPINGS[appConfig.color] || COLOR_MAPPINGS.default;

  const isOverdue = (dateStr: string | null) => { 
    if (!dateStr) return false; 
    const end = new Date(dateStr); 
    end.setHours(23, 59, 59); 
    return end < new Date(); 
  };

  const filteredRentals = rentals.filter(r => {
    if (statusFilter === "active" && r.status === "returned") return false;
    if (statusFilter === "returned" && r.status !== "returned") return false;
    if (searchQuery && !r.purpose.includes(searchQuery) && !r.items?.some(i => i.equipmentName.includes(searchQuery))) return false;
    return true;
  });

  const activeRental = filteredRentals.find(r => r.id === activeRentalId);

  return (
    <div className="h-[100dvh] font-sans flex flex-col text-gray-900 bg-gray-50 relative overflow-hidden">
      
      <ExtHeader 
        schoolData={schoolData} 
        handleLogout={handleLogout} 
        appMeta={appConfig} 
        showBackButton={true} 
      />

      <main className="flex-1 w-full max-w-7xl mx-auto sm:p-4 flex flex-col min-h-0 bg-white sm:bg-transparent">
        <div className="flex-1 overflow-hidden flex bg-white sm:rounded-2xl sm:shadow-sm sm:border border-gray-200 relative min-h-0">
          
          {/* ＝＝＝ 左ペイン：リスト ＝＝＝ */}
          <div className={`w-full lg:w-[380px] xl:w-[420px] border-r border-gray-200 flex flex-col flex-shrink-0 bg-white h-full ${showMobileDetail ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-3 border-b border-gray-200 bg-gray-50/50 flex flex-col gap-2.5 shrink-0">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" placeholder="備品名や目的で検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 ${c.ring} shadow-2xs`}
                />
              </div>
              <div className="flex bg-gray-200/50 p-1 rounded-xl">
                <button onClick={() => setStatusFilter("active")} className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${statusFilter === "active" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                  貸出中・未返却
                </button>
                <button onClick={() => setStatusFilter("returned")} className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${statusFilter === "returned" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                  返却済み
                </button>
                <button onClick={() => setStatusFilter("all")} className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${statusFilter === "all" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                  すべて
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
              {filteredRentals.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-gray-400 py-12 opacity-70">
                  <Package className="w-8 h-8 mb-3" />
                  <p className="text-xs font-bold">該当する貸出記録はありません</p>
                </div>
              ) : (
                filteredRentals.map((r) => {
                  const isSelected = r.id === activeRentalId;
                  const overdue = (r.status === "active" || r.status === "partial") && isOverdue(r.endDate);
                  const itemsCount = (r.items || []).length;
                  const firstItemName = (r.items || [])[0]?.equipmentName || "不明な備品";

                  return (
                    <div 
                      key={r.id} 
                      onClick={() => {
                        updateRentalUrl(r.id);
                        if (window.innerWidth < 1024) setShowMobileDetail(true);
                      }}
                      className={`p-3.5 rounded-xl cursor-pointer flex flex-col gap-2 min-w-0 transition-all mb-3 border-2 ${
                        isSelected && window.innerWidth >= 1024 
                          ? (overdue ? 'bg-red-50 border-red-400 shadow-md scale-[1.01]' : `${c.lightBg} border-${appConfig.color}-400 shadow-md scale-[1.01]`) 
                          : overdue 
                            ? 'bg-red-50/60 border-red-200 hover:bg-red-100 shadow-sm'
                            : 'bg-white hover:bg-gray-50 border-gray-100 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className={`text-sm font-black truncate ${overdue ? 'text-red-700' : 'text-gray-900'}`}>
                            {overdue && <AlertTriangle className="w-4 h-4 inline text-red-600 mr-1 mb-0.5" />}
                            {firstItemName} {itemsCount > 1 && <span className="text-[10px] font-bold text-gray-500 ml-1">他 {itemsCount - 1}点</span>}
                          </h4>
                          <p className="text-[10px] font-bold text-gray-500 truncate mt-1"><MapPin className="w-3 h-3 inline text-gray-400 mr-0.5"/> {r.purpose} / {r.location}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {r.status === "returned" ? <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] font-bold border border-gray-200">返却済</span> :
                            r.status === "partial" ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold border border-blue-200">一部返却済</span> :
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-black shadow-sm ${overdue ? 'bg-red-600 text-white animate-pulse border border-red-700' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                              {overdue ? '期限超過' : '貸出中'}
                            </span>}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-1.5 pt-2.5 border-t border-gray-200/60">
                        <span className="text-[9px] font-mono text-gray-400">ID: {r.id.slice(-6).toUpperCase()}</span>
                        <span className={`text-[10px] font-bold flex items-center gap-1 ${overdue ? 'text-red-600 font-black' : 'text-gray-500'}`}>
                          {overdue && <AlertCircle className="w-3 h-3" />}
                          期限: {r.endDate}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

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

          {/* ＝＝＝ 右ペイン：プレビュー詳細 ＝＝＝ */}
          <div className={`flex-1 w-full h-full min-w-0 bg-gray-50/50 ${showMobileDetail ? 'block absolute inset-0 z-20' : 'hidden lg:flex flex-col'}`}>
            {!activeRental ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6 text-center h-full">
                <div className={`p-4 ${c.lightBg} ${c.text} rounded-2xl mb-4 shadow-sm`}>
                  <DynamicIcon name={appConfig.icon} className="w-10 h-10" />
                </div>
                <h3 className="text-sm font-black text-gray-700 mb-1">貸出履歴が選択されていません</h3>
                <p className="text-[11px] font-bold text-gray-400">左側のリストから項目を選択すると、詳細が表示されます。</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col h-full bg-white relative">
                
                <div className="lg:hidden flex items-center px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10 shrink-0 shadow-sm">
                  <button 
                    onClick={() => {
                      setShowMobileDetail(false);
                      updateRentalUrl(null);
                    }} 
                    className="flex items-center text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 mr-1" /> 戻る
                  </button>
                </div>

                <div className={`p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 shrink-0 ${
                  activeRental.status === "returned" ? "bg-emerald-50" :
                  isOverdue(activeRental.endDate) ? "bg-red-600 text-white" : "bg-blue-50"
                }`}>
                  <div className="flex items-center gap-2">
                    {activeRental.status === "returned" ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : 
                     isOverdue(activeRental.endDate) ? <AlertCircle className="w-5 h-5 animate-pulse" /> : <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
                    <h2 className={`text-base font-black ${activeRental.status === "returned" ? 'text-emerald-800' : isOverdue(activeRental.endDate) ? 'text-white' : 'text-blue-800'}`}>
                      {activeRental.status === "returned" 
                        ? "すべて返却完了" 
                        : activeRental.status === "partial" 
                          ? "一部返却済み（貸出中あり）" 
                          : isOverdue(activeRental.endDate) 
                            ? (
                              <>
                                このレンタルは返却期限を超過しています<br />
                                <span className="text-m opacity-90 block mt-1">直ちに返却してください</span>
                              </>
                            ) : "現在貸出中"}
                    </h2>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-lg ${isOverdue(activeRental.endDate) ? 'bg-red-700 text-white' : 'bg-white/50 border'}`}>
                    ID: {activeRental.id.toUpperCase()}
                  </span>
                </div>

                <div className="p-4 sm:p-8 flex-1">
                  
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 mb-8 shadow-sm">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">貸出概要</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1.5"><CalendarIcon className="w-3 h-3"/> 貸出日</p>
                        <p className="text-sm font-black text-gray-900">{activeRental.startDate}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1.5"><CalendarIcon className="w-3 h-3"/> 返却期限</p>
                        <p className={`text-sm font-black ${isOverdue(activeRental.endDate) && activeRental.status !== 'returned' ? 'text-red-600' : 'text-gray-900'}`}>{activeRental.endDate}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1.5"><MapPin className="w-3 h-3"/> 使用場所</p>
                        <p className="text-sm font-bold text-gray-800">{activeRental.location}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1.5"><FileText className="w-3 h-3"/> 使用目的</p>
                        <p className="text-sm font-bold text-gray-800">{activeRental.purpose}</p>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-indigo-500" /> 対象の備品一覧 <span className="text-[10px] text-gray-500 font-bold ml-1">計 {(activeRental.items || []).length} 点</span>
                  </h3>
                  
                  <div className="space-y-3 mb-8">
                    {(activeRental.items || []).map((item, idx) => (
                      <div key={idx} className={`p-4 border rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-colors ${item.status === 'returned' ? 'bg-gray-50/50 border-gray-100' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <div className="min-w-0">
                          <p className={`text-sm font-black truncate ${item.status === 'returned' ? 'text-gray-500' : 'text-gray-900'}`}>
                            {item.equipmentName}
                          </p>
                          <p className="text-[10px] font-mono text-gray-400 mt-0.5">管理番号: {item.managementId}</p>
                        </div>
                        
                        <div className="shrink-0 flex items-center gap-3">
                          {item.status === "returned" ? (
                            <div className="text-right">
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-bold block w-fit ml-auto border border-gray-200">返却済</span>
                              {item.conditionAtReturn && item.conditionAtReturn !== "good" && (
                                <p className="text-[9px] font-bold text-red-600 mt-1">状態申告: {item.conditionNote || "異常あり"}</p>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-black border border-amber-300 shadow-inner">
                              未返却（貸出中）
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                </div>

                {/* ★ タップすると大きく開くQRコードエリア */}
                {(activeRental.status === "active" || activeRental.status === "partial") && (
                  <div 
                    onClick={() => setShowQrModal(true)}
                    className="p-4 sm:p-6 bg-blue-50/50 border-t border-blue-100 shrink-0 flex flex-col sm:flex-row items-center gap-6 cursor-pointer hover:bg-blue-100/50 transition-colors group"
                  >
                    <div className="flex-shrink-0 bg-white p-2 rounded-2xl border border-blue-200 shadow-sm relative group-hover:scale-105 transition-transform">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://scps.yorikuru.com/rentals/${activeRental.id}`)}&margin=0`} 
                        alt="返却用QRコード" 
                        className="w-28 h-28 sm:w-32 sm:h-32 object-contain"
                      />
                      {isOverdue(activeRental.endDate) && (
                        <div className="absolute -top-3 -right-3 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow-md animate-bounce">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h4 className="text-sm font-black text-blue-900 mb-2 flex items-center justify-center sm:justify-start gap-1.5">
                        <ScanLine className="w-4 h-4 text-blue-600" />
                        返却用QRコード <span className="text-[10px] text-blue-500 font-bold ml-2 ">（タップして拡大表示）</span>
                      </h4>
                      <p className="text-xs font-bold text-blue-800/80 leading-relaxed mb-3">
                        返却時はこのQRコードを担当者に提示してください。
                      </p>
                      <p className="text-[10px] font-mono text-blue-500 bg-white px-2 py-1 rounded-md border border-blue-200 inline-block shadow-sm">
                        ID: {activeRental.id}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* ★ QRコード拡大ポップアップモーダル */}
      {showQrModal && activeRental && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative border border-gray-100 flex flex-col items-center text-center">
            
            <button 
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <QrCode className="w-5 h-5" />
              <h3 className="text-base font-black tracking-tight">返却用QRコード</h3>
            </div>
            <p className="text-[10px] font-bold text-gray-400 mb-4">担当者に提示してください</p>

            {/* QRコード本体 */}
            <div className="bg-white p-4 rounded-2xl border-2 border-indigo-100 shadow-inner mb-6 inline-block">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`https://scps.yorikuru.com/rentals/${activeRental.id}`)}&margin=0`} 
                alt="拡大QRコード" 
                className="w-52 h-52 sm:w-60 sm:h-60 object-contain mx-auto"
              />
            </div>

            {/* 詳細情報カード */}
            <div className="w-full bg-gray-50 rounded-2xl p-4 text-left border border-gray-100 space-y-2 mb-6">
              <div className="flex justify-between text-xs font-bold border-b border-gray-200/60 pb-1.5">
                <span className="text-gray-400">ID</span>
                <span className="font-mono text-gray-800">{activeRental.id}</span>
              </div>
              <div className="flex justify-between text-xs font-bold border-b border-gray-200/60 pb-1.5">
                <span className="text-gray-400">氏名</span>
                <span className="text-gray-900">{extUser.name}</span>
              </div>
              <div className="flex justify-between text-xs font-bold border-b border-gray-200/60 pb-1.5">
                <span className="text-gray-400">内容</span>
                <span className="text-gray-900 truncate max-w-[200px]">
                  {(activeRental.items || []).map(i => i.equipmentName).join(", ")}
                </span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-gray-400">現在時刻</span>
                <span className="font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{currentTime}</span>
              </div>
            </div>

            <button 
              onClick={() => setShowQrModal(false)}
              className="w-full py-3.5 bg-gray-900 hover:bg-black text-white text-xs font-black rounded-xl shadow-lg transition-all"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ExternalEquipmentMainPage() {
  return (
    <Suspense fallback={
      <div className="h-[100dvh] flex justify-center items-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    }>
      <ExternalEquipmentContent />
    </Suspense>
  );
}