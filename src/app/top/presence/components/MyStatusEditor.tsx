"use client";

import React, { useState, useEffect } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PRESENCE_CONFIG, PresenceState, UserPresence, PresenceLocation } from "../types";
import { MapPin, MessageSquare, Save, ChevronDown, Check, UserCog, X } from "lucide-react";
import { UserData } from "../../page";

type Props = {
  targetUser: UserData;
  currentUser: UserData;
  initialPresence: UserPresence | null;
  locations: PresenceLocation[];
  showAlert: (type: "success" | "error", message: string) => void;
  onClose: () => void;
  isModal: boolean;
};

export default function MyStatusEditor({ targetUser, currentUser, initialPresence, locations, showAlert, onClose, isModal }: Props) {
  const currentState = initialPresence?.currentState || "offline";
  const [selectedState, setSelectedState] = useState<PresenceState>(currentState);
  const [statusMessage, setStatusMessage] = useState(initialPresence?.statusMessage || "");
  const [locationId, setLocationId] = useState(initialPresence?.locationId || "");
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isStateMenuOpen, setIsStateMenuOpen] = useState(false);

  useEffect(() => {
    if (initialPresence) {
      setSelectedState(initialPresence.currentState);
      setStatusMessage(initialPresence.statusMessage || "");
      setLocationId(initialPresence.locationId || "");
    }
  }, [initialPresence]);

  const updateStatusInDb = async (state: PresenceState, msg: string, locId: string) => {
    setIsUpdating(true);
    const isProxy = targetUser.id !== currentUser.id;
    
    try {
      const ref = doc(db, "presence_statuses", targetUser.id);
      
      const payload: any = {
        userId: targetUser.id,
        schoolId: targetUser.schoolId,
        userName: targetUser.name,
        userPhotoURL: targetUser.photoURL || null,
        positionName: targetUser.positionName || "",
        role: targetUser.role,
        systemId: (targetUser as any).systemId || "",
        currentState: state,
        statusMessage: msg.trim(),
        locationId: locId,
        lastActiveAt: new Date().toISOString(),
        statusUpdatedAt: new Date().toISOString(),
        isAutoOnline: false,
        updatedAt: serverTimestamp(),
      };

      if (isProxy) {
        payload.updatedByUserId = currentUser.id;
        payload.updatedByUserName = currentUser.name;
      } else {
        payload.updatedByUserId = null;
        payload.updatedByUserName = null;
      }

      await setDoc(ref, payload, { merge: true });
      showAlert("success", isProxy ? `${targetUser.name} のステータスを更新しました。` : "ステータスを更新しました。");
      setIsStateMenuOpen(false);
      if (isModal) onClose();
    } catch (e) {
      showAlert("error", "ステータスの更新に失敗しました。");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateStatusInDb(selectedState, statusMessage, locationId);
  };

  const activeConfig = PRESENCE_CONFIG[selectedState];
  const activeLocation = locations.find(l => l.id === locationId)?.name;
  const visibleLocations = locations.filter(l => !l.isHidden || l.id === locationId);

  return (
    <div className={`bg-white shadow-sm flex flex-col ${isModal ? 'w-full rounded-t-2xl sm:rounded-2xl' : 'rounded-2xl border border-gray-200 p-4 sm:p-6 md:flex-row md:items-start gap-4 sm:gap-6'}`}>
      
      {isModal && (
        <div className="px-4 py-3.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
          <div>
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5"><UserCog className="w-4 h-4 text-indigo-600" /> 代理ステータス設定</h3>
            <p className="text-[10px] font-bold text-gray-500 mt-0.5"><span className="text-indigo-600 font-black">{targetUser.name}</span> のステータスを変更します</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
      )}

      {/* ユーザーアバター＆ステータスドロップダウン（見切れ防止のため z-50） */}
      <div className={`flex items-center gap-3 sm:gap-4 shrink-0 ${isModal ? 'p-4 sm:p-5 pb-0' : ''}`}>
        <div className="relative shrink-0">
          {targetUser.photoURL ? (
            <img src={targetUser.photoURL} alt="User" className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-gray-100 shadow-sm" />
          ) : (
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 text-lg sm:text-xl font-bold shadow-sm">
              {targetUser.name.charAt(0)}
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-[2px] shadow-sm">
            <activeConfig.icon className={`w-4 h-4 sm:w-6 sm:h-6 ${activeConfig.fillClass}`} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm sm:text-base font-black text-gray-900 leading-tight truncate">
            {targetUser.name}
            {!isModal && <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[8px] sm:text-[9px] rounded-md font-black align-middle">あなた</span>}
          </h2>
          
          <div className="relative mt-1 sm:mt-1.5">
            <button type="button" onClick={() => setIsStateMenuOpen(!isStateMenuOpen)} className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded-lg border border-gray-200">
              <span className={activeConfig.colorClass}>{activeConfig.label}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isStateMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {/* ドロップダウンメニュー（見切れ防止配置） */}
            {isStateMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-2xl z-[100] py-1 animate-fade-in">
                {(Object.keys(PRESENCE_CONFIG) as PresenceState[]).map((st) => {
                  const conf = PRESENCE_CONFIG[st];
                  const isSelected = st === selectedState;
                  return (
                    <button key={st} type="button" onClick={() => { setSelectedState(st); setIsStateMenuOpen(false); }} className="w-full flex items-center justify-between px-3.5 py-2.5 text-[11px] sm:text-xs font-bold hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <conf.icon className={`w-4 h-4 ${conf.fillClass}`} />
                        <span className={isSelected ? 'text-gray-900' : 'text-gray-600'}>{conf.label}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          
          {activeLocation && (
            <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 mt-1 flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 text-indigo-500 shrink-0" /> {activeLocation}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleManualSubmit} className={`flex-1 w-full space-y-3 pt-3 sm:pt-4 md:pt-0 ${!isModal ? 'md:border-l md:border-t-0 border-t border-gray-100 md:pl-6' : 'p-4 sm:p-5'}`}>
        
        <div>
          <label className="block text-[10px] sm:text-xs font-bold text-gray-500 mb-1">ステータスメッセージ</label>
          <div className="relative">
            <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" value={statusMessage} onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="一言メッセージ (翌日0:00に自動リセットされます)"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-[16px] sm:text-xs font-bold text-gray-900 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-[10px] sm:text-xs font-bold text-gray-500 mb-1">勤務先 (活動場所)</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={locationId} onChange={(e) => setLocationId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-[16px] sm:text-xs font-bold text-gray-900 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition-colors appearance-none"
              >
                <option value="">勤務先を設定しない</option>
                {visibleLocations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
            </div>
          </div>
          
          <div className="sm:pt-5 flex items-end shrink-0">
            <button type="submit" disabled={isUpdating} className="w-full sm:w-auto px-6 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] sm:text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50">
              <Save className="w-4 h-4" /> {isModal ? "代理で更新する" : "更新"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}