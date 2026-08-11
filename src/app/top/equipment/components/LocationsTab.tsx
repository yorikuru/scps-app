"use client";

import React, { useState } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Wrench, Trash2, X, MapPin, Loader2 } from "lucide-react";
import { Location } from "../types";
import { useDialog } from "@/components/DialogContext"; // ★追加

type Props = {
  schoolId: string;
  locations: Location[];
  showToast: (type: "success"|"error", msg: string) => void;
};

export default function LocationsTab({ schoolId, locations, showToast }: Props) {
  const [modal, setModal] = useState<{show: boolean, data: Partial<Location>}>({ show: false, data: {} });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showConfirm } = useDialog(); // ★追加

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (modal.data.id) {
        await updateDoc(doc(db, "equipment_locations", modal.data.id), { ...modal.data });
      } else {
        await addDoc(collection(db, "equipment_locations"), { ...modal.data, schoolId });
      }
      showToast("success", "保管場所を保存しました");
      setModal({ show: false, data: {} });
    } catch (err) {
      showToast("error", "保存に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 削除の実行本体
  const executeDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "equipment_locations", id));
      showToast("success", "削除しました");
    } catch (err) {
      showToast("error", "削除に失敗しました");
    }
  };

  // ★ showConfirm に置き換え
  const handleDelete = (id: string) => {
    showConfirm(
      "この保管場所を削除しますか？\n紐づく備品の保管場所は未設定扱いになります。",
      () => executeDelete(id),
      "danger",
      "保管場所削除の確認"
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-black text-gray-900">保管場所管理</h2>
        <button onClick={() => setModal({show: true, data: {}})} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-700 flex items-center">
          <Plus className="w-4 h-4 mr-1" /> 新規保管場所
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {locations.map(l => (
          <div key={l.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-indigo-300 transition-colors">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-400"/>
              <span className="text-sm font-black text-gray-900">{l.name}</span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setModal({show: true, data: l})} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><Wrench className="w-4 h-4"/></button>
              <button onClick={() => handleDelete(l.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
            </div>
          </div>
        ))}
      </div>

      {modal.show && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-sm font-black text-gray-900">保管場所設定</h3>
              <button onClick={() => setModal({show:false, data:{}})} className="p-1"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">保管場所名</label>
                <input type="text" required value={modal.data.name||""} onChange={e=>setModal(p=>({show:true, data:{...p.data, name:e.target.value}}))} placeholder="例: 生徒会室 ロッカーA" className="w-full border rounded-xl px-3 py-2 text-sm font-bold"/>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl mt-4 flex justify-center items-center">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : "保存する"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}