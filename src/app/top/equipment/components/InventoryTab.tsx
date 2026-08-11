"use client";

import React, { useState } from "react";
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Plus, Trash2, CheckCircle2, ArrowRightLeft, MapPin, Layers, Wrench, FileText, X, ShieldBan, Unlock, AlertTriangle, Loader2, User as UserIcon } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Equipment, Category, Location, CONDITION_CONF, COLOR_THEMES } from "../types";

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

type ExtendedEquipment = Equipment & {
  isBanned?: boolean;
  banReason?: string;
  banUser?: string;
  bannedAt?: string;
};

type Props = {
  equipments: Equipment[];
  categories: Category[];
  locations: Location[];
  currentUserName: string; 
  onAddEquip: () => void;
  onEditEquip: (eq: Equipment) => void;
  onDeleteEquip: (eq: Equipment) => void;
  onBulkRental: (selectedIds: string[]) => void;
};

export default function InventoryTab({ equipments, categories, locations, currentUserName, onAddEquip, onEditEquip, onDeleteEquip, onBulkRental }: Props) {
  const [invSearch, setInvSearch] = useState("");
  const [invCategory, setInvCategory] = useState("all");
  const [invLocation, setInvLocation] = useState("all");
  // ★ デフォルトのソート順を「管理ID順（management_asc）」に変更
  const [invSort, setInvSort] = useState("management_asc");
  
  const [viewTab, setViewTab] = useState<"all" | "available" | "rented" | "banned">("all");
  const [selectedEqIds, setSelectedEqIds] = useState<string[]>([]);

  const [banModal, setBanModal] = useState<{ show: boolean, targetIds: string[] }>({ show: false, targetIds: [] });
  const [banForm, setBanForm] = useState({ reason: "" }); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [customAlert, setCustomAlert] = useState<{show: boolean, message: string, type: "warning" | "success" | "danger" | "confirm", onConfirm?: ()=>void}>({show: false, message: "", type: "warning"});

  const showAlert = (message: string, type: "warning" | "success" | "danger") => setCustomAlert({ show: true, message, type });
  const showConfirm = (message: string, onConfirm: ()=>void) => setCustomAlert({ show: true, message, type: "confirm", onConfirm });

  const extEquipments = equipments as ExtendedEquipment[];
  const filteredEqs = extEquipments.filter(e => {
    const isBanned = !!e.isBanned;
    if (viewTab === "available" && (e.status !== "available" || isBanned)) return false;
    if (viewTab === "rented" && (e.status !== "rented" || isBanned)) return false;
    if (viewTab === "banned" && !isBanned) return false;
    
    if (invCategory !== "all" && e.categoryId !== invCategory) return false;
    if (invLocation !== "all" && e.locationId !== invLocation) return false;
    if (invSearch && !e.name.includes(invSearch) && !e.managementId.includes(invSearch)) return false;
    return true;
  }).sort((a, b) => {
    // ★ 管理ID順のソート処理を追加
    if (invSort === "management_asc") return (a.managementId || "").localeCompare(b.managementId || "");
    if (invSort === "acquired_desc") return new Date(b.acquiredAt || b.createdAt).getTime() - new Date(a.acquiredAt || a.createdAt).getTime();
    if (invSort === "name_asc") return a.name.localeCompare(b.name);
    return 0;
  });

  const handleToggleCheck = (id: string) => setSelectedEqIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const handleToggleAll = (e: React.ChangeEvent<HTMLInputElement>) => setSelectedEqIds(e.target.checked ? filteredEqs.map(eq => eq.id) : []);

  const handleBulkRentalClick = () => {
    const invalidEqs = extEquipments.filter(e => selectedEqIds.includes(e.id) && (e.status !== "available" || e.isBanned));
    if (invalidEqs.length > 0) {
      showAlert("選択された備品の中に、現在貸出中のものや貸出禁止のものが含まれています。\n貸出可能な備品のみを選択して再度お試しください。", "warning");
      return;
    }
    onBulkRental(selectedEqIds);
    setSelectedEqIds([]);
  };

  const executeBan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      banModal.targetIds.forEach(id => {
        batch.update(doc(db, "equipments", id), {
          isBanned: true,
          banReason: banForm.reason,
          banUser: currentUserName, 
          bannedAt: new Date().toISOString()
        });
      });
      await batch.commit();
      setBanModal({ show: false, targetIds: [] });
      setSelectedEqIds([]);
      setBanForm({ reason: "" });
      showAlert("選択した備品を貸出禁止リストに登録しました。", "success");
    } catch (err) {
      showAlert("貸出禁止の登録に失敗しました。", "danger");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnban = (id: string) => {
    showConfirm("この備品の貸出禁止を解除し、元の状態に戻しますか？", async () => {
      try {
        await updateDoc(doc(db, "equipments", id), {
          isBanned: false,
          banReason: null,
          banUser: null,
          bannedAt: null
        });
        showAlert("貸出禁止を解除しました。", "success");
      } catch(e) {
        showAlert("解除に失敗しました。", "danger");
      }
    });
  };

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      
      <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-3">
        <div className="flex border-b border-gray-100 overflow-x-auto custom-scrollbar">
          {[
            { id: "all", label: "すべての備品" },
            { id: "available", label: "貸出可能" },
            { id: "rented", label: "貸出中" },
            { id: "banned", label: "貸出禁止リスト" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setViewTab(tab.id as any); setSelectedEqIds([]); }}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${viewTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              {tab.label}
              {tab.id === "banned" && <ShieldBan className="w-3 h-3 inline ml-1.5 -mt-0.5"/>}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="名前・IDで検索..." value={invSearch} onChange={e => setInvSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={invCategory} onChange={e=>setInvCategory(e.target.value)} className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none">
            <option value="all">全カテゴリ</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={invLocation} onChange={e=>setInvLocation(e.target.value)} className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none">
            <option value="all">全保管場所</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={invSort} onChange={e=>setInvSort(e.target.value)} className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none">
            {/* ★ ソートオプションの追加 */}
            <option value="management_asc">管理ID順</option>
            <option value="acquired_desc">取得日（新しい順）</option>
            <option value="name_asc">名前順</option>
          </select>
          <button onClick={onAddEquip} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-700 ml-auto flex items-center">
            <Plus className="w-4 h-4 mr-1" /> 新規登録
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                <th className="p-3 w-10 text-center">
                  <input type="checkbox" checked={selectedEqIds.length === filteredEqs.length && filteredEqs.length > 0} onChange={handleToggleAll} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" />
                </th>
                <th className="p-3">管理ID</th>
                <th className="p-3">備品名・付属品</th>
                <th className="p-3">カテゴリ</th>
                <th className="p-3">保管場所</th>
                <th className="p-3">状態</th>
                <th className="p-3">ステータス</th>
                <th className="p-3 text-right">アクション</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEqs.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-xs font-bold text-gray-400">該当する備品が見つかりません</td></tr>
              ) : (
                filteredEqs.map(eq => {
                  const cat = categories.find(c => c.id === eq.categoryId);
                  const loc = locations.find(l => l.id === eq.locationId);
                  const theme = cat ? (COLOR_THEMES[cat.color] || COLOR_THEMES.slate) : null;
                  const isSelected = selectedEqIds.includes(eq.id);
                  const isBanned = !!eq.isBanned;

                  return (
                    <tr key={eq.id} className={`transition-colors ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-gray-50'} ${isBanned ? 'bg-red-50/20' : ''}`}>
                      <td className="p-3 text-center">
                        <input type="checkbox" checked={isSelected} onChange={() => handleToggleCheck(eq.id)} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" disabled={!isBanned && eq.status !== "available"} />
                      </td>
                      <td className="p-3"><p className="text-[10px] font-mono font-bold text-gray-500">{eq.managementId}</p></td>
                      <td className="p-3">
                        <p className={`text-sm font-black ${isBanned ? 'text-gray-500' : 'text-gray-900'}`}>{eq.name}</p>
                        {(eq.accessories?.length ?? 0) > 0 && (
                          <p className="text-[9px] font-bold text-gray-400 flex items-center gap-1 mt-0.5">
                            <Layers className="w-3 h-3"/> 付属品 {eq.accessories.length}点
                          </p>
                        )}
                      </td>
                      <td className="p-3">
                        {cat && theme ? (
                          <span className={`px-2 py-0.5 ${theme.lightBg} ${theme.text} rounded text-[10px] font-bold inline-flex items-center gap-1`}>
                            <DynamicIcon name={cat.icon} className="w-3 h-3"/>{cat.name}
                          </span>
                        ) : <span className="text-[10px] text-gray-400 font-bold">未設定</span>}
                      </td>
                      <td className="p-3">
                        <p className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400"/> {loc?.name || "未設定"}
                        </p>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${CONDITION_CONF[eq.condition]?.color || ''}`}>{CONDITION_CONF[eq.condition]?.label}</span>
                        {eq.conditionNote && <p className="text-[9px] font-bold text-red-600 mt-1 flex items-start gap-1"><Wrench className="w-3 h-3 flex-shrink-0"/> {eq.conditionNote}</p>}
                      </td>
                      <td className="p-3">
                        {isBanned ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold flex items-center gap-1"><ShieldBan className="w-3 h-3"/> 貸出禁止</span>
                            <span className="text-[9px] font-bold text-red-600 max-w-[120px] truncate" title={`登録者: ${eq.banUser} / 理由: ${eq.banReason}`}>
                              {eq.banUser} : {eq.banReason}
                            </span>
                          </div>
                        ) : eq.status === "available" ? (
                          <span className="text-emerald-600 text-[11px] font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/> 貸出可能</span>
                        ) : (
                          <span className="text-blue-600 text-[11px] font-bold flex items-center gap-1"><ArrowRightLeft className="w-3.5 h-3.5"/> 貸出中</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isBanned ? (
                            <button onClick={() => handleUnban(eq.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="貸出禁止を解除"><Unlock className="w-4 h-4" /></button>
                          ) : (
                            <>
                              {eq.status === "available" && (
                                <>
                                  <button onClick={() => onBulkRental([eq.id])} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="貸出登録"><ArrowRightLeft className="w-4 h-4" /></button>
                                  <button onClick={() => setBanModal({ show: true, targetIds: [eq.id] })} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="貸出禁止にする"><ShieldBan className="w-4 h-4" /></button>
                                </>
                              )}
                            </>
                          )}
                          <button onClick={() => onEditEquip(eq)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="詳細・編集"><FileText className="w-4 h-4" /></button>
                          <button onClick={() => onDeleteEquip(eq)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="削除"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* フローティングアクションバー */}
      {selectedEqIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4">
            <span className="text-xs font-bold">{selectedEqIds.length} 点を選択中</span>
            
            <button onClick={handleBulkRentalClick} className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 rounded-full text-xs font-black transition-colors flex items-center">
              一括貸出 <ArrowRightLeft className="w-3.5 h-3.5 ml-1.5" />
            </button>

            <button onClick={() => setBanModal({ show: true, targetIds: selectedEqIds })} className="px-4 py-1.5 bg-red-500 hover:bg-red-600 rounded-full text-xs font-black transition-colors flex items-center">
              貸出禁止にする <ShieldBan className="w-3.5 h-3.5 ml-1.5" />
            </button>

            <button onClick={() => setSelectedEqIds([])} className="p-1 text-gray-400 hover:text-white" title="選択解除"><X className="w-4 h-4"/></button>
          </div>
        </div>
      )}

      {/* 貸出禁止登録用モーダル */}
      {banModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-red-50 flex justify-between items-center">
              <h3 className="text-sm font-black text-red-900 flex items-center"><ShieldBan className="w-4 h-4 mr-1.5"/> 貸出禁止リストに登録</h3>
              <button onClick={() => setBanModal({show:false, targetIds:[]})} className="p-1 hover:bg-red-100 rounded-lg text-red-900"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={executeBan} className="p-5 space-y-4">
              <div className="p-3 bg-white border border-gray-200 rounded-xl mb-4 max-h-24 overflow-y-auto">
                <span className="text-[10px] font-bold text-gray-500 block mb-1">対象 ({banModal.targetIds.length}点)</span>
                <ul className="text-xs font-bold text-gray-800 list-disc list-inside pl-2">
                  {banModal.targetIds.map(id => <li key={id} className="truncate">{equipments.find(e=>e.id===id)?.name}</li>)}
                </ul>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">禁止登録者名</label>
                <div className="w-full border border-gray-200 bg-gray-100 rounded-xl px-3 py-2 text-sm font-bold text-gray-600 flex items-center gap-2">
                  <UserIcon className="w-4 h-4" /> {currentUserName}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">禁止の理由 (不具合など) <span className="text-red-500">*</span></label>
                <textarea required rows={3} placeholder="例: マイクの電源が入らないため修理中" value={banForm.reason} onChange={e=>setBanForm(p=>({...p, reason: e.target.value}))} className="w-full border rounded-xl px-3 py-2 text-sm font-bold resize-none custom-scrollbar focus:ring-2 focus:ring-red-500 outline-none"/>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full py-2 bg-red-600 text-white text-xs font-bold rounded-xl mt-4 flex justify-center items-center shadow-sm hover:bg-red-700">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : "禁止リストに登録"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* カスタムUIアラート */}
      {customAlert.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className={`p-4 border-b ${customAlert.type === 'success' ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
              <h3 className={`text-sm font-black flex items-center ${customAlert.type === 'success' ? 'text-green-800' : 'text-amber-800'}`}>
                {customAlert.type === 'success' ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />} 
                {customAlert.type === 'confirm' ? '確認' : 'お知らせ'}
              </h3>
            </div>
            <div className="p-5 text-xs font-bold text-gray-700 leading-relaxed whitespace-pre-wrap">{customAlert.message}</div>
            <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              {customAlert.type === 'confirm' ? (
                <>
                  <button onClick={() => setCustomAlert(p=>({...p, show:false}))} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50">キャンセル</button>
                  <button onClick={() => { customAlert.onConfirm?.(); setCustomAlert(p=>({...p, show:false})); }} className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-amber-700">実行する</button>
                </>
              ) : (
                <button onClick={() => setCustomAlert(p=>({...p, show:false}))} className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-black">閉じる</button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}