import { CheckCircle2, Circle, MinusCircle, Clock, XCircle, LucideIcon } from "lucide-react";

export type PresenceState = 
  | "available"      
  | "busy"           
  | "do_not_disturb" 
  | "be_right_back"  
  | "away"           
  | "offline";       

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
  schoolId?: string;
  userName: string;
  userPhotoURL?: string | null;
  positionName?: string;
  role: string;
  systemId?: string; 
  
  currentState: PresenceState;
  locationId?: string | null;
  statusMessage?: string;
  statusUpdatedAt?: string;
  
  isAutoOnline?: boolean;
  isManualOverride?: boolean;
  lastActiveAt: string;
  expiresAt?: string | null;

  updatedByUserId?: string | null;
  updatedByUserName?: string | null;
};

export type TimeSlotRoutine = {
  id: string;
  startTime: string; 
  endTime: string;   
  state: PresenceState;
  locationId?: string | null;
  note?: string;
};

export type WeeklyDayRoutine = {
  id?: string;
  userId: string;
  schoolId?: string;
  dayOfWeek: number; 
  slots: TimeSlotRoutine[];
};

export type ScheduledPresence = {
  id: string;
  userId?: string;     
  userIds: string[];   
  schoolId?: string;
  date: string;
  startTime: string;
  endTime: string;
  state: PresenceState;
  locationId?: string | null;
  note?: string;
  createdAt?: any;
};

export const PRESENCE_CONFIG: Record<PresenceState, { label: string; icon: LucideIcon; colorClass: string; fillClass: string }> = {
  available: { label: "連絡可能", icon: CheckCircle2, colorClass: "text-green-600", fillClass: "fill-green-600 text-white" },
  busy: { label: "取り込み中", icon: Circle, colorClass: "text-red-500", fillClass: "fill-red-500 text-red-500" },
  do_not_disturb: { label: "応答不可", icon: MinusCircle, colorClass: "text-red-600", fillClass: "fill-red-600 text-white" },
  be_right_back: { label: "すぐに戻ります", icon: Clock, colorClass: "text-yellow-500", fillClass: "fill-yellow-500 text-white" },
  away: { label: "退席中", icon: Clock, colorClass: "text-yellow-500", fillClass: "fill-yellow-500 text-white" },
  offline: { label: "オフライン", icon: XCircle, colorClass: "text-gray-400", fillClass: "fill-white text-gray-400" },
};

// ★ スケジュールを計算するロジック（endTime を `timeStr < s.endTime` に変更し、終了時刻の00秒で即終了させる）
export const getEffectivePresence = (p: UserPresence | null, scheds: ScheduledPresence[], routs: WeeklyDayRoutine[], nowTime?: Date): UserPresence | null => {
  if (!p) return null;
  if (p.isManualOverride) return p;

  const now = nowTime || new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localIso = new Date(now.getTime() - offset).toISOString();
  const dateStr = localIso.split("T")[0];
  const timeStr = localIso.split("T")[1].substring(0, 5); // "HH:mm"

  const mySched = scheds.find(s => {
    const isMember = (s.userIds && s.userIds.includes(p.userId)) || s.userId === p.userId;
    // <= を < に変更したことで、終了時刻(00秒)の瞬間にスケジュールが無効になる
    return isMember && s.date === dateStr && s.startTime <= timeStr && timeStr < s.endTime; 
  });

  if (mySched) {
    return { ...p, currentState: mySched.state, locationId: mySched.locationId, statusMessage: mySched.note || p.statusMessage, isAutoOnline: false };
  }

  const dayNum = now.getDay();
  const myRout = routs.find(r => r.userId === p.userId && r.dayOfWeek === dayNum);
  if (myRout) {
    const slot = myRout.slots.find(s => s.startTime <= timeStr && timeStr < s.endTime); 
    if (slot) {
      return { ...p, currentState: slot.state, locationId: slot.locationId, statusMessage: slot.note || p.statusMessage, isAutoOnline: false };
    }
  }

  return p;
};