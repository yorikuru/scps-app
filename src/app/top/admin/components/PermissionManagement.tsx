"use client";

import React from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LayoutDashboard } from "lucide-react";
import { UserData, SchoolData, SYSTEM_MODULES } from "../page";

type Props = {
  users: UserData[];
  setUsers: (users: UserData[]) => void;
  schoolData: SchoolData | null;
  showAlert: (type: "success" | "error", message: string) => void;
};

export default function PermissionManagement({ users, setUsers, schoolData, showAlert }: Props) {
  
  const toggleUserModule = async (userId: string, moduleId: string, currentModules: string[]) => {
    try {
      const newModules = currentModules.includes(moduleId)
        ? currentModules.filter(m => m !== moduleId)
        : [...currentModules, moduleId];

      await updateDoc(doc(db, "users", userId), { allowedModules: newModules });
      setUsers(users.map(u => u.id === userId ? { ...u, allowedModules: newModules } : u));
    } catch (error) {
      showAlert("error", "権限の更新に失敗しました。");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-extrabold text-gray-900">機能権限管理</h3>
        <p className="text-sm text-gray-500 mt-1">YORIKURUが提供するシステムのうち、各ユーザーがどの機能を利用できるかを個別に制御します。</p>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">対象ユーザー</th>
                {SYSTEM_MODULES.map(mod => (
                  <th key={mod.id} className="px-4 py-3 text-center text-xs font-extrabold text-gray-500 uppercase tracking-wider">
                    <div className="flex flex-col items-center">
                      <LayoutDashboard className="h-4 w-4 mb-1 text-gray-400" />
                      {mod.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.filter(u => u.accountStatus === "active").map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white border-r border-gray-100 z-10">
                    <div className="text-sm font-bold text-gray-900">{user.name}</div>
                    <div className="text-xs text-gray-500">{user.role}</div>
                  </td>
                  {SYSTEM_MODULES.map(mod => {
                    const isAvailableToTenant = schoolData?.availableModules?.includes(mod.id) || true;
                    const isUserAllowed = user.allowedModules?.includes(mod.id) || false;
                    
                    return (
                      <td key={mod.id} className="px-4 py-4 text-center whitespace-nowrap bg-white">
                        <label className="inline-flex relative items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={isUserAllowed}
                            disabled={!isAvailableToTenant || user.role === "system_admin"}
                            onChange={() => toggleUserModule(user.id, mod.id, user.allowedModules || [])}
                          />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600 disabled:opacity-50"></div>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}