"use client";

import React, { useMemo } from "react";
import { Survey, Question } from "../../../types";
import { ResponseData } from "../page";
import { CheckCircle2, AlertTriangle, GraduationCap } from "lucide-react";

type Props = {
  survey: Survey | null;
  responses: ResponseData[];
};

export default function ResponsesSummary({ survey, responses }: Props) {
  if (!survey) return null;

  const colors = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#6366f1", "#14b8a6", "#f97316"];

  const isAutoGradable = (q: Question) => {
    if (["radio", "checkbox", "select"].includes(q.type)) return true;
    if (q.type === "text" && q.correctAnswers && q.correctAnswers.length > 0) return true;
    return false;
  };

  const quizAnalytics = useMemo(() => {
    if (!survey.settings.isQuiz || responses.length === 0) return null;

    const autoQuestions = survey.questions.filter(isAutoGradable);
    const maxScore = autoQuestions.reduce((sum, q) => sum + (q.points || 0), 0);
    
    let totalScores: number[] = [];
    const questionCorrects: Record<string, number> = {};
    autoQuestions.forEach(q => questionCorrects[q.id] = 0);

    responses.forEach(res => {
      let studentScore = 0;
      autoQuestions.forEach(q => {
        const ans = res.rawAnswers[q.id];
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

        if (isCorrect) {
          studentScore += (q.points || 0);
          questionCorrects[q.id]++;
        }
      });
      totalScores.push(studentScore);
    });

    totalScores.sort((a, b) => a - b);
    const avg = totalScores.reduce((a, b) => a + b, 0) / totalScores.length;
    const mid = Math.floor(totalScores.length / 2);
    const median = totalScores.length % 2 !== 0 ? totalScores[mid] : (totalScores[mid - 1] + totalScores[mid]) / 2;
    const minScore = totalScores[0];
    const maxScoreVal = totalScores[totalScores.length - 1];

    const missedQuestions = autoQuestions.map(q => {
      const rate = responses.length > 0 ? questionCorrects[q.id] / responses.length : 0;
      return { q, rate, correctCount: questionCorrects[q.id] };
    }).filter(x => x.rate < 0.5).sort((a, b) => a.rate - b.rate);

    return { maxScore, avg, median, minScore, maxScoreVal, missedQuestions, totalScores, autoQuestions };
  }, [survey, responses]);


  const renderChart = (q: Question) => {
    const answers = responses.map(r => r.rawAnswers?.[q.id]).filter(a => a !== undefined && a !== null && a !== "");
    const total = answers.length;

    if (total === 0) return <p className="text-xs font-bold text-gray-400">まだ回答がありません</p>;

    let quizRateLabel = null;
    if (survey.settings.isQuiz && isAutoGradable(q) && quizAnalytics) {
      const correctCount = responses.filter(res => {
        const ans = res.rawAnswers[q.id];
        const corrects = q.correctAnswers || [];
        if (q.type === "radio" || q.type === "select") return corrects.length > 0 && corrects[0] === ans;
        if (q.type === "checkbox") {
          const ansArr = Array.isArray(ans) ? ans : [];
          if (q.quizScoringType === "partial_match") {
            return corrects.length > 0 && ansArr.some(c => corrects.includes(c));
          } else {
            return corrects.length > 0 && corrects.length === ansArr.length && corrects.every(c => ansArr.includes(c));
          }
        }
        if (q.type === "text") return corrects.some(c => c.trim().toLowerCase() === String(ans || "").trim().toLowerCase());
        return false;
      }).length;
      const rate = responses.length > 0 ? Math.round((correctCount / responses.length) * 100) : 0;
      quizRateLabel = <div className="text-xs font-black text-purple-600 mb-3 bg-purple-50 inline-block px-3 py-1 rounded-lg">正答率: {rate}% ({correctCount}/{responses.length})</div>;
    }

    if (q.type === "radio" || q.type === "select") {
      const counts: Record<string, number> = {};
      q.options.forEach(o => counts[o] = 0);
      answers.forEach(a => { if (counts[String(a)] !== undefined) counts[String(a)]++; });
      
      let currentAcc = 0;
      const gradientParts = q.options.map((opt, i) => {
        const val = counts[opt];
        const pct = (val / total) * 100;
        const part = `${colors[i % colors.length]} ${currentAcc}% ${currentAcc + pct}%`;
        currentAcc += pct;
        return part;
      }).join(", ");

      return (
        <div>
          {quizRateLabel}
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="w-32 h-32 rounded-full shadow-inner border border-gray-100 shrink-0" style={{ background: `conic-gradient(${gradientParts})` }} />
            <div className="flex-1 space-y-2 w-full">
              {q.options.map((opt, i) => {
                const val = counts[opt];
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                const isCorrectAns = survey.settings.isQuiz && q.correctAnswers?.includes(opt);
                return (
                  <div key={opt} className={`flex items-center text-xs font-bold p-1.5 rounded ${isCorrectAns ? 'bg-green-50 text-green-800 border border-green-200' : 'text-gray-700'}`}>
                    <div className="w-3 h-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                    <span className="truncate flex-1">{opt} {isCorrectAns && "(正解)"}</span>
                    <span className="w-12 text-right">{pct}%</span>
                    <span className="w-16 text-right opacity-60">({val}件)</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      );
    }

    if (q.type === "checkbox") {
      const counts: Record<string, number> = {};
      q.options.forEach(o => counts[o] = 0);
      answers.forEach((arr: any) => {
        if (Array.isArray(arr)) arr.forEach(a => { if (counts[a] !== undefined) counts[a]++; });
      });

      return (
        <div>
          {quizRateLabel}
          <div className="space-y-3">
            {q.options.map((opt, i) => {
              const val = counts[opt];
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              const isCorrectAns = survey.settings.isQuiz && q.correctAnswers?.includes(opt);
              return (
                <div key={opt} className={`flex items-center text-xs font-bold p-1.5 rounded gap-3 ${isCorrectAns ? 'bg-green-50 text-green-800 border border-green-200' : 'text-gray-700'}`}>
                  <span className="w-24 sm:w-32 truncate shrink-0" title={opt}>{opt} {isCorrectAns && "★"}</span>
                  <div className="flex-1 bg-gray-100 h-4 rounded-full overflow-hidden border border-gray-200">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} />
                  </div>
                  <span className="w-16 text-right shrink-0">{pct}% ({val})</span>
                </div>
              )
            })}
          </div>
        </div>
      );
    }

    if (q.type === "scale" || q.type === "rating") {
      const max = q.type === "scale" ? q.scaleMax || 5 : q.ratingMax || 5;
      const min = q.type === "scale" ? q.scaleMin || 1 : 1;
      const counts: Record<number, number> = {};
      for (let i = min; i <= max; i++) counts[i] = 0;
      
      const numAnswers: number[] = [];
      answers.forEach(a => { 
        const num = Number(a); 
        if (!isNaN(num)) {
          numAnswers.push(num);
          if (counts[num] !== undefined) counts[num]++; 
        }
      });
      
      let avg = "0.0", median = "0.0", mode = "-", minVal = "-", maxVal = "-";
      if (numAnswers.length > 0) {
        const sorted = [...numAnswers].sort((a,b) => a - b);
        minVal = String(sorted[0]);
        maxVal = String(sorted[sorted.length - 1]);
        const sum = sorted.reduce((a,b) => a+b, 0);
        avg = (sum / sorted.length).toFixed(1);
        
        const mid = Math.floor(sorted.length / 2);
        median = (sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2).toFixed(1);
        
        let maxCount = 0;
        let modeArr: string[] = [];
        for (const k in counts) {
          if (counts[k] > maxCount) { maxCount = counts[k]; modeArr = [k]; }
          else if (counts[k] === maxCount && maxCount > 0) { modeArr.push(k); }
        }
        mode = modeArr.join(", ");
      }

      return (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100 shadow-sm">
              <span className="block text-[10px] font-bold text-purple-600 mb-0.5">平均値</span>
              <span className="text-xl font-black text-purple-900">{avg}</span>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100 shadow-sm">
              <span className="block text-[10px] font-bold text-blue-600 mb-0.5">中央値</span>
              <span className="text-xl font-black text-blue-900">{median}</span>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100 shadow-sm">
              <span className="block text-[10px] font-bold text-emerald-600 mb-0.5">最頻値</span>
              <span className="text-xl font-black text-emerald-900">{mode}</span>
            </div>
            <div className="bg-white rounded-xl p-3 text-center border border-gray-200 shadow-sm">
              <span className="block text-[10px] font-bold text-gray-500 mb-0.5">最大値</span>
              <span className="text-xl font-black text-gray-800">{maxVal}</span>
            </div>
            <div className="bg-white rounded-xl p-3 text-center border border-gray-200 shadow-sm">
              <span className="block text-[10px] font-bold text-gray-500 mb-0.5">最小値</span>
              <span className="text-xl font-black text-gray-800">{minVal}</span>
            </div>
          </div>

          <div className="space-y-2">
            {Object.keys(counts).map(k => {
              const val = counts[Number(k)];
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return (
                <div key={k} className="flex items-center text-xs font-bold text-gray-700 gap-3">
                  <span className="w-8 text-right shrink-0">{k}</span>
                  <div className="flex-1 bg-gray-100 h-3.5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-400 transition-all duration-1000" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-20 text-right text-gray-500 shrink-0">{val} 件 ({pct}%)</span>
                </div>
              )
            })}
          </div>
        </div>
      );
    }

    if (q.type === "text" || q.type === "textarea" || q.type === "date" || q.type === "time") {
      const recent = answers.slice(0, 5);
      return (
        <div>
          {quizRateLabel}
          <div className="space-y-2">
            {recent.map((ans, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 shadow-sm">{String(ans)}</div>
            ))}
            {total > 5 && <p className="text-[10px] text-gray-400 font-bold text-center mt-3 pt-3 border-t border-dashed border-gray-200">他 {total - 5} 件の回答（個別リストから確認できます）</p>}
          </div>
        </div>
      );
    }

    if (q.type === "ranking") {
      const scores: Record<string, number> = {};
      q.options.forEach(o => scores[o] = 0);
      const N = q.options.length;

      answers.forEach(ansArr => {
        if (Array.isArray(ansArr)) {
          ansArr.forEach((opt, idx) => {
            if (scores[opt] !== undefined) scores[opt] += (N - idx); 
          });
        }
      });

      const sortedOpts = [...q.options].sort((a, b) => scores[b] - scores[a]);

      return (
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-gray-400 mb-2">※ 1位に高いスコアを付与した独自の集計結果です</p>
          {sortedOpts.map((opt, i) => {
            const maxScore = sortedOpts.length > 0 ? scores[sortedOpts[0]] : 1;
            const pct = maxScore > 0 ? Math.round((scores[opt] / maxScore) * 100) : 0;
            return (
              <div key={opt} className="flex items-center text-xs font-bold text-gray-700 gap-3">
                <span className="w-8 text-center text-gray-400">{i+1}位</span>
                <span className="w-24 sm:w-32 truncate shrink-0" title={opt}>{opt}</span>
                <div className="flex-1 bg-gray-100 h-4 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000 bg-orange-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 text-right shrink-0">{scores[opt]} pt</span>
              </div>
            )
          })}
        </div>
      );
    }

    if (q.type === "grid_radio" || q.type === "grid_checkbox") {
      const gridCounts: Record<string, Record<string, number>> = {};
      q.gridRows?.forEach(r => {
        gridCounts[r] = {};
        q.gridCols?.forEach(c => gridCounts[r][c] = 0);
      });

      answers.forEach(ansObj => {
        if (typeof ansObj === "object" && ansObj !== null) {
          Object.keys(ansObj).forEach(row => {
            if (gridCounts[row]) {
              const val = ansObj[row];
              if (q.type === "grid_radio" && gridCounts[row][val] !== undefined) {
                gridCounts[row][val]++;
              } else if (q.type === "grid_checkbox" && Array.isArray(val)) {
                val.forEach(c => { if (gridCounts[row][c] !== undefined) gridCounts[row][c]++; });
              }
            }
          });
        }
      });

      return (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 border-b border-gray-200"></th>
                {(q.gridCols||[]).map(c=><th key={c} className="p-3 border-b border-gray-200 font-bold text-gray-600 text-center">{c}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(q.gridRows||[]).map(r => (
                <tr key={r} className="bg-white">
                  <td className="p-3 font-bold text-gray-800 border-r border-gray-100 bg-gray-50/50">{r}</td>
                  {(q.gridCols||[]).map(c => {
                    const count = gridCounts[r]?.[c] || 0;
                    const intensity = total > 0 ? (count / total) : 0;
                    const bgColor = `rgba(139, 92, 246, ${intensity * 0.8})`; 
                    return (
                      <td key={c} className="p-3 text-center transition-colors" style={{ backgroundColor: bgColor }}>
                        <span className={`font-black ${intensity > 0.5 ? 'text-white' : 'text-gray-800'}`}>{count}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (q.type === "file") {
      let fileCount = 0;
      answers.forEach(a => { if (Array.isArray(a)) fileCount += a.length; });
      return (
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-center">
          <p className="text-2xl font-black text-gray-800 mb-1">{fileCount}</p>
          <p className="text-xs font-bold text-gray-500">個のファイルがアップロードされました</p>
          <p className="text-[10px] text-gray-400 mt-2">（詳細は個別リストからダウンロードしてください）</p>
        </div>
      )
    }

    return <p className="text-xs text-gray-400">この質問形式の集計はサポートされていません。</p>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {quizAnalytics && (
        <div className="bg-white rounded-xl shadow-md border border-purple-200 overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 sm:p-6 text-white flex items-center gap-3">
            <GraduationCap className="w-8 h-8 opacity-90" />
            <div>
              <h2 className="text-lg font-black tracking-tight">テスト分析レポート</h2>
              <p className="text-xs font-medium text-purple-100 mt-1">自動採点可能な {quizAnalytics.autoQuestions.length} 問による分析</p>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                <span className="block text-xs font-bold text-gray-500 mb-1">平均点</span>
                <span className="text-2xl font-black text-purple-700">{quizAnalytics.avg.toFixed(1)} <span className="text-sm">/ {quizAnalytics.maxScore}</span></span>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                <span className="block text-xs font-bold text-gray-500 mb-1">中央値</span>
                <span className="text-2xl font-black text-blue-700">{quizAnalytics.median.toFixed(1)}</span>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                <span className="block text-xs font-bold text-gray-500 mb-1">最高点</span>
                <span className="text-2xl font-black text-emerald-700">{quizAnalytics.maxScoreVal}</span>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                <span className="block text-xs font-bold text-gray-500 mb-1">最低点</span>
                <span className="text-2xl font-black text-red-700">{quizAnalytics.minScore}</span>
              </div>
            </div>

            {quizAnalytics.missedQuestions.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
                <h3 className="text-sm font-black text-amber-800 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> よく間違える問題（正答率50%未満）
                </h3>
                <div className="space-y-3">
                  {quizAnalytics.missedQuestions.map((item, idx) => (
                    <div key={item.q.id} className="flex items-start justify-between bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
                      <div>
                        <p className="text-xs font-bold text-gray-900 line-clamp-1">{idx+1}. {item.q.title}</p>
                        <p className="text-[10px] text-gray-500 mt-1">正解: {item.q.correctAnswers?.join(", ")}</p>
                      </div>
                      <div className="text-right ml-4">
                        <span className="block text-sm font-black text-amber-600">{Math.round(item.rate * 100)}%</span>
                        <span className="text-[9px] text-gray-400 font-bold">{item.correctCount}人が正解</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {survey.questions.filter(q => q.type !== "section" && q.type !== "description").map((q, i) => (
        <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h3 className="text-base font-extrabold text-gray-900 mb-6 border-b border-gray-100 pb-3 leading-snug">
            {i + 1}. {q.title}
            {survey.settings.isQuiz && <span className="ml-2 text-xs text-gray-400 font-bold">({q.points || 0}点)</span>}
          </h3>
          {renderChart(q)}
        </div>
      ))}
    </div>
  );
}