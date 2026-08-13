"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Search, UserPlus, MessageCircle, Users, ChevronRight, X, User, 
  GraduationCap, Building2, Briefcase, Shield, Sparkles, Pin, Globe, Star, 
  Filter, ArrowUpDown, Image as ImageIcon, Edit3, Settings, Paperclip 
} from "lucide-react";
import { updateDoc, doc, collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { UserData, ExternalUser, ChatRoom, ChatMessage, AppConfig, COLOR_MAPPINGS, Position, ChatRoomType, getDefaultChatPermissions } from "../types";
import GroupCreateModal from "./GroupCreateModal";
import { useDialog } from "@/components/DialogContext";
import { PRESENCE_CONFIG, PresenceState, UserPresence } from "../../presence/types";

const UserAvatar = ({ 
  name, url, isExternal = false, className = "w-9 h-9 text-xs", presenceState 
}: { 
  name: string, url?: string | null, isExternal?: boolean, className?: string, presenceState?: PresenceState 
}) => {
  const config = presenceState ? PRESENCE_CONFIG[presenceState] : null;

  return (
    <div className="relative inline-block flex-shrink-0">
      {url ? (
        <img src={url} alt={name} className={`${className} rounded-full object-cover shadow-2xs border border-gray-100 bg-white`} />
      ) : (
        <div className={`${className} rounded-full bg-gradient-to-tr ${isExternal ? 'from-yellow-400 to-amber-500' : 'from-indigo-500 to-purple-600'} flex items-center justify-center text-white font-bold shadow-2xs`}>
          {name.charAt(0)}
        </div>
      )}
      {config && !isExternal && (
        <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-[1px] shadow-sm">
          <config.icon className={`w-3 h-3 ${config.fillClass}`} />
        </div>
      )}
    </div>
  );
};

type Props = {
  userData: UserData | ExternalUser; 
  tenantUsers: UserData[];
  externalUsers: ExternalUser[]; 
  positions: Position[]; 
  chatRooms: ChatRoom[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onCreatePrivateRoom: (data: { type: "direct" | "custom_group"; name?: string; members: string[] }) => void;
  onJoinOfficialRoom: (data: { type: ChatRoomType; targetId?: string; name: string }) => void;
  onTogglePin: (roomId: string, isPinned: boolean) => void;
  onOpenExternalUserManagement?: (mode: "create" | "edit" | "view", user?: ExternalUser | null) => void;
  onOpenSettings?: (category?: "general" | "external" | "media") => void; 
  appConfig: AppConfig;
  isExternalMode?: boolean; 
  schoolName?: string;
  schoolLogoURL?: string;
  schoolData?: any; 
  systemApps?: any[]; 
};

export default function ChatList({ 
  userData, tenantUsers, externalUsers, positions, chatRooms, activeRoomId, 
  onSelectRoom, onCreatePrivateRoom, onJoinOfficialRoom, onTogglePin, 
  onOpenExternalUserManagement, onOpenSettings, appConfig, isExternalMode = false, schoolName, schoolLogoURL,
  schoolData, systemApps = []
}: Props) {
  const [activeTab, setActiveTab] = useState<"chats" | "contacts" | "external" | "settings">("chats"); 
  const [searchQuery, setSearchQuery] = useState("");
  
  const { showAlert } = useDialog();
  
  const [extCategoryFilter, setExtCategoryFilter] = useState<string>("all");
  const [extSortOrder, setExtSortOrder] = useState<"name" | "created" | "validUntil">("created");

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, roomId: string | null }>({ x: 0, y: 0, roomId: null });
  const [showRenameModal, setShowRenameModal] = useState<{ roomId: string, currentName: string } | null>(null);
  const [newName, setNewName] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetRoomIdForIcon, setTargetRoomIdForIcon] = useState<string | null>(null);

  const [allMessagesCache, setAllMessagesCache] = useState<ChatMessage[] | null>(null);
  const [presences, setPresences] = useState<UserPresence[]>([]);

  const c = COLOR_MAPPINGS[appConfig.color] || COLOR_MAPPINGS.default;

  const isInternalUser = userData ? !("category" in userData) : false;
  const internalUser = isInternalUser ? (userData as UserData) : null;

  // ★ presenceアプリが有効かどうかの判定
  const isPresenceEnabled = React.useMemo(() => {
    if (!schoolData || !internalUser || isExternalMode) return false;
    const exSchool = schoolData as any;
    
    const isTenantAllowed = exSchool.availableModules?.includes("presence");
    if (!isTenantAllowed) return false;

    const isUserAllowed = (internalUser as any).allowedModules?.includes("presence");
    if (!isUserAllowed) return false;

    const roleKey = (internalUser.role || "guest") as string;
    const perms = exSchool.appPermissions?.["presence"] || { admin: true, it_manager: true, teacher: true, officer: true, guest: false };
    if (perms[roleKey] === false) return false;

    return true;
  }, [schoolData, internalUser, isExternalMode]);

  useEffect(() => {
    if (!isPresenceEnabled || !userData?.schoolId) return;
    const q = query(collection(db, "presence_statuses"), where("schoolId", "==", userData.schoolId));
    const unsub = onSnapshot(q, (snap) => {
      const list: UserPresence[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as UserPresence));
      setPresences(list);
    });
    return () => unsub();
  }, [isPresenceEnabled, userData?.schoolId]);

  const getUserPresenceState = (userId: string): PresenceState | undefined => {
    if (!isPresenceEnabled) return undefined;
    const p = presences.find(item => item.userId === userId);
    return p ? p.currentState : "offline";
  };

  const perms = isInternalUser && internalUser ? getDefaultChatPermissions(internalUser) : {
    canUseChat: true, canCreateExternalUser: false, canViewExternalUser: false, 
    canEditExternalUser: false, canDeleteExternalUser: false, 
    canCreateCustomGroup: false, canSendPhoto: true, canSendFile: true,
  };

  const myPositions = isInternalUser && internalUser 
    ? positions.filter(p => internalUser.positionIds?.includes(p.id) || internalUser.primaryPositionId === p.id)
    : [];

  const getUserById = (id: string) => tenantUsers.find(u => u.id === id) || externalUsers.find(e => e.id === id);

  const totalUnreadCount = chatRooms.reduce((sum, room) => sum + (room.unreadCount?.[userData.id] || 0), 0);

  useEffect(() => {
    const closeMenu = () => setContextMenu({ x: 0, y: 0, roomId: null });
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    const fetchMessagesForSearch = async () => {
      if (!searchQuery.trim() || allMessagesCache !== null || chatRooms.length === 0) return;
      try {
        const roomIds = chatRooms.map(r => r.id);
        const chunks = [];
        for (let i = 0; i < roomIds.length; i += 10) {
          chunks.push(roomIds.slice(i, i + 10));
        }
        
        let messages: ChatMessage[] = [];
        for (const chunk of chunks) {
          const q = query(collection(db, "chat_messages"), where("roomId", "in", chunk));
          const snap = await getDocs(q);
          snap.forEach(d => {
            messages.push({ id: d.id, ...d.data() } as ChatMessage);
          });
        }
        messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAllMessagesCache(messages);
      } catch (e) {
        console.error(e);
      }
    };
    
    const timer = setTimeout(() => { fetchMessagesForSearch(); }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, chatRooms, allMessagesCache]);

  const getRoomInfo = (room: ChatRoom) => {
    let name = room.name || "グループ";
    let otherMemberId = null;
    if (room.type === "tenant_all") {
      name = `全メンバーチャット (${schoolName || "テナント"})`;
    }
    if (room.isOfficial || room.type === "custom_group") {
      return { name, avatar: null, isGroup: true, isExternal: false, otherMemberId: null };
    }
    otherMemberId = room.members.find(id => id !== userData.id);
    const otherUser = getUserById(otherMemberId || "");
    const isExt = externalUsers.some(e => e.id === otherMemberId);
    return { name: otherUser?.name || "退会したユーザー", avatar: (otherUser as UserData)?.photoURL || null, isGroup: false, isExternal: isExt, otherMemberId };
  };

  const filteredRooms = chatRooms.filter(room => {
    const info = getRoomInfo(room);
    const matchName = info.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchMessage = false;
    if (searchQuery.trim() && allMessagesCache) {
      matchMessage = allMessagesCache.some(m => 
        m.roomId === room.id && 
        m.senderId !== "system" && 
        m.text && 
        !m.text.includes("ファイルを送信しました") &&
        m.text.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return matchName || matchMessage;
  });

  const pinnedRooms = filteredRooms.filter(r => r.pinnedBy?.includes(userData.id));
  const otherRooms = filteredRooms.filter(r => !r.pinnedBy?.includes(userData.id));

  const filteredTenantUsers = tenantUsers.filter(u => u.id !== userData.id && u.name.toLowerCase().includes(searchQuery.toLowerCase()));
  
  const filteredExternalUsers = externalUsers.filter(e => {
    const matchName = e.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = extCategoryFilter === "all" || e.category === extCategoryFilter;
    return matchName && matchCat;
  }).sort((a, b) => {
    if (extSortOrder === "name") return a.name.localeCompare(b.name, "ja");
    if (extSortOrder === "validUntil") return (a.validUntil || "9999").localeCompare(b.validUntil || "9999");
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const allFilteredUsers = [...filteredTenantUsers, ...filteredExternalUsers];
  
  const getRoomIconAndColor = (room: ChatRoom) => {
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
    if (room.type === "custom_group") {
      return { icon: Users, color: "bg-orange-500" }; 
    }
    return null;
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const handleContextMenu = (e: React.MouseEvent, roomId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, roomId });
  };

  const handleRenameRoom = async () => {
    if (!showRenameModal || !newName.trim()) return;
    try {
      const targetRoom = chatRooms.find(r => r.id === showRenameModal.roomId);
      await updateDoc(doc(db, "chat_rooms", showRenameModal.roomId), { name: newName.trim() });
      
      if (targetRoom) {
        const notifyPromises = targetRoom.members.filter(id => id !== userData.id).map(targetId => {
          const targetUser = getUserById(targetId);
          const targetIsExt = targetUser ? "category" in targetUser : false;
          const baseUrl = targetIsExt ? "/ext-chat" : "/top/chat";
          return addDoc(collection(db, "notifications"), {
            userId: targetId,
            schoolId: userData.schoolId,
            title: "グループ名が変更されました",
            body: `${userData.name}さんがグループ名を「${newName.trim()}」に変更しました。`,
            sourceApp: "chat",
            linkUrl: `${baseUrl}?room=${showRenameModal.roomId}`,
            isRead: false,
            isFlagged: false,
            createdAt: serverTimestamp()
          });
        });
        await Promise.all(notifyPromises);
      }

      setShowRenameModal(null);
    } catch (error) {
      showAlert("名前の変更に失敗しました", "error");
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetRoomIdForIcon) return;
    
    try {
      const storageRef = ref(storage, `chat_attachments/${targetRoomIdForIcon}/icon_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "chat_rooms", targetRoomIdForIcon), { iconURL: url });
      setTargetRoomIdForIcon(null);
    } catch (error) {
      showAlert("アイコンのアップロードに失敗しました", "error");
    }
  };

  const renderRoomItem = (room: ChatRoom, isPinned: boolean) => {
    const info = getRoomInfo(room);
    const isSelected = activeRoomId === room.id;
    const unreadCount = room.unreadCount?.[userData.id] || 0;
    const roomConfig = getRoomIconAndColor(room);

    let previewMessage = room.lastMessage || "まだメッセージはありません";
    let isMessageHit = false;

    if (searchQuery.trim() && allMessagesCache) {
      const hitMsg = allMessagesCache.find(m => 
        m.roomId === room.id && 
        m.senderId !== "system" && 
        m.text && 
        !m.text.includes("ファイルを送信しました") &&
        m.text.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (hitMsg) {
        previewMessage = hitMsg.text.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' '); 
        isMessageHit = true;
      }
    }

    const isMentioned = unreadCount > 0 && previewMessage && (previewMessage.includes('@全員') || previewMessage.includes(`@${userData.name}`));
    const presenceState = !info.isGroup && info.otherMemberId ? getUserPresenceState(info.otherMemberId) : undefined;

    return (
      <div 
        key={room.id} 
        onClick={() => onSelectRoom(room.id)}
        onContextMenu={(e) => handleContextMenu(e, room.id)}
        className={`flex items-center gap-2.5 p-2 sm:p-2.5 cursor-pointer transition-colors group relative ${isSelected ? `${c.lightBg} border-l-2 ${c.border}` : 'hover:bg-gray-50 border-l-2 border-transparent'}`}
      >
        {info.isGroup ? (
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-sm relative ${room.iconURL ? 'bg-transparent border border-gray-200' : roomConfig?.color || 'bg-gray-700'}`}>
            {room.iconURL ? (
              <img src={room.iconURL} alt={info.name} className="w-full h-full rounded-full object-cover" />
            ) : roomConfig?.imgUrl ? (
              <img src={roomConfig.imgUrl} alt={info.name} className="w-full h-full rounded-full object-cover" />
            ) : roomConfig?.icon ? (
              <roomConfig.icon className="w-4 h-4"/>
            ) : (
              <Users className="w-4 h-4"/>
            )}
          </div>
        ) : (
          <UserAvatar name={info.name} url={info.avatar} isExternal={info.isExternal} className="w-9 h-9 text-xs" presenceState={presenceState} />
        )}
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex justify-between items-end mb-0.5">
            <div className="flex items-center gap-1 overflow-hidden">
              {room.isOfficial && <span className="px-1 py-0.5 rounded text-[7px] font-black bg-indigo-100 text-indigo-700 flex-shrink-0 border border-indigo-200">公式</span>}
              {info.isExternal && <span className="px-1 py-0.5 rounded text-[7px] font-black bg-amber-100 text-amber-700 flex-shrink-0 border border-amber-200">外部</span>}
              <h4 className={`text-[12px] truncate ${isSelected ? c.text : 'text-gray-900'} ${unreadCount > 0 ? 'font-black' : 'font-bold'}`}>{info.name}</h4>
            </div>
            <span className={`text-[8px] font-bold flex-shrink-0 ml-1 ${unreadCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>{formatTime(room.updatedAt)}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <p className={`text-[10px] truncate ${unreadCount > 0 || isMessageHit ? 'text-gray-900 font-bold' : 'text-gray-500 font-medium'}`}>
              {isMessageHit && <Search className="w-2.5 h-2.5 inline-block mr-0.5 text-indigo-500" />}
              {previewMessage}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {isMentioned && (
                <span className="bg-rose-100 text-rose-700 border border-rose-200 text-[7px] font-black px-1 py-0.5 rounded">
                  @メンション
                </span>
              )}
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center shadow-sm">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onTogglePin(room.id, isPinned); }} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all ${isPinned ? 'text-amber-500 bg-amber-50 opacity-100' : 'text-gray-400 opacity-30 group-hover:opacity-100 hover:text-gray-600 hover:bg-gray-200'}`} title={isPinned ? "ピン留めを解除" : "ピン留めする"}><Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-500' : ''}`} /></button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white relative border-r border-gray-200">
      
      <input type="file" ref={fileInputRef} onChange={handleIconUpload} accept="image/*" className="hidden" />

      {contextMenu.roomId && (
        <div 
          className="fixed z-50 bg-white border border-gray-200 shadow-xl rounded-xl py-1 w-44 animate-fade-in"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => {
              const isPinned = chatRooms.find(r => r.id === contextMenu.roomId)?.pinnedBy?.includes(userData.id);
              onTogglePin(contextMenu.roomId!, !!isPinned);
              setContextMenu({ x: 0, y: 0, roomId: null });
            }}
            className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-bold text-xs transition-colors"
          >
            <Pin className="w-3.5 h-3.5 text-gray-400" /> 
            {chatRooms.find(r => r.id === contextMenu.roomId)?.pinnedBy?.includes(userData.id) ? "ピン留め解除" : "ピン留め"}
          </button>

          {chatRooms.find(r => r.id === contextMenu.roomId)?.type === "direct" && !isExternalMode && (
            <button
              onClick={() => {
                const room = chatRooms.find(r => r.id === contextMenu.roomId);
                const otherMemberId = room?.members.find(id => id !== userData.id);
                const otherUser = getUserById(otherMemberId || "");
                if (otherUser) {
                  onSelectRoom(contextMenu.roomId!); 
                }
                setContextMenu({ x: 0, y: 0, roomId: null });
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-bold text-xs transition-colors border-t border-gray-100"
            >
              <User className="w-3.5 h-3.5 text-gray-400" /> チャットを開く
            </button>
          )}

          {chatRooms.find(r => r.id === contextMenu.roomId)?.type === "custom_group" && !isExternalMode && (
            <>
              <div className="w-full h-px bg-gray-100 my-0.5"></div>
              <button
                onClick={() => {
                  const room = chatRooms.find(r => r.id === contextMenu.roomId);
                  setShowRenameModal({ roomId: room!.id, currentName: room?.name || "" });
                  setNewName(room?.name || "");
                  setContextMenu({ x: 0, y: 0, roomId: null });
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-bold text-xs transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-gray-400" /> 名前を変更
              </button>
              <button
                onClick={() => {
                  setTargetRoomIdForIcon(contextMenu.roomId);
                  fileInputRef.current?.click();
                  setContextMenu({ x: 0, y: 0, roomId: null });
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-bold text-xs transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5 text-gray-400" /> アイコンを設定
              </button>
            </>
          )}
        </div>
      )}

      {showRenameModal && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-slide-up">
            <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-[11px] font-black text-gray-900">グループ名の変更</h3>
              <button onClick={() => setShowRenameModal(null)} className="p-1 text-gray-400 hover:bg-gray-200 rounded-lg"><X className="w-3.5 h-3.5"/></button>
            </div>
            <div className="p-4">
              <input 
                type="text" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="新しいグループ名"
                autoFocus
              />
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setShowRenameModal(null)} className="px-4 py-2 text-[10px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">キャンセル</button>
                <button onClick={handleRenameRoom} disabled={!newName.trim()} className="px-4 py-2 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 rounded-xl transition-colors shadow-sm">保存する</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-2 sm:p-3 border-b border-gray-100 bg-gray-50/50 shrink-0">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xs sm:text-sm font-black text-gray-900 px-1">トークを選択</h2>
          {!isExternalMode && perms.canCreateCustomGroup && (
            <button onClick={() => setShowGroupModal(true)} className="p-1 sm:p-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors shadow-2xs">
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        
        {!isExternalMode && (
          <div className="flex bg-gray-200/60 p-0.5 sm:p-1 rounded-lg w-full shadow-inner mb-2 overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveTab("chats")} className={`relative flex-1 min-w-[45px] flex justify-center items-center py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold rounded transition-all ${activeTab === "chats" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              トーク
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[7px] font-black px-1 rounded-full shadow-sm z-10 border border-white">
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </span>
              )}
            </button>
            <button onClick={() => setActiveTab("contacts")} className={`flex-1 min-w-[50px] flex justify-center items-center py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold rounded transition-all ${activeTab === "contacts" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>アドレス</button>
            
            {isInternalUser && perms.canViewExternalUser && (
              <button onClick={() => setActiveTab("external")} className={`flex-1 min-w-[50px] flex justify-center items-center py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold rounded transition-all ${activeTab === "external" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>外部管理</button>
            )}
            
            {isInternalUser && internalUser && (internalUser.role === "admin" || internalUser.role === "system_admin" || internalUser.isITManager) && (
              <button onClick={() => setActiveTab("settings")} className={`flex-1 min-w-[45px] flex justify-center items-center py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold rounded transition-all ${activeTab === "settings" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>設定</button>
            )}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input type="text" placeholder="検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full pl-7 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-bold focus:outline-none focus:ring-2 ${c.ring} shadow-2xs placeholder:text-gray-400`} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        
        {activeTab === "chats" && (
          <div className="pb-4">
            {filteredRooms.length === 0 ? (
              <div className="py-10 text-center text-gray-400 flex flex-col items-center">
                <MessageCircle className="w-6 h-6 mb-2 opacity-30" />
                <p className="text-[10px] font-bold">トーク履歴がありません</p>
              </div>
            ) : (
              <>
                {pinnedRooms.length > 0 && (
                  <div className="mb-2">
                    <div className="px-2.5 py-1 bg-gray-50 border-y border-gray-100 text-[9px] font-bold text-gray-500 flex items-center gap-1"><Pin className="w-2.5 h-2.5" /> ピン留め</div>
                    <div className="divide-y divide-gray-50">{pinnedRooms.map(r => renderRoomItem(r, true))}</div>
                  </div>
                )}
                {otherRooms.length > 0 && (
                  <div>
                    {pinnedRooms.length > 0 && <div className="px-2.5 py-1 bg-gray-50 border-y border-gray-100 text-[9px] font-bold text-gray-500">すべてのトーク</div>}
                    <div className="divide-y divide-gray-50">{otherRooms.map(r => renderRoomItem(r, false))}</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!isExternalMode && activeTab === "contacts" && (
          <div className="p-2 sm:p-3 pb-6">
            {!searchQuery && isInternalUser && internalUser && (
              <>
                <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1.5 pl-1">あなたのアカウント</h5>
                <div 
                  onClick={() => {
                    const evt = new CustomEvent('open-profile', { detail: userData });
                    window.dispatchEvent(evt);
                  }} 
                  className="flex items-center gap-2.5 p-2 mb-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <UserAvatar name={userData.name} url={(userData as any).photoURL} className="w-10 h-10 text-sm" presenceState={getUserPresenceState(userData.id)} />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-gray-900 truncate">{userData.name}</h4>
                    <span className="text-[9px] font-bold text-gray-500 truncate block">{internalUser.positionName || "自分のプロフィール"}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                </div>

                <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1.5 pl-1">所属チーム・組織</h5>
                <div className="space-y-0.5 mb-4">
                  
                  <div onClick={() => onJoinOfficialRoom({ type: "tenant_all", name: `全メンバーチャット (${schoolName || "テナント"})` })} className="flex items-center gap-2.5 p-1.5 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors group border border-transparent hover:border-blue-100">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-2xs ${schoolLogoURL ? 'bg-white border border-gray-200' : 'bg-blue-600'}`}>
                      {schoolLogoURL ? <img src={schoolLogoURL} className="w-full h-full rounded-full object-cover" alt="logo" /> : <Building2 className="w-3.5 h-3.5"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[11px] font-black text-gray-900 group-hover:text-blue-800 truncate">全メンバーチャット ({schoolName || "テナント"})</h4>
                      <span className="text-[8px] font-bold text-gray-500">組織全員へのお知らせ等に</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400" />
                  </div>
                  
                  {(internalUser.role === "admin" || internalUser.role === "system_admin" || internalUser.isITManager) && (
                    <div onClick={() => onJoinOfficialRoom({ type: "role_admin", name: "管理者・IT担当チーム" })} className="flex items-center gap-2.5 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group border border-transparent hover:border-slate-200">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white shadow-2xs"><Shield className="w-3.5 h-3.5"/></div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[11px] font-black text-gray-900 group-hover:text-slate-800">管理者・IT担当チーム</h4>
                        <span className="text-[8px] font-bold text-gray-500">システム管理・運用連絡</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-slate-400" />
                    </div>
                  )}

                  {internalUser.role === "teacher" && (
                    <div onClick={() => onJoinOfficialRoom({ type: "role_teacher", name: "教職員チーム" })} className="flex items-center gap-2.5 p-1.5 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors group border border-transparent hover:border-emerald-100">
                      <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-2xs"><GraduationCap className="w-3.5 h-3.5"/></div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[11px] font-black text-gray-900 group-hover:text-emerald-800">教職員チーム</h4>
                        <span className="text-[8px] font-bold text-gray-500">先生間での連絡用</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-400" />
                    </div>
                  )}

                  {internalUser.isManager && (
                    <div onClick={() => onJoinOfficialRoom({ type: "role_manager", name: "マネージャーチーム" })} className="flex items-center gap-2.5 p-1.5 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors group border border-transparent hover:border-rose-100">
                      <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-2xs"><Star className="w-3.5 h-3.5"/></div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[11px] font-black text-gray-900 group-hover:text-rose-800">マネージャーチーム</h4>
                        <span className="text-[8px] font-bold text-gray-500">リーダー陣の連絡用</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-rose-400" />
                    </div>
                  )}

                  {myPositions.map(pos => (
                    <div key={pos.id} onClick={() => onJoinOfficialRoom({ type: "position", targetId: pos.id, name: pos.name })} className="flex items-center gap-2.5 p-1.5 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors group border border-transparent hover:border-emerald-100">
                      <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-2xs"><Briefcase className="w-3.5 h-3.5"/></div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[11px] font-black text-gray-900 group-hover:text-emerald-800">{pos.name}</h4>
                        <span className="text-[8px] font-bold text-gray-500">役職メンバー公式チャット</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-400" />
                    </div>
                  ))}
                </div>
              </>
            )}

            <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1.5 pl-1">すべてのメンバー ({allFilteredUsers.length})</h5>
            <div className="space-y-0.5">
              <button data-profile-trigger="me" onClick={() => {
                const evt = new CustomEvent('open-profile', { detail: userData });
                window.dispatchEvent(evt);
              }} className="hidden" />

              {(() => {
                const sorted = [...allFilteredUsers].sort((a, b) => {
                  const isExtA = "category" in a;
                  const isExtB = "category" in b;
              
                  if (!isExtA && isExtB) return -1;
                  if (isExtA && !isExtB) return 1;
              
                  if (!isExtA && !isExtB) {
                    const numA = parseInt((a as UserData).attendanceNumber || "999999", 10);
                    const numB = parseInt((b as UserData).attendanceNumber || "999999", 10);
                    if (numA !== numB) return numA - numB;
                    return a.name.localeCompare(b.name, "ja");
                  }
              
                  if (isExtA && isExtB) {
                    const kanaA = (a as ExternalUser).nameKana || a.name;
                    const kanaB = (b as ExternalUser).nameKana || b.name;
                    return kanaA.localeCompare(kanaB, "ja");
                  }
              
                  return 0;
                });

                return sorted.map(u => {
                  const isExt = "category" in u;
                  let subText = "";
                  if (isExt) {
                    subText = (u as ExternalUser).affiliation || "外部ユーザー";
                  } else {
                    const ud = u as UserData;
                    const posNames = positions.filter(p => ud.positionIds?.includes(p.id) || ud.primaryPositionId === p.id).map(p => p.name);
                    if (posNames.length > 0) {
                      subText = posNames.join(", ");
                    } else if (ud.role === "teacher") {
                      subText = "教職員";
                    } else if (ud.role === "admin") {
                      subText = "管理者";
                    } else {
                      subText = "生徒";
                    }
                  }

                  const format6Digit = (numStr?: string) => {
                    if (!numStr) return "000000";
                    const cleanNum = numStr.replace(/[^0-9]/g, '');
                    return cleanNum ? cleanNum.padStart(6, '0') : "000000";
                  };

                  const presenceState = !isExt ? getUserPresenceState(u.id) : undefined;

                  return (
                    <div 
                      key={u.id} 
                      onClick={() => {
                        const evt = new CustomEvent('open-profile', { detail: u });
                        window.dispatchEvent(evt);
                      }} 
                      className="flex items-center gap-2.5 p-1.5 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group"
                    >
                      <UserAvatar name={u.name} url={(u as any).photoURL} isExternal={isExt} className="w-8 h-8 text-xs" presenceState={presenceState} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-[11px] font-black text-gray-900 truncate">{u.name}</h4>
                          {isExt && <span className="px-1 py-0.5 rounded text-[7px] font-black bg-amber-100 text-amber-700 border border-amber-200">外部</span>}
                        </div>
                        <p className="text-[8px] font-bold text-gray-500 truncate block">
                          {!isExt && (u as UserData).attendanceNumber ? `No.${format6Digit((u as UserData).attendanceNumber)} ` : ""}
                          {subText}
                        </p>
                      </div>
                    </div>
                  )
                });
              })()}
            </div>
          </div>
        )}

        {!isExternalMode && activeTab === "external" && perms.canViewExternalUser && (
          <div className="p-2 sm:p-3 pb-6 animate-fade-in">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h3 className="text-[11px] font-black text-gray-900 flex items-center gap-1.5"><Globe className="w-3 h-3 text-amber-500"/> 外部ユーザー</h3>
                <p className="text-[8px] font-bold text-gray-500 mt-0.5">({filteredExternalUsers.length}名)</p>
              </div>
              {perms.canCreateExternalUser && (
                <button onClick={() => onOpenExternalUserManagement && onOpenExternalUserManagement("create")} className="px-2 py-1 bg-amber-500 text-white text-[9px] font-bold rounded shadow-sm hover:bg-amber-600 transition-colors">新規登録</button>
              )}
            </div>

            <div className="flex gap-1.5 mb-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
              <div className="flex-1 flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-0.5">
                <Filter className="w-2.5 h-2.5 text-gray-400" />
                <select value={extCategoryFilter} onChange={(e) => setExtCategoryFilter(e.target.value)} className="w-full text-[9px] font-bold bg-transparent border-none p-0 focus:ring-0 cursor-pointer text-gray-700">
                  <option value="all">すべての区分</option><option value="student">生徒</option><option value="teacher">教職員</option><option value="other">その他</option>
                </select>
              </div>
              <div className="flex-1 flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-0.5">
                <ArrowUpDown className="w-2.5 h-2.5 text-gray-400" />
                <select value={extSortOrder} onChange={(e) => setExtSortOrder(e.target.value as any)} className="w-full text-[9px] font-bold bg-transparent border-none p-0 focus:ring-0 cursor-pointer text-gray-700">
                  <option value="created">登録日順</option><option value="name">名前順</option><option value="validUntil">有効期限順</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              {filteredExternalUsers.map(ext => (
                <div key={ext.id} onClick={() => onOpenExternalUserManagement && onOpenExternalUserManagement("view", ext)} className="p-2 bg-white border border-gray-200 hover:border-amber-400 rounded-lg flex items-center justify-between cursor-pointer transition-all shadow-2xs group">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar name={ext.name} isExternal={true} className="w-7 h-7 text-[10px]" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <h4 className="text-[11px] font-black text-gray-900 truncate">{ext.name}</h4>
                        <span className={`px-1 py-0.5 rounded text-[7px] font-black ${ext.status === 'active' ? 'bg-emerald-100 text-emerald-700' : (ext.status === 'verifying' || ext.status === 'verified') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                          {ext.status === "pending" ? "仮登録" : ext.status === "verifying" ? "メール確認中" : ext.status === "verified" ? "PW設定待ち" : ext.status === "active" ? "有効" : "停止"}
                        </span>
                      </div>
                      <p className="text-[8px] text-gray-500 truncate">{ext.affiliation || "所属なし"}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-amber-500 transition-colors shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {!isExternalMode && activeTab === "settings" && onOpenSettings && (
          <div className="p-3 pb-6 animate-fade-in">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-[11px] font-black text-gray-900 flex items-center gap-1.5"><Settings className="w-3.5 h-3.5 text-indigo-500"/> チャット権限管理</h3>
                <p className="text-[8px] font-bold text-gray-500 mt-0.5">カテゴリ別の機能・送信制限</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div onClick={() => onOpenSettings("general")} className="p-2.5 bg-white border border-gray-200 hover:border-indigo-400 rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-2xs group">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                    <MessageCircle className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-black text-gray-900 truncate">1. チャット全般設定</h4>
                    <p className="text-[8px] text-gray-500 truncate">チャット機能・自由グループ作成</p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
              </div>

              <div onClick={() => onOpenSettings("external")} className="p-2.5 bg-white border border-gray-200 hover:border-indigo-400 rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-2xs group">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-black text-gray-900 truncate">2. 外部ユーザー権限設定</h4>
                    <p className="text-[8px] text-gray-500 truncate">外部作成・参照・編集・削除の許可</p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-amber-500 transition-colors shrink-0" />
              </div>

              <div onClick={() => onOpenSettings("media")} className="p-2.5 bg-white border border-gray-200 hover:border-indigo-400 rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-2xs group">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                    <Paperclip className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-black text-gray-900 truncate">3. メディア・ファイル権限</h4>
                    <p className="text-[8px] text-gray-500 truncate">画像・各種ファイルの送信許可</p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0" />
              </div>
            </div>
          </div>
        )}
      </div>

      {showGroupModal && !isExternalMode && (
        <GroupCreateModal 
          currentUser={userData} 
          tenantUsers={tenantUsers} 
          externalUsers={externalUsers} 
          positions={positions} 
          appConfig={appConfig} 
          onClose={() => setShowGroupModal(false)} 
          onCreate={onCreatePrivateRoom} 
        />
      )}

    </div>
  );
}