"use client";

import React, { useState } from "react";
import { Search, ScanLine, Printer, Trash2, User as UserIcon, MapPin, Undo2, Edit, X, Loader2, FileText } from "lucide-react";
import { Rental } from "../types";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDialog } from "@/components/DialogContext";

// ★ 既存のRental型にメモ(note)を拡張
type ExtendedRental = Rental & { note?: string };

type Props = {
  rentals: ExtendedRental[];
  onOpenScanner: () => void;
  onOpenReturn: (r: Rental) => void;
  onPrint: (r: Rental) => void;
  onDeleteRental: (r: Rental) => void;
  showToast?: (type: "success" | "error" | "warning", msg: string) => void;
};

export default function RentalsTab({ rentals, onOpenScanner, onOpenReturn, onPrint, onDeleteRental, showToast }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("date_desc");

  const { showAlert, showConfirm } = useDialog();

  // ★ 閲覧・編集モーダル用のステート
  const [editModal, setEditModal] = useState<{show: boolean, data: Partial<ExtendedRental> | null}>({ show: false, data: null });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOverdue = (dateStr: string | null) => { 
    if (!dateStr) return false; 
    const end = new Date(dateStr); 
    end.setHours(23, 59, 59); 
    return end < new Date(); 
  };

  const filtered = rentals.filter(r => {
    if (statusFilter !== "all") {
      if (statusFilter === "active" && r.status === "returned") return false;
      if (statusFilter === "returned" && r.status !== "returned") return false;
    }
    if (search && !r.borrowerName.includes(search) && !r.purpose.includes(search) && !r.items?.some(i => i.equipmentName.includes(search))) return false;
    return true;
  }).sort((a, b) => {
    if (sortOrder === "date_desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortOrder === "date_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return 0;
  });

  // ★ 貸出情報の更新処理
  const handleUpdateRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal.data?.id) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "rentals", editModal.data.id), {
        borrowerName: editModal.data.borrowerName,
        location: editModal.data.location,
        purpose: editModal.data.purpose,
        startDate: editModal.data.startDate,
        endDate: editModal.data.endDate,
        note: editModal.data.note || "", // メモを保存
      });
      setEditModal({ show: false, data: null });
      if (showToast) showToast("success", "貸出情報を更新しました");
      else showAlert("貸出情報を更新しました");
    } catch (err) {
      console.error(err);
      if (showToast) showToast("error", "更新に失敗しました");
      else showAlert("更新に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="借受人・目的・備品名で検索..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
          </div>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="py-2 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none shadow-sm">
            <option value="all">全ステータス</option>
            <option value="active">貸出中・未返却あり</option>
            <option value="returned">返却済</option>
          </select>
          <select value={sortOrder} onChange={e=>setSortOrder(e.target.value)} className="py-2 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none shadow-sm">
            <option value="date_desc">貸出日が新しい順</option>
            <option value="date_asc">貸出日が古い順</option>
          </select>
        </div>
        <button onClick={onOpenScanner} className="w-full sm:w-auto px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-black flex items-center justify-center">
          <ScanLine className="w-4 h-4 mr-1.5" /> QRカメラで返却
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-[10px] font-black text-gray-500 uppercase border-b border-gray-200">
                <th className="p-3">貸出ID / 備品</th>
                <th className="p-3">借受人 / 目的</th>
                <th className="p-3">貸出期間</th>
                <th className="p-3 text-center">ステータス</th>
                <th className="p-3 text-right">アクション</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-xs font-bold text-gray-400">該当するデータがありません</td></tr>
              ) : (
                filtered.map(r => {
                  const overdue = (r.status === "active" || r.status === "partial") && isOverdue(r.endDate);
                  const itemsLength = (r.items || []).length;
                  const itemsNames = (r.items || []).map(i=>i.equipmentName).join(", ");
                  
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3">
                        <p className="text-[9px] font-bold text-gray-400 font-mono mb-1">{r.id.slice(-8).toUpperCase()}</p>
                        <p className="text-xs font-black text-gray-900">{itemsLength} 点の備品</p>
                        <p className="text-[10px] text-gray-500 truncate max-w-[150px]">{itemsNames || "（旧データ）"}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-[11px] font-bold text-gray-800 flex items-center gap-1"><UserIcon className="w-3 h-3 text-gray-400"/> {r.borrowerName}</p>
                        <p className="text-[10px] font-bold text-gray-500 truncate max-w-[150px]"><MapPin className="w-3 h-3 inline text-gray-400"/> {r.purpose} / {r.location}</p>
                        {/* ★ 追加: メモがある場合は一覧にも小さく表示 */}
                        {r.note && (
                          <p className="text-[9px] font-bold text-indigo-500 flex items-center gap-1 mt-1.5 truncate max-w-[150px]">
                            <FileText className="w-2.5 h-2.5 flex-shrink-0"/> {r.note}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-[10px] font-bold text-gray-600">
                        {r.startDate} 〜 <span className={overdue ? 'text-red-600 font-black' : ''}>{r.endDate}</span>
                      </td>
                      <td className="p-3 text-center">
                        {r.status === "returned" ? <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] font-bold">返却済</span> :
                          r.status === "partial" ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold">一部返却済</span> :
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>貸出中</span>}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* ★ 追加: 閲覧・編集ボタン */}
                          <button onClick={() => setEditModal({show: true, data: r})} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="詳細の確認・編集">
                            <Edit className="w-4 h-4" />
                          </button>
                          
                          <button onClick={() => onPrint(r as Rental)} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors" title="貸出票(PDF)を発行">
                            <Printer className="w-4 h-4" />
                          </button>
                          
                          {(r.status === "active" || r.status === "partial") && (
                            <button onClick={() => onOpenReturn(r as Rental)} className="px-3 py-1.5 bg-gray-900 text-white hover:bg-black rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-1 transition-colors">
                              <Undo2 className="w-3.5 h-3.5"/> 返却処理
                            </button>
                          )}
                          
                          <button onClick={() => onDeleteRental(r as Rental)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="データを削除">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ★ 貸出情報の確認・編集モーダル */}
      {editModal.show && editModal.data && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="text-sm font-black flex items-center text-gray-900">
                <Edit className="w-4 h-4 mr-1.5 text-indigo-600"/> 貸出内容の確認・編集
              </h3>
              <button type="button" onClick={() => setEditModal({show:false, data:null})} className="p-1 hover:bg-gray-200 rounded-lg transition-colors">
                <X className="w-5 h-5"/>
              </button>
            </div>
            
            <form onSubmit={handleUpdateRental} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto bg-white custom-scrollbar">
              
              {/* 貸出中の備品一覧 (閲覧専用) */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <span className="text-[10px] font-bold text-gray-500 block mb-1">貸出中の備品 ({editModal.data.items?.length || 0}点)</span>
                <ul className="text-xs font-bold text-gray-800 list-disc list-inside pl-2">
                  {(editModal.data.items || []).map(item => (
                    <li key={item.equipmentId}>
                      {item.equipmentName} <span className="text-[9px] text-gray-400 font-mono ml-1">({item.managementId})</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">借受人名 (代表) <span className="text-red-500">*</span></label>
                  <input type="text" required value={editModal.data.borrowerName || ""} onChange={e=>setEditModal(p=>({show:true, data:{...p.data!, borrowerName:e.target.value}}))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">使用場所 <span className="text-red-500">*</span></label>
                  <input type="text" required value={editModal.data.location || ""} onChange={e=>setEditModal(p=>({show:true, data:{...p.data!, location:e.target.value}}))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"/>
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">使用目的 <span className="text-red-500">*</span></label>
                <input type="text" required value={editModal.data.purpose || ""} onChange={e=>setEditModal(p=>({show:true, data:{...p.data!, purpose:e.target.value}}))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"/>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">貸出日 <span className="text-red-500">*</span></label>
                  <input type="date" required value={editModal.data.startDate || ""} onChange={e=>setEditModal(p=>({show:true, data:{...p.data!, startDate:e.target.value}}))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">返却予定日 <span className="text-red-500">*</span></label>
                  <input type="date" required value={editModal.data.endDate || ""} onChange={e=>setEditModal(p=>({show:true, data:{...p.data!, endDate:e.target.value}}))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"/>
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-indigo-600 mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> 管理者用メモ <span className="text-gray-400 font-normal ml-1">(貸出票には印字されません)</span>
                </label>
                <textarea value={editModal.data.note || ""} onChange={e=>setEditModal(p=>({show:true, data:{...p.data!, note:e.target.value}}))} rows={3} placeholder="例: 返却期限を1日延長の相談あり" className="w-full border border-indigo-100 bg-indigo-50/30 rounded-xl px-3 py-2 text-xs font-bold resize-none custom-scrollbar focus:ring-2 focus:ring-indigo-500 outline-none transition-all"/>
              </div>
              
              <div className="pt-3 flex justify-end gap-2 border-t border-gray-100">
                <button type="button" onClick={() => setEditModal({show:false, data:null})} className="px-5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl transition-colors">
                  キャンセル
                </button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center transition-colors">
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin"/>} 保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}