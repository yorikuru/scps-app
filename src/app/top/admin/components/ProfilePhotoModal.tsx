"use client";

import React, { useState, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
// ★ 追加: storageとアップロード用の関数をインポート
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { X, Upload, Loader2, Camera, User as UserIcon } from "lucide-react";
import { ExtendedUserData } from "./UserManagement";

type Props = {
  user: ExtendedUserData;
  onClose: () => void;
  onSuccess: (newPhotoUrl: string) => void;
  showAlert: (type: "success" | "error" | "warning", message: string) => void;
};

export default function ProfilePhotoModal({ user, onClose, onSuccess, showAlert }: Props) {
  // previewUrlには、既存のURLまたは新しく選択した画像のBlob URLを保持する
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.photoURL || null);
  // Storageにアップロードするためのバイナリデータ（Blob）を保持する
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        
        // ★ 変更: Base64ではなく Blob (バイナリデータ) として出力する
        canvas.toBlob((blob) => {
          if (blob) {
            setImageBlob(blob);
            // プレビュー表示用に一時的なローカルURLを生成
            setPreviewUrl(URL.createObjectURL(blob));
          }
        }, "image/jpeg", 0.8);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!imageBlob && !previewUrl) {
      showAlert("warning", "画像が選択されていません。");
      return;
    }

    // 新しい画像（Blob）がセットされていなければ、何もせず閉じる
    if (!imageBlob) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Storageの保存先パスを定義 (例: avatars/{schoolId}/{userId}.jpg)
      const storagePath = `avatars/${user.schoolId}/${user.id}.jpg`;
      const storageRef = ref(storage, storagePath);

      // 2. Storageへ画像をアップロード
      await uploadBytes(storageRef, imageBlob, { contentType: 'image/jpeg' });

      // 3. アップロードした画像の公開URL(ダウンロードURL)を取得
      const downloadURL = await getDownloadURL(storageRef);

      // 4. FirestoreのユーザーデータにURLを保存
      await updateDoc(doc(db, "users", user.id), {
        photoURL: downloadURL
      });

      showAlert("success", "プロフィール写真を設定しました。");
      onSuccess(downloadURL);
    } catch (error) {
      console.error(error);
      showAlert("error", "プロフィール写真の保存に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePhoto = async () => {
    setIsSubmitting(true);
    try {
      // 1. Storage上の画像ファイルを削除する (既存画像がある場合)
      if (user.photoURL && user.photoURL.includes('firebase')) {
        const storagePath = `avatars/${user.schoolId}/${user.id}.jpg`;
        const storageRef = ref(storage, storagePath);
        try {
          await deleteObject(storageRef);
        } catch (storageError) {
          console.warn("Storageファイルの削除スキップ:", storageError);
          // ファイルが存在しない場合のエラーは無視して進める
        }
      }

      // 2. FirestoreのURLを消去する
      await updateDoc(doc(db, "users", user.id), {
        photoURL: null
      });

      showAlert("success", "プロフィール写真を削除しました。");
      onSuccess("");
    } catch (error) {
      console.error(error);
      showAlert("error", "削除に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-gray-100 p-6 text-center relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
        
        <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center justify-center gap-2">
          <Camera className="w-5 h-5 text-indigo-600" /> プロフィール写真の設定
        </h3>

        <div className="flex flex-col items-center mb-6">
          <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg mb-4 relative group">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-12 h-12 text-gray-300" />
            )}
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Upload className="w-8 h-8 text-white drop-shadow-md" />
            </div>
          </div>
          
          <h4 className="text-sm font-black text-gray-900">{user.name}</h4>
          <p className="text-xs font-bold text-gray-500">{user.email}</p>
        </div>

        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
        />

        <div className="flex gap-3 mt-2">
          {user.photoURL && (
            <button 
              onClick={handleRemovePhoto} 
              disabled={isSubmitting}
              className="px-4 py-3 bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-xs font-bold rounded-xl active:scale-[0.98] disabled:opacity-50"
            >
              削除
            </button>
          )}
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isSubmitting}
            className="flex-1 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-xs font-bold rounded-xl active:scale-[0.98] disabled:opacity-50"
          >
            画像を選ぶ
          </button>
          <button 
            onClick={handleSave} 
            // 新しい画像(imageBlob)が選択されていなければ保存ボタンを無効化
            disabled={isSubmitting || (!imageBlob && !user.photoURL)}
            className="flex-1 py-3 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-xs font-bold rounded-xl shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center justify-center"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}