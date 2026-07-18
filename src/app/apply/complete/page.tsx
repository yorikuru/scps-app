"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Eye, EyeOff, Check, X } from "lucide-react";

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
  
  const [positionName, setPositionName] = useState(""); 
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
        
        setAppData(appDocSnap.data());
      } catch (error) {
        console.error("Fetch application error:", error);
        setErrorMsg("データの取得中にエラーが発生しました。");
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplication();
  }, [appId]);

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

    setIsSubmitting(true);

    try {
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

      // 3. アカウント管理者の正式登録（省略なし）
      await setDoc(doc(db, "users", user.uid), {
        schoolId: newSchoolRef.id,
        schoolName: appData.schoolName,
        authProviders: ["email", "password"],
        email: appData.email,
        name: appData.repName,
        nameKana: nameKana,
        userType: appData.repRole,
        role: "admin", 
        accountStatus: "active", 
        systemId: systemId,
        gender: gender,
        birthDate: birthDate,
        studentId: studentId,
        previousSchool: previousSchool,
        grade: grade,
        classNumber: classNumber,
        attendanceNumber: attendanceNumber,
        department: department,
        club: club,
        positionName: positionName,
        isITManager: isITManager,
        phoneNumber: phoneNumber,
        organizationAddress: organizationAddress,
        createdAt: serverTimestamp(),
      });

      // 4. 一時保存データの削除
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
        <div className="bg-white p-8 rounded-lg shadow max-w-md w-full text-center border-t-4 border-red-500">
          <h2 className="text-xl font-bold text-gray-900 mb-2">エラー</h2>
          <p className="text-sm text-gray-600">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (successMsg) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white p-8 rounded-lg shadow max-w-md w-full text-center border-t-4 border-green-500">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{successMsg}</h2>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 mb-6 text-left">
            <p className="text-sm text-yellow-800 font-bold mb-1">あなたの学校コード</p>
            <p className="text-2xl font-mono text-yellow-900 bg-white px-3 py-2 border border-yellow-200 rounded text-center tracking-widest">{appData.schoolCode}</p>
            <p className="text-xs text-yellow-700 mt-2">※他の役員や教員を招待する際にこのコードが必要になります。必ず控えてください。</p>
          </div>

          <button onClick={() => window.location.href = '/login'} className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-bold hover:bg-blue-700">
            ログイン画面へ進む
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white p-8 shadow sm:rounded-lg">
        <h2 className="text-2xl font-extrabold text-gray-900 text-center mb-6">テナント本登録・パスワード設定</h2>
        
        {errorMsg && (
          <div className="mb-6 p-4 rounded-md text-sm font-medium bg-red-50 text-red-800 border border-red-200">{errorMsg}</div>
        )}

        <div className="bg-gray-100 p-4 rounded-md mb-8">
          <p className="text-sm text-gray-600 mb-1"><strong>学校名:</strong> {appData.schoolName}</p>
          <p className="text-sm text-gray-600 mb-1"><strong>氏名:</strong> {appData.repName}</p>
          <p className="text-sm text-gray-600"><strong>メールアドレス:</strong> {appData.email}</p>
          <p className="text-xs text-blue-600 mt-2">※この情報は事前申請時のものが反映されています。</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* 1. パスワード設定 */}
          <div className="bg-blue-50 p-6 rounded-md border border-blue-100">
            <label className="block text-sm font-bold text-gray-900 mb-4">ログインパスワードの設定 <span className="text-red-500">*</span></label>
            <div className="space-y-4">
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} 
                  className="block w-full border border-gray-300 rounded-md py-3 px-4 pr-12 focus:ring-blue-500 focus:border-blue-500 text-lg bg-white" placeholder="新しいパスワード" 
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className="relative">
                <input 
                  type={showPasswordConfirm ? "text" : "password"} required value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} 
                  className="block w-full border border-gray-300 rounded-md py-3 px-4 pr-12 focus:ring-blue-500 focus:border-blue-500 text-lg bg-white" placeholder="新しいパスワード（確認用）" 
                />
                <button type="button" onClick={() => setShowPasswordConfirm(!showPasswordConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none">
                  {showPasswordConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <ul className="mt-4 text-sm space-y-2">
                <li className={`flex items-center transition-colors ${hasMinLength ? 'text-green-600 font-bold' : 'text-gray-500'}`}>
                  {hasMinLength ? <Check size={16} className="mr-2" /> : <X size={16} className="mr-2" />}
                  8文字以上
                </li>
                <li className={`flex items-center transition-colors ${hasEnoughTypes ? 'text-green-600 font-bold' : 'text-gray-500'}`}>
                  {hasEnoughTypes ? <Check size={16} className="mr-2" /> : <X size={16} className="mr-2" />}
                  小文字、大文字、数字、記号のうち3種類以上を使用
                </li>
                <li className={`flex items-center transition-colors ${isPasswordMatch ? 'text-green-600 font-bold' : 'text-gray-500'}`}>
                  {isPasswordMatch ? <Check size={16} className="mr-2" /> : <X size={16} className="mr-2" />}
                  パスワードが一致している
                </li>
              </ul>
            </div>
          </div>

          {/* 2. 基本情報 */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">基本情報</h3>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">ふりがな</label>
                <input type="text" value={nameKana} onChange={(e) => setNameKana(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" placeholder="例: くまもと たろう" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">性別</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 bg-white focus:ring-blue-500 focus:border-blue-500">
                  <option value="">選択しない</option>
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">生年月日</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">システム利用番号（役員番号等）</label>
                <input type="text" value={systemId} onChange={(e) => setSystemId(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" placeholder="任意の管理番号" />
              </div>
            </div>
          </div>

          {/* 3. 学校・所属情報 */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">学校・所属情報</h3>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">学籍番号</label>
                <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500 font-mono" placeholder="例: 20261234" />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">出身学校</label>
                <input type="text" value={previousSchool} onChange={(e) => setPreviousSchool(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" placeholder="例: ○○中学校" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">学年</label>
                <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" placeholder="例: 2" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">組（クラス）</label>
                <input type="text" value={classNumber} onChange={(e) => setClassNumber(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" placeholder="例: A" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">出席番号</label>
                <input type="text" value={attendanceNumber} onChange={(e) => setAttendanceNumber(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" placeholder="例: 15" />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">所属部署・コース</label>
                <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" placeholder="例: 普通科 理数コース" />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">部活・クラブ</label>
                <input type="text" value={club} onChange={(e) => setClub(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" placeholder="例: バスケットボール部" />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-sm font-medium text-gray-700">役職名</label>
                <input type="text" value={positionName} onChange={(e) => setPositionName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500 bg-yellow-50" placeholder="例: 生徒会長、顧問（テキストで入力）" />
                <p className="text-xs text-gray-500 mt-1">※本登録完了後、設定画面から独自の「役職マスタ」を作成できるようになります。</p>
              </div>

              <div className="sm:col-span-2 flex items-end pb-2">
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isITManager} 
                    onChange={(e) => setIsITManager(e.target.checked)} 
                    className="focus:ring-blue-500 h-5 w-5 text-blue-600 border-gray-300 rounded" 
                  />
                  <span className="ml-2 text-sm font-bold text-gray-800">IT担当者</span>
                </label>
              </div>
            </div>
          </div>

          {/* 4. 連絡先・その他 */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">連絡先・その他</h3>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">電話番号</label>
                <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" placeholder="例: 090-1234-5678" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">所属組織の住所</label>
                <input type="text" value={organizationAddress} onChange={(e) => setOrganizationAddress(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" placeholder="キャンパスや分校が異なる場合に入力" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting || !isPasswordValid} className={`w-full py-4 px-4 rounded-md font-bold text-white shadow-sm transition-colors text-lg ${isSubmitting || !isPasswordValid ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"}`}>
            {isSubmitting ? "登録処理中..." : "この内容で本登録を完了する"}
          </button>
        </form>
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