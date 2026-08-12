"use client";

import React from "react";
import { TenantData, GlobalUserData } from "../page";
import { Building2, Users, UserCheck, AlertTriangle } from "lucide-react";

type Props = {
  tenants: TenantData[];
  users: GlobalUserData[];
};

export default function Dashboard({ tenants, users }: Props) {
  const activeTenants = tenants.filter(t => t.status !== "suspended").length;
  const activeUsers = users.filter(u => u.accountStatus === "active").length;
  const pendingUsers = users.filter(u => u.accountStatus === "pending").length;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in max-w-7xl mx-auto w-full">
      <div className="px-1 sm:px-0">
        <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">システムダッシュボード</h3>
        <p className="text-[10px] sm:text-xs text-gray-500 mt-1 font-bold">YORIKURUプラットフォームの全体統計情報です。</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center hover:shadow-md transition-shadow">
          <div className="p-3 sm:p-4 bg-purple-50 rounded-xl border border-purple-100 shrink-0">
            <Building2 className="h-6 w-6 sm:h-7 sm:w-7 text-purple-600" />
          </div>
          <div className="ml-4 min-w-0">
            <p className="text-[10px] sm:text-xs font-bold text-gray-500 mb-0.5">登録テナント数</p>
            <p className="text-2xl sm:text-3xl font-black text-gray-900 leading-none">{tenants.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center hover:shadow-md transition-shadow">
          <div className="p-3 sm:p-4 bg-blue-50 rounded-xl border border-blue-100 shrink-0">
            <Users className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600" />
          </div>
          <div className="ml-4 min-w-0">
            <p className="text-[10px] sm:text-xs font-bold text-gray-500 mb-0.5">総ユーザー数</p>
            <p className="text-2xl sm:text-3xl font-black text-gray-900 leading-none">{users.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center hover:shadow-md transition-shadow">
          <div className="p-3 sm:p-4 bg-emerald-50 rounded-xl border border-emerald-100 shrink-0">
            <UserCheck className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-600" />
          </div>
          <div className="ml-4 min-w-0">
            <p className="text-[10px] sm:text-xs font-bold text-gray-500 mb-0.5">アクティブユーザー</p>
            <p className="text-2xl sm:text-3xl font-black text-gray-900 leading-none">{activeUsers}</p>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center hover:shadow-md transition-shadow">
          <div className="p-3 sm:p-4 bg-amber-50 rounded-xl border border-amber-100 shrink-0">
            <AlertTriangle className="h-6 w-6 sm:h-7 sm:w-7 text-amber-600" />
          </div>
          <div className="ml-4 min-w-0">
            <p className="text-[10px] sm:text-xs font-bold text-gray-500 mb-0.5">承認待ちユーザー</p>
            <p className="text-2xl sm:text-3xl font-black text-gray-900 leading-none">{pendingUsers}</p>
          </div>
        </div>

      </div>
    </div>
  );
}