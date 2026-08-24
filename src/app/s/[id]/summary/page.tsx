"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, AlertCircle, BarChart3, CheckCircle2 } from "lucide-react";
import { Survey, Question } from "../types";

export default function SurveySummaryPage() {
  const params = useParams();
  const surveyId = params.id as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const surveySnap = await getDoc(doc(db, "surveys", surveyId));
        if (!surveySnap.exists()) {
          setErrorMsg("アンケートが見つかりません。"); setIsLoading(false); return;
        }
        const sData = { id: surveySnap.id, ...surveySnap.data() } as Survey;
        
        if (!sData.settings.showResultsSummary) {
          setErrorMsg("このアンケートは結果の概要を公開していません。"); setIsLoading(false); return;
        }
        setSurvey(sData);

        const rSnap = await getDocs(query(collection(db, "survey_responses"), where("surveyId", "==", surveyId)));
        const rData: any[] = [];
        rSnap.forEach(d => rData.push(d.data()));
        setResponses(rData);

        setIsLoading(false);
      } catch (error) {
        setErrorMsg("データの取得に失敗しました。"); setIsLoading(false);
      }
    };
    fetchData();
  }, [surveyId]);

  if (isLoading) return <div className="min-h-screen flex justify-center items-center"><Loader2 className="w-10 h-10 animate-spin text-purple-600"/></div>;
  if (errorMsg) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-sm text-center border-t-4 border-gray-400">
        <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-4" />
        <p className="font-bold text-gray-700">{errorMsg}</p>
      </div>
    </div>
  );

  const colors = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#6366f1", "#14b8a6", "#f97316"];

  const renderChart = (q: Question) => {
    const answers = responses.map(r => r.rawAnswers?.[q.id]).filter(a => a !== undefined && a !== null && a !== "");
    const total = answers.length;
    if (total === 0) return <p className="text-xs font-bold text-gray-400">まだ回答がありません</p>;

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
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="w-32 h-32 rounded-full shadow-inner border border-gray-100 shrink-0" style={{ background: `conic-gradient(${gradientParts})` }} />
          <div className="flex-1 space-y-2 w-full">
            {q.options.map((opt, i) => {
              const val = counts[opt];
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return (
                <div key={opt} className="flex items-center text-xs font-bold text-gray-700">
                  <div className="w-3 h-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                  <span className="truncate flex-1">{opt}</span>
                  <span className="w-12 text-right">{pct}%</span>
                  <span className="w-12 text-right text-gray-400">({val}件)</span>
                </div>
              )
            })}
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
        <div className="space-y-3">
          {q.options.map((opt, i) => {
            const val = counts[opt];
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            return (
              <div key={opt} className="flex items-center text-xs font-bold text-gray-700 gap-3">
                <span className="w-24 sm:w-32 truncate shrink-0" title={opt}>{opt}</span>
                <div className="flex-1 bg-gray-100 h-4 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} />
                </div>
                <span className="w-16 text-right shrink-0">{pct}% ({val})</span>
              </div>
            )
          })}
        </div>
      );
    }

    if (q.type === "scale" || q.type === "rating") {
      const max = q.type === "scale" ? q.scaleMax || 5 : q.ratingMax || 5;
      const min = q.type === "scale" ? q.scaleMin || 1 : 1;
      const counts: Record<number, number> = {};
      for (let i = min; i <= max; i++) counts[i] = 0;
      let sum = 0;
      answers.forEach(a => { const num = Number(a); if (counts[num] !== undefined) { counts[num]++; sum += num; } });
      const avg = total > 0 ? (sum / total).toFixed(1) : "0.0";

      return (
        <div>
          <div className="mb-4 text-sm font-black text-purple-600 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4"/> 平均: {avg}
          </div>
          <div className="space-y-2">
            {Object.keys(counts).map(k => {
              const val = counts[Number(k)];
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return (
                <div key={k} className="flex items-center text-xs font-bold text-gray-700 gap-3">
                  <span className="w-8 text-right shrink-0">{k}</span>
                  <div className="flex-1 bg-gray-100 h-3 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-gray-400 shrink-0">{val}</span>
                </div>
              )
            })}
          </div>
        </div>
      );
    }

    if (q.type === "text" || q.type === "textarea") {
      const recent = answers.slice(0, 10);
      return (
        <div className="space-y-2">
          {recent.map((ans, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg text-xs font-medium text-gray-700 border border-gray-100">{String(ans)}</div>
          ))}
          {total > 10 && <p className="text-[10px] text-gray-400 font-bold text-center mt-2">他 {total - 10} 件の回答</p>}
        </div>
      );
    }

    return <p className="text-xs text-gray-400">この形式のグラフ表示は現在対応していません。</p>;
  };

  return (
    <div className="min-h-screen bg-[#f3f2f7] pb-20 font-sans">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center text-purple-600 font-extrabold text-lg gap-2">
          <BarChart3 className="w-5 h-5" /> 結果の概要
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-gray-900 mb-2">{survey?.title}</h1>
          <p className="text-sm font-bold text-gray-500">回答総数: {responses.length} 件</p>
        </div>

        <div className="space-y-6">
          {survey?.questions.filter(q => q.type !== "section" && q.type !== "description").map((q, i) => (
            <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 animate-fade-in">
              <h3 className="text-sm font-extrabold text-gray-900 mb-6 border-b border-gray-100 pb-3">{i + 1}. {q.title}</h3>
              {renderChart(q)}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}