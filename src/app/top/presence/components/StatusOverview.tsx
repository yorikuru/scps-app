"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PRESENCE_CONFIG, UserPresence, PresenceState, PresenceLocation, ScheduledPresence, WeeklyDayRoutine, getEffectivePresence } from "../types";
import { UserData } from "../../page";
import { Search, MapPin, MessageCircle, UserCog, ArrowUpDown, MessageSquareText } from "lucide-react";
import CustomSelect from "@/components/CustomSelect"; // ★ CustomSelectをインポート

type Props = {
  presences: UserPresence[];
  schedules: ScheduledPresence[]; 
  routines: WeeklyDayRoutine[];   
  tenantUsers: UserData[];
  locations: PresenceLocation[];
  currentUser: UserData;
  canManageAll: boolean;
  onProxyEdit: (user: UserData) => void;
};

export default function StatusOverview({ presences, schedules, routines, tenantUsers, locations, currentUser, canManageAll, onProxyEdit }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterState, setFilterState] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"systemId" | "name" | "status">("systemId");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const processedList = useMemo(() => {
    let list = tenantUsers.map((u) => {
      const rawPresence = presences.find((item) => item.userId === u.id) || {
        id: u.id, userId: u.id, userName: u.name, role: u.role, positionName: u.positionName, systemId: (u as any).systemId || "",
        currentState: "offline" as PresenceState, lastActiveAt: "", locationId: null, statusMessage: "", statusUpdatedAt: "",
        isManualOverride: false, isAutoOnline: false
      } as UserPresence;

      const effectivePresence = getEffectivePresence(rawPresence, schedules, routines) as UserPresence;

      return { user: u, presence: effectivePresence };
    }).filter(({ user, presence }) => {
      const locName = locations.find(l => l.id === presence.locationId)?.name || "";
      const matchSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) 
        || (user.positionName || "").toLowerCase().includes(searchQuery.toLowerCase())
        || ((user as any).systemId || "").toLowerCase().includes(searchQuery.toLowerCase())
        || locName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFilter = filterState === "all" || presence.currentState === filterState;
      const matchRole = filterRole === "all" || user.role === filterRole;
      return matchSearch && matchFilter && matchRole;
    });

    list.sort((a, b) => {
      if (sortBy === "systemId") {
        const sysA = (a.user as any).systemId || "99999999";
        const sysB = (b.user as any).systemId || "99999999";
        return sortOrder === "asc" ? sysA.localeCompare(sysB) : sysB.localeCompare(sysA);
      }
      if (sortBy === "name") {
        return sortOrder === "asc" ? a.user.name.localeCompare(b.user.name, 'ja') : b.user.name.localeCompare(a.user.name, 'ja');
      }
      if (sortBy === "status") {
        const getScore = (state: PresenceState) => {
          if (state === "available") return 1;
          if (state === "busy") return 2;
          if (state === "offline") return 5;
          return 3; 
        };
        const scoreA = getScore(a.presence.currentState);
        const scoreB = getScore(b.presence.currentState);
        return sortOrder === "asc" ? scoreA - scoreB : scoreB - scoreA;
      }
      return 0;
    });

    return list;
  }, [tenantUsers, presences, locations, searchQuery, filterState, filterRole, sortBy, sortOrder, tick, schedules, routines]);

  const availableCount = processedList.filter((p) => p.presence.currentState === "available").length;

  return (
    <div className="space-y-3 sm:space-y-4">
      
      <div className="bg-white p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm space-y-2 sm:space-y-2.5 print:hidden">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
            <input
              type="text" placeholder="名前、番号、役職、勤務先で検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 sm:pl-9 pr-2.5 sm:pr-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold text-gray-900 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition-colors shadow-2xs"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <div className="flex-1 min-w-[110px]">
              <CustomSelect 
                value={filterState} onChange={setFilterState}
                options={[
                  { value: "all", label: "全ステータス" },
                  ...(Object.keys(PRESENCE_CONFIG) as PresenceState[]).map(st => ({ value: st, label: PRESENCE_CONFIG[st].label }))
                ]}
                buttonClassName="w-full bg-gray-50 hover:bg-white border border-gray-200 rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-colors flex items-center justify-between shadow-2xs"
              />
            </div>

            <div className="flex-1 min-w-[100px]">
              <CustomSelect 
                value={filterRole} onChange={setFilterRole}
                options={[
                  { value: "all", label: "全権限" },
                  { value: "admin", label: "管理者" },
                  { value: "officer", label: "生徒会役員" },
                  { value: "teacher", label: "教職員" }
                ]}
                buttonClassName="w-full bg-gray-50 hover:bg-white border border-gray-200 rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-colors flex items-center justify-between shadow-2xs"
              />
            </div>

            <div className="flex-1 min-w-[120px] flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2 shrink-0 shadow-2xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <CustomSelect 
                value={sortBy} onChange={(val) => setSortBy(val as any)}
                options={[
                  { value: "systemId", label: "番号順" },
                  { value: "name", label: "名前順" },
                  { value: "status", label: "状態順" }
                ]}
                buttonClassName="w-full bg-transparent text-[10px] sm:text-xs font-bold text-gray-700 outline-none py-1.5 sm:py-2 border-none focus:ring-0 flex justify-between items-center"
              />
              <div className="w-px h-3 sm:h-4 bg-gray-300 mx-0.5"></div>
              <button 
                type="button" onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')}
                className="text-[9px] sm:text-[10px] font-black text-indigo-600 px-1 hover:bg-gray-200 rounded whitespace-nowrap transition-colors"
              >
                {sortOrder === 'asc' ? '昇順' : '降順'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-1 print:hidden">
        <span className="text-[9px] sm:text-[10px] font-bold text-gray-500">
          該当メンバー: <span className="text-gray-900 font-black text-[10px] sm:text-xs">{processedList.length}名</span> （連絡可能: <span className="text-emerald-600 font-black text-[10px] sm:text-xs">{availableCount}名</span>）
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 print:hidden">
        {processedList.map(({ user, presence }) => {
          const config = PRESENCE_CONFIG[presence.currentState || "offline"];
          const isMe = user.id === currentUser.id;
          const locName = locations.find(l => l.id === presence.locationId)?.name;

          return (
            <div key={user.id} className="bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2 min-w-0 relative overflow-visible">
              
              <div className="flex items-start gap-2 sm:gap-2.5 min-w-0">
                <div className="relative shrink-0 mt-0.5">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.name} className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-cover border border-gray-100 shadow-2xs" />
                  ) : (
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 font-bold text-sm sm:text-lg shadow-2xs">
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-[1.5px] shadow-sm">
                    <config.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${config.fillClass}`} />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 pr-8">
                    <span className="text-[9px] sm:text-[10px] font-mono font-bold text-gray-400">#{(user as any).systemId || '-'}</span>
                    <span className="text-[11px] sm:text-sm font-black text-gray-900 truncate">{user.name}</span>
                    {isMe && <span className="text-[7px] sm:text-[8px] font-black bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 shrink-0">あなた</span>}
                  </div>
                  <span className="text-[8px] sm:text-[9px] font-bold text-gray-500 block truncate">
                    {user.positionName || (user.role === "admin" ? "管理者" : "役員")}
                  </span>
                  
                  <div className="flex items-center gap-1 sm:gap-1.5 mt-1 sm:mt-1.5">
                    <span className={`text-[9px] sm:text-[10px] font-bold ${config.colorClass}`}>{config.label}</span>
                    {locName && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0"></span>
                        <span className="text-[8px] sm:text-[9px] font-bold text-gray-600 flex items-center gap-0.5 truncate"><MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-400 shrink-0" /> {locName}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="absolute top-2 right-2 flex items-center gap-0.5 sm:gap-1">
                  {!isMe && canManageAll && (
                    <button onClick={() => onProxyEdit(user)} className="p-1 sm:p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors shadow-2xs" title="代理設定">
                      <UserCog className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </button>
                  )}
                  {!isMe && (
                    <button onClick={() => router.push(`/top/chat?directUser=${user.id}`)} className="p-1 sm:p-1.5 bg-white border border-gray-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 rounded-lg text-gray-600 transition-colors shadow-2xs" title="チャットを送る">
                      <MessageCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {presence.statusMessage && (
                <div className="bg-gray-50/80 p-1.5 sm:p-2 rounded-lg border border-gray-100 text-[9px] sm:text-[10px] font-bold text-gray-700 leading-snug break-words flex items-start gap-1.5 mt-0.5">
                  <MessageSquareText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 shrink-0 mt-0.5" />
                  <span>{presence.statusMessage}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1.5 border-t border-gray-100/80 mt-auto">
                <span className="text-[7px] sm:text-[8px] font-bold text-gray-400">
                  {presence.isManualOverride === false && presence.isAutoOnline === false ? "スケジュール適用中" : `更新: ${presence.lastActiveAt ? new Date(presence.lastActiveAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '未登録'}`}
                </span>
                {presence.updatedByUserName && !isMe && (
                  <span className="text-[7px] sm:text-[8px] font-bold text-amber-600 flex items-center gap-0.5 sm:gap-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                    <UserCog className="w-2.5 h-2.5" /> {presence.updatedByUserName} が設定
                  </span>
                )}
              </div>

            </div>
          );
        })}
      </div>

      <div className="hidden print:block w-full text-black">
        <div className="text-center border-b border-black pb-3 mb-4">
          <h1 className="text-lg font-black">生徒会 リアルタイム動静名簿</h1>
          <p className="text-[10px] text-gray-600 mt-1">出力日時: {new Date().toLocaleString('ja-JP')} | 対象者数: {processedList.length}名</p>
        </div>

        <table className="w-full text-left border-collapse border border-gray-400 text-xs">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-400 text-[10px] font-black">
              <th className="p-2 border-r border-gray-400 w-20">利用番号</th>
              <th className="p-2 border-r border-gray-400 w-28">名前</th>
              <th className="p-2 border-r border-gray-400 w-32">役職</th>
              <th className="p-2 border-r border-gray-400 w-24">ステータス</th>
              <th className="p-2 border-r border-gray-400 w-28">勤務先</th>
              <th className="p-2">ステータスメッセージ</th>
            </tr>
          </thead>
          <tbody>
            {processedList.map(({ user, presence }) => {
              const config = PRESENCE_CONFIG[presence.currentState || "offline"];
              const locName = locations.find(l => l.id === presence.locationId)?.name || "-";
              return (
                <tr key={user.id} className="border-b border-gray-300" style={{ pageBreakInside: "avoid" }}>
                  <td className="p-2 border-r border-gray-300 font-mono font-bold">{(user as any).systemId || "-"}</td>
                  <td className="p-2 border-r border-gray-300 font-bold">{user.name}</td>
                  <td className="p-2 border-r border-gray-300">{user.positionName || (user.role === "admin" ? "管理者" : "役員")}</td>
                  <td className="p-2 border-r border-gray-300 font-bold">{config.label}</td>
                  <td className="p-2 border-r border-gray-300">{locName}</td>
                  <td className="p-2">{presence.statusMessage || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}