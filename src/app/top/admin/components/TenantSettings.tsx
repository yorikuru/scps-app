"use client";

import React, { useState, useEffect, useRef } from "react";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Settings, Loader2, Building, Mail, User, Key, Camera, Upload, Trash2, CheckCircle2, Calendar, Tag, MapPin, Search } from "lucide-react";
import { SchoolData } from "../page";

type ExtendedSchoolData = SchoolData & {
  schoolType?: string;
  status?: string;
  createdAt?: any;
  photoURL?: string;
  logoURL?: string;
  location?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
};

type Props = {
  schoolData: SchoolData | null;
  showAlert: (type: "success" | "error" | "warning", message: string) => void;
};

export default function TenantSettings({ schoolData, showAlert }: Props) {
  const exSchoolData = schoolData as ExtendedSchoolData;

  const [name, setName] = useState("");
  const [schoolType, setSchoolType] = useState("high_school");
  
  const [location, setLocation] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [isSearchingZip, setIsSearchingZip] = useState(false);
  
  const [allowGoogle, setAllowGoogle] = useState(false);
  const [allowMicrosoft, setAllowMicrosoft] = useState(false);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);

  // テナント管理者一覧用のステート
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);

  useEffect(() => {
    if (exSchoolData) {
      setName(exSchoolData.name || "");
      setSchoolType(exSchoolData.schoolType || "high_school");
      
      setLocation(exSchoolData.location || "");
      setPostalCode(exSchoolData.postalCode || "");

      const currentPhoto = exSchoolData.photoURL || exSchoolData.logoURL || null;
      setPhotoUrl(currentPhoto);

      setAllowGoogle(exSchoolData.allowedAuthProviders?.includes("google") || exSchoolData.allowedAuthProviders?.includes("all") || false);
      setAllowMicrosoft(exSchoolData.allowedAuthProviders?.includes("microsoft") || exSchoolData.allowedAuthProviders?.includes("all") || false);
    }
  }, [exSchoolData]);

  // Firestoreから role === "admin" のユーザーを取得
  useEffect(() => {
    const fetchAdmins = async () => {
      if (!exSchoolData?.id) return;
      setIsLoadingAdmins(true);
      try {
        const q = query(
          collection(db, "users"),
          where("schoolId", "==", exSchoolData.id),
          where("role", "==", "admin")
        );
        const snap = await getDocs(q);
        const fetched: AdminUser[] = [];
        snap.forEach(docSnap => {
          const data = docSnap.data();
          fetched.push({ id: docSnap.id, name: data.name, email: data.email });
        });
        setAdminUsers(fetched);
      } catch (error) {
        console.error("Failed to fetch admin users", error);
      } finally {
        setIsLoadingAdmins(false);
      }
    };
    fetchAdmins();
  }, [exSchoolData?.id]);

  const handleZipcodeSearch = async () => {
    if (!postalCode) return;
    const cleanZip = postalCode.replace(/-/g, ""); 
    
    if (cleanZip.length !== 7) {
      showAlert("warning", "郵便番号は7桁で入力してください。");
      return;
    }

    setIsSearchingZip(true);
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanZip}`);
      const data = await res.json();
      
      if (data.status === 200 && data.results) {
        const result = data.results[0];
        setLocation(`${result.address1}${result.address2}${result.address3}`);
        showAlert("success", "郵便番号から住所を自動入力しました。");
      } else {
        showAlert("error", "該当する住所が見つかりませんでした。");
      }
    } catch (e) {
      showAlert("error", "住所の検索に失敗しました。");
    } finally {
      setIsSearchingZip(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showAlert("error", "画像ファイル（JPG, PNG等）を選択してください。");
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

  const handleRemovePhoto = async () => {
    if (!exSchoolData) return;
    setIsSaving(true);
    try {
      if (photoUrl && photoUrl.includes("firebase")) {
        const storageRef = ref(storage, `avatars/${exSchoolData.id}/tenant_logo.jpg`);
        try { await deleteObject(storageRef); } catch (e) { console.warn("Storage deletion skipped", e); }
      }

      await updateDoc(doc(db, "schools", exSchoolData.id), {
        photoURL: null,
        logoURL: null
      });

      setPhotoBlob(null);
      setPhotoUrl(null);
      showAlert("success", "テナント写真を削除しました。");
    } catch (error) {
      console.error(error);
      showAlert("error", "テナント写真の削除に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exSchoolData) return;

    if (!name.trim()) {
      showAlert("warning", "学校名・組織名は必須です。");
      return;
    }

    setIsSaving(true);
    try {
      let uploadedPhotoUrl = photoUrl;

      if (photoBlob) {
        const storagePath = `avatars/${exSchoolData.id}/tenant_logo.jpg`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, photoBlob, { contentType: "image/jpeg" });
        uploadedPhotoUrl = await getDownloadURL(storageRef);
      }

      let lat: number | null = exSchoolData.latitude || null;
      let lng: number | null = exSchoolData.longitude || null;

      if (location.trim()) {
        try {
          const geoRes = await fetch(
            `https://geoapi.heartrails.com/api/json?method=suggest&matching=like&keyword=${encodeURIComponent(location.trim())}`
          );
          const geoData = await geoRes.json();

          if (geoData.response && geoData.response.location && geoData.response.location.length > 0) {
            const firstHit = geoData.response.location[0];
            lat = parseFloat(firstHit.y);
            lng = parseFloat(firstHit.x);
          }
        } catch (e) {
          console.warn("Geo lookup failed", e);
        }
      }

      const newProviders = ["password"];
      if (allowGoogle) newProviders.push("google");
      if (allowMicrosoft) newProviders.push("microsoft");

      // adminName と adminEmail の更新を除外
      const updatePayload: Record<string, any> = {
        name: name.trim(),
        schoolType: schoolType,
        location: location.trim(),       
        postalCode: postalCode.trim(),   
        latitude: lat,
        longitude: lng,
        allowedAuthProviders: newProviders,
        photoURL: uploadedPhotoUrl || null,
        logoURL: uploadedPhotoUrl || null
      };

      await updateDoc(doc(db, "schools", exSchoolData.id), updatePayload);

      setPhotoBlob(null);
      showAlert("success", "テナント情報を更新・保存しました。");
    } catch (error) {
      console.error("Save error:", error);
      showAlert("error", "設定の保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  if (!schoolData) return null;

  const formatDateDisplay = (timestamp: any) => {
    if (!timestamp) return "未設定";
    if (typeof timestamp === "string") return timestamp;
    if (timestamp.toDate) return timestamp.toDate().toLocaleString("ja-JP");
    return "有効";
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl pb-6 animate-fade-in">
      <div className="px-2 sm:px-0">
        <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
          テナント（学校）基本設定
        </h3>
        <p className="text-[10px] sm:text-xs font-bold text-gray-500 mt-1">
          組織の基本情報、識別コード、ログイン連携、テナント画像の管理を行います。
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-4 sm:space-y-6">
        
        {/* === テナント固有識別情報 === */}
        <div className="bg-white shadow-xs rounded-2xl overflow-hidden border border-gray-200">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50/80 flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs sm:text-sm font-black text-gray-900">テナント固有識別情報 (システム情報)</h4>
          </div>
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 bg-gray-50/30">
            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-2xs">
              <span className="block text-[10px] font-bold text-gray-400 mb-1">学校識別コード (School Code)</span>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block">
                {exSchoolData.schoolCode || "未発行"}
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-2xs">
              <span className="block text-[10px] font-bold text-gray-400 mb-1">ステータス</span>
              <span className="text-[11px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {exSchoolData.status || "active"}
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-2xs">
              <span className="block text-[10px] font-bold text-gray-400 mb-1">テナント開設日時</span>
              <span className="text-[11px] sm:text-xs font-bold text-gray-600 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-400" /> {formatDateDisplay(exSchoolData.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* === テナント基本プロフィール === */}
        <div className="bg-white shadow-xs rounded-2xl overflow-hidden border border-gray-200">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50/80 flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs sm:text-sm font-black text-gray-900">テナント基本プロフィール</h4>
          </div>
          
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            
            {/* テナント画像 */}
            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-gray-700 mb-2">テナント写真・シンボルマーク</label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gray-100 border-2 border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 relative group shadow-sm mx-auto sm:mx-0">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Tenant Photo" className="w-full h-full object-cover" />
                  ) : (
                    <Building className="w-8 h-8 sm:w-10 sm:h-10 text-gray-300" />
                  )}
                  <div 
                    onClick={() => fileInputRef.current?.click()} 
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                </div>

                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                />

                <div className="space-y-2 text-center sm:text-left">
                  <div className="flex justify-center sm:justify-start gap-2">
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()} 
                      className="px-3 sm:px-4 py-2 bg-white border border-gray-300 text-gray-700 text-[11px] sm:text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-2xs flex items-center gap-1.5"
                    >
                      <Camera className="w-4 h-4 text-indigo-600" /> 画像を選択
                    </button>
                    {photoUrl && (
                      <button 
                        type="button" 
                        onClick={handleRemovePhoto} 
                        className="px-3 py-2 bg-red-50 text-red-600 border border-red-100 text-[11px] sm:text-xs font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">削除</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 leading-relaxed max-w-xs mx-auto sm:mx-0">
                    ※ ヘッダーやサイドバー、発行書類のシンボルマークとして使用されます。
                  </p>
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* 各種入力フォーム */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">
                  学校名・組織名 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    required 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="例: 熊本県立熊本高等学校" 
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-[16px] sm:text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1">学校区分・種別</label>
                <select 
                  value={schoolType} 
                  onChange={e => setSchoolType(e.target.value)} 
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="high_school">高等学校 (High School)</option>
                  <option value="junior_high_school">中学校 (Junior High School)</option>
                  <option value="combined_school">中高一貫校 (Combined School)</option>
                  <option value="university">大学・高等専門学校 (University/College)</option>
                  <option value="other">その他組織・団体</option>
                </select>
              </div>

              <div className="sm:col-span-2 mt-1 bg-gray-50/50 p-3 sm:p-4 rounded-xl border border-gray-100">
                <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                  所在地情報 
                  <span className="text-[9px] text-gray-400 font-normal">（ダッシュボードの天気予報などに使用されます）</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <div className="flex w-full sm:w-48 gap-1.5">
                    <input 
                      type="number" 
                      placeholder="郵便番号 (ハイフンなし)" 
                      value={postalCode} 
                      onChange={e => setPostalCode(e.target.value)} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-[16px] sm:text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                    <button 
                      type="button" 
                      onClick={handleZipcodeSearch}
                      disabled={isSearchingZip || !postalCode}
                      className="px-3 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors text-xs font-bold text-gray-600 flex items-center justify-center whitespace-nowrap disabled:opacity-50 shadow-sm"
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
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-[16px] sm:text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                  </div>
                </div>
              </div>

              {/* 手入力の代わりにテナント管理者のリストを表示 */}
              <div className="sm:col-span-2 mt-1">
                <label className="block text-[10px] sm:text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                  テナント管理者
                </label>
                <div className="bg-gray-50/50 p-3 sm:p-4 rounded-xl border border-gray-100">
                  {isLoadingAdmins ? (
                    <div className="flex items-center gap-2 text-gray-500 text-[10px] sm:text-xs font-bold">
                      <Loader2 className="w-4 h-4 animate-spin" /> 読み込み中...
                    </div>
                  ) : adminUsers.length === 0 ? (
                    <div className="text-[10px] sm:text-xs text-gray-500 font-bold">
                      テナント管理者が設定されていません。
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {adminUsers.map(admin => (
                        <div key={admin.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-black text-gray-900">
                            <User className="w-3.5 h-3.5 text-indigo-600" />
                            {admin.name}
                          </div>
                          <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-bold text-gray-500">
                            <Mail className="w-3.5 h-3.5" />
                            {admin.email || "メール未設定"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* === 外部連携ログイン設定 === */}
        <div className="bg-white shadow-xs rounded-2xl overflow-hidden border border-gray-200">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50/80 flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs sm:text-sm font-black text-gray-900">外部連携ログイン設定 (ソーシャル認証)</h4>
          </div>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h5 className="text-[11px] sm:text-xs font-bold text-gray-900 truncate">Google アカウントログイン</h5>
                <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 leading-tight">学校の Google Workspace アカウント連携を許可</p>
              </div>
              <label className="inline-flex relative items-center cursor-pointer shrink-0">
                <input type="checkbox" className="sr-only peer" checked={allowGoogle} onChange={() => setAllowGoogle(!allowGoogle)} />
                <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <hr className="border-gray-100" />

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h5 className="text-[11px] sm:text-xs font-bold text-gray-900 truncate">Microsoft アカウントログイン</h5>
                <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 leading-tight">学校配布の Microsoft 365 アカウント連携を許可</p>
              </div>
              <label className="inline-flex relative items-center cursor-pointer shrink-0">
                <input type="checkbox" className="sr-only peer" checked={allowMicrosoft} onChange={() => setAllowMicrosoft(!allowMicrosoft)} />
                <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50/80 border-t border-gray-200 flex justify-end">
            <button 
              type="submit" 
              disabled={isSaving} 
              className={`w-full sm:w-auto inline-flex justify-center items-center py-3 sm:py-2.5 px-8 border border-transparent shadow-sm text-[13px] sm:text-xs font-bold rounded-xl text-white transition-colors ${
                isSaving ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]"
              }`}
            >
              {isSaving ? (
                <><Loader2 className="animate-spin h-4 w-4 mr-2" /> 保存中...</>
              ) : (
                "テナント設定を保存"
              )}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}