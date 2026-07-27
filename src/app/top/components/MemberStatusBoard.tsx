"use client";

import React, { useState } from "react";
import { UserCheck, Loader2 } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserData } from "../page";

type Props = {
  userData: UserData | null;
  tenantUsers: UserData[];
};

const STATUS_OPTIONS: Record<string, { label: string; color: string; bgColor: string }> = {
  in_room: { label: "🟢 在室（生徒会室）", color: "text-green-700 dark:text-green-300", bgColor: "bg-green-100 dark:bg-green-950/60" },
  in_class: { label: "🟡 授業中・対応不可", color: "text-yellow-700 dark:text-yellow-300", bgColor: "bg-yellow-100 dark:bg-yellow-950/60" },
  offline: { label: "🔴 帰宅・オフライン", color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-800" },
};

export default function MemberStatusBoard({ userData, tenantUsers }: Props) {
  const [currentStatus, setCurrentStatus] = useState<string>(
    userData?.userStatus || "offline"
  );
  const [isUpdating, setIsUpdating] = useState(false);

  // 自分のステータス更新処理
  const handleStatusChange = async (newStatus: string) => {
    if (!userData) return;
    setCurrentStatus(newStatus);
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "users", userData.id), {
        userStatus: newStatus,
        statusUpdatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Status update error:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin": return "管理";
      case "officer": return "役員";
      case "system_admin": return "特権";
      default: return "生徒";
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
        <h3 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center">
          <UserCheck className="h-4 w-4 mr-2 text-rose-600" /> メンバーの動静
        </h3>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* 自分のステータス変更セクション */}
        <div className="pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-center mb-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase">自分のステータス</p>
            {isUpdating && <Loader2 className="h-3 w-3 animate-spin text-blue-600" />}
          </div>
          <select
            value={currentStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-full border-gray-300 dark:border-gray-700 rounded-xl text-xs font-bold bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-blue-500"
          >
            <option value="in_room">🟢 在室（生徒会室）</option>
            <option value="in_class">🟡 授業中・対応不可</option>
            <option value="offline">🔴 帰宅・オフライン</option>
          </select>
        </div>

        {/* リアルタイムメンバー一覧 */}
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {tenantUsers.length === 0 ? (
            <p className="text-xs text-center text-gray-400 py-4">メンバーがいません</p>
          ) : (
            tenantUsers.map((u) => {
              const uStatusKey = u.id === userData?.id ? currentStatus : (u.userStatus || "offline");
              const statusInfo = STATUS_OPTIONS[uStatusKey] || STATUS_OPTIONS.offline;

              return (
                <div key={u.id} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-colors">
                  <div className="flex items-center gap-2 overflow-hidden mr-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {getRoleBadge(u.role)}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{u.name}</p>
                      {u.positionName && (
                        <p className="text-[10px] text-gray-400 truncate">{u.positionName}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${statusInfo.bgColor} ${statusInfo.color}`}>
                    {statusInfo.label.split(" ")[0]} {statusInfo.label.split(" ")[1]?.substring(0, 4)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}