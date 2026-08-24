"use client";

import React, { useState, useEffect, useMemo } from "react";
import { SurveySettings, UserData } from "../types";
import { Calendar, Clock, Lock, Shield, Users, Search, Globe, UserCheck, AlertCircle } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Props = {
  settings: SurveySettings;
  setSettings: React.Dispatch<React.SetStateAction<SurveySettings>>;
  tenantUsers: UserData[];
};

export default function SurveySettingsEditor({ settings, setSettings, tenantUsers }: Props) {
  const [externalUsers, setExternalUsers] = useState<UserData[]>([]);
  const [isLoadedExtUsers, setIsLoadedExtUsers] = useState(false);
  
  // 回答対象者用タブ
  const [respondentTab, setRespondentTab] = useState<"tenant" | "external">("tenant");
  const [tenantSearch, setTenantSearch] = useState("");
  const [extSearch, setExtSearch] = useState("");
  const [extCategoryFilter, setExtCategoryFilter] = useState("all");

  // 必須回答ユーザー用タブと検索・フィルター
  const [requiredTab, setRequiredTab] = useState<"tenant" | "external">("tenant");
  const [reqTenantSearch, setReqTenantSearch] = useState("");
  const [reqExtSearch, setReqExtSearch] = useState("");
  const [reqExtCategoryFilter, setReqExtCategoryFilter] = useState("all");

  const update = (key: keyof SurveySettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (!isLoadedExtUsers && tenantUsers.length > 0) {
      const fetchExt = async () => {
        try {
          const schoolId = tenantUsers[0].schoolId;
          const qExt = query(collection(db, "external_users"), where("schoolId", "==", schoolId));
          const snap = await getDocs(qExt);
          const extList: UserData[] = [];
          snap.forEach(d => extList.push({ id: d.id, ...d.data() } as UserData));
          setExternalUsers(extList);
          setIsLoadedExtUsers(true);
        } catch (e) {
          console.error(e);
        }
      };
      fetchExt();
    }
  }, [tenantUsers, isLoadedExtUsers]);

  const sortedTenantUsers = useMemo(() => {
    return [...tenantUsers].filter(u => 
      !tenantSearch || u.name.toLowerCase().includes(tenantSearch.toLowerCase()) || (u.systemId && String(u.systemId).includes(tenantSearch))
    ).sort((a, b) => {
      const idA = a.systemId || "";
      const idB = b.systemId || "";
      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [tenantUsers, tenantSearch]);

  const filteredExternalUsers = useMemo(() => {
    return externalUsers.filter(u => {
      const matchSearch = !extSearch || u.name.toLowerCase().includes(extSearch.toLowerCase()) || ((u as any).affiliation || "").toLowerCase().includes(extSearch.toLowerCase());
      const matchCat = extCategoryFilter === "all" || (u as any).category === extCategoryFilter;
      return matchSearch && matchCat;
    }).sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }, [externalUsers, extSearch, extCategoryFilter]);

  // ★ 必須回答に表示できるユーザーを、アクセス対象（公開範囲）や選択ユーザーに基づいて自動フィルタリング
  const availableRequiredTenantUsers = useMemo(() => {
    return sortedTenantUsers.filter(u => {
      if (settings.accessTarget === "selected_users") {
        return settings.respondentIds.includes(u.id);
      }
      return true; // tenant_members, external_users, public なら全員対象
    });
  }, [sortedTenantUsers, settings.accessTarget, settings.respondentIds]);

  const availableRequiredExternalUsers = useMemo(() => {
    return filteredExternalUsers.filter(u => {
      if (settings.accessTarget === "tenant_members") return false; // テナント内限定の場合は外部は除外
      if (settings.accessTarget === "selected_users") {
        return settings.respondentIds.includes(u.id);
      }
      return true; // external_users, public なら対象
    });
  }, [filteredExternalUsers, settings.accessTarget, settings.respondentIds]);

  const sortedReqTenantUsers = useMemo(() => {
    return availableRequiredTenantUsers.filter(u => 
      !reqTenantSearch || u.name.toLowerCase().includes(reqTenantSearch.toLowerCase()) || (u.systemId && String(u.systemId).includes(reqTenantSearch))
    );
  }, [availableRequiredTenantUsers, reqTenantSearch]);

  const filteredReqExternalUsers = useMemo(() => {
    return availableRequiredExternalUsers.filter(u => {
      const matchSearch = !reqExtSearch || u.name.toLowerCase().includes(reqExtSearch.toLowerCase()) || ((u as any).affiliation || "").toLowerCase().includes(reqExtSearch.toLowerCase());
      const matchCat = reqExtCategoryFilter === "all" || (u as any).category === reqExtCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [availableRequiredExternalUsers, reqExtSearch, reqExtCategoryFilter]);

  const toggleArray = (field: "editorIds" | "respondentIds" | "requiredRespondentIds", id: string) => {
    setSettings(prev => {
      const arr = prev[field];
      return { ...prev, [field]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
    });
  };

  const setAllArray = (field: "editorIds" | "respondentIds" | "requiredRespondentIds", val: boolean, targetList: UserData[]) => {
    setSettings(prev => {
      const targetIds = targetList.map(u => u.id);
      const arr = prev[field];
      if (val) {
        const merged = Array.from(new Set([...arr, ...targetIds]));
        return { ...prev, [field]: merged };
      } else {
        return { ...prev, [field]: arr.filter(id => !targetIds.includes(id)) };
      }
    });
  };

  const handleCollectInfoChange = (checked: boolean) => {
    setSettings(prev => {
      const next = { ...prev, collectRespondentInfo: checked };
      if (checked) {
        next.collectEmail = true;
      } else {
        next.collectEmail = false;
        next.allowEditResponse = false;
        next.limitToOneResponse = false;
      }
      return next;
    });
  };

  const handleLimitToOneChange = (checked: boolean) => {
    setSettings(prev => {
      const next = { ...prev, limitToOneResponse: checked };
      if (checked) next.allowEditResponse = false; 
      return next;
    });
  };

  const handleTimeLimitChange = (val: number | null) => {
    setSettings(prev => {
      const next = { ...prev, timeLimit: val };
      if (val && val > 0) {
        next.allowEditResponse = false; 
      }
      return next;
    });
  };

  const handleAllowEditChange = (checked: boolean) => {
    setSettings(prev => {
      const next = { ...prev, allowEditResponse: checked };
      if (checked) {
        next.limitToOneResponse = false; 
        next.timeLimit = null; 
      }
      return next;
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 animate-fade-in font-sans">
      
      <section className="bg-white rounded-xl shadow-sm border border-purple-200 overflow-hidden">
        <div className="bg-purple-50/80 px-5 py-3 border-b border-purple-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-600" />
          <h3 className="text-sm font-black text-purple-900">回答期間と回答制限時間</h3>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-gray-700 mb-1">回答開始日時</label>
              <input
                type="datetime-local"
                value={settings.startDate ? settings.startDate.substring(0, 16) : ""}
                onChange={e => update("startDate", e.target.value || null)}
                className="w-full bg-white border border-gray-300 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-[10px] text-gray-400 font-bold mt-1 block">未設定の場合はすぐに回答可能</span>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-700 mb-1">回答締切日時</label>
              <input
                type="datetime-local"
                value={settings.endDate ? settings.endDate.substring(0, 16) : ""}
                onChange={e => update("endDate", e.target.value || null)}
                className="w-full bg-white border border-gray-300 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-[10px] text-gray-400 font-bold mt-1 block">未設定の場合は無期限</span>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100">
            <label className="block text-xs font-black text-gray-700 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-600" />
              回答制限時間（分単位）
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                placeholder="例: 30"
                value={settings.timeLimit || ""}
                onChange={e => handleTimeLimitChange(e.target.value ? Number(e.target.value) : null)}
                className="w-32 bg-white border border-gray-300 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-xs font-bold text-gray-700">分</span>
            </div>
            <p className="text-[10px] font-bold text-gray-500 mt-1.5 leading-relaxed">
              ※ 設定すると、回答開始ボタン押下後にタイマーが開始されます。制限時間を過ぎた場合、回答内容は自動送信されます。<br/>
              ※ 制限時間を設定した場合、「回答の編集」は許可できなくなります。
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-5 py-3 border-b border-gray-100"><h3 className="text-sm font-black text-gray-800">公開と権限</h3></div>
        <div className="p-5 space-y-6">
          <div>
            <label className="block text-xs font-black text-gray-700 mb-2">アンケートの回答対象者（公開範囲）</label>
            <select value={settings.accessTarget} onChange={e => update("accessTarget", e.target.value)} className="w-full bg-white border border-gray-300 text-sm font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500">
              <option value="tenant_members">限定公開 (テナント内のメンバー)</option>
              <option value="external_users">限定公開 (テナント＋外部連携)</option>
              <option value="selected_users">限定公開 (指定したユーザーのみ ※内部・外部選択可)</option>
              <option value="public">一般公開 (ログイン不要・誰でも)</option>
            </select>
            <p className="text-[10px] text-gray-500 mt-1 font-bold">
              ※ 一般公開以外は、回答時にアカウントでのログインが必須となります。
            </p>
            
            {settings.accessTarget === "selected_users" && (
              <div className="mt-3 p-3 border border-indigo-100 rounded-xl bg-indigo-50/20 space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                  <div className="flex bg-white p-1 rounded-lg border border-indigo-200 text-xs font-bold">
                    <button type="button" onClick={() => setRespondentTab("tenant")} className={`px-3 py-1 rounded-md transition-colors ${respondentTab === "tenant" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>
                      内部メンバー ({tenantUsers.length})
                    </button>
                    <button type="button" onClick={() => setRespondentTab("external")} className={`px-3 py-1 rounded-md transition-colors ${respondentTab === "external" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>
                      外部ユーザー ({externalUsers.length})
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-indigo-700">選択中: {settings.respondentIds.length}名</span>
                    <button type="button" onClick={() => setAllArray("respondentIds", true, respondentTab === "tenant" ? sortedTenantUsers : filteredExternalUsers)} className="text-[10px] font-bold text-indigo-600 hover:underline bg-white px-2 py-1 rounded border border-indigo-200">表示中を全選択</button>
                    <button type="button" onClick={() => setAllArray("respondentIds", false, respondentTab === "tenant" ? sortedTenantUsers : filteredExternalUsers)} className="text-[10px] font-bold text-gray-500 hover:underline bg-white px-2 py-1 rounded border border-gray-200">表示中を解除</button>
                  </div>
                </div>

                {respondentTab === "tenant" ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="text" placeholder="内部メンバーを検索..." value={tenantSearch} onChange={e => setTenantSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar bg-white rounded-lg border border-indigo-100 p-1.5 space-y-0.5">
                      {sortedTenantUsers.map(u => (
                        <label key={u.id} className="flex items-center gap-2 py-1 px-2 cursor-pointer hover:bg-indigo-50/60 rounded text-xs font-bold text-gray-700">
                          <input type="checkbox" checked={settings.respondentIds.includes(u.id)} onChange={() => toggleArray("respondentIds", u.id)} className="w-3.5 h-3.5 text-indigo-600 rounded" />
                          {u.systemId ? <span className="font-mono text-purple-600">[{u.systemId}]</span> : null}
                          <span className="truncate flex-1">{u.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="text" placeholder="外部ユーザー名・所属で検索..." value={extSearch} onChange={e => setExtSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-500"
                        />
                      </div>
                      <select value={extCategoryFilter} onChange={e => setExtCategoryFilter(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none">
                        <option value="all">すべての区分</option>
                        <option value="student">生徒</option>
                        <option value="teacher">教職員</option>
                        <option value="other">その他</option>
                      </select>
                    </div>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar bg-white rounded-lg border border-indigo-100 p-1.5 space-y-0.5">
                      {filteredExternalUsers.length === 0 ? (
                        <p className="text-[10px] text-gray-400 text-center py-4 font-bold">外部ユーザーが見つかりません</p>
                      ) : (
                        filteredExternalUsers.map(u => (
                          <label key={u.id} className="flex items-center justify-between py-1 px-2 cursor-pointer hover:bg-indigo-50/60 rounded text-xs font-bold text-gray-700">
                            <div className="flex items-center gap-2 min-w-0">
                              <input type="checkbox" checked={settings.respondentIds.includes(u.id)} onChange={() => toggleArray("respondentIds", u.id)} className="w-3.5 h-3.5 text-indigo-600 rounded shrink-0" />
                              <span className="truncate">{u.name}</span>
                            </div>
                            <span className="text-[10px] text-gray-400 font-normal shrink-0 ml-2">{(u as any).affiliation || "所属なし"}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {settings.accessTarget !== "public" && (
            <div className="pt-4 border-t border-gray-100">
              <label className="block text-xs font-black text-gray-700 mb-1">必須回答ユーザーの指定</label>
              <p className="text-[10px] text-gray-400 font-bold mb-2">※ 上記の公開範囲・対象者として選択されているメンバーのみ選択できます。</p>

              <div className="p-3 border border-rose-100 rounded-xl bg-rose-50/20 space-y-3">
                <div className="flex items-center justify-between border-b border-rose-100 pb-2">
                  <div className="flex bg-white p-1 rounded-lg border border-rose-200 text-xs font-bold">
                    <button type="button" onClick={() => setRequiredTab("tenant")} className={`px-3 py-1 rounded-md transition-colors ${requiredTab === "tenant" ? "bg-rose-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>
                      内部メンバー ({availableRequiredTenantUsers.length})
                    </button>
                    {settings.accessTarget !== "tenant_members" && (
                      <button type="button" onClick={() => setRequiredTab("external")} className={`px-3 py-1 rounded-md transition-colors ${requiredTab === "external" ? "bg-rose-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>
                        外部ユーザー ({availableRequiredExternalUsers.length})
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-rose-700">選択中: {settings.requiredRespondentIds.length}名</span>
                    <button type="button" onClick={() => setAllArray("requiredRespondentIds", true, requiredTab === "tenant" ? sortedReqTenantUsers : filteredReqExternalUsers)} className="text-[10px] font-bold text-rose-600 hover:underline bg-white px-2 py-1 rounded border border-rose-200">表示中を全選択</button>
                    <button type="button" onClick={() => setAllArray("requiredRespondentIds", false, requiredTab === "tenant" ? sortedReqTenantUsers : filteredReqExternalUsers)} className="text-[10px] font-bold text-gray-500 hover:underline bg-white px-2 py-1 rounded border border-gray-200">表示中を解除</button>
                  </div>
                </div>

                {requiredTab === "tenant" ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="text" placeholder="内部メンバーを検索..." value={reqTenantSearch} onChange={e => setReqTenantSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-rose-500"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar bg-white rounded-lg border border-rose-100 p-1.5 space-y-0.5">
                      {sortedReqTenantUsers.length === 0 ? (
                        <p className="text-[10px] text-gray-400 text-center py-4 font-bold">対象となる内部メンバーがいません</p>
                      ) : (
                        sortedReqTenantUsers.map(u => (
                          <label key={u.id} className="flex items-center gap-2 py-1 px-2 cursor-pointer hover:bg-rose-50/60 rounded text-xs font-bold text-gray-700">
                            <input type="checkbox" checked={settings.requiredRespondentIds.includes(u.id)} onChange={() => toggleArray("requiredRespondentIds", u.id)} className="w-3.5 h-3.5 text-rose-600 rounded" />
                            {u.systemId ? <span className="font-mono text-purple-600">[{u.systemId}]</span> : null}
                            <span className="truncate flex-1">{u.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="text" placeholder="外部ユーザー名・所属で検索..." value={reqExtSearch} onChange={e => setReqExtSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-rose-500"
                        />
                      </div>
                      <select value={reqExtCategoryFilter} onChange={e => setReqExtCategoryFilter(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none">
                        <option value="all">すべての区分</option>
                        <option value="student">生徒</option>
                        <option value="teacher">教職員</option>
                        <option value="other">その他</option>
                      </select>
                    </div>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar bg-white rounded-lg border border-rose-100 p-1.5 space-y-0.5">
                      {filteredReqExternalUsers.length === 0 ? (
                        <p className="text-[10px] text-gray-400 text-center py-4 font-bold">対象となる外部ユーザーがいません</p>
                      ) : (
                        filteredReqExternalUsers.map(u => (
                          <label key={u.id} className="flex items-center justify-between py-1 px-2 cursor-pointer hover:bg-rose-50/60 rounded text-xs font-bold text-gray-700">
                            <div className="flex items-center gap-2 min-w-0">
                              <input type="checkbox" checked={settings.requiredRespondentIds.includes(u.id)} onChange={() => toggleArray("requiredRespondentIds", u.id)} className="w-3.5 h-3.5 text-rose-600 rounded shrink-0" />
                              <span className="truncate">{u.name}</span>
                            </div>
                            <span className="text-[10px] text-gray-400 font-normal shrink-0 ml-2">{(u as any).affiliation || "所属なし"}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-100">
            <label className="block text-xs font-black text-gray-700 mb-2">編集権限（このアンケートを編集できる人）</label>
            <select value={settings.visibility} onChange={e => update("visibility", e.target.value)} className="w-full bg-white border border-gray-300 text-sm font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500">
              <option value="private">自分だけ</option>
              <option value="tenant_all">テナントの全メンバー</option>
              <option value="selected_users">指定したユーザー</option>
            </select>
            {settings.visibility === "selected_users" && (
              <div className="mt-3 p-3 border border-gray-200 rounded-lg bg-gray-50 max-h-48 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between mb-2 border-b border-gray-200 pb-2">
                  <span className="text-[10px] font-bold text-gray-600">編集を許可するユーザー（システム利用番号順）</span>
                  <button type="button" onClick={() => setAllArray("editorIds", true, sortedTenantUsers)} className="text-[10px] text-purple-600 hover:underline">全選択</button>
                </div>
                {sortedTenantUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-100 rounded px-1">
                    <input type="checkbox" checked={settings.editorIds.includes(u.id)} onChange={() => toggleArray("editorIds", u.id)} className="w-3.5 h-3.5 text-purple-600 rounded" />
                    <span className="text-xs font-bold text-gray-700">
                      {u.systemId ? <span className="font-mono text-purple-600 mr-1.5">[{u.systemId}]</span> : null}
                      {u.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-5 py-3 border-b border-gray-100"><h3 className="text-sm font-black text-gray-800">回答の制御</h3></div>
        <div className="p-5 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-bold text-gray-900">回答を受付中</span>
            <input type="checkbox" checked={settings.acceptingResponses} onChange={e => update("acceptingResponses", e.target.checked)} className="h-5 w-5 rounded text-purple-600 border-gray-300" />
          </label>
          <p className="text-[10px] text-gray-500 font-bold -mt-2">オフにすると回答フォームが直ちに閉じられます。</p>

          <div className="border-t border-gray-100 pt-4 mt-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-bold text-gray-900">回答者情報を収集する</span>
              <input type="checkbox" checked={settings.collectRespondentInfo} onChange={e => handleCollectInfoChange(e.target.checked)} className="h-5 w-5 rounded text-purple-600 border-gray-300" />
            </label>
            <p className="text-[10px] text-gray-500 font-bold mt-1">
              オフにすると完全な「匿名回答」になります。個人を特定する機能（1回制限やメール収集など）は利用できなくなります。
            </p>
          </div>

          <div className={`space-y-4 pt-4 border-t border-gray-100 ${!settings.collectRespondentInfo ? 'opacity-50 pointer-events-none' : ''}`}>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-bold text-gray-900">メールアドレスを収集する</span>
              <input type="checkbox" disabled={!settings.collectRespondentInfo} checked={settings.collectEmail} onChange={e => update("collectEmail", e.target.checked)} className="h-5 w-5 rounded text-purple-600 border-gray-300" />
            </label>
            
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-bold text-gray-900 block">回答を1回に制限する（一発勝負）</span>
                <span className="text-[10px] text-gray-500 font-bold">ONにすると、回答後の再回答や内容の編集ができなくなります。</span>
              </div>
              <input 
                type="checkbox" 
                disabled={!settings.collectRespondentInfo} 
                checked={settings.limitToOneResponse} 
                onChange={e => handleLimitToOneChange(e.target.checked)} 
                className="h-5 w-5 rounded text-purple-600 border-gray-300" 
              />
            </label>

            <label className={`flex items-center justify-between cursor-pointer ${(!settings.collectRespondentInfo || !!settings.timeLimit) ? 'opacity-50 pointer-events-none' : ''}`}>
              <div>
                <span className="text-sm font-bold text-gray-900 block">回答の編集を許可する</span>
                <span className={`text-[10px] font-bold ${settings.timeLimit ? 'text-red-500' : 'text-gray-500'}`}>
                  {settings.timeLimit ? "制限時間が設定されているため、編集は許可できません。" : "ONにすると、送信後も自分の回答を自由に上書き編集できます。"}
                </span>
              </div>
              <input 
                type="checkbox" 
                disabled={!settings.collectRespondentInfo || !!settings.timeLimit} 
                checked={settings.allowEditResponse} 
                onChange={e => handleAllowEditChange(e.target.checked)} 
                className="h-5 w-5 rounded text-purple-600 border-gray-300" 
              />
            </label>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-5 py-3 border-b border-gray-100"><h3 className="text-sm font-black text-gray-800">テスト (クイズ)</h3></div>
        <div className="p-5 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-bold text-gray-900">テストにする</span>
            <input type="checkbox" checked={settings.isQuiz} onChange={e => update("isQuiz", e.target.checked)} className="h-5 w-5 rounded text-purple-600 border-gray-300" />
          </label>
          <p className="text-[10px] text-gray-500 font-bold -mt-2">点数の割り当て、自動採点、フィードバックの提供が可能になります。</p>
          
          {settings.isQuiz && (
            <div className="pt-4 border-t border-gray-100 space-y-4 animate-fade-in">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">成績の発表</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2"><input type="radio" checked={settings.releaseGrades === "immediately"} onChange={() => update("releaseGrades", "immediately")} className="text-purple-600" /><span className="text-sm text-gray-800">送信直後に表示</span></label>
                  <label className="flex items-center gap-2"><input type="radio" checked={settings.releaseGrades === "manual"} onChange={() => update("releaseGrades", "manual")} className="text-purple-600" /><span className="text-sm text-gray-800">確認後に手動で表示する（表示ボタンを押すまで隠す）</span></label>
                  <label className="flex items-center gap-2"><input type="radio" checked={settings.releaseGrades === "never"} onChange={() => update("releaseGrades", "never")} className="text-purple-600" /><span className="text-sm text-gray-800">成績を発表しない</span></label>
                </div>
              </div>
              <div className={`transition-opacity ${settings.releaseGrades === "never" ? 'opacity-50 pointer-events-none' : ''}`}>
                <label className="block text-xs font-bold text-gray-700 mb-2">回答者の設定（成績発表時に表示する内容）</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={settings.showMissedQuestions} onChange={e => update("showMissedQuestions", e.target.checked)} className="rounded text-purple-600" /><span className="text-sm text-gray-800">不正解だった質問を表示</span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={settings.showCorrectAnswers} onChange={e => update("showCorrectAnswers", e.target.checked)} className="rounded text-purple-600" /><span className="text-sm text-gray-800">正解を表示</span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={settings.showPointValues} onChange={e => update("showPointValues", e.target.checked)} className="rounded text-purple-600" /><span className="text-sm text-gray-800">点数を表示</span></label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">新しい質問のデフォルトの点数</label>
                <input type="number" min="0" value={settings.defaultPoints} onChange={e => update("defaultPoints", Number(e.target.value))} className="w-24 px-3 py-1.5 border border-gray-300 rounded-md text-sm outline-none" />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-5 py-3 border-b border-gray-100"><h3 className="text-sm font-black text-gray-800">表示設定</h3></div>
        <div className="p-5 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-bold text-gray-900">進行状況バーを表示</span>
            <input type="checkbox" checked={settings.showProgressBar} onChange={e => update("showProgressBar", e.target.checked)} className="h-5 w-5 rounded text-purple-600 border-gray-300" />
          </label>
          
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-1">質問の順序をシャッフルする</label>
            <select value={settings.shuffleQuestions} onChange={e => update("shuffleQuestions", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
              <option value="off">オフ</option>
              <option value="all">すべての問題</option>
              <option value="except_locked">一部の問題をロックしてシャッフル</option>
            </select>
            {settings.shuffleQuestions === "except_locked" && (
              <input type="text" placeholder="例: 1-3" value={settings.lockedQuestionRange} onChange={e => update("lockedQuestionRange", e.target.value)} className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
            )}
          </div>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-bold text-gray-900">別の回答を送信するためのリンクを表示</span>
            <input type="checkbox" checked={settings.showLinkToSubmitAnother} onChange={e => update("showLinkToSubmitAnother", e.target.checked)} className="h-5 w-5 rounded text-purple-600 border-gray-300" />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-bold text-gray-900">結果の概要を表示する</span>
            <input type="checkbox" checked={settings.showResultsSummary} onChange={e => update("showResultsSummary", e.target.checked)} className="h-5 w-5 rounded text-purple-600 border-gray-300" />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-bold text-gray-900">すべての回答者に対して自動保存を無効にする</span>
            <input type="checkbox" checked={settings.disableAutosave} onChange={e => update("disableAutosave", e.target.checked)} className="h-5 w-5 rounded text-purple-600 border-gray-300" />
          </label>

          <div className="pt-2">
            <label className="block text-sm font-bold text-gray-900 mb-1">確認メッセージ（お礼）</label>
            <textarea rows={2} value={settings.confirmationMessage} onChange={e => update("confirmationMessage", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none resize-none custom-scrollbar" />
          </div>
        </div>
      </section>

    </div>
  );
}