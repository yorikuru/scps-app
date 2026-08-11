import * as LucideIcons from "lucide-react";

export type Position = {
  id: string;
  schoolId: string;
  name: string;
  organizationId: string;
  isStudent: boolean;
  isInternal: boolean;
  shokui: number;
  displayOrder: number;
  leaderUserId?: string | null; 
  leaderTitle?: string | null;  
};

export type ChatPermissions = {
  canUseChat: boolean;
  canCreateExternalUser: boolean;
  canViewExternalUser: boolean;
  canEditExternalUser: boolean;
  canDeleteExternalUser: boolean;
  canCreateCustomGroup: boolean;
  canSendPhoto: boolean;
  canSendFile: boolean;
};

export const getDefaultChatPermissions = (user?: Partial<UserData>): ChatPermissions => {
  const isAdmin = user?.role === "admin" || user?.role === "system_admin" || user?.isITManager;
  
  if (isAdmin) {
    return {
      canUseChat: true,
      canCreateExternalUser: true,
      canViewExternalUser: true,
      canEditExternalUser: true,
      canDeleteExternalUser: true,
      canCreateCustomGroup: true,
      canSendPhoto: true,
      canSendFile: true,
    };
  }

  const perms = user?.chatPermissions;
  return {
    canUseChat: perms?.canUseChat ?? true,
    canCreateExternalUser: perms?.canCreateExternalUser ?? true,
    canViewExternalUser: perms?.canViewExternalUser ?? true,
    canEditExternalUser: perms?.canEditExternalUser ?? true,
    canDeleteExternalUser: perms?.canDeleteExternalUser ?? true,
    canCreateCustomGroup: perms?.canCreateCustomGroup ?? true,
    canSendPhoto: perms?.canSendPhoto ?? true,
    canSendFile: perms?.canSendFile ?? true,
  };
};

export type UserData = { 
  id: string; 
  name: string; 
  nameKana?: string;        
  schoolId: string; 
  role: string; 
  photoURL?: string; 
  department?: string;      
  grade?: string;           
  classNumber?: string;     
  attendanceNumber?: string;
  club?: string;            
  positionIds?: string[];   
  primaryPositionId?: string;
  positionName?: string;    
  email?: string;           
  phoneNumber?: string;     
  studentId?: string;       
  isManager?: boolean;      
  isITManager?: boolean;    
  chatPermissions?: ChatPermissions;
};


export type ExternalUser = {
    id: string;
    schoolId: string;
    loginId: string;
    name: string;
    nameKana?: string;
    email?: string;
    phoneNumber?: string;
    category: "student" | "teacher" | "other";
    affiliation?: string;
    validFrom: string;
    validUntil?: string | null;
    status: "pending" | "verifying" | "verified" | "active" | "suspended";
    authUid?: string | null;
    initialPassword?: string;
    
    // ★ 以下の行を追加してください
    expiresAt?: string | null; 
    
    note?: string;
    createdAt: string;
    createdBy: string;
    createdByName: string;
    updatedAt?: string;
    updatedBy?: string;
  };

export type ChatAttachment = {
  name: string;
  url: string;
  type: string;
  size: number;
};

export type ChatRoomType = "direct" | "custom_group" | "tenant_all" | "role_admin" | "role_teacher" | "role_manager" | "position";

export type ChatRoom = {
  id: string;
  schoolId: string;
  type: ChatRoomType; 
  isOfficial?: boolean;     
  targetId?: string;        
  name?: string;            
  iconURL?: string;         
  members: string[];        
  updatedAt: string;        
  lastMessage?: string;     
  createdAt: string;
  pinnedBy?: string[];      
  unreadCount?: Record<string, number>; 
};

export type ChatReaction = {
  emoji: string;
  users: string[]; 
};

// ★ replyTo （リプライ元の情報）を追加
export type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
  attachments?: ChatAttachment[];
  readBy: string[];         
  createdAt: string;
  isEdited?: boolean;
  reactions?: ChatReaction[];
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
  };
};

export type AppConfig = {
  name: string;
  icon: string;
  color: string;
};

export const COLOR_MAPPINGS: Record<string, { bg: string, text: string, hover: string, border: string, lightBg: string, ring: string }> = {
  indigo: { bg: "bg-indigo-600", text: "text-indigo-600", hover: "hover:bg-indigo-700", border: "border-indigo-200", lightBg: "bg-indigo-100", ring: "focus:ring-indigo-500" },
  blue: { bg: "bg-blue-600", text: "text-blue-600", hover: "hover:bg-blue-700", border: "border-blue-200", lightBg: "bg-blue-100", ring: "focus:ring-blue-500" },
  green: { bg: "bg-emerald-600", text: "text-emerald-600", hover: "hover:bg-emerald-700", border: "border-emerald-200", lightBg: "bg-emerald-100", ring: "focus:ring-emerald-500" },
  default: { bg: "bg-emerald-500", text: "text-emerald-500", hover: "hover:bg-emerald-600", border: "border-emerald-200", lightBg: "bg-emerald-50", ring: "focus:ring-emerald-500" }
};