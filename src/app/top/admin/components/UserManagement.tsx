"use client";

import React, { useState, useMemo, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { 
  Search, Loader2, FileSpreadsheet, Printer, Key, Eye, ArrowUpDown, FileText
} from "lucide-react";
import { UserData, SchoolData } from "../page";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import CsvUploadModal from "./CsvUploadModal";
import UserDetailsModal from "./UserDetailsModal";

type ExtendedUserData = UserData & {
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
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  
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
        pdf.save("account_sheets.pdf");
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
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black bg-opacity-80 text-white">
          <Loader2 className="animate-spin h-12 w-12 mb-4 text-blue-500" />
          <p className="font-bold text-lg">PDFを作成しています...</p>
          <p className="text-sm mt-2 text-gray-300">人数が多い場合は数十秒かかることがあります</p>
        </div>
      )}

      {/* PDF非表示出力エリア */}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        {printTargets.map((user) => (
          <div key={user.id} id={`print-sheet-${user.id}`} style={{ display: "none", width: "210mm", height: "297mm", backgroundColor: "#ffffff", padding: "40px", boxSizing: "border-box", fontFamily: "sans-serif", color: "#111827" }}>
            <div style={{ borderBottom: "2px solid #1f2937", paddingBottom: "16px", marginBottom: "32px", textAlign: "center" }}>
              <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: "0" }}>生徒会ポータルシステム システムアカウント発行シート</h1>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: "8px 0 0 0" }}>個人情報を含みますので 大切に保管してください</p>
            </div>
            <div style={{ marginBottom: "32px", backgroundColor: "#f9fafb", padding: "24px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#1f2937", marginBottom: "16px", borderBottom: "1px solid #e5e7eb", paddingBottom: "8px", marginTop: 0 }}>所属情報</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                <div style={{ width: "45%" }}><span style={{ fontSize: "12px", color: "#6b7280", display: "block" }}>テナント名 (学校名)</span><span style={{ fontSize: "16px", fontWeight: "bold" }}>{schoolData?.name}</span></div>
                <div style={{ width: "45%" }}><span style={{ fontSize: "12px", color: "#6b7280", display: "block" }}>テナントID</span><span style={{ fontSize: "16px", fontWeight: "bold", fontFamily: "monospace" }}>{schoolData?.schoolCode}</span></div>
                <div style={{ width: "45%" }}><span style={{ fontSize: "12px", color: "#6b7280", display: "block" }}>氏名</span><span style={{ fontSize: "20px", fontWeight: "bold" }}>{user.name}</span><span style={{ fontSize: "14px", color: "#6b7280", marginLeft: "8px" }}>{user.nameKana}</span></div>
                <div style={{ width: "45%" }}><span style={{ fontSize: "12px", color: "#6b7280", display: "block" }}>権限</span><span style={{ fontSize: "16px", fontWeight: "bold" }}>{user.role === "admin" ? "管理者" : user.role === "officer" ? "役員" : "生徒"}</span></div>
              </div>
            </div>
            <div style={{ marginBottom: "32px", backgroundColor: "#eff6ff", padding: "24px", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#1e3a8a", marginBottom: "16px", borderBottom: "1px solid #bfdbfe", paddingBottom: "8px", marginTop: 0 }}>ログイン情報</h2>
              <div style={{ marginBottom: "16px" }}><span style={{ fontSize: "12px", fontWeight: "bold", color: "#1d4ed8", display: "block", marginBottom: "4px" }}>システム利用番号</span><div style={{ backgroundColor: "#ffffff", padding: "12px 16px", border: "1px solid #93c5fd", borderRadius: "4px", fontSize: "24px", fontWeight: "bold", fontFamily: "monospace", letterSpacing: "2px" }}>{user.systemId}</div></div>
              <div style={{ marginBottom: "16px" }}><span style={{ fontSize: "12px", fontWeight: "bold", color: "#1d4ed8", display: "block", marginBottom: "4px" }}>初期パスワード</span><div style={{ backgroundColor: "#ffffff", padding: "12px 16px", border: "1px solid #93c5fd", borderRadius: "4px", fontSize: "24px", fontWeight: "bold", fontFamily: "monospace", letterSpacing: "2px" }}>{user.initialPassword || "未設定"}</div></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", backgroundColor: "#f9fafb", padding: "24px", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "32px" }}>
              <div style={{ marginRight: "32px" }}>{loginUrl && <QRCodeSVG value={loginUrl} size={100} level="M" />}</div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#111827", margin: "0 0 8px 0" }}>ログインURL</h3>
                <p style={{ fontSize: "12px", color: "#4b5563", margin: "0 0 8px 0" }}>スマートフォン・PCから以下のURLまたはQRコードでアクセスしてください。</p>
                <div style={{ backgroundColor: "#ffffff", padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "14px", fontWeight: "bold", fontFamily: "monospace", color: "#2563eb" }}>{loginUrl}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isCsvModalOpen && <CsvUploadModal schoolData={schoolData} users={users} fetchUsers={fetchUsers} showAlert={showAlert} onClose={() => setIsCsvModalOpen(false)} />}
      
      {selectedUserDetails && (
        <UserDetailsModal 
          user={selectedUserDetails} 
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
        <div className="w-full md:w-48">
          <label className="block text-xs font-bold text-gray-500 mb-1">権限</label>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="w-full py-2 px-3 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500">
            <option value="all">すべて</option>
            <option value="admin">管理者</option>
            <option value="officer">役員</option>
            <option value="student">生徒</option>
          </select>
        </div>
        <div className="w-full md:w-48">
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
                <th onClick={() => requestSort('systemId')} className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">システム利用番号 {sortConfig?.key === 'systemId' && <ArrowUpDown className="inline h-3 w-3 ml-1" />}</th>
                <th onClick={() => requestSort('role')} className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">権限・役職 {sortConfig?.key === 'role' && <ArrowUpDown className="inline h-3 w-3 ml-1" />}</th>
                <th onClick={() => requestSort('accountStatus')} className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">ステータス {sortConfig?.key === 'accountStatus' && <ArrowUpDown className="inline h-3 w-3 ml-1" />}</th>
                <th className="px-6 py-3 text-right text-xs font-extrabold text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {processedUsers.map((user) => (
                <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${selectedUserIds.has(user.id) ? "bg-blue-50/20" : ""}`}>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <input type="checkbox" checked={selectedUserIds.has(user.id)} onChange={() => {
                      const newSet = new Set(selectedUserIds);
                      if (newSet.has(user.id)) newSet.delete(user.id);
                      else newSet.add(user.id);
                      setSelectedUserIds(newSet);
                    }} className="h-4 w-4 text-blue-600 rounded cursor-pointer" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900 flex items-center gap-2">{user.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{user.email || "メール未登録"}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-md inline-block border border-gray-200">{(user as ExtendedUserData).systemId || "未設定"}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{user.role === "admin" ? "管理者" : user.role === "officer" ? "生徒会役員" : "一般生徒"}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{user.positionName || "役職なし"}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm border ${user.accountStatus === "active" ? "bg-green-50 text-green-700 border-green-200" : user.accountStatus === "unaccessed" ? "bg-purple-50 text-purple-700 border-purple-200" : user.accountStatus === "pending" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                      {user.accountStatus === "active" ? "有効" : user.accountStatus === "unaccessed" ? "未アクセス" : user.accountStatus === "pending" ? "承認待ち" : "停止・却下"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button onClick={() => setSelectedUserDetails(user as ExtendedUserData)} className="text-gray-600 hover:text-gray-900 font-bold bg-white border border-gray-300 hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center"><Eye className="h-3 w-3 mr-1" /> 詳細</button>
                    {user.accountStatus === "unaccessed" ? (
                      <button onClick={() => handlePrint([user as ExtendedUserData])} className="text-blue-700 hover:text-blue-900 font-bold bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center"><FileText className="h-3 w-3 mr-1" /> シート出力</button>
                    ) : (
                      <button onClick={() => handlePasswordReset(user.email)} className="text-yellow-700 hover:text-yellow-900 font-bold bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center"><Key className="h-3 w-3 mr-1" /> パスワードリセット</button>
                    )}
                    {user.accountStatus === "pending" && <button onClick={() => handleAccountStatusChange(user.id, "active")} className="text-green-700 hover:text-green-900 font-bold bg-green-50 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-md transition-colors">承認</button>}
                    {(user.accountStatus === "active" || user.accountStatus === "unaccessed") && user.role !== "system_admin" && <button onClick={() => handleAccountStatusChange(user.id, "rejected")} className="text-red-700 hover:text-red-900 font-bold bg-red-50 border border-red-200 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors">停止</button>}
                    {user.accountStatus === "rejected" && <button onClick={() => handleAccountStatusChange(user.id, "active")} className="text-green-700 hover:text-green-900 font-bold bg-green-50 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-md transition-colors">復旧</button>}
                  </td>
                </tr>
              ))}
              {processedUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
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