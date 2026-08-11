"use client";

import React, { useState, useRef } from "react";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import Link from "next/link";
import { Loader2, Search, MapPin, Camera, Building, Upload } from "lucide-react";

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

      // 3. テナント写真のBlobが存在する場合は一時保存用にアップロード（または本登録時に渡すパス・URLとして処理）
      let uploadedPhotoUrl = null;
      if (photoBlob) {
        const storagePath = `avatars/temp_${appId}/tenant_logo.jpg`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, photoBlob, { contentType: "image/jpeg" });
        uploadedPhotoUrl = await getDownloadURL(storageRef);
      }

      // 4. 申請データを一時保存（本登録画面で引き継ぐため）
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
      setAlert({ show: true, type: "error", message: "メールの送信に失敗しました。ターミナル（コンソール）のエラーを確認してください。" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center mb-8">
        <h2 className="text-3xl font-extrabold text-gray-900">生徒会ポータルシステム<br/>利用申請</h2>
        <br/>
        <p className="mt-2 text-sm text-gray-600">このページでは<br/>あなたの学校の専用ポータルサイトを新規作成します</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        {alert.show && (
          <div className={`mb-6 p-4 rounded-md text-sm font-medium ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {alert.message}
          </div>
        )}

        {isSuccess ? (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">確認メールを送信しました</h3>
            <p className="text-gray-600 mb-6">
              ご入力いただいたメールアドレスに<br/>本登録用のリンクを送信しました<br/><br/>
              メール内のリンクをクリックして<br/>初期セットアップを完了させてください
            </p>
            <p className="text-xs text-gray-400">※メールが届かない場合は、迷惑メールフォルダもご確認ください。</p>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {/* 学校情報 */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">学校情報</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700">学校名 <span className="text-red-500">*</span></label>
                  <input type="text" required value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="例: 〇〇県立〇〇高等学校" />
                  <p className="mt-1 text-xs text-red-500 font-bold">※必ず学校の「正式名称」でご記入ください。略称は使用しないでください。</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">学校区分 <span className="text-red-500">*</span></label>
                  <select required value={schoolType} onChange={(e) => setSchoolType(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 bg-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900">
                    <option value="elementary">小学校</option>
                    <option value="junior_high">中学校</option>
                    <option value="high_school">高等学校</option>
                    <option value="combined">中高一貫校</option>
                    <option value="university">大学・短大</option>
                    <option value="other">その他</option>
                  </select>
                </div>

                {/* 住所・郵便番号（自動補完つき） */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">学校の所在地情報</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex w-full sm:w-44 gap-1">
                      <input 
                        type="text" 
                        placeholder="郵便番号 (例: 8620901)" 
                        value={postalCode} 
                        onChange={e => setPostalCode(e.target.value)} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" 
                      />
                      <button 
                        type="button" 
                        onClick={handleZipcodeSearch}
                        disabled={isSearchingZip || !postalCode}
                        className="px-3 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors text-xs font-bold text-gray-600 flex items-center justify-center whitespace-nowrap disabled:opacity-50"
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
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" 
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">※郵便番号を入力して検索ボタンを押すと、自動で住所が補完されます。</p>
                </div>

                {/* テナント写真・シンボルマーク設定 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">テナント写真・シンボルマーク</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-gray-100 border-2 border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 relative group shadow-sm">
                      {photoUrl ? (
                        <img src={photoUrl} alt="Tenant Logo" className="w-full h-full object-cover" />
                      ) : (
                        <Building className="w-7 h-7 text-gray-300" />
                      )}
                      <div 
                        onClick={() => fileInputRef.current?.click()} 
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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

                    <div>
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()} 
                        className="px-3 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <Camera className="w-3.5 h-3.5 text-blue-600" /> 画像を選択
                      </button>
                      <p className="text-[10px] text-gray-400 mt-1">※ヘッダーやシンボルマークとして使用されます（任意）。</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* 代表者情報 */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">代表者（テナント管理者）情報</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700">氏名 <span className="text-red-500">*</span></label>
                  <input type="text" required value={repName} onChange={(e) => setRepName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="例: 山田 太郎" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">代表者の区分 <span className="text-red-500">*</span></label>
                  <select required value={repRole} onChange={(e) => setRepRole(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 bg-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900">
                    <option value="officer">生徒会役員</option>
                    <option value="teacher">教員</option>
                    <option value="admin_staff">管理職員</option>
                    <option value="student">一般生徒</option>
                  </select>
                  {repRole === "student" && <p className="mt-1 text-xs text-red-500 font-bold">エラー：一般生徒はテナントを作成できません。</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">メールアドレス <span className="text-red-500">*</span></label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="連絡がつく有効なアドレス" />
                  <p className="mt-1 text-xs text-gray-500">※申請後、このアドレス宛に本登録用のリンクをお送りします。</p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading || repRole === "student"}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-bold text-white ${
                  isLoading || repRole === "student" ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                }`}
              >
                {isLoading ? "送信中..." : "認証メールを送信する"}
              </button>
            </div>
          </form>
        )}
      </div>
      
      <div className="flex flex-col gap-1.5 text-[9px] font-bold text-gray-500 text-center mt-6">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          <Link href="/legal/terms" className="hover:text-gray-300 transition-colors">利用規約</Link>
          <Link href="/legal/privacy" className="hover:text-gray-300 transition-colors">プライバシー</Link>
          <Link href="/legal/commercial" className="hover:text-gray-300 transition-colors">特定商取引法</Link>
        </div>
        <div className="text-[8px] text-gray-600 mt-0.5">
          &copy; {new Date().getFullYear()} YORIKURU / 生徒会ポータルシステム
        </div>
      </div>
    </div>
  );
}