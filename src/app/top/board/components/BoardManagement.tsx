"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import * as LucideIcons from "lucide-react";
import { Search, Edit2, Trash2, AlertOctagon, Calendar, ArrowDownUp, Clock, Globe, Eye, Check, Users, FileStack, FileSpreadsheet, AlertCircle, MessageSquareText, ChevronLeft, CheckSquare } from "lucide-react";
import { Announcement, Category, UserData, AppConfig, COLOR_MAPPINGS } from "../types";
import { ExternalUser } from "@/app/types/external";
import * as XLSX from "xlsx"; 
import CustomSelect from "@/components/CustomSelect"; // ★ CustomSelectをインポート

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

type Props = {
  announcements: Announcement[];
  categories: Category[];
  userData: UserData | null;
  tenantUsers: UserData[]; 
  externalUsers: ExternalUser[];
  appConfig: AppConfig;
  onEdit: (announcement: Announcement) => void;
  onDelete: (id: string) => Promise<void>;
  canManageAll: boolean;
};

export default function BoardManagement({ announcements, categories, userData, tenantUsers, externalUsers, appConfig, onEdit, onDelete, canManageAll }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlId = searchParams.get("id");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const [filterExternal, setFilterExternal] = useState<"all" | "external" | "not_external">("all");
  const [filterInternal, setFilterInternal] = useState<"all" | "internal" | "not_internal">("all");
  const [filterAuthor, setFilterAuthor] = useState<string>("all");
  const [filterRequireAction, setFilterRequireAction] = useState(false);
  const [filterActionStatus, setFilterActionStatus] = useState<"all" | "completed" | "incomplete">("all");
  
  const [showExpired, setShowExpired] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(urlId || null);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [readStatusTab, setReadStatusTab] = useState<"internal" | "external">("internal");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const c = COLOR_MAPPINGS[appConfig.color] || COLOR_MAPPINGS.default;
  const now = new Date().getTime();

  useEffect(() => {
    if (urlId && urlId !== selectedId) {
      setSelectedId(urlId);
    }
  }, [urlId]);

  const authors = useMemo(() => {
    const map = new Map<string, string>();
    announcements.forEach(a => map.set(a.authorId, a.authorName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [announcements]);

  const getReadStatusData = (a: Announcement) => {
    const readExtRaw = a.readByExternal || [];
    const readIntRaw = a.readByInternal || [];
    const actionExtRaw = a.actionByExternal || [];
    const actionIntRaw = a.actionByInternal || [];

    const getInteractionInfo = (readList: any[], actionList: any[], targetUsers: any[], isInternal: boolean) => {
      let readCount = 0;
      let actionCount = 0;

      const users = targetUsers.map(u => {
        const readObj = readList.find(r => (typeof r === 'object' ? r.userId : r) === u.id);
        const actionObj = actionList.find(r => (typeof r === 'object' ? r.userId : r) === u.id);
        
        let isRead = !!readObj;
        let readAt = readObj?.readAt || null;
        
        if (isInternal && u.id === a.authorId && !isRead) {
          isRead = true;
          readAt = a.createdAt;
        }
        
        const isActioned = !!actionObj;
        const actionAt = actionObj?.actionAt || null;

        if (isRead) readCount++;
        if (isActioned) actionCount++;

        return { ...u, isRead, readAt, isActioned, actionAt };
      });

      return { users, readCount, actionCount };
    }

    const getIntTargets = () => {
      if (a.isInternalAlso === false) return [];
      if (a.targetType === "individual") return tenantUsers.filter(u => a.targetUserIds?.includes(u.id));
      if (a.targetType === "position") {
        const pIds = a.targetPositionIds || [];
        return tenantUsers.filter(u => {
          if (pIds.includes("sys_admin") && (u.role === "admin" || u.role === "system_admin" || u.isITManager)) return true;
          if (pIds.includes("sys_student") && u.role === "student") return true;
          if (pIds.includes("sys_teacher") && u.role === "teacher") return true;
          if (u.positionIds?.some(pid => pIds.includes(pid))) return true;
          return false;
        });
      }
      return tenantUsers;
    };

    const getExtTargets = () => {
      if (!a.isExternal) return [];
      if (a.extTargetType === "individual") return externalUsers.filter(u => a.extTargetUserIds?.includes(u.id));
      return externalUsers;
    };

    const intTarget = getIntTargets();
    const extTarget = getExtTargets();

    const intData = getInteractionInfo(readIntRaw, actionIntRaw, intTarget, true);
    const extData = getInteractionInfo(readExtRaw, actionExtRaw, extTarget, false);

    return {
      internal: {
        isTarget: a.isInternalAlso !== false,
        total: intTarget.length,
        readCount: intData.readCount,
        actionCount: intData.actionCount,
        users: intData.users.sort((u1, u2) => Number(u2.isRead) - Number(u1.isRead))
      },
      external: {
        isTarget: a.isExternal,
        total: extTarget.length,
        readCount: extData.readCount,
        actionCount: extData.actionCount,
        users: extData.users.sort((u1, u2) => Number(u2.isRead) - Number(u1.isRead))
      }
    };
  };

  const isTaskCompletedForManagement = (a: Announcement) => {
    if (!a.requireAction) return true;
    const stats = getReadStatusData(a);
    const total = (stats.internal.isTarget ? stats.internal.total : 0) + (stats.external.isTarget ? stats.external.total : 0);
    const actioned = (stats.internal.isTarget ? stats.internal.actionCount : 0) + (stats.external.isTarget ? stats.external.actionCount : 0);

    if (a.actionType === "single") {
      return actioned > 0;
    } else {
      return actioned >= total && total > 0;
    }
  };

  const filteredAndSorted = announcements
    .filter(a => {
      if (canManageAll) return true;
      return a.authorId === userData?.id;
    })
    .filter(a => filterCategory === "all" || a.categoryId === filterCategory)
    .filter(a => filterAuthor === "all" || a.authorId === filterAuthor)
    .filter(a => {
      if (filterExternal === "external") return a.isExternal;
      if (filterExternal === "not_external") return !a.isExternal;
      return true;
    })
    .filter(a => {
      if (filterInternal === "internal") return a.isInternalAlso !== false;
      if (filterInternal === "not_internal") return a.isInternalAlso === false;
      return true;
    })
    .filter(a => {
      if (!showExpired) {
        const end = a.publishEndDate ? new Date(a.publishEndDate).getTime() : null;
        if (end && end < now) return false;
      }
      return true;
    })
    .filter(a => !filterRequireAction || a.requireAction)
    .filter(a => {
      if (filterActionStatus === "all") return true;
      if (!a.requireAction) return false;
      const completed = isTaskCompletedForManagement(a);
      if (filterActionStatus === "completed") return completed;
      if (filterActionStatus === "incomplete") return !completed;
      return true;
    })
    .filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.authorName.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const timeA = a.publishStartDate ? new Date(a.publishStartDate).getTime() : new Date(a.createdAt).getTime();
      const timeB = b.publishStartDate ? new Date(b.publishStartDate).getTime() : new Date(b.createdAt).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });

  const getStatusBadge = (a: Announcement) => {
    const start = a.publishStartDate ? new Date(a.publishStartDate).getTime() : new Date(a.createdAt).getTime();
    const end = a.publishEndDate ? new Date(a.publishEndDate).getTime() : null;
    const badges = [];

    if (a.requireAction) {
      if (isTaskCompletedForManagement(a)) {
        badges.push(<span key="action" className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-100 text-indigo-700 flex items-center mr-1"><CheckSquare className="w-2.5 h-2.5 mr-0.5" />対応完了</span>);
      } else {
        badges.push(<span key="action" className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-100 text-rose-700 flex items-center mr-1"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />要対応</span>);
      }
    }
    if (a.isExternal) badges.push(<span key="ext" className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-100 text-blue-700 flex items-center mr-1"><Globe className="w-2.5 h-2.5 mr-0.5" />外部公開</span>);
    if (a.isInternalAlso !== false) badges.push(<span key="int" className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-100 text-indigo-700 flex items-center mr-1"><Users className="w-2.5 h-2.5 mr-0.5" />内部公開</span>);

    if (start > now) badges.push(<span key="wait" className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-700 flex items-center mr-1"><Clock className="w-2.5 h-2.5 mr-0.5" />予約中</span>);
    else if (end && end < now) badges.push(<span key="end" className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gray-100 text-gray-500 mr-1">掲載終了</span>);
    else badges.push(<span key="active" className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-100 text-emerald-700 flex items-center mr-1"><Check className="w-2.5 h-2.5 mr-0.5" />掲載中</span>);
    
    return badges.length > 0 ? <div className="flex items-center mb-1.5">{badges}</div> : null;
  };

  const handleSelectAnnouncement = (id: string) => {
    setSelectedId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    if (window.innerWidth < 1024) {
      setShowMobileDetail(true);
    }
  };

  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (!isMobile && filteredAndSorted.length > 0) {
      if (!selectedId || !filteredAndSorted.find(a => a.id === selectedId)) {
        handleSelectAnnouncement(filteredAndSorted[0].id);
      }
    }
  }, [filteredAndSorted, selectedId]);

  const selectedAnnouncement = filteredAndSorted.find(a => a.id === selectedId);

  const isAllSelected = filteredAndSorted.length > 0 && selectedIds.length === filteredAndSorted.length;
  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds([]);
    else setSelectedIds(filteredAndSorted.map(a => a.id));
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const extractPlainText = (html: string) => {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]*>?/gm, '') 
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  };

  const handleExportMultipleExcel = () => {
    if (selectedIds.length === 0) return;
    
    const rows: any[] = [];
    const targets = filteredAndSorted.filter(a => selectedIds.includes(a.id));
    
    targets.forEach(a => {
      const stats = getReadStatusData(a);
      const publishDateStr = new Date(a.publishStartDate || a.createdAt).toLocaleString('ja-JP');
      const plainContent = extractPlainText(a.content);
      
      const getTargetLabel = (a: Announcement) => {
        let intLabel = "一斉";
        if (a.targetType === "position") intLabel = "役職別";
        if (a.targetType === "individual") intLabel = "個人別";
        let extLabel = "一斉";
        if (a.extTargetType === "individual") extLabel = "個人別";
        let result = [];
        if (a.isInternalAlso !== false) result.push(`内部: ${intLabel}`);
        if (a.isExternal) result.push(`外部: ${extLabel}`);
        return result.join(" / ");
      };

      const baseInfo = {
        お知らせID: a.id,
        連絡タイトル: a.title, 
        配信日時: publishDateStr,
        掲載終了日時: a.publishEndDate ? new Date(a.publishEndDate).toLocaleString('ja-JP') : "無期限",
        緊急設定: a.isUrgent ? "緊急" : "通常",
        要対応フラグ: a.requireAction ? (a.actionType === "single" ? "誰か1人" : "全員必須") : "なし",
        配信先設定: getTargetLabel(a),
        配信者氏名: a.authorName,
        本文テキスト: plainContent,
        添付ファイル数: a.attachments?.length || 0,
      };
      
      const getSysId = (u: any) => u.systemId ? String(u.systemId).padStart(6, '0') : "-";

      const processUsers = (users: any[], category: string) => {
        users.forEach(u => {
          const baseData: any = {
            ...baseInfo,
            区分: category, 
            状態_既読: u.isRead ? "既読" : "未読", 
            システムID: getSysId(u), 
            氏名: u.name, 
            所属_役職: category === "内部メンバー" ? (u.positionName || "一般") : (u.affiliation || "所属なし"), 
            既読日時: u.readAt ? new Date(u.readAt).toLocaleString('ja-JP') : "-"
          };
          if (a.requireAction) {
            baseData["状態_対応"] = u.isActioned ? "対応済" : "未対応";
            baseData["対応日時"] = u.actionAt ? new Date(u.actionAt).toLocaleString('ja-JP') : "-";
          } else {
            baseData["状態_対応"] = "-";
            baseData["対応日時"] = "-";
          }
          rows.push(baseData);
        });
      };

      if (stats.internal.isTarget) processUsers(stats.internal.users, "内部メンバー");
      if (stats.external.isTarget) processUsers(stats.external.users, "外部ゲスト");
    });
    
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "一括既読対応状況");
    XLSX.writeFile(workbook, `既読対応状況一括出力_${Date.now()}.xlsx`);
  };

  const renderDetailView = () => {
    if (!selectedAnnouncement) {
      return (
        <div className={`flex-1 flex flex-col items-center justify-center bg-gray-50/30 text-gray-400 p-6 text-center h-full`}>
          <div className={`p-4 rounded-2xl mb-4 shadow-sm ${c.lightBg} ${c.text}`}>
            <FileStack className="w-10 h-10" />
          </div>
          <h3 className="text-sm font-black text-gray-700 mb-1">お知らせが選択されていません</h3>
          <p className="text-[11px] font-bold text-gray-400">左側のリストから項目を選択すると、ここに詳細と既読リストが表示されます。</p>
        </div>
      );
    }

    const stats = getReadStatusData(selectedAnnouncement);
    const activeStats = readStatusTab === "internal" && stats.internal.isTarget ? stats.internal : stats.external.isTarget ? stats.external : stats.internal;
    const isCurrentTabInternal = readStatusTab === "internal" && stats.internal.isTarget;

    const getSysId = (u: any) => u.systemId ? String(u.systemId).padStart(6, '0') : "-";

    return (
      <div className="flex-1 w-full h-full min-w-0 bg-white flex flex-col relative">
        <div className="lg:hidden flex items-center px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10 shrink-0">
          <button onClick={() => setShowMobileDetail(false)} className="flex items-center text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
            <ChevronLeft className="w-5 h-5 mr-1" /> 戻る
          </button>
        </div>

        <div className="h-[35%] sm:h-[40%] border-b border-gray-200 p-4 sm:p-6 overflow-y-auto custom-scrollbar flex flex-col shrink-0 bg-gray-50/30">
          <div className="flex justify-between items-start mb-2 gap-4">
            <div className="flex-1 min-w-0">
              {getStatusBadge(selectedAnnouncement)}
              <h2 className="text-lg font-black text-gray-900 leading-snug break-words">
                {selectedAnnouncement.isUrgent && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-red-600 text-white shadow-xs mr-2 align-middle"><AlertOctagon className="w-3 h-3 mr-0.5" /> 緊急</span>}
                {selectedAnnouncement.title}
              </h2>
              <div className="text-[10px] font-bold text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> 配信: {new Date(selectedAnnouncement.publishStartDate || selectedAnnouncement.createdAt).toLocaleString('ja-JP')}</span>
                <span>作成者: {selectedAnnouncement.authorName}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={() => onEdit(selectedAnnouncement)} className="p-2 text-gray-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-200" title="編集"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => { if(confirm("本当に削除しますか？")) onDelete(selectedAnnouncement.id); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200" title="削除"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          <div 
            className="text-xs text-gray-800 leading-relaxed bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-2" 
            dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content }} 
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-white">
          <div className="p-3 border-b border-gray-200 bg-white flex justify-between items-center shrink-0">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5"><Eye className="w-4 h-4 text-indigo-600" /> 確認状況の管理</h3>
            <button 
              onClick={() => {
                setSelectedIds([selectedAnnouncement.id]);
                setTimeout(() => handleExportMultipleExcel(), 100);
              }} 
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel出力
            </button>
          </div>

          {(stats.internal.isTarget && stats.external.isTarget) && (
            <div className="flex bg-gray-100 p-1 mx-4 mt-3 rounded-xl shadow-inner shrink-0">
              <button 
                onClick={() => setReadStatusTab("internal")}
                className={`flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all ${isCurrentTabInternal ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                内部メンバー ({stats.internal.total}名)
              </button>
              <button 
                onClick={() => setReadStatusTab("external")}
                className={`flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all ${!isCurrentTabInternal ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                外部ゲスト ({stats.external.total}名)
              </button>
            </div>
          )}

          <div className="p-3 sm:p-4 flex items-center justify-between shrink-0">
            <div className="flex flex-wrap items-center gap-3 text-[11px] sm:text-xs font-black">
              <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100"><Check className="w-4 h-4"/> 既読: {activeStats.readCount}</span>
              <span className="flex items-center gap-1 text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100"><AlertCircle className="w-4 h-4"/> 未読: {activeStats.total - activeStats.readCount}</span>
              {selectedAnnouncement.requireAction && (
                <span className="flex items-center gap-1 text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 ml-2"><CheckSquare className="w-4 h-4"/> 対応済: {activeStats.actionCount}</span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar border-t border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-left whitespace-nowrap">
              <thead className="bg-gray-50 text-[10px] font-black text-gray-500 sticky top-0 z-10 shadow-2xs">
                <tr>
                  <th className="px-4 py-2.5 w-16 border-r border-gray-200 text-center">既読</th>
                  {selectedAnnouncement.requireAction && <th className="px-4 py-2.5 w-16 border-r border-gray-200 text-center">対応</th>}
                  <th className="px-4 py-2.5 w-24 border-r border-gray-200">システムID</th>
                  <th className="px-4 py-2.5 border-r border-gray-200">氏名</th>
                  <th className="px-4 py-2.5 border-r border-gray-200">{isCurrentTabInternal ? "役職 / 権限" : "所属団体"}</th>
                  <th className="px-4 py-2.5 border-r border-gray-200">既読日時</th>
                  {selectedAnnouncement.requireAction && <th className="px-4 py-2.5">対応日時</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 text-xs font-bold">
                {activeStats.users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 border-r border-gray-200 text-center">
                      {u.isRead ? <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200">済</span> : <span className="text-[10px] font-black text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">未</span>}
                    </td>
                    {selectedAnnouncement.requireAction && (
                      <td className="px-4 py-2 border-r border-gray-200 text-center">
                        {u.isActioned ? <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200">済</span> : <span className="text-[10px] font-black text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">未</span>}
                      </td>
                    )}
                    <td className="px-4 py-2 border-r border-gray-200 font-mono text-gray-500">{getSysId(u)}</td>
                    <td className="px-4 py-2 border-r border-gray-200 text-gray-900">{u.name}</td>
                    <td className="px-4 py-2 border-r border-gray-200 text-gray-600 font-medium">
                      {isCurrentTabInternal ? (u.positionName || "一般") : (u.affiliation || "所属なし")}
                    </td>
                    <td className="px-4 py-2 border-r border-gray-200 text-gray-500 font-mono text-[10px]">{u.readAt ? new Date(u.readAt).toLocaleString('ja-JP') : "-"}</td>
                    {selectedAnnouncement.requireAction && <td className="px-4 py-2 text-gray-500 font-mono text-[10px]">{u.actionAt ? new Date(u.actionAt).toLocaleString('ja-JP') : "-"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {activeStats.total === 0 && (
              <div className="py-12 text-center text-gray-400 text-xs font-bold">対象ユーザーがいません</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-white relative overflow-hidden">
      
      <div className={`w-full lg:w-[380px] xl:w-[420px] border-r border-gray-200 flex flex-col flex-shrink-0 bg-white h-full ${showMobileDetail ? 'hidden lg:flex' : 'flex'}`}>
        
        <div className="p-3 border-b border-gray-200 bg-amber-50 flex items-center justify-between shrink-0">
          <p className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>配信・予約済みのお知らせをすべて管理します。</span>
          </p>
        </div>

        <div className="p-2 border-b border-gray-200 bg-gray-50/50 flex flex-col gap-2 shrink-0">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input 
              type="text" placeholder="お知らせを検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 ${c.ring} shadow-2xs`}
            />
          </div>

          {/* ★ CustomSelect を利用した高密度フィルター群 */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            <label className="flex items-center gap-1.5 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 font-bold cursor-pointer hover:bg-gray-50 transition-colors shadow-2xs">
              <input type="checkbox" checked={showExpired} onChange={e => setShowExpired(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3" />
              掲載終了を表示
            </label>

            <div className="flex-1 min-w-[95px]">
              <CustomSelect 
                value={filterActionStatus} onChange={val => setFilterActionStatus(val as any)}
                options={[
                  { value: "all", label: "対応: 全て" },
                  { value: "incomplete", label: "未対応のみ" },
                  { value: "completed", label: "対応済のみ" }
                ]}
                buttonClassName="w-full flex items-center justify-between bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 font-bold shadow-2xs focus:ring-2 focus:ring-indigo-500 text-[10px]"
              />
            </div>

            <div className="flex-1 min-w-[95px]">
              <CustomSelect 
                value={filterCategory} onChange={setFilterCategory}
                options={[
                  { value: "all", label: "全カテゴリ" },
                  ...categories.map(cat => ({ value: cat.id, label: cat.name }))
                ]}
                buttonClassName="w-full flex items-center justify-between bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 font-bold shadow-2xs focus:ring-2 focus:ring-indigo-500 text-[10px]"
              />
            </div>

            <div className="flex-1 min-w-[95px]">
              <CustomSelect 
                value={filterExternal} onChange={val => setFilterExternal(val as any)}
                options={[
                  { value: "all", label: "外部公開: 全て" },
                  { value: "external", label: "外部公開: ON" },
                  { value: "not_external", label: "外部公開: OFF" }
                ]}
                buttonClassName="w-full flex items-center justify-between bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 font-bold shadow-2xs focus:ring-2 focus:ring-indigo-500 text-[10px]"
              />
            </div>

            <div className="flex-1 min-w-[95px]">
              <CustomSelect 
                value={filterInternal} onChange={val => setFilterInternal(val as any)}
                options={[
                  { value: "all", label: "内部公開: 全て" },
                  { value: "internal", label: "内部公開: ON" },
                  { value: "not_internal", label: "内部公開: OFF" }
                ]}
                buttonClassName="w-full flex items-center justify-between bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 font-bold shadow-2xs focus:ring-2 focus:ring-indigo-500 text-[10px]"
              />
            </div>

            {canManageAll && (
              <div className="flex-1 min-w-[110px]">
                <CustomSelect 
                  value={filterAuthor} onChange={setFilterAuthor}
                  options={[
                    { value: "all", label: "すべての配信者" },
                    ...authors.map(u => ({ value: u.id, label: u.name }))
                  ]}
                  buttonClassName="w-full flex items-center justify-between bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 font-bold shadow-2xs focus:ring-2 focus:ring-indigo-500 text-[10px]"
                />
              </div>
            )}

            <button onClick={() => setFilterRequireAction(!filterRequireAction)} className={`p-1.5 border rounded-lg transition-colors flex items-center justify-center shadow-2xs ${filterRequireAction ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`} title="要対応のみ表示">
              <CheckSquare className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")} className="p-1.5 bg-white border border-gray-200 text-gray-400 rounded-lg transition-colors flex items-center justify-center shadow-2xs" title="並び替え">
              <ArrowDownUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between p-2.5 border-b border-gray-200 bg-white shrink-0">
          <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-gray-700">
            <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} className="rounded border-gray-300 text-indigo-600" />
            すべて選択
          </label>
          {selectedIds.length > 0 && (
            <button onClick={handleExportMultipleExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] sm:text-xs font-bold transition-colors shadow-sm">
              <FileSpreadsheet className="w-3.5 h-3.5" /> {selectedIds.length}件をExcel出力
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-gray-100 bg-gray-50/30">
          {filteredAndSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-gray-400 py-12 opacity-70">
              <MessageSquareText className="w-6 h-6 mb-2" />
              <p className="text-[10px] font-bold">管理可能なお知らせはありません</p>
            </div>
          ) : (
            filteredAndSorted.map((a) => {
              const isSelected = selectedId === a.id;
              const isChecked = selectedIds.includes(a.id);
              const isUr = a.isUrgent;
              
              const formatTimeCompact = (dateStr: string) => {
                const d = new Date(dateStr);
                const today = new Date();
                if (d.toDateString() === today.toDateString()) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                return `${d.getMonth()+1}/${d.getDate()}`;
              };

              return (
                <div 
                  key={a.id} onClick={() => handleSelectAnnouncement(a.id)}
                  className={`px-3 py-2.5 cursor-pointer flex items-start gap-2.5 min-w-0 transition-colors group ${isSelected && window.innerWidth >= 1024 ? 'bg-amber-50 shadow-inner' : 'hover:bg-gray-50 bg-white'}`}
                >
                  <div className="mt-1" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggleSelection(a.id)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-1">
                      {getStatusBadge(a)}
                      <div className={`text-[9px] font-medium shrink-0 ${isSelected && window.innerWidth >= 1024 ? 'text-amber-700' : 'text-gray-400'}`}>
                        {formatTimeCompact(a.publishStartDate || a.createdAt)}
                      </div>
                    </div>
                    <h4 className={`text-xs font-bold leading-snug line-clamp-2 ${isSelected && window.innerWidth >= 1024 ? 'text-amber-900' : 'text-gray-900'}`}>
                      {isUr && <AlertOctagon className="w-3 h-3 text-red-500 inline-block mr-1" />}
                      {a.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[10px] truncate max-w-[100px] ${isSelected && window.innerWidth >= 1024 ? 'text-amber-600' : 'text-gray-500'}`}>{a.authorName}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className={`flex-1 w-full h-full min-w-0 bg-white ${showMobileDetail ? 'block absolute inset-0 z-20' : 'hidden lg:flex flex-col'}`}>
        {renderDetailView()}
      </div>

    </div>
  );
}