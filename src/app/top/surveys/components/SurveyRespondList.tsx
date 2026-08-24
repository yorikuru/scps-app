"use client";

import React from "react";
import { Survey } from "../types";
import { AlertCircle, FileText, CheckCircle2, ArrowRight, Clock, CalendarIcon } from "lucide-react";
import Link from "next/link";

type Props = {
  surveys: Survey[];
  myRespondedIds: Set<string>;
  currentUserId: string;
};

export default function SurveyRespondList({ surveys, myRespondedIds, currentUserId }: Props) {
  const now = Date.now();

  const isTarget = (s: Survey) => {
    const t = s.settings.accessTarget;
    if (t === "tenant_members" || t === "external_users" || t === "public") return true;
    if (t === "selected_users" && s.settings.respondentIds.includes(currentUserId)) return true;
    return false;
  };

  const isActive = (s: Survey) => {
    if (!s.settings.acceptingResponses) return false;
    const start = s.settings.startDate ? new Date(s.settings.startDate).getTime() : 0;
    const end = s.settings.endDate ? new Date(s.settings.endDate).getTime() : Infinity;
    if (now < start || now > end) return false;
    return true;
  };

  const targetSurveys = surveys.filter(s => isTarget(s));

  const requiredUnanswered = targetSurveys.filter(s => 
    isActive(s) && s.settings.requiredRespondentIds.includes(currentUserId) && !myRespondedIds.has(s.id)
  );

  const optionalUnanswered = targetSurveys.filter(s => 
    isActive(s) && !s.settings.requiredRespondentIds.includes(currentUserId) && !myRespondedIds.has(s.id)
  );

  const respondedOrInactive = targetSurveys.filter(s => 
    myRespondedIds.has(s.id) || !isActive(s)
  );

  // ★ 修正：引数に undefined を許容する
  const calculateDeadline = (endDateStr: string | null | undefined) => {
    if (!endDateStr) return null;
    const end = new Date(endDateStr).getTime();
    const diff = end - now;
    if (diff < 0) return { label: "期限超過", overdue: true };
    const days = Math.floor(diff / (1000 * 3600 * 24));
    const hours = Math.floor(diff / (1000 * 3600));
    if (days === 0) return { label: `残り ${hours}時間`, overdue: false, urgent: true };
    if (days <= 3) return { label: `残り ${days}日`, overdue: false, urgent: true };
    return { label: `残り ${days}日`, overdue: false, urgent: false };
  };

  const getSurveyStatusLabel = (s: Survey, isCompleted: boolean) => {
    if (isCompleted) return { label: "回答済み", icon: <CheckCircle2 className="w-3 h-3 mr-1" />, color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    
    if (!s.settings.acceptingResponses) return { label: "受付終了", icon: <Clock className="w-3 h-3 mr-1" />, color: "bg-gray-200 text-gray-600 border-gray-300" };
    
    const start = s.settings.startDate ? new Date(s.settings.startDate).getTime() : 0;
    const end = s.settings.endDate ? new Date(s.settings.endDate).getTime() : Infinity;

    if (now < start) return { label: "受付前", icon: <CalendarIcon className="w-3 h-3 mr-1" />, color: "bg-amber-100 text-amber-700 border-amber-200" };
    if (now > end) return { label: "受付終了", icon: <Clock className="w-3 h-3 mr-1" />, color: "bg-gray-200 text-gray-600 border-gray-300" };
    
    return { label: "回答可能", icon: <FileText className="w-3 h-3 mr-1" />, color: "bg-blue-100 text-blue-700 border-blue-200" };
  };

  const renderSurveyCard = (survey: Survey, type: "required" | "optional" | "completed") => {
    const deadline = calculateDeadline(survey.settings.endDate);
    const isCompleted = myRespondedIds.has(survey.id);
    const statusInfo = getSurveyStatusLabel(survey, isCompleted);

    return (
      <Link 
        key={survey.id} 
        href={`/s/${survey.id}`}
        target="_blank"
        className={`block bg-white p-5 rounded-xl shadow-sm border transition-all hover:-translate-y-0.5 hover:shadow-md relative group flex flex-col h-full ${
          type === "required" ? "border-red-300 bg-red-50/20" :
          type === "completed" ? "border-gray-200 opacity-70 hover:opacity-100 bg-gray-50" :
          "border-blue-200"
        }`}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            {type === "required" ? (
              <span className="flex items-center text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200 animate-pulse">
                <AlertCircle className="w-3 h-3 mr-1" /> 必須回答
              </span>
            ) : type === "completed" ? (
              <span className={`flex items-center text-[10px] font-black px-2 py-0.5 rounded border ${statusInfo.color}`}>
                {statusInfo.icon} {statusInfo.label}
              </span>
            ) : (
              <span className="flex items-center text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                <FileText className="w-3 h-3 mr-1" /> 任意回答
              </span>
            )}
            
            {deadline && type !== "completed" && (
              <span className={`text-[10px] font-bold flex items-center gap-1 ${
                deadline.overdue ? 'text-red-600 font-black' : deadline.urgent ? 'text-orange-600' : 'text-gray-500'
              }`}>
                <CalendarIcon className="w-3 h-3" /> {deadline.label}
              </span>
            )}
          </div>
          
          <ArrowRight className={`w-5 h-5 ${type === "required" ? "text-red-400 group-hover:text-red-600" : "text-gray-300 group-hover:text-blue-500"} transition-colors shrink-0`} />
        </div>

        <h3 className={`text-base font-extrabold line-clamp-2 mb-2 ${type === "required" ? 'text-red-900' : 'text-gray-900'}`}>
          {survey.title}
        </h3>
        <p className="text-xs text-gray-500 line-clamp-2 mb-4 flex-1">
          {survey.description || "説明はありません"}
        </p>

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
          <div className="flex gap-1.5 flex-wrap">
            {survey.settings.timeLimit && (
              <span className="text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5"/> {survey.settings.timeLimit}分制限
              </span>
            )}
            {survey.settings.limitToOneResponse && (
              <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                1回のみ
              </span>
            )}
            {survey.settings.allowEditResponse && (
              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                回答の編集可
              </span>
            )}
          </div>
          <span className="text-[9px] text-gray-400 font-mono shrink-0">
            {survey.createdBy === currentUserId ? "作成: あなた" : ""}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-10 animate-fade-in pb-10 font-sans">
      
      {requiredUnanswered.length > 0 && (
        <section>
          <h2 className="text-sm font-black text-red-600 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> 
            必ず回答してください ({requiredUnanswered.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {requiredUnanswered.map(s => renderSurveyCard(s, "required"))}
          </div>
        </section>
      )}

      {optionalUnanswered.length > 0 && (
        <section>
          <h2 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" /> 
            回答を受け付けています ({optionalUnanswered.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {optionalUnanswered.map(s => renderSurveyCard(s, "optional"))}
          </div>
        </section>
      )}

      {respondedOrInactive.length > 0 && (
        <section className="opacity-80">
          <h2 className="text-sm font-black text-gray-500 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> 
            回答済み・期間外 ({respondedOrInactive.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {respondedOrInactive.map(s => renderSurveyCard(s, "completed"))}
          </div>
        </section>
      )}

      {requiredUnanswered.length === 0 && optionalUnanswered.length === 0 && respondedOrInactive.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-600">現在、あなたが回答するアンケートはありません。</p>
        </div>
      )}
      
    </div>
  );
}