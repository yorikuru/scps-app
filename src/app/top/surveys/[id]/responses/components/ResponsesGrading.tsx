"use client";

import React, { useState } from "react";
import { Survey } from "../../../types";
import { ResponseData } from "../page";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Save, AlertCircle, CheckCircle2, User, Loader2 } from "lucide-react";

type Props = {
  survey: Survey | null;
  responses: ResponseData[];
  showAlert: (type: "success" | "error", message: string) => void;
};

export default function ResponsesGrading({ survey, responses, showAlert }: Props) {
  const [localScores, setLocalScores] = useState<Record<string, Record<string, number>>>({}); // { responseId: { questionId: score } }
  const [savingId, setSavingId] = useState<string | null>(null);

  if (!survey) return null;

  const manualQuestions = survey.questions.filter(q => {
    if (q.type === "section" || q.type === "description") return false;
    const isAuto = ["radio", "checkbox", "select"].includes(q.type) || (q.type === "text" && q.correctAnswers && q.correctAnswers.length > 0);
    return !isAuto && (q.points || 0) > 0;
  });

  if (manualQuestions.length === 0) return <p className="text-gray-500 p-8 text-center bg-white rounded-xl shadow-sm">手動採点が必要な問題はありません。</p>;

  const handleScoreChange = (responseId: string, questionId: string, value: string, maxPoints: number) => {
    const num = Math.min(Math.max(0, Number(value)), maxPoints);
    setLocalScores(prev => ({
      ...prev,
      [responseId]: {
        ...(prev[responseId] || {}),
        [questionId]: num
      }
    }));
  };

  const handleSave = async (response: ResponseData) => {
    const scoresToSave = localScores[response.id];
    if (!scoresToSave || Object.keys(scoresToSave).length === 0) return;

    setSavingId(response.id);
    try {
      const updatedScores = { ...(response.manualScores || {}), ...scoresToSave };
      await updateDoc(doc(db, "survey_responses", response.id), {
        manualScores: updatedScores
      });
      showAlert("success", "採点結果を保存しました。");
    } catch (e) {
      showAlert("error", "保存に失敗しました。");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      <div className="bg-amber-50 rounded-xl p-5 border border-amber-200 shadow-sm flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-black text-amber-800">手動採点ダッシュボード</h3>
          <p className="text-xs font-bold text-amber-700 mt-1">記述式やファイルアップロードなど、自動採点ができない問題の点数をここから入力して保存してください。</p>
        </div>
      </div>

      <div className="space-y-6">
        {responses.map((r, i) => {
          const no = responses.length - i;
          
          const isPending = manualQuestions.some(q => (r.manualScores?.[q.id] === undefined && localScores[r.id]?.[q.id] === undefined));
          const hasChanges = localScores[r.id] !== undefined && Object.keys(localScores[r.id]).length > 0;

          return (
            <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
              <div className={`absolute top-0 left-0 w-1.5 h-full ${isPending ? 'bg-amber-400' : 'bg-green-500'}`}></div>
              
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-gray-400">#{no}</span>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-bold text-gray-900">{r.respondentName}</span>
                  </div>
                </div>
                <div>
                  {isPending ? (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded">未採点あり</span>
                  ) : (
                    <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-1 rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>採点完了</span>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-6">
                {manualQuestions.map((q, idx) => {
                  const savedScore = r.manualScores?.[q.id];
                  const currentScore = localScores[r.id]?.[q.id] !== undefined ? localScores[r.id][q.id] : savedScore;
                  const ans = r.rawAnswers[q.id];

                  return (
                    <div key={q.id} className="border border-gray-100 rounded-lg p-4 bg-gray-50/50">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-xs font-extrabold text-gray-800 flex-1">{idx+1}. {q.title}</h4>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <span className="text-[10px] font-bold text-gray-400">得点:</span>
                          <input 
                            type="number" 
                            min="0" 
                            max={q.points || 0}
                            value={currentScore !== undefined ? currentScore : ""}
                            onChange={(e) => handleScoreChange(r.id, q.id, e.target.value, q.points || 0)}
                            className={`w-16 px-2 py-1 text-sm font-black border rounded outline-none text-right ${currentScore === undefined ? 'border-amber-300 bg-amber-50' : 'border-gray-300 bg-white'}`}
                          />
                          <span className="text-[10px] font-bold text-gray-500">/ {q.points}点</span>
                        </div>
                      </div>
                      
                      <div className="bg-white border border-gray-200 rounded p-3 text-xs text-gray-700 font-medium">
                        {ans === undefined || ans === null || ans === "" ? (
                          <span className="text-gray-400 italic">未回答</span>
                        ) : Array.isArray(ans) && q.type === "file" ? (
                          <div className="flex gap-2">
                            {ans.map((url, fi) => <a key={fi} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">添付ファイル {fi+1}</a>)}
                          </div>
                        ) : (
                          <span className="whitespace-pre-wrap">{String(ans)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => handleSave(r)}
                  disabled={!hasChanges || savingId === r.id}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  {savingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  採点を保存
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}