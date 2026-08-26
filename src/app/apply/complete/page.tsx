"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, collection, serverTimestamp, getDocs, query, where, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Eye, EyeOff, Check, X, ShieldCheck, KeyRound, Building2 } from "lucide-react";
import Link from "next/link";
import CustomSelect from "@/components/CustomSelect"; // ★ カスタムセレクトを導入

function CompleteForm() {
  const searchParams = useSearchParams();
  const appId = searchParams.get("appId");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // 事前情報
  const [appData, setAppData] = useState<any>(null);

  // パスワード設定
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // 役職登録用のステート
  const [positionTargetType, setPositionTargetType] = useState<"student" | "teacher">("student");
  const [positionNameInput, setPositionNameInput] = useState("");

  // 追加の登録情報
  const [nameKana, setNameKana] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [systemId, setSystemId] = useState("");
  
  const [studentId, setStudentId] = useState("");
  const [previousSchool, setPreviousSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [classNumber, setClassNumber] = useState("");
  const [attendanceNumber, setAttendanceNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [club, setClub] = useState("");
  
  const [isITManager, setIsITManager] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [organizationAddress, setOrganizationAddress] = useState("");

  useEffect(() => {
    const fetchApplication = async () => {
      if (!appId) {
        setErrorMsg("無効なアクセスです。申請URLが正しくありません。");
        setIsLoading(false);
        return;
      }

      try {
        const appDocRef = doc(db, "tenant_applications", appId);
        const appDocSnap = await getDoc(appDocRef);

        if (!appDocSnap.exists()) {
          setErrorMsg("申請データが見つかりません。既に登録が完了しているか、URLが間違っています。");
          setIsLoading(false);
          return;
        }
        
        const data = appDocSnap.data();
        setAppData(data);
        if (data.repRole === "teacher") {
          setPositionTargetType("teacher");
        }
      } catch (error) {
        console.error("Fetch application error:", error);
        setErrorMsg("データの取得中にエラーが発生しました。");
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplication();
  }, [appId]);

  const handleSystemIdChange = (val: string) => {
    const numeric = val.replace(/[^0-9]/g, "");
    setSystemId(numeric);
  };

  const getFormattedSystemId = () => {
    if (!systemId) return "未設定 (000000)";
    return systemId.padStart(6, '0');
  };

  const hasMinLength = password.length >= 8;
  
  let typesCount = 0;
  if (/[a-z]/.test(password)) typesCount++;
  if (/[A-Z]/.test(password)) typesCount++;
  if (/[0-9]/.test(password)) typesCount++;
  if (/[^a-zA-Z0-9]/.test(password)) typesCount++;
  const hasEnoughTypes = typesCount >= 3;

  const isPasswordMatch = password !== "" && password === passwordConfirm;
  const isPasswordValid = hasMinLength && hasEnoughTypes && isPasswordMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!isPasswordValid) {
      setErrorMsg("パスワードの条件を満たしていません。");
      return;
    }
    if (!positionNameInput.trim()) {
      setErrorMsg("管理者用の役職名を入力してください。");
      return;
    }

    setIsSubmitting(true);

    try {
      const finalSystemId = systemId ? systemId.padStart(6, '0') : "";

      const userCredential = await createUserWithEmailAndPassword(auth, appData.email, password);
      const user = userCredential.user;

      const newSchoolRef = doc(collection(db, "schools"));
      await setDoc(newSchoolRef, {
        name: appData.schoolName,
        schoolType: appData.schoolType,
        schoolCode: appData.schoolCode,
        adminName: appData.repName,
        adminEmail: appData.email,
        createdAt: serverTimestamp(),
      });

      const schoolId = newSchoolRef.id;

      const defaultOrgRef = doc(collection(db, "organizations"));
      await setDoc(defaultOrgRef, {
        schoolId: schoolId,
        name: "生徒会本部・執行本部",
        displayOrder: 1,
        isHidden: false,
        isDefault: true,
        createdAt: serverTimestamp(),
      });

      const newPosRef = doc(collection(db, "positions"));
      const isStudentRole = positionTargetType === "student";
      await setDoc(newPosRef, {
        schoolId: schoolId,
        name: positionNameInput.trim(),
        organizationId: defaultOrgRef.id,
        isStudent: isStudentRole,
        isInternal: true,
        shokui: 1,
        displayOrder: 1,
        capacity: null,
        description: "テナント初回セットアップ時に自動作成された管理者役職",
        leaderUserId: user.uid,
        leaderTitle: positionNameInput.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, "users", user.uid), {
        id: user.uid,
        schoolId: schoolId,
        schoolName: appData.schoolName,
        authProviders: ["email", "password"],
        email: appData.email,
        name: appData.repName,
        nameKana: nameKana,
        userType: appData.repRole,
        role: "admin", 
        accountStatus: "active", 
        systemId: finalSystemId,
        gender: gender,
        birthDate: birthDate,
        studentId: studentId,
        previousSchool: previousSchool,
        grade: grade,
        classNumber: classNumber,
        attendanceNumber: attendanceNumber,
        department: department,
        club: club,
        positionIds: [newPosRef.id],
        primaryPositionId: newPosRef.id,
        positionName: positionNameInput.trim(),
        isITManager: isITManager,
        phoneNumber: phoneNumber,
        organizationAddress: organizationAddress,
        createdAt: serverTimestamp(),
      });

      await deleteDoc(doc(db, "tenant_applications", appId as string));

      setSuccessMsg("本登録とパスワード設定が完了しました！");
    } catch (error: any) {
      console.error("Final registration error:", error);
      let errMsg = "本登録処理に失敗しました。";
      if (error.code === "auth/email-already-in-use") {
        errMsg = "このメールアドレスは既にシステムに登録されています。";
      }
      setErrorMsg(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-bold text-xs">データを取得中...</div>;
  }

  if (errorMsg && !appData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm max-w-sm w-full text-center border-t-4 border-red-500">
          <h2 className="text-sm font-black text-gray-900 mb-1.5">エラー</h2>
          <p className="text-[11px] sm:text-xs text-gray-600 font-bold">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (successMsg) {
    const formattedId = systemId ? systemId.padStart(6, '0') : "未設定";

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm max-w-sm w-full text-center border-t-4 border-emerald-500">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2.5 shadow-inner">
            <Check size={22} strokeWidth={3} />
          </div>
          <h2 className="text-sm sm:text-base font-black text-gray-900 mb-1">{successMsg}</h2>
          <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 mb-4">以下のログイン情報を必ずお手元にお控えください。</p>
          
          <div className="bg-yellow-50/80 border border-yellow-200 rounded-xl p-3 sm:p-4 mb-5 text-left space-y-3">
            <div>
              <p className="text-[10px] text-yellow-800 font-black mb-1 flex items-center gap-1">
                <Building2 size={12} className="text-yellow-700" /> テナントID
              </p>
              <p className="text-lg font-mono text-yellow-900 bg-white px-3 py-2 border border-yellow-200 rounded-lg text-center tracking-wider font-black shadow-2xs">{appData.schoolCode}</p>
            </div>
            <div>
              <p className="text-[10px] text-yellow-800 font-black mb-1 flex items-center gap-1">
                <KeyRound size={12} className="text-yellow-700" /> システム利用番号
              </p>
              <p className="text-lg font-mono text-yellow-900 bg-white px-3 py-2 border border-yellow-200 rounded-lg text-center tracking-widest font-black shadow-2xs">{formattedId}</p>
            </div>
            <div>
              <p className="text-[10px] text-yellow-800 font-black mb-1">設定したパスワード</p>
              <p className="text-[11px] font-mono text-gray-500 bg-white px-2 py-1.5 border border-yellow-200 rounded-lg text-center font-bold">（ご自身で設定したパスワード）</p>
            </div>
            <div className="bg-white/80 border border-yellow-300/60 rounded-lg p-2.5 mt-2">
              <p className="text-[9px] sm:text-[10px] text-yellow-900 font-bold leading-relaxed text-center">
                ログイン画面にて「システム利用番号」でログインを選択し<br/>上記の<span className="text-blue-600 font-mono">「テナントID」</span> と <span className="text-blue-600 font-mono">「システム利用番号」</span>を<br/>入力することでログイン出来ます。
              </p>
            </div>
          </div>

          <button onClick={() => window.location.href = '/login'} className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-xl font-bold text-xs hover:bg-blue-700 transition-all shadow-sm hover:-translate-y-0.5">
            ログイン画面へ進む
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 px-2 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto bg-white p-3.5 sm:p-6 shadow-sm rounded-2xl border border-gray-100">
        <h2 className="text-base sm:text-lg font-black text-gray-900 text-center mb-3 sm:mb-4 tracking-tight">テナント本登録・初期セットアップ</h2>
        
        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-lg text-[10px] sm:text-xs font-bold bg-red-50 text-red-800 border border-red-200">{errorMsg}</div>
        )}

        <div className="bg-gray-50 p-2.5 sm:p-3 rounded-lg mb-5 border border-gray-200/60">
          <p className="text-[11px] sm:text-xs font-bold text-gray-700 mb-0.5">学校名: <span className="font-medium">{appData.schoolName}</span></p>
          <p className="text-[11px] sm:text-xs font-bold text-gray-700 mb-0.5">氏名: <span className="font-medium">{appData.repName}</span></p>
          <p className="text-[11px] sm:text-xs font-bold text-gray-700">メール: <span className="font-medium">{appData.email}</span></p>
          <p className="text-[9px] text-blue-600 mt-1 font-bold">※事前申請時の情報です</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          
          {/* 1. パスワード設定 */}
          <div className="bg-blue-50/60 p-3 sm:p-4 rounded-xl border border-blue-100">
            <label className="block text-xs font-black text-gray-900 mb-2">ログインパスワードの設定 <span className="text-red-500">*</span></label>
            <div className="space-y-2.5">
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} 
                  className="block w-full border border-gray-300 rounded-lg py-2 sm:py-2.5 px-3 pr-10 focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm bg-white outline-none font-bold" placeholder="新しいパスワード" 
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <div className="relative">
                <input 
                  type={showPasswordConfirm ? "text" : "password"} required value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} 
                  className="block w-full border border-gray-300 rounded-lg py-2 sm:py-2.5 px-3 pr-10 focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm bg-white outline-none font-bold" placeholder="新しいパスワード（確認用）" 
                />
                <button type="button" onClick={() => setShowPasswordConfirm(!showPasswordConfirm)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none">
                  {showPasswordConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <ul className="mt-2 text-[10px] space-y-1 font-bold">
                <li className={`flex items-center transition-colors ${hasMinLength ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {hasMinLength ? <Check size={12} className="mr-1.5 shrink-0" /> : <X size={12} className="mr-1.5 shrink-0" />} 8文字以上
                </li>
                <li className={`flex items-center transition-colors ${hasEnoughTypes ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {hasEnoughTypes ? <Check size={12} className="mr-1.5 shrink-0" /> : <X size={12} className="mr-1.5 shrink-0" />} 小文字/大文字/数字/記号のうち3種以上
                </li>
                <li className={`flex items-center transition-colors ${isPasswordMatch ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {isPasswordMatch ? <Check size={12} className="mr-1.5 shrink-0" /> : <X size={12} className="mr-1.5 shrink-0" />} パスワードが一致
                </li>
              </ul>
            </div>
          </div>

          {/* 2. 管理者の役職設定 */}
          <div className="bg-indigo-50/60 p-3 sm:p-4 rounded-xl border border-indigo-100">
            <h3 className="text-[11px] sm:text-xs font-black text-gray-900 mb-0.5 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              テナント管理者としての役職設定 <span className="text-red-500">*</span>
            </h3>
            <p className="text-[9px] font-bold text-gray-500 mb-2.5">システム内であなたに割り当てる最初の役職を定義します</p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 mb-1.5">１．区分を選択 <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPositionTargetType("student")}
                    className={`py-1.5 px-3 rounded-lg text-[11px] font-bold border transition-all ${
                      positionTargetType === "student" ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    生徒
                  </button>
                  <button
                    type="button"
                    onClick={() => setPositionTargetType("teacher")}
                    className={`py-1.5 px-3 rounded-lg text-[11px] font-bold border transition-all ${
                      positionTargetType === "teacher" ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    教職員
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 mb-1">２．役職名 <span className="text-red-500">*</span></label>
                <input
                  type="text" required value={positionNameInput} onChange={(e) => setPositionNameInput(e.target.value)}
                  className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-[11px] sm:text-xs bg-white focus:ring-blue-500 focus:border-blue-500 outline-none font-bold shadow-sm"
                  placeholder="例: 生徒会長、顧問など"
                />
              </div>
            </div>
          </div>

          {/* 3. 基本情報 */}
          <div>
            <h3 className="text-xs sm:text-sm font-black text-gray-900 border-b border-gray-200 pb-1.5 mb-2.5">基本情報</h3>
            <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 mb-0.5">ふりがな</label>
                <input type="text" value={nameKana} onChange={(e) => setNameKana(e.target.value)} className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-[11px] sm:text-xs focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm font-bold" placeholder="例: くまもと たろう" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 mb-0.5">性別</label>
                {/* ★ CustomSelect の適用 */}
                <CustomSelect 
                  value={gender} 
                  onChange={setGender}
                  options={[
                    { value: "", label: "選択しない" },
                    { value: "male", label: "男性" },
                    { value: "female", label: "女性" },
                    { value: "other", label: "その他" }
                  ]}
                  buttonClassName="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-[11px] sm:text-xs bg-white focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm font-bold flex items-center justify-between"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 mb-0.5">生年月日</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-[11px] sm:text-xs focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm font-bold" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 mb-0.5">システム利用番号（役員番号等）</label>
                <input 
                  type="text" maxLength={6} value={systemId} onChange={(e) => handleSystemIdChange(e.target.value)} 
                  onBlur={() => { if (systemId) setSystemId(getFormattedSystemId().replace(/[^0-9]/g, '')); }}
                  className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-[11px] sm:text-xs focus:ring-blue-500 focus:border-blue-500 outline-none font-mono shadow-sm font-bold" 
                  placeholder="例: 123（自動で6桁）" 
                />
                <p className="text-[8px] text-gray-500 mt-1">※半角数字6桁。未入力時は `{getFormattedSystemId()}`</p>
              </div>
            </div>
          </div>

          {/* 4. 学校・所属情報 */}
          <div>
            <h3 className="text-xs sm:text-sm font-black text-gray-900 border-b border-gray-200 pb-1.5 mb-2.5">学校・所属情報</h3>
            <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-6 sm:gap-x-3">
              <div className="sm:col-span-3">
                <label className="block text-[10px] font-bold text-gray-700 mb-0.5">学籍番号</label>
                <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-[11px] sm:text-xs focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm font-bold font-mono" placeholder="例: 20261234" />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[10px] font-bold text-gray-700 mb-0.5">出身学校</label>
                <input type="text" value={previousSchool} onChange={(e) => setPreviousSchool(e.target.value)} className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-[11px] sm:text-xs focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm font-bold" placeholder="例: ○○中学校" />
              </div>

              <div className="sm:col-span-6 grid grid-cols-3 gap-2 sm:gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 mb-0.5">学年</label>
                  <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-[11px] sm:text-xs focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm font-bold" placeholder="例: 2" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 mb-0.5">組</label>
                  <input type="text" value={classNumber} onChange={(e) => setClassNumber(e.target.value)} className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-[11px] sm:text-xs focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm font-bold" placeholder="例: A" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 mb-0.5">出席番号</label>
                  <input type="text" value={attendanceNumber} onChange={(e) => setAttendanceNumber(e.target.value)} className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-[11px] sm:text-xs focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm font-bold" placeholder="例: 15" />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[10px] font-bold text-gray-700 mb-0.5">部署・コース</label>
                <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-[11px] sm:text-xs focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm font-bold" placeholder="例: 普通科" />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[10px] font-bold text-gray-700 mb-0.5">部活・クラブ</label>
                <input type="text" value={club} onChange={(e) => setClub(e.target.value)} className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-[11px] sm:text-xs focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm font-bold" placeholder="例: 野球部" />
              </div>

              <div className="sm:col-span-6 flex items-center mt-1">
                <label className="flex items-center cursor-pointer bg-gray-50 border border-gray-200 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <input type="checkbox" checked={isITManager} onChange={(e) => setIsITManager(e.target.checked)} className="focus:ring-blue-500 h-3 w-3 text-blue-600 border-gray-300 rounded" />
                  <span className="ml-1.5 text-[10px] sm:text-xs font-bold text-gray-800">IT担当者として登録</span>
                </label>
              </div>
            </div>
          </div>

          {/* 5. 連絡先・その他 */}
          <div>
            <h3 className="text-xs sm:text-sm font-black text-gray-900 border-b border-gray-200 pb-1.5 mb-2.5">連絡先・その他</h3>
            <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 mb-0.5">電話番号</label>
                <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-[11px] sm:text-xs focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm font-bold" placeholder="例: 090-1234-5678" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-gray-700 mb-0.5">所属組織の住所</label>
                <input type="text" value={organizationAddress} onChange={(e) => setOrganizationAddress(e.target.value)} className="block w-full border border-gray-300 rounded-lg py-1.5 px-2.5 text-[11px] sm:text-xs focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm font-bold"  />
              </div>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting || !isPasswordValid || !positionNameInput.trim()} className={`w-full py-2.5 px-4 rounded-xl font-bold text-white shadow-sm transition-all text-xs sm:text-sm ${isSubmitting || !isPasswordValid || !positionNameInput.trim() ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5"}`}>
            {isSubmitting ? "登録処理中..." : "この内容で本登録を完了する"}
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-1 text-[9px] font-bold text-gray-400 text-center mt-6">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <Link href="/legal/terms" className="hover:text-gray-600 transition-colors">利用規約</Link>
          <Link href="/legal/privacy" className="hover:text-gray-600 transition-colors">プライバシー</Link>
          <Link href="/legal/commercial" className="hover:text-gray-600 transition-colors">特定商取引法</Link>
        </div>
        <div className="text-[8px] text-gray-500">
          &copy; {new Date().getFullYear()} YORIKURU / 生徒会ポータルシステム
        </div>
      </div>
    </div>
  );
}

export default function ApplyCompletePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500 font-bold text-xs">Loading...</div>}>
      <CompleteForm />
    </Suspense>
  );
}