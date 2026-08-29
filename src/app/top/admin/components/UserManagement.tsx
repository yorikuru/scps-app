"use client";

import React, { useState, useMemo, useEffect } from "react";
import { doc, updateDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { 
  Search, Loader2, FileSpreadsheet, Download, Lock, Unlock, ArrowUpDown, CheckCircle2, XCircle, Star, Printer, AlertCircle, X, RefreshCw, Mail, Edit3, UserCheck, UserX, Camera, User as UserIcon, MonitorSmartphone
} from "lucide-react";
import { UserData, SchoolData } from "../page";
import CsvUploadModal from "./CsvUploadModal";
import UserDetailsModal from "./UserDetailsModal";
import AccountSheetTemplate from "./AccountSheetTemplate";
import ProfilePhotoModal from "./ProfilePhotoModal";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import CustomSelect from "@/components/CustomSelect"; // ★ CustomSelectを追加

export type MfaPolicy = {
  allowSetup: boolean;
  forceSetup: boolean;
  allowUsage: boolean;
};

export type ExtendedUserData = UserData & {
  systemId?: string;
  studentId?: string;
  nameKana?: string;
  attendanceNumber?: string;
  birthDate?: string;
  classNumber?: string;
  club?: string;
  department?: string;
  gender?: string;
  grade?: string;
  organizationAddress?: string;
  phoneNumber?: string;
  previousSchool?: string;
  accountValidStartDate?: string;
  accountValidEndDate?: string;
  lineConnectionAllowed?: boolean;
  lineConnectionEnforced?: boolean;
  initialPassword?: string; 
  authProviders?: string[];
  accountStatus: "active" | "pending" | "rejected" | "unaccessed";
  requireMfa?: boolean;
  useCustomMfaPolicy?: boolean;
  mfaPolicies?: {
    email: MfaPolicy;
    totp: MfaPolicy;
    passkey: MfaPolicy;
  };
  photoURL?: string; 
  previousAccountStatus?: string; 
};

export type Position = {
  id: string;
  name: string;
  organizationId: string;
  isStudent: boolean;
  isInternal: boolean;
  shokui: number;
  displayOrder: number;
  leaderUserId?: string | null;
  leaderTitle?: string | null;
};

type Props = {
  users: UserData[];
  setUsers: React.Dispatch<React.SetStateAction<UserData[]>>;
  schoolData: SchoolData | null;
  fetchUsers: (schoolId: string) => Promise<void>;
  showAlert: (type: "success" | "error" | "warning", message: string) => void;
  onNavigateTab: (tab: string) => void;
};

type SortConfig = {
  key: "systemId" | "name" | "email" | "role" | "accountStatus";
  direction: "asc" | "desc";
};

export default function UserManagement({ users, setUsers, schoolData, fetchUsers, showAlert, onNavigateTab }: Props) {
  const [activeTab, setActiveTab] = useState<"active" | "pending">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterAccountStatus, setFilterAccountStatus] = useState("all");
  
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "systemId", direction: "asc" });
  
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<ExtendedUserData | null>(null);
  
  const [photoModalUserId, setPhotoModalUserId] = useState<string | null>(null);

  const [positions, setPositions] = useState<Position[]>([]);
  const [reauthModal, setReauthModal] = useState({ show: false, password: "", isProcessing: false });
  const [resettingEmails, setResettingEmails] = useState<string[]>([]);

  const [confirmModal, setConfirmModal] = useState<{show: boolean; message: string; onConfirm: () => void}>({ show: false, message: "", onConfirm: () => {} });
  
  const [isGeneratingSheet, setIsGeneratingSheet] = useState(false);
  const [sheetUser, setSheetUser] = useState<ExtendedUserData | null>(null);
  const [printUsers, setPrintUsers] = useState<ExtendedUserData[]>([]);
  const [selectedForPrint, setSelectedForPrint] = useState<string[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const [pendingPrintAction, setPendingPrintAction] = useState<(() => void) | null>(null);
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (!schoolData) return;
    const unsub = onSnapshot(query(collection(db, "positions"), where("schoolId", "==", schoolData.id)), (snap) => {
      const pos: Position[] = [];
      snap.forEach(d => pos.push({ id: d.id, ...d.data() } as Position));
      setPositions(pos);
    });
    return () => unsub();
  }, [schoolData]);

  const currentUser = auth.currentUser ? users.find(u => u.id === auth.currentUser?.uid) : null;
  const canManageUsers = currentUser?.role === "admin" || (currentUser as any)?.isITManager;

  const processedUsers = useMemo(() => {
    let filtered = (users as ExtendedUserData[]).filter(user => {
      const matchTab = activeTab === "pending" ? user.accountStatus === "pending" : user.accountStatus !== "pending";
      const matchSearch = searchQuery === "" || user.name.toLowerCase().includes(searchQuery.toLowerCase()) || user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = filterRole === "all" || user.role === filterRole;
      const matchAccountStatus = filterAccountStatus === "all" || 
        (filterAccountStatus === "active" && user.accountStatus === "active") ||
        (filterAccountStatus === "unaccessed" && user.accountStatus === "unaccessed") ||
        (filterAccountStatus === "rejected" && user.accountStatus === "rejected");
      return matchTab && matchSearch && matchRole && matchAccountStatus;
    });

    filtered.sort((a, b) => {
      let aValue: any = a[sortConfig.key];
      let bValue: any = b[sortConfig.key];

      if (sortConfig.key === "systemId") {
        aValue = a.systemId ? a.systemId.padStart(10, '0') : "9999999999";
        bValue = b.systemId ? b.systemId.padStart(10, '0') : "9999999999";
      } else if (sortConfig.key === "name") {
        aValue = a.nameKana || a.name || "";
        bValue = b.nameKana || b.name || "";
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [users, activeTab, searchQuery, filterRole, filterAccountStatus, sortConfig]);

  const requestSort = (key: SortConfig["key"]) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleAccountStatusChange = async (userId: string, newStatus: string) => {
    try {
      const targetUser = users.find(u => u.id === userId) as ExtendedUserData;
      const updateData: any = { accountStatus: newStatus };
      
      if (newStatus === "rejected" && targetUser) {
        updateData.previousAccountStatus = targetUser.accountStatus;
      }
      
      await updateDoc(doc(db, "users", userId), updateData);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updateData } : u));
      showAlert("success", newStatus === "rejected" ? "アカウントを利用停止にしました。" : "アカウントを復旧しました。");
    } catch (e) {
      showAlert("error", "アカウントのステータス更新に失敗しました。");
    }
  };

  const requestReissuePassword = (user: ExtendedUserData) => {
    setConfirmModal({
      show: true,
      message: `${user.name} さんの初期パスワードを再発行しますか？\n（※再発行後は新しいアカウントシートを配布してください）`,
      onConfirm: () => handleReissuePassword(user)
    });
  };

  const generateInitialPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let pass = "";
    for (let i = 0; i < 8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    return pass;
  };

  const handleReissuePassword = async (user: ExtendedUserData) => {
    const newPassword = generateInitialPassword();
    try {
      const authRes = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.id,
          email: user.email,
          password: newPassword,
          displayName: user.name
        })
      });
      if (!authRes.ok) throw new Error("Auth API Error");

      await updateDoc(doc(db, "users", user.id), { initialPassword: newPassword, accountStatus: "unaccessed" });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, initialPassword: newPassword, accountStatus: "unaccessed" } as UserData : u));
      showAlert("success", "初期パスワードを再発行しました。");
    } catch (e) {
      showAlert("error", "パスワードの再発行に失敗しました。");
    }
  };

  const requestPasswordResetMail = (email: string) => {
    setConfirmModal({
      show: true,
      message: `${email} 宛にパスワード再設定メールを送信しますか？`,
      onConfirm: () => handleSendPasswordReset(email)
    });
  };

  const handleSendPasswordReset = async (email: string) => {
    setResettingEmails(prev => [...prev, email]);
    try {
      const response = await fetch('/api/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      if (response.ok) {
        showAlert("success", `${email} 宛に再設定メールを送信しました。`);
      } else {
        showAlert("error", data.error || "メールの送信に失敗しました。");
      }
    } catch (error) {
      showAlert("error", "通信エラーが発生しました。");
    } finally {
      setResettingEmails(prev => prev.filter(e => e !== email));
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "admin": return "管理者";
      case "officer": return "役員";
      case "teacher": return "教職員";
      case "student": return "生徒";
      case "guest": return "ゲスト";
      default: return role;
    }
  };

  const generateAccountSheet = async (user: ExtendedUserData) => {
    if (!user.initialPassword) {
      setConfirmModal({
        show: true,
        message: "このユーザーには初期パスワードが設定されていません。SCコードでのログインが成功しない可能性がありますが、印刷を続けますか？",
        onConfirm: () => processGenerateSheet(user)
      });
      return;
    }
    processGenerateSheet(user);
  };

  const processGenerateSheet = async (user: ExtendedUserData) => {
    setSheetUser(user);
    setIsGeneratingSheet(true);

    setTimeout(async () => {
      try {
        const element = document.getElementById("account-sheet-template");
        if (!element) throw new Error("Template not found");
        
        const canvas = await html2canvas(element, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL("image/png");
        
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save(`SCPS_AccountSheet_${user.systemId || user.studentId || "0000"}_${user.name}.pdf`);
        
        showAlert("success", "アカウント発行シートのPDFを作成しました！");
      } catch (e) {
        console.error(e);
        showAlert("error", "シートの生成中にエラーが発生しました。");
      } finally {
        setIsGeneratingSheet(false);
        setSheetUser(null);
      }
    }, 300);
  };

  const handleReauthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("ユーザーがログインしていません。");
      
      if (user.providerData.some(p => p.providerId === "google.com")) {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, provider);
      } else {
        if(!user.email) throw new Error("メールアドレスが取得できません");
        const credential = EmailAuthProvider.credential(user.email, authPassword);
        await reauthenticateWithCredential(user, credential);
      }
      
      setIsAuthModalOpen(false);
      setAuthPassword("");
      if (pendingPrintAction) {
        pendingPrintAction();
        setPendingPrintAction(null);
      }
    } catch (error: any) {
      console.error(error);
      setAuthError("認証に失敗しました。パスワードが正しいか確認してください。");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const initiatePrintProcess = (action: () => void) => {
    const user = auth.currentUser;
    if (user && user.providerData.some(p => p.providerId === "google.com")) {
      setPendingPrintAction(() => action);
      setIsAuthModalOpen(true);
    } else {
      setPendingPrintAction(() => action);
      setIsAuthModalOpen(true);
    }
  };

  const togglePrintSelection = (userId: string) => {
    setSelectedForPrint(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleAllPrintSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const printableUsers = processedUsers.filter(u => u.accountStatus === "unaccessed");
      setSelectedForPrint(printableUsers.map(u => u.id));
    } else {
      setSelectedForPrint([]);
    }
  };

  const generatePDFs = async () => {
    if (printUsers.length === 0 || !schoolData) return;
    setIsPrinting(true);
    showAlert("success", "PDFの生成を開始しました。しばらくお待ちください...");

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const element = document.getElementById("account-sheet-template");

      if (element) {
        for (let i = 0; i < printUsers.length; i++) {
          const user = printUsers[i];
          setSheetUser(user);
          await new Promise(resolve => setTimeout(resolve, 100));
          const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
          const imgData = canvas.toDataURL("image/jpeg", 0.9);
          
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
        }
        pdf.save(`アカウント発行シート_${schoolData.name}.pdf`);
        showAlert("success", "PDFのダウンロードが完了しました。");
      }
    } catch (error) {
      console.error("PDF generation error:", error);
      showAlert("error", "PDFの生成に失敗しました。");
    } finally {
      setIsPrinting(false);
      setPrintUsers([]);
      setSheetUser(null);
    }
  };

  useEffect(() => {
    if (printUsers.length > 0) {
      generatePDFs();
    }
  }, [printUsers]);

  const handlePrintSelected = () => {
    if (selectedForPrint.length === 0) return;
    initiatePrintProcess(() => {
      const usersToPrint = users.filter(u => selectedForPrint.includes(u.id)) as ExtendedUserData[];
      setPrintUsers(usersToPrint);
      setSelectedForPrint([]);
    });
  };

  const executeDownloadCsv = () => {
    const headers = [
      "ID", "名前", "メールアドレス", "権限ロール", "アカウント状態", 
      "優先役職", "所属役職一覧", "システムID", "学籍・教職員番号", "フリガナ", 
      "性別", "生年月日", "所属", "学年", "組", "出席番号", 
      "部活動等", "出身校", "電話番号", "居住地"
    ].join(",");
    
    const rows = processedUsers.map(u => {
      const extU = u as ExtendedUserData;
      const posNames = (extU.positionIds || []).map(pid => positions.find(p => p.id === pid)?.name).filter(Boolean).join(" / ");
      return [
        extU.id, `"${extU.name || ""}"`, extU.email || "", extU.role || "", extU.accountStatus || "",
        `"${extU.positionName || ""}"`, `"${posNames}"`, `"${extU.systemId || ""}"`, `"${extU.studentId || ""}"`,
        `"${extU.nameKana || ""}"`, extU.gender || "", extU.birthDate || "", `"${extU.department || ""}"`,
        `"${extU.grade || ""}"`, `"${extU.classNumber || ""}"`, `"${extU.attendanceNumber || ""}"`,
        `"${extU.club || ""}"`, `"${extU.previousSchool || ""}"`, `"${extU.phoneNumber || ""}"`, `"${extU.organizationAddress || ""}"`
      ].join(",");
    });
    
    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `SCPS_Tenant_Users_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReauthWithPassword = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) return;
    setReauthModal(prev => ({ ...prev, isProcessing: true }));
    try {
      const cred = EmailAuthProvider.credential(user.email, reauthModal.password);
      await reauthenticateWithCredential(user, cred);
      setReauthModal({ show: false, password: "", isProcessing: false });
      executeDownloadCsv();
      showAlert("success", "セキュリティ認証に成功しました。ダウンロードを開始します。");
    } catch (e) {
      showAlert("error", "再認証に失敗しました。パスワードが正しいか確認してください。");
      setReauthModal(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const activeUsersCount = users.filter(u => u.accountStatus !== "pending").length;
  const pendingUsersCount = users.filter(u => u.accountStatus === "pending").length;

  const photoModalTargetUser = users.find(u => u.id === photoModalUserId) as ExtendedUserData | undefined;

  return (
    <div className="space-y-3 sm:space-y-4 animate-fade-in relative min-w-0">
      
      {/* 印刷用テンプレート */}
      {sheetUser && schoolData && (
        <AccountSheetTemplate 
          sheetUser={sheetUser} 
          schoolData={schoolData} 
          getRoleDisplayName={getRoleDisplayName} 
        />
      )}

      {/* UI確認モーダル */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-5 text-center border border-gray-100">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-xs font-black text-gray-900 mb-5 leading-relaxed whitespace-pre-wrap">{confirmModal.message}</h3>
            <div className="flex gap-2">
              <button onClick={() => setConfirmModal({ show: false, message: "", onConfirm: () => {} })} className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 text-[11px] sm:text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-2xs">
                キャンセル
              </button>
              <button onClick={() => { confirmModal.onConfirm(); setConfirmModal({ show: false, message: "", onConfirm: () => {} }); }} className="flex-1 py-2 bg-indigo-600 text-white text-[11px] sm:text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm transition-colors">
                実行する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSVアップロードモーダル */}
      {isCsvModalOpen && (
        <CsvUploadModal
          schoolData={schoolData}
          users={users}
          positions={positions}
          fetchUsers={fetchUsers}
          onClose={() => setIsCsvModalOpen(false)}
          showAlert={showAlert}
          onNavigateTab={onNavigateTab}
        />
      )}

      {selectedUserForDetails && (
        <UserDetailsModal
          user={selectedUserForDetails}
          schoolData={schoolData}
          positions={positions}
          onClose={() => setSelectedUserForDetails(null)}
          onUpdateUser={(updatedUser) => {
            setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser as UserData : u));
            setSelectedUserForDetails(updatedUser);
          }}
          showAlert={showAlert}
        />
      )}

      {photoModalUserId && photoModalTargetUser && (
        <ProfilePhotoModal
          user={photoModalTargetUser}
          onClose={() => setPhotoModalUserId(null)}
          onSuccess={(newUrl) => {
            setUsers(prev => prev.map(u => u.id === photoModalUserId ? { ...u, photoURL: newUrl } : u));
            setPhotoModalUserId(null);
          }}
          showAlert={showAlert}
        />
      )}

      {/* セキュリティ再認証モーダル (PDF/CSV書き出し用) */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-gray-100 p-5 sm:p-6 relative">
            <button onClick={() => { setIsAuthModalOpen(false); setAuthError(""); setAuthPassword(""); }} className="absolute top-3 right-3 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><X className="w-4 h-4 sm:w-5 sm:h-5"/></button>
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-red-100"><Lock className="w-6 h-6" /></div>
            <h3 className="text-sm sm:text-base font-black text-gray-900 text-center mb-1.5">本人確認が必要です</h3>
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 text-center mb-5 leading-relaxed">
              アカウント発行シートのPDF生成には個人情報が含まれるため、セキュリティのための再認証が必要です。
            </p>
            {auth.currentUser?.providerData.some(p => p.providerId === "google.com") ? (
               <div className="flex flex-col gap-2">
                 {authError && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-[9px] sm:text-[10px] font-bold text-red-700">{authError}</div>}
                 <button onClick={handleReauthenticate} disabled={isAuthenticating} className="w-full py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white text-[11px] sm:text-sm font-black rounded-xl shadow-md transition-colors flex items-center justify-center disabled:opacity-50">
                    {isAuthenticating ? <Loader2 className="w-4 h-4 animate-spin"/> : "Googleアカウントで再認証"}
                 </button>
               </div>
            ) : (
              <form onSubmit={handleReauthenticate} className="flex flex-col gap-3">
                {authError && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-[9px] sm:text-[10px] font-bold text-red-700">{authError}</div>}
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-bold text-gray-500 mb-1">現在のパスワード</label>
                  <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" placeholder="パスワードを入力..." />
                </div>
                <button type="submit" disabled={isAuthenticating || !authPassword} className="w-full py-2.5 sm:py-3 bg-gray-900 hover:bg-black text-white text-[11px] sm:text-sm font-black rounded-xl shadow-md transition-colors flex items-center justify-center disabled:opacity-50">
                  {isAuthenticating ? <Loader2 className="w-4 h-4 animate-spin"/> : "認証して処理を続行"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* エクスポート用再認証モーダル (CSV書き出し用) */}
      {reauthModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="text-[11px] sm:text-xs font-black text-gray-900 flex items-center"><Lock className="w-3.5 h-3.5 mr-1 text-red-600"/> セキュリティ確認</h3>
              <button onClick={() => setReauthModal({ show: false, password: "", isProcessing: false })} className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 transition-colors"><X className="w-3.5 h-3.5"/></button>
            </div>
            <div className="p-3 sm:p-4 space-y-3">
              <p className="text-[9px] sm:text-[10px] font-bold text-gray-600 leading-relaxed">全ユーザー情報を書き出すため、パスワードを入力してください。</p>
              <input type="password" placeholder="パスワードを入力" value={reauthModal.password} onChange={e => setReauthModal(p => ({...p, password: e.target.value}))} className="w-full border border-gray-300 rounded-xl px-3 py-1.5 sm:py-2 text-[16px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
              <button onClick={handleReauthWithPassword} disabled={reauthModal.isProcessing || !reauthModal.password} className="w-full py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] sm:text-xs font-bold transition-colors flex items-center justify-center shadow-sm disabled:opacity-50">
                {reauthModal.isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1"/> : <Unlock className="w-3.5 h-3.5 mr-1"/>} 認証してCSVダウンロード
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* メインUIヘッダー */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 sm:gap-3 border-b border-gray-200 pb-2.5 sm:pb-3">
        <div>
          <h3 className="text-sm sm:text-base font-black text-gray-900">ユーザーアカウント管理</h3>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 mt-0.5">システムを利用する全メンバーのアカウントを管理します。</p>
        </div>
        
        {canManageUsers && (
          <>
            <div className="hidden md:flex gap-1.5 sm:gap-2 w-full md:w-auto">
              <button onClick={() => setReauthModal({ show: true, password: "", isProcessing: false })} className="inline-flex items-center justify-center px-2.5 sm:px-3 py-1.5 border border-gray-300 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-2xs">
                <Download className="h-3.5 w-3.5 mr-1 text-gray-500" /> エクスポート
              </button>
              <button onClick={() => setIsCsvModalOpen(true)} className="inline-flex items-center justify-center px-2.5 sm:px-3 py-1.5 border border-transparent rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm">
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> CSV一括登録
              </button>
            </div>
            <div className="md:hidden w-full flex items-center justify-center py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-[9px] font-bold text-indigo-700">
              <MonitorSmartphone className="w-3 h-3 mr-1" /> ※ CSVの一括登録・出力はPCから操作してください
            </div>
          </>
        )}
      </div>

      <div className="bg-white shadow-2xs border border-gray-200 rounded-xl sm:rounded-2xl overflow-hidden min-w-0">
        
        {/* サブタブ */}
        <div className="border-b border-gray-200 bg-gray-50/50 overflow-x-auto custom-scrollbar">
          <nav className="flex px-1.5 sm:px-3" aria-label="Tabs">
            <button onClick={() => setActiveTab("active")} className={`whitespace-nowrap py-2.5 sm:py-3 px-2 sm:px-3 border-b-2 font-bold text-[11px] sm:text-xs transition-colors ${activeTab === "active" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              登録済みユーザー <span className="ml-1 bg-gray-200 text-gray-800 py-0.5 px-1.5 rounded-full text-[9px]">{activeUsersCount}</span>
            </button>
            <button onClick={() => setActiveTab("pending")} className={`whitespace-nowrap py-2.5 sm:py-3 px-2 sm:px-3 border-b-2 font-bold text-[11px] sm:text-xs transition-colors ${activeTab === "pending" ? "border-amber-600 text-amber-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              承認待ち <span className="ml-1 bg-amber-100 text-amber-800 py-0.5 px-1.5 rounded-full text-[9px]">{pendingUsersCount}</span>
            </button>
          </nav>
        </div>

        <div className="p-2 sm:p-3 space-y-2.5 sm:space-y-3 min-w-0">
          
          {/* 検索・フィルターエリア */}
          <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" placeholder="名前・メアドで検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="block w-full pl-7 sm:pl-8 pr-2.5 py-1.5 border border-gray-200 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors shadow-2xs" />
            </div>
            
            {activeTab === "active" && (
              <div className="flex flex-wrap gap-1.5 w-full sm:w-auto mt-1 sm:mt-0">
                <div className="flex-1 min-w-[95px] sm:w-28">
                  <CustomSelect 
                    value={filterRole} 
                    onChange={setFilterRole} 
                    options={[
                      { value: "all", label: "全権限" },
                      { value: "admin", label: "管理者" },
                      { value: "officer", label: "役員" },
                      { value: "teacher", label: "教職員" },
                      { value: "student", label: "生徒" }
                    ]}
                    buttonClassName="w-full border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-[10px] sm:text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  />
                </div>
                <div className="flex-1 min-w-[95px] sm:w-32">
                  <CustomSelect 
                    value={filterAccountStatus} 
                    onChange={setFilterAccountStatus} 
                    options={[
                      { value: "all", label: "全ステータス" },
                      { value: "active", label: "アクティブ" },
                      { value: "unaccessed", label: "未アクセス" },
                      { value: "rejected", label: "停止中" }
                    ]}
                    buttonClassName="w-full border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-[10px] sm:text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  />
                </div>
              </div>
            )}
          </div>
          
          {activeTab === "active" && filterAccountStatus === "unaccessed" && selectedForPrint.length > 0 && (
            <div className="flex justify-end animate-fade-in">
              <button 
                onClick={handlePrintSelected}
                disabled={isPrinting}
                className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-900 hover:bg-black text-white text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isPrinting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
                選択した {selectedForPrint.length} 名のシートを発行
              </button>
            </div>
          )}

          {/* コンパクト高密度テーブル */}
          <div className="overflow-x-auto border border-gray-200 rounded-lg sm:rounded-xl relative custom-scrollbar">
            
            {isPrinting && (
              <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center">
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 animate-spin mb-1" />
                <span className="text-[10px] sm:text-[11px] font-bold text-indigo-900">アカウントシート作成中...</span>
              </div>
            )}

            <table className="min-w-full divide-y divide-gray-200 text-left whitespace-nowrap">
              <thead className="bg-gray-50 text-[9px] sm:text-[10px] font-black text-gray-500">
                <tr>
                  {activeTab === "active" && filterAccountStatus === "unaccessed" && (
                    <th scope="col" className="px-2 sm:px-3 py-2 sm:py-2.5 w-8 sm:w-10 text-center border-r border-gray-100">
                      <input 
                        type="checkbox" 
                        checked={selectedForPrint.length === processedUsers.length && processedUsers.length > 0}
                        onChange={toggleAllPrintSelection}
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 rounded cursor-pointer focus:ring-indigo-500"
                      />
                    </th>
                  )}
                  <th scope="col" onClick={() => requestSort('systemId')} className="px-2 sm:px-3 py-2 sm:py-2.5 cursor-pointer hover:bg-gray-100 group w-16 sm:w-20 border-r border-gray-100">
                    <div className="flex items-center gap-0.5">利用番号 <ArrowUpDown className="w-2.5 h-2.5 text-gray-400"/></div>
                  </th>
                  <th scope="col" onClick={() => requestSort('name')} className="px-2 sm:px-3 py-2 sm:py-2.5 cursor-pointer hover:bg-gray-100 group border-r border-gray-100">
                    <div className="flex items-center gap-0.5">名前 / メールアドレス <ArrowUpDown className="w-2.5 h-2.5 text-gray-400"/></div>
                  </th>
                  <th scope="col" className="px-2 sm:px-3 py-2 sm:py-2.5 border-r border-gray-100">所属役職情報</th>
                  <th scope="col" onClick={() => requestSort('role')} className="px-2 sm:px-3 py-2 sm:py-2.5 cursor-pointer hover:bg-gray-100 group w-16 sm:w-20 border-r border-gray-100">
                    <div className="flex items-center gap-0.5">権限 <ArrowUpDown className="w-2.5 h-2.5 text-gray-400"/></div>
                  </th>
                  <th scope="col" onClick={() => requestSort('accountStatus')} className="px-2 sm:px-3 py-2 sm:py-2.5 cursor-pointer hover:bg-gray-100 group w-16 sm:w-20 border-r border-gray-100">
                    <div className="flex items-center gap-0.5">状態 <ArrowUpDown className="w-2.5 h-2.5 text-gray-400"/></div>
                  </th>
                  <th scope="col" className="px-2 sm:px-3 py-2 sm:py-2.5 text-right w-20 sm:w-24">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 text-[11px] sm:text-xs font-bold">
                {processedUsers.map((user) => {
                  const extU = user as ExtendedUserData;
                  const leaderPos = positions.filter(p => p.leaderUserId === user.id);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50/70 transition-colors">
                      {activeTab === "active" && filterAccountStatus === "unaccessed" && (
                        <td className="px-2 sm:px-3 py-2 text-center border-r border-gray-100">
                          <input 
                            type="checkbox" 
                            checked={selectedForPrint.includes(user.id)}
                            onChange={() => togglePrintSelection(user.id)}
                            className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 rounded cursor-pointer focus:ring-indigo-500"
                          />
                        </td>
                      )}
                      
                      <td className="px-2 sm:px-3 py-2 font-mono text-[9px] sm:text-[10px] text-gray-500 border-r border-gray-100">
                        {extU.systemId || "-"}
                      </td>

                      <td className="px-2 sm:px-3 py-2 border-r border-gray-100">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-200">
                            {extU.photoURL ? (
                              <img src={extU.photoURL} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="text-[11px] sm:text-xs font-black text-gray-900 flex items-center gap-1 truncate">
                              {user.name} 
                              {user.id === currentUser?.id && <span className="text-[7px] sm:text-[8px] font-bold text-blue-600 bg-blue-50 px-1 py-0.5 rounded border border-blue-200">自</span>}
                              {(user as any).isITManager && <span className="text-[7px] sm:text-[8px] font-bold text-purple-600 bg-purple-50 px-1 py-0.5 rounded border border-purple-200">IT</span>}
                            </div>
                            <div className="text-[8px] sm:text-[9px] text-gray-400 font-normal truncate max-w-[120px] sm:max-w-none">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-2 sm:px-3 py-2 border-r border-gray-100">
                        <div className="flex items-center flex-wrap gap-1">
                          {user.positionName ? (
                            <span className="text-[8px] sm:text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded flex items-center gap-0.5 truncate max-w-[100px] sm:max-w-none">
                              {user.positionName}
                              {leaderPos.some(lp => lp.id === user.primaryPositionId) && <Star className="w-2 h-2 fill-amber-500 text-amber-500 ml-0.5"/>}
                            </span>
                          ) : <span className="text-[8px] sm:text-[9px] text-gray-400 font-normal">なし</span>}

                          {extU.positionIds && extU.positionIds.length > 1 && (
                            <span className="text-[7px] sm:text-[8px] text-gray-500 bg-gray-100 px-1 py-0.5 rounded border border-gray-200">
                              他 {extU.positionIds.length - 1}件
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-2 sm:px-3 py-2 border-r border-gray-100">
                        <span className={`px-1.5 py-0.5 inline-flex text-[8px] sm:text-[9px] font-black rounded ${
                          user.role === 'admin' ? 'bg-red-50 text-red-700 border border-red-200' : 
                          user.role === 'officer' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 
                          user.role === 'teacher' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 
                          'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}>
                          {getRoleDisplayName(user.role)}
                        </span>
                      </td>

                      <td className="px-2 sm:px-3 py-2 border-r border-gray-100">
                        {user.accountStatus === 'active' ? <span className="text-[8px] sm:text-[9px] font-black text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded inline-flex items-center"><CheckCircle2 className="w-2 h-2 mr-0.5"/> 有効</span> :
                         user.accountStatus === 'unaccessed' ? <span className="text-[8px] sm:text-[9px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">未アクセス</span> :
                         user.accountStatus === 'rejected' ? <span className="text-[8px] sm:text-[9px] font-black text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded inline-flex items-center"><XCircle className="w-2 h-2 mr-0.5"/> 停止</span> :
                         <span className="text-[8px] sm:text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">承認待ち</span>}
                      </td>

                      <td className="px-2 sm:px-3 py-2 text-right">
                        {canManageUsers ? (
                          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                            
                            <button onClick={() => generateAccountSheet(extU)} className="p-1 sm:p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors shadow-2xs" title="アカウントシート(PDF)を出力">
                              <Printer className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
                            </button>

                            <button onClick={() => requestReissuePassword(extU)} className="p-1 sm:p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors shadow-2xs" title="初期パスワードを再発行(リセット)">
                              <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
                            </button>

                            <button onClick={() => requestPasswordResetMail(user.email)} disabled={resettingEmails.includes(user.email)} className="p-1 sm:p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors shadow-2xs disabled:opacity-30" title="パスワード再設定メールを通知配信">
                              {resettingEmails.includes(user.email) ? <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin"/> : <Mail className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>}
                            </button>

                            <button onClick={() => setSelectedUserForDetails(extU)} className="p-1 sm:p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors ml-0.5 sm:ml-1 shadow-2xs" title="詳細プロフィール編集">
                              <Edit3 className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
                            </button>

                            <button onClick={() => setPhotoModalUserId(user.id)} className="p-1 sm:p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors shadow-2xs" title="プロフィール写真設定">
                                <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
                            </button>

                            {activeTab === "pending" && (
                              <button onClick={() => handleAccountStatusChange(user.id, "active")} className="p-1 sm:p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded shadow-2xs" title="承認する">
                                <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
                              </button>
                            )}
                            
                            {activeTab === "active" && (user.accountStatus === "active" || user.accountStatus === "unaccessed") && user.id !== currentUser?.id && (
                              <button onClick={() => handleAccountStatusChange(user.id, "rejected")} className="p-1 sm:p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded shadow-2xs" title="アカウントを停止する">
                                <UserX className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
                              </button>
                            )}
                            
                            {activeTab === "active" && user.accountStatus === "rejected" && (
                              <button onClick={() => {
                                const restoreStatus = extU.previousAccountStatus || (extU.initialPassword ? "unaccessed" : "active");
                                handleAccountStatusChange(user.id, restoreStatus);
                              }} className="p-1 sm:p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded shadow-2xs" title="アカウントを復旧する">
                                <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[8px] sm:text-[9px] text-gray-400">閲覧のみ</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {processedUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[10px] sm:text-xs text-gray-400">
                      条件に一致するユーザーが見つかりません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}