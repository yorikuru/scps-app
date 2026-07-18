"use client";

import React, { useRef, useState, useMemo, useEffect } from "react";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { 
  Search, Upload, Loader2, X, FileSpreadsheet, 
  Info, CheckCircle2, HardDriveDownload, 
  RefreshCw, PlusCircle, FileText, Key, Eye,
  ArrowUpDown, Printer,AlertCircle
} from "lucide-react";
import { UserData, SchoolData, SYSTEM_MODULES } from "../page";

// PDF・QRコード生成用パッケージ
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// 型定義の拡張
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
  authProviders?: string[]; // 未ログイン判定用
  accountStatus: "active" | "pending" | "rejected" | "unaccessed";
};

// CSVプレビュー用の型
type CsvPreviewRow = ExtendedUserData & {
  _csvIndex: number;
  _isUpdate: boolean;
  _docId: string;
  _error?: string;
};

type Props = {
  users: UserData[];
  setUsers: (users: UserData[]) => void;
  schoolData: SchoolData | null;
  fetchUsers: (schoolId: string) => Promise<void>;
  showAlert: (type: "success" | "error", message: string) => void;
};

export default function UserManagement({ users, setUsers, schoolData, fetchUsers, showAlert }: Props) {
  // 検索・フィルター・ソート
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  // 詳細モーダル用
  const [selectedUserDetails, setSelectedUserDetails] = useState<ExtendedUserData | null>(null);

  // 一括PDF出力用
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [printTargets, setPrintTargets] = useState<ExtendedUserData[]>([]);
  const [loginUrl, setLoginUrl] = useState("");

  // CSVアップロードモーダル用
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvPreviewData, setCsvPreviewData] = useState<CsvPreviewRow[] | null>(null);
  const [selectedCsvRowIndices, setSelectedCsvRowIndices] = useState<Set<number>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: number, error: number } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLoginUrl(`${window.location.origin}/login`);
    }
  }, []);

  // --- 機能処理 ---

  const generateInitialPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleAccountStatusChange = async (userId: string, newStatus: "active" | "rejected") => {
    try {
      const user = users.find(u => u.id === userId) as ExtendedUserData;
      let targetStatus: "active" | "rejected" | "unaccessed" | "pending" = newStatus;
      
      // ★復旧（active）にする際、まだ一度もログインしていない（authProvidersが空）場合は unaccessed に戻す
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
      console.error(error);
      showAlert("error", "パスワードリセットメールの送信に失敗しました。");
    }
  };

  // --- PDF生成処理 ---
  const handlePrint = (targets: ExtendedUserData[]) => {
    setPrintTargets(targets);
  };

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
            // キャプチャ用に一時的に可視化
            element.style.display = "block";
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
            element.style.display = "none";

            const imgData = canvas.toDataURL("image/png");
            
            if (i > 0) {
              pdf.addPage();
            }
            // A4 size: 210 x 297 mm
            pdf.addImage(imgData, "PNG", 0, 0, 210, 297);
          }
        }
        pdf.save("account_sheets.pdf");
        showAlert("success", "PDFをダウンロードしました。");
      } catch (err) {
        console.error(err);
        showAlert("error", "PDFの生成に失敗しました。");
      } finally {
        setIsGeneratingPDF(false);
        setPrintTargets([]); // クリア
      }
    };

    if (printTargets.length > 0) {
      // DOMが描画されるのを少し待ってからPDF生成を開始する
      setTimeout(() => {
        generatePDF();
      }, 500);
    }
  }, [printTargets]);


  // --- CSV処理 ---

  const downloadSampleCSV = () => {
    const headers = [
      "氏名(必須)", "ふりがな(必須)", "権限(必須:生徒/役員/管理者)", "システム利用番号(必須)", 
      "メールアドレス", "学籍番号", "学年", "組・クラス", "出席番号", "所属部署・コース", 
      "部活・クラブ", "役職名", "IT担当者(はい/いいえ)", "性別(男性/女性/その他)", 
      "生年月日(YYYY-MM-DD)", "電話番号", "所属組織住所", "出身校",
      "アカウント有効開始日(YYYY-MM-DD)", "アカウント有効終了日(YYYY-MM-DD)",
      "LINE連携許可(はい/いいえ)", "LINE連携強制(はい/いいえ)"
    ];
    
    const sampleRow = [
      "山田 太郎", "やまだ たろう", "生徒", "STU001", 
      "yamada@example.com", "3101", "3", "1", "1", "普通科", 
      "陸上部", "", "いいえ", "男性", 
      "2000-01-01", "090-0000-0000", "東京都〇〇区", "田中高等学校",
      "2026-04-01", "2029-03-31", "はい", "いいえ"
    ];

    const csvContent = headers.join(",") + "\n" + sampleRow.join(",");
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "yorikuru_users_format.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseRole = (str: string) => {
    if (str.includes("管理")) return "admin";
    if (str.includes("役員") || str.includes("職員") || str.includes("教員")) return "officer";
    return "student";
  };

  const parseGender = (str: string) => {
    if (str === "男性") return "male";
    if (str === "女性") return "female";
    if (str === "その他") return "other";
    return "";
  };

  const parseBoolean = (str: string, defaultValue: boolean) => {
    if (!str) return defaultValue;
    return str === "はい" || str.toUpperCase() === "TRUE" || str === "有効" || str === "○" || str === "1";
  };

  const parseCSVLine = (line: string) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !schoolData) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string;
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        
        const parsedRows: CsvPreviewRow[] = [];
        const newSelectedIndices = new Set<number>();

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          
          if (cols.length < 4) continue;

          let [
            rawName, nameKana, roleStr, systemId, 
            email, studentId, grade, classNumber, attendanceNumber, department, 
            club, positionName, isITManagerStr, genderStr, 
            birthDate, phoneNumber, organizationAddress, previousSchool,
            validStart, validEnd, lineAllowedStr, lineEnforcedStr
          ] = cols;
          
          if (!rawName || !systemId) continue;

          let formattedName = rawName.replace(/ /g, " ").trim();
          let errorMessage = "";
          if (!formattedName.includes(" ")) {
            errorMessage = "姓と名の間にスペースがありません";
          }

          const existingUser = (users as ExtendedUserData[]).find(u => u.systemId === systemId);
          const isUpdate = !!existingUser;
          const docId = existingUser ? existingUser.id : `uid_${schoolData.schoolCode}_${systemId}`;

          parsedRows.push({
            id: docId,
            _csvIndex: i,
            _isUpdate: isUpdate,
            _docId: docId,
            _error: errorMessage,
            name: formattedName, 
            nameKana, 
            role: parseRole(roleStr || ""),
            systemId,
            email: email || "",
            studentId: studentId || "",
            grade: grade || "",
            classNumber: classNumber || "",
            attendanceNumber: attendanceNumber || "",
            department: department || "",
            club: club || "",
            positionName: positionName || "",
            isITManager: parseBoolean(isITManagerStr, false),
            gender: parseGender(genderStr || ""),
            birthDate: birthDate || "",
            phoneNumber: phoneNumber || "",
            organizationAddress: organizationAddress || "",
            previousSchool: previousSchool || "",
            accountValidStartDate: validStart || "",
            accountValidEndDate: validEnd || "",
            lineConnectionAllowed: parseBoolean(lineAllowedStr, true),
            lineConnectionEnforced: parseBoolean(lineEnforcedStr, false),
            
            schoolId: schoolData.id,
            accountStatus: existingUser ? existingUser.accountStatus : "unaccessed",
            allowedModules: existingUser ? existingUser.allowedModules : (schoolData.availableModules || SYSTEM_MODULES.map(m => m.id)),
            initialPassword: existingUser ? existingUser.initialPassword : generateInitialPassword(),
          });
          
          if (!errorMessage) {
            newSelectedIndices.add(i);
          }
        }
        
        setCsvPreviewData(parsedRows);
        setSelectedCsvRowIndices(newSelectedIndices);
      } catch (error) {
        console.error(error);
        showAlert("error", "CSVの読み込みに失敗しました。ファイル形式を確認してください。");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const executeCsvUpload = async () => {
    if (!csvPreviewData || !schoolData) return;
    
    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const selectedRows = csvPreviewData.filter(row => selectedCsvRowIndices.has(row._csvIndex) && !row._error);

      for (const row of selectedRows) {
        try {
          const { _csvIndex, _isUpdate, _docId, _error, ...rawSaveData } = row;
          
          const saveData = Object.fromEntries(
            Object.entries(rawSaveData).filter(([_, v]) => v !== undefined)
          );
          
          await setDoc(doc(db, "users", _docId), {
            ...saveData,
            schoolName: schoolData.name,
            schoolCode: schoolData.schoolCode,
            updatedAt: new Date().toISOString(),
            ...(!_isUpdate ? { createdAt: new Date().toISOString(), authProviders: [] } : {})
          }, { merge: true });

          successCount++;
        } catch (e) {
          console.error("行書き込みエラー:", e);
          errorCount++;
        }
      }

      setUploadResult({ success: successCount, error: errorCount });
      await fetchUsers(schoolData.id);
    } catch (e) {
      showAlert("error", "アップロード中に致命的なエラーが発生しました。");
    } finally {
      setIsUploading(false);
    }
  };

  const toggleRowSelection = (index: number) => {
    const row = csvPreviewData?.find(r => r._csvIndex === index);
    if (row && row._error) return;

    const newSet = new Set(selectedCsvRowIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedCsvRowIndices(newSet);
  };

  const toggleAllSelection = () => {
    if (!csvPreviewData) return;
    const validRows = csvPreviewData.filter(r => !r._error);
    
    if (selectedCsvRowIndices.size === validRows.length && validRows.length > 0) {
      setSelectedCsvRowIndices(new Set()); 
    } else {
      setSelectedCsvRowIndices(new Set(validRows.map(r => r._csvIndex))); 
    }
  };

  const closeModal = () => {
    setIsCsvModalOpen(false);
    setCsvPreviewData(null);
    setUploadResult(null);
  };

  const processedUsers = useMemo(() => {
    let result = [...(users as ExtendedUserData[])];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => 
        u.name.toLowerCase().includes(q) || 
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.systemId && u.systemId.toLowerCase().includes(q))
      );
    }

    if (filterRole !== "all") {
      result = result.filter(u => u.role === filterRole);
    }
    if (filterStatus !== "all") {
      result = result.filter(u => u.accountStatus === filterStatus);
    }

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
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };


  return (
    <div className="space-y-6">

      {/* PDF生成中のローディングオーバーレイ */}
      {isGeneratingPDF && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black bg-opacity-80 text-white">
          <Loader2 className="animate-spin h-12 w-12 mb-4 text-blue-500" />
          <p className="font-bold text-lg">PDFを作成しています...</p>
          <p className="text-sm mt-2 text-gray-300">人数が多い場合は数十秒かかることがあります</p>
        </div>
      )}

      {/* PDF出力用の隠しDOM領域（HTML2Canvasエラー回避のためインラインスタイルのみで記述） */}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        {printTargets.map((user) => (
          <div 
            key={user.id} 
            id={`print-sheet-${user.id}`} 
            style={{ 
              display: "none", 
              width: "210mm", 
              height: "297mm", 
              backgroundColor: "#ffffff",
              padding: "40px",
              boxSizing: "border-box",
              fontFamily: "sans-serif",
              color: "#111827"
            }}
          >
            <div style={{ borderBottom: "2px solid #1f2937", paddingBottom: "16px", marginBottom: "32px", textAlign: "center" }}>
              <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: "0" }}>生徒会ポータルシステム　システムアカウント発行シート</h1>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: "8px 0 0 0" }}>個人情報を含みますので　大切に保管してください</p>
            </div>

            <div style={{ marginBottom: "32px", backgroundColor: "#f9fafb", padding: "24px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#1f2937", marginBottom: "16px", borderBottom: "1px solid #e5e7eb", paddingBottom: "8px", marginTop: 0 }}>所属情報</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                <div style={{ width: "45%" }}>
                  <span style={{ fontSize: "12px", color: "#6b7280", display: "block" }}>テナント名 (学校名)</span>
                  <span style={{ fontSize: "16px", fontWeight: "bold" }}>{schoolData?.name}</span>
                </div>
                <div style={{ width: "45%" }}>
                  <span style={{ fontSize: "12px", color: "#6b7280", display: "block" }}>テナントID (学校コード)</span>
                  <span style={{ fontSize: "16px", fontWeight: "bold", fontFamily: "monospace" }}>{schoolData?.schoolCode}</span>
                </div>
                <div style={{ width: "45%" }}>
                  <span style={{ fontSize: "12px", color: "#6b7280", display: "block" }}>氏名</span>
                  <span style={{ fontSize: "20px", fontWeight: "bold" }}>{user.name}</span>
                  <span style={{ fontSize: "14px", color: "#6b7280", marginLeft: "8px" }}>{user.nameKana}</span>
                </div>
                <div style={{ width: "45%" }}>
                  <span style={{ fontSize: "12px", color: "#6b7280", display: "block" }}>権限</span>
                  <span style={{ fontSize: "16px", fontWeight: "bold" }}>{user.role === "admin" ? "管理者" : user.role === "officer" ? "役員" : "生徒"}</span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "32px", backgroundColor: "#eff6ff", padding: "24px", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#1e3a8a", marginBottom: "16px", borderBottom: "1px solid #bfdbfe", paddingBottom: "8px", marginTop: 0 }}>ログイン情報</h2>
              <div style={{ marginBottom: "16px" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "#1d4ed8", display: "block", marginBottom: "4px" }}>システム利用番号（ログインIDとして使用します）</span>
                <div style={{ backgroundColor: "#ffffff", padding: "12px 16px", border: "1px solid #93c5fd", borderRadius: "4px", fontSize: "24px", fontWeight: "bold", fontFamily: "monospace", letterSpacing: "2px", color: "#111827" }}>
                  {user.systemId}
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "#1d4ed8", display: "block", marginBottom: "4px" }}>初期パスワード</span>
                <div style={{ backgroundColor: "#ffffff", padding: "12px 16px", border: "1px solid #93c5fd", borderRadius: "4px", fontSize: "24px", fontWeight: "bold", fontFamily: "monospace", letterSpacing: "2px", color: "#111827" }}>
                  {user.initialPassword || "未設定 (管理者にお問い合わせください)"}
                </div>
              </div>
              {user.email && (
                <div>
                  <span style={{ fontSize: "12px", fontWeight: "bold", color: "#1d4ed8", display: "block", marginBottom: "4px" }}>登録メールアドレス（ログインIDのかわりに使用することもできます）</span>
                  <div style={{ backgroundColor: "#ffffff", padding: "8px 16px", border: "1px solid #93c5fd", borderRadius: "4px", fontSize: "16px", fontWeight: "bold", color: "#111827" }}>
                    {user.email}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", backgroundColor: "#f9fafb", padding: "24px", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "32px" }}>
              <div style={{ marginRight: "32px" }}>
                {loginUrl && <QRCodeSVG value={loginUrl} size={100} level="M" />}
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#111827", margin: "0 0 8px 0" }}>ログインURL</h3>
                <p style={{ fontSize: "12px", color: "#4b5563", margin: "0 0 8px 0" }}>スマートフォン・PCから以下のURLまたはQRコードでアクセスしてください。</p>
                <div style={{ backgroundColor: "#ffffff", padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "14px", fontWeight: "bold", fontFamily: "monospace", color: "#2563eb" }}>
                  {loginUrl}
                </div>
              </div>
            </div>

            <div style={{ fontSize: "12px", color: "#4b5563", lineHeight: "1.6" }}>
              <p style={{ fontWeight: "bold", color: "#111827", margin: "0 0 8px 0" }}>【初回ログインについてのご案内】</p>
              <p style={{ margin: "4px 0" }}>1. ログイン画面にアクセスし、上記の「システム利用番号」と「初期パスワード」を入力してください。</p>
              <p style={{ margin: "4px 0" }}>2. セキュリティのため、初回ログイン時にご自身専用の新しいパスワードへの変更が求められます。</p>
              <p style={{ margin: "4px 0" }}>3. パスワード変更後、簡単なチュートリアルを完了するとアカウントが有効化されます。</p>
              {user.accountValidStartDate && (
                <p style={{ color: "#dc2626", fontWeight: "bold", margin: "16px 0 0 0" }}>※ このアカウントは {user.accountValidStartDate} より利用可能となります。</p>
              )}
            </div>

          </div>
        ))}
      </div>


      {/* CSVインポート＆プレビュー モーダル */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 px-4 py-6 overflow-hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
            
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl flex-shrink-0">
              <h3 className="text-lg font-extrabold text-gray-900 flex items-center">
                <FileSpreadsheet className="h-5 w-5 mr-2 text-blue-600" />
                CSVファイルで一括登録・更新
              </h3>
              <button onClick={() => { setIsCsvModalOpen(false); setUploadResult(null); setCsvPreviewData(null); }} className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-200 hover:bg-gray-300 rounded-full p-1">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-hidden flex flex-col flex-1 bg-white">
              
              {uploadResult ? (
                <div className="p-10 flex flex-col items-center justify-center text-center h-full">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-extrabold text-gray-900 mb-2">アップロードが完了しました</h3>
                  <div className="bg-gray-50 rounded-lg p-6 w-full max-w-sm mt-4 border border-gray-100 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 font-bold">成功</span>
                      <span className="text-2xl font-extrabold text-green-600">{uploadResult.success} <span className="text-sm font-normal text-gray-500">件</span></span>
                    </div>
                    {uploadResult.error > 0 && (
                      <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                        <span className="text-sm text-gray-600 font-bold">エラー</span>
                        <span className="text-lg font-extrabold text-red-500">{uploadResult.error} <span className="text-sm font-normal text-gray-500">件</span></span>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => { setIsCsvModalOpen(false); setUploadResult(null); setCsvPreviewData(null); }}
                    className="mt-8 px-8 py-3 bg-gray-900 text-white rounded-full text-sm font-bold shadow-md hover:bg-gray-800 transition-colors"
                  >
                    閉じる
                  </button>
                </div>

              ) : csvPreviewData ? (
                <div className="flex flex-col h-full">
                  <div className="p-6 bg-blue-50 border-b border-blue-100 flex-shrink-0 flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-bold text-blue-900 flex items-center">
                        <Info className="h-4 w-4 mr-2" /> 登録データの確認
                      </h4>
                      <p className="text-xs text-blue-700 mt-1">エラーがある行は赤く表示され、反映できません。問題ない行をチェックして反映してください。</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-700 mr-4">選択中: {selectedCsvRowIndices.size} / {csvPreviewData.filter(r => !r._error).length}件 (有効)</span>
                      <button 
                        onClick={executeCsvUpload}
                        disabled={isUploading || selectedCsvRowIndices.size === 0}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-bold shadow-sm hover:bg-blue-700 disabled:opacity-50 inline-flex items-center transition-colors"
                      >
                        {isUploading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                        選択したデータを反映
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto bg-gray-50">
                    <table className="min-w-max w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            <input 
                              type="checkbox" 
                              checked={selectedCsvRowIndices.size === csvPreviewData.filter(r => !r._error).length && csvPreviewData.filter(r => !r._error).length > 0} 
                              onChange={toggleAllSelection}
                              className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">状態</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">システム利用番号</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">氏名 / ふりがな</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">権限</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">有効開始 / 終了日</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">警告/エラー</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {csvPreviewData.map((row) => (
                          <tr key={row._csvIndex} className={`hover:bg-gray-50 ${row._error ? "bg-red-50" : selectedCsvRowIndices.has(row._csvIndex) ? "bg-blue-50/30" : "opacity-60"}`}>
                            <td className="px-4 py-3">
                              <input 
                                type="checkbox" 
                                checked={selectedCsvRowIndices.has(row._csvIndex)} 
                                onChange={() => toggleRowSelection(row._csvIndex)}
                                disabled={!!row._error}
                                className="h-4 w-4 text-blue-600 rounded cursor-pointer disabled:opacity-30"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {row._error ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">無効</span>
                              ) : row._isUpdate ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200"><RefreshCw className="h-3 w-3 mr-1" /> 更新</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 border border-green-200"><PlusCircle className="h-3 w-3 mr-1" /> 新規</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-sm font-bold text-gray-900">{row.systemId}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className={`text-sm font-bold ${row._error ? "text-red-700" : "text-gray-900"}`}>{row.name}</div>
                              <div className="text-xs text-gray-500">{row.nameKana}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700">
                              {row.role === "admin" ? "管理者" : row.role === "officer" ? "役員" : "生徒"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                              {row.accountValidStartDate || "未指定"} <span className="text-gray-400">〜</span> {row.accountValidEndDate || "未指定"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs">
                              {row._error ? (
                                <span className="text-red-600 font-bold">{row._error}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
                    <button 
                      onClick={() => setCsvPreviewData(null)}
                      className="px-6 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-300 rounded-lg shadow-sm transition-colors"
                    >
                      キャンセルして戻る
                    </button>
                  </div>
                </div>

              ) : (
                <div className="p-6 overflow-y-auto h-full space-y-8">
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start">
                    <Info className="h-5 w-5 text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-blue-800 mb-1">CSV一括登録について</h4>
                      <p className="text-xs text-blue-700 leading-relaxed">
                        大量のユーザーを一度に登録したい場合に便利です。システム利用番号が同じ行は「上書き更新」され、新しい番号は「新規登録」され自動で初期パスワードが生成されます。
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6 relative max-w-3xl mx-auto">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm z-10">1</div>
                        <div className="w-0.5 h-full bg-blue-100 mt-2"></div>
                      </div>
                      <div className="flex-1 pb-6">
                        <h4 className="text-base font-bold text-gray-900 mb-2">専用の雛形（フォーマット）をダウンロード</h4>
                        <button 
                          onClick={downloadSampleCSV}
                          className="inline-flex items-center px-4 py-2 bg-white border-2 border-blue-600 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors shadow-sm mt-1"
                        >
                          <HardDriveDownload className="h-4 w-4 mr-2" /> 雛形CSVをダウンロード
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm z-10">2</div>
                        <div className="w-0.5 h-full bg-blue-100 mt-2"></div>
                      </div>
                      <div className="flex-1 pb-6">
                        <h4 className="text-base font-bold text-gray-900 mb-2">Excel等で開き、ユーザー情報を入力</h4>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-4">
                          <div>
                            <p className="text-sm font-bold text-red-600 mb-1">【必須ルール】</p>
                            <ul className="text-sm text-gray-700 space-y-1 ml-5 list-disc marker:text-gray-400 font-medium">
                              <li><strong>氏名には必ずスペースを含める</strong> <span className="text-gray-500 font-normal ml-1">(例: 山田 太郎) ※全角・半角問わず自動変換されます</span></li>
                              <li><strong>権限</strong> <span className="text-gray-500 font-normal ml-1">(生徒 / 役員 / 管理者)</span></li>
                              <li><strong>システム利用番号</strong> <span className="text-gray-500 font-normal ml-1">(例: STU001) ※テナント内で重複禁止</span></li>
                            </ul>
                          </div>
                          
                          <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                            <h5 className="text-sm font-bold text-yellow-800 mb-1 flex items-center"><AlertCircle className="h-4 w-4 mr-1" /> 数字の「0」落ちに関する注意</h5>
                            <p className="text-xs text-yellow-700">
                              学籍番号などで「0002」と入力した際、Excelの仕様で「2」となってしまう場合があります。<br/>
                              これを防ぐため、入力時に先頭に半角アポストロフィをつけて <strong>'0002</strong> と入力するか、セルの書式設定を「文字列」にしてください。
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm z-10">3</div>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-base font-bold text-gray-900 mb-2">作成したCSVをアップロードして確認画面へ</h4>
                        <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="w-full flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 hover:border-blue-500 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-3" />
                              <span className="text-sm font-bold text-gray-600">ファイルを読み込んでいます...</span>
                            </>
                          ) : (
                            <>
                              <div className="bg-blue-50 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                <Upload className="h-8 w-8 text-blue-600" />
                              </div>
                              <span className="text-base font-bold text-blue-600 mb-1">ファイルを選択してアップロード</span>
                              <span className="text-sm text-gray-400">または、ここをクリック</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* 詳細情報モーダル */}
      {selectedUserDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4 py-6">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-full overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-extrabold text-gray-900">ユーザー詳細情報</h3>
              <button onClick={() => setSelectedUserDetails(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-blue-900 border-b border-blue-100 pb-1">基本情報</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-500 font-bold col-span-1">氏名</span>
                    <span className="col-span-2 text-gray-900">{selectedUserDetails.name} <span className="text-xs text-gray-500 ml-1">({selectedUserDetails.nameKana})</span></span>
                    
                    <span className="text-gray-500 font-bold col-span-1">システム利用番号</span>
                    <span className="col-span-2 font-mono font-bold">{selectedUserDetails.systemId || "-"}</span>
                    
                    <span className="text-gray-500 font-bold col-span-1">権限</span>
                    <span className="col-span-2">{selectedUserDetails.role === "admin" ? "管理者" : selectedUserDetails.role === "officer" ? "役員" : "生徒"}</span>
                    
                    <span className="text-gray-500 font-bold col-span-1">役職名</span>
                    <span className="col-span-2">{selectedUserDetails.positionName || "-"}</span>
                    
                    <span className="text-gray-500 font-bold col-span-1">IT担当者</span>
                    <span className="col-span-2">{selectedUserDetails.isITManager ? "はい" : "いいえ"}</span>

                    <span className="text-gray-500 font-bold col-span-1">メールアドレス</span>
                    <span className="col-span-2">{selectedUserDetails.email || "-"}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-blue-900 border-b border-blue-100 pb-1">学校・所属情報</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-500 font-bold col-span-1">学籍番号</span>
                    <span className="col-span-2 font-mono">{selectedUserDetails.studentId || "-"}</span>
                    
                    <span className="text-gray-500 font-bold col-span-1">学年 / 組 / 出席番号</span>
                    <span className="col-span-2">{selectedUserDetails.grade || "-"}年 {selectedUserDetails.classNumber || "-"}組 {selectedUserDetails.attendanceNumber || "-"}番</span>
                    
                    <span className="text-gray-500 font-bold col-span-1">所属部署・コース</span>
                    <span className="col-span-2">{selectedUserDetails.department || "-"}</span>
                    
                    <span className="text-gray-500 font-bold col-span-1">部活・クラブ</span>
                    <span className="col-span-2">{selectedUserDetails.club || "-"}</span>
                    
                    <span className="text-gray-500 font-bold col-span-1">出身校</span>
                    <span className="col-span-2">{selectedUserDetails.previousSchool || "-"}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-blue-900 border-b border-blue-100 pb-1">個人属性・連絡先</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-500 font-bold col-span-1">性別</span>
                    <span className="col-span-2">{selectedUserDetails.gender === "male" ? "男性" : selectedUserDetails.gender === "female" ? "女性" : selectedUserDetails.gender === "other" ? "その他" : "-"}</span>
                    
                    <span className="text-gray-500 font-bold col-span-1">生年月日</span>
                    <span className="col-span-2">{selectedUserDetails.birthDate || "-"}</span>
                    
                    <span className="text-gray-500 font-bold col-span-1">電話番号</span>
                    <span className="col-span-2">{selectedUserDetails.phoneNumber || "-"}</span>
                    
                    <span className="text-gray-500 font-bold col-span-1">所属組織住所</span>
                    <span className="col-span-2">{selectedUserDetails.organizationAddress || "-"}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-blue-900 border-b border-blue-100 pb-1">システム設定</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-500 font-bold col-span-1">ステータス</span>
                    <span className="col-span-2 font-bold">{
                      selectedUserDetails.accountStatus === "active" ? "有効" : 
                      selectedUserDetails.accountStatus === "unaccessed" ? "未アクセス" :
                      selectedUserDetails.accountStatus === "pending" ? "承認待ち" : "停止/却下"
                    }</span>
                    
                    <span className="text-gray-500 font-bold col-span-1">アカウント有効期間</span>
                    <span className="col-span-2">{selectedUserDetails.accountValidStartDate || "未指定"} 〜 {selectedUserDetails.accountValidEndDate || "未指定"}</span>
                    
                    <span className="text-gray-500 font-bold col-span-1">LINE連携</span>
                    <span className="col-span-2">
                      {selectedUserDetails.lineConnectionEnforced ? "強制" : selectedUserDetails.lineConnectionAllowed ? "許可" : "不可"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end flex-shrink-0">
              <button onClick={() => setSelectedUserDetails(null)} className="px-6 py-2 bg-gray-900 text-white rounded-md text-sm font-bold hover:bg-gray-800 transition-colors">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ヘッダー */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-extrabold text-gray-900">ユーザー管理</h3>
          <p className="text-sm text-gray-500 mt-1">テナントに所属するすべてのアカウントを管理します。</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          
          {selectedUserIds.size > 0 && (
            <button 
              onClick={() => handlePrint(processedUsers.filter(u => selectedUserIds.has(u.id)))}
              disabled={isGeneratingPDF}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-bold hover:bg-blue-700 shadow-sm transition-colors animate-fade-in disabled:opacity-50"
            >
              {isGeneratingPDF ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />} 
              選択中({selectedUserIds.size}件)のシート出力 (PDF)
            </button>
          )}

          <button 
            onClick={() => setIsCsvModalOpen(true)} 
            className="flex items-center px-4 py-2 bg-gray-900 border border-transparent rounded-md text-sm font-bold text-white hover:bg-gray-800 whitespace-nowrap shadow-sm transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" /> 
            CSV一括登録 / 更新
          </button>
        </div>
      </div>

      {/* 検索・フィルターパネル */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-gray-500 mb-1">キーワード検索</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" placeholder="名前、メール、利用番号..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 w-full"
            />
          </div>
        </div>
        <div className="w-full md:w-48">
          <label className="block text-xs font-bold text-gray-500 mb-1">権限で絞り込み</label>
          <select 
            value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">すべて</option>
            <option value="admin">管理者</option>
            <option value="officer">役員</option>
            <option value="student">生徒</option>
          </select>
        </div>
        <div className="w-full md:w-48">
          <label className="block text-xs font-bold text-gray-500 mb-1">ステータスで絞り込み</label>
          <select 
            value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full py-2 px-3 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">すべて</option>
            <option value="active">有効</option>
            <option value="unaccessed">未アクセス</option>
            <option value="pending">承認待ち</option>
            <option value="rejected">停止/却下</option>
          </select>
        </div>
      </div>

      {/* ユーザー一覧テーブル */}
      <div className="bg-white shadow rounded-xl overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 select-none">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input 
                    type="checkbox" 
                    checked={selectedUserIds.size === processedUsers.length && processedUsers.length > 0}
                    onChange={() => {
                      if (selectedUserIds.size === processedUsers.length) {
                        setSelectedUserIds(new Set());
                      } else {
                        setSelectedUserIds(new Set(processedUsers.map(u => u.id)));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                  />
                </th>
                <th onClick={() => requestSort('name')} className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                  ユーザー情報 {sortConfig?.key === 'name' && <ArrowUpDown className="inline h-3 w-3 ml-1" />}
                </th>
                <th onClick={() => requestSort('systemId')} className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                  システム利用番号 {sortConfig?.key === 'systemId' && <ArrowUpDown className="inline h-3 w-3 ml-1" />}
                </th>
                <th onClick={() => requestSort('role')} className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                  権限・役職 {sortConfig?.key === 'role' && <ArrowUpDown className="inline h-3 w-3 ml-1" />}
                </th>
                <th onClick={() => requestSort('accountStatus')} className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                  ステータス {sortConfig?.key === 'accountStatus' && <ArrowUpDown className="inline h-3 w-3 ml-1" />}
                </th>
                <th className="px-6 py-3 text-right text-xs font-extrabold text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {processedUsers.map((user) => (
                <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${selectedUserIds.has(user.id) ? "bg-blue-50/20" : ""}`}>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <input 
                      type="checkbox"
                      checked={selectedUserIds.has(user.id)}
                      onChange={() => {
                        const newSet = new Set(selectedUserIds);
                        if (newSet.has(user.id)) newSet.delete(user.id);
                        else newSet.add(user.id);
                        setSelectedUserIds(newSet);
                      }}
                      className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      {user.name}
                      {user.role === "guest" && <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800">ゲスト</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{user.email || "メール未登録"}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-md inline-block border border-gray-200">
                      {(user as ExtendedUserData).systemId || "未設定"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">
                      {user.role === "admin" ? "管理者" : user.role === "officer" ? "生徒会役員" : "一般生徒"}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{user.positionName || "役職なし"}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm border ${
                      user.accountStatus === "active" ? "bg-green-50 text-green-700 border-green-200" :
                      user.accountStatus === "unaccessed" ? "bg-purple-50 text-purple-700 border-purple-200" :
                      user.accountStatus === "pending" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-red-50 text-red-700 border-red-200"
                    }`}>
                      {user.accountStatus === "active" ? "有効" : 
                       user.accountStatus === "unaccessed" ? "未アクセス" :
                       user.accountStatus === "pending" ? "承認待ち" : "停止・却下"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    
                    <button onClick={() => setSelectedUserDetails(user as ExtendedUserData)} className="text-gray-600 hover:text-gray-900 font-bold bg-white border border-gray-300 hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center">
                      <Eye className="h-3 w-3 mr-1" /> 詳細
                    </button>

                    {user.accountStatus === "unaccessed" ? (
                      <button onClick={() => handlePrint([user as ExtendedUserData])} className="text-blue-700 hover:text-blue-900 font-bold bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center">
                        <FileText className="h-3 w-3 mr-1" /> シート出力
                      </button>
                    ) : (
                      <button onClick={() => handlePasswordReset(user.email)} className="text-yellow-700 hover:text-yellow-900 font-bold bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center">
                        <Key className="h-3 w-3 mr-1" /> パスワードリセット
                      </button>
                    )}

                    {user.accountStatus === "pending" && (
                      <button onClick={() => handleAccountStatusChange(user.id, "active")} className="text-green-700 hover:text-green-900 font-bold bg-green-50 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-md transition-colors">承認</button>
                    )}
                    {(user.accountStatus === "active" || user.accountStatus === "unaccessed") && user.role !== "system_admin" && (
                      <button onClick={() => handleAccountStatusChange(user.id, "rejected")} className="text-red-700 hover:text-red-900 font-bold bg-red-50 border border-red-200 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors">停止</button>
                    )}
                    {user.accountStatus === "rejected" && (
                      <button onClick={() => handleAccountStatusChange(user.id, "active")} className="text-green-700 hover:text-green-900 font-bold bg-green-50 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-md transition-colors">復旧</button>
                    )}
                  </td>
                </tr>
              ))}
              {processedUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                    <Search className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                    条件に一致するユーザーが見つかりません。
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