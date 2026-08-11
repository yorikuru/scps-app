"use client";

import React, { useState, useMemo } from "react";
import { Pin, Calendar, Edit2, Trash2, Search, ArrowUpDown, CheckSquare } from "lucide-react";
import { SystemMessage, CATEGORIES, MessageCategory } from "./MessageDelivery";
import { UserData } from "../page";

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
    <div className="bg-white rounded-b-2xl shadow-sm border border-gray-200">
      
      <div className="p-4 border-b border-gray-200 bg-gray-50/50 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="タイトル、本文、宛先で検索..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-bold border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="border border-gray-300 rounded-lg py-2 px-3 text-xs font-bold bg-white outline-none focus:ring-blue-500">
              <option value="all">全カテゴリ</option>
              {Object.keys(CATEGORIES).map(cat => (
                <option key={cat} value={cat}>{CATEGORIES[cat as MessageCategory].label}</option>
              ))}
            </select>

            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg py-2 px-3 text-xs font-bold bg-white outline-none focus:ring-blue-500">
              <option value="all">全状態</option>
              <option value="active">配信中</option>
              <option value="inactive">期間外</option>
            </select>

            <select value={responseFilter} onChange={e => setResponseFilter(e.target.value)} className="border border-gray-300 rounded-lg py-2 px-3 text-xs font-bold bg-white outline-none focus:ring-blue-500">
              <option value="all">対応状況 (すべて)</option>
              <option value="required">対応要求あり</option>
              <option value="incomplete">未対応あり</option>
              <option value="completed">完了</option>
              <option value="not_required">対応不要</option>
            </select>

            <div className="flex items-center gap-1.5 px-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="border border-gray-300 rounded-lg py-2 px-3 text-xs font-bold bg-white outline-none focus:ring-blue-500">
                <option value="start_desc">掲載開始日が新しい順</option>
                <option value="start_asc">掲載開始日が古い順</option>
                <option value="create_desc">作成日が新しい順</option>
                <option value="create_asc">作成日が古い順</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {messages.length === 0 ? (
        <p className="text-center text-gray-400 py-16 font-bold text-sm">配信履歴はありません</p>
      ) : processedMessages.length === 0 ? (
        <p className="text-center text-gray-400 py-16 font-bold text-sm">条件に一致するメッセージがありません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left whitespace-nowrap">
            <thead className="bg-gray-50 text-[11px] font-bold text-gray-500">
              <tr>
                <th className="px-4 py-3 border-r border-gray-100 w-28">状態 / カテゴリ</th>
                <th className="px-4 py-3 border-r border-gray-100 min-w-[250px]">タイトル / 宛先</th>
                <th className="px-4 py-3 border-r border-gray-100 w-48">掲載期間</th>
                <th className="px-4 py-3 border-r border-gray-100 w-40 text-center">対応要求</th>
                <th className="px-4 py-3 w-24 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 text-xs">
              {processedMessages.map(msg => {
                const isActive = (!msg.startAt || new Date(msg.startAt) <= new Date()) && (!msg.endAt || new Date(msg.endAt) >= new Date());
                const catInfo = CATEGORIES[msg.category || "info"];
                const targetCount = getTargetCount(msg);
                const respondedCount = msg.responses?.length || 0;
                const isCompleted = msg.requireResponse && ((msg.responseType === "all" && targetCount > 0 && respondedCount >= targetCount) || (msg.responseType === "single" && respondedCount > 0));
                
                // ★ システム管理者が発行したメッセージかどうか
                const isSystemMsg = msg.senderRole === "system_admin" || msg.schoolId === "SYSTEM";

                return (
                  <tr key={msg.id} onClick={() => setQueryParams({ viewId: msg.id })} className="hover:bg-blue-50/50 cursor-pointer transition-colors group">
                    <td className="px-4 py-3 border-r border-gray-100 align-top">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                          {isActive ? '配信中' : '期間外'}
                        </span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${catInfo.bgColor} ${catInfo.color}`}>
                          {catInfo.label}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-4 py-3 border-r border-gray-100 whitespace-normal">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {msg.isImportant && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded flex items-center flex-shrink-0"><Pin className="w-2.5 h-2.5 mr-0.5"/>緊急</span>}
                          <span className="font-extrabold text-gray-900 group-hover:text-blue-700 transition-colors leading-snug">{msg.title}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {msg.subBadge === "update1" && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 flex-shrink-0">更新①</span>}
                          {msg.subBadge === "update2" && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-800 border border-orange-200 flex-shrink-0">更新②</span>}
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[9px] font-bold rounded border border-gray-200 leading-tight">
                            宛先: <span className="font-medium">{getTargetName(msg)}</span>
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 border-r border-gray-100 text-[10px] font-medium text-gray-500 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center"><Calendar className="w-3 h-3 mr-1"/>開始: {msg.startAt ? msg.startAt.replace('T', ' ') : '指定なし'}</span>
                        <span className="flex items-center"><Calendar className="w-3 h-3 mr-1 opacity-50"/>終了: {msg.endAt ? msg.endAt.replace('T', ' ') : '指定なし'}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 border-r border-gray-100 text-center align-top">
                      {msg.requireResponse ? (
                        isCompleted ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-[10px] font-black rounded border border-blue-200 flex items-center">
                              <CheckSquare className="w-3 h-3 mr-1"/> {msg.responseType === "single" ? "対応完了" : "全員完了"}
                            </span>
                            {msg.responseType === "single" && msg.responses && msg.responses.length > 0 && (
                              <span className="text-[9px] text-gray-500 font-bold truncate max-w-[100px]">
                                {users.find(u => u.id === msg.responses![0])?.name} が対応
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
                              {msg.responseType === "single" ? "対応待ち" : "未対応あり"}
                            </span>
                            <span className="text-[9px] text-gray-500">
                              {msg.responseType === "single" ? "誰か1人が対応" : `${respondedCount} / ${targetCount} 名完了`}
                            </span>
                          </div>
                        )
                      ) : (
                        <span className="text-[10px] text-gray-400 font-bold">対応不要</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right align-top">
                      {/* ★ システムメッセージは編集・削除不可（参照のみ表示） */}
                      {!isSystemMsg ? (
                        <div className="flex justify-end gap-1.5">
                          <button onClick={(e) => { e.stopPropagation(); setQueryParams({ tab: "form", editId: msg.id }); }} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"><Edit2 className="w-4 h-4"/></button>
                          <button onClick={(e) => { e.stopPropagation(); requestDelete(msg.id); }} className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      ) : (
                        <span className="text-[9px] text-gray-400 font-bold bg-gray-50 px-2 py-1 rounded border border-gray-100">
                          参照のみ
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}