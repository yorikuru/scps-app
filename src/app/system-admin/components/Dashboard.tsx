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
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-extrabold text-gray-900">システムダッシュボード</h3>
        <p className="text-sm text-gray-500 mt-1">YORIKURUプラットフォームの全体統計情報です。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Building2 className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-bold text-gray-500">登録テナント数</p>
              <p className="text-2xl font-extrabold text-gray-900">{tenants.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-bold text-gray-500">総ユーザー数</p>
              <p className="text-2xl font-extrabold text-gray-900">{users.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <UserCheck className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-bold text-gray-500">アクティブユーザー</p>
              <p className="text-2xl font-extrabold text-gray-900">{activeUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-bold text-gray-500">承認待ちユーザー</p>
              <p className="text-2xl font-extrabold text-gray-900">{pendingUsers}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}