"use client";

import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { X, ShieldCheck, Loader2 } from "lucide-react";
import { UserData } from "../page";

type ExtendedUserData = UserData & {
  systemId?: string;
  studentId?: string;
  nameKana?: string;
  attendanceNumber?: string;
  birthDate?: string;
  classNumber?: string;
  club?: string;
  department?: string;
  gender?: string;
  grade?: string;
  organizationAddress?: string;
  phoneNumber?: string;
  previousSchool?: string;
  accountValidStartDate?: string;
  accountValidEndDate?: string;
  lineConnectionAllowed?: boolean;
  lineConnectionEnforced?: boolean;
  initialPassword?: string; 
  authProviders?: string[];
  accountStatus: "active" | "pending" | "rejected" | "unaccessed";
  requireMfa?: boolean;
};

type Props = {
  user: ExtendedUserData;
  onClose: () => void;
  showAlert: (type: "success" | "error", message: string) => void;
  onUpdateUser: (updatedUser: ExtendedUserData) => void;
};

export default function UserDetailsModal({ user, onClose, showAlert, onUpdateUser }: Props) {
  const [isUpdatingMfa, setIsUpdatingMfa] = useState(false);

  const toggleUserMfa = async () => {
    setIsUpdatingMfa(true);
    try {
      const newValue = !user.requireMfa;
      await updateDoc(doc(db, "users", user.id), { requireMfa: newValue });
      onUpdateUser({ ...user, requireMfa: newValue });
      showAlert("success", `2段階認証を${newValue ? "必須" : "任意"}に変更しました。`);
    } catch (error) {
      showAlert("error", "セキュリティ設定の更新に失敗しました。");
    } finally {
      setIsUpdatingMfa(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4 py-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-full overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-shrink-0">
          <h3 className="text-lg font-extrabold text-gray-900">ユーザー詳細情報</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-blue-900 border-b border-blue-100 pb-1">基本情報</h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-gray-500 font-bold col-span-1">氏名</span>
                <span className="col-span-2 text-gray-900">{user.name} <span className="text-xs text-gray-500 ml-1">({user.nameKana})</span></span>
                <span className="text-gray-500 font-bold col-span-1">システム利用番号</span>
                <span className="col-span-2 font-mono font-bold">{user.systemId || "-"}</span>
                <span className="text-gray-500 font-bold col-span-1">権限</span>
                <span className="col-span-2">{user.role === "admin" ? "管理者" : user.role === "officer" ? "役員" : "生徒"}</span>
                <span className="text-gray-500 font-bold col-span-1">役職名</span>
                <span className="col-span-2">{user.positionName || "-"}</span>
                <span className="text-gray-500 font-bold col-span-1">IT担当者</span>
                <span className="col-span-2">{user.isITManager ? "はい" : "いいえ"}</span>
                <span className="text-gray-500 font-bold col-span-1">メールアドレス</span>
                <span className="col-span-2">{user.email || "-"}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-blue-900 border-b border-blue-100 pb-1">学校・所属情報</h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-gray-500 font-bold col-span-1">学籍番号</span>
                <span className="col-span-2 font-mono">{user.studentId || "-"}</span>
                <span className="text-gray-500 font-bold col-span-1">学年 / 組 / 番号</span>
                <span className="col-span-2">{user.grade || "-"}年 {user.classNumber || "-"}組 {user.attendanceNumber || "-"}番</span>
                <span className="text-gray-500 font-bold col-span-1">部署・コース</span>
                <span className="col-span-2">{user.department || "-"}</span>
                <span className="text-gray-500 font-bold col-span-1">部活・クラブ</span>
                <span className="col-span-2">{user.club || "-"}</span>
                <span className="text-gray-500 font-bold col-span-1">出身校</span>
                <span className="col-span-2">{user.previousSchool || "-"}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-blue-900 border-b border-blue-100 pb-1">個人属性・連絡先</h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-gray-500 font-bold col-span-1">性別</span>
                <span className="col-span-2">{user.gender === "male" ? "男性" : user.gender === "female" ? "女性" : user.gender === "other" ? "その他" : "-"}</span>
                <span className="text-gray-500 font-bold col-span-1">生年月日</span>
                <span className="col-span-2">{user.birthDate || "-"}</span>
                <span className="text-gray-500 font-bold col-span-1">電話番号</span>
                <span className="col-span-2">{user.phoneNumber || "-"}</span>
                <span className="text-gray-500 font-bold col-span-1">所属組織住所</span>
                <span className="col-span-2">{user.organizationAddress || "-"}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-blue-900 border-b border-blue-100 pb-1">システム・セキュリティ設定</h4>
              <div className="grid grid-cols-3 gap-2 text-sm mb-4">
                <span className="text-gray-500 font-bold col-span-1">ステータス</span>
                <span className="col-span-2 font-bold">{user.accountStatus === "active" ? "有効" : user.accountStatus === "unaccessed" ? "未アクセス" : user.accountStatus === "pending" ? "承認待ち" : "停止/却下"}</span>
                <span className="text-gray-500 font-bold col-span-1">有効期間</span>
                <span className="col-span-2">{user.accountValidStartDate || "未指定"} 〜 {user.accountValidEndDate || "未指定"}</span>
                <span className="text-gray-500 font-bold col-span-1">LINE連携</span>
                <span className="col-span-2">{user.lineConnectionEnforced ? "強制" : user.lineConnectionAllowed ? "許可" : "不可"}</span>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-bold text-gray-900 flex items-center">
                      <ShieldCheck className="h-4 w-4 mr-1 text-blue-600" /> 2段階認証 (MFA) の必須化
                    </h5>
                    <p className="text-xs text-gray-500 mt-1">このユーザーのログイン時に2FAを強制します。</p>
                  </div>
                  <label className="inline-flex relative items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={user.requireMfa || false} onChange={toggleUserMfa} disabled={isUpdatingMfa} />
                    <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${user.requireMfa ? 'bg-blue-600' : ''} ${isUpdatingMfa ? 'opacity-50' : ''}`}></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end flex-shrink-0">
          <button onClick={onClose} className="px-6 py-2 bg-gray-900 text-white rounded-md text-sm font-bold hover:bg-gray-800 transition-colors">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}