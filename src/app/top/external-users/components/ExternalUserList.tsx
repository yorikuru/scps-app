"use client";

import React from "react";
import { ChevronRight, CheckCircle2, XCircle, Clock, MoreVertical, Key } from "lucide-react";
import { ExternalUser } from "@/app/types/external";
import * as LucideIcons from "lucide-react";

type Props = {
  users: ExternalUser[];
  systemApps: any[];
  onRowClick: (user: ExternalUser) => void;
};

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

const getStatusConfig = (status: string) => {
  switch(status) {
    case "active": return { label: "有効", color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    case "pending": return { label: "仮登録", color: "bg-amber-100 text-amber-700 border-amber-200" };
    case "verifying": return { label: "確認中", color: "bg-blue-100 text-blue-700 border-blue-200" };
    case "verified": return { label: "PW待", color: "bg-purple-100 text-purple-700 border-purple-200" };
    case "suspended": return { label: "停止中", color: "bg-rose-100 text-rose-700 border-rose-200" };
    default: return { label: "不明", color: "bg-gray-100 text-gray-500 border-gray-200" };
  }
};

const getCategoryLabel = (cat: string) => {
  switch (cat) {
    case "student": return "生徒";
    case "teacher": return "教職員";
    default: return "その他";
  }
};

export default function ExternalUserList({ users, systemApps, onRowClick }: Props) {
  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden w-full h-full flex flex-col">
      <div className="overflow-x-auto custom-scrollbar flex-1">
        <table className="min-w-full divide-y divide-gray-200 text-left whitespace-nowrap min-w-[800px]">
          <thead className="bg-gray-50 text-[10px] font-black text-gray-500 sticky top-0 z-10 shadow-2xs">
            <tr>
              <th scope="col" className="px-4 py-3 border-r border-gray-200 w-12 text-center"></th>
              <th scope="col" className="px-4 py-3 border-r border-gray-200">ユーザー名 / ログインID</th>
              <th scope="col" className="px-4 py-3 border-r border-gray-200">区分・所属</th>
              <th scope="col" className="px-4 py-3 border-r border-gray-200">状態・有効期限</th>
              <th scope="col" className="px-4 py-3 border-r border-gray-200">許可アプリ</th>
              <th scope="col" className="px-4 py-3 w-10 text-center">詳細</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100 text-xs font-bold">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm font-bold text-gray-400">
                  条件に一致する外部ユーザーが見つかりません。
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const st = getStatusConfig(user.status);
                const allowedCount = user.allowedModules?.length || 0;

                return (
                  <tr 
                    key={user.id} 
                    onClick={() => onRowClick(user)}
                    className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                  >
                    {/* アイコン */}
                    <td className="px-4 py-3 border-r border-gray-100 text-center">
                      <div className="w-8 h-8 rounded-full mx-auto bg-gradient-to-tr from-yellow-400 to-amber-500 flex items-center justify-center text-white font-black text-xs shadow-sm">
                        {user.name.charAt(0)}
                      </div>
                    </td>

                    {/* 名前とID */}
                    <td className="px-4 py-3 border-r border-gray-100">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-black text-gray-900 group-hover:text-indigo-700 transition-colors truncate">{user.name}</span>
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-500 font-mono">
                          <Key className="w-3 h-3 text-gray-400" />
                          {user.loginId}
                        </div>
                      </div>
                    </td>

                    {/* 区分・所属 */}
                    <td className="px-4 py-3 border-r border-gray-100">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-800">{getCategoryLabel(user.category)}</span>
                        <span className="text-[10px] text-gray-500 truncate max-w-[150px] mt-0.5">{user.affiliation || "所属なし"}</span>
                      </div>
                    </td>

                    {/* 状態・期限 */}
                    <td className="px-4 py-3 border-r border-gray-100">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${st.color}`}>
                          {st.label}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {user.validUntil ? user.validUntil : "無期限"}
                        </div>
                      </div>
                    </td>

                    {/* 許可アプリ */}
                    <td className="px-4 py-3 border-r border-gray-100">
                      <div className="flex items-center gap-1.5 flex-wrap max-w-[200px]">
                        {allowedCount === 0 ? (
                          <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                            <XCircle className="w-3 h-3"/> なし
                          </span>
                        ) : (
                          <>
                            {user.allowedModules?.slice(0, 3).map((appId: string) => {
                              const appMeta = systemApps.find(a => a.appId === appId || a.id === appId);
                              return appMeta ? (
                                <div key={appId} className="w-6 h-6 rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center" title={appMeta.name}>
                                  <DynamicIcon name={appMeta.icon} className="w-3.5 h-3.5 text-gray-600" />
                                </div>
                              ) : null;
                            })}
                            {allowedCount > 3 && <span className="text-[10px] font-bold text-gray-500 ml-1">+{allowedCount - 3}</span>}
                          </>
                        )}
                      </div>
                    </td>

                    {/* アクション */}
                    <td className="px-4 py-3 text-center">
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 mx-auto transition-colors" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}