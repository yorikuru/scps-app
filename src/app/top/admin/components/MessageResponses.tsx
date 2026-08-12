"use client";

import React from "react";
import { CheckSquare } from "lucide-react";
import { SystemMessage } from "./MessageDelivery";
import { UserData } from "../page";

type Props = {
  messages: SystemMessage[];
  users: UserData[];
  setQueryParams: (params: Record<string, string | null>) => void;
};

export default function MessageResponses({ messages, users, setQueryParams }: Props) {
  const requireResponseMessages = messages.filter(m => m.requireResponse);

  const getTargetUsers = (msg: SystemMessage) => {
    if (msg.targetType === "tenant") return users;
    if (msg.targetType === "user" || msg.targetType === "department") return users.filter(u => msg.targetIds?.includes(u.id));
    return [];
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
    <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-white rounded-b-2xl h-full min-h-0">
      <table className="min-w-full divide-y divide-gray-200 text-left whitespace-nowrap">
        <thead className="bg-gray-50 text-[10px] sm:text-[11px] font-bold text-gray-500 sticky top-0 z-10 shadow-sm">
          <tr>
            <th className="px-3 sm:px-4 py-3 border-r border-gray-100 min-w-[200px]">メッセージ タイトル</th>
            <th className="px-3 sm:px-4 py-3 border-r border-gray-100 w-24 sm:w-32">対応条件</th>
            <th className="px-3 sm:px-4 py-3 border-r border-gray-100 w-32 sm:w-48">進捗状況</th>
            <th className="px-3 sm:px-4 py-3 min-w-[250px] sm:min-w-[300px]">詳細 (未対応者 / 対応者)</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100 text-xs">
          {requireResponseMessages.map(msg => {
            const targetUsers = getTargetUsers(msg);
            const total = targetUsers.length;
            const respondedCount = msg.responses?.length || 0;
            
            const isAllCompleted = msg.responseType === "all" && total > 0 && respondedCount >= total;
            const isSingleCompleted = msg.responseType === "single" && respondedCount > 0;
            const isCompleted = isAllCompleted || isSingleCompleted;
            
            const percent = msg.responseType === "single" 
              ? (isCompleted ? 100 : 0)
              : (total > 0 ? Math.round((respondedCount / total) * 100) : 0);

            const unrespondedUsers = targetUsers.filter(u => !(msg.responses || []).includes(u.id));

            return (
              <tr key={msg.id} onClick={() => setQueryParams({ viewId: msg.id })} className="hover:bg-blue-50/50 cursor-pointer transition-colors align-top">
                <td className="px-3 sm:px-4 py-3 sm:py-4 border-r border-gray-100 whitespace-normal">
                  <div className="font-extrabold text-gray-900 leading-snug">{msg.title}</div>
                  <div className="text-[8px] sm:text-[9px] text-gray-400 mt-1">配信開始: {msg.startAt ? msg.startAt.replace("T", " ") : "指定なし"}</div>
                </td>
                
                <td className="px-3 sm:px-4 py-3 sm:py-4 border-r border-gray-100">
                  <span className={`px-2 py-1 rounded text-[8px] sm:text-[9px] font-bold border inline-block ${msg.responseType === "all" ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                    {msg.responseType === "all" ? "全員必須" : "誰か1人で完了"}
                  </span>
                </td>

                <td className="px-3 sm:px-4 py-3 sm:py-4 border-r border-gray-100">
                  <div className="flex flex-col gap-1.5 w-full max-w-[120px] sm:max-w-[150px]">
                    <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-bold">
                      <span className={isCompleted ? "text-green-600" : "text-red-600"}>{isCompleted ? "完了" : "未完了"}</span>
                      {msg.responseType === "all" ? (
                        <span className="text-gray-500">{respondedCount} / {total}</span>
                      ) : (
                        <span className="text-gray-500">{isCompleted ? "1" : "0"} / 1</span>
                      )}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden flex">
                      <div className={`h-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-red-400'}`} style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                </td>

                <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-normal">
                  {msg.responseType === "single" ? (
                    isCompleted ? (
                      <span className="text-[9px] sm:text-[10px] font-black text-blue-600 flex items-center bg-blue-50 border border-blue-100 px-2 py-1.5 rounded-lg w-fit">
                        <CheckSquare className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 sm:mr-1.5 flex-shrink-0"/>
                        対応済み（{msg.responses?.map(id => users.find(u=>u.id===id)?.name || "不明").join(", ")}）
                      </span>
                    ) : (
                      <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 block">対象者のうち誰か1人が対応すると完了になります</span>
                    )
                  ) : (
                    isCompleted ? (
                      <span className="text-[9px] sm:text-[10px] font-black text-green-600 flex items-center"><CheckSquare className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1"/> 全員完了</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                        {unrespondedUsers.map(u => (
                          <span key={u.id} className="text-[8px] sm:text-[9px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">{u.name}</span>
                        ))}
                        {unrespondedUsers.length === 0 && <span className="text-[9px] sm:text-[10px] font-bold text-gray-400">対象者なし</span>}
                      </div>
                    )
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}