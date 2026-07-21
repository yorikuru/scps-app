"use client";

import React, { useState, useMemo, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { 
  Search, Loader2, FileSpreadsheet, Printer, Key, Eye, ArrowUpDown, FileText, CheckCircle2, XCircle
} from "lucide-react";
import { UserData, SchoolData } from "../page";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import CsvUploadModal from "./CsvUploadModal";
import UserDetailsModal from "./UserDetailsModal";

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
  // ★ 個別MFA設定用プロパティ
  useCustomMfaPolicy?: boolean;
  mfaPolicies?: {
    email: MfaPolicy;
    totp: MfaPolicy;
    passkey: MfaPolicy;
  };
};

type Props = {
  users: UserData[];
  setUsers: (users: UserData[]) => void;
  schoolData: SchoolData | null;
  fetchUsers: (schoolId: string) => Promise<void>;
  showAlert: (type: "success" | "error", message: string) => void;
};

export default function UserManagement({ users, setUsers, schoolData, fetchUsers, showAlert }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  // ★ デフォルトのソート順をシステム利用番号(systemId)の昇順に設定
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'systemId', direction: 'asc' });
  
  const [selectedUserDetails, setSelectedUserDetails] = useState<ExtendedUserData | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [printTargets, setPrintTargets] = useState<ExtendedUserData[]>([]);
  const [loginUrl, setLoginUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLoginUrl(`${window.location.origin}/login`);
    }
  }, []);

  const handleAccountStatusChange = async (userId: string, newStatus: "active" | "rejected") => {
    try {
      const user = users.find(u => u.id === userId) as ExtendedUserData;
      let targetStatus: "active" | "rejected" | "unaccessed" | "pending" = newStatus;
      if (newStatus === "active" && user && (!user.authProviders || user.authProviders.length === 0)) {
        targetStatus = "unaccessed";
      }
      await updateDoc(doc(db, "users", userId), { accountStatus: targetStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, accountStatus: targetStatus } : u));
      showAlert("success", "アカウントのステータスを更新しました。");
    } catch (error) {
      showAlert("error", "ステータスの更新に失敗しました。");
    }
  };

  const handlePasswordReset = async (email: string) => {
    if (!email) {
      showAlert("error", "メールアドレスが登録されていないため、リセットメールを送信できません。");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showAlert("success", `${email} 宛にパスワードリセットメールを送信しました。`);
    } catch (error) {
      showAlert("error", "パスワードリセットメールの送信に失敗しました。");
    }
  };

  const handlePrint = (targets: ExtendedUserData[]) => setPrintTargets(targets);

useEffect(() => {
    const generatePDF = async () => {
      if (printTargets.length === 0) return;
      setIsGeneratingPDF(true);
      const pdf = new jsPDF("p", "mm", "a4");
      
      try {
        for (let i = 0; i < printTargets.length; i++) {
          const user = printTargets[i];
          const element = document.getElementById(`print-sheet-${user.id}`);
          if (element) {
            element.style.display = "block";
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
            element.style.display = "none";
            const imgData = canvas.toDataURL("image/png");
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, "PNG", 0, 0, 210, 297);
          }
        }

        // ダウンロードファイル名の動的生成
        let fileName = "account_sheets_一括出力.pdf";
        if (printTargets.length === 1) {
          const target = printTargets[0];
          const systemIdStr = target.systemId ? `_${target.systemId}` : "";
          const nameStr = target.name ? `_${target.name} 様` : "";
          fileName = `account_sheet${systemIdStr}${nameStr}.pdf`;
        }

        pdf.save(fileName);
        showAlert("success", "PDFをダウンロードしました。");
      } catch (err) {
        showAlert("error", "PDFの生成に失敗しました。");
      } finally {
        setIsGeneratingPDF(false);
        setPrintTargets([]);
      }
    };

    if (printTargets.length > 0) setTimeout(() => generatePDF(), 500);
  }, [printTargets]);


  const processedUsers = useMemo(() => {
    let result = [...(users as ExtendedUserData[])];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => u.name.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q)) || (u.systemId && u.systemId.toLowerCase().includes(q)));
    }
    if (filterRole !== "all") result = result.filter(u => u.role === filterRole);
    if (filterStatus !== "all") result = result.filter(u => u.accountStatus === filterStatus);
    if (sortConfig !== null) {
      result.sort((a, b) => {
        const valA = (a as any)[sortConfig.key] || "";
        const valB = (b as any)[sortConfig.key] || "";
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [users, searchQuery, filterRole, filterStatus, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  return (
    <div className="space-y-6">
      {isGeneratingPDF && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black bg-opacity-80 text-white animate-in fade-in">
          <Loader2 className="animate-spin h-12 w-12 mb-4 text-blue-500" />
          <p className="font-bold text-lg">PDFを作成しています...</p>
          <p className="text-sm mt-2 text-gray-300">人数が多い場合は数十秒かかることがあります</p>
        </div>
      )}

{/* PDF非表示出力エリア（A4サイズ1ページに美しく収まる絶妙なバランス調整版） */}
<div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        {printTargets.map((user) => (
          <div key={user.id} id={`print-sheet-${user.id}`} style={{ display: "none", width: "210mm", height: "297mm", backgroundColor: "#ffffff", padding: "32px 36px", boxSizing: "border-box", fontFamily: "sans-serif", color: "#111827", overflow: "hidden" }}>
            
            {/* ヘッダー（ロゴ入り） */}
            <div style={{ borderBottom: "2.5px solid #1f2937", paddingBottom: "14px", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <div style={{ position: "absolute", left: "4px", display: "flex", alignItems: "center" }}>
                <img 
                  src="/icon.png" 
                  alt="Logo" 
                  crossOrigin="anonymous" 
                  style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover", border: "2px solid #1f2937", backgroundColor: "#f3f4f6" }} 
                />
              </div>
              <div style={{ textAlign: "center" }}>
                <h1 style={{ fontSize: "25px", fontWeight: "900", margin: "0", letterSpacing: "1px" }}>システムアカウント 発行シート</h1>
                <p style={{ fontSize: "11px", color: "#ef4444", fontWeight: "bold", margin: "6px 0 0 0" }}>※ログインに必要な個人情報を含みます。紛失しないよう大切に保管してください。</p>
              </div>
            </div>
            
            {/* 所属情報セクション */}
            <div style={{ marginBottom: "18px", backgroundColor: "#f9fafb", padding: "18px 22px", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
              <h2 style={{ fontSize: "15px", fontWeight: "bold", color: "#374151", marginBottom: "12px", borderBottom: "1px solid #e5e7eb", paddingBottom: "6px", marginTop: 0 }}>所属情報</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 18px" }}>
                <div style={{ width: "100%", marginBottom: "2px" }}>
                  <span style={{ fontSize: "11px", color: "#6b7280", display: "block" }}>テナント名 (学校名)</span>
                  <span style={{ fontSize: "18px", fontWeight: "900" }}>{schoolData?.name}</span>
                </div>
                <div style={{ width: "100%", marginBottom: "4px", borderTop: "1px dashed #d1d5db", paddingTop: "12px" }}>
                  <span style={{ fontSize: "12px", color: "#6b7280", display: "block", marginBottom: "2px" }}>氏名</span>
                  <span style={{ fontSize: "28px", fontWeight: "900", letterSpacing: "1px" }}>{user.name}</span>
                  <span style={{ fontSize: "14px", color: "#6b7280", marginLeft: "10px" }}>{user.nameKana}</span>
                </div>
                <div style={{ width: "30%" }}><span style={{ fontSize: "11px", color: "#6b7280", display: "block" }}>システム権限</span><span style={{ fontSize: "14px", fontWeight: "bold" }}>{user.role === "admin" ? "管理者" : user.role === "officer" ? "役員" : "一般生徒"}</span></div>
                <div style={{ width: "30%" }}><span style={{ fontSize: "11px", color: "#6b7280", display: "block" }}>役職</span><span style={{ fontSize: "14px", fontWeight: "bold" }}>{user.positionName || "未設定"}</span></div>
                <div style={{ width: "30%" }}><span style={{ fontSize: "11px", color: "#6b7280", display: "block" }}>学籍番号</span><span style={{ fontSize: "14px", fontWeight: "bold" }}>{user.studentId || "未設定"}</span></div>
                <div style={{ width: "30%" }}><span style={{ fontSize: "11px", color: "#6b7280", display: "block" }}>学年/クラス</span><span style={{ fontSize: "14px", fontWeight: "bold" }}>{user.grade ? `${user.grade}年` : ""}{user.classNumber ? `${user.classNumber}組` : "未設定"}</span></div>
                <div style={{ width: "30%" }}><span style={{ fontSize: "11px", color: "#6b7280", display: "block" }}>所属部署・委員会</span><span style={{ fontSize: "14px", fontWeight: "bold" }}>{user.department || "未設定"}</span></div>
                <div style={{ width: "30%" }}><span style={{ fontSize: "11px", color: "#6b7280", display: "block" }}>部活動</span><span style={{ fontSize: "14px", fontWeight: "bold" }}>{user.club || "未設定"}</span></div>
              </div>
            </div>

            {/* ログイン情報セクション */}
            <div style={{ marginBottom: "18px", backgroundColor: "#eff6ff", padding: "20px 22px", borderRadius: "10px", border: "1.5px solid #bfdbfe" }}>
              <h2 style={{ fontSize: "16px", fontWeight: "900", color: "#1e3a8a", marginBottom: "14px", borderBottom: "1px solid #bfdbfe", paddingBottom: "8px", marginTop: 0 }}>ログイン情報</h2>
              
              <div style={{ display: "flex", gap: "18px", marginBottom: "14px" }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: "12px", fontWeight: "bold", color: "#1d4ed8", display: "block", marginBottom: "5px" }}>① テナントID (組織コード)</span>
                  <div style={{ backgroundColor: "#ffffff", padding: "10px 14px", border: "1.5px solid #93c5fd", borderRadius: "6px", fontSize: "18px", fontWeight: "bold", fontFamily: "monospace", letterSpacing: "1px", textAlign: "center" }}>
                    {schoolData?.schoolCode}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: "12px", fontWeight: "bold", color: "#1d4ed8", display: "block", marginBottom: "5px" }}>② システム利用番号</span>
                  <div style={{ backgroundColor: "#ffffff", padding: "10px 14px", border: "1.5px solid #93c5fd", borderRadius: "6px", fontSize: "18px", fontWeight: "bold", fontFamily: "monospace", letterSpacing: "1px", textAlign: "center" }}>
                    {user.systemId || "未発行"}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "#1d4ed8", display: "block", marginBottom: "5px" }}>③ 初期パスワード</span>
                <div style={{ backgroundColor: "#ffffff", padding: "12px 16px", border: "1.5px solid #93c5fd", borderRadius: "6px", fontSize: "24px", fontWeight: "900", fontFamily: "monospace", letterSpacing: "3px", textAlign: "center" }}>
                  {user.initialPassword || "パスワード設定済み"}
                </div>
                {user.initialPassword && <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "5px", textAlign: "center", fontWeight: "bold" }}>※初回ログイン後に必ず新しいパスワードに変更してください。</p>}
              </div>

              <div style={{ borderTop: "1px dashed #bfdbfe", paddingTop: "12px", display: "flex", justifyContent: "space-between" }}>
                <div style={{ width: "48%" }}>
                  <span style={{ fontSize: "11px", color: "#3b82f6", display: "block", fontWeight: "bold" }}>アカウント有効期限</span>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#1e3a8a" }}>
                    {user.accountValidStartDate && user.accountValidEndDate ? `${user.accountValidStartDate} 〜 ${user.accountValidEndDate}` : "無期限"}
                  </span>
                </div>
                <div style={{ width: "48%" }}>
                  <span style={{ fontSize: "11px", color: "#3b82f6", display: "block", fontWeight: "bold" }}>外部連携ログイン</span>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#1e3a8a" }}>
                    {schoolData?.allowedAuthProviders?.includes("google") ? "Google " : ""}{schoolData?.allowedAuthProviders?.includes("microsoft") ? "Microsoft " : ""}{(!schoolData?.allowedAuthProviders?.includes("google") && !schoolData?.allowedAuthProviders?.includes("microsoft")) ? "許可なし" : "連携可"}
                  </span>
                </div>
              </div>
            </div>

            {/* ログインURL・QRコードセクション */}
            <div style={{ display: "flex", alignItems: "center", backgroundColor: "#f9fafb", padding: "18px 22px", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
              <div style={{ marginRight: "22px", padding: "10px", backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb", flexShrink: 0 }}>
                {loginUrl && <QRCodeSVG value={loginUrl} size={95} level="H" />}
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#111827", margin: "0 0 5px 0" }}>ログイン専用URL</h3>
                <p style={{ fontSize: "12px", color: "#4b5563", margin: "0 0 8px 0", lineHeight: "1.4" }}>
                  スマートフォンやPCから左のQRコードを読み取るか、<br/>以下のURLにアクセスしてください。
                </p>
                <div style={{ backgroundColor: "#ffffff", padding: "8px 14px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px", fontWeight: "bold", fontFamily: "monospace", color: "#2563eb", display: "inline-block" }}>
                  {loginUrl}
                </div>
              </div>
            </div>

          </div>
        ))}
      </div>

      {isCsvModalOpen && <CsvUploadModal schoolData={schoolData} users={users} fetchUsers={fetchUsers} showAlert={showAlert} onClose={() => setIsCsvModalOpen(false)} />}
      
      {selectedUserDetails && (
        <UserDetailsModal 
          user={selectedUserDetails} 
          schoolData={schoolData}
          onClose={() => setSelectedUserDetails(null)} 
          showAlert={showAlert} 
          onUpdateUser={(updated) => {
            setUsers(users.map(u => u.id === updated.id ? updated : u));
            setSelectedUserDetails(updated);
          }} 
        />
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-extrabold text-gray-900">ユーザー管理</h3>
          <p className="text-sm text-gray-500 mt-1">テナントに所属するすべてのアカウントを管理します。</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {selectedUserIds.size > 0 && (
            <button onClick={() => handlePrint(processedUsers.filter(u => selectedUserIds.has(u.id)))} disabled={isGeneratingPDF} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-bold hover:bg-blue-700 shadow-sm transition-colors animate-fade-in disabled:opacity-50">
              {isGeneratingPDF ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />} 
              選択中({selectedUserIds.size}件)のシート出力 (PDF)
            </button>
          )}
          <button onClick={() => setIsCsvModalOpen(true)} className="flex items-center px-4 py-2 bg-gray-900 border border-transparent rounded-md text-sm font-bold text-white hover:bg-gray-800 shadow-sm transition-colors">
            <FileSpreadsheet className="h-4 w-4 mr-2" /> CSV一括登録 / 更新
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-gray-500 mb-1">キーワード検索</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="名前、メール、利用番号..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 w-full" />
          </div>
        </div>
        <div className="w-full md:w-36">
          <label className="block text-xs font-bold text-gray-500 mb-1">権限</label>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="w-full py-2 px-3 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500">
            <option value="all">すべて</option>
            <option value="admin">管理者</option>
            <option value="officer">役員</option>
            <option value="student">生徒</option>
          </select>
        </div>
        <div className="w-full md:w-36">
          <label className="block text-xs font-bold text-gray-500 mb-1">ステータス</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full py-2 px-3 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500">
            <option value="all">すべて</option>
            <option value="active">有効</option>
            <option value="unaccessed">未アクセス</option>
            <option value="pending">承認待ち</option>
            <option value="rejected">停止/却下</option>
          </select>
        </div>
      </div>

      <div className="bg-white shadow rounded-xl overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 select-none">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" checked={selectedUserIds.size === processedUsers.length && processedUsers.length > 0} onChange={() => {
                    if (selectedUserIds.size === processedUsers.length) setSelectedUserIds(new Set());
                    else setSelectedUserIds(new Set(processedUsers.map(u => u.id)));
                  }} className="h-4 w-4 text-blue-600 rounded cursor-pointer" />
                </th>
                <th onClick={() => requestSort('name')} className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">ユーザー情報 {sortConfig?.key === 'name' && <ArrowUpDown className="inline h-3 w-3 ml-1" />}</th>
                <th onClick={() => requestSort('systemId')} className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">利用番号 {sortConfig?.key === 'systemId' && <ArrowUpDown className="inline h-3 w-3 ml-1" />}</th>
                <th onClick={() => requestSort('role')} className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">権限・役職 {sortConfig?.key === 'role' && <ArrowUpDown className="inline h-3 w-3 ml-1" />}</th>
                <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">MFA設定</th>
                <th onClick={() => requestSort('accountStatus')} className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">状態 {sortConfig?.key === 'accountStatus' && <ArrowUpDown className="inline h-3 w-3 ml-1" />}</th>
                <th className="px-6 py-3 text-right text-xs font-extrabold text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {processedUsers.map((user) => (
                <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${selectedUserIds.has(user.id) ? "bg-blue-50/20" : ""}`}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input type="checkbox" checked={selectedUserIds.has(user.id)} onChange={() => {
                      const newSet = new Set(selectedUserIds);
                      if (newSet.has(user.id)) newSet.delete(user.id);
                      else newSet.add(user.id);
                      setSelectedUserIds(newSet);
                    }} className="h-4 w-4 text-blue-600 rounded cursor-pointer" />
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900 flex items-center gap-2">{user.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{user.email || "メール未登録"}</div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="text-sm font-mono font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-md inline-block border border-gray-200">{(user as ExtendedUserData).systemId || "未設定"}</div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{user.role === "admin" ? "管理者" : user.role === "officer" ? "生徒会役員" : "一般生徒"}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{user.positionName || "役職なし"}</div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    {user.useCustomMfaPolicy ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">個別設定</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">組織準拠</span>
                    )}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm border ${user.accountStatus === "active" ? "bg-green-50 text-green-700 border-green-200" : user.accountStatus === "unaccessed" ? "bg-purple-50 text-purple-700 border-purple-200" : user.accountStatus === "pending" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                      {user.accountStatus === "active" ? "有効" : user.accountStatus === "unaccessed" ? "未アクセス" : user.accountStatus === "pending" ? "承認待ち" : "停止・却下"}
                    </span>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2 items-center">
                      <button onClick={() => setSelectedUserDetails(user as ExtendedUserData)} className="text-gray-600 hover:text-gray-900 font-bold bg-white border border-gray-300 hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center"><Eye className="h-3 w-3 mr-1" /> 詳細</button>
                      {user.accountStatus === "unaccessed" ? (
                        <button onClick={() => handlePrint([user as ExtendedUserData])} className="text-blue-700 hover:text-blue-900 font-bold bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center"><FileText className="h-3 w-3 mr-1" /> シート出力</button>
                      ) : (
                        <button onClick={() => handlePasswordReset(user.email)} className="text-yellow-700 hover:text-yellow-900 font-bold bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center"><Key className="h-3 w-3 mr-1" /> PASS 変更</button>
                      )}
                      
                      <div className="flex gap-1 border-l border-gray-200 pl-2 ml-1 items-center">
                        {user.accountStatus === "pending" && (
                          <button onClick={() => handleAccountStatusChange(user.id, "active")} className="text-green-700 hover:text-green-900 font-bold bg-green-50 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center text-sm">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> 承認
                          </button>
                        )}
                        {(user.accountStatus === "active" || user.accountStatus === "unaccessed") && user.role !== "system_admin" && (
                          <button onClick={() => handleAccountStatusChange(user.id, "rejected")} className="text-red-700 hover:text-red-900 font-bold bg-red-50 border border-red-200 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center text-sm">
                            <XCircle className="h-3 w-3 mr-1" /> 停止
                          </button>
                        )}
                        {user.accountStatus === "rejected" && (
                          <button onClick={() => handleAccountStatusChange(user.id, "active")} className="text-green-700 hover:text-green-900 font-bold bg-green-50 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center text-sm">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> 復旧
                          </button>
                        )}
                      </div>                    </div>
                  </td>
                </tr>
              ))}
              {processedUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                    <Search className="h-8 w-8 text-gray-300 mx-auto mb-3" />条件に一致するユーザーが見つかりません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}