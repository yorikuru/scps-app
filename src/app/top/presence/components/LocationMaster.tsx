"use client";

import React, { useState } from "react";
import { doc, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PresenceLocation } from "../types";
import { MapPin, X, Plus, Trash2, Eye, EyeOff, Save, Loader2 } from "lucide-react";

type Props = {
  schoolId: string;
  locations: PresenceLocation[];
  onClose: () => void;
  showAlert: (type: "success" | "error", message: string) => void;
};

export default function LocationMaster({ schoolId, locations, onClose, showAlert }: Props) {
  const [newLocName, setNewLocName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleVisibility = async (loc: PresenceLocation) => {
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "presence_locations", loc.id), { isHidden: !loc.isHidden });
    } catch (e) { showAlert("error", "更新に失敗しました。"); }
    setIsProcessing(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim()) return;
    setIsProcessing(true);
    try {
      const newId = `${schoolId}_custom_${Date.now()}`;
      await setDoc(doc(db, "presence_locations", newId), {
        id: newId, schoolId, name: newLocName.trim(), isDefault: false, isHidden: false, order: locations.length + 1
      });
      setNewLocName("");
      showAlert("success", "新しい勤務先を追加しました。");
    } catch (e) { showAlert("error", "追加に失敗しました。"); }
    setIsProcessing(false);
  };

  const handleDelete = async (loc: PresenceLocation) => {
    if (loc.isDefault) return;
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, "presence_locations", loc.id));
      showAlert("success", "削除しました。");
    } catch (e) { showAlert("error", "削除に失敗しました。"); }
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-slide-up sm:animate-fade-in">
        
        <div className="px-4 py-3.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
          <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-indigo-600" /> 勤務先マスタ管理
          </h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-4">
          <p className="text-[10px] font-bold text-gray-500 mb-2">デフォルトの勤務先は非表示のみ可能です。必要に応じて独自項目を追加してください。</p>

          <form onSubmit={handleAdd} className="flex gap-2 mb-4">
            <input 
              type="text" value={newLocName} onChange={e => setNewLocName(e.target.value)} 
              placeholder="新しい勤務先名 (例: 第一体育館)" 
              className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-[16px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
            <button type="submit" disabled={isProcessing || !newLocName.trim()} className="px-4 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 shrink-0 shadow-sm flex items-center">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />} 追加
            </button>
          </form>

          <div className="space-y-1.5">
            {locations.map(loc => (
              <div key={loc.id} className={`flex items-center justify-between p-2.5 rounded-xl border ${loc.isHidden ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200 shadow-2xs'}`}>
                <div className="flex items-center gap-2">
                  <MapPin className={`w-3.5 h-3.5 ${loc.isHidden ? 'text-gray-400' : 'text-indigo-500'}`} />
                  <div>
                    <span className={`text-xs font-black ${loc.isHidden ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{loc.name}</span>
                    {loc.isDefault && <span className="ml-2 text-[8px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">デフォルト</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => toggleVisibility(loc)} disabled={isProcessing} className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1">
                    {loc.isHidden ? <><Eye className="w-3 h-3" />表示する</> : <><EyeOff className="w-3 h-3" />隠す</>}
                  </button>
                  {!loc.isDefault && (
                    <button onClick={() => handleDelete(loc)} disabled={isProcessing} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}