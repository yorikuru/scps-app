"use client";

import React, { useState, useMemo } from "react";
import { Pin, Calendar, Edit2, Trash2, Search, ArrowUpDown, CheckSquare } from "lucide-react";
import { SystemMessage, CATEGORIES, MessageCategory } from "./MessageDelivery";
import { UserData } from "../page";
import CustomSelect from "@/components/CustomSelect"; // ★ CustomSelect をインポート

type Props = {
  messages: SystemMessage[];
  users: UserData[];
  setQueryParams: (params: Record<string, string | null>) => void;
  requestDelete: (id: string) => void;
};

const DEPARTMENT_LABELS: Record<string, string> = {
  manager: "マネージャー権限層",
  role_teacher: "教職員",
  role_officer: "生徒会役員",
  role_student: "一般生徒",
  role_admin: "管理者"
};

export default function MessageHistory({ messages, users, setQueryParams, requestDelete }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [responseFilter, setResponseFilter] = useState("all");
  const [sortBy, setSortBy] = useState("start_desc");

  const getTargetName = (msg: SystemMessage) => {
    if (msg.targetType === "all") return "SCPS一斉";
    if (msg.targetType === "tenant") return "テナント全体";
    if (msg.targetType === "department") {
      if (!msg.targetDepartments || msg.targetDepartments.length === 0) return "指定なし";
      return msg.targetDepartments.map(dep => {
        if (DEPARTMENT_LABELS[dep]) return DEPARTMENT_LABELS[dep];
        if (dep.startsWith("pos_")) return dep.replace("pos_", "");
        return dep;
      }).join(", ");
    }
    if (msg.targetType === "user") {
      if (!msg.targetIds || msg.targetIds.length === 0) return "指定なし";
      return msg.targetIds.map(uid => {
        const u = users.find(user => user.id === uid);
        return u?.name || "不明なユーザー";
      }).join(", ");
    }
    return "SCPS一斉";
  };

  const getTargetCount = (msg: SystemMessage) => {
    if (msg.targetType === "user" || msg.targetType === "department") return msg.targetIds?.length || 0;
    if (msg.targetType === "tenant") return users.length;
    return 0;
  };

  const processedMessages = useMemo(() => {
    let filtered = messages.filter(msg => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const targetNames = getTargetName(msg).toLowerCase();
        if (
          !msg.title.toLowerCase().includes(query) &&
          !msg.content.toLowerCase().includes(query) &&
          !targetNames.includes(query)
        ) {
          return false;
        }
      }

      if (categoryFilter !== "all" && msg.category !== categoryFilter) return false;

      const isActive = (!msg.startAt || new Date(msg.startAt) <= new Date()) && (!msg.endAt || new Date(msg.endAt) >= new Date());
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;

      const targetCount = getTargetCount(msg);
      const respondedCount = msg.responses?.length || 0;
      const isCompleted = msg.requireResponse && ((msg.responseType === "all" && targetCount > 0 && respondedCount >= targetCount) || (msg.responseType === "single" && respondedCount > 0));
      
      if (responseFilter === "required" && !msg.requireResponse) return false;
      if (responseFilter === "completed" && (!msg.requireResponse || !isCompleted)) return false;
      if (responseFilter === "incomplete" && (!msg.requireResponse || isCompleted)) return false;
      if (responseFilter === "not_required" && msg.requireResponse) return false;

      return true;
    });

    filtered.sort((a, b) => {
      const timeAStart = a.startAt ? new Date(a.startAt).getTime() : new Date(a.createdAt).getTime();
      const timeBStart = b.startAt ? new Date(b.startAt).getTime() : new Date(b.createdAt).getTime();
      const timeACreate = new Date(a.createdAt).getTime();
      const timeBCreate = new Date(b.createdAt).getTime();

      switch (sortBy) {
        case "start_desc": return timeBStart - timeAStart;
        case "start_asc": return timeAStart - timeBStart;
        case "create_desc": return timeBCreate - timeACreate;
        case "create_asc": return timeACreate - timeBCreate;
        default: return 0;
      }
    });

    return filtered;
  }, [messages, searchQuery, categoryFilter, statusFilter, responseFilter, sortBy, users]);

  return (
    <div className="bg-white rounded-b-2xl shadow-sm border border-gray-200 flex flex-col h-full min-h-0">
      
      <div className="p-2 sm:p-3 border-b border-gray-200 bg-gray-50/50 space-y-2 shrink-0">
        <div className="flex flex-col md:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="検索..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 text-[11px] sm:text-xs font-bold border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
            />
          </div>

          {/* ★ CustomSelect によるフィルター群（折り返し対応） */}
          <div className="flex flex-wrap gap-1.5">
            <div className="flex-1 min-w-[95px]">
              <CustomSelect 
                value={categoryFilter} onChange={setCategoryFilter}
                options={[
                  { value: "all", label: "全カテゴリ" },
                  ...Object.keys(CATEGORIES).map(cat => ({ value: cat, label: CATEGORIES[cat as MessageCategory].label }))
                ]}
                buttonClassName="w-full flex items-center justify-between bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-700 font-bold shadow-sm focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-[11px]"
              />
            </div>

            <div className="flex-1 min-w-[90px]">
              <CustomSelect 
                value={statusFilter} onChange={setStatusFilter}
                options={[
                  { value: "all", label: "全状態" },
                  { value: "active", label: "配信中" },
                  { value: "inactive", label: "期間外" }
                ]}
                buttonClassName="w-full flex items-center justify-between bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-700 font-bold shadow-sm focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-[11px]"
              />
            </div>

            <div className="flex-1 min-w-[95px]">
              <CustomSelect 
                value={responseFilter} onChange={setResponseFilter}
                options={[
                  { value: "all", label: "対応状況" },
                  { value: "required", label: "要求あり" },
                  { value: "incomplete", label: "未対応あり" },
                  { value: "completed", label: "完了" },
                  { value: "not_required", label: "不要" }
                ]}
                buttonClassName="w-full flex items-center justify-between bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-700 font-bold shadow-sm focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-[11px]"
              />
            </div>

            <div className="flex-1 min-w-[120px] flex items-center gap-1 px-1.5 bg-white border border-gray-300 rounded-lg shadow-sm">
              <ArrowUpDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <CustomSelect 
                value={sortBy} onChange={setSortBy}
                options={[
                  { value: "start_desc", label: "開始日: 新" },
                  { value: "start_asc", label: "開始日: 古" },
                  { value: "create_desc", label: "作成日: 新" },
                  { value: "create_asc", label: "作成日: 古" }
                ]}
                buttonClassName="w-full py-1.5 pr-1 text-[10px] sm:text-[11px] font-bold bg-transparent outline-none focus:ring-0 border-none flex justify-between items-center text-gray-700"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 bg-white">
        {messages.length === 0 ? (
          <p className="text-center text-gray-400 py-12 font-bold text-[11px] sm:text-xs">配信履歴はありません</p>
        ) : processedMessages.length === 0 ? (
          <p className="text-center text-gray-400 py-12 font-bold text-[11px] sm:text-xs">条件に一致するメッセージがありません</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-left whitespace-nowrap">
            <thead className="bg-gray-50 text-[9px] sm:text-[10px] font-black text-gray-500 sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="px-3 sm:px-4 py-2 sm:py-2.5 border-r border-gray-100 w-20 sm:w-24">状態 / カテゴリ</th>
                <th className="px-3 sm:px-4 py-2 sm:py-2.5 border-r border-gray-100 min-w-[180px] sm:min-w-[200px]">タイトル / 宛先</th>
                <th className="px-3 sm:px-4 py-2 sm:py-2.5 border-r border-gray-100 w-36 sm:w-44">掲載期間</th>
                <th className="px-3 sm:px-4 py-2 sm:py-2.5 border-r border-gray-100 w-28 sm:w-32 text-center">対応要求</th>
                <th className="px-3 sm:px-4 py-2 sm:py-2.5 w-16 sm:w-20 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 text-[11px] sm:text-xs">
              {processedMessages.map(msg => {
                const isActive = (!msg.startAt || new Date(msg.startAt) <= new Date()) && (!msg.endAt || new Date(msg.endAt) >= new Date());
                const catInfo = CATEGORIES[msg.category || "info"];
                const targetCount = getTargetCount(msg);
                const respondedCount = msg.responses?.length || 0;
                const isCompleted = msg.requireResponse && ((msg.responseType === "all" && targetCount > 0 && respondedCount >= targetCount) || (msg.responseType === "single" && respondedCount > 0));

                return (
                  <tr key={msg.id} onClick={() => setQueryParams({ viewId: msg.id })} className="hover:bg-blue-50/50 cursor-pointer transition-colors group">
                    <td className="px-3 sm:px-4 py-2.5 border-r border-gray-100 align-top">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold ${isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                          {isActive ? '配信中' : '期間外'}
                        </span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold border ${catInfo.bgColor} ${catInfo.color}`}>
                          {catInfo.label}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-3 sm:px-4 py-2.5 border-r border-gray-100 whitespace-normal">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          {msg.isImportant && <span className="px-1 py-0.5 bg-red-100 text-red-700 text-[8px] font-bold rounded flex items-center flex-shrink-0"><Pin className="w-2.5 h-2.5 mr-0.5"/>緊急</span>}
                          <span className="font-extrabold text-gray-900 group-hover:text-blue-700 transition-colors leading-snug">{msg.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {msg.subBadge === "update1" && <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 flex-shrink-0">更新①</span>}
                          {msg.subBadge === "update2" && <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-orange-100 text-orange-800 border border-orange-200 flex-shrink-0">更新②</span>}
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[8px] font-bold rounded border border-gray-200 leading-tight">
                            宛先: <span className="font-medium">{getTargetName(msg)}</span>
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 sm:px-4 py-2.5 border-r border-gray-100 text-[9px] font-medium text-gray-500 align-top">
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center"><Calendar className="w-2.5 h-2.5 mr-1"/>開始: {msg.startAt ? msg.startAt.replace('T', ' ') : '指定なし'}</span>
                        <span className="flex items-center"><Calendar className="w-2.5 h-2.5 mr-1 opacity-50"/>終了: {msg.endAt ? msg.endAt.replace('T', ' ') : '指定なし'}</span>
                      </div>
                    </td>

                    <td className="px-3 sm:px-4 py-2.5 border-r border-gray-100 text-center align-top">
                      {msg.requireResponse ? (
                        isCompleted ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-black rounded border border-blue-200 flex items-center whitespace-nowrap">
                              <CheckSquare className="w-2.5 h-2.5 mr-1"/> 全員完了
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[9px] font-bold text-red-700 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                              未完了あり
                            </span>
                            <span className="text-[8px] text-gray-500 whitespace-nowrap mt-0.5">
                              {msg.responseType === "single" ? `誰か1人が対応` : `${respondedCount} / ${targetCount} 名 完了`}
                            </span>
                          </div>
                        )
                      ) : (
                        <span className="text-[9px] text-gray-400 font-bold">対応不要</span>
                      )}
                    </td>

                    <td className="px-3 sm:px-4 py-2.5 text-right align-top">
                      <div className="flex justify-end gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setQueryParams({ tab: "form", editId: msg.id }); }} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"><Edit2 className="w-3.5 h-3.5"/></button>
                        <button onClick={(e) => { e.stopPropagation(); requestDelete(msg.id); }} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}