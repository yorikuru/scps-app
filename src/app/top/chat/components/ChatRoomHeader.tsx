"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, Search, X, Sparkles, Users, Pin, User, MoreVertical, Building2, Shield, GraduationCap, Briefcase, Star, Settings } from "lucide-react";
import { UserData, ExternalUser, ChatRoom, Position, AppConfig, COLOR_MAPPINGS } from "../types";

const UserAvatar = ({ name, url, isExternal = false, className = "w-8 h-8 text-xs" }: { name: string, url?: string | null, isExternal?: boolean, className?: string }) => {
  return url ? (
    <img src={url} alt={name} className={`${className} rounded-full object-cover shadow-sm flex-shrink-0 border border-gray-200 bg-white`} />
  ) : (
    <div className={`${className} rounded-full bg-gradient-to-tr ${isExternal ? 'from-yellow-400 to-amber-500' : 'from-indigo-500 to-purple-600'} flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm`}>
      {name.charAt(0)}
    </div>
  );
};

type Props = {
  userData: UserData | ExternalUser;
  roomMembers: (UserData | ExternalUser)[];
  room: ChatRoom;
  positions: Position[];
  onBack: () => void;
  appConfig: AppConfig;
  onOpenProfile?: (user: UserData | ExternalUser) => void;
  onTogglePin?: (roomId: string, isPinned: boolean) => void;
  schoolName?: string;
  schoolLogoURL?: string;
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onOpenSettings: () => void;
  isExternalMode?: boolean;
};

export default function ChatRoomHeader({ 
  userData, roomMembers, room, positions, onBack, appConfig, 
  onOpenProfile, onTogglePin, schoolName, schoolLogoURL,
  showSearch, setShowSearch, searchQuery, setSearchQuery, onOpenSettings, isExternalMode = false
}: Props) {
  
  const c = COLOR_MAPPINGS[appConfig.color] || COLOR_MAPPINGS.default;
  const isPinned = room.pinnedBy?.includes(userData.id) || false;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const roomInfo = (() => {
    if (room.isOfficial || room.type === "custom_group") return { name: room.name || "グループ", isGroup: true };
    const otherUser = roomMembers.find(u => u.id !== userData.id);
    return { name: otherUser?.name || "退会したユーザー", isGroup: false };
  })();

  const getRoomIconAndColor = () => {
    if (room.type === "tenant_all" && schoolLogoURL) {
      return { icon: null, imgUrl: schoolLogoURL, color: "bg-white border border-gray-200" };
    }
    if (room.isOfficial) {
      switch (room.type) {
        case "tenant_all": return { icon: Building2, color: "bg-blue-600" };
        case "role_admin": return { icon: Shield, color: "bg-slate-800" }; 
        case "role_teacher": return { icon: GraduationCap, color: "bg-emerald-600" };
        case "role_manager": return { icon: Star, color: "bg-rose-600" }; 
        case "position": return { icon: Briefcase, color: "bg-emerald-600" };
        default: return { icon: Sparkles, color: "bg-blue-600" };
      }
    }
    if (room.type === "custom_group") return { icon: Users, color: "bg-orange-500" };
    return null;
  };

  const renderDescription = () => {
    if (room.type === "direct") {
      const otherUser = roomMembers.find(u => u.id !== userData.id);
      if (!otherUser) return <p className="text-[10px] font-bold text-gray-400">退会したユーザー</p>;
      const isExt = "category" in otherUser;
      const roleText = isExt ? ((otherUser as ExternalUser).affiliation || "外部ユーザー") : ((otherUser as UserData).positionName || ((otherUser as UserData).role === "teacher" ? "教職員" : (otherUser as UserData).role === "admin" ? "管理者" : "一般生徒"));
      return <p className="text-[10px] font-medium text-gray-500 truncate max-w-[200px] sm:max-w-md">{roleText}</p>;
    } else if (room.type === "tenant_all") {
      return <p className="text-[10px] font-medium text-gray-500 truncate">{schoolName || "テナント"} 全メンバー（{roomMembers.length}名）</p>;
    } else if (room.type === "position" && room.targetId) {
      const pos = positions.find(p => p.id === room.targetId);
      const leaderTitle = pos?.leaderTitle || "部門長";
      const memberNames = roomMembers.map(u => u.id === pos?.leaderUserId ? `[${leaderTitle}] ${u.name}` : u.name).sort((a, b) => a.startsWith("[") ? -1 : 1).join(", ");
      return <p className="text-[10px] font-medium text-gray-500 truncate max-w-[200px] sm:max-w-md" title={memberNames}>{roomMembers.length}名: {memberNames}</p>;
    } else {
      const memberNames = roomMembers.map(u => u.name).join(", ");
      return <p className="text-[10px] font-medium text-gray-500 truncate max-w-[200px] sm:max-w-md" title={memberNames}>{roomMembers.length}名: {memberNames}</p>;
    }
  };

  let displayName = roomInfo.name;
  if (room.type === "tenant_all") {
    displayName = `全メンバーチャット (${schoolName || "テナント"})`;
  }

  const roomConfig = getRoomIconAndColor();

  return (
    <div className="px-4 py-3 bg-white border-b border-gray-200 flex flex-col shadow-sm z-20 shrink-0 relative">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="p-1.5 -ml-2 sm:hidden text-gray-500 hover:bg-gray-100 rounded-md shrink-0 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          {room.type === "direct" ? (
            <UserAvatar name={roomMembers.find(u => u.id !== userData.id)?.name || "退会"} url={(roomMembers.find(u => u.id !== userData.id) as any)?.photoURL} isExternal={"category" in (roomMembers.find(u => u.id !== userData.id) || {})} className="w-9 h-9 text-xs" />
          ) : (
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-sm relative ${room.iconURL ? 'bg-transparent border border-gray-200' : roomConfig?.color || 'bg-gray-700'}`}>
              {room.iconURL ? (
                <img src={room.iconURL} alt={displayName} className="w-full h-full rounded-full object-cover" />
              ) : roomConfig?.imgUrl ? (
                <img src={roomConfig.imgUrl} alt={displayName} className="w-full h-full rounded-full object-cover" />
              ) : roomConfig?.icon ? (
                <roomConfig.icon className="w-4 h-4" />
              ) : (
                <Users className="w-4 h-4"/>
              )}
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <h2 className="text-sm font-bold text-gray-900 truncate">{displayName}</h2>
            {renderDescription()}
          </div>
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          {room.type === "direct" && onOpenProfile && !isExternalMode && (
            <button 
              onClick={() => {
                const otherId = room.members.find(id => id !== userData.id);
                const otherUser = roomMembers.find(u => u.id === otherId);
                if (otherUser) onOpenProfile(otherUser);
              }}
              className="p-2 text-gray-400 hover:bg-gray-100 hover:text-indigo-600 rounded-lg transition-colors" 
              title="プロフィールを見る"
            >
              <User className="w-4 h-4" />
            </button>
          )}

          {onTogglePin && (
            <button 
              onClick={() => onTogglePin(room.id, isPinned)}
              className={`p-2 rounded-lg transition-colors ${isPinned ? 'text-amber-500 bg-amber-50' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`} 
              title={isPinned ? "ピン留めを解除" : "ピン留めする"}
            >
              <Pin className={`w-4 h-4 ${isPinned ? 'fill-amber-500' : ''}`} />
            </button>
          )}

          <button onClick={() => setShowSearch(!showSearch)} className={`p-2 rounded-lg transition-colors ${showSearch ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`} title="ルーム内検索">
            <Search className="w-4 h-4" />
          </button>

          {/* ★ 三点リーダーとドロップダウンメニュー */}
          {room.type !== "direct" && (
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                className={`p-2 rounded-lg transition-colors focus:outline-none ${isMenuOpen ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`} 
                title="メニュー"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 z-50 animate-fade-in origin-top-right">
                  <button 
                    onClick={() => { setIsMenuOpen(false); onOpenSettings(); }} 
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-gray-400" />
                    チャット設定・メンバー管理
                  </button>
                </div>
              )}
            </div>
          )}

          <button onClick={onBack} title="Escキーで閉じる" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-md transition-colors border border-transparent hover:border-gray-200 ml-1">
            <X className="w-4 h-4" /> 閉じる
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="mt-3 relative animate-slide-up px-0 sm:px-4">
          <Search className="absolute left-3 sm:left-7 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input 
            type="text" autoFocus placeholder="このトークルーム内を検索..." 
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-md">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}