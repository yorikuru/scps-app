"use client";

import React from "react";
import { Plus, Edit2, Trash2, Globe, Lock, LayoutList, Share2, Shield, Users, UserX, Clock, Calendar, BarChart3, Settings, Play } from "lucide-react";
import Link from "next/link";
import { Survey } from "../types";

type Props = {
  surveys: Survey[];
  isLoading: boolean;
  onNew: () => void;
  onEdit: (survey: Survey, editTab?: "questions" | "settings") => void; // ★ 編集タブの指定に対応
  onDelete: (id: string) => void;
  onCopyUrl: (id: string) => void;
  currentUserId: string;
};

export default function SurveyList({ surveys, isLoading, onNew, onEdit, onDelete, onCopyUrl, currentUserId }: Props) {
  
  const canEdit = (survey: Survey) => {
    if (survey.createdBy === currentUserId) return true;
    if (survey.settings.visibility === "tenant_all") return true;
    if (survey.settings.visibility === "selected_users" && survey.settings.editorIds.includes(currentUserId)) return true;
    return false;
  };

  const getAccessTargetLabel = (target: Survey["settings"]["accessTarget"]) => {
    switch(target) {
      case "public": return { label: "一般公開", icon: <Globe className="h-3 w-3 mr-1" />, color: "text-blue-600 bg-blue-50 border-blue-100" };
      case "external_users": return { label: "テナント＋外部連携", icon: <Users className="h-3 w-3 mr-1" />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" };
      case "selected_users": return { label: "一部の指定ユーザー", icon: <Lock className="h-3 w-3 mr-1" />, color: "text-orange-600 bg-orange-50 border-orange-100" };
      case "tenant_members": default: return { label: "テナント内限定", icon: <Shield className="h-3 w-3 mr-1" />, color: "text-indigo-600 bg-indigo-50 border-indigo-100" };
    }
  };

  const getSurveyStatus = (survey: Survey) => {
    if (!survey.settings.acceptingResponses) return { label: "受付終了", color: "bg-gray-100 text-gray-600 border-gray-200" };
    
    const now = Date.now();
    const start = survey.settings.startDate ? new Date(survey.settings.startDate).getTime() : 0;
    const end = survey.settings.endDate ? new Date(survey.settings.endDate).getTime() : Infinity;

    if (now < start) return { label: "受付前", color: "bg-amber-100 text-amber-700 border-amber-200" };
    if (now > end) return { label: "受付終了", color: "bg-gray-100 text-gray-600 border-gray-200" };
    
    return { label: "受付中", color: "bg-green-100 text-green-700 border-green-200" };
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">作成済みのフォーム</h2>
          <p className="text-sm text-gray-500 mt-1">アンケートや投票を作成・管理します。</p>
        </div>
        <button onClick={onNew} className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-bold rounded-md text-white bg-purple-600 hover:bg-purple-700 transition-colors">
          <Plus className="h-5 w-5 mr-1" /> 新規作成
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12"><div className="animate-spin h-8 w-8 text-purple-600 mx-auto rounded-full border-4 border-t-transparent"></div></div>
      ) : surveys.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <LayoutList className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">フォームがありません</h3>
          <p className="text-gray-500 text-sm mb-6">新しいアンケートや投票を作成して、意見を集めましょう。</p>
          <button onClick={onNew} className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-bold rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors">
            <Plus className="h-5 w-5 mr-1" /> はじめてのフォームを作成
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {surveys.map(survey => {
            const editable = canEdit(survey);
            const accConf = getAccessTargetLabel(survey.settings.accessTarget);
            const isAnonymous = !survey.settings.collectRespondentInfo;
            const status = getSurveyStatus(survey);

            return (
              <div key={survey.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow relative group">
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-extrabold text-gray-900 line-clamp-2 pr-2">{survey.title}</h3>
                    <div className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap border ${status.color}`}>
                      {status.label}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-4">{survey.description || "説明なし"}</p>
                  
                  <div className="flex items-center flex-wrap gap-1.5 text-[10px] font-bold mt-auto mb-2">
                    <span className={`flex items-center px-1.5 py-0.5 rounded border ${accConf.color}`}>{accConf.icon} {accConf.label}</span>
                    {isAnonymous && (
                      <span className="flex items-center text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                        <UserX className="w-3 h-3 mr-1" /> 匿名
                      </span>
                    )}
                    {survey.settings.timeLimit && (
                      <span className="flex items-center text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                        <Clock className="w-3 h-3 mr-1" /> {survey.settings.timeLimit}分制限
                      </span>
                    )}
                  </div>

                  {(survey.settings.startDate || survey.settings.endDate) && (
                    <div className="text-[10px] text-gray-500 font-bold bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100 mt-2 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <div>
                        {survey.settings.startDate ? new Date(survey.settings.startDate).toLocaleDateString('ja-JP', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}) : "開始指定なし"}
                        {" 〜 "}
                        {survey.settings.endDate ? new Date(survey.settings.endDate).toLocaleDateString('ja-JP', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}) : "期限なし"}
                      </div>
                    </div>
                  )}

                  <div className="text-[9px] text-gray-400 mt-3 font-mono text-right">
                    作成: {survey.createdAt ? new Date(survey.createdAt).toLocaleDateString('ja-JP') : "不明"}
                  </div>
                </div>
                
                {/* ★ すべての機能にアクセスできるフラットなボタンエリア */}
                <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-y-2 gap-x-1.5">
                  <div className="flex gap-1.5 flex-wrap">
                    {editable ? (
                      <>
                        <button onClick={() => onEdit(survey, "questions")} className="inline-flex items-center px-2.5 py-1.5 border border-purple-200 text-xs font-bold rounded bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors">
                          <Edit2 className="h-3 w-3 mr-1" /> 編集
                        </button>
                        <button onClick={() => onEdit(survey, "settings")} className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-bold rounded bg-white text-gray-700 hover:bg-gray-50 transition-colors">
                          <Settings className="h-3 w-3 mr-1" /> 設定
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400 px-2 py-1 bg-gray-100 rounded border border-gray-200">閲覧専用</span>
                    )}
                  </div>
                  
                  <div className="flex gap-1.5 flex-wrap ml-auto">
                    <Link href={`/s/${survey.id}`} target="_blank" className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-bold rounded bg-white text-gray-700 hover:bg-gray-50 transition-colors">
                      <Play className="h-3 w-3 mr-1 text-gray-400" /> プレビュー
                    </Link>
                    
                    {editable && (
                      <Link href={`/top/surveys/${survey.id}/responses?tab=summary`} className="inline-flex items-center px-2.5 py-1.5 border border-indigo-200 text-xs font-bold rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
                        <BarChart3 className="h-3 w-3 mr-1" /> 結果 {survey.responsesCount !== undefined && `(${survey.responsesCount})`}
                      </Link>
                    )}
                    
                    <button onClick={() => onCopyUrl(survey.id)} className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-bold rounded bg-white text-gray-700 hover:bg-gray-50 transition-colors">
                      <Share2 className="h-3 w-3 mr-1" /> URL
                    </button>
                    
                    {editable && (
                      <button onClick={() => onDelete(survey.id)} className="inline-flex items-center px-2.5 py-1.5 border border-red-200 text-xs font-bold rounded bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}