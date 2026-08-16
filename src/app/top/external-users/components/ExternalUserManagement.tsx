// src/app/top/external-users/components/ExternalUserManagement.tsx
"use client";

import React, { useState } from "react";
import { ArrowLeft, Globe, Edit3, Trash2, X } from "lucide-react";
import { ExternalUser } from "@/app/types/external";
import { SystemApp } from "@/app/system-admin/components/AppManagement";
import { useDialog } from "@/components/DialogContext";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ExternalUserForm from "./ExternalUserForm";

type Props = {
  userData: any; 
  mode: "create" | "edit" | "view";
  targetUser?: ExternalUser | null;
  onClose: () => void;
  onSuccess: () => void;
  systemApps: SystemApp[]; 
  schoolData: any;         
};

export default function ExternalUserManagement({ userData, mode: initialMode, targetUser, onClose, onSuccess, systemApps, schoolData }: Props) {
  const [mode, setMode] = useState<"create" | "edit" | "view">(initialMode);
  const { showAlert, showConfirm } = useDialog();

  const extPerms = schoolData?.externalUserPermissions || {
    canEdit: ["admin", "system_admin", "it_manager"],
    canDelete: ["admin", "system_admin", "it_manager"]
  };

  const userRole = userData?.role || "guest";
  const canEdit = extPerms.canEdit.includes(userRole) || userData?.isITManager;
  const canDelete = extPerms.canDelete.includes(userRole) || userData?.isITManager;

  const executeDelete = async () => {
    if (!targetUser) return;
    try {
      if (targetUser.authUid) {
        await fetch("/api/delete-auth-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authUid: targetUser.authUid })
        });
      }
      await deleteDoc(doc(db, "external_users", targetUser.id));
      showAlert("ユーザーを削除しました。","success");
      onSuccess();
      onClose();
    } catch (error) {
      showAlert("削除に失敗しました。","error");
    }
  };

  const handleDelete = () => {
    if (!targetUser) return;
    showConfirm(
      `「${targetUser.name}」を完全に削除しますか？`,
      executeDelete,
      "danger",
      "ユーザー削除の確認"
    );
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden rounded-t-3xl sm:rounded-3xl border border-gray-200 shadow-2xl">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/80 flex justify-between items-center sticky top-0 z-20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
              <Globe className="w-5 h-5 text-amber-500" />
              {mode === "create" ? "新規外部ユーザー登録" : mode === "edit" ? "外部ユーザー情報の編集" : "外部ユーザー詳細"}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mode === "view" && targetUser && (
            <>
              {canEdit && (
                <button onClick={() => setMode("edit")} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1 shadow-sm">
                  <Edit3 className="w-3.5 h-3.5" /> 編集
                </button>
              )}
              {canDelete && (
                <button onClick={handleDelete} className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1 shadow-sm">
                  <Trash2 className="w-3.5 h-3.5" /> 削除
                </button>
              )}
            </>
          )}
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <ExternalUserForm 
        userData={userData}
        mode={mode}
        targetUser={targetUser}
        onClose={onClose}
        onSuccess={onSuccess}
        systemApps={systemApps}
        schoolData={schoolData}
        setMode={setMode}
      />
    </div>
  );
}