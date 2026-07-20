"use client";

import React, { useRef, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Upload, X, FileSpreadsheet, Info, CheckCircle2, HardDriveDownload, RefreshCw, PlusCircle, AlertCircle, Loader2 } from "lucide-react";
import { UserData, SchoolData, SYSTEM_MODULES } from "../page";

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

type CsvPreviewRow = ExtendedUserData & {
  _csvIndex: number;
  _isUpdate: boolean;
  _docId: string;
  _error?: string;
};

type Props = {
  schoolData: SchoolData | null;
  users: UserData[];
  fetchUsers: (schoolId: string) => Promise<void>;
  showAlert: (type: "success" | "error", message: string) => void;
  onClose: () => void;
};

export default function CsvUploadModal({ schoolData, users, fetchUsers, showAlert, onClose }: Props) {
  const [csvPreviewData, setCsvPreviewData] = useState<CsvPreviewRow[] | null>(null);
  const [selectedCsvRowIndices, setSelectedCsvRowIndices] = useState<Set<number>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: number, error: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateInitialPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

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
    link.setAttribute("download", "scps_users_format.csv");
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
            requireMfa: existingUser ? existingUser.requireMfa : false,
          });
          
          if (!errorMessage) newSelectedIndices.add(i);
        }
        
        setCsvPreviewData(parsedRows);
        setSelectedCsvRowIndices(newSelectedIndices);
      } catch (error) {
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
          const saveData = Object.fromEntries(Object.entries(rawSaveData).filter(([_, v]) => v !== undefined));
          
          await setDoc(doc(db, "users", _docId), {
            ...saveData,
            schoolName: schoolData.name,
            schoolCode: schoolData.schoolCode,
            updatedAt: new Date().toISOString(),
            ...(!_isUpdate ? { createdAt: new Date().toISOString(), authProviders: [] } : {})
          }, { merge: true });
          successCount++;
        } catch (e) {
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
    if (newSet.has(index)) newSet.delete(index);
    else newSet.add(index);
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 px-4 py-6 overflow-hidden">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-extrabold text-gray-900 flex items-center">
            <FileSpreadsheet className="h-5 w-5 mr-2 text-blue-600" />
            CSVファイルで一括登録・更新
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-200 hover:bg-gray-300 rounded-full p-1">
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
              <button onClick={onClose} className="mt-8 px-8 py-3 bg-gray-900 text-white rounded-full text-sm font-bold shadow-md hover:bg-gray-800 transition-colors">
                閉じる
              </button>
            </div>
          ) : csvPreviewData ? (
            <div className="flex flex-col h-full">
              <div className="p-6 bg-blue-50 border-b border-blue-100 flex-shrink-0 flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-blue-900 flex items-center"><Info className="h-4 w-4 mr-2" /> 登録データの確認</h4>
                  <p className="text-xs text-blue-700 mt-1">エラーがある行は赤く表示され、反映できません。問題ない行をチェックして反映してください。</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-gray-700 mr-4">選択中: {selectedCsvRowIndices.size} / {csvPreviewData.filter(r => !r._error).length}件 (有効)</span>
                  <button onClick={executeCsvUpload} disabled={isUploading || selectedCsvRowIndices.size === 0} className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-bold shadow-sm hover:bg-blue-700 disabled:opacity-50 inline-flex items-center transition-colors">
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
                        <input type="checkbox" checked={selectedCsvRowIndices.size === csvPreviewData.filter(r => !r._error).length && csvPreviewData.filter(r => !r._error).length > 0} onChange={toggleAllSelection} className="h-4 w-4 text-blue-600 rounded cursor-pointer" />
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
                          <input type="checkbox" checked={selectedCsvRowIndices.has(row._csvIndex)} onChange={() => toggleRowSelection(row._csvIndex)} disabled={!!row._error} className="h-4 w-4 text-blue-600 rounded cursor-pointer disabled:opacity-30" />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row._error ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">無効</span> : row._isUpdate ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200"><RefreshCw className="h-3 w-3 mr-1" /> 更新</span> : <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 border border-green-200"><PlusCircle className="h-3 w-3 mr-1" /> 新規</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-sm font-bold text-gray-900">{row.systemId}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className={`text-sm font-bold ${row._error ? "text-red-700" : "text-gray-900"}`}>{row.name}</div>
                          <div className="text-xs text-gray-500">{row.nameKana}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700">{row.role === "admin" ? "管理者" : row.role === "officer" ? "役員" : "生徒"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">{row.accountValidStartDate || "未指定"} <span className="text-gray-400">〜</span> {row.accountValidEndDate || "未指定"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">{row._error ? <span className="text-red-600 font-bold">{row._error}</span> : <span className="text-gray-400">-</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
                <button onClick={() => setCsvPreviewData(null)} className="px-6 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-300 rounded-lg shadow-sm transition-colors">
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
                  <p className="text-xs text-blue-700 leading-relaxed">大量のユーザーを一度に登録したい場合に便利です。システム利用番号が同じ行は「上書き更新」され、新しい番号は「新規登録」され自動で初期パスワードが生成されます。</p>
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
                    <button onClick={downloadSampleCSV} className="inline-flex items-center px-4 py-2 bg-white border-2 border-blue-600 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors shadow-sm mt-1">
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
                          <li><strong>氏名には必ずスペースを含める</strong> <span className="text-gray-500 font-normal ml-1">(例: 山田 太郎)</span></li>
                          <li><strong>権限</strong> <span className="text-gray-500 font-normal ml-1">(生徒 / 役員 / 管理者)</span></li>
                          <li><strong>システム利用番号</strong> <span className="text-gray-500 font-normal ml-1">(例: STU001)</span></li>
                        </ul>
                      </div>
                      <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                        <h5 className="text-sm font-bold text-yellow-800 mb-1 flex items-center"><AlertCircle className="h-4 w-4 mr-1" /> 数字の「0」落ちに関する注意</h5>
                        <p className="text-xs text-yellow-700">学籍番号などで「0002」と入力した際、Excelの仕様で「2」となってしまう場合があります。これを防ぐため、入力時に先頭に半角アポストロフィをつけて <strong>'0002</strong> と入力するか、セルの書式設定を「文字列」にしてください。</p>
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
                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 hover:border-blue-500 transition-all group disabled:opacity-50 disabled:cursor-not-allowed">
                      {isUploading ? (
                        <><Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-3" /><span className="text-sm font-bold text-gray-600">ファイルを読み込んでいます...</span></>
                      ) : (
                        <><div className="bg-blue-50 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform"><Upload className="h-8 w-8 text-blue-600" /></div><span className="text-base font-bold text-blue-600 mb-1">ファイルを選択してアップロード</span><span className="text-sm text-gray-400">または、ここをクリック</span></>
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
  );
}