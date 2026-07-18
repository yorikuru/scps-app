"use client";

import React, { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

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
  // ▼変更：SCPS- を固定し、数字8桁だけをステートで管理する
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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center mb-8">
        <h2 className="text-3xl font-extrabold text-gray-900">SCPS アカウント登録</h2>
        <p className="mt-2 text-sm text-gray-600">プロフィール情報を入力してアカウントの利用申請を行います。</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-3xl bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        {alert.show && (
          <div className={`mb-6 p-4 rounded-md text-sm font-medium ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {alert.message}
          </div>
        )}

        {isRegistered ? (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-6">
              <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">利用申請を受け付けました</h3>
            <p className="text-gray-600 mb-6">現在、アカウント管理者の承認待ちです。<br />承認されるまでシステムにはログインできません。</p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-6 mb-8 inline-block text-left w-full max-w-sm">
              <p className="text-sm text-blue-800 font-bold mb-1">あなたのログインID</p>
              <p className="text-xl font-mono text-blue-900 bg-white px-3 py-2 border border-blue-100 rounded">{generatedLoginId}</p>
              <p className="text-xs text-blue-600 mt-2">※承認後、このIDとパスワードでログインしてください。</p>
            </div>

            <button
              onClick={() => window.location.href = '/login'}
              className="w-full sm:w-auto flex justify-center py-3 px-8 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              ログイン画面へ戻る
            </button>
          </div>
        ) : (
          <form className="space-y-8" onSubmit={handleSubmit}>
            
            {/* 1. システム設定 */}
            <div className="bg-gray-50 p-6 rounded-md border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-2 mb-4">1. システム設定（必須）</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-gray-700">学校コード <span className="text-red-500">*</span></label>
                  {/* ▼変更：SCPS-を固定したUI */}
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <span className="inline-flex items-center px-4 rounded-l-md border border-r-0 border-gray-300 bg-gray-100 text-gray-600 sm:text-sm font-mono font-bold">
                      SCPS -
                    </span>
                    <input 
                      type="text" 
                      required 
                      maxLength={8}
                      value={schoolCodeDigits} 
                      onChange={(e) => {
                        // 数字以外を除外
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setSchoolCodeDigits(val);
                        if (val.length === 8) {
                          fetchPositionsByCode(`SCPS-${val}`);
                        } else {
                          setAllPositions([]);
                        }
                      }} 
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm border-gray-300 font-mono tracking-widest text-lg" 
                      placeholder="12345678" 
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">※管理者から共有された8桁の数字を入力してください。</p>
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">認証方法の選択 <span className="text-red-500">*</span></label>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-6">
                    <label className="flex items-center">
                      <input type="radio" name="authMethod" checked={authMethod === "email"} onChange={() => setAuthMethod("email")} className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300" />
                      <span className="ml-2 text-sm text-gray-700">メールアドレスで登録</span>
                    </label>
                    <label className="flex items-center">
                      <input type="radio" name="authMethod" checked={authMethod === "studentId"} onChange={() => setAuthMethod("studentId")} className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300" />
                      <span className="ml-2 text-sm text-gray-700">学籍番号で登録（メール不要）</span>
                    </label>
                  </div>
                </div>

                {authMethod === "email" ? (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-gray-700">メールアドレス <span className="text-red-500">*</span></label>
                    <input type="email" required={authMethod === "email"} value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="例: user@example.com" />
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-100">※学籍番号を選択した場合、後述の「学籍番号」欄がログインIDとして使用されます。</p>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-gray-700">パスワード <span className="text-red-500">*</span></label>
                  <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="6文字以上" />
                </div>
              </div>
            </div>

            {/* 2. 基本情報 */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">2. 基本情報</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">氏名 <span className="text-red-500">*</span></label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="例: 熊本 太郎" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">ふりがな</label>
                  <input type="text" value={nameKana} onChange={(e) => setNameKana(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="例: くまもと たろう" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">区分 <span className="text-red-500">*</span></label>
                  <select value={userType} onChange={(e) => setUserType(e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900">
                    <option value="student">一般生徒 (外部委員会や部活)</option>
                    <option value="officer">生徒会役員</option>
                    <option value="teacher">教員</option>
                    <option value="admin_staff">管理職員</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">システム利用番号（役員番号等）</label>
                  <input type="text" value={systemId} onChange={(e) => setSystemId(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="任意の管理番号" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">性別</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900">
                    <option value="">選択しない</option>
                    <option value="male">男性</option>
                    <option value="female">女性</option>
                    <option value="other">その他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">生年月日</label>
                  <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" />
                </div>
              </div>
            </div>

            {/* 3. 学校・所属情報 */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">3. 学校・所属情報</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700">
                    学籍番号 {authMethod === "studentId" && <span className="text-red-500">*</span>}
                  </label>
                  <input type="text" required={authMethod === "studentId"} value={studentId} onChange={(e) => setStudentId(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 font-mono" placeholder="例: 20261234" />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700">出身学校</label>
                  <input type="text" value={previousSchool} onChange={(e) => setPreviousSchool(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="例: ○○中学校" />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">学年</label>
                  <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="例: 2" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">組（クラス）</label>
                  <input type="text" value={classNumber} onChange={(e) => setClassNumber(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="例: A" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">出席番号</label>
                  <input type="text" value={attendanceNumber} onChange={(e) => setAttendanceNumber(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="例: 15" />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700">所属部署・コース</label>
                  <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="例: 普通科 理数コース" />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700">部活・クラブ</label>
                  <input type="text" value={club} onChange={(e) => setClub(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="例: バスケットボール部" />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">役職の選択 <span className="text-red-500">*</span></label>
                  {allPositions.length === 0 ? (
                    <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded border border-gray-200">
                      ※ 上部で正しい学校コードを入力すると、選択可能な役職が表示されます。
                    </div>
                  ) : (
                    <select 
                      value={selectedPosition} 
                      onChange={(e) => setSelectedPosition(e.target.value)}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                    >
                      <option value="">-- 区分に合致する役職から選択してください --</option>
                      {filteredPositions.map((pos) => (
                        <option key={pos.id} value={pos.name}>{pos.name}</option>
                      ))}
                    </select>
                  )}
                  {filteredPositions.length === 0 && allPositions.length > 0 && (
                     <p className="text-xs text-red-500 mt-1">※現在の「区分」で選択できる役職がマスタに登録されていません。</p>
                  )}
                </div>

                <div className="sm:col-span-2 flex items-end pb-2">
                  <label className="flex items-center">
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
              <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">4. 連絡先・その他</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                {authMethod === "studentId" && (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">個人のメールアドレス（任意）</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="連絡用アドレスがある場合" />
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">電話番号</label>
                  <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="例: 090-1234-5678" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">所属組織の住所</label>
                  <input type="text" value={organizationAddress} onChange={(e) => setOrganizationAddress(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="キャンパスや分校が異なる場合に入力" />
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={isLoading || (filteredPositions.length > 0 && !selectedPosition)}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-bold text-white ${
                  isLoading || (filteredPositions.length > 0 && !selectedPosition) ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                }`}
              >
                {isLoading ? "処理中..." : "この内容で申請する"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}