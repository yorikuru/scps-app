"use client";

import React, { useState, useMemo } from "react";
import { doc, updateDoc, writeBatch, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Search, Loader2, CheckSquare, Square, Settings2, User as UserIcon, 
  MessageCircle, Image as ImageIcon, Paperclip, X,
  Sliders, FileText
} from "lucide-react";
import { UserData, Position, ChatPermissions, getDefaultChatPermissions } from "../types";
import { useDialog } from "@/components/DialogContext";
import CustomSelect from "@/components/CustomSelect"; // ★ CustomSelectをインポート

type SettingCategory = "general" | "media";

const CATEGORY_INFO: Record<SettingCategory, { title: string; desc: string }> = {
  general: { title: "チャット全般設定", desc: "チャット機能自体の利用や自由グループ作成の許可" },
  media: { title: "メディア・ファイル権限", desc: "画像や各種ファイルの送信許可" }
};

const PERMISSION_CONFIG: Record<SettingCategory, { id: keyof ChatPermissions; name: string; icon: any; desc: string }[]> = {
  general: [
    { id: "canUseChat", name: "チャット利用", icon: MessageCircle, desc: "チャット機能自体の利用" },
    { id: "canCreateCustomGroup", name: "自由G作成", icon: MessageCircle, desc: "自由なグループトークの作成" },
  ],
  media: [
    { id: "canSendPhoto", name: "写真送信", icon: ImageIcon, desc: "画像ファイルの送信許可" },
    { id: "canSendFile", name: "ファイル送信", icon: Paperclip, desc: "ドキュメント等の送信許可" },
  ]
};

type Props = {
  tenantUsers: UserData[];
  positions: Position[];
  category: SettingCategory; 
  onClose: () => void;
};

export default function ChatSettings({ tenantUsers, positions, category, onClose }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const { showAlert } = useDialog();

  const [bulkTarget, setBulkTarget] = useState<string>("");
  const [bulkTargetItem, setBulkTargetItem] = useState<string>("all"); 
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const currentCategoryItems = PERMISSION_CONFIG[category];
  const info = CATEGORY_INFO[category];

  const processedUsers = useMemo(() => {
    let filtered = tenantUsers.filter(user => 
      searchQuery === "" || 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      ((user as any).systemId && String((user as any).systemId).includes(searchQuery))
    );

    filtered.sort((a, b) => {
      const aVal = (a as any).systemId ? String((a as any).systemId).padStart(6, '0') : "999999";
      const bVal = (b as any).systemId ? String((b as any).systemId).padStart(6, '0') : "999999";
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
      return a.name.localeCompare(b.name, "ja");
    });

    return filtered;
  }, [tenantUsers, searchQuery]);

  const availablePositions = useMemo(() => {
    const posNames = tenantUsers.map(u => u.positionName).filter(Boolean) as string[];
    return Array.from(new Set(posNames));
  }, [tenantUsers]);

  const formatSixDigitNumber = (numStr?: string) => {
    if (!numStr) return "000000";
    const cleanNum = numStr.replace(/[^0-9]/g, '');
    if (!cleanNum) return "000000";
    return cleanNum.padStart(6, '0');
  };

  const getSchoolId = (userId: string) => tenantUsers.find(u => u.id === userId)?.schoolId || "";

  const togglePermission = async (userId: string, permId: keyof ChatPermissions, currentPerms: ChatPermissions, isAdmin?: boolean) => {
    if (isAdmin) return; 
    setUpdatingUserId(userId);
    try {
      const newPerms = { ...currentPerms, [permId]: !currentPerms[permId] };
      await updateDoc(doc(db, "users", userId), { chatPermissions: newPerms });

      await addDoc(collection(db, "notifications"), {
        userId: userId,
        schoolId: getSchoolId(userId),
        title: "チャット権限が変更されました",
        body: "管理者によりチャット機能の権限設定が更新されました。",
        sourceApp: "system",
        linkUrl: "/top/chat",
        isRead: false,
        isFlagged: false,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      showAlert("権限の更新に失敗しました。","error");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const toggleCategoryAllForUser = async (userId: string, allowAll: boolean, currentPerms: ChatPermissions, isAdmin?: boolean) => {
    if (isAdmin) return;
    setUpdatingUserId(userId);
    try {
      const newPerms = { ...currentPerms };
      currentCategoryItems.forEach(item => {
        newPerms[item.id] = allowAll;
      });
      await updateDoc(doc(db, "users", userId), { chatPermissions: newPerms });

      await addDoc(collection(db, "notifications"), {
        userId: userId,
        schoolId: getSchoolId(userId),
        title: "チャット権限が変更されました",
        body: "管理者によりチャット機能の権限設定が更新されました。",
        sourceApp: "system",
        linkUrl: "/top/chat",
        isRead: false,
        isFlagged: false,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      showAlert("更新に失敗しました。","error");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleBulkUpdate = async (isAllow: boolean) => {
    if (!bulkTarget) {
      showAlert("一括操作の対象グループを選択してください。","warning");
      return;
    }

    setIsBulkUpdating(true);
    try {
      const targetUsers = processedUsers.filter(u => {
        if (bulkTarget === "all") return true;
        if (bulkTarget === "manager") return u.isManager;
        if (bulkTarget.startsWith("role_")) return u.role === bulkTarget.replace("role_", "");
        if (bulkTarget.startsWith("pos_")) return u.positionName === bulkTarget.replace("pos_", "");
        return false;
      });

      const validTargets = targetUsers.filter(u => !(u.role === "admin" || u.role === "system_admin" || u.isITManager));

      if (validTargets.length === 0) {
        showAlert("変更可能な対象ユーザーがいません（管理者は変更できません）。","warning", );
        setIsBulkUpdating(false);
        return;
      }
      
      const batch = writeBatch(db);

      validTargets.forEach(u => {
        const currentPerms = getDefaultChatPermissions(u);
        const newPerms = { ...currentPerms };

        if (bulkTargetItem === "all") {
          currentCategoryItems.forEach(item => {
            newPerms[item.id] = isAllow;
          });
        } else {
          newPerms[bulkTargetItem as keyof ChatPermissions] = isAllow;
        }

        batch.update(doc(db, "users", u.id), { chatPermissions: newPerms });
      });

      await batch.commit();

      const notifyPromises = validTargets.map(u => 
        addDoc(collection(db, "notifications"), {
          userId: u.id,
          schoolId: u.schoolId,
          title: "チャット権限が変更されました",
          body: "管理者によりチャット機能の権限設定が一括更新されました。",
          sourceApp: "system",
          linkUrl: "/top/chat",
          isRead: false,
          isFlagged: false,
          createdAt: serverTimestamp()
        })
      );
      await Promise.all(notifyPromises);

      const targetItemName = bulkTargetItem === "all" ? "現在の全設定項目" : currentCategoryItems.find(m => m.id === bulkTargetItem)?.name || "指定項目";
      showAlert( `${validTargets.length}名の「${targetItemName}」を一括${isAllow ? "許可" : "解除"}しました。`,"success");
    } catch (error) {
      console.error(error);
      showAlert( "一括更新に失敗しました。","error");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      
      <div className="px-4 py-2.5 sm:px-5 sm:py-3 border-b border-gray-200 bg-gray-50/80 flex justify-between items-center shrink-0 backdrop-blur-sm z-20">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            {category === "general" ? <Sliders className="w-4 h-4 sm:w-5 sm:h-5" /> : <FileText className="w-4 h-4 sm:w-5 sm:h-5" />}
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-black text-gray-900">{info.title}</h2>
            <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">{info.desc}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 sm:p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-2 sm:p-4 space-y-2.5 sm:space-y-3 bg-white">
        
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 bg-gray-50 p-2 sm:p-3 rounded-xl border border-gray-200 shrink-0">
          <div className="relative w-full xl:max-w-xs">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="名前や利用番号で検索..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="block w-full pl-7 sm:pl-8 pr-2.5 sm:pr-3 py-1.5 border border-gray-300 rounded-lg text-[11px] sm:text-xs font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" 
            />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="flex items-center text-[10px] sm:text-xs font-bold text-indigo-800 gap-1 whitespace-nowrap">
              <Settings2 className="w-3.5 h-3.5" /> 一括操作:
            </div>
            
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              <div className="flex-1 min-w-[120px]">
                <CustomSelect
                  value={bulkTarget}
                  onChange={val => {
                    if (val.startsWith('disabled_')) return;
                    setBulkTarget(val);
                  }}
                  options={[
                    { value: "", label: "対象グループを選択" },
                    { value: "all", label: `表示中の全ユーザー (${processedUsers.length}名)` },
                    { value: "manager", label: "マネージャー権限をもつユーザー" },
                    { value: "disabled_role", label: "--- 権限ロール ---" },
                    { value: "role_admin", label: "  管理者" },
                    { value: "role_teacher", label: "  教職員" },
                    { value: "role_student", label: "  一般生徒" },
                    ...(availablePositions.length > 0 ? [
                      { value: "disabled_pos", label: "--- 役職別 ---" },
                      ...availablePositions.map(pos => ({ value: `pos_${pos}`, label: `  ${pos}` }))
                    ] : [])
                  ]}
                  buttonClassName="w-full px-2.5 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold border border-gray-300 bg-white outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-between shadow-2xs"
                />
              </div>

              <div className="flex-1 min-w-[120px]">
                <CustomSelect
                  value={bulkTargetItem}
                  onChange={setBulkTargetItem}
                  options={[
                    { value: "all", label: "カテゴリ内すべての項目" },
                    ...currentCategoryItems.map(item => ({ value: item.id, label: item.name }))
                  ]}
                  buttonClassName="w-full px-2.5 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold border border-gray-300 bg-white outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-between shadow-2xs"
                />
              </div>
            </div>

            <div className="flex gap-1.5 w-full sm:w-auto ml-auto">
              <button 
                onClick={() => handleBulkUpdate(true)} 
                disabled={isBulkUpdating || !bulkTarget} 
                className="flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] sm:text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center shadow-2xs"
              >
                {isBulkUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "一括許可"}
              </button>
              <button 
                onClick={() => handleBulkUpdate(false)} 
                disabled={isBulkUpdating || !bulkTarget} 
                className="flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center shadow-2xs"
              >
                {isBulkUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "一括解除"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto border border-gray-200 rounded-xl custom-scrollbar relative bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-left whitespace-nowrap">
            <thead className="bg-gray-50 text-[9px] sm:text-[10px] font-black text-gray-500 sticky top-0 z-10 shadow-2xs">
              <tr>
                <th scope="col" className="px-2 sm:px-3 py-2 sm:py-2.5 w-16 sm:w-20 border-r border-gray-200 bg-gray-50">利用番号</th>
                <th scope="col" className="px-2 sm:px-3 py-2 sm:py-2.5 border-r border-gray-200 min-w-[150px] bg-gray-50">ユーザー名 / 役職</th>
                <th scope="col" className="px-2 sm:px-3 py-2 sm:py-2.5 text-center border-r border-gray-200 w-20 sm:w-24 bg-gray-50">カテゴリ一括</th>
                
                {currentCategoryItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <th key={item.id} scope="col" className="px-2 py-2 text-center min-w-[70px] sm:min-w-[90px] border-r border-gray-100 last:border-0 bg-gray-50">
                      <div className="flex flex-col items-center gap-1">
                        <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600" />
                        <span className="text-[8px] sm:text-[9px]">{item.name}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 text-[10px] sm:text-xs font-bold">
              {processedUsers.map((user) => {
                const userPerms = getDefaultChatPermissions(user);
                const isAdmin = user.role === "admin" || user.role === "system_admin" || user.isITManager === true;
                const isAllCategoryAllowed = currentCategoryItems.every(item => userPerms[item.id] === true);
                const isProcessing = updatingUserId === user.id;

                return (
                  <tr key={user.id} className="hover:bg-gray-50/80 transition-colors">
                    
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 font-mono text-[9px] sm:text-[11px] text-gray-600 border-r border-gray-200 text-center">
                      {formatSixDigitNumber((user as any).systemId)}
                    </td>

                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 border-r border-gray-200">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200">
                          {(user as any).photoURL ? (
                            <img src={(user as any).photoURL} alt="avatar" className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-gray-900 font-bold text-[10px] sm:text-xs truncate">{user.name}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {isAdmin ? (
                              <span className="text-[7px] sm:text-[8px] text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-200 truncate">システム管理者</span>
                            ) : user.positionName ? (
                              <span className="text-[7px] sm:text-[8px] text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100 truncate">{user.positionName}</span>
                            ) : <span className="text-[7px] sm:text-[8px] text-gray-400">一般</span>}
                            {user.isManager && <span className="text-[7px] sm:text-[8px] text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-100 shrink-0">マネ</span>}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-center border-r border-gray-200">
                      <button
                        onClick={() => toggleCategoryAllForUser(user.id, !isAllCategoryAllowed, userPerms, isAdmin)}
                        disabled={isProcessing || isAdmin}
                        className={`px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold transition-colors border w-full sm:w-auto ${
                          isAdmin ? "bg-gray-100 text-gray-400 border-gray-200 opacity-50 cursor-not-allowed" :
                          isAllCategoryAllowed 
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" 
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {isProcessing ? <Loader2 className="w-2.5 h-2.5 sm:w-3 h-3 animate-spin mx-auto" /> : (isAdmin ? "固定許可" : isAllCategoryAllowed ? "全解除" : "全許可")}
                      </button>
                    </td>

                    {currentCategoryItems.map(item => {
                      const hasPermission = userPerms[item.id];
                      return (
                        <td key={item.id} className="px-2 py-1.5 sm:py-2 text-center hover:bg-gray-50 transition-colors border-r border-gray-100 last:border-0">
                          <button
                            onClick={() => togglePermission(user.id, item.id, userPerms, isAdmin)}
                            disabled={isProcessing || isAdmin}
                            className={`p-1 rounded-md transition-colors inline-flex items-center justify-center focus:outline-none ${isAdmin ? 'cursor-not-allowed opacity-60' : ''}`}
                            title={isAdmin ? "管理者は全権限が固定されています" : `${user.name}: ${item.name}を${hasPermission ? '解除' : '許可'}`}
                          >
                            {hasPermission ? (
                              <CheckSquare className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-gray-300" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {processedUsers.length === 0 && (
                <tr>
                  <td colSpan={3 + currentCategoryItems.length} className="px-4 py-8 text-center text-[10px] sm:text-xs text-gray-400">
                    条件に一致するユーザーが見つかりません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}