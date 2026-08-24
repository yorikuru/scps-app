"use client";

import React, { useState, useMemo } from "react";
import { MessageSquare, Clock, User, UserX, Trash2, Globe, Lock, Shield, Users, Download, ArrowLeft, ChevronLeft, ChevronRight, FileText, CheckCircle2, ChevronDown, Paperclip, AlertCircle, ArrowUpDown, Mail } from "lucide-react";
import { Survey, Question } from "../../../types";
import { ResponseData } from "../page";

type Props = {
  survey: Survey | null;
  responses: ResponseData[];
  onDeleteRequest: (id: string) => void;
};

export default function ResponsesList({ survey, responses, onDeleteRequest }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: "date" | "score", direction: "asc" | "desc" }>({ key: "date", direction: "desc" });

  const formatDate = (date: Date | null) => {
    if (!date) return "同期中...";
    return new Intl.DateTimeFormat("ja-JP", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(date);
  };

  const formatTimeTaken = (seconds?: number) => {
    if (!seconds) return "不明";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}秒`;
    return `${m}分${s}秒`;
  };

  const extractFileName = (url: string) => {
    try {
      const decoded = decodeURIComponent(url);
      const parts = decoded.split("?");
      const pathParts = parts[0].split("/");
      const fullName = pathParts[pathParts.length - 1];
      const nameParts = fullName.split("_");
      if (nameParts.length > 1 && !isNaN(Number(nameParts[0]))) {
        return nameParts.slice(1).join("_");
      }
      return fullName;
    } catch (e) {
      return "ダウンロードファイル";
    }
  };

  const downloadAllFiles = async (urls: string[]) => {
    urls.forEach((url, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.download = "attachment";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 300); 
    });
  };

  const isAutoGradable = (q: Question) => {
    if (["radio", "checkbox", "select"].includes(q.type)) return true;
    if (q.type === "text" && q.correctAnswers && q.correctAnswers.length > 0) return true;
    return false;
  };

  const calculateScore = (r: ResponseData) => {
    if (!survey || !survey.settings.isQuiz) return { score: 0, maxScore: 0, pending: 0 };
    let score = 0;
    let maxScore = 0;
    let pending = 0;

    survey.questions.forEach(q => {
      if (q.type === "section" || q.type === "description") return;

      const pts = q.points || 0;
      maxScore += pts;
      
      if (isAutoGradable(q)) {
        const ans = r.rawAnswers[q.id];
        const corrects = q.correctAnswers || [];
        let isCorrect = false;

        if (q.type === "radio" || q.type === "select") {
          isCorrect = corrects.length > 0 && corrects[0] === ans;
        } else if (q.type === "checkbox") {
          const ansArr = Array.isArray(ans) ? ans : [];
          if (q.quizScoringType === "partial_match") isCorrect = ansArr.some(c => corrects.includes(c));
          else isCorrect = corrects.length > 0 && corrects.length === ansArr.length && corrects.every(c => ansArr.includes(c));
        } else if (q.type === "text") {
          const textAns = String(ans || "").trim().toLowerCase();
          isCorrect = corrects.some(c => c.trim().toLowerCase() === textAns);
        }
        if (isCorrect) score += pts;
      } else if (pts > 0) {
        const mScore = r.manualScores?.[q.id];
        if (mScore !== undefined) {
          score += mScore;
        } else {
          pending += pts; 
        }
      }
    });

    return { score, maxScore, pending };
  };

  const sortedResponses = useMemo(() => {
    const list = [...responses];
    list.sort((a, b) => {
      if (sortConfig.key === "score") {
        const scoreA = calculateScore(a).score;
        const scoreB = calculateScore(b).score;
        return sortConfig.direction === "asc" ? scoreA - scoreB : scoreB - scoreA;
      } else {
        const dateA = a.createdAt?.getTime() || 0;
        const dateB = b.createdAt?.getTime() || 0;
        return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
      }
    });
    return list;
  }, [responses, sortConfig, survey]);

  const requestSort = (key: "date" | "score") => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc"
    }));
  };

  if (selectedId && survey) {
    const currentIndex = sortedResponses.findIndex(r => r.id === selectedId);
    if (currentIndex === -1) { setSelectedId(null); return null; }
    
    const response = sortedResponses[currentIndex];
    const prevId = currentIndex > 0 ? sortedResponses[currentIndex - 1].id : null;
    const nextId = currentIndex < sortedResponses.length - 1 ? sortedResponses[currentIndex + 1].id : null;
    const scoreInfo = calculateScore(response);

    const renderAnswerValue = (q: Question, val: any) => {
      if (val === undefined || val === null || val === "") return <p className="text-sm font-bold text-gray-400 italic">未回答</p>;

      if (q.type === "file") {
        if (!Array.isArray(val) || val.length === 0) return <p className="text-sm font-bold text-gray-400 italic">ファイルなし</p>;
        return (
          <div className="flex flex-col gap-2">
            <button onClick={() => downloadAllFiles(val)} className="self-start text-xs font-bold text-purple-600 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-purple-100 transition-colors">
              <Download className="w-3.5 h-3.5"/> すべてダウンロード
            </button>
            <div className="space-y-2 mt-2">
              {val.map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors group">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Paperclip className="w-4 h-4"/>
                  </div>
                  <span className="text-sm font-bold text-gray-700 truncate flex-1 group-hover:text-blue-600 transition-colors">{extractFileName(url)}</span>
                  <Download className="w-4 h-4 text-gray-400 shrink-0"/>
                </a>
              ))}
            </div>
          </div>
        );
      }

      if (q.type === "ranking") {
        const arr = Array.isArray(val) ? val : [];
        if (arr.length === 0) return <p className="text-sm font-bold text-gray-400 italic">未回答</p>;
        return (
          <div className="space-y-1.5">
            {arr.map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm font-bold text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-100">
                <span className="w-6 text-center text-gray-400 font-black">{i+1}</span>
                <span className="flex-1">{item}</span>
              </div>
            ))}
          </div>
        );
      }

      if (q.type === "grid_radio" || q.type === "grid_checkbox") {
        if (typeof val !== "object" || Object.keys(val).length === 0) return <p className="text-sm font-bold text-gray-400 italic">未回答</p>;
        return (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-gray-50">
                <tr><th className="p-3 border-b border-gray-200"></th>{(q.gridCols||[]).map(c=><th key={c} className="p-3 border-b border-gray-200 font-bold text-gray-600 text-center">{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(q.gridRows||[]).map((r, i) => {
                  const ans = val[r];
                  return (
                    <tr key={r} className="bg-white">
                      <td className="p-3 font-bold text-gray-800 border-r border-gray-100 bg-gray-50/50">{r}</td>
                      {(q.gridCols||[]).map(c => {
                        const isChecked = q.type === "grid_radio" ? ans === c : (Array.isArray(ans) && ans.includes(c));
                        return (
                          <td key={c} className="p-3 text-center">
                            {isChecked ? <div className="w-4 h-4 mx-auto bg-purple-600 rounded-sm flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white"/></div> : <span className="text-gray-200">-</span>}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        );
      }

      if (Array.isArray(val)) {
        return (
          <ul className="list-disc list-inside space-y-1">
            {val.map((item, i) => <li key={i} className="text-sm font-medium text-gray-800">{item}</li>)}
          </ul>
        );
      }

      return <p className="text-sm text-gray-800 whitespace-pre-wrap font-medium leading-relaxed">{String(val)}</p>;
    };

    return (
      <div className="animate-fade-in space-y-6">
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-[120px] z-30">
          <button onClick={() => setSelectedId(null)} className="flex items-center text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> 一覧に戻る
          </button>

          <div className="flex items-center gap-4 flex-1 justify-center">
            <button onClick={() => prevId && setSelectedId(prevId)} disabled={!prevId} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>

            <div className="relative group">
              <select 
                value={selectedId} 
                onChange={(e) => setSelectedId(e.target.value)} 
                className="appearance-none bg-gray-50 border border-gray-200 text-sm font-extrabold text-gray-900 rounded-xl pl-4 pr-10 py-2 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer min-w-[200px]"
              >
                {sortedResponses.map((r, i) => {
                  const no = responses.length - responses.findIndex(orig => orig.id === r.id);
                  return <option key={r.id} value={r.id}>#{no} : {r.respondentName}</option>;
                })}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button onClick={() => nextId && setSelectedId(nextId)} disabled={!nextId} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <button onClick={() => onDeleteRequest(response.id)} className="flex items-center text-sm font-bold text-red-500 hover:text-red-700 transition-colors">
            <Trash2 className="w-4 h-4 mr-1.5" /> 削除
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-wrap justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              {response.respondentName === "匿名" || response.respondentName === "ゲスト" ? <UserX className="w-6 h-6" /> : <User className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">{response.respondentName}</h2>
              {response.email && <p className="text-xs font-bold text-gray-500 mt-0.5"><Mail className="w-3 h-3 inline mr-1" />{response.email}</p>}
            </div>
          </div>
          <div className="flex gap-6 border-l border-gray-100 pl-6">
            <div>
              <p className="text-[10px] font-black text-gray-400 mb-1">回答日時</p>
              <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{formatDate(response.createdAt)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 mb-1">所要時間</p>
              <p className="text-sm font-bold text-gray-800">{formatTimeTaken(response.timeTaken)}</p>
            </div>
            {survey.settings.isQuiz && (
              <div>
                <p className="text-[10px] font-black text-purple-400 mb-1">得点</p>
                <p className="text-sm font-black text-purple-700">
                  {scoreInfo.score} <span className="text-xs font-bold text-gray-400">/ {scoreInfo.maxScore}</span>
                  {scoreInfo.pending > 0 && <span className="ml-1 text-[10px] text-amber-500 font-bold bg-amber-50 px-1 rounded border border-amber-200">手動採点あり</span>}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {survey.questions.filter(q => q.type !== "section" && q.type !== "description").map((q, i) => {
            const ans = response.rawAnswers?.[q.id];
            
            let isCorrect = false;
            let qScore = 0;
            const isAuto = isAutoGradable(q);
            const mScore = response.manualScores?.[q.id];

            if (survey.settings.isQuiz) {
              if (isAuto) {
                const corrects = q.correctAnswers || [];
                if (q.type === "radio" || q.type === "select") isCorrect = corrects.length > 0 && corrects[0] === ans;
                else if (q.type === "checkbox") {
                  const ansArr = Array.isArray(ans) ? ans : [];
                  if (q.quizScoringType === "partial_match") isCorrect = ansArr.some(c => corrects.includes(c));
                  else isCorrect = corrects.length > 0 && corrects.length === ansArr.length && corrects.every(c => ansArr.includes(c));
                }
                else if (q.type === "text") {
                  isCorrect = corrects.some(c => c.trim().toLowerCase() === String(ans || "").trim().toLowerCase());
                }
                if (isCorrect) qScore = q.points || 0;
              } else if (mScore !== undefined) {
                qScore = mScore;
                isCorrect = mScore === (q.points || 0);
              }
            }

            return (
              <div key={q.id} className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 relative overflow-hidden`}>
                {survey.settings.isQuiz && (
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${!isAuto && mScore === undefined ? 'bg-amber-400' : isCorrect ? 'bg-green-500' : 'bg-red-500'}`}></div>
                )}
                
                <div className="flex justify-between items-start mb-4 pb-3 border-b border-gray-100">
                  <h3 className="text-sm font-extrabold text-gray-900 pr-4 leading-snug">
                    {i + 1}. {q.title}
                  </h3>
                  {survey.settings.isQuiz && (
                    <span className={`text-xs font-black px-2.5 py-1 rounded flex-shrink-0 ${!isAuto && mScore === undefined ? 'text-amber-700 bg-amber-100' : isCorrect ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                      {!isAuto && mScore === undefined ? `採点待ち (配点 ${q.points || 0})` : `${qScore} / ${q.points || 0} 点`}
                    </span>
                  )}
                </div>
                
                <div className="pl-2">
                  {renderAnswerValue(q, ans)}
                </div>
              </div>
            )
          })}
        </div>

      </div>
    );
  }

  const questions = survey?.questions.filter(q => q.type !== "section" && q.type !== "description") || [];
  const hasFiles = questions.some(q => q.type === "file");
  const isQuiz = survey?.settings.isQuiz;

  const collectAllFilesFromResponse = (r: ResponseData) => {
    let urls: string[] = [];
    questions.filter(q => q.type === "file").forEach(q => {
      const val = r.rawAnswers[q.id];
      if (Array.isArray(val)) urls = [...urls, ...val];
    });
    return urls;
  };

  return (
    <div className="animate-fade-in space-y-6">

      {responses.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-500">回答はまだ届いていません。</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-black text-gray-500 tracking-wider">
                <tr>
                  <th className="p-4 w-16 text-center">No.</th>
                  <th className="p-4 cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => requestSort("date")}>
                    <div className="flex items-center gap-1">回答日時 <ArrowUpDown className="w-3 h-3 text-gray-400"/></div>
                  </th>
                  <th className="p-4">回答者</th>
                  {isQuiz && (
                    <th className="p-4 cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => requestSort("score")}>
                      <div className="flex items-center gap-1 text-purple-600">得点 <ArrowUpDown className="w-3 h-3 text-purple-400"/></div>
                    </th>
                  )}
                  <th className="p-4">所要時間</th>
                  {hasFiles && <th className="p-4">添付ファイル</th>}
                  <th className="p-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedResponses.map((r, i) => {
                  const originalIndex = responses.findIndex(orig => orig.id === r.id);
                  const no = responses.length - originalIndex;
                  const isAnon = r.respondentName === "匿名" || r.respondentName === "ゲスト";
                  const fileUrls = collectAllFilesFromResponse(r);
                  const scoreInfo = calculateScore(r);

                  return (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="p-4 text-center font-black text-gray-400">#{no}</td>
                      <td className="p-4 font-bold text-gray-700">{formatDate(r.createdAt)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isAnon ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-600'}`}>
                            {isAnon ? <UserX className="w-3 h-3"/> : <User className="w-3 h-3"/>}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block leading-none">{r.respondentName}</span>
                            {r.email && <span className="text-[9px] text-gray-400 mt-1 block">{r.email}</span>}
                          </div>
                        </div>
                      </td>
                      {isQuiz && (
                        <td className="p-4">
                          <div className="flex flex-col items-start gap-1">
                            <span className="font-black text-purple-700 text-base leading-none">{scoreInfo.score} <span className="text-[10px] text-gray-400 font-bold">/ {scoreInfo.maxScore}</span></span>
                            {scoreInfo.pending > 0 && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded border border-amber-200 leading-none py-0.5">採点待あり</span>}
                          </div>
                        </td>
                      )}
                      <td className="p-4 font-bold text-gray-500">
                        {formatTimeTaken(r.timeTaken)}
                      </td>
                      {hasFiles && (
                        <td className="p-4">
                          {fileUrls.length > 0 ? (
                            <button onClick={() => downloadAllFiles(fileUrls)} className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-blue-100 transition-colors">
                              <Download className="w-3.5 h-3.5"/> {fileUrls.length}ファイル
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-bold">-</span>
                          )}
                        </td>
                      )}
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => setSelectedId(r.id)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg transition-colors">詳細</button>
                          <button onClick={() => onDeleteRequest(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}