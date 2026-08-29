"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, onSnapshot, addDoc, updateDoc, serverTimestamp, deleteDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { 
  ArrowLeft, PlusCircle, Trash2, CheckCircle2, AlertCircle, Loader2, Package, 
  ArrowRightLeft, ArrowDownToLine, MapPin, X, AlertTriangle, ScanLine, Search, 
  User as UserIcon, Globe, Calendar, Clock, ChevronRight, FileText, Check, Undo2
} from "lucide-react";
import { UserData, SchoolData, Equipment, Category, Location, Rental, Borrowing, RentalItem, CONDITION_CONF } from "./types";
import { ExternalUser } from "@/app/types/external";
import CustomSelect from "@/components/CustomSelect"; // ★ CustomSelectをインポート

import InventoryTab from "./components/InventoryTab";
import RentalsTab from "./components/RentalsTab";
import CategoriesTab from "./components/CategoriesTab";
import LocationsTab from "./components/LocationsTab";
import BorrowingsTab from "./components/BorrowingsTab";
import QRScannerModal from "./components/QRScannerModal";

function EquipmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [borrowings, setBorrowings] = useState<Borrowing[]>([]);
  const [externalUsers, setExternalUsers] = useState<ExternalUser[]>([]);
  
  const tabParam = searchParams.get("tab") as any;
  const [activeTab, setActiveTab] = useState<"dashboard" | "inventory" | "categories" | "locations" | "rentals" | "borrowings">(
    tabParam && ["dashboard", "inventory", "categories", "locations", "rentals", "borrowings"].includes(tabParam) ? tabParam : "dashboard"
  );

  useEffect(() => {
    if (tabParam && ["dashboard", "inventory", "categories", "locations", "rentals", "borrowings"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab: "dashboard" | "inventory" | "categories" | "locations" | "rentals" | "borrowings") => {
    setActiveTab(tab);
    router.push(`/top/equipment?tab=${tab}`);
  };

  const [toast, setToast] = useState<{ show: boolean, type: "success" | "error" | "warning", message: string }>({ show: false, type: "success", message: "" });
  const [confirmModal, setConfirmModal] = useState<{show: boolean, title: string, message: string, type: "danger"|"warning", onConfirm: ()=>void}>({ show: false, title: "", message: "", type: "danger", onConfirm: ()=>{} });

  const [equipModal, setEquipModal] = useState<{show: boolean, data: Partial<Equipment>}>({ show: false, data: {} });
  const [rentalModal, setRentalModal] = useState<{show: boolean, data: Partial<Rental>, targetIds: string[], borrowerMode: "text" | "external"}>({ show: false, data: { borrowerType: "external" }, targetIds: [], borrowerMode: "external" });
  const [returnModal, setReturnModal] = useState<{show: boolean, rental: Rental | null, forms: Record<string, any>}>({ show: false, rental: null, forms: {} });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [extSearchQuery, setExtSearchQuery] = useState("");

  useEffect(() => {
    let unsubs: (() => void)[] = [];
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocSnap = await getDoc(doc(db, "users", user.uid));
          if (!userDocSnap.exists()) { router.push("/login"); return; }
          const uData = { id: user.uid, ...userDocSnap.data() } as UserData;
          setUserData(uData);

          const sDoc = await getDoc(doc(db, "schools", uData.schoolId));
          setSchoolData(sDoc.exists() ? { id: sDoc.id, ...sDoc.data() } as SchoolData : null);

          unsubs.push(onSnapshot(query(collection(db, "equipment_categories"), where("schoolId", "==", uData.schoolId)), snap => setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)))));
          unsubs.push(onSnapshot(query(collection(db, "equipment_locations"), where("schoolId", "==", uData.schoolId)), snap => setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Location)))));
          unsubs.push(onSnapshot(query(collection(db, "equipments"), where("schoolId", "==", uData.schoolId)), snap => setEquipments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Equipment)))));
          unsubs.push(onSnapshot(query(collection(db, "rentals"), where("schoolId", "==", uData.schoolId)), snap => setRentals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Rental)))));
          unsubs.push(onSnapshot(query(collection(db, "borrowings"), where("schoolId", "==", uData.schoolId)), snap => setBorrowings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Borrowing)))));
          
          unsubs.push(onSnapshot(query(collection(db, "external_users"), where("schoolId", "==", uData.schoolId)), snap => setExternalUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExternalUser)))));

          setIsLoading(false);
        } catch (error) { setIsLoading(false); }
      } else { router.push("/login"); }
    });
    return () => { unsubscribeAuth(); unsubs.forEach(fn => fn()); };
  }, [router]);

  const showToast = (type: "success" | "error" | "warning", message: string) => { setToast({ show: true, type, message }); setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000); };
  const showConfirm = (title: string, message: string, type: "danger"|"warning", onConfirm: ()=>void) => setConfirmModal({ show: true, title, message, type, onConfirm });

  const generateManagementId = () => {
    const tenantPrefix = userData?.schoolId ? userData.schoolId.substring(0,4).toUpperCase() : "TENN";
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SCPS-${tenantPrefix}-${rand}`;
  };

  const saveEquipment = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      const condition = equipModal.data.condition || "good";
      const payload = { 
        ...equipModal.data, 
        status: equipModal.data.status || "available", 
        condition: condition,
        conditionNote: condition === "good" ? "" : (equipModal.data.conditionNote || ""), 
        schoolId: userData!.schoolId 
      };
      
      if (equipModal.data.id) await updateDoc(doc(db, "equipments", equipModal.data.id), payload);
      else await addDoc(collection(db, "equipments"), { ...payload, createdAt: serverTimestamp() });
      
      showToast("success", "備品を保存しました"); 
      setEquipModal({ show: false, data: {} });
    } catch (e) { showToast("error", "保存エラー"); } finally { setIsSubmitting(false); }
  };

  const handleDeleteEquip = (eq: Equipment) => {
    if (eq.status === "rented") {
      showConfirm("削除エラー", "この備品は現在貸出中のため削除できません。先に返却処理を行ってください。", "warning", () => setConfirmModal(p=>({...p, show:false})));
      return;
    }
    showConfirm("備品の削除", `「${eq.name}」を完全に削除します。よろしいですか？`, "danger", async () => {
      try { await deleteDoc(doc(db, "equipments", eq.id)); showToast("success", "削除しました"); } catch(e) { showToast("error", "削除に失敗しました"); }
      setConfirmModal(p=>({...p, show:false}));
    });
  };

  const saveRental = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      const items: RentalItem[] = rentalModal.targetIds.map(id => {
        const eq = equipments.find(x => x.id === id);
        return { equipmentId: id, equipmentName: eq!.name, managementId: eq!.managementId, status: "active" };
      });

      const payload = { 
        ...rentalModal.data, 
        borrowerType: rentalModal.borrowerMode,
        items, 
        status: "active", 
        schoolId: userData!.schoolId 
      };
      
      const docRef = await addDoc(collection(db, "rentals"), { ...payload, createdAt: serverTimestamp() });
      
      const batch = writeBatch(db);
      rentalModal.targetIds.forEach(id => { batch.update(doc(db, "equipments", id), { status: "rented" }); });
      
      if (userData) {
        const now = new Date();
        const rentalId = docRef.id;
        const linkUrl = `/top/equipment?tab=rentals`;
        const targetName = rentalModal.data.borrowerName || "借受人";
        const eqCount = items.length;

        const notifRef = doc(collection(db, "notifications"));
        batch.set(notifRef, {
          userId: userData.id,
          schoolId: userData.schoolId,
          title: `【貸出完了】${targetName}への貸出`,
          body: `備品 ${eqCount}点の貸出登録を完了しました。`,
          sourceApp: "equipment",
          linkUrl: linkUrl,
          isRead: false,
          isFlagged: false,
          createdAt: now,
          rentalIdRef: rentalId
        });

        if (rentalModal.data.endDate) {
          const endDate = new Date(rentalModal.data.endDate);
          endDate.setHours(23, 59, 0, 0);

          const reminderTime = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

          if (reminderTime > now) {
            const remRef = doc(collection(db, "notifications"));
            batch.set(remRef, {
              userId: userData.id,
              schoolId: userData.schoolId,
              title: `【返却期限間近】${targetName}の貸出`,
              body: `貸出中の備品（${eqCount}点）の返却期限が24時間後に迫っています。`,
              sourceApp: "equipment",
              linkUrl: linkUrl,
              isRead: false,
              isFlagged: false,
              createdAt: reminderTime,
              rentalIdRef: rentalId
            });
          }

          if (endDate > now) {
            const overRef = doc(collection(db, "notifications"));
            batch.set(overRef, {
              userId: userData.id,
              schoolId: userData.schoolId,
              title: `【期限超過】${targetName}の貸出`,
              body: `貸出中の備品（${eqCount}点）が返却期限を過ぎています。確認してください。`,
              sourceApp: "equipment",
              linkUrl: linkUrl,
              isRead: false,
              createdAt: endDate,
              rentalIdRef: rentalId
            });
          }
        }
      }

      await batch.commit();
      
      showToast("success", "貸出を一括登録しました");
      setRentalModal({ show: false, data: { borrowerType: "external" }, targetIds: [], borrowerMode: "external" });
      window.open(`/top/equipment/print/${docRef.id}`, '_blank'); 
    } catch (e) { showToast("error", "保存エラー"); } finally { setIsSubmitting(false); }
  };

  const processReturn = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      const r = returnModal.rental!;
      const forms = returnModal.forms;
      const batch = writeBatch(db);
      
      let allReturned = true;
      const updatedItems = (r.items || []).map(item => {
        const f = forms[item.equipmentId];
        if (f && f.isReturning) {
          batch.update(doc(db, "equipments", item.equipmentId), { status: "available", condition: f.condition, conditionNote: f.note });
          return { ...item, status: "returned", conditionAtReturn: f.condition, conditionNote: f.note };
        }
        if (item.status === "active") allReturned = false;
        return item;
      });

      batch.update(doc(db, "rentals", r.id), { items: updatedItems, status: allReturned ? "returned" : "partial" });
      
      if (userData) {
        const qNotifs = query(collection(db, "notifications"), where("rentalIdRef", "==", r.id));
        const notifsSnap = await getDocs(qNotifs);
        const now = new Date().getTime();
        let deletedCount = 0;
        
        notifsSnap.forEach(d => {
          const data = d.data();
          const cTime = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : new Date(data.createdAt).getTime();
          if (cTime > now && deletedCount < 400) {
            batch.delete(d.ref);
            deletedCount++;
          }
        });
      }

      await batch.commit();
      
      showToast("success", "返却処理が完了しました"); setReturnModal({ show: false, rental: null, forms: {} });
    } catch (e) { showToast("error", "保存エラー"); } finally { setIsSubmitting(false); }
  };

  const openReturnModal = (r: Rental) => {
    const initialForms: Record<string, any> = {};
    (r.items || []).filter(i => i.status === "active").forEach(i => {
      initialForms[i.equipmentId] = { isReturning: true, condition: "good", note: "" };
    });
    if(Object.keys(initialForms).length === 0) { showToast("warning", "この貸出の備品はすべて返却済みです"); return; }
    setReturnModal({ show: true, rental: r, forms: initialForms });
  };

  const handleQRScan = (data: string) => {
    setScannerOpen(false);
    try {
      const url = new URL(data);
      const paths = url.pathname.split('/');
      const rentalId = paths[paths.length - 1];
      const target = rentals.find(r => r.id === rentalId);
      if (target) { openReturnModal(target); } else { showToast("error", "該当データが見つかりません。"); }
    } catch (e) { showToast("error", "無効なQRコードです。"); }
  };

  const handleDeleteRental = (r: Rental) => {
    showConfirm("貸出データの削除", "この貸出データを削除します。未返却の備品がある場合、強制的に『貸出可能』に戻ります。", "danger", async () => {
      try {
        const batch = writeBatch(db);
        if (r.status === "active" || r.status === "partial") {
          (r.items || []).forEach(item => { if (item.status === "active") batch.update(doc(db, "equipments", item.equipmentId), { status: "available" }); });
        }
        batch.delete(doc(db, "rentals", r.id));

        const qNotifs = query(collection(db, "notifications"), where("rentalIdRef", "==", r.id));
        const notifsSnap = await getDocs(qNotifs);
        let deletedCount = 0;
        notifsSnap.forEach(d => {
          if (deletedCount < 400) { batch.delete(d.ref); deletedCount++; }
        });

        await batch.commit();
        showToast("success", "貸出データを削除し、備品状態をリセットしました");
      } catch(e) { showToast("error", "削除エラー"); }
      setConfirmModal(p=>({...p, show:false}));
    });
  };

  const handlePrintRental = (r: Rental) => {
    window.open(`/top/equipment/print/${r.id}`, '_blank');
  };

  const selectExternalUser = (user: ExternalUser) => {
    setRentalModal(prev => ({
      ...prev,
      data: {
        ...prev.data,
        borrowerName: user.name,
        borrowerId: user.id,
        borrowerEmail: user.email || "",
        borrowerAffiliation: user.affiliation || "",
        borrowerType: "external"
      }
    }));
  };

  if (isLoading) return <div className="min-h-screen bg-[#F9FAFB] flex justify-center items-center"><Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-indigo-600" /></div>;

  const activeRentals = rentals.filter(r => r.status === "active" || r.status === "partial");
  const overdueRentals = activeRentals.filter(r => { const end = new Date(r.endDate); end.setHours(23, 59, 59); return end < new Date(); });
  const isOverdueCount = overdueRentals.length;

  const filteredExtUsers = externalUsers.filter(u => 
    u.name.toLowerCase().includes(extSearchQuery.toLowerCase()) ||
    (u.affiliation || "").toLowerCase().includes(extSearchQuery.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(extSearchQuery.toLowerCase()) ||
    (u.loginId || "").toLowerCase().includes(extSearchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans flex flex-col text-gray-900">
      
      {/* カスタムUIアラート */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className={`p-3.5 sm:p-4 border-b ${confirmModal.type === 'danger' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
              <h3 className={`text-xs sm:text-sm font-black flex items-center ${confirmModal.type === 'danger' ? 'text-red-800' : 'text-amber-800'}`}>
                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" /> {confirmModal.title}
              </h3>
            </div>
            <div className="p-4 sm:p-5 text-[11px] sm:text-xs font-bold text-gray-700 leading-relaxed">{confirmModal.message}</div>
            <div className="p-2.5 sm:p-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setConfirmModal(p=>({...p, show:false}))} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-300 text-gray-700 text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl hover:bg-gray-50">キャンセル</button>
              {confirmModal.type === 'danger' ? (
                <button onClick={confirmModal.onConfirm} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl shadow-sm hover:bg-red-700">実行する</button>
              ) : (
                <button onClick={confirmModal.onConfirm} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-amber-600 text-white text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl shadow-sm hover:bg-amber-700">確認</button>
              )}
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-fade-in w-max">
          <div className={`px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold flex items-center shadow-lg ${toast.type === 'success' ? 'bg-gray-900 text-white' : toast.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 text-green-400" /> : <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />} {toast.message}
          </div>
        </div>
      )}

      <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-gray-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 bg-indigo-100 text-indigo-600 rounded-lg sm:rounded-xl"><Package className="w-4 h-4 sm:w-5 sm:h-5" /></div>
          <div><h1 className="text-xs sm:text-base font-black text-gray-900">備品・レンタル管理システム</h1></div>
        </div>
        <div className="flex overflow-x-auto gap-1 bg-gray-100 p-1 rounded-lg sm:rounded-xl custom-scrollbar shadow-inner">
          {[
            { id: "dashboard", label: "レポート" },
            { id: "inventory", label: "備品マスタ" },
            { id: "rentals", label: "貸出・返却" },
            { id: "categories", label: "カテゴリ" },
            { id: "locations", label: "保管場所" },
            { id: "borrowings", label: "外部借入" }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => handleTabChange(tab.id as any)} 
              className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
          
          {activeTab === "dashboard" && (
            <div className="space-y-4 sm:space-y-6 animate-fade-in">
              {/* サマリーカード */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div onClick={()=>handleTabChange("inventory")} className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:border-indigo-400 group transition-all hover:-translate-y-0.5">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] sm:text-xs font-bold text-gray-500 flex items-center gap-1 sm:gap-1.5"><Package className="w-3.5 h-3.5 sm:w-4 sm:h-4"/> 総備品数</p>
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-gray-900 mt-2 group-hover:text-indigo-600">{equipments.length}</p>
                </div>
                
                <div onClick={()=>handleTabChange("rentals")} className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-blue-200 shadow-sm cursor-pointer hover:border-blue-400 group transition-all hover:-translate-y-0.5">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] sm:text-xs font-bold text-blue-600 flex items-center gap-1 sm:gap-1.5"><ArrowRightLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4"/> 貸出中案件</p>
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-300 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-blue-700 mt-2 group-hover:text-blue-800">{activeRentals.length}</p>
                </div>

                <div onClick={()=>handleTabChange("rentals")} className={`bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 ${isOverdueCount > 0 ? 'border-red-300 bg-red-50/20 hover:border-red-400' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] sm:text-xs font-bold text-red-600 flex items-center gap-1 sm:gap-1.5"><AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4"/> 返却期限超過</p>
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-300 transition-colors" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-red-700 mt-2">{isOverdueCount}</p>
                </div>

                <div onClick={()=>handleTabChange("borrowings")} className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-amber-200 shadow-sm cursor-pointer hover:border-amber-400 group transition-all hover:-translate-y-0.5">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] sm:text-xs font-bold text-amber-600 flex items-center gap-1 sm:gap-1.5"><ArrowDownToLine className="w-3.5 h-3.5 sm:w-4 sm:h-4"/> 外部借入中</p>
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 group-hover:text-amber-600 transition-colors" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-amber-700 mt-2 group-hover:text-amber-800">{borrowings.filter(b=>b.status==="active").length}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                
                {/* 左側：期限超過・返却注意リスト */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm space-y-3 sm:space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-2.5 sm:pb-3">
                      <h3 className="text-[11px] sm:text-sm font-black text-gray-900 flex items-center gap-1.5 sm:gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" /> 返却期限超過・要対応 ({overdueRentals.length})
                      </h3>
                      <button onClick={()=>handleTabChange("rentals")} className="text-[10px] sm:text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                        <span className="hidden sm:inline">貸出・返却一覧へ</span><span className="sm:hidden">一覧</span> <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                    </div>

                    {overdueRentals.length === 0 ? (
                      <p className="text-[10px] sm:text-xs font-bold text-gray-400 text-center py-4 sm:py-6">現在、返却期限を過ぎている貸出はありません。</p>
                    ) : (
                      <div className="space-y-2 sm:space-y-2.5 max-h-60 sm:max-h-72 overflow-y-auto custom-scrollbar pr-1">
                        {overdueRentals.map(r => (
                          <div key={r.id} className="p-2.5 sm:p-3 bg-red-50/50 border border-red-200 rounded-lg sm:rounded-xl flex items-center justify-between gap-2 sm:gap-3 shadow-2xs">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <span className="text-[11px] sm:text-xs font-black text-gray-900 truncate">{r.borrowerName}</span>
                                {r.borrowerType === "external" && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[8px] sm:text-[9px] font-black flex items-center"><Globe className="w-2.5 h-2.5 mr-0.5"/>ゲスト</span>}
                              </div>
                              <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 truncate mt-0.5">目的: {r.purpose} | 場所: {r.location}</p>
                              <p className="text-[9px] sm:text-[10px] font-bold text-red-600 mt-1">期限: {r.endDate} (超過)</p>
                            </div>
                            <button onClick={()=>openReturnModal(r)} className="px-2.5 sm:px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] sm:text-xs font-bold shadow-sm shrink-0 flex items-center gap-1 transition-colors">
                              <Undo2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> 返却
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm space-y-3 sm:space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-2.5 sm:pb-3">
                      <h3 className="text-[11px] sm:text-sm font-black text-gray-900 flex items-center gap-1.5 sm:gap-2">
                        <ArrowRightLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" /> 最近の貸出履歴
                      </h3>
                      <button onClick={()=>handleTabChange("rentals")} className="text-[10px] sm:text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                        すべて見る <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      {rentals.slice(0, 5).map(r => (
                        <div key={r.id} onClick={()=>handleTabChange("rentals")} className="p-2.5 sm:p-3 bg-gray-50 hover:bg-gray-100/80 rounded-lg sm:rounded-xl flex items-center justify-between gap-2 sm:gap-3 cursor-pointer transition-colors shadow-2xs">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <span className="text-[10px] sm:text-xs font-black text-gray-900 truncate">{r.borrowerName}</span>
                              {r.borrowerType === "external" && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[8px] sm:text-[9px] font-black flex items-center"><Globe className="w-2.5 h-2.5 mr-0.5"/>ゲスト</span>}
                            </div>
                            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 truncate mt-0.5">{r.items?.map(i=>i.equipmentName).join(", ")}</p>
                          </div>
                          <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold shrink-0 ${
                            r.status === "returned" ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700"
                          }`}>
                            {r.status === "returned" ? "返却済" : "貸出中"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm space-y-2.5 sm:space-y-3">
                    <h3 className="text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-wider">クイックアクション</h3>
                    <div className="space-y-1.5 sm:space-y-2">
                      <button 
                        onClick={() => setEquipModal({show: true, data: { managementId: generateManagementId(), status: "available", condition: "good", accessories: [] }})} 
                        className="w-full p-2.5 sm:p-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold flex items-center justify-between transition-colors border border-indigo-100 shadow-2xs"
                      >
                        <span className="flex items-center gap-1.5 sm:gap-2"><PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 新しい備品を登録</span>
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>

                      <button 
                        onClick={() => setScannerOpen(true)} 
                        className="w-full p-2.5 sm:p-3 bg-gray-900 text-white hover:bg-black rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold flex items-center justify-between transition-colors shadow-sm"
                      >
                        <span className="flex items-center gap-1.5 sm:gap-2"><ScanLine className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> QRコードで返却読取</span>
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-blue-50/60 p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-blue-100 shadow-sm space-y-2.5 sm:space-y-3">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-blue-900 font-black text-[10px] sm:text-xs">
                      <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" /> 外部ユーザー（ゲスト）連携
                    </div>
                    <p className="text-[9px] sm:text-[10px] font-bold text-blue-800/80 leading-relaxed">
                      登録された外部ユーザーへの貸出登録に対応しています。一括貸出登録時に「登録済みゲストから選択」を選ぶと、部署・メールアドレスなどの特定情報と紐づけて貸出管理できます。
                    </p>
                    <div className="pt-2 border-t border-blue-200/60 flex justify-between items-center text-[10px] sm:text-xs font-bold text-blue-900">
                      <span>登録ゲスト数</span>
                      <span className="font-black text-sm sm:text-base">{externalUsers.length} 名</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === "inventory" && (
            <InventoryTab 
              equipments={equipments} categories={categories} locations={locations} 
              currentUserName={userData?.name || "システムユーザー"} 
              onAddEquip={() => setEquipModal({show: true, data: { managementId: generateManagementId(), status: "available", condition: "good", accessories: [] }})} 
              onEditEquip={(eq) => setEquipModal({show: true, data: eq})} 
              onDeleteEquip={handleDeleteEquip} 
              onBulkRental={(ids) => setRentalModal({show: true, data: { borrowerType: "external" }, targetIds: ids, borrowerMode: "external"})} 
            />
          )}

          {activeTab === "rentals" && (
            <RentalsTab 
              rentals={rentals} onOpenScanner={() => setScannerOpen(true)} onOpenReturn={openReturnModal} 
              onPrint={handlePrintRental} onDeleteRental={handleDeleteRental} showToast={showToast}
            />
          )}

          {activeTab === "categories" && <CategoriesTab categories={categories} schoolId={userData!.schoolId} showToast={showToast} />}
          {activeTab === "locations" && <LocationsTab locations={locations} schoolId={userData!.schoolId} showToast={showToast} />}
          {activeTab === "borrowings" && <BorrowingsTab borrowings={borrowings} schoolId={userData!.schoolId} showToast={showToast} />}

        </div>
      </main>

      {/* ====== QRカメラモーダル ====== */}
      {scannerOpen && <QRScannerModal onScan={handleQRScan} onClose={() => setScannerOpen(false)} />}

      {/* ====== 備品登録モーダル ====== */}
      {equipModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col border border-gray-100">
            <div className="p-3 sm:p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <h3 className="text-xs sm:text-sm font-black text-gray-900">{equipModal.data.id ? "備品の編集" : "備品の新規登録"}</h3>
              <button type="button" onClick={() => setEquipModal({show:false, data:{}})} className="p-1 sm:p-1.5 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"><X className="w-4 h-4 sm:w-5 sm:h-5"/></button>
            </div>
            <form onSubmit={saveEquipment} className="p-4 sm:p-5 space-y-3 sm:space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">管理ID (自動採番) <span className="text-red-500">*</span></label>
                  <input type="text" required disabled value={equipModal.data.managementId||""} onChange={e=>setEquipModal(p=>({show:true,data:{...p.data, managementId:e.target.value}}))} className="w-full border border-gray-200 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold font-mono bg-gray-100 text-gray-500 cursor-not-allowed shadow-2xs"/>
                </div>
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">取得年月日</label>
                  <input type="date" value={equipModal.data.acquiredAt||""} onChange={e=>setEquipModal(p=>({show:true,data:{...p.data, acquiredAt:e.target.value}}))} className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"/>
                </div>
              </div>
              
              <div>
                <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">備品名 <span className="text-red-500">*</span></label>
                <input type="text" required value={equipModal.data.name||""} onChange={e=>setEquipModal(p=>({show:true,data:{...p.data, name:e.target.value}}))} className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"/>
              </div>
              
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">カテゴリ <span className="text-red-500">*</span></label>
                  <CustomSelect 
                    value={equipModal.data.categoryId||""} 
                    onChange={val=>setEquipModal(p=>({show:true,data:{...p.data, categoryId:val}}))} 
                    options={[
                      { value: "", label: "選択してください" },
                      ...categories.map(c=>({ value: c.id, label: c.name }))
                    ]}
                    buttonClassName="w-full border border-gray-300 bg-white rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs flex items-center justify-between"
                  />
                </div>
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">保管場所 <span className="text-red-500">*</span></label>
                  <CustomSelect 
                    value={equipModal.data.locationId||""} 
                    onChange={val=>setEquipModal(p=>({show:true,data:{...p.data, locationId:val}}))} 
                    options={[
                      { value: "", label: "選択してください" },
                      ...locations.map(l=>({ value: l.id, label: l.name }))
                    ]}
                    buttonClassName="w-full border border-gray-300 bg-white rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs flex items-center justify-between"
                  />
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg sm:rounded-xl p-2.5 sm:p-3 bg-gray-50">
                <label className="block text-[9px] sm:text-[10px] font-bold text-gray-700 mb-1.5 sm:mb-2">備品の状態 (コンディション)</label>
                <div className="flex gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                  {Object.entries(CONDITION_CONF).map(([k,v])=>(
                    <label key={k} className={`flex-1 flex justify-center items-center py-1 sm:py-1.5 border rounded-lg cursor-pointer text-[10px] sm:text-xs font-bold transition-colors shadow-2xs ${equipModal.data.condition===k?'border-indigo-500 bg-indigo-50 text-indigo-700':'border-gray-200 bg-white text-gray-500 hover:bg-gray-100'}`}>
                      <input type="radio" checked={equipModal.data.condition===k} onChange={()=>setEquipModal(p=>({show:true, data:{...p.data, condition:k as any}}))} className="hidden"/>{v.label}
                    </label>
                  ))}
                </div>
                {equipModal.data.condition && equipModal.data.condition !== "good" && (
                  <div className="animate-fade-in mt-2 sm:mt-3">
                    <label className="block text-[9px] sm:text-[10px] font-bold text-red-600 mb-1">状態の詳細・理由 <span className="text-red-500">*</span></label>
                    <input type="text" required placeholder="例: マイクの持ち手部分にヒビ割れあり" value={equipModal.data.conditionNote||""} onChange={e=>setEquipModal(p=>({show:true, data:{...p.data, conditionNote:e.target.value}}))} className="w-full border border-red-300 bg-red-50 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-red-500 shadow-2xs"/>
                  </div>
                )}
              </div>
              
              <div className="border border-gray-200 rounded-lg sm:rounded-xl p-2.5 sm:p-3 bg-gray-50">
                <label className="block text-[9px] sm:text-[10px] font-bold text-gray-700 mb-1.5 sm:mb-2 flex items-center justify-between">付属品<button type="button" onClick={() => setEquipModal(p => ({show:true, data:{...p.data, accessories: [...(p.data.accessories||[]), {id:Math.random().toString(), name:'', count:1, description:''}]}}))} className="text-indigo-600 flex items-center bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 hover:bg-indigo-100 transition-colors shadow-2xs"><PlusCircle className="w-3 h-3 mr-1"/>追加</button></label>
                {(equipModal.data.accessories||[]).map((acc, i) => (
                  <div key={acc.id} className="flex gap-1.5 sm:gap-2 items-start mb-1.5 sm:mb-2">
                    <input type="text" placeholder="名称" value={acc.name} onChange={e=> {const newAcc=[...(equipModal.data.accessories||[])]; newAcc[i].name=e.target.value; setEquipModal(p=>({show:true, data:{...p.data, accessories:newAcc}}));}} className="flex-1 border border-gray-300 rounded-lg px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"/>
                    <input type="number" min="1" value={acc.count} onChange={e=> {const newAcc=[...(equipModal.data.accessories||[])]; newAcc[i].count=Number(e.target.value); setEquipModal(p=>({show:true, data:{...p.data, accessories:newAcc}}));}} className="w-12 sm:w-16 border border-gray-300 rounded-lg px-1.5 sm:px-2 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"/>
                    <button type="button" onClick={() => {const newAcc=[...(equipModal.data.accessories||[])]; newAcc.splice(i,1); setEquipModal(p=>({show:true, data:{...p.data, accessories:newAcc}}));}} className="p-1 sm:p-1.5 text-red-500 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors shadow-2xs"><Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5"/></button>
                  </div>
                ))}
                {(!equipModal.data.accessories || equipModal.data.accessories.length === 0) && <p className="text-[9px] sm:text-[10px] text-gray-400 text-center py-2 font-bold">付属品はありません</p>}
              </div>

              <div>
                <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">使用方法・注意事項</label>
                <textarea rows={2} value={equipModal.data.usage||""} onChange={e=>setEquipModal(p=>({show:true,data:{...p.data, usage:e.target.value}}))} className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold resize-none custom-scrollbar outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"/>
              </div>
              <div className="pt-2 sm:pt-3 border-t border-gray-100 flex justify-end">
                <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-5 sm:px-6 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl shadow-sm flex items-center justify-center transition-colors disabled:opacity-50">
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5"/>} 保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====== ★ 一括貸出登録モーダル (外部ユーザー検索付き) ====== */}
      {rentalModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-gray-100">
            <div className="p-3 sm:p-4 border-b border-gray-100 bg-blue-50/80 flex justify-between items-center shrink-0">
              <h3 className="text-xs sm:text-sm font-black text-blue-900 flex items-center"><ArrowRightLeft className="w-3.5 h-3.5 sm:w-4 h-4 mr-1.5"/> 貸出の登録</h3>
              <button type="button" onClick={() => setRentalModal({show:false, data:{ borrowerType: "external" }, targetIds:[], borrowerMode: "external"})} className="p-1 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"><X className="w-4 h-4 sm:w-5 sm:h-5"/></button>
            </div>

            <form onSubmit={saveRental} className="p-4 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto custom-scrollbar flex-1 bg-white">
              <div className="p-2.5 sm:p-3 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl max-h-32 overflow-y-auto custom-scrollbar shadow-inner">
                <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 block mb-1">貸出対象 ({rentalModal.targetIds.length}点)</span>
                <ul className="text-[11px] sm:text-xs font-bold text-gray-800 list-disc list-inside pl-1 sm:pl-2">
                  {rentalModal.targetIds.map(id => <li key={id} className="truncate">{equipments.find(e=>e.id===id)?.name}</li>)}
                </ul>
              </div>

              {/* 借受人のタイプ選択タブ */}
              <div>
                <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">借受人（貸出相手）の指定方法</label>
                <div className="flex bg-gray-100 p-1 rounded-lg sm:rounded-xl shadow-inner">
                  <button
                    type="button"
                    onClick={() => setRentalModal(p => ({ ...p, borrowerMode: "external", data: { ...p.data, borrowerType: "external" } }))}
                    className={`flex-1 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg transition-colors flex items-center justify-center gap-1 ${rentalModal.borrowerMode === "external" ? 'bg-blue-600 text-white shadow-2xs' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'}`}
                  >
                    <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> ゲストから選択
                  </button>
                  <button
                    type="button"
                    onClick={() => setRentalModal(p => ({ ...p, borrowerMode: "text", data: { ...p.data, borrowerType: "text" } }))}
                    className={`flex-1 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg transition-colors ${rentalModal.borrowerMode === "text" ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'}`}
                  >
                    手入力 (フリー)
                  </button>
                </div>
              </div>

              {/* 外部ユーザー選択UI */}
              {rentalModal.borrowerMode === "external" ? (
                <div className="space-y-2 sm:space-y-3 bg-blue-50/50 p-3 sm:p-3.5 border border-blue-200 rounded-lg sm:rounded-xl animate-fade-in shadow-2xs">
                  <span className="text-[9px] sm:text-[10px] font-black text-blue-900 block">ゲスト（外部ユーザー）の検索</span>
                  
                  <div className="relative">
                    <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="名前・所属・ID・メールで検索..." 
                      value={extSearchQuery}
                      onChange={e => setExtSearchQuery(e.target.value)}
                      className="w-full pl-7 sm:pl-8 pr-2.5 sm:pr-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                    />
                  </div>

                  <div className="max-h-32 sm:max-h-36 overflow-y-auto custom-scrollbar space-y-1 sm:space-y-1.5 bg-white p-1 sm:p-1.5 rounded-lg border border-blue-100 shadow-inner">
                    {filteredExtUsers.length === 0 ? (
                      <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 text-center py-3 sm:py-4">該当するゲストが見つかりません</p>
                    ) : (
                      filteredExtUsers.map(user => {
                        const isSelected = rentalModal.data.borrowerId === user.id;
                        return (
                          <div 
                            key={user.id}
                            onClick={() => selectExternalUser(user)}
                            className={`p-1.5 sm:p-2 rounded-lg border text-[10px] sm:text-xs cursor-pointer transition-colors flex items-center justify-between ${
                              isSelected ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-gray-50 hover:bg-blue-50 text-gray-800 border-gray-200'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-black truncate">{user.name} <span className="text-[8px] sm:text-[9px] opacity-80 font-bold ml-0.5">({user.category === 'student' ? '生徒' : user.category === 'teacher' ? '教職員' : 'その他'})</span></p>
                              <p className="text-[8px] sm:text-[9px] opacity-80 truncate mt-0.5">所属: {user.affiliation || "未登録"} | メール: {user.email || "未登録"}</p>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {rentalModal.data.borrowerName && (
                    <div className="p-2 sm:p-2.5 bg-white border border-blue-300 rounded-lg text-[10px] sm:text-xs font-bold text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-1 shadow-sm">
                      <div className="min-w-0">
                        <span className="text-[8px] sm:text-[9px] font-bold text-blue-500 block mb-0.5">選択中の借受人</span>
                        <div className="truncate">
                          <span>{rentalModal.data.borrowerName}</span>
                          {rentalModal.data.borrowerAffiliation && <span className="text-[9px] sm:text-[10px] text-gray-500 font-normal ml-1">({rentalModal.data.borrowerAffiliation})</span>}
                        </div>
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-mono text-gray-400 truncate">{rentalModal.data.borrowerEmail}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">借受人名 (代表) <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      required 
                      value={rentalModal.data.borrowerName||""} 
                      onChange={e=>setRentalModal(p=>({show:true, borrowerMode: p.borrowerMode, targetIds:p.targetIds, data:{...p.data, borrowerName:e.target.value}}))} 
                      className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">使用場所 <span className="text-red-500">*</span></label>
                    <input type="text" required value={rentalModal.data.location||""} onChange={e=>setRentalModal(p=>({show:true, borrowerMode: p.borrowerMode, targetIds:p.targetIds, data:{...p.data, location:e.target.value}}))} className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow shadow-sm"/>
                  </div>
                </div>
              )}

              {rentalModal.borrowerMode === "external" && (
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">使用場所 <span className="text-red-500">*</span></label>
                  <input type="text" required value={rentalModal.data.location||""} onChange={e=>setRentalModal(p=>({show:true, borrowerMode: p.borrowerMode, targetIds:p.targetIds, data:{...p.data, location:e.target.value}}))} className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow shadow-sm"/>
                </div>
              )}

              <div><label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">使用目的 <span className="text-red-500">*</span></label><input type="text" required value={rentalModal.data.purpose||""} onChange={e=>setRentalModal(p=>({show:true, borrowerMode: p.borrowerMode, targetIds:p.targetIds, data:{...p.data, purpose:e.target.value}}))} className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow shadow-sm"/></div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div><label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">貸出日 <span className="text-red-500">*</span></label><input type="date" required value={rentalModal.data.startDate||""} onChange={e=>setRentalModal(p=>({show:true, borrowerMode: p.borrowerMode, targetIds:p.targetIds, data:{...p.data, startDate:e.target.value}}))} className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow shadow-sm"/></div>
                <div><label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">返却予定日 <span className="text-red-500">*</span></label><input type="date" required value={rentalModal.data.endDate||""} onChange={e=>setRentalModal(p=>({show:true, borrowerMode: p.borrowerMode, targetIds:p.targetIds, data:{...p.data, endDate:e.target.value}}))} className="w-full border border-gray-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow shadow-sm"/></div>
              </div>

              <div className="pt-2 sm:pt-3 border-t border-gray-100 flex justify-end shrink-0">
                <button type="submit" disabled={isSubmitting || !rentalModal.data.borrowerName} className="w-full sm:w-auto px-5 sm:px-6 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl shadow-sm transition-colors flex items-center justify-center">
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5"/> : null}
                  登録して貸出証を発行
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 返却処理モーダル */}
      {returnModal.show && returnModal.rental && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col border border-gray-100">
            <div className="p-3 sm:p-4 border-b border-gray-800 bg-gray-900 text-white flex justify-between items-center"><h3 className="text-xs sm:text-sm font-black flex items-center"><ScanLine className="w-3.5 h-3.5 sm:w-4 h-4 mr-1.5"/> 返却処理（状態確認）</h3><button type="button" onClick={() => setReturnModal({show:false, rental:null, forms:{}})} className="p-1 hover:bg-gray-800 rounded-lg transition-colors"><X className="w-4 h-4 sm:w-5 sm:h-5"/></button></div>
            <form onSubmit={processReturn} className="p-3 sm:p-5 space-y-3 sm:space-y-4 max-h-[75vh] overflow-y-auto bg-gray-50 custom-scrollbar">
              <p className="text-[9px] sm:text-[10px] text-gray-500 font-bold mb-1 sm:mb-2 flex items-center"><ArrowDownToLine className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1" /> 今回返却する備品にチェックを入れ、状態を申告してください。</p>
              {(returnModal.rental.items || []).map(item => {
                if(item.status === "returned") return null;
                const f = returnModal.forms[item.equipmentId];
                if(!f) return null;
                return (
                  <div key={item.equipmentId} className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border bg-white shadow-sm transition-colors ${f.isReturning ? 'border-indigo-400 ring-1 ring-indigo-100' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-center mb-2 sm:mb-3">
                      <div className="min-w-0 pr-2">
                        <p className="text-[9px] sm:text-[10px] font-mono text-gray-500 mb-0.5">{item.managementId}</p>
                        <p className="text-[11px] sm:text-sm font-black text-gray-900 truncate">{item.equipmentName}</p>
                      </div>
                      <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer bg-gray-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border shrink-0 hover:bg-gray-100 transition-colors shadow-2xs">
                        <input type="checkbox" checked={f.isReturning} onChange={e=>setReturnModal(p=>({show:true, rental:p.rental, forms:{...p.forms, [item.equipmentId]:{...f, isReturning:e.target.checked}}}))} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 rounded focus:ring-indigo-500"/>
                        <span className="text-[10px] sm:text-xs font-bold text-gray-800">今回返却する</span>
                      </label>
                    </div>
                    {f.isReturning && (
                      <div className="pt-2.5 sm:pt-3 border-t border-gray-100 space-y-2.5 sm:space-y-3 animate-fade-in">
                        <div className="flex gap-1.5 sm:gap-2">
                          {Object.entries(CONDITION_CONF).map(([k,v])=>(
                            <label key={k} className={`flex-1 flex justify-center items-center py-1 sm:py-1.5 border rounded-lg cursor-pointer text-[9px] sm:text-xs font-bold transition-colors shadow-2xs ${f.condition===k?'border-indigo-500 bg-indigo-50 text-indigo-700':'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                              <input type="radio" checked={f.condition===k} onChange={()=>setReturnModal(p=>({show:true, rental:p.rental, forms:{...p.forms, [item.equipmentId]:{...f, condition:k}}}))} className="hidden"/>{v.label}
                            </label>
                          ))}
                        </div>
                        {f.condition !== "good" && <input type="text" required placeholder="異常の内容（必須）" value={f.note} onChange={e=>setReturnModal(p=>({show:true, rental:p.rental, forms:{...p.forms, [item.equipmentId]:{...f, note:e.target.value}}}))} className="w-full border-red-300 bg-red-50 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-red-500 shadow-2xs"/>}
                      </div>
                    )}
                  </div>
                )
              })}
              <div className="pt-2 sm:pt-3 flex justify-end">
                <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-gray-900 hover:bg-black text-white text-[11px] sm:text-sm font-black rounded-lg sm:rounded-xl shadow-md transition-all hover:-translate-y-0.5 flex items-center justify-center disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin mr-1.5"/> : <ScanLine className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5"/>}
                  チェックした備品を返却
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EquipmentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F9FAFB] flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>}>
      <EquipmentContent />
    </Suspense>
  );
}