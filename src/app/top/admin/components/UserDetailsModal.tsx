"use client";

import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { X, ShieldCheck, Loader2, Mail, ScanLine, Fingerprint, Lock } from "lucide-react";
import { UserData, SchoolData, MfaPolicy } from "../page";

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
  useCustomMfaPolicy?: boolean;
  mfaPolicies?: {
    email: MfaPolicy;
    totp: MfaPolicy;
    passkey: MfaPolicy;
  };
};

type Props = {
  user: ExtendedUserData;
  schoolData: SchoolData | null;
  onClose: () => void;
  showAlert: (type: "success" | "error", message: string) => void;
  onUpdateUser: (updatedUser: ExtendedUserData) => void;
};

export default function UserDetailsModal({ user, schoolData, onClose, showAlert, onUpdateUser }: Props) {
  const [isUpdating, setIsUpdating] = useState(false);
  
  // 個別MFA設定のローカルステート
  const [useCustomMfaPolicy, setUseCustomMfaPolicy] = useState(user.useCustomMfaPolicy || false);
  const [mfaPolicies, setMfaPolicies] = useState(user.mfaPolicies || {
    email: { allowSetup: true, forceSetup: false, allowUsage: true },
    totp: { allowSetup: false, forceSetup: false, allowUsage: false },
    passkey: { allowSetup: false, forceSetup: false, allowUsage: false },
  });

  const toggleUserMfa = async () => {
    setIsUpdating(true);
    try {
      const newValue = !user.requireMfa;
      await updateDoc(doc(db, "users", user.id), { requireMfa: newValue });
      onUpdateUser({ ...user, requireMfa: newValue });
      showAlert("success", `2段階認証の必須化を${newValue ? "オン" : "オフ"}にしました。`);
    } catch (error) {
      showAlert("error", "セキュリティ設定の更新に失敗しました。");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleCustomPolicy = async (newValue: boolean) => {
    setIsUpdating(true);
    setUseCustomMfaPolicy(newValue);
    try {
      await updateDoc(doc(db, "users", user.id), { useCustomMfaPolicy: newValue, mfaPolicies });
      onUpdateUser({ ...user, useCustomMfaPolicy: newValue, mfaPolicies });
      showAlert("success", `個別MFA設定を${newValue ? "有効" : "無効(組織準拠)"}にしました。`);
    } catch (e) {
      showAlert("error", "設定の更新に失敗しました。");
      setUseCustomMfaPolicy(!newValue); // rollback
    } finally {
      setIsUpdating(false);
    }
  };

  const updatePolicy = async (methodKey: 'email' | 'totp' | 'passkey', field: keyof MfaPolicy, value: boolean) => {
    if (!useCustomMfaPolicy) return; // 個別設定オフの時は操作不可
    
    const newPolicies = { ...mfaPolicies };
    newPolicies[methodKey] = { ...newPolicies[methodKey], [field]: value };
    
    // 矛盾防止ロジック
    if (field === 'forceSetup' && value) newPolicies[methodKey].allowSetup = true;
    if (field === 'allowSetup' && !value) newPolicies[methodKey].forceSetup = false;
    
    setMfaPolicies(newPolicies);
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "users", user.id), { mfaPolicies: newPolicies });
      onUpdateUser({ ...user, mfaPolicies: newPolicies });
    } catch (e) {
      showAlert("error", "個別MFA設定の更新に失敗しました。");
    } finally {
      setIsUpdating(false);
    }
  };

  // 表示用（カスタムがオフならテナントの設定、オンなら個人の設定を表示）
  const activePolicies = useCustomMfaPolicy 
    ? mfaPolicies 
    : (schoolData?.mfaPolicies || {
        email: { allowSetup: true, forceSetup: false, allowUsage: true },
        totp: { allowSetup: false, forceSetup: false, allowUsage: false },
        passkey: { allowSetup: false, forceSetup: false, allowUsage: false },
      });

  const PolicyRow = ({ methodKey, name, icon: Icon }: { methodKey: 'email' | 'totp' | 'passkey', name: string, icon: any }) => {
    const policy = activePolicies[methodKey];
    return (
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${useCustomMfaPolicy ? 'border-blue-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-80'}`}>
        <div className="flex items-center">
          <div className={`p-2 rounded-lg mr-3 ${useCustomMfaPolicy ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
            <Icon className="h-5 w-5" />
          </div>
          <span className={`text-sm font-bold ${useCustomMfaPolicy ? 'text-gray-900' : 'text-gray-600'}`}>{name}</span>
        </div>
        <div className="flex gap-3 md:gap-6 ml-12 md:ml-0 bg-gray-50/50 p-2 rounded-lg border border-gray-100">
          <label className={`flex flex-col items-center ${useCustomMfaPolicy ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
            <span className="text-[10px] font-bold text-gray-500 mb-1.5">設定許可</span>
            <input type="checkbox" className="h-4 w-4 text-blue-600 rounded" disabled={!useCustomMfaPolicy || isUpdating} checked={policy.allowSetup} onChange={(e) => updatePolicy(methodKey, 'allowSetup', e.target.checked)} />
          </label>
          <label className={`flex flex-col items-center border-l border-r border-gray-200 px-3 md:px-6 ${useCustomMfaPolicy ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
            <span className="text-[10px] font-bold text-gray-500 mb-1.5">設定強制</span>
            <input type="checkbox" className="h-4 w-4 text-red-500 rounded" disabled={!useCustomMfaPolicy || isUpdating} checked={policy.forceSetup} onChange={(e) => updatePolicy(methodKey, 'forceSetup', e.target.checked)} />
          </label>
          <label className={`flex flex-col items-center ${useCustomMfaPolicy ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
            <span className="text-[10px] font-bold text-gray-500 mb-1.5">ログイン利用</span>
            <input type="checkbox" className="h-4 w-4 text-emerald-500 rounded" disabled={!useCustomMfaPolicy || isUpdating} checked={policy.allowUsage} onChange={(e) => updatePolicy(methodKey, 'allowUsage', e.target.checked)} />
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white flex-shrink-0">
          <h3 className="text-xl font-extrabold text-gray-900 flex items-center">
            <div className="bg-blue-100 p-2 rounded-full mr-3 text-blue-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            ユーザー詳細・個別セキュリティ設定
          </h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
            
            {/* 左カラム：基本情報・所属情報 */}
            <div className="space-y-8">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h4 className="text-sm font-bold text-blue-900 border-b border-blue-100 pb-2 mb-4">基本情報</h4>
                <div className="grid grid-cols-3 gap-y-3 text-sm">
                  <span className="text-gray-500 font-bold col-span-1">氏名</span>
                  <span className="col-span-2 text-gray-900 font-bold">{user.name} <span className="text-[11px] text-gray-500 ml-2 font-normal">{user.nameKana}</span></span>
                  <span className="text-gray-500 font-bold col-span-1">システム利用番号</span>
                  <span className="col-span-2 font-mono font-bold bg-gray-100 px-2 py-0.5 rounded text-xs inline-block">{user.systemId || "未設定"}</span>
                  <span className="text-gray-500 font-bold col-span-1">システム権限</span>
                  <span className="col-span-2">{user.role === "admin" ? "管理者" : user.role === "officer" ? "役員" : "一般生徒"}</span>
                  <span className="text-gray-500 font-bold col-span-1">メールアドレス</span>
                  <span className="col-span-2">{user.email || "未登録"}</span>
                  <span className="text-gray-500 font-bold col-span-1">ステータス</span>
                  <span className="col-span-2 font-bold">{user.accountStatus === "active" ? "有効" : user.accountStatus === "unaccessed" ? "未アクセス" : user.accountStatus === "pending" ? "承認待ち" : "停止/却下"}</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h4 className="text-sm font-bold text-blue-900 border-b border-blue-100 pb-2 mb-4">学校・所属情報</h4>
                <div className="grid grid-cols-3 gap-y-3 text-sm">
                  <span className="text-gray-500 font-bold col-span-1">学籍番号</span>
                  <span className="col-span-2 font-mono">{user.studentId || "-"}</span>
                  <span className="text-gray-500 font-bold col-span-1">学年 / 組 / 番号</span>
                  <span className="col-span-2">{user.grade || "-"}年 {user.classNumber || "-"}組 {user.attendanceNumber || "-"}番</span>
                  <span className="text-gray-500 font-bold col-span-1">部署・委員会</span>
                  <span className="col-span-2">{user.department || "-"}</span>
                  <span className="text-gray-500 font-bold col-span-1">役職名</span>
                  <span className="col-span-2">{user.positionName || "-"}</span>
                  <span className="text-gray-500 font-bold col-span-1">部活・クラブ</span>
                  <span className="col-span-2">{user.club || "-"}</span>
                </div>
              </div>
            </div>

            {/* 右カラム：セキュリティ設定・MFA */}
            <div className="space-y-8">
              
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h4 className="text-sm font-bold text-blue-900 border-b border-blue-100 pb-2 mb-4">アカウントセキュリティ設定</h4>
                <div className="flex items-center justify-between mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div>
                    <h5 className="text-sm font-bold text-gray-900 flex items-center">
                      2段階認証 (MFA) の常時必須化
                    </h5>
                    <p className="text-[10px] text-gray-500 mt-1">このユーザーのログイン時に2FAを常に強制します。</p>
                  </div>
                  <label className="inline-flex relative items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={user.requireMfa || false} onChange={toggleUserMfa} disabled={isUpdating} />
                    <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${user.requireMfa ? 'bg-blue-600' : ''} ${isUpdating ? 'opacity-50' : ''}`}></div>
                  </label>
                </div>
              </div>

              {/* MFA個別詳細設定 */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between border-b border-blue-100 pb-3 mb-4">
                  <h4 className="text-sm font-bold text-blue-900 flex items-center">
                    <Lock className="h-4 w-4 mr-1.5" />
                    多要素認証 (MFA) 個別ポリシー
                  </h4>
                  
                  <div className="flex items-center bg-gray-100 rounded-lg p-1">
                    <button 
                      onClick={() => handleToggleCustomPolicy(false)} 
                      disabled={isUpdating}
                      className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${!useCustomMfaPolicy ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      組織に従う
                    </button>
                    <button 
                      onClick={() => handleToggleCustomPolicy(true)} 
                      disabled={isUpdating}
                      className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${useCustomMfaPolicy ? 'bg-amber-100 text-amber-800 shadow-sm border border-amber-200' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      個別設定を優先
                    </button>
                  </div>
                </div>

                {!useCustomMfaPolicy && (
                  <div className="mb-4 text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-center font-bold">
                    現在、以下の設定は「テナントの組織設定」と同期して表示されています。
                  </div>
                )}

                <div className="space-y-3 relative">
                  {isUpdating && (
                    <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
                      <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                    </div>
                  )}
                  <PolicyRow methodKey="passkey" name="パスキー (生体認証)" icon={Fingerprint} />
                  <PolicyRow methodKey="totp" name="認証アプリ (TOTP)" icon={ScanLine} />
                  <PolicyRow methodKey="email" name="メール認証" icon={Mail} />
                </div>
              </div>

            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end flex-shrink-0">
          <button onClick={onClose} className="px-8 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-colors shadow-sm">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}