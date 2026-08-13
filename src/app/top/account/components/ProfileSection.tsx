"use client";

import React, { useState, useRef } from "react";
import { User as UserIcon, Camera, Upload, Trash2, Loader2 } from "lucide-react";
import { User } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useDialog } from "@/components/DialogContext";

type Props = {
  currentUser: User | null;
  userData: any;
  tenantData: any;
};

export default function ProfileSection({ currentUser, userData, tenantData }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(userData?.photoURL || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { showAlert, showConfirm } = useDialog();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showAlert("画像ファイル（JPG, PNG等）を選択してください。", "warning");
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 256; 
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
        
        canvas.toBlob(async (blob) => {
          if (blob && userData?.id) {
            try {
              const storagePath = `avatars/${userData.schoolId}/${userData.id}.jpg`;
              const storageRef = ref(storage, storagePath);
              
              await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
              const downloadURL = await getDownloadURL(storageRef);

              await updateDoc(doc(db, "users", userData.id), {
                photoURL: downloadURL
              });

              setPhotoUrl(downloadURL);
              showAlert("プロフィール写真を更新しました。", "success");
            } catch (error) {
              console.error(error);
              showAlert("写真の保存に失敗しました。", "error");
            } finally {
              setIsUploading(false);
            }
          } else {
             setIsUploading(false);
          }
        }, "image/jpeg", 0.85);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const executeRemovePhoto = async () => {
    setIsUploading(true);
    try {
      if (photoUrl && photoUrl.includes("firebase")) {
        const storagePath = `avatars/${userData.schoolId}/${userData.id}.jpg`;
        const storageRef = ref(storage, storagePath);
        try { await deleteObject(storageRef); } catch (e) { console.warn("Storage deletion skipped", e); }
      }

      await updateDoc(doc(db, "users", userData.id), {
        photoURL: null
      });

      setPhotoUrl(null);
      showAlert("プロフィール写真を削除しました。", "success");
    } catch (error) {
      console.error(error);
      showAlert("写真の削除に失敗しました。", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    if (!userData?.id || !photoUrl) return;
    
    showConfirm(
      "プロフィール写真を削除しますか？",
      executeRemovePhoto,
      "danger",
      "写真の削除確認"
    );
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 bg-white">
        <h3 className="text-base sm:text-lg font-extrabold text-gray-900 flex items-center">
          <UserIcon className="mr-2 h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          プロフィール情報（編集不可）
        </h3>
      </div>
      <div className="p-0">
        <dl className="divide-y divide-gray-100">
          
          {/* プロフィール写真設定エリア */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center hover:bg-gray-50/50 transition-colors">
            <dt className="text-xs sm:text-sm font-bold text-gray-500 sm:w-1/4 mb-3 sm:mb-0 flex items-center">プロフィール写真</dt>
            <dd className="text-base text-gray-900 font-bold sm:w-3/4 flex items-center gap-4">
              <div className="relative group w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm">
                {isUploading ? (
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-indigo-600" />
                ) : photoUrl ? (
                  <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-6 h-6 sm:w-8 sm:h-8 text-gray-300" />
                )}
                
                {!isUploading && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-1.5 sm:gap-2">
                <div className="flex gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isUploading}
                    className="px-2.5 sm:px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-[10px] sm:text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" /> 画像を選択
                  </button>
                  {photoUrl && (
                    <button 
                      onClick={handleRemovePhoto} 
                      disabled={isUploading}
                      className="px-2.5 sm:px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 text-[10px] sm:text-xs font-bold rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                      title="削除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium leading-tight">画像は自動的にリサイズ・軽量化されます。</p>
              </div>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            </dd>
          </div>

          <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center hover:bg-gray-50/50 transition-colors">
            <dt className="text-xs sm:text-sm font-bold text-gray-500 sm:w-1/4 mb-1 sm:mb-0 flex items-center">氏名</dt>
            <dd className="text-sm sm:text-base text-gray-900 font-bold sm:w-3/4">
              {userData?.name || "未設定"} <span className="text-gray-400 font-medium text-xs sm:text-sm ml-2 sm:ml-3">{userData?.nameKana || ""}</span>
            </dd>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center hover:bg-gray-50/50 transition-colors">
            <dt className="text-xs sm:text-sm font-bold text-gray-500 sm:w-1/4 mb-1 sm:mb-0 flex items-center">メールアドレス</dt>
            <dd className="text-sm sm:text-base text-gray-900 font-medium sm:w-3/4 truncate">{currentUser?.email}</dd>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center hover:bg-gray-50/50 transition-colors">
            <dt className="text-xs sm:text-sm font-bold text-gray-500 sm:w-1/4 mb-1 sm:mb-0 flex items-center">所属テナント</dt>
            <dd className="text-sm sm:text-base text-gray-900 font-medium sm:w-3/4">{tenantData?.name || "未設定"}</dd>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center hover:bg-gray-50/50 transition-colors">
            <dt className="text-xs sm:text-sm font-bold text-gray-500 sm:w-1/4 mb-1 sm:mb-0 flex items-center">役職・権限</dt>
            <dd className="text-sm sm:text-base text-gray-900 font-medium sm:w-3/4 flex items-center flex-wrap gap-2 sm:gap-3">
              <span className="inline-flex items-center px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                {userData?.role === "admin" ? "テナント管理者" : userData?.role === "system_admin" ? "システム特権" : userData?.role === "officer" ? "生徒会役員" : "一般生徒"}
              </span>
              {userData?.positionName && <span className="text-[11px] sm:text-sm text-gray-700 font-bold">{userData.positionName}</span>}
            </dd>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center hover:bg-gray-50/50 transition-colors">
            <dt className="text-xs sm:text-sm font-bold text-gray-500 sm:w-1/4 mb-1 sm:mb-0 flex items-center">電話番号</dt>
            <dd className="text-sm sm:text-base text-gray-900 font-medium sm:w-3/4">{userData?.phoneNumber || "未登録"}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}