"use client";

import React, { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import CustomSelect from "@/components/CustomSelect";
import { CheckCircle2, AlertTriangle, KeyRound, Building2, UserCog, BookOpen, MapPin } from "lucide-react";
import Link from "next/link";

type Position = {
  id: string;
  name: string;
  isStudent: boolean;
  isInternal: boolean;
};

type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

export default function RegisterPage() {
  const [schoolCodeDigits, setSchoolCodeDigits] = useState("");
  
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [filteredPositions, setFilteredPositions] = useState<Position[]>([]);
  
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [authMethod, setAuthMethod] = useState<"email" | "studentId">("email");

  const [name, setName] = useState("");
  const [nameKana, setNameKana] = useState("");
  const [userType, setUserType] = useState("student");
  const [systemId, setSystemId] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const [studentId, setStudentId] = useState("");
  const [grade, setGrade] = useState("");
  const [classNumber, setClassNumber] = useState("");
  const [attendanceNumber, setAttendanceNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [club, setClub] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [isITManager, setIsITManager] = useState(false);
  const [previousSchool, setPreviousSchool] = useState("");
  
  const [phoneNumber, setPhoneNumber] = useState("");
  const [organizationAddress, setOrganizationAddress] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>({ show: false, type: "success", message: "" });
  const [isRegistered, setIsRegistered] = useState(false);
  const [generatedLoginId, setGeneratedLoginId] = useState("");

  const fetchPositionsByCode = async (code: string) => {
    if (code.length !== 13) return; // SCPS-XXXXXXXX は13文字
    try {
      const schoolsRef = collection(db, "schools");
      const q = query(schoolsRef, where("schoolCode", "==", code));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const schoolId = snapshot.docs[0].id;
        const posRef = collection(db, "positions");
        const posQuery = query(posRef, where("schoolId", "==", schoolId), orderBy("shokui", "asc"), orderBy("displayOrder", "asc"));
        const posSnapshot = await getDocs(posQuery);
        
        const positions = posSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          name: doc.data().name,
          isStudent: doc.data().isStudent ?? true,
          isInternal: doc.data().isInternal ?? true
        }));
        setAllPositions(positions);
      } else {
        setAllPositions([]);
      }
    } catch (error) {
      console.error("Error fetching positions:", error);
    }
  };

  useEffect(() => {
    const newFiltered = allPositions.filter(pos => {
      if (userType === "officer") {
        return pos.isStudent && pos.isInternal;
      } else if (userType === "student") {
        return pos.isStudent && !pos.isInternal;
      } else if (userType === "teacher" || userType === "admin_staff") {
        return !pos.isStudent;
      }
      return true;
    });
    
    setFilteredPositions(newFiltered);
    
    if (!newFiltered.find(p => p.name === selectedPosition)) {
      setSelectedPosition("");
    }
  }, [userType, allPositions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert({ show: false, type: "success", message: "" });

    const fullSchoolCode = `SCPS-${schoolCodeDigits}`;

    if (schoolCodeDigits.length !== 8 || !name || !password || !userType) {
      setAlert({ show: true, type: "error", message: "必須項目を正しく入力してください。（学校コードは数字8桁です）" });
      return;
    }
    if (password.length < 6) {
      setAlert({ show: true, type: "error", message: "パスワードは6文字以上で入力してください。" });
      return;
    }
    if (authMethod === "studentId" && !studentId) {
      setAlert({ show: true, type: "error", message: "学籍番号での登録を選択した場合は、学籍番号が必須です。" });
      return;
    }
    if (authMethod === "email" && !email) {
      setAlert({ show: true, type: "error", message: "メールアドレスを入力してください。" });
      return;
    }

    setIsLoading(true);

    try {
      const schoolsRef = collection(db, "schools");
      const q = query(schoolsRef, where("schoolCode", "==", fullSchoolCode));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setAlert({ show: true, type: "error", message: "無効な学校コードです。" });
        setIsLoading(false);
        return;
      }

      const schoolDoc = querySnapshot.docs[0];
      const schoolId = schoolDoc.id;
      const schoolData = schoolDoc.data();

      let authEmail = authMethod === "studentId" ? `${studentId}@${schoolId}.scps.dummy` : email;
      const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);

      await setDoc(doc(db, "users", userCredential.user.uid), {
        schoolId,
        schoolName: schoolData.name,
        authProviders: [authMethod, "password"],
        internalAuthEmail: authEmail,
        email: email || "",
        name,
        nameKana,
        userType,
        systemId,
        gender,
        birthDate,
        studentId,
        grade,
        classNumber,
        attendanceNumber,
        department,
        club,
        positionName: selectedPosition,
        isITManager: isITManager,
        previousSchool,
        phoneNumber,
        organizationAddress,
        role: userType === "student" ? "student" : "officer",
        accountStatus: "pending", 
        createdAt: serverTimestamp(),
      });

      await signOut(auth);

      setGeneratedLoginId(authMethod === "studentId" ? studentId : email);
      setIsRegistered(true);
      setAlert({ show: true, type: "success", message: "申請が送信されました。" });

    } catch (error: any) {
      console.error("Registration error: ", error);
      let errorMessage = "登録に失敗しました。もう一度お試しください。";
      if (error.code === "auth/email-already-in-use") {
        errorMessage = authMethod === "studentId" 
          ? "この学籍番号は既にシステムに登録されています。" 
          : "このメールアドレスは既に登録されています。";
      }
      setAlert({ show: true, type: "error", message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto w-full text-center mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">アカウント利用申請</h2>
        <p className="mt-2 text-[11px] sm:text-sm font-bold text-gray-500">プロフィール情報を入力して、システムの利用を申請します。</p>
      </div>

      <div className="max-w-3xl mx-auto w-full bg-white p-4 sm:p-8 shadow-sm rounded-2xl sm:rounded-3xl border border-gray-100">
        
        {alert.show && (
          <div className={`mb-5 p-3 rounded-xl text-xs sm:text-sm font-bold flex items-center shadow-sm animate-fade-in ${alert.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {alert.type === "success" ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
            {alert.message}
          </div>
        )}

        {isRegistered ? (
          <div className="text-center py-6 sm:py-8 animate-fade-in">
            <div className="mx-auto flex items-center justify-center h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-yellow-100 mb-5 sm:mb-6 shadow-sm border border-yellow-200">
              <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-2">利用申請を受け付けました</h3>
            <p className="text-xs sm:text-sm font-bold text-gray-600 mb-6 leading-relaxed">
              現在、アカウント管理者の承認待ちです。<br />承認されるまでシステムにはログインできません。
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-6 mb-8 inline-block text-left w-full max-w-sm shadow-sm">
              <p className="text-[11px] sm:text-xs text-blue-800 font-bold mb-1 flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> あなたのログインID</p>
              <p className="text-lg sm:text-xl font-mono font-black text-blue-900 bg-white px-3 py-2 border border-blue-100 rounded-lg text-center tracking-wider">{generatedLoginId}</p>
              <p className="text-[10px] text-blue-600 mt-2 font-bold text-center">※承認後、このIDとパスワードでログインしてください。</p>
            </div>

            <button
              onClick={() => window.location.href = '/login'}
              className="w-full sm:w-auto flex justify-center mx-auto py-3 px-8 rounded-xl shadow-md text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 transition-transform hover:-translate-y-0.5"
            >
              ログイン画面へ戻る
            </button>
          </div>
        ) : (
          <form className="space-y-6 sm:space-y-8" onSubmit={handleSubmit}>
            
            {/* 1. システム設定 */}
            <div className="bg-indigo-50/50 p-4 sm:p-5 rounded-2xl border border-indigo-100">
              <h3 className="text-xs sm:text-sm font-black text-indigo-900 border-b border-indigo-100 pb-2 mb-3 sm:mb-4 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-600" /> 1. システム設定（必須）
              </h3>
              <div className="grid grid-cols-1 gap-y-4 sm:gap-y-5 sm:grid-cols-2 sm:gap-x-4">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">学校コード <span className="text-red-500">*</span></label>
                  <div className="flex rounded-xl shadow-sm">
                    <span className="inline-flex items-center px-3 sm:px-4 rounded-l-xl border border-r-0 border-gray-300 bg-gray-100 text-gray-600 text-[11px] sm:text-sm font-mono font-black">
                      SCPS -
                    </span>
                    <input 
                      type="text" required maxLength={8} value={schoolCodeDigits} 
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setSchoolCodeDigits(val);
                        if (val.length === 8) fetchPositionsByCode(`SCPS-${val}`);
                        else setAllPositions([]);
                      }} 
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-bold tracking-widest text-sm sm:text-base bg-white" 
                      placeholder="12345678" 
                    />
                  </div>
                  <p className="mt-1 text-[9px] sm:text-[10px] text-gray-500 font-bold">※管理者から共有された8桁の数字を入力してください。</p>
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1.5">認証方法の選択 <span className="text-red-500">*</span></label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <label className="flex items-center bg-white border border-gray-200 px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                      <input type="radio" name="authMethod" checked={authMethod === "email"} onChange={() => setAuthMethod("email")} className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                      <span className="ml-2 text-[11px] sm:text-xs font-bold text-gray-700">メールアドレスで登録</span>
                    </label>
                    <label className="flex items-center bg-white border border-gray-200 px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                      <input type="radio" name="authMethod" checked={authMethod === "studentId"} onChange={() => setAuthMethod("studentId")} className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                      <span className="ml-2 text-[11px] sm:text-xs font-bold text-gray-700">学籍番号で登録（メール不要）</span>
                    </label>
                  </div>
                </div>

                {authMethod === "email" ? (
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">メールアドレス <span className="text-red-500">*</span></label>
                    <input type="email" required={authMethod === "email"} value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full border border-gray-300 rounded-xl py-2 px-3 text-[11px] sm:text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-bold" placeholder="例: user@example.com" />
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] sm:text-xs text-indigo-700 bg-indigo-50/80 p-2.5 rounded-lg border border-indigo-200 font-bold">※学籍番号を選択した場合、後述の「学籍番号」欄に入力したものがログインIDとして使用されます。</p>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">パスワード <span className="text-red-500">*</span></label>
                  <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full border border-gray-300 rounded-xl py-2 px-3 text-[11px] sm:text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-bold" placeholder="6文字以上" />
                </div>
              </div>
            </div>

            {/* 2. 基本情報 */}
            <div>
              <h3 className="text-xs sm:text-sm font-black text-gray-900 border-b border-gray-200 pb-1.5 mb-3 flex items-center gap-1.5">
                <UserCog className="w-4 h-4 text-gray-500" /> 2. 基本情報
              </h3>
              <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">氏名 <span className="text-red-500">*</span></label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="block w-full border border-gray-300 rounded-xl py-2 px-3 text-[11px] sm:text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-bold" placeholder="例: 熊本 太郎" />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">ふりがな</label>
                  <input type="text" value={nameKana} onChange={(e) => setNameKana(e.target.value)} className="block w-full border border-gray-300 rounded-xl py-2 px-3 text-[11px] sm:text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-bold" placeholder="例: くまもと たろう" />
                </div>
                
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">区分 <span className="text-red-500">*</span></label>
                  <CustomSelect
                    value={userType}
                    onChange={setUserType}
                    options={[
                      { value: "student", label: "一般生徒 (外部委員会や部活)" },
                      { value: "officer", label: "生徒会役員" },
                      { value: "teacher", label: "教員" },
                      { value: "admin_staff", label: "管理職員" },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">システム利用番号（役員番号等）</label>
                  <input type="text" value={systemId} onChange={(e) => setSystemId(e.target.value)} className="block w-full border border-gray-300 rounded-xl py-2 px-3 text-[11px] sm:text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-bold font-mono" placeholder="任意の管理番号" />
                </div>

                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">性別</label>
                  <CustomSelect
                    value={gender}
                    onChange={setGender}
                    options={[
                      { value: "", label: "選択しない" },
                      { value: "male", label: "男性" },
                      { value: "female", label: "女性" },
                      { value: "other", label: "その他" },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">生年月日</label>
                  <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="block w-full border border-gray-300 rounded-xl py-2 px-3 text-[11px] sm:text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-bold" />
                </div>
              </div>
            </div>

            {/* 3. 学校・所属情報 */}
            <div>
              <h3 className="text-xs sm:text-sm font-black text-gray-900 border-b border-gray-200 pb-1.5 mb-3 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-gray-500" /> 3. 学校・所属情報
              </h3>
              <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-6">
                
                <div className="sm:col-span-3">
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">
                    学籍番号 {authMethod === "studentId" && <span className="text-red-500">*</span>}
                  </label>
                  <input type="text" required={authMethod === "studentId"} value={studentId} onChange={(e) => setStudentId(e.target.value)} className="block w-full border border-gray-300 rounded-xl py-2 px-3 text-[11px] sm:text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-bold font-mono" placeholder="例: 20261234" />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">出身学校</label>
                  <input type="text" value={previousSchool} onChange={(e) => setPreviousSchool(e.target.value)} className="block w-full border border-gray-300 rounded-xl py-2 px-3 text-[11px] sm:text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-bold" placeholder="例: ○○中学校" />
                </div>

                <div className="sm:col-span-6 grid grid-cols-3 gap-2 sm:gap-4">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">学年</label>
                    <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} className="block w-full border border-gray-300 rounded-xl py-2 px-3 text-[11px] sm:text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-bold" placeholder="例: 2" />
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">組</label>
                    <input type="text" value={classNumber} onChange={(e) => setClassNumber(e.target.value)} className="block w-full border border-gray-300 rounded-xl py-2 px-3 text-[11px] sm:text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-bold" placeholder="例: A" />
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">出席番号</label>
                    <input type="text" value={attendanceNumber} onChange={(e) => setAttendanceNumber(e.target.value)} className="block w-full border border-gray-300 rounded-xl py-2 px-3 text-[11px] sm:text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-bold" placeholder="例: 15" />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">所属部署・コース</label>
                  <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className="block w-full border border-gray-300 rounded-xl py-2 px-3 text-[11px] sm:text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-bold" placeholder="例: 普通科" />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">部活・クラブ</label>
                  <input type="text" value={club} onChange={(e) => setClub(e.target.value)} className="block w-full border border-gray-300 rounded-xl py-2 px-3 text-[11px] sm:text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-bold" placeholder="例: 野球部" />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">役職の選択 <span className="text-red-500">*</span></label>
                  {allPositions.length === 0 ? (
                    <div className="text-[10px] sm:text-xs font-bold text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                      ※ 上部で正しい学校コードを入力すると、選択可能な役職が表示されます。
                    </div>
                  ) : (
                    <CustomSelect
                      value={selectedPosition}
                      onChange={setSelectedPosition}
                      options={[
                        { value: "", label: "-- 区分に合致する役職から選択してください --" },
                        ...filteredPositions.map(pos => ({ value: pos.name, label: pos.name }))
                      ]}
                    />
                  )}
                  {filteredPositions.length === 0 && allPositions.length > 0 && (
                     <p className="text-[9px] sm:text-[10px] font-bold text-red-500 mt-1.5">※現在の「区分」で選択できる役職がマスタに登録されていません。</p>
                  )}
                </div>

                <div className="sm:col-span-2 flex items-center pt-2 sm:pt-6">
                  <label className="flex items-center cursor-pointer bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={isITManager} 
                      onChange={(e) => setIsITManager(e.target.checked)} 
                      className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded" 
                    />
                    <span className="ml-2 text-[11px] sm:text-xs font-bold text-gray-800">IT担当者</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 4. 連絡先・その他 */}
            <div>
              <h3 className="text-xs sm:text-sm font-black text-gray-900 border-b border-gray-200 pb-1.5 mb-3 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-gray-500" /> 4. 連絡先・その他
              </h3>
              <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                {authMethod === "studentId" && (
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">個人のメールアドレス（任意）</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full border border-gray-300 rounded-xl py-2 px-3 text-[11px] sm:text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-bold" placeholder="連絡用アドレスがある場合" />
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">電話番号</label>
                  <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="block w-full border border-gray-300 rounded-xl py-2 px-3 text-[11px] sm:text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-bold" placeholder="例: 090-1234-5678" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">所属組織の住所</label>
                  <input type="text" value={organizationAddress} onChange={(e) => setOrganizationAddress(e.target.value)} className="block w-full border border-gray-300 rounded-xl py-2 px-3 text-[11px] sm:text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-bold" placeholder="キャンパスや分校が異なる場合に入力" />
                </div>
              </div>
            </div>

            <div className="pt-4 sm:pt-6">
              <button
                type="submit"
                disabled={isLoading || (filteredPositions.length > 0 && !selectedPosition)}
                className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm sm:text-base font-black text-white transition-transform ${
                  isLoading || (filteredPositions.length > 0 && !selectedPosition) ? "bg-indigo-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5"
                }`}
              >
                {isLoading ? "処理中..." : "この内容で申請する"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="flex flex-col gap-1.5 text-[10px] font-bold text-gray-400 text-center mt-8 pb-8">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          <Link href="/legal/terms" className="hover:text-gray-600 transition-colors">利用規約</Link>
          <Link href="/legal/privacy" className="hover:text-gray-600 transition-colors">プライバシー</Link>
          <Link href="/legal/commercial" className="hover:text-gray-600 transition-colors">特定商取引法</Link>
        </div>
        <div className="text-[9px] text-gray-500 mt-1">
          &copy; {new Date().getFullYear()} YORIKURU / 生徒会ポータルシステム
        </div>
      </div>
    </div>
  );
}