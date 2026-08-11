"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, collection, serverTimestamp, getDocs, query, where, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Eye, EyeOff, Check, X, ShieldCheck, KeyRound, Building2 } from "lucide-react";
import Link from "next/link";

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

  // ★ 役職登録用のステート
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
        // 代表者の役割から初期の役職ターゲットを推測
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

  // システム利用番号のフォーマット処理（半角数字のみ抽出して6桁ゼロ埋め）
  const handleSystemIdChange = (val: string) => {
    const numeric = val.replace(/[^0-9]/g, "");
    setSystemId(numeric);
  };

  const getFormattedSystemId = () => {
    if (!systemId) return "未設定 (000000)";
    return systemId.padStart(6, '0');
  };

  // パスワード要件のリアルタイム判定
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

      // 1. Firebase Authにアカウント作成
      const userCredential = await createUserWithEmailAndPassword(auth, appData.email, password);
      const user = userCredential.user;

      // 2. 学校(テナント)の正式登録
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

      // 3. デフォルト組織（生徒会本部など）を初期作成し、そのIDを取得する
      const defaultOrgRef = doc(collection(db, "organizations"));
      await setDoc(defaultOrgRef, {
        schoolId: schoolId,
        name: "生徒会本部・執行本部",
        displayOrder: 1,
        isHidden: false,
        isDefault: true,
        createdAt: serverTimestamp(),
      });

      // 4. 初めての役職（管理者用）を positions コレクションに自動作成 (shokui: 1, displayOrder: 1)
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

      // 5. アカウント管理者（テナント管理者）の正式登録を users コレクションに保存
      await setDoc(doc(db, "users", user.uid), {
        id: user.uid,
        schoolId: schoolId,
        schoolName: appData.schoolName,
        authProviders: ["email", "password"],
        email: appData.email,
        name: appData.repName,
        nameKana: nameKana,
        userType: appData.repRole,
        role: "admin", // テナント管理者として設定
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

      // 6. 一時保存データの削除
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
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-medium text-sm">データを取得中...</div>;
  }

  if (errorMsg && !appData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm max-w-md w-full text-center border-t-4 border-red-500">
          <h2 className="text-lg font-black text-gray-900 mb-2">エラー</h2>
          <p className="text-xs sm:text-sm text-gray-600">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (successMsg) {
    const formattedId = systemId ? systemId.padStart(6, '0') : "未設定";

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm max-w-lg w-full text-center border-t-4 border-emerald-500">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Check size={26} strokeWidth={3} />
          </div>
          <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-1">{successMsg}</h2>
          <p className="text-xs text-gray-500 mb-6">以下のログイン情報を必ずお手元にお控えください。</p>
          
          <div className="bg-yellow-50/80 border border-yellow-200 rounded-2xl p-4 sm:p-6 mb-6 text-left space-y-4">
            {/* テナントコード */}
            <div>
              <p className="text-[11px] sm:text-xs text-yellow-800 font-bold mb-1 flex items-center gap-1.5">
                <Building2 size={14} className="text-yellow-700" />
                テナントID
              </p>
              <p className="text-xl sm:text-2xl font-mono text-yellow-900 bg-white px-3.5 py-2.5 border border-yellow-200 rounded-xl text-center tracking-wider font-bold shadow-sm">{appData.schoolCode}</p>
            </div>

            {/* システム利用番号 */}
            <div>
              <p className="text-[11px] sm:text-xs text-yellow-800 font-bold mb-1 flex items-center gap-1.5">
                <KeyRound size={14} className="text-yellow-700" />
                システム利用番号
              </p>
              <p className="text-xl sm:text-2xl font-mono text-yellow-900 bg-white px-3.5 py-2.5 border border-yellow-200 rounded-xl text-center tracking-widest font-bold shadow-sm">{formattedId}</p>
            </div>

            {/* パスワード */}
            <div>
              <p className="text-[11px] sm:text-xs text-yellow-800 font-bold mb-1">設定したパスワード</p>
              <p className="text-sm font-mono text-yellow-900 bg-white px-3 py-2 border border-yellow-200 rounded-xl text-center text-gray-600 font-medium">（ご自身で設定したパスワード）</p>
            </div>

            {/* ログイン方法の案内 */}
            <div className="bg-white/80 border border-yellow-300/60 rounded-xl p-3 mt-3">
              <p className="text-[11px] text-yellow-900 font-bold leading-relaxed text-center">
                <strong>＝　次のログイン画面での使い方　＝</strong><br/><br/>
                ログイン画面にて<br/>「システム利用番号」でログインを選択し<br/>上記の<span className="text-blue-600 font-mono ">「テナントID」</span> と <span className="text-blue-600 font-mono ">「システム利用番号」</span>を<br/>入力することでログイン出来ます。
              </p>
            </div>
          </div>

          <button onClick={() => window.location.href = '/login'} className="w-full bg-blue-600 text-white py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm hover:bg-blue-700 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5">
            ログイン画面へ進む
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-12 px-3 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white p-4 sm:p-8 shadow-sm rounded-2xl sm:rounded-3xl border border-gray-100">
        <h2 className="text-xl sm:text-2xl font-black text-gray-900 text-center mb-4 sm:mb-6 tracking-tight">テナント本登録・初期セットアップ</h2>
        
        {errorMsg && (
          <div className="mb-6 p-3.5 rounded-xl text-xs sm:text-sm font-bold bg-red-50 text-red-800 border border-red-200">{errorMsg}</div>
        )}

        <div className="bg-gray-50 p-3.5 sm:p-4 rounded-xl mb-6 sm:mb-8 border border-gray-200/60">
          <p className="text-xs sm:text-sm text-gray-700 mb-1"><strong>学校名:</strong> {appData.schoolName}</p>
          <p className="text-xs sm:text-sm text-gray-700 mb-1"><strong>氏名:</strong> {appData.repName}</p>
          <p className="text-xs sm:text-sm text-gray-700"><strong>メールアドレス:</strong> {appData.email}</p>
          <p className="text-[10px] sm:text-xs text-blue-600 mt-2 font-bold">※この情報は事前申請時のものが反映されています。</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          
          {/* 1. パスワード設定 */}
          <div className="bg-blue-50/60 p-4 sm:p-6 rounded-2xl border border-blue-100">
            <label className="block text-xs sm:text-sm font-black text-gray-900 mb-3">ログインパスワードの設定 <span className="text-red-500">*</span></label>
            <div className="space-y-3 sm:space-y-4">
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} 
                  className="block w-full border border-gray-300 rounded-xl py-2.5 sm:py-3 px-3.5 sm:px-4 pr-12 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white outline-none font-medium" placeholder="新しいパスワード" 
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="relative">
                <input 
                  type={showPasswordConfirm ? "text" : "password"} required value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} 
                  className="block w-full border border-gray-300 rounded-xl py-2.5 sm:py-3 px-3.5 sm:px-4 pr-12 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white outline-none font-medium" placeholder="新しいパスワード（確認用）" 
                />
                <button type="button" onClick={() => setShowPasswordConfirm(!showPasswordConfirm)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none">
                  {showPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <ul className="mt-3 text-xs sm:text-sm space-y-1.5 font-bold">
                <li className={`flex items-center transition-colors ${hasMinLength ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {hasMinLength ? <Check size={14} className="mr-2 shrink-0" /> : <X size={14} className="mr-2 shrink-0" />}
                  8文字以上
                </li>
                <li className={`flex items-center transition-colors ${hasEnoughTypes ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {hasEnoughTypes ? <Check size={14} className="mr-2 shrink-0" /> : <X size={14} className="mr-2 shrink-0" />}
                  小文字、大文字、数字、記号のうち3種類以上を使用
                </li>
                <li className={`flex items-center transition-colors ${isPasswordMatch ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {isPasswordMatch ? <Check size={14} className="mr-2 shrink-0" /> : <X size={14} className="mr-2 shrink-0" />}
                  パスワードが一致している
                </li>
              </ul>
            </div>
          </div>

          {/* ★ 2. 管理者の役職設定 */}
          <div className="bg-indigo-50/60 p-4 sm:p-6 rounded-2xl border border-indigo-100">
            <h3 className="text-xs sm:text-sm font-black text-gray-900 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              テナント管理者としての役職設定 <span className="text-red-500">*</span>
            </h3>
            <p className="text-[11px] font-bold text-gray-500 mb-4 leading-relaxed">
              システム内であなたに割り当てる最初の役職を定義します
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">１．区分を選択 <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPositionTargetType("student")}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                      positionTargetType === "student"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    生徒
                  </button>
                  <button
                    type="button"
                    onClick={() => setPositionTargetType("teacher")}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                      positionTargetType === "teacher"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    教職員
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">２．役職名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={positionNameInput}
                  onChange={(e) => setPositionNameInput(e.target.value)}
                  className="block w-full border border-gray-300 rounded-xl py-2.5 px-3.5 text-xs sm:text-sm bg-white focus:ring-blue-500 focus:border-blue-500 outline-none font-bold"
                  placeholder="例: 生徒会長、生徒会顧問、学校長など"
                />
              </div>
            </div>
          </div>

          {/* 3. 基本情報 */}
          <div>
            <h3 className="text-base sm:text-lg font-black text-gray-900 border-b border-gray-200 pb-2 mb-4">基本情報</h3>
            <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ふりがな</label>
                <input type="text" value={nameKana} onChange={(e) => setNameKana(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="例: くまもと たろう" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">性別</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-xl py-2 px-3 text-xs sm:text-sm bg-white focus:ring-blue-500 focus:border-blue-500 outline-none">
                  <option value="">選択しない</option>
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">生年月日</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">システム利用番号（役員番号等）</label>
                <input 
                  type="text" 
                  maxLength={6}
                  value={systemId} 
                  onChange={(e) => handleSystemIdChange(e.target.value)} 
                  onBlur={() => {
                    if (systemId) setSystemId(getFormattedSystemId().replace(/[^0-9]/g, ''));
                  }}
                  className="mt-1 block w-full border border-gray-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:ring-blue-500 focus:border-blue-500 outline-none font-mono" 
                  placeholder="例: 123（自動で6桁になります）" 
                />
                <p className="text-[10px] text-gray-500 mt-1">※半角数字で必ず6桁です（未入力時は空、入力時は先頭に0が補完され `{getFormattedSystemId()}` となります）。</p>
              </div>
            </div>
          </div>

          {/* 4. 学校・所属情報 */}
          <div>
            <h3 className="text-base sm:text-lg font-black text-gray-900 border-b border-gray-200 pb-2 mb-4">学校・所属情報</h3>
            <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-6 sm:gap-x-4">
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">学籍番号</label>
                <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:ring-blue-500 focus:border-blue-500 font-mono outline-none" placeholder="例: 20261234" />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">出身学校</label>
                <input type="text" value={previousSchool} onChange={(e) => setPreviousSchool(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="例: ○○中学校" />
              </div>

              {/* 学年・組・出席番号を横1列（3カラム）に配置 */}
              <div className="sm:col-span-6 grid grid-cols-3 gap-2 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">学年</label>
                  <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="例: 2" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">組（クラス）</label>
                  <input type="text" value={classNumber} onChange={(e) => setClassNumber(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="例: A" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">出席番号</label>
                  <input type="text" value={attendanceNumber} onChange={(e) => setAttendanceNumber(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="例: 15" />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">所属部署・コース</label>
                <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="例: 普通科 理数コース" />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">部活・クラブ</label>
                <input type="text" value={club} onChange={(e) => setClub(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="例: バスケットボール部" />
              </div>

              <div className="sm:col-span-2 flex items-center pt-2 sm:pt-6">
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isITManager} 
                    onChange={(e) => setIsITManager(e.target.checked)} 
                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded" 
                  />
                  <span className="ml-2 text-xs sm:text-sm font-bold text-gray-800">IT担当者</span>
                </label>
              </div>
            </div>
          </div>

          {/* 5. 連絡先・その他 */}
          <div>
            <h3 className="text-base sm:text-lg font-black text-gray-900 border-b border-gray-200 pb-2 mb-4">連絡先・その他</h3>
            <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">電話番号</label>
                <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="例: 090-1234-5678" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">所属組織の住所</label>
                <input type="text" value={organizationAddress} onChange={(e) => setOrganizationAddress(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"  />
              </div>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting || !isPasswordValid || !positionNameInput.trim()} className={`w-full py-3.5 sm:py-4 px-4 rounded-xl font-bold text-white shadow-md transition-all text-sm sm:text-base ${isSubmitting || !isPasswordValid || !positionNameInput.trim() ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5"}`}>
            {isSubmitting ? "登録処理中..." : "この内容で本登録を完了する"}
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-1.5 text-[10px] font-bold text-gray-400 text-center mt-8">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          <Link href="/legal/terms" className="hover:text-gray-600 transition-colors">利用規約</Link>
          <Link href="/legal/privacy" className="hover:text-gray-600 transition-colors">プライバシー</Link>
          <Link href="/legal/commercial" className="hover:text-gray-600 transition-colors">特定商取引法</Link>
        </div>
        <div className="text-[9px] text-gray-500">
          &copy; {new Date().getFullYear()} YORIKURU / 生徒会ポータルシステム
        </div>
      </div>

    </div>
  );
}

export default function ApplyCompletePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>}>
      <CompleteForm />
    </Suspense>
  );
}