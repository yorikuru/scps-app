import { CheckCircle2, Circle, MinusCircle, Clock, XCircle, LucideIcon } from "lucide-react";

export type PresenceState = 
  | "available"      // 連絡可能
  | "busy"           // 取り込み中
  | "do_not_disturb" // 応答不可
  | "be_right_back"  // すぐに戻ります
  | "away"           // 退席中
  | "offline";       // オフライン

export type PresenceLocation = {
  id: string;
  schoolId: string;
  name: string;
  isDefault: boolean;
  isHidden: boolean;
  order: number;
};

export type UserPresence = {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string | null;
  positionName?: string;
  role: string;
  systemId?: string; // システム利用番号
  
  currentState: PresenceState;
  locationId?: string | null;
  statusMessage?: string;
  statusUpdatedAt?: string;
  
  isAutoOnline?: boolean;
  lastActiveAt: string;
  expiresAt?: string | null;

  updatedByUserId?: string | null;
  updatedByUserName?: string | null;
};

// ★ 曜日ごとの時間帯スロット定義
export type TimeSlotRoutine = {
  id: string;
  startTime: string; // "10:00"
  endTime: string;   // "12:00"
  state: PresenceState;
  locationId?: string | null;
  note?: string;
};

export type WeeklyDayRoutine = {
  dayOfWeek: number; // 0:日, 1:月, ..., 6:土
  slots: TimeSlotRoutine[];
};

export type ScheduledPresence = {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  state: PresenceState;
  locationId?: string | null;
  note?: string;
};

export const PRESENCE_CONFIG: Record<PresenceState, { label: string; icon: LucideIcon; colorClass: string; fillClass: string }> = {
  available: { label: "連絡可能", icon: CheckCircle2, colorClass: "text-green-600", fillClass: "fill-green-600 text-white" },
  busy: { label: "取り込み中", icon: Circle, colorClass: "text-red-500", fillClass: "fill-red-500 text-red-500" },
  do_not_disturb: { label: "応答不可", icon: MinusCircle, colorClass: "text-red-600", fillClass: "fill-red-600 text-white" },
  be_right_back: { label: "すぐに戻ります", icon: Clock, colorClass: "text-yellow-500", fillClass: "fill-yellow-500 text-white" },
  away: { label: "退席中", icon: Clock, colorClass: "text-yellow-500", fillClass: "fill-yellow-500 text-white" },
  offline: { label: "オフライン", icon: XCircle, colorClass: "text-gray-400", fillClass: "fill-white text-gray-400" },
};