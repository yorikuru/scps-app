"use client";

import React from "react";
import { User as UserIcon } from "lucide-react";
import { User } from "firebase/auth";

type Props = {
  currentUser: User | null;
  userData: any;
  tenantData: any;
};

export default function ProfileSection({ currentUser, userData, tenantData }: Props) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 bg-white">
        <h3 className="text-lg font-extrabold text-gray-900 flex items-center">
          <UserIcon className="mr-2 h-5 w-5 text-blue-600" />
          プロフィール情報
        </h3>
      </div>
      <div className="p-0">
        <dl className="divide-y divide-gray-100">
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center hover:bg-gray-50/50 transition-colors">
            <dt className="text-sm font-bold text-gray-500 sm:w-1/4 mb-1 sm:mb-0 flex items-center">氏名</dt>
            <dd className="text-base text-gray-900 font-bold sm:w-3/4">
              {userData?.name || "未設定"} <span className="text-gray-400 font-medium text-sm ml-3">{userData?.nameKana || ""}</span>
            </dd>
          </div>
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center hover:bg-gray-50/50 transition-colors">
            <dt className="text-sm font-bold text-gray-500 sm:w-1/4 mb-1 sm:mb-0 flex items-center">メールアドレス</dt>
            <dd className="text-base text-gray-900 font-medium sm:w-3/4">{currentUser?.email}</dd>
          </div>
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center hover:bg-gray-50/50 transition-colors">
            <dt className="text-sm font-bold text-gray-500 sm:w-1/4 mb-1 sm:mb-0 flex items-center">所属テナント</dt>
            <dd className="text-base text-gray-900 font-medium sm:w-3/4">{tenantData?.name || "未設定"}</dd>
          </div>
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center hover:bg-gray-50/50 transition-colors">
            <dt className="text-sm font-bold text-gray-500 sm:w-1/4 mb-1 sm:mb-0 flex items-center">役職・権限</dt>
            <dd className="text-base text-gray-900 font-medium sm:w-3/4 flex items-center flex-wrap gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                {userData?.role === "admin" ? "テナント管理者" : userData?.role === "system_admin" ? "システム特権" : userData?.role === "officer" ? "生徒会役員" : "一般生徒"}
              </span>
              {userData?.positionName && <span className="text-gray-700 font-bold">{userData.positionName}</span>}
            </dd>
          </div>
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center hover:bg-gray-50/50 transition-colors">
            <dt className="text-sm font-bold text-gray-500 sm:w-1/4 mb-1 sm:mb-0 flex items-center">電話番号</dt>
            <dd className="text-base text-gray-900 font-medium sm:w-3/4">{userData?.phoneNumber || "未登録"}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}