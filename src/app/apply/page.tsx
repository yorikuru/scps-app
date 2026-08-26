"use client";

import React, { useState, useRef } from "react";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import Link from "next/link";
import { Loader2, Search, MapPin, Camera, Building, Upload,AlertTriangle,Users } from "lucide-react";
import CustomSelect from "@/components/CustomSelect";

type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

export default function ApplyPage() {
  const [schoolName, setSchoolName] = useState("");
  const [schoolType, setSchoolType] = useState("high_school");
  
  // 住所・郵便番号
  const [postalCode, setPostalCode] = useState("");
  const [location, setLocation] = useState("");
  const [isSearchingZip, setIsSearchingZip] = useState(false);

  // テナント写真・シンボルマーク用ステート
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [repName, setRepName] = useState("");
  const [repRole, setRepRole] = useState("officer");
  const [email, setEmail] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>({ show: false, type: "success", message: "" });
  const [isSuccess, setIsSuccess] = useState(false);

  // 郵便番号からの住所自動検索
  const handleZipcodeSearch = async () => {
    if (!postalCode) return;
    const cleanZip = postalCode.replace(/-/g, ""); 
    
    if (cleanZip.length !== 7) {
      setAlert({ show: true, type: "error", message: "郵便番号は7桁で入力してください。" });
      return;
    }

    setIsSearchingZip(true);
    setAlert({ show: false, type: "success", message: "" });
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanZip}`);
      const data = await res.json();
      
      if (data.status === 200 && data.results) {
        const result = data.results[0];
        setLocation(`${result.address1}${result.address2}${result.address3}`);
        setAlert({ show: true, type: "success", message: "郵便番号から住所を自動入力しました。" });
      } else {
        setAlert({ show: true, type: "error", message: "該当する住所が見つかりませんでした。" });
      }
    } catch (e) {
      setAlert({ show: true, type: "error", message: "住所の検索に失敗しました。" });
    } finally {
      setIsSearchingZip(false);
    }
  };

  // 画像ファイル選択・リサイズ処理
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAlert({ show: true, type: "error", message: "画像ファイル（JPG, PNG等）を選択してください。" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 512;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) { height *= maxSize / width; width = maxSize; }
        } else {
          if (height > maxSize) { width *= maxSize / height; height = maxSize; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        
        if (ctx) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
        
        canvas.toBlob((blob) => {
          if (blob) {
            setPhotoBlob(blob);
            setPhotoUrl(URL.createObjectURL(blob));
          }
        }, "image/jpeg", 0.85);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert({ show: false, type: "success", message: "" });

    if (repRole === "student") {
      setAlert({ show: true, type: "error", message: "一般生徒は学校テナントを新規作成できません。管理者または生徒会役員が申請してください。" });
      return;
    }

    setIsLoading(true);

    try {
      // 1. 学校コード（8桁の数字）を自動生成
      const codeDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
      const fullSchoolCode = `SCPS-${codeDigits}`;

      // 2. 申請データの一時IDを生成
      const applicationRef = doc(collection(db, "tenant_applications"));
      const appId = applicationRef.id;

      // 3. テナント写真のBlobが存在する場合は一時保存用にアップロード
      let uploadedPhotoUrl = null;
      if (photoBlob) {
        const storagePath = `avatars/temp_${appId}/tenant_logo.jpg`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, photoBlob, { contentType: "image/jpeg" });
        uploadedPhotoUrl = await getDownloadURL(storageRef);
      }

      // 4. 申請データを一時保存
      await setDoc(applicationRef, {
        schoolName: schoolName.trim(),
        schoolType: schoolType,
        postalCode: postalCode.trim(),
        location: location.trim(),
        repName: repName.trim(),
        repRole: repRole,
        email: email.trim(),
        schoolCode: fullSchoolCode,
        photoURL: uploadedPhotoUrl,
        logoURL: uploadedPhotoUrl,
        createdAt: serverTimestamp(),
      });

      // 5. 自作のAPIルートを呼び出してメールを送信
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          appId: appId,
          schoolName: schoolName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      setIsSuccess(true);
      setAlert({ show: true, type: "success", message: "確認メールを送信しました。" });

    } catch (error: any) {
      console.error("Apply error: ", error);
      setAlert({ show: true, type: "error", message: "メールの送信に失敗しました。時間をおいて再度お試しください。" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">生徒会ポータルシステム<br className="hidden sm:block"/>利用申請</h2>
        <p className="mt-2 text-xs sm:text-sm font-bold text-gray-500">あなたの学校の専用ポータルサイトを新規作成します</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl bg-white py-6 sm:py-8 px-4 sm:px-10 shadow-sm border border-gray-200 sm:rounded-2xl">
        {alert.show && (
          <div className={`mb-5 sm:mb-6 p-3 sm:p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center shadow-sm animate-fade-in ${alert.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {alert.type === "error" && <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />}
            {alert.message}
          </div>
        )}

        {isSuccess ? (
          <div className="text-center py-6 sm:py-8 animate-fade-in">
            <div className="mx-auto flex items-center justify-center h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-green-100 mb-5 sm:mb-6 shadow-sm border border-green-200">
              <svg className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-2">確認メールを送信しました</h3>
            <p className="text-xs sm:text-sm font-bold text-gray-600 mb-6 leading-relaxed">
              ご入力いただいたメールアドレスに<br/>本登録用のリンクを送信しました。<br/><br/>
              メール内のリンクをクリックして<br/>初期セットアップを完了させてください。
            </p>
            <p className="text-[10px] sm:text-xs font-bold text-gray-400 bg-gray-50 p-2 rounded-lg border border-gray-100">※メールが届かない場合は、迷惑メールフォルダもご確認ください。</p>
          </div>
        ) : (
          <form className="space-y-6 sm:space-y-8" onSubmit={handleSubmit}>
            
            {/* 学校情報 */}
            <div>
              <h3 className="text-sm sm:text-base font-black text-indigo-900 border-b-2 border-indigo-100 pb-2 mb-4 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-indigo-500" /> 学校情報
              </h3>
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">学校名 <span className="text-red-500">*</span></label>
                  <input type="text" required value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-shadow" placeholder="例: 〇〇県立〇〇高等学校" />
                  <p className="mt-1.5 text-[10px] text-gray-500 font-bold">※必ず学校の「正式名称」でご記入ください。</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">学校区分 <span className="text-red-500">*</span></label>
                  {/* ★ CustomSelect を使用 */}
                  <CustomSelect
                    value={schoolType}
                    onChange={setSchoolType}
                    options={[
                      { value: "elementary", label: "小学校" },
                      { value: "junior_high", label: "中学校" },
                      { value: "high_school", label: "高等学校" },
                      { value: "combined", label: "中高一貫校" },
                      { value: "university", label: "大学・短大" },
                      { value: "other", label: "その他" },
                    ]}
                    buttonClassName="w-full flex items-center justify-between border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-shadow text-gray-900"
                  />
                </div>

                {/* 住所・郵便番号 */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">学校の所在地情報</label>
                  <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                    <div className="flex w-full sm:w-48 gap-1.5">
                      <input 
                        type="text" 
                        placeholder="郵便番号 (ハイフンなし可)" 
                        value={postalCode} 
                        onChange={e => setPostalCode(e.target.value)} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-shadow" 
                      />
                      <button 
                        type="button" 
                        onClick={handleZipcodeSearch}
                        disabled={isSearchingZip || !postalCode}
                        className="px-3.5 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors text-indigo-700 flex items-center justify-center disabled:opacity-50 shadow-sm"
                        title="住所を検索"
                      >
                        {isSearchingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="relative flex-1">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="text" 
                        value={location} 
                        onChange={e => setLocation(e.target.value)} 
                        placeholder="例: 熊本県熊本市東区" 
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-shadow" 
                      />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-gray-500 font-bold">※郵便番号を入力して検索ボタンを押すと、自動で住所が補完されます。</p>
                </div>

                {/* テナント写真 */}
                <div className="bg-gray-50/50 p-3 sm:p-4 rounded-xl border border-gray-100">
                  <label className="block text-xs font-bold text-gray-700 mb-2.5">テナント写真・シンボルマーク</label>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 relative group shadow-sm">
                      {photoUrl ? (
                        <img src={photoUrl} alt="Tenant Logo" className="w-full h-full object-cover" />
                      ) : (
                        <Building className="w-6 h-6 sm:w-7 sm:h-7 text-gray-300" />
                      )}
                      <div 
                        onClick={() => fileInputRef.current?.click()} 
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm"
                      >
                        <Upload className="w-4 h-4 text-white" />
                      </div>
                    </div>

                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      className="hidden" 
                    />

                    <div className="flex-1 min-w-0">
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()} 
                        className="px-3 sm:px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <Camera className="w-4 h-4 text-indigo-600" /> 画像を選択
                      </button>
                      <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 mt-1.5 leading-tight">※ヘッダーやシンボルマークとして使用されます（任意）。</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* 代表者情報 */}
            <div>
              <h3 className="text-sm sm:text-base font-black text-indigo-900 border-b-2 border-indigo-100 pb-2 mb-4 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-500" /> 代表者（テナント管理者）情報
              </h3>
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">氏名 <span className="text-red-500">*</span></label>
                  <input type="text" required value={repName} onChange={(e) => setRepName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-shadow" placeholder="例: 山田 太郎" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">代表者の区分 <span className="text-red-500">*</span></label>
                  {/* ★ CustomSelect を使用 */}
                  <CustomSelect
                    value={repRole}
                    onChange={setRepRole}
                    options={[
                      { value: "officer", label: "生徒会役員" },
                      { value: "teacher", label: "教員" },
                      { value: "admin_staff", label: "管理職員" },
                      { value: "student", label: "一般生徒" },
                    ]}
                    buttonClassName="w-full flex items-center justify-between border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-shadow text-gray-900"
                  />
                  {repRole === "student" && <p className="mt-1.5 text-[10px] text-red-500 font-bold bg-red-50 p-1.5 rounded-lg border border-red-100 inline-block">エラー：一般生徒はテナントを作成できません。</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">メールアドレス <span className="text-red-500">*</span></label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-shadow" placeholder="連絡がつく有効なアドレス" />
                  <p className="mt-1.5 text-[10px] font-bold text-gray-500">※申請後、このアドレス宛に本登録用のリンクをお送りします。</p>
                </div>
              </div>
            </div>

            <div className="pt-2 sm:pt-4">
              <button
                type="submit"
                disabled={isLoading || repRole === "student"}
                className={`w-full flex items-center justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm sm:text-base font-black text-white transition-transform ${
                  isLoading || repRole === "student" ? "bg-indigo-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5"
                }`}
              >
                {isLoading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> 送信中...</> : "認証メールを送信する"}
              </button>
            </div>
          </form>
        )}
      </div>
      
      {/* フッターリンク群 */}
      <div className="flex flex-col gap-2 mt-8">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] sm:text-xs font-bold text-gray-500">
          <Link href="/legal/terms" className="hover:text-indigo-600 transition-colors">利用規約</Link>
          <Link href="/legal/privacy" className="hover:text-indigo-600 transition-colors">プライバシーポリシー</Link>
          <Link href="/legal/commercial" className="hover:text-indigo-600 transition-colors">特定商取引法に基づく表記</Link>
        </div>
        <div className="text-[9px] font-bold text-gray-400 text-center mt-1">
          &copy; {new Date().getFullYear()} YORIKURU / 生徒会ポータルシステム
        </div>
      </div>
    </div>
  );
}