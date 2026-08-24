"use client";

import React, { useState, useEffect, useMemo } from "react";
import { doc, collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { X, MessageCircle, Briefcase, ShieldAlert, UserCog, Mail, Phone, Tag, User, MessageSquareText } from "lucide-react";
import { UserData, ExternalUser, ChatRoom, Position, AppConfig, COLOR_MAPPINGS } from "../types";
import { PRESENCE_CONFIG, PresenceState, UserPresence, ScheduledPresence, WeeklyDayRoutine, getEffectivePresence } from "../../presence/types";

const UserAvatar = ({ name, url, isExternal = false, className = "w-10 h-10 text-sm", presenceState }: { name: string, url?: string | null, isExternal?: boolean, className?: string, presenceState?: PresenceState }) => {
  const config = presenceState ? PRESENCE_CONFIG[presenceState] : null;
  return (
    <div className="relative inline-block flex-shrink-0">
      {url ? (
        <img src={url} alt={name} className={`${className} rounded-full object-cover shadow-2xs border-2 border-white bg-white`} />
      ) : (
        <div className={`${className} rounded-full bg-gradient-to-tr ${isExternal ? 'from-yellow-400 to-amber-500' : 'from-indigo-500 to-purple-600'} flex items-center justify-center text-white font-bold flex-shrink-0 shadow-2xs border-2 border-white`}>
          {name.charAt(0)}
        </div>
      )}
      {config && !isExternal && (
        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-[2.5px] shadow-sm">
          <config.icon className={`w-5 h-5 ${config.fillClass}`} />
        </div>
      )}
    </div>
  );
};

type Props = {
  user: UserData | ExternalUser;
  currentUser: UserData | ExternalUser;
  positions: Position[];
  chatRooms: ChatRoom[];
  appConfig: AppConfig;
  onClose: () => void;
  onSelectRoom: (roomId: string) => void;
  onCreatePrivateRoom: (data: { type: "direct", members: string[] }) => void;
};

export default function UserProfileModal({ user, currentUser, positions, chatRooms, appConfig, onClose, onSelectRoom, onCreatePrivateRoom }: Props) {
  const c = COLOR_MAPPINGS[appConfig.color] || COLOR_MAPPINGS.default;
  const isExternal = "category" in user;
  
  const [rawPresence, setRawPresence] = useState<UserPresence | null>(null);
  const [schedules, setSchedules] = useState<ScheduledPresence[]>([]);
  const [routines, setRoutines] = useState<WeeklyDayRoutine[]>([]);
  
  // ★ 毎秒監視し、"分"が切り替わった瞬間に再計算させる
  const [currentMinute, setCurrentMinute] = useState(new Date().getMinutes());
  useEffect(() => {
    const timer = setInterval(() => setCurrentMinute(new Date().getMinutes()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isExternal) return;
    const schoolId = (user as UserData).schoolId;
    if (!schoolId) return;

    const unsubP = onSnapshot(doc(db, "presence_statuses", user.id), (snap) => {
      if (snap.exists()) setRawPresence({ id: snap.id, ...snap.data() } as UserPresence);
    });
    const unsubS = onSnapshot(query(collection(db, "presence_schedules"), where("schoolId", "==", schoolId)), (snap) => {
      const list: ScheduledPresence[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as ScheduledPresence));
      setSchedules(list);
    });
    const unsubR = onSnapshot(query(collection(db, "presence_weekly_templates"), where("schoolId", "==", schoolId)), (snap) => {
      const list: WeeklyDayRoutine[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as WeeklyDayRoutine));
      setRoutines(list);
    });

    return () => { unsubP(); unsubS(); unsubR(); };
  }, [user, isExternal]);

  const effectivePresence = useMemo(() => getEffectivePresence(rawPresence, schedules, routines, new Date()), [rawPresence, schedules, routines, currentMinute]);
  const presenceState = effectivePresence?.currentState;
  const presenceConfig = presenceState ? PRESENCE_CONFIG[presenceState] : null;

  const userPositions = !isExternal ? positions.filter(p => (user as UserData).positionIds?.includes(p.id) || (user as UserData).primaryPositionId === p.id) : [];

  return (
    <div className="absolute inset-0 z-[60] bg-black/40 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center sm:p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full sm:w-[380px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col relative transform transition-transform animate-slide-up" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition-colors z-10">
          <X className="w-4 h-4" />
        </button>
        
        <div className="px-6 pt-10 pb-8 flex flex-col items-center">
          <UserAvatar name={user.name} url={(user as any).photoURL} isExternal={isExternal} presenceState={presenceState} className="w-24 h-24 text-3xl mb-4 shadow-md border-2 border-white" />
          
          <h2 className="text-xl font-black text-gray-900 mb-1">{user.name}</h2>
          {user.nameKana && <p className="text-[11px] font-bold text-gray-400 mb-2">{user.nameKana}</p>}

          {presenceConfig && !isExternal && (
            <div className="flex flex-col items-center mt-2 mb-4 w-full px-4">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 rounded-full border border-gray-100">
                <span className={`text-xs font-black ${presenceConfig.colorClass}`}>{presenceConfig.label}</span>
              </div>
              {effectivePresence?.statusMessage && (
                <div className="mt-2 text-[11px] font-bold text-gray-600 flex items-start gap-1.5 bg-gray-50/80 px-3 py-2 rounded-xl border border-gray-100 max-w-xs text-left w-full">
                  <MessageSquareText className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                  <span className="whitespace-pre-wrap leading-relaxed">{effectivePresence.statusMessage}</span>
                </div>
              )}
            </div>
          )}
          
          <div className={`w-full space-y-2 ${isExternal ? 'mt-2' : ''}`}>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500">
                <Tag className="w-4 h-4" />
                <span className="text-xs font-bold">区分</span>
              </div>
              <span className="text-xs font-black text-gray-900">
                {isExternal 
                  ? ((user as ExternalUser).category === "student" ? "生徒 (外部)" : (user as ExternalUser).category === "teacher" ? "教職員 (外部)" : "外部関係者") 
                  : ((user as UserData).role === "teacher" ? "教職員" : (user as UserData).role === "admin" ? "管理者" : "生徒")}
              </span>
            </div>

            <div className="flex items-start justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 mt-0.5">
                <Briefcase className="w-4 h-4" />
                <span className="text-xs font-bold">{isExternal ? "所属・団体" : "役職"}</span>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {isExternal ? (
                  <span className="text-xs font-black text-gray-900">{(user as ExternalUser).affiliation || "未設定"}</span>
                ) : (
                  userPositions.length > 0 ? userPositions.map(pos => {
                    const isLeader = pos.leaderUserId === user.id;
                    return (
                      <span key={pos.id} className={`text-xs font-black px-2 py-0.5 rounded ${isLeader ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                        {isLeader ? `${pos.name} ${pos.leaderTitle || "部門長"}` : pos.name}
                      </span>
                    )
                  }) : (
                    <span className="text-xs font-bold text-gray-400">役職なし</span>
                  )
                )}
              </div>
            </div>

            {!isExternal && ((user as UserData).isITManager || (user as UserData).isManager) && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500">
                  <ShieldAlert className="w-4 h-4" />
                  <span className="text-xs font-bold">管理権限</span>
                </div>
                <div className="flex gap-1.5">
                  {(user as UserData).isITManager && <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">IT担当</span>}
                  {(user as UserData).isManager && <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">マネージャー</span>}
                </div>
              </div>
            )}
            
            {user.email && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500">
                  <Mail className="w-4 h-4" />
                  <span className="text-xs font-bold">メール</span>
                </div>
                <span className="text-xs font-bold text-gray-900">{user.email}</span>
              </div>
            )}
            {user.phoneNumber && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500">
                  <Phone className="w-4 h-4" />
                  <span className="text-xs font-bold">電話番号</span>
                </div>
                <span className="text-xs font-bold text-gray-900">{user.phoneNumber}</span>
              </div>
            )}
          </div>

          {user.id !== currentUser.id && (
            <div className="w-full mt-6">
              {chatRooms.find(r => r.type === "direct" && r.members.length === 2 && r.members.includes(user.id)) ? (
                <button onClick={() => { onSelectRoom(chatRooms.find(r => r.type === "direct" && r.members.length === 2 && r.members.includes(user.id))!.id); onClose(); }} className={`w-full py-3.5 rounded-xl text-sm font-bold text-white ${c.bg} ${c.hover} shadow-md transition-all flex justify-center items-center gap-2`}>
                  <MessageCircle className="w-5 h-5" /> トークルームに移動する
                </button>
              ) : (
                <button onClick={() => { onCreatePrivateRoom({ type: "direct", members: [currentUser.id, user.id] }); onClose(); }} className={`w-full py-3.5 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-md transition-all flex justify-center items-center gap-2`}>
                  <MessageCircle className="w-5 h-5" /> 新規チャットを開始する
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}