"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Plus, Trash2, X, CircleDot, CheckSquare, ListOrdered, UploadCloud, Calendar, Clock, ArrowUp, ArrowDown, Star } from "lucide-react";
import { SurveySettings, Question, QuestionType, UserData } from "../types";
import SurveySettingsEditor from "./SurveySettingsEditor";
import Link from "next/link";
import CustomSelect from "@/components/CustomSelect"; // ★ CustomSelectを追加

type Props = {
  formTitle: string; setFormTitle: (v: string) => void;
  formDescription: string; setFormDescription: (v: string) => void;
  questions: Question[]; setQuestions: (v: Question[]) => void;
  settings: SurveySettings; setSettings: React.Dispatch<React.SetStateAction<SurveySettings>>;
  tenantUsers: UserData[];
  surveyId: string | null;
  responsesCount: number;
};

export default function SurveyBuilder({
  formTitle, setFormTitle, formDescription, setFormDescription,
  questions, setQuestions, settings, setSettings, tenantUsers, surveyId, responsesCount
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [activeTab, setActiveTab] = useState<"questions" | "settings">("questions");

  useEffect(() => {
    const editTab = searchParams.get("editTab") as "questions" | "settings";
    if (editTab && ["questions", "settings"].includes(editTab)) {
      setActiveTab(editTab);
    } else {
      setActiveTab("questions");
    }
  }, [searchParams]);

  const handleTabChange = (tab: "questions" | "settings") => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("editTab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const handleAddQuestion = (type: QuestionType = "radio") => {
    setQuestions([...questions, { 
      id: generateId(), type, title: "", options: ["選択肢 1"], required: false, 
      points: settings.isQuiz ? settings.defaultPoints : 0, correctAnswers: [],
      gridRows: ["行 1"], gridCols: ["列 1"], scaleMin: 1, scaleMax: 5, ratingMax: 5, ratingIcon: "star",
      checkboxConstraintType: "none", checkboxConstraintCount: 1, quizScoringType: "all_match"
    }]);
  };

  const handleUpdateQuestion = (qId: string, field: keyof Question, value: any) => {
    setQuestions(questions.map(q => q.id === qId ? { ...q, [field]: value } : q));
  };

  const handleDeleteQuestion = (qId: string) => setQuestions(questions.filter(q => q.id !== qId));

  const handleMoveQuestion = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === questions.length - 1) return;
    
    const newQuestions = [...questions];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const temp = newQuestions[index];
    newQuestions[index] = newQuestions[targetIndex];
    newQuestions[targetIndex] = temp;
    setQuestions(newQuestions);
  };

  const updateArray = (qId: string, field: "options" | "gridRows" | "gridCols", index: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const arr = [...(q[field] || [])];
        arr[index] = value;
        return { ...q, [field]: arr };
      }
      return q;
    }));
  };

  const addToArray = (qId: string, field: "options" | "gridRows" | "gridCols", defaultText: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const arr = [...(q[field] || [])];
        arr.push(`${defaultText} ${arr.length + 1}`);
        return { ...q, [field]: arr };
      }
      return q;
    }));
  };

  const deleteFromArray = (qId: string, field: "options" | "gridRows" | "gridCols", index: number) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        let arr = (q[field] || []).filter((_, i) => i !== index);
        if (arr.length === 0) arr = ["項目 1"];
        return { ...q, [field]: arr };
      }
      return q;
    }));
  };

  return (
    <div className="max-w-4xl mx-auto font-sans">
      
      <div className="flex justify-center mb-6 sm:mb-8 px-2">
        <div className="bg-white rounded-full p-1 shadow-sm border border-gray-200 flex items-center w-full sm:w-auto overflow-x-auto custom-scrollbar">
          <button onClick={() => handleTabChange("questions")} className={`flex-1 sm:flex-none px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${activeTab === "questions" ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}>質問</button>
          
          {surveyId ? (
            <Link href={`/top/surveys/${surveyId}/responses?tab=summary`} className="flex-1 sm:flex-none px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center whitespace-nowrap">
              結果 <span className="ml-1.5 bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px]">{responsesCount}</span>
            </Link>
          ) : (
            <div className="flex-1 sm:flex-none px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold text-gray-300 opacity-50 cursor-not-allowed text-center whitespace-nowrap">結果</div>
          )}

          <button onClick={() => handleTabChange("settings")} className={`flex-1 sm:flex-none px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${activeTab === "settings" ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}>設定</button>
        </div>
      </div>

      {activeTab === "questions" && (
        <div className="space-y-4 sm:space-y-6 animate-fade-in pb-20 px-2 sm:px-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 border-t-8 border-t-purple-600 p-4 sm:p-6 lg:p-8">
            <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="無題のフォーム" className="w-full text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-purple-600 focus:ring-0 px-0 py-1 sm:py-2 mb-2 sm:mb-4 bg-transparent outline-none" />
            <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="フォームの説明" rows={2} className="w-full text-xs sm:text-sm text-gray-700 border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-purple-600 focus:ring-0 px-0 py-1 sm:py-2 bg-transparent resize-y outline-none" />
          </div>

          {questions.map((q, index) => {
            const isStructure = q.type === "section" || q.type === "description";

            return (
              <div key={q.id} className={`bg-white rounded-xl shadow-sm border border-gray-200 relative group ${isStructure ? 'border-l-4 sm:border-l-8 border-l-blue-500' : ''}`}>
                
                <div className="absolute top-1/2 -right-3 sm:-left-12 -translate-y-1/2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-10 shadow-sm sm:shadow-none bg-white sm:bg-transparent rounded-full border border-gray-200 sm:border-none p-0.5 sm:p-0">
                  <button type="button" onClick={() => handleMoveQuestion(index, "up")} disabled={index === 0} className="p-1 sm:p-1.5 bg-white border border-transparent sm:border-gray-200 rounded-full text-gray-400 hover:text-purple-600 disabled:opacity-30 sm:shadow-sm"><ArrowUp className="w-3.5 h-3.5 sm:w-4 sm:h-4"/></button>
                  <button type="button" onClick={() => handleMoveQuestion(index, "down")} disabled={index === questions.length - 1} className="p-1 sm:p-1.5 bg-white border border-transparent sm:border-gray-200 rounded-full text-gray-400 hover:text-purple-600 disabled:opacity-30 sm:shadow-sm"><ArrowDown className="w-3.5 h-3.5 sm:w-4 sm:h-4"/></button>
                </div>

                <div className="p-4 sm:p-6 lg:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 mb-4">
                    <div className="flex-1 space-y-2 w-full">
                      <input type="text" value={q.title} onChange={e => handleUpdateQuestion(q.id, "title", e.target.value)} placeholder={q.type === "section" ? "セクションタイトル" : "質問タイトル"} className="w-full text-sm sm:text-base font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 sm:px-4 sm:py-3 outline-none focus:bg-white focus:ring-2 focus:ring-purple-200" />
                      <input type="text" value={q.description || ""} onChange={e => handleUpdateQuestion(q.id, "description", e.target.value)} placeholder="説明（サブテキスト・任意）" className="w-full text-[10px] sm:text-xs text-gray-600 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-500 px-1 py-1.5 outline-none" />
                    </div>
                    
                    <div className="w-full sm:w-48 shrink-0">
                      {/* ★ CustomSelect に置き換え (階層化リストをフラット化) */}
                      <CustomSelect 
                        value={q.type} 
                        onChange={(val) => handleUpdateQuestion(q.id, "type", val as QuestionType)}
                        options={[
                          { value: "disabled_txt", label: "--- テキスト ---" },
                          { value: "text", label: "  記述式 (単行)" },
                          { value: "textarea", label: "  段落 (複数行)" },
                          { value: "disabled_sel", label: "--- 選択式 ---" },
                          { value: "radio", label: "  ラジオボタン" },
                          { value: "checkbox", label: "  チェックボックス" },
                          { value: "select", label: "  プルダウン" },
                          { value: "disabled_adv", label: "--- 高度 ---" },
                          { value: "file", label: "  ファイルアップロード" },
                          { value: "scale", label: "  均等目盛り" },
                          { value: "rating", label: "  評価 (スター)" },
                          { value: "ranking", label: "  ランキング" },
                          { value: "grid_radio", label: "  グリッド (選択式)" },
                          { value: "grid_checkbox", label: "  グリッド (チェック)" },
                          { value: "disabled_dt", label: "--- 日時 ---" },
                          { value: "date", label: "  日付" },
                          { value: "time", label: "  時刻" },
                          { value: "disabled_str", label: "--- 構造 ---" },
                          { value: "section", label: "  セクション（ページ分割）" },
                          { value: "description", label: "  説明のみ追加" }
                        ].filter(opt => {
                          // select自体のonChangeで disabled_ で始まるものは無視する仕組みが必要ですが、
                          // 現行のCustomSelectの仕様に合わせるため、値の判定はCustomSelect側か呼び出し側で行います。
                          return true;
                        })}
                        buttonClassName="w-full bg-white border border-gray-300 text-gray-700 text-xs sm:text-sm rounded-lg px-3 py-2.5 sm:py-3 font-bold outline-none shadow-sm flex items-center justify-between"
                      />
                    </div>
                  </div>

                  {!isStructure && (
                    <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6 pl-1 sm:pl-2 border-l-2 border-gray-100">
                      {["radio", "checkbox", "select", "ranking"].includes(q.type) && (
                        <div className="space-y-1.5 sm:space-y-2">
                          {q.options.map((opt, optIndex) => (
                            <div key={optIndex} className="flex items-center group/opt">
                              <div className="flex-shrink-0 text-gray-400 mr-2 sm:mr-3">{q.type === "radio" ? <CircleDot className="w-3.5 h-3.5 sm:w-4 sm:h-4"/> : q.type === "checkbox" ? <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4"/> : <ListOrdered className="w-3.5 h-3.5 sm:w-4 sm:h-4"/>}</div>
                              <input type="text" value={opt} onChange={e => updateArray(q.id, "options", optIndex, e.target.value)} placeholder={`選択肢 ${optIndex + 1}`} className="flex-1 bg-transparent border-b border-gray-200 hover:border-gray-400 focus:border-purple-500 outline-none px-0 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-gray-900" />
                              <button onClick={() => deleteFromArray(q.id, "options", optIndex)} className="ml-1.5 sm:ml-2 text-gray-300 hover:text-red-500 p-1"><X className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                            </div>
                          ))}
                          <button onClick={() => addToArray(q.id, "options", "選択肢")} className="text-[11px] sm:text-sm font-bold text-gray-500 hover:text-purple-600 pt-1.5 flex items-center gap-1"><Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4"/> 選択肢を追加</button>
                        </div>
                      )}

                      {q.type === "checkbox" && (
                        <div className="mt-3 pt-3 sm:mt-4 sm:pt-4 border-t border-gray-100">
                          <label className="text-[10px] sm:text-xs font-bold text-gray-700 mb-1.5 sm:mb-2 block">回答の制限</label>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <div className="w-full sm:w-auto min-w-[200px]">
                              <CustomSelect
                                value={q.checkboxConstraintType || "none"}
                                onChange={val => handleUpdateQuestion(q.id, "checkboxConstraintType", val)}
                                options={[
                                  { value: "none", label: "制限しない" },
                                  { value: "exact", label: "選択する個数を指定 (ピッタリ)" },
                                  { value: "min", label: "選択する最低個数を指定 (以上)" },
                                  { value: "max", label: "選択する最大個数を指定 (以下)" }
                                ]}
                                buttonClassName="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 sm:py-2 text-[10px] sm:text-xs outline-none bg-white shadow-2xs font-bold flex items-center justify-between"
                              />
                            </div>
                            {(q.checkboxConstraintType && q.checkboxConstraintType !== "none") && (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="1"
                                  max={Math.max(1, q.options.length - 1)}
                                  value={q.checkboxConstraintCount || 1}
                                  onChange={e => {
                                    const val = Math.min(Math.max(1, Number(e.target.value)), Math.max(1, q.options.length - 1));
                                    handleUpdateQuestion(q.id, "checkboxConstraintCount", val);
                                  }}
                                  className="w-16 sm:w-20 border border-gray-300 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-sm outline-none font-bold text-center"
                                />
                                <span className="text-[10px] sm:text-xs text-gray-500 font-bold">個</span>
                              </div>
                            )}
                          </div>
                          {(q.checkboxConstraintType && q.checkboxConstraintType !== "none") && (
                            <p className="text-[9px] sm:text-[10px] text-gray-400 mt-1 sm:mt-1.5">※ 指定できる数は「1」以上「選択肢の数未満（{Math.max(1, q.options.length - 1)}）」までです。</p>
                          )}
                        </div>
                      )}

                      {q.type === "scale" && (
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-2">
                            <CustomSelect 
                              value={String(q.scaleMin || 1)} onChange={val => handleUpdateQuestion(q.id, "scaleMin", Number(val))}
                              options={[{ value: "0", label: "0" }, { value: "1", label: "1" }]}
                              buttonClassName="border border-gray-300 rounded bg-white px-2 py-1 text-[10px] sm:text-xs font-bold outline-none flex items-center justify-between min-w-[50px]"
                            />
                            <span className="text-[10px] sm:text-xs font-bold text-gray-600">〜</span>
                            <CustomSelect 
                              value={String(q.scaleMax || 5)} onChange={val => handleUpdateQuestion(q.id, "scaleMax", Number(val))}
                              options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }, { value: "5", label: "5" }, { value: "10", label: "10" }]}
                              buttonClassName="border border-gray-300 rounded bg-white px-2 py-1 text-[10px] sm:text-xs font-bold outline-none flex items-center justify-between min-w-[50px]"
                            />
                          </div>
                          <div className="flex-1 space-y-1.5 sm:space-y-2 w-full mt-2 sm:mt-0">
                            <input type="text" value={q.scaleMinLabel || ""} onChange={e => handleUpdateQuestion(q.id, "scaleMinLabel", e.target.value)} placeholder="下限のラベル (任意)" className="w-full text-[10px] sm:text-xs font-bold border-b border-gray-300 outline-none p-1 bg-transparent focus:border-purple-500" />
                            <input type="text" value={q.scaleMaxLabel || ""} onChange={e => handleUpdateQuestion(q.id, "scaleMaxLabel", e.target.value)} placeholder="上限のラベル (任意)" className="w-full text-[10px] sm:text-xs font-bold border-b border-gray-300 outline-none p-1 bg-transparent focus:border-purple-500" />
                          </div>
                        </div>
                      )}

                      {q.type === "rating" && (
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] sm:text-xs font-bold text-gray-600">最大値:</label>
                            <CustomSelect 
                              value={String(q.ratingMax || 5)} onChange={val => handleUpdateQuestion(q.id, "ratingMax", Number(val))}
                              options={[{ value: "3", label: "3" }, { value: "5", label: "5" }, { value: "10", label: "10" }]}
                              buttonClassName="border border-gray-300 rounded bg-white px-2 py-1 text-[10px] sm:text-xs font-bold outline-none flex items-center justify-between min-w-[50px]"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] sm:text-xs font-bold text-gray-600">アイコン:</label>
                            <CustomSelect 
                              value={q.ratingIcon || "star"} onChange={val => handleUpdateQuestion(q.id, "ratingIcon", val)}
                              options={[{ value: "star", label: "★ スター" }, { value: "heart", label: "♥ ハート" }, { value: "thumb", label: "👍 いいね" }]}
                              buttonClassName="border border-gray-300 rounded bg-white px-2 py-1 text-[10px] sm:text-xs font-bold outline-none flex items-center justify-between min-w-[90px]"
                            />
                          </div>
                        </div>
                      )}

                      {(q.type === "grid_radio" || q.type === "grid_checkbox") && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
                          <div>
                            <h4 className="text-[11px] sm:text-xs font-black text-gray-700 mb-1.5 sm:mb-2">行 (Rows)</h4>
                            {(q.gridRows || []).map((row, i) => (
                              <div key={i} className="flex items-center mb-1"><input type="text" value={row} onChange={e => updateArray(q.id, "gridRows", i, e.target.value)} className="flex-1 border-b border-gray-300 bg-transparent text-[11px] sm:text-xs font-bold p-1 outline-none focus:border-purple-500" /><button onClick={() => deleteFromArray(q.id, "gridRows", i)} className="text-gray-400 hover:text-red-500 p-1"><X className="w-3 h-3 sm:w-3.5 sm:h-3.5"/></button></div>
                            ))}
                            <button onClick={() => addToArray(q.id, "gridRows", "行")} className="text-[10px] font-bold text-blue-600 mt-1">行を追加</button>
                          </div>
                          <div>
                            <h4 className="text-[11px] sm:text-xs font-black text-gray-700 mb-1.5 sm:mb-2">列 (Cols)</h4>
                            {(q.gridCols || []).map((col, i) => (
                              <div key={i} className="flex items-center mb-1"><input type="text" value={col} onChange={e => updateArray(q.id, "gridCols", i, e.target.value)} className="flex-1 border-b border-gray-300 bg-transparent text-[11px] sm:text-xs font-bold p-1 outline-none focus:border-purple-500" /><button onClick={() => deleteFromArray(q.id, "gridCols", i)} className="text-gray-400 hover:text-red-500 p-1"><X className="w-3 h-3 sm:w-3.5 sm:h-3.5"/></button></div>
                            ))}
                            <button onClick={() => addToArray(q.id, "gridCols", "列")} className="text-[10px] font-bold text-blue-600 mt-1">列を追加</button>
                          </div>
                        </div>
                      )}

                      {q.type === "text" && <div className="border-b border-dotted border-gray-400 py-1.5 sm:py-2 text-[11px] sm:text-sm text-gray-400 w-2/3 sm:w-1/2">回答（短文）</div>}
                      {q.type === "textarea" && <div className="border-b border-dotted border-gray-400 py-1.5 sm:py-2 text-[11px] sm:text-sm text-gray-400 w-full h-12 sm:h-16">回答（長文）</div>}
                      {q.type === "file" && <div className="p-3 sm:p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-[10px] sm:text-xs font-bold text-gray-500 flex items-center gap-1.5 sm:gap-2"><UploadCloud className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500"/> ユーザーがファイルをアップロードできるようになります。</div>}
                      {q.type === "date" && <div className="p-1.5 sm:p-2 bg-gray-50 border border-gray-200 rounded w-1/2 sm:w-1/3 text-[10px] sm:text-xs font-bold text-gray-400 flex items-center gap-1.5 sm:gap-2"><Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500"/> 年 / 月 / 日</div>}
                      {q.type === "time" && <div className="p-1.5 sm:p-2 bg-gray-50 border border-gray-200 rounded w-1/2 sm:w-1/3 text-[10px] sm:text-xs font-bold text-gray-400 flex items-center gap-1.5 sm:gap-2"><Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500"/> 時 : 分</div>}
                    </div>
                  )}

                  <div className="flex justify-end items-center pt-3 sm:pt-4 border-t border-gray-100 gap-3 sm:gap-4 mt-3 sm:mt-4">
                    <button onClick={() => handleDeleteQuestion(q.id)} className="text-gray-400 hover:text-red-600 p-1.5 sm:p-2 rounded-full hover:bg-red-50 transition-colors shadow-2xs bg-white border border-gray-100" title="削除"><Trash2 className="h-4 w-4 sm:h-5 sm:w-5" /></button>
                    {!isStructure && (
                      <>
                        <div className="h-5 sm:h-6 w-px bg-gray-200"></div>
                        <label className="flex items-center cursor-pointer">
                          <span className="mr-2 sm:mr-3 text-[11px] sm:text-sm font-bold text-gray-700">必須</span>
                          <div className="relative">
                            <input type="checkbox" className="sr-only" checked={q.required} onChange={e => handleUpdateQuestion(q.id, "required", e.target.checked)} />
                            <div className={`block w-8 sm:w-10 h-5 sm:h-6 rounded-full transition-colors ${q.required ? 'bg-purple-600' : 'bg-gray-300'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 sm:w-4 sm:h-4 rounded-full transition-transform ${q.required ? 'transform translate-x-3 sm:translate-x-4' : ''}`}></div>
                          </div>
                        </label>
                      </>
                    )}
                  </div>
                  
                  {!isStructure && settings.isQuiz && (
                    <div className="mt-3 sm:mt-4 p-3 sm:p-5 bg-purple-50/50 rounded-xl border border-purple-100 space-y-3 sm:space-y-4 animate-fade-in">
                      <h4 className="text-[11px] sm:text-xs font-black text-purple-800 flex items-center gap-1 sm:gap-1.5 mb-1 sm:mb-2"><Star className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 解答と配点</h4>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="text-[10px] sm:text-xs font-bold text-purple-900 shrink-0">配点:</span>
                          <input type="number" min="0" value={q.points ?? settings.defaultPoints} onChange={e => handleUpdateQuestion(q.id, "points", Number(e.target.value))} className="w-16 sm:w-20 px-2 py-1.5 border border-purple-200 rounded-lg text-[11px] sm:text-sm outline-none bg-white font-bold" />
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 flex-1 mt-1 sm:mt-0">
                          <span className="text-[10px] sm:text-xs font-bold text-purple-900 shrink-0">フィードバック:</span>
                          <input type="text" value={q.feedback || ""} onChange={e => handleUpdateQuestion(q.id, "feedback", e.target.value)} placeholder="正解・不正解時の解説などを入力" className="w-full px-2.5 sm:px-3 py-1.5 border border-purple-200 rounded-lg text-[11px] sm:text-sm outline-none bg-white font-bold" />
                        </div>
                      </div>
                      
                      {q.type === "checkbox" && (
                        <div className="pt-2 border-t border-purple-100/50">
                          <span className="text-[10px] sm:text-xs font-bold text-purple-900 mb-1.5 sm:mb-2 block">採点基準:</span>
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-2.5 sm:mb-3">
                            <label className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold cursor-pointer">
                              <input type="radio" checked={q.quizScoringType !== "partial_match"} onChange={() => handleUpdateQuestion(q.id, "quizScoringType", "all_match")} className="text-purple-600 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span className="text-gray-700">すべての選択が合致したら得点</span>
                            </label>
                            <label className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold cursor-pointer">
                              <input type="radio" checked={q.quizScoringType === "partial_match"} onChange={() => handleUpdateQuestion(q.id, "quizScoringType", "partial_match")} className="text-purple-600 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span className="text-gray-700">１つでも正解を選択していたら得点</span>
                            </label>
                          </div>
                          
                          {(() => {
                            const isAllMatch = q.quizScoringType !== "partial_match";
                            const cLen = (q.correctAnswers || []).length;
                            const limit = q.checkboxConstraintCount || 1;
                            const cType = q.checkboxConstraintType;
                            
                            if (isAllMatch && cLen > 0 && cType && cType !== "none") {
                              if (cType === "exact" && limit !== cLen) return <p className="text-[9px] sm:text-[10px] font-bold text-red-600 mb-2 sm:mb-3 bg-red-50 p-2 sm:p-2.5 rounded-lg border border-red-200">※ 設定エラー：正解の数（{cLen}個）と選択制限数（{limit}個）が一致しないため、この問題は絶対に正解できません。</p>;
                              if (cType === "max" && limit < cLen) return <p className="text-[9px] sm:text-[10px] font-bold text-red-600 mb-2 sm:mb-3 bg-red-50 p-2 sm:p-2.5 rounded-lg border border-red-200">※ 設定エラー：正解の数（{cLen}個）が最大制限数（{limit}個以内）を超えているため、この問題は絶対に正解できません。</p>;
                              if (cType === "min" && limit > cLen) return <p className="text-[9px] sm:text-[10px] font-bold text-red-600 mb-2 sm:mb-3 bg-red-50 p-2 sm:p-2.5 rounded-lg border border-red-200">※ 設定エラー：最低制限数（{limit}個以上）が正解の数（{cLen}個）を超えており、不正解の選択肢も選ぶ必要があるため、この問題は絶対に正解できません。</p>;
                            }
                            return null;
                          })()}

                          <span className="text-[10px] sm:text-xs font-bold text-purple-900 mb-1.5 sm:mb-2 block mt-1">正解を選択（複数可）:</span>
                          <div className="flex flex-wrap gap-2 sm:gap-3">
                            {q.options.map(opt => {
                              const isCorrect = (q.correctAnswers || []).includes(opt);
                              return (
                                <label key={opt} className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-bold cursor-pointer bg-white px-2 py-1 rounded border border-purple-100 shadow-2xs">
                                  <input type="checkbox" checked={isCorrect} onChange={(e) => {
                                    const curr = q.correctAnswers || [];
                                    handleUpdateQuestion(q.id, "correctAnswers", e.target.checked ? [...curr, opt] : curr.filter(x => x !== opt));
                                  }} className="text-purple-600 rounded w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  <span className={isCorrect ? "text-purple-700" : "text-gray-600"}>{opt}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {["radio", "select"].includes(q.type) && (
                        <div className="pt-2 border-t border-purple-100/50">
                          <span className="text-[10px] sm:text-xs font-bold text-purple-900 mb-1.5 sm:mb-2 block">正解を選択:</span>
                          <div className="flex flex-wrap gap-2 sm:gap-3">
                            {q.options.map(opt => (
                              <label key={opt} className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-bold cursor-pointer bg-white px-2 py-1 rounded border border-purple-100 shadow-2xs">
                                <input type="radio" name={`correct_${q.id}`} checked={(q.correctAnswers || [])[0] === opt} onChange={() => handleUpdateQuestion(q.id, "correctAnswers", [opt])} className="text-purple-600 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span className={(q.correctAnswers || [])[0] === opt ? "text-purple-700" : "text-gray-600"}>{opt}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {q.type === "text" && (
                        <div className="pt-2 border-t border-purple-100/50">
                          <span className="text-[10px] sm:text-xs font-bold text-purple-900 mb-1 sm:mb-2 block">正解のキーワード（カンマ区切りで複数指定可）:</span>
                          <input type="text" value={(q.correctAnswers || []).join(", ")} onChange={e => handleUpdateQuestion(q.id, "correctAnswers", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} placeholder="例: りんご, リンゴ, apple" className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-purple-200 rounded-lg text-[11px] sm:text-sm outline-none bg-white font-bold shadow-2xs" />
                        </div>
                      )}
                      
                      {!["radio", "checkbox", "select", "text"].includes(q.type) && (
                        <p className="text-[9px] sm:text-[10px] text-purple-500 font-bold bg-white p-1.5 sm:p-2 rounded-lg border border-purple-100 shadow-2xs mt-2">※この質問形式の自動採点はサポートされていません。配点とフィードバックのみ設定可能です。</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex justify-center pt-2 pb-8 sm:pb-10">
            <button onClick={() => handleAddQuestion()} className="flex items-center px-5 sm:px-6 py-2.5 sm:py-3 bg-white border border-gray-300 shadow-sm rounded-full text-[11px] sm:text-sm font-black text-gray-700 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-300 transition-all hover:-translate-y-0.5">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" /> 新しい項目を追加
            </button>
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="px-2 sm:px-0">
          <SurveySettingsEditor settings={settings} setSettings={setSettings} tenantUsers={tenantUsers} />
        </div>
      )}
    </div>
  );
}