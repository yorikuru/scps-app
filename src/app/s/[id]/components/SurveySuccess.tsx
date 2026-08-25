"use client";

import React, { useState, useEffect, useMemo } from "react";
import { CheckCircle2, RotateCcw, BarChart3, Home, ArrowRight, Eye, MessageSquare, AlertCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Survey, UserData, Question } from "../types";

type Props = {
  survey: Survey | null;
  currentUser: UserData | null;
  submittedAnswers?: Record<string, any> | null;
  manualScores?: Record<string, number> | null;
  onReset: () => void;
};

export default function SurveySuccess({ survey, currentUser, submittedAnswers, manualScores, onReset }: Props) {
  const router = useRouter();
  const [showGrades, setShowGrades] = useState(false);

  useEffect(() => {
    if (survey?.settings.isQuiz && survey.settings.releaseGrades === "immediately") {
      setShowGrades(true);
    }
  }, [survey]);

  const isAutoGradable = (q: Question) => {
    if (["radio", "checkbox", "select"].includes(q.type)) return true;
    if (q.type === "text" && q.correctAnswers && q.correctAnswers.length > 0) return true;
    return false;
  };

  const scoreData = useMemo(() => {
    if (!survey || !submittedAnswers) return { totalScore: 0, maxScore: 0, pendingScore: 0, hasManual: false, results: {} };
    let totalScore = 0;
    let maxScore = 0;
    let pendingScore = 0;
    let hasManual = false;
    const results: Record<string, { isCorrect: boolean; score: number; isManual: boolean }> = {};

    survey.questions.forEach(q => {
      if (q.type === "section" || q.type === "description") return;
      
      const pts = q.points || 0;
      
      if (isAutoGradable(q)) {
        maxScore += pts;
        const ans = submittedAnswers[q.id];
        const corrects = q.correctAnswers || [];
        let isCorrect = false;

        if (q.type === "radio" || q.type === "select") {
          isCorrect = corrects.length > 0 && corrects[0] === ans;
        } else if (q.type === "checkbox") {
          const ansArr = Array.isArray(ans) ? ans : [];
          if (q.quizScoringType === "partial_match") {
            isCorrect = corrects.length > 0 && ansArr.some(c => corrects.includes(c));
          } else {
            isCorrect = corrects.length > 0 && corrects.length === ansArr.length && corrects.every(c => ansArr.includes(c));
          }
        } else if (q.type === "text") {
          const textAns = String(ans || "").trim().toLowerCase();
          isCorrect = corrects.some(c => c.trim().toLowerCase() === textAns);
        }

        if (isCorrect) totalScore += pts;
        results[q.id] = { isCorrect, score: isCorrect ? pts : 0, isManual: false };
      } else if (pts > 0) {
        maxScore += pts;
        const manualPt = manualScores ? manualScores[q.id] : undefined;
        if (manualPt !== undefined) {
           totalScore += manualPt;
           results[q.id] = { isCorrect: manualPt === pts, score: manualPt, isManual: true };
        } else {
           hasManual = true;
           pendingScore += pts;
           results[q.id] = { isCorrect: false, score: 0, isManual: true };
        }
      }
    });

    return { totalScore, maxScore, pendingScore, hasManual, results };
  }, [survey, submittedAnswers, manualScores]);

  // 外部ユーザーかどうかを判定（currentUserに schoolId や affiliation 等がある、または外部用データ構造の場合）
  const isExternalUser = currentUser && ("affiliation" in currentUser || (currentUser as any).role === "guest" || !("category" in currentUser));

  const handleCloseTab = () => {
    window.close();
    // ブラウザのセキュリティポリシーでウィンドウを閉じられない場合のフォールバック案内
    setTimeout(() => {
      alert("このタブを自動で閉じることができませんでした。お手数ですが、ブラウザのタブを手動で閉じてください。");
    }, 200);
  };

  return (
    <div className="bg-[#F4F7F6] font-sans py-8 min-h-screen">
      <div className="max-w-2xl mx-auto px-4">
        
        <div className="bg-white shadow-sm rounded-2xl p-6 sm:p-8 text-center border border-gray-100 relative overflow-hidden animate-fade-in mb-6">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600"></div>

          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-purple-50 text-purple-600 mb-4 shadow-inner">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-3 tracking-tight">
            回答が送信されました
          </h2>
          
          <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100 text-left">
            <p className="text-xs font-bold text-gray-700 whitespace-pre-wrap leading-relaxed text-center">
              {survey?.settings.confirmationMessage || "ご協力ありがとうございました。\nあなたの回答は正常に記録されました。"}
            </p>
          </div>

          <div className="space-y-3 mb-6">
            {survey?.settings.showResultsSummary && (
              <button 
                onClick={() => router.push(`/s/${survey.id}/summary`)}
                className="w-full py-3 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 group"
              >
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                結果の概要を見る
                <ArrowRight className="w-3.5 h-3.5 ml-auto text-indigo-400" />
              </button>
            )}

            {survey?.settings.showLinkToSubmitAnother && !survey?.settings.limitToOneResponse && (
              <button 
                onClick={onReset} 
                className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 border border-gray-200/80"
              >
                <RotateCcw className="w-4 h-4 text-gray-500" />
                別の回答を送信する
              </button>
            )}
          </div>

          {/* 権限ごとの戻るボタンとタブ閉じるボタン */}
          <div className="space-y-2.5">
            {currentUser ? (
              isExternalUser ? (
                <button 
                  onClick={() => router.push("/ext-top")} 
                  className="w-full inline-flex justify-center items-center py-3 px-4 rounded-xl shadow-sm text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 transition-all gap-2"
                >
                  <Home className="w-4 h-4" /> TOPに戻る
                </button>
              ) : (
                <button 
                  onClick={() => router.push("/top")} 
                  className="w-full inline-flex justify-center items-center py-3 px-4 rounded-xl shadow-sm text-xs font-black text-white bg-gray-900 hover:bg-black transition-all gap-2"
                >
                  <Home className="w-4 h-4" /> ポータルに戻る
                </button>
              )
            ) : null}

            <button 
              onClick={handleCloseTab} 
              className="w-full inline-flex justify-center items-center py-3 px-4 rounded-xl shadow-sm text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all gap-2 border border-gray-200"
            >
              <XCircle className="w-4 h-4 text-gray-500" /> このタブを閉じる
            </button>
          </div>
        </div>

        {/* テスト（クイズ）の成績表示 */}
        {survey?.settings.isQuiz && survey.settings.releaseGrades !== "never" && submittedAnswers && (
          <div className="bg-white shadow-sm rounded-2xl p-6 sm:p-8 border border-gray-100 mb-10">
            {!showGrades && survey.settings.releaseGrades === "manual" ? (
              <button 
                onClick={() => setShowGrades(true)}
                className="w-full py-4 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-sm font-extrabold transition-all flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4 text-purple-600" />
                成績と正誤一覧を表示する
              </button>
            ) : showGrades ? (
              <div className="animate-fade-in space-y-5 text-left">
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-5 text-center border border-purple-100">
                  <p className="text-xs font-black text-purple-800 mb-1">あなたの得点</p>
                  <p className="text-4xl font-black text-purple-900 mb-1">
                    {scoreData.totalScore} <span className="text-lg text-purple-600 font-bold">/ {scoreData.maxScore}</span>
                  </p>
                  {scoreData.hasManual && (
                    <div className="mt-3 p-2 bg-amber-50 rounded-md border border-amber-200 text-[10px] font-bold text-amber-700 flex items-center justify-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" /> 一部の問題（計 {scoreData.pendingScore} 点分）は手動採点待ちのため未反映です。
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  {survey.questions.map((q, i) => {
                    const res = scoreData.results[q.id];
                    if (!res) return null;
                    
                    const isManualPending = res.isManual && manualScores?.[q.id] === undefined;

                    return (
                      <div key={q.id} className={`p-4 rounded-xl border ${isManualPending ? 'bg-amber-50/30 border-amber-200' : res.isCorrect ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'} relative overflow-hidden`}>
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${isManualPending ? 'bg-amber-400' : res.isCorrect ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-xs font-bold text-gray-900 pr-3">{i+1}. {q.title}</h4>
                          {survey.settings.showPointValues && (
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded flex-shrink-0 ${isManualPending ? 'text-amber-700 bg-amber-100' : res.isCorrect ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                              {isManualPending ? `採点待ち (${q.points || 0}点)` : `${res.score} / ${q.points || 0} 点`}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-[10px] text-gray-700 mb-2 bg-white p-2.5 rounded border border-gray-100">
                          <span className="font-bold text-gray-500 block mb-0.5">あなたの回答:</span>
                          <span className="font-black text-gray-900">
                            {Array.isArray(submittedAnswers[q.id]) ? submittedAnswers[q.id].join(", ") 
                              : typeof submittedAnswers[q.id] === 'object' ? JSON.stringify(submittedAnswers[q.id])
                              : submittedAnswers[q.id] || "未回答"}
                          </span>
                        </div>
                        
                        {survey.settings.showCorrectAnswers && !res.isCorrect && !isManualPending && (
                          <div className="text-[10px] text-green-800 mb-2 bg-green-100/50 p-2.5 rounded border border-green-200">
                            <span className="font-bold text-green-700 block mb-0.5">正解:</span>
                            <span className="font-black">{q.correctAnswers?.join(", ") || "設定されていません"}</span>
                          </div>
                        )}
                        
                        {q.feedback && (
                          <div className="mt-2 p-3 bg-white rounded border border-purple-100 text-[10px] text-gray-700 shadow-sm relative">
                            <span className="font-black text-purple-700 block mb-1 flex items-center gap-1.5">
                              <MessageSquare className="w-3 h-3" /> フィードバック
                            </span>
                            <span className="font-medium leading-relaxed whitespace-pre-wrap">{q.feedback}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}