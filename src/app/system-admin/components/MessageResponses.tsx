"use client";

import React from "react";
import { CheckSquare } from "lucide-react";
import { SystemMessage } from "./MessageDelivery";
import { GlobalUserData, TenantData } from "../page";

type Props = {
  messages: SystemMessage[];
  tenants: TenantData[];
  users: GlobalUserData[];
  setQueryParams: (params: Record<string, string | null>) => void;
};

export default function MessageResponses({ messages, tenants, users, setQueryParams }: Props) {
  const requireResponseMessages = messages.filter(m => m.requireResponse);

  const getTargetTenants = (msg: SystemMessage) => {
    if (msg.targetType === "all") return tenants.map(t => t.id);
    if (msg.targetType === "tenant") return msg.targetIds && msg.targetIds.length > 0 ? msg.targetIds : (msg.targetId ? [msg.targetId] : []);
    if (msg.targetType === "department" || msg.targetType === "user") {
      const userIds = msg.targetIds || [];
      const tIds = new Set<string>();
      userIds.forEach(uid => {
        const u = users.find(user => user.id === uid);
        if (u) tIds.add(u.schoolId);
      });
      return Array.from(tIds);
    }
    return [];
  };

  const getTenantCompletion = (msg: SystemMessage, tenantId: string) => {
    let tUsers = [];
    if (msg.targetType === "all" || msg.targetType === "tenant") {
      tUsers = users.filter(u => u.schoolId === tenantId);
    } else {
      tUsers = users.filter(u => u.schoolId === tenantId && msg.targetIds?.includes(u.id));
    }
    const total = tUsers.length;
    if (total === 0) return { total: 0, responded: 0, isCompleted: true, unresponded: [], respondedUsers: [] }; 
    const respondedUsers = tUsers.filter(u => msg.responses?.includes(u.id));
    const unresponded = tUsers.filter(u => !msg.responses?.includes(u.id));
    const isCompleted = msg.responseType === "single" ? respondedUsers.length > 0 : respondedUsers.length >= total;
    return { total, responded: respondedUsers.length, isCompleted, unresponded, respondedUsers };
  };

  if (requireResponseMessages.length === 0) {
    return (
      <div className="py-16 text-center flex flex-col items-center">
        <CheckSquare className="w-10 h-10 text-gray-300 mb-3" />
        <p className="text-gray-400 font-bold text-sm">対応応答を要求しているメッセージはありません。</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-left whitespace-nowrap">
        <thead className="bg-gray-50 text-[11px] font-bold text-gray-500">
          <tr>
            <th className="px-4 py-3 border-r border-gray-100">メッセージ タイトル</th>
            <th className="px-4 py-3 border-r border-gray-100 w-32">対応条件</th>
            <th className="px-4 py-3 border-r border-gray-100 w-48">全体進捗状況</th>
            <th className="px-4 py-3 min-w-[300px]">テナント別 詳細状況</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100 text-xs">
          {requireResponseMessages.map(msg => {
            const tIds = getTargetTenants(msg);
            let vCount = 0; let cCount = 0; let oTotal = 0; let oResp = 0;
            tIds.forEach(tid => {
              const c = getTenantCompletion(msg, tid);
              if (c.total > 0) {
                vCount++; oTotal += c.total; oResp += c.responded;
                if (c.isCompleted) cCount++;
              }
            });
            const isCompleted = msg.responseType === "single" ? cCount === vCount && vCount > 0 : oResp >= oTotal && oTotal > 0;
            const percent = msg.responseType === "single" ? (vCount > 0 ? Math.round((cCount / vCount) * 100) : 0) : (oTotal > 0 ? Math.round((oResp / oTotal) * 100) : 0);

            return (
              <tr key={msg.id} onClick={() => setQueryParams({ viewId: msg.id })} className="hover:bg-blue-50/50 cursor-pointer transition-colors align-top">
                <td className="px-4 py-4 border-r border-gray-100 whitespace-normal">
                  <div className="font-extrabold text-gray-900 leading-snug">{msg.title}</div>
                  <div className="text-[9px] text-gray-400 mt-1">配信開始: {msg.startAt ? msg.startAt.replace("T", " ") : "指定なし"}</div>
                </td>
                
                <td className="px-4 py-4 border-r border-gray-100">
                  <span className={`px-2 py-1 rounded text-[9px] font-bold border flex flex-col gap-1 items-center text-center ${msg.responseType === "all" ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                    <span>{msg.responseType === "all" ? "全員必須" : "誰か1人で完了"}</span>
                    <span className="text-[8px] opacity-70 border-t border-current pt-0.5 w-full">(テナントごと)</span>
                  </span>
                </td>

                <td className="px-4 py-4 border-r border-gray-100">
                  <div className="flex flex-col gap-1.5 w-full max-w-[150px]">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className={isCompleted ? "text-green-600" : "text-red-600"}>{isCompleted ? "全体完了" : "未完了"}</span>
                      {msg.responseType === "all" ? (
                        <span className="text-gray-500">{oResp} / {oTotal} 名</span>
                      ) : (
                        <span className="text-gray-500">{cCount} / {vCount} 組織</span>
                      )}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden flex">
                      <div className={`h-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-4 whitespace-normal">
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {tIds.map(tid => {
                      const t = tenants.find(t=>t.id===tid);
                      const c = getTenantCompletion(msg, tid);
                      if (c.total === 0) return null;

                      return (
                        <div key={tid} className="border border-gray-200 rounded-lg p-2 bg-gray-50 flex flex-col gap-1.5">
                           <div className="flex justify-between items-center border-b border-gray-200 pb-1">
                              <span className="text-[10px] font-bold text-gray-800">{t?.name || "不明"}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.isCompleted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                 {c.isCompleted ? '完了' : '未完了'} ({c.responded}/{c.total})
                              </span>
                           </div>
                           {msg.responseType === "single" ? (
                              c.isCompleted ? (
                                <span className="text-[9px] text-gray-600 font-medium">対応者: {c.respondedUsers.map(u=>u.name).join(", ")}</span>
                              ) : (
                                <span className="text-[9px] text-gray-400 font-medium">このテナントの誰か1人の対応待ち</span>
                              )
                           ) : (
                              c.isCompleted ? (
                                <span className="text-[9px] text-green-600 font-bold">全員対応済み</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {c.unresponded.map(u => <span key={u.id} className="text-[8px] bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-600">{u.name}</span>)}
                                </div>
                              )
                           )}
                        </div>
                      )
                    })}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}