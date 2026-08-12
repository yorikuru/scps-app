"use client";

import React, { useState } from "react";
import { Tag, Plus, Trash2, Settings, Edit2, X, Check } from "lucide-react";
import { Category, AppConfig, COLOR_MAPPINGS } from "../types";

// 選べる色を大幅に拡張 (30色)
const CATEGORY_COLORS = [
  { label: "スレート", value: "bg-slate-100 text-slate-700 border-slate-200" },
  { label: "グレー", value: "bg-gray-100 text-gray-700 border-gray-200" },
  { label: "ジンク", value: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  { label: "ニュートラル", value: "bg-neutral-100 text-neutral-700 border-neutral-200" },
  { label: "ストーン", value: "bg-stone-100 text-stone-700 border-stone-200" },
  { label: "レッド", value: "bg-red-100 text-red-700 border-red-200" },
  { label: "オレンジ", value: "bg-orange-100 text-orange-700 border-orange-200" },
  { label: "アンバー", value: "bg-amber-100 text-amber-700 border-amber-200" },
  { label: "イエロー", value: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { label: "ライム", value: "bg-lime-100 text-lime-700 border-lime-200" },
  { label: "グリーン", value: "bg-green-100 text-green-700 border-green-200" },
  { label: "エメラルド", value: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { label: "ティール", value: "bg-teal-100 text-teal-700 border-teal-200" },
  { label: "シアン", value: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { label: "スカイ", value: "bg-sky-100 text-sky-700 border-sky-200" },
  { label: "ブルー", value: "bg-blue-100 text-blue-700 border-blue-200" },
  { label: "インディゴ", value: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { label: "バイオレット", value: "bg-violet-100 text-violet-700 border-violet-200" },
  { label: "パープル", value: "bg-purple-100 text-purple-700 border-purple-200" },
  { label: "フクシア", value: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200" },
  { label: "ピンク", value: "bg-pink-100 text-pink-700 border-pink-200" },
  { label: "ローズ", value: "bg-rose-100 text-rose-700 border-rose-200" },
  { label: "濃レッド", value: "bg-red-200 text-red-800 border-red-300" },
  { label: "濃オレンジ", value: "bg-orange-200 text-orange-800 border-orange-300" },
  { label: "濃グリーン", value: "bg-green-200 text-green-800 border-green-300" },
  { label: "濃ブルー", value: "bg-blue-200 text-blue-800 border-blue-300" },
  { label: "濃インディゴ", value: "bg-indigo-200 text-indigo-800 border-indigo-300" },
  { label: "濃パープル", value: "bg-purple-200 text-purple-800 border-purple-300" },
  { label: "濃ピンク", value: "bg-pink-200 text-pink-800 border-pink-300" },
  { label: "モノクロ", value: "bg-gray-800 text-white border-gray-900" },
];

type Props = {
  categories: Category[];
  appConfig: AppConfig;
  onAdd: (name: string, color: string) => Promise<void> | void;
  onEdit: (id: string, name: string, color: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void; 
};

export default function CategoryManager({ categories, appConfig, onAdd, onEdit, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState(CATEGORY_COLORS[0].value);
  const c = COLOR_MAPPINGS[appConfig.color] || COLOR_MAPPINGS.default;

  const handleSave = async () => {
    if (!categoryName.trim()) return;
    if (editingId) {
      await onEdit(editingId, categoryName, categoryColor);
      setEditingId(null);
    } else {
      await onAdd(categoryName, categoryColor);
    }
    setCategoryName("");
    setCategoryColor(CATEGORY_COLORS[0].value);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setCategoryName(cat.name);
    setCategoryColor(cat.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCategoryName("");
    setCategoryColor(CATEGORY_COLORS[0].value);
  };

  return (
    // ★ h-full と min-h-0 を指定して外にはみ出さないように設定
    <div className="max-w-3xl mx-auto w-full p-2 sm:p-6 flex-1 flex flex-col h-full min-h-0">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full min-h-0">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2 shrink-0">
          <Settings className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-black text-gray-900">カテゴリの管理</h2>
        </div>
        
        <div className="p-3 sm:p-6 flex flex-col gap-4 sm:gap-6 flex-1 overflow-y-auto custom-scrollbar">
          
          {/* カテゴリ追加・編集フォーム */}
          <div className={`bg-gray-50/50 p-3 sm:p-4 rounded-xl border shrink-0 ${editingId ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'}`}>
            <div className="flex justify-between items-center mb-3">
              <h4 className={`text-xs font-bold flex items-center ${editingId ? 'text-amber-800' : 'text-gray-700'}`}>
                {editingId ? <Edit2 className="w-3.5 h-3.5 mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />} 
                {editingId ? "カテゴリを編集" : "新しくカテゴリを追加"}
              </h4>
              {editingId && (
                <button onClick={cancelEdit} className="text-[10px] font-bold text-gray-500 hover:text-gray-700 flex items-center bg-white px-2 py-1 rounded border border-gray-200">
                  <X className="w-3 h-3 mr-0.5" /> キャンセル
                </button>
              )}
            </div>
            
            <div className="flex flex-col gap-3">
              {/* ★ ズーム防止：スマホ時は text-[16px] (text-base相当) を指定 */}
              <input type="text" value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="例: 文化祭関連" className={`w-full sm:max-w-sm text-[16px] sm:text-sm font-bold px-3 py-2 sm:py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 ${c.ring}`} />
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 bg-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl border border-gray-200 max-h-40 overflow-y-auto custom-scrollbar">
                {CATEGORY_COLORS.map(cc => (
                  <button key={cc.value} onClick={() => setCategoryColor(cc.value)} className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 transition-transform flex items-center justify-center ${categoryColor === cc.value ? 'scale-110 border-gray-900 shadow-sm' : 'border-transparent hover:scale-110'} ${cc.value.split(' ')[0]}`} title={cc.label}>
                    {categoryColor === cc.value && <Check className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${cc.value.includes('text-white') ? 'text-white' : 'text-gray-900'}`} />}
                  </button>
                ))}
              </div>
              <button onClick={handleSave} disabled={!categoryName.trim()} className={`px-5 py-2.5 mt-1 w-full sm:w-fit disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all flex items-center justify-center ${editingId ? 'bg-amber-600 hover:bg-amber-700' : `${c.bg} ${c.hover}`}`}>
                {editingId ? "更新する" : "追加する"}
              </button>
            </div>
          </div>

          {/* 登録済みカテゴリ一覧 */}
          <div className="flex-1 flex flex-col min-h-0">
            <h4 className="text-[10px] sm:text-xs font-bold text-gray-700 mb-2 sm:mb-3 flex items-center shrink-0"><Tag className="w-3.5 h-3.5 mr-1" /> 登録済みのカテゴリ</h4>
            <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1 pb-4">
              {categories.length === 0 ? (
                <div className="text-center py-8 sm:py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Tag className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300 mx-auto mb-2" />
                  <p className="text-[10px] sm:text-xs font-bold text-gray-400">カテゴリはまだありません</p>
                </div>
              ) : (
                categories.map(cat => (
                  <div key={cat.id} className={`flex justify-between items-center bg-white border p-2 sm:p-2.5 rounded-xl transition-shadow ${editingId === cat.id ? 'border-amber-400 shadow-sm bg-amber-50/10' : 'border-gray-200 hover:shadow-sm'}`}>
                    <span className={`px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-bold border truncate max-w-[200px] sm:max-w-none ${cat.color}`}>{cat.name}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(cat)} className="p-1.5 sm:p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors flex items-center">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDelete(cat.id)} className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}