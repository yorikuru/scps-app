"use client";

import React from "react";
import { FileText, Lock, Globe, Users, Shield } from "lucide-react";
import { Survey, SurveyAccessTarget } from "../types";

type Props = {
  survey: Survey | null;
};

export default function SurveyHeader({ survey }: Props) {
  const getAccessTargetLabel = (target: SurveyAccessTarget) => {
    switch(target) {
      case "public": return { label: "一般公開", icon: <Globe className="h-3 w-3 mr-1" />, color: "text-blue-700 bg-blue-50 border-blue-200" };
      case "external_users": return { label: "外部ユーザーも可", icon: <Users className="h-3 w-3 mr-1" />, color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
      case "selected_users": return { label: "指定ユーザー限定", icon: <Lock className="h-3 w-3 mr-1" />, color: "text-orange-700 bg-orange-50 border-orange-200" };
      case "tenant_members": default: return { label: "テナント内限定", icon: <Shield className="h-3 w-3 mr-1" />, color: "text-indigo-700 bg-indigo-50 border-indigo-200" };
    }
  };

  const accConf = survey ? getAccessTargetLabel(survey.settings.accessTarget) : null;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center text-purple-600 font-extrabold text-lg">
          <FileText className="h-5 w-5 mr-2" /> 回答フォーム
        </div>
        <div className="flex items-center gap-2">
          {accConf && (
            <span className={`flex items-center px-2 py-1 rounded text-[10px] font-bold border ${accConf.color}`}>
              {accConf.icon} {accConf.label}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}