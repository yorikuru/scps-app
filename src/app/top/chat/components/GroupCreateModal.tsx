"use client";

import React, { useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { UserData, ExternalUser, AppConfig, COLOR_MAPPINGS, Position } from "../types";

const UserAvatar = ({ name, url, isExternal = false, className = "w-10 h-10 text-sm" }: { name: string, url?: string | null, isExternal?: boolean, className?: string }) => {
  return url ? (
    <img src={url} alt={name} className={`${className} rounded-full object-cover shadow-2xs flex-shrink-0 border border-gray-100 bg-white`} />
  ) : (
    <div className={`${className} rounded-full bg-gradient-to-tr ${isExternal ? 'from-yellow-400 to-amber-500' : 'from-indigo-500 to-purple-600'} flex items-center justify-center text-white font-bold flex-shrink-0 shadow-2xs`}>
      {name.charAt(0)}
    </div>
  );
};

type Props = {
  currentUser: UserData | ExternalUser;
  tenantUsers: UserData[];
  externalUsers: ExternalUser[];
  positions: Position[];
  appConfig: AppConfig;
  onClose: () => void;
  onCreate: (data: { type: "custom_group", name: string, members: string[] }) => void;
};

export default function GroupCreateModal({ currentUser, tenantUsers, externalUsers, positions, appConfig, onClose, onCreate }: Props) {
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const c = COLOR_MAPPINGS[appConfig.color] || COLOR_MAPPINGS.default;

  const allUsers = [...tenantUsers, ...externalUsers];

  const handleCreate = () => {
    if (selectedUsers.length === 0) return;
    onCreate({ 
      type: "custom_group", 
      name: groupName.trim() || `${currentUser.name}たちのグループ`, 
      members: [currentUser.id, ...selectedUsers] 
    });
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col animate-fade-in">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white shadow-sm">
        <div><h3 className="text-sm font-black text-gray-900">自由グループ作成</h3></div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-700 mb-1.5">グループ名</label>
          <input 
            type="text" 
            placeholder="例: 文化祭実行委員会 サブチーム" 
            value={groupName} 
            onChange={(e) => setGroupName(e.target.value)} 
            className={`w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 ${c.ring}`} 
          />
        </div>
        <label className="block text-xs font-bold text-gray-700 mb-1.5">メンバー選択 ({selectedUsers.length}名選択中)</label>
        <div className="space-y-1.5 border border-gray-200 rounded-xl p-2 bg-gray-50 h-[300px] overflow-y-auto custom-scrollbar">
          {allUsers.map(u => {
            if (u.id === currentUser.id) return null;
            const isSelected = selectedUsers.includes(u.id);
            const isExt = "category" in u;
            
            let subText = "";
            if (isExt) {
              subText = (u as ExternalUser).affiliation || "外部ユーザー";
            } else {
              const ud = u as UserData;
              const posNames = positions.filter(p => ud.positionIds?.includes(p.id) || ud.primaryPositionId === p.id).map(p => p.name);
              subText = posNames.length > 0 ? posNames.join(", ") : ud.role === "teacher" ? "教職員" : ud.role === "admin" ? "管理者" : "生徒";
            }

            return (
              <label key={u.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border ${isSelected ? `bg-white ${c.border} shadow-sm` : 'border-transparent hover:bg-gray-100'}`}>
                <input type="checkbox" checked={isSelected} onChange={(e) => { if(e.target.checked) setSelectedUsers([...selectedUsers, u.id]); else setSelectedUsers(selectedUsers.filter(id => id !== u.id)); }} className={`w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500`} />
                <UserAvatar name={u.name} url={(u as any).photoURL} isExternal={isExt} className="w-8 h-8 text-[10px]" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-gray-900 block truncate">{u.name}</span>
                    {isExt && <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-100 text-amber-700 border border-amber-200">外部</span>}
                  </div>
                  <span className="text-[9px] font-normal text-gray-500 block truncate">{subText}</span>
                </div>
              </label>
            );
          })}
        </div>
      </div>
      <div className="p-4 border-t border-gray-100 bg-white">
        <button disabled={selectedUsers.length === 0} onClick={handleCreate} className={`w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-md flex justify-center items-center gap-2 ${selectedUsers.length === 0 ? 'bg-gray-300' : `${c.bg} ${c.hover}`}`}>
          <CheckCircle2 className="w-4 h-4" /> グループを作成してトーク開始
        </button>
      </div>
    </div>
  );
}