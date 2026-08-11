"use client";

import React, { useRef, useState } from "react";
import { doc, setDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Upload, X, FileSpreadsheet, Info, CheckCircle2, AlertCircle, Loader2, Download } from "lucide-react";
// ★ SYSTEM_MODULES のインポートを削除しました
import { UserData, SchoolData } from "../page";
import { Position } from "./UserManagement";

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
  isManager?: boolean; 
};

type CsvPreviewRow = ExtendedUserData & {
  _csvIndex: number;
  _isUpdate: boolean;
  _docId: string;
  _error?: string;
  _primaryPositionId?: string; 
  _selected: boolean;
  _nameCandidates?: string[]; 
  _selectedName?: string;     
};

type Props = {
  schoolData: SchoolData | null;
  users: UserData[];
  positions: Position[];
  fetchUsers: (schoolId: string) => Promise<void>;
  onClose: () => void;
  showAlert: (type: "success" | "error" | "warning", message: string) => void;
  onNavigateTab: (tab: string) => void;
};

const generateInitialPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pass = "";
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
};

export default function CsvUploadModal({ schoolData, users, positions, fetchUsers, onClose, showAlert, onNavigateTab }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [previewData, setPreviewData] = useState<CsvPreviewRow[]>([]);
  const [bulkPositionId, setBulkPositionId] = useState<string>("");

  if (positions.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-black text-gray-900 mb-2">役職が設定されていません</h3>
          <p className="text-xs font-bold text-gray-500 mb-6 leading-relaxed">
            CSVでユーザーを一括登録する前に、このテナントで使用する「役職マスタ」を設定する必要があります。
          </p>
          <div className="flex flex-col gap-2">
            <button onClick={() => { onClose(); onNavigateTab("positions"); }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors">
              役職マスタを設定する
            </button>
            <button onClick={onClose} className="w-full py-3 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors">
              キャンセル
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sortedStudents = positions.filter(p => p.isInternal && p.isStudent).sort((a,b) => a.shokui - b.shokui || a.displayOrder - b.displayOrder);
  const sortedTeachers = positions.filter(p => p.isInternal && !p.isStudent).sort((a,b) => a.shokui - b.shokui || a.displayOrder - b.displayOrder);
  const sortedExternals = positions.filter(p => !p.isInternal).sort((a,b) => a.displayOrder - b.displayOrder);

  const renderPositionOptions = (role: string) => {
    const showStudent = ["admin", "guest", "student", "officer", "all"].includes(role);
    const showTeacher = ["admin", "guest", "teacher", "all"].includes(role);

    return (
      <>
        <option value="">役職なし</option>
        {showStudent && sortedStudents.length > 0 && (
          <optgroup label="生徒の役職">
            {sortedStudents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </optgroup>
        )}
        {showTeacher && sortedTeachers.length > 0 && (
          <optgroup label="教職員・管理職の役職">
            {sortedTeachers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </optgroup>
        )}
        {sortedExternals.length > 0 && (
          <optgroup label="外部組織等の役職">
            {sortedExternals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </optgroup>
        )}
      </>
    );
  };

  const downloadTemplate = () => {
    const headers = [
      "名前", "メールアドレス", "権限ロール", "システムID", "学籍・教職員番号", 
      "フリガナ", "性別", "生年月日", "所属", "学年", "組", "出席番号", 
      "部活動等", "出身校", "電話番号", "居住地", "有効開始日", "有効終了日"
    ];
    const sampleRow1 = [
      "山田 太郎", "yamada@example.com", "student", "000001", "3101", 
      "ヤマダ タロウ", "男性", "2004/07/18", "普通科", "3", "1", "1", 
      "陸上部", "熊本中学校", "090-0000-0000", "熊本県熊本市中央区1-1-1", "2026/04/01", "2029/03/31"
    ];
    const sampleRow2 = [
      "佐藤 花子", "sato@example.com", "teacher", "000002", "9001", 
      "サトウ ハナコ", "女性", "1980/01/01", "教務部", "", "", "", 
      "吹奏楽部顧問", "", "", "", "", ""
    ];
    
    const csvContent = [
      headers.join(","),
      sampleRow1.map(v => `"${v}"`).join(","),
      sampleRow2.map(v => `"${v}"`).join(",")
    ].join("\n");

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "SCPS_User_Import_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseGender = (val: string) => {
    if (val.includes("男")) return "male";
    if (val.includes("女")) return "female";
    if (val.includes("他") || val.includes("答えない")) return "other";
    return val; 
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csvText = event.target?.result as string;
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length <= 1) {
          showAlert("error", "CSVファイルにデータが含まれていません。");
          setIsUploading(false);
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        
        const idxName = headers.findIndex(h => h === "name" || h === "名前" || h === "氏名");
        const idxEmail = headers.findIndex(h => h === "email" || h === "メールアドレス");
        const idxRole = headers.findIndex(h => h === "role" || h === "権限" || h === "権限ロール" || h === "ロール");
        const idxSystemId = headers.findIndex(h => h === "systemId" || h === "システムID");
        const idxStudentId = headers.findIndex(h => h === "studentId" || h === "学籍番号" || h === "教職員番号" || h === "学籍・教職員番号");
        const idxNameKana = headers.findIndex(h => h === "nameKana" || h === "フリガナ" || h === "カナ");
        const idxGender = headers.findIndex(h => h === "gender" || h === "性別");
        const idxBirthDate = headers.findIndex(h => h === "birthDate" || h === "生年月日");
        const idxDepartment = headers.findIndex(h => h === "department" || h === "所属" || h === "学科");
        const idxGrade = headers.findIndex(h => h === "grade" || h === "学年");
        const idxClassNumber = headers.findIndex(h => h === "classNumber" || h === "組" || h === "クラス");
        const idxAttendanceNumber = headers.findIndex(h => h === "attendanceNumber" || h === "出席番号");
        const idxClub = headers.findIndex(h => h === "club" || h === "部活動等" || h === "部活動" || h === "同好会");
        const idxPrevSchool = headers.findIndex(h => h === "previousSchool" || h === "出身校" || h === "前所属");
        const idxPhone = headers.findIndex(h => h === "phoneNumber" || h === "電話番号");
        const idxAddress = headers.findIndex(h => h === "organizationAddress" || h === "居住地" || h === "住所");
        const idxValidStart = headers.findIndex(h => h === "accountValidStartDate" || h === "有効開始日");
        const idxValidEnd = headers.findIndex(h => h === "accountValidEndDate" || h === "有効終了日");
        
        if (idxName === -1 || idxEmail === -1) {
          showAlert("error", "必須の列（名前、メールアドレス）が見つかりません。テンプレートを確認してください。");
          setIsUploading(false);
          return;
        }

        const parsedRows: CsvPreviewRow[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const rowText = lines[i];
          const rowValues: string[] = [];
          let currentVal = '';
          let inQuotes = false;
          
          for (let charIndex = 0; charIndex < rowText.length; charIndex++) {
            const char = rowText[charIndex];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              rowValues.push(currentVal.trim());
              currentVal = '';
            } else {
              currentVal += char;
            }
          }
          rowValues.push(currentVal.trim());
          
          if (rowValues.length < 2 || !rowValues[idxName] || !rowValues[idxEmail]) continue;
          
          let rawName = rowValues[idxName];
          const email = rowValues[idxEmail].toLowerCase();
          
          let formattedName = rawName.replace(/[\s ]+/g, ' ').trim();
          let nameCandidates: string[] = [];
          let rowError = undefined;

          if (!email.includes("@")) {
            rowError = "無効なメールアドレス";
          } else if (!formattedName.includes(' ')) {
            rowError = "名前の区切り(スペース)を選択してください";
            for (let j = 1; j < formattedName.length; j++) {
              nameCandidates.push(formattedName.slice(0, j) + ' ' + formattedName.slice(j));
            }
          }

          let role = "student";
          if (idxRole !== -1 && rowValues[idxRole]) {
            const roleStr = rowValues[idxRole].toLowerCase();
            if (["admin", "officer", "teacher", "student", "guest"].includes(roleStr)) {
              role = roleStr;
            } else {
              role = roleStr.includes("管理") ? "admin" :
                     roleStr.includes("役員") ? "officer" :
                     roleStr.includes("教") ? "teacher" : 
                     roleStr.includes("ゲスト") ? "guest" : "student";
            }
          }

          const existingUser = users.find(u => u.email.toLowerCase() === email) as ExtendedUserData | undefined;
          const getVal = (idx: number) => idx !== -1 && rowValues[idx] ? rowValues[idx] : undefined;

          let formattedSystemId = existingUser?.systemId || "";
          const rawSystemId = getVal(idxSystemId);
          if (rawSystemId !== undefined && rawSystemId !== "") {
            formattedSystemId = String(rawSystemId).padStart(6, '0');
          }

          const isNewUser = !existingUser;
          const assignedPassword = isNewUser ? generateInitialPassword() : (existingUser?.initialPassword || "");

          parsedRows.push({
            _csvIndex: i,
            _isUpdate: !!existingUser,
            _docId: existingUser ? existingUser.id : doc(collection(db, "users")).id,
            _error: rowError,
            _selected: !rowError,
            _nameCandidates: nameCandidates.length > 0 ? nameCandidates : undefined,
            _selectedName: nameCandidates.length > 0 ? "" : formattedName,
            id: existingUser ? existingUser.id : "",
            name: nameCandidates.length > 0 ? formattedName : formattedName,
            email,
            role,
            schoolId: schoolData!.id,
            accountStatus: existingUser ? existingUser.accountStatus : "unaccessed",
            
            // ★ SYSTEM_MODULES ではなく、テナントに許可されたアプリ(availableModules)をデフォルトとして付与する
            allowedModules: existingUser ? existingUser.allowedModules : (schoolData?.availableModules || []),
            
            initialPassword: assignedPassword,
            systemId: formattedSystemId,
            studentId: getVal(idxStudentId) || existingUser?.studentId,
            nameKana: getVal(idxNameKana) || existingUser?.nameKana,
            gender: getVal(idxGender) ? parseGender(getVal(idxGender)!) : existingUser?.gender,
            birthDate: getVal(idxBirthDate) || existingUser?.birthDate,
            department: getVal(idxDepartment) || existingUser?.department,
            grade: getVal(idxGrade) || existingUser?.grade,
            classNumber: getVal(idxClassNumber) || existingUser?.classNumber,
            attendanceNumber: getVal(idxAttendanceNumber) || existingUser?.attendanceNumber,
            club: getVal(idxClub) || existingUser?.club,
            previousSchool: getVal(idxPrevSchool) || existingUser?.previousSchool,
            phoneNumber: getVal(idxPhone) || existingUser?.phoneNumber,
            organizationAddress: getVal(idxAddress) || existingUser?.organizationAddress,
            accountValidStartDate: getVal(idxValidStart) || existingUser?.accountValidStartDate,
            accountValidEndDate: getVal(idxValidEnd) || existingUser?.accountValidEndDate,

            _primaryPositionId: "" 
          });
        }
        
        setPreviewData(parsedRows);
        setStep(2);
      } catch (error) {
        showAlert("error", "CSVの読み込み中にエラーが発生しました。");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleBulkPositionChange = (posId: string) => {
    setBulkPositionId(posId);
    setPreviewData(prev => prev.map(row => {
      const posObj = positions.find(p => p.id === posId);
      let isValid = true;
      if (posObj?.isInternal) {
        if (posObj.isStudent && !["admin", "guest", "student", "officer"].includes(row.role)) isValid = false;
        if (!posObj.isStudent && !["admin", "guest", "teacher"].includes(row.role)) isValid = false;
      }
      return { ...row, _primaryPositionId: isValid ? posId : "" };
    }));
  };

  const updateRowPosition = (index: number, posId: string) => {
    setPreviewData(prev => {
      const next = [...prev];
      next[index]._primaryPositionId = posId;
      return next;
    });
  };

  const updateNameSelection = (index: number, selectedName: string) => {
    setPreviewData(prev => {
      const next = [...prev];
      next[index]._selectedName = selectedName;
      next[index].name = selectedName;
      
      if (!next[index].email.includes("@")) {
        next[index]._error = "無効なメールアドレス";
      } else {
        next[index]._error = undefined;
        next[index]._selected = true;
      }
      return next;
    });
  };

  const toggleRowSelection = (index: number, checked: boolean) => {
    setPreviewData(prev => {
      const next = [...prev];
      if (!next[index]._error) {
        next[index]._selected = checked;
      }
      return next;
    });
  };

  const toggleAllSelection = (checked: boolean) => {
    setPreviewData(prev => prev.map(r => r._error ? r : { ...r, _selected: checked }));
  };

  const handleExecuteUpload = async () => {
    const validRows = previewData.filter(r => !r._error && r._selected);
    
    if (validRows.length === 0) {
      showAlert("warning", "登録可能な行が選択されていません。");
      return;
    }

    setIsUploading(true);
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const row of validRows) {
        try {
          const { _csvIndex, _isUpdate, _docId, _error, _primaryPositionId, _selected, _nameCandidates, _selectedName, ...userDataToSave } = row;
          
          if (!_isUpdate && row.initialPassword) {
            const authRes = await fetch('/api/admin/create-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'create',
                uid: _docId,
                email: row.email,
                password: row.initialPassword,
                displayName: row.name
              })
            });
            if (!authRes.ok) throw new Error("Authenticationの作成に失敗しました");
          }

          const posObj = _primaryPositionId ? positions.find(p => p.id === _primaryPositionId) : null;
          const existingUser = users.find(u => u.id === _docId);
          let newPositionIds = existingUser?.positionIds ? [...existingUser.positionIds] : [];
          
          if (posObj && !newPositionIds.includes(posObj.id)) {
            newPositionIds.push(posObj.id);
          }

          const dataToSave = {
            ...userDataToSave,
            positionIds: newPositionIds,
            primaryPositionId: posObj ? posObj.id : (existingUser?.primaryPositionId || ""),
            positionName: posObj ? posObj.name : (existingUser?.positionName || ""),
            id: _docId,
          };
          
          Object.keys(dataToSave).forEach(key => {
            if ((dataToSave as any)[key] === undefined) {
              delete (dataToSave as any)[key];
            }
          });
          
          await setDoc(doc(db, "users", _docId), dataToSave, { merge: true });
          successCount++;
        } catch (e) {
          console.error(`Row ${row._csvIndex} error:`, e);
          errorCount++;
        }
      }
      
      await fetchUsers(schoolData!.id);
      
      if (errorCount === 0) {
        showAlert("success", `${successCount}件のユーザー登録・更新が完了しました！`);
        onClose();
      } else {
        showAlert("warning", `${successCount}件成功、${errorCount}件の登録に失敗しました。`);
      }
      
    } catch (error) {
      console.error(error);
      showAlert("error", "アップロード処理中に重大なエラーが発生しました。");
    } finally {
      setIsUploading(false);
    }
  };

  const isAllSelected = previewData.length > 0 && previewData.filter(r => !r._error).every(r => r._selected);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 flex-shrink-0">
          <div className="flex items-center">
            <div className="bg-indigo-100 p-2 rounded-xl mr-3"><FileSpreadsheet className="h-5 w-5 text-indigo-600" /></div>
            <div>
              <h3 className="text-sm font-black text-gray-900">アカウント一括登録 (CSV)</h3>
              <p className="text-[10px] font-bold text-gray-500">Google Workspace 等から書き出したCSVをそのまま取り込めます</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-xs font-black text-blue-900 mb-1">CSVファイルのフォーマットについて</h4>
                  <p className="text-[10px] font-bold text-blue-800 leading-relaxed mb-3">
                    1行目はヘッダー行として認識されます。<br/>
                    必須列: <code>name</code> または <code>名前</code>, <code>email</code> または <code>メールアドレス</code><br/>
                    ※ すでに存在するメールアドレスの場合は、自動で情報が「更新（上書き）」されます。<br/>
                    ※ 氏名（名字と名前の間）にスペースがない場合、プレビュー画面で位置を選択する必要があります。<br/>
                    ※ 新規追加ユーザーには、自動的に8桁の<strong className="text-indigo-600">初期パスワード</strong>が付与されます。<br/>
                    ※ システムIDは自動で「6桁（ゼロ埋め）」にフォーマットされて登録されます。
                  </p>
                  <button onClick={downloadTemplate} className="inline-flex items-center px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-[10px] font-bold rounded-lg shadow-sm hover:bg-blue-50 transition-colors">
                    <Download className="w-3.5 h-3.5 mr-1.5"/> 全項目テンプレート(サンプル)をダウンロード
                  </button>
                </div>
              </div>

              <div className="text-center">
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full flex flex-col items-center justify-center p-10 border-2 border-dashed border-gray-300 rounded-2xl hover:bg-indigo-50 hover:border-indigo-400 transition-all group disabled:opacity-50">
                  {isUploading ? (
                    <><Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-3" /><span className="text-xs font-bold text-gray-600">読み込み中...</span></>
                  ) : (
                    <><div className="bg-indigo-100 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform"><Upload className="h-8 w-8 text-indigo-600" /></div><span className="text-sm font-black text-indigo-700 mb-1">ファイルを選択してアップロード</span></>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-gray-900">プレビューと役職の設定 ({previewData.length}件)</h4>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-bold text-gray-700">追加するユーザー全員に同じ役職を付与する：</span>
                <select value={bulkPositionId} onChange={e => handleBulkPositionChange(e.target.value)} className="text-xs font-bold border border-gray-300 px-3 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-[200px]">
                  {renderPositionOptions("all")}
                </select>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="min-w-full divide-y divide-gray-200 text-left whitespace-nowrap">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-center w-10">
                          <input 
                            type="checkbox" 
                            checked={isAllSelected}
                            onChange={(e) => toggleAllSelection(e.target.checked)}
                            className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 rounded cursor-pointer"
                          />
                        </th>
                        <th className="px-4 py-2 text-[10px] font-black text-gray-500">状態</th>
                        <th className="px-4 py-2 text-[10px] font-black text-gray-500">名前</th>
                        <th className="px-4 py-2 text-[10px] font-black text-gray-500">メールアドレス</th>
                        <th className="px-4 py-2 text-[10px] font-black text-gray-500">権限</th>
                        <th className="px-4 py-2 text-[10px] font-black text-gray-500 text-indigo-600">発行パスワード</th>
                        <th className="px-4 py-2 text-[10px] font-black text-gray-500">付与する役職 (優先)</th>
                        <th className="px-4 py-2 text-[10px] font-black text-gray-500">システムID</th>
                        <th className="px-4 py-2 text-[10px] font-black text-gray-500">学籍/教番</th>
                        <th className="px-4 py-2 text-[10px] font-black text-gray-500">所属</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {previewData.slice(0, 100).map((row, i) => (
                        <tr key={i} className={`${row._error ? "bg-red-50" : row._selected ? "bg-indigo-50/20" : "bg-white"} hover:bg-gray-50`}>
                          <td className="px-4 py-2 text-center">
                            <input 
                              type="checkbox" 
                              checked={row._selected}
                              disabled={!!row._error}
                              onChange={(e) => toggleRowSelection(i, e.target.checked)}
                              className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 rounded cursor-pointer disabled:opacity-30"
                            />
                          </td>
                          <td className="px-4 py-2 text-[10px] font-bold">
                            {row._error ? <span className="text-red-600">{row._error}</span> : row._isUpdate ? <span className="text-blue-600">更新</span> : <span className="text-green-600">新規</span>}
                          </td>
                          <td className="px-4 py-2 text-xs font-black text-gray-900">
                            {row._nameCandidates && row._nameCandidates.length > 0 ? (
                              <select 
                                value={row._selectedName || ""} 
                                onChange={(e) => updateNameSelection(i, e.target.value)}
                                className={`w-full border ${row._selectedName ? 'border-gray-200' : 'border-red-400 bg-red-50'} rounded-lg px-2 py-1 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500`}
                              >
                                <option value="" disabled>スペース位置を選択</option>
                                {row._nameCandidates.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            ) : (
                              row.name
                            )}
                          </td>
                          <td className="px-4 py-2 text-[10px] font-bold text-gray-500">{row.email}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${row.role==='admin'?'bg-red-100 text-red-700':row.role==='teacher'?'bg-purple-100 text-purple-700':row.role==='officer'?'bg-indigo-100 text-indigo-700':'bg-gray-100 text-gray-700'}`}>
                              {row.role}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs font-mono font-bold text-red-500">
                            {row.initialPassword || "-"}
                          </td>
                          <td className="px-4 py-2">
                            <select value={row._primaryPositionId || ""} onChange={(e) => updateRowPosition(i, e.target.value)} disabled={!row._selected || !!row._error} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 bg-white disabled:bg-gray-50">
                              {renderPositionOptions(row.role)}
                            </select>
                          </td>
                          <td className="px-4 py-2 text-[10px] text-gray-500 font-mono">{row.systemId || "-"}</td>
                          <td className="px-4 py-2 text-[10px] text-gray-500">{row.studentId || "-"}</td>
                          <td className="px-4 py-2 text-[10px] text-gray-500">{row.department || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {previewData.length > 100 && <p className="text-[10px] text-gray-400 text-center mt-2 font-bold">※プレビューは100件まで表示されますが、登録は選択された全件実行されます。</p>}
            </div>
          )}
        </div>

        {step === 2 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center flex-shrink-0">
            <div className="text-[10px] font-bold text-gray-500">
              選択中: <span className="text-indigo-600 font-black text-xs">{previewData.filter(r => r._selected).length}</span> 件
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} disabled={isUploading} className="px-5 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 transition-colors">戻る</button>
              <button onClick={handleExecuteUpload} disabled={isUploading || previewData.filter(r => r._selected).length === 0} className="px-6 py-2 border border-transparent rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center transition-colors shadow-sm disabled:opacity-50">
                {isUploading ? <><Loader2 className="animate-spin h-4 w-4 mr-2" /> 登録中...</> : <><CheckCircle2 className="h-4 w-4 mr-2" /> 選択したユーザーを登録</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}