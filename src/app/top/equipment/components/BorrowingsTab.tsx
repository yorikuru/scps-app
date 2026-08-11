"use client";

import React, { useState } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Trash2, Calendar as CalendarIcon, ArrowDownToLine, X, Loader2, Wrench } from "lucide-react";
import { Borrowing } from "../types";
import { useDialog } from "@/components/DialogContext"; // ★追加

type Props = {
  schoolId: string;
  borrowings: Borrowing[];
  showToast: (type: "success"|"error", msg: string) => void;
};

export default function BorrowingsTab({ schoolId, borrowings, showToast }: Props) {
  const [modal, setModal] = useState<{show: boolean, data: Partial<Borrowing>}>({ show: false, data: {} });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showConfirm } = useDialog(); // ★追加

  const isOverdue = (dateStr: string) => { const end = new Date(dateStr); end.setHours(23, 59, 59); return end < new Date(); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (modal.data.id) {
        await updateDoc(doc(db, "borrowings", modal.data.id), { ...modal.data });
      } else {
        await addDoc(collection(db, "borrowings"), { ...modal.data, status: "active", schoolId, createdAt: serverTimestamp() });
      }
      showToast("success", "借入データを保存しました");
      setModal({ show: false, data: {} });
    } catch (err) {
      showToast("error", "保存に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 返却処理の実行本体
  const executeReturn = async (id: string) => {
    await updateDoc(doc(db, "borrowings", id), { status: "returned" });
    showToast("success", "返却処理を完了しました");
  };

  const handleReturn = (id: string) => {
    showConfirm(
      "この借入を「返却済」にしますか？",
      () => executeReturn(id),
      "warning",
      "返却確認"
    );
  };

  // 削除処理の実行本体
  const executeDelete = async (id: string) => {
    await deleteDoc(doc(db, "borrowings", id));
    showToast("success", "削除しました");
  };

  const handleDelete = (id: string) => {
    showConfirm(
      "この借入データを削除しますか？",
      () => executeDelete(id),
      "danger",
      "削除確認"
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-black text-gray-900">外部からの借入管理</h2>
        <button onClick={() => setModal({show: true, data: {}})} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-700 flex items-center">
          <Plus className="w-4 h-4 mr-1" /> 新規借入を登録
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {borrowings.map(b => {
          const overdue = b.status === "active" && isOverdue(b.dueDate);
          return (
            <div key={b.id} className={`bg-white rounded-2xl border shadow-sm p-4 flex flex-col group ${overdue ? 'border-red-300 bg-red-50/10' : 'border-gray-200 hover:border-indigo-300'}`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-gray-500">借入先: {b.owner}</span>
                <div className="flex items-center gap-2">
                  {b.status === "active" ? (
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>借入中</span>
                  ) : (<span className="px-2 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-500">返却済</span>)}
                </div>
              </div>
              <h3 className="text-sm font-black text-gray-900 mb-2">{b.name}</h3>
              <p className="text-[10px] font-bold text-gray-600 flex items-center gap-1 mb-4">
                <CalendarIcon className="w-3.5 h-3.5"/> 期限: <span className={overdue ? 'text-red-600 font-black' : ''}>{b.dueDate}</span>
              </p>
              
              <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setModal({show: true, data: b})} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><Wrench className="w-4 h-4"/></button>
                  <button onClick={() => handleDelete(b.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                </div>
                {b.status === "active" && (
                  <button onClick={() => handleReturn(b.id)} className="px-4 py-1.5 bg-gray-900 hover:bg-black text-white rounded-xl text-[10px] font-bold shadow-sm">返却完了にする</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {modal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-amber-50/50">
              <h3 className="text-sm font-black text-amber-900 flex items-center"><ArrowDownToLine className="w-4 h-4 mr-1.5 text-amber-600"/> 借入登録</h3>
              <button onClick={() => setModal({show:false, data:{}})} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div><label className="block text-[10px] font-bold text-gray-500 mb-1">借りたモノ</label><input type="text" required value={modal.data.name||""} onChange={e=>setModal(p=>({show:true, data:{...p.data, name:e.target.value}}))} className="w-full border rounded-xl px-3 py-2 text-sm font-bold"/></div>
              <div><label className="block text-[10px] font-bold text-gray-500 mb-1">借入元 (誰から)</label><input type="text" required value={modal.data.owner||""} onChange={e=>setModal(p=>({show:true, data:{...p.data, owner:e.target.value}}))} className="w-full border rounded-xl px-3 py-2 text-sm font-bold"/></div>
              <div><label className="block text-[10px] font-bold text-gray-500 mb-1">返却期限</label><input type="date" required value={modal.data.dueDate||""} onChange={e=>setModal(p=>({show:true, data:{...p.data, dueDate:e.target.value}}))} className="w-full border rounded-xl px-3 py-2 text-sm font-bold"/></div>
              <div><label className="block text-[10px] font-bold text-gray-500 mb-1">メモ</label><textarea value={modal.data.note||""} onChange={e=>setModal(p=>({show:true, data:{...p.data, note:e.target.value}}))} className="w-full border rounded-xl px-3 py-2 text-sm font-bold resize-none"/></div>
              <button type="submit" disabled={isSubmitting} className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl mt-4 flex justify-center items-center">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : "保存する"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}