"use client";

import React, { useState, useMemo } from "react";
import { Building2, Search, Pin } from "lucide-react";
import { SystemMessage, CATEGORIES } from "./MessageDelivery";
import { GlobalUserData, TenantData } from "../page";

type Props = {
  messages: SystemMessage[];
  tenants: TenantData[];
  users: GlobalUserData[];
  setQueryParams: (params: Record<string, string | null>) => void;
};

export default function ActiveMessagesByTenant({ messages, tenants, users, setQueryParams }: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  const activeMessages = useMemo(() => {
    const now = new Date();
    return messages.filter(msg => {
      const start = msg.startAt ? new Date(msg.startAt) : null;
      const end = msg.endAt ? new Date(msg.endAt) : null;
      if (start && start > now) return false;
      if (end && end < now) return false;
      return true;
    });
  }, [messages]);

  const filteredTenants = useMemo(() => {
    return tenants.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.schoolCode.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [tenants, searchQuery]);

  const getMessagesForTenant = (tenantId: string) => {
    return activeMessages.filter(msg => {
      if (msg.targetType === "all") return true;
      if (msg.targetType === "tenant") {
        const tIds = msg.targetIds || (msg.targetId ? [msg.targetId] : []);
        return tIds.includes(tenantId);
      }
      if (msg.targetType === "user" || msg.targetType === "department") {
        const tenantUserIds = users.filter(u => u.schoolId === tenantId).map(u => u.id);
        const targetUids = msg.targetIds || (msg.targetId ? [msg.targetId] : []);
        return targetUids.some(uid => tenantUserIds.includes(uid));
      }
      return false;
    });
  };

  return (
    <div className="bg-white rounded-b-2xl shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200 bg-gray-50/50">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="テナント名や学校コードで検索..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs font-bold border border-gray-300 rounded-lg focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTenants.map(tenant => {
          const tenantMsgs = getMessagesForTenant(tenant.id);
          return (
            <div key={tenant.id} className="border border-gray-200 rounded-xl overflow-hidden flex flex-col bg-white">
              <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="font-bold text-sm text-gray-900 truncate">{tenant.name}</span>
                </div>
                <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-full border border-gray-200 shadow-sm text-gray-600 flex-shrink-0">
                  {tenantMsgs.length}件 配信中
                </span>
              </div>
              <div className="p-3 flex-1 overflow-y-auto max-h-48 custom-scrollbar space-y-2">
                {tenantMsgs.length === 0 ? (
                  <p className="text-[10px] text-gray-400 text-center py-4 font-bold">配信中のメッセージはありません</p>
                ) : (
                  tenantMsgs.map(msg => {
                    const catInfo = CATEGORIES[msg.category || "info"];
                    return (
                      <div key={msg.id} onClick={() => setQueryParams({ viewId: msg.id })} className="p-2 border border-gray-100 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors group">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border flex items-center gap-0.5 ${catInfo.bgColor} ${catInfo.color}`}>
                            {catInfo.label}
                          </span>
                          {msg.isImportant && <span className="px-1 py-0.5 bg-red-100 text-red-700 text-[8px] font-bold rounded flex items-center"><Pin className="w-2 h-2 mr-0.5"/>緊急</span>}
                        </div>
                        <p className="text-[10px] font-extrabold text-gray-800 truncate group-hover:text-blue-700">{msg.title}</p>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}