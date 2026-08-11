"use client";

import React, { useState, useRef } from "react";
import { X, Image as ImageIcon, Edit3, UserPlus, UserMinus, AlertCircle, Users, ChevronLeft, CheckCircle2 } from "lucide-react";
import { updateDoc, doc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { UserData, ExternalUser, ChatRoom, Position } from "../types";
import { useDialog } from "@/components/DialogContext";

const UserAvatar = ({ name, url, isExternal = false, className = "w-8 h-8 text-xs" }: { name: string, url?: string | null, isExternal?: boolean, className?: string }) => {
  return url ? (
    <img src={url} alt={name} className={`${className} rounded-full object-cover shadow-sm border border-gray-200 bg-white`} />
  ) : (
    <div className={`${className} rounded-full bg-gradient-to-tr ${isExternal ? 'from-yellow-400 to-amber-500' : 'from-indigo-500 to-purple-600'} flex items-center justify-center text-white font-bold shadow-sm`}>
      {name.charAt(0)}
    </div>
  );
};

type Props = {
  room: ChatRoom;
  userData: UserData | ExternalUser;
  roomMembers: (UserData | ExternalUser)[];
  tenantUsers: UserData[];
  externalUsers: ExternalUser[];
  positions: Position[];
  onClose: () => void;
};

export default function ChatRoomSettingsModal({ room, userData, roomMembers, tenantUsers, externalUsers, positions, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"menu" | "members" | "add_member" | "rename" | "icon">("menu");
  
  const [newName, setNewName] = useState(room.name || "");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showAlert, showConfirm } = useDialog();
  
  const [confirmAlert, setConfirmAlert] = useState<{message: string, onConfirm: () => void} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const allUsers = [...tenantUsers, ...externalUsers];
  const nonMembersData = allUsers.filter(u => !room.members.includes(u.id));

  const sortedMembers = [...roomMembers].sort((a, b) => {
    const isExtA = "category" in a;
    const isExtB = "category" in b;

    if (!isExtA && isExtB) return -1;
    if (isExtA && !isExtB) return 1;

    if (!isExtA && !isExtB) {
      const numA = parseInt((a as UserData).attendanceNumber || "99999", 10);
      const numB = parseInt((b as UserData).attendanceNumber || "99999", 10);
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name, "ja"); 
    }

    if (isExtA && isExtB) {
      const kanaA = (a as ExternalUser).nameKana || a.name;
      const kanaB = (b as ExternalUser).nameKana || b.name;
      return kanaA.localeCompare(kanaB, "ja");
    }

    return 0;
  });

  const isExternal = "category" in userData;
  const isCustomGroup = room.type === "custom_group";
  const isPosition = room.type === "position";
  const posData = isPosition ? positions.find(p => p.id === room.targetId) : null;
  const isLeader = isPosition && posData?.leaderUserId === userData.id;

  const canEdit = !isExternal && (isCustomGroup || isLeader);

  const sendSysMessage = async (text: string) => {
    await addDoc(collection(db, "chat_messages"), {
      roomId: room.id,
      senderId: "system",
      text,
      readBy: [userData.id],
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "chat_rooms", room.id), {
      lastMessage: text,
      updatedAt: serverTimestamp()
    });
  };

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === room.name) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "chat_rooms", room.id), { name: newName.trim() });
      await sendSysMessage(`${userData.name} がチャットルーム名を「${newName.trim()}」に変更しました。`);
      
      const notifyPromises = room.members.filter(id => id !== userData.id).map(targetId => {
        const targetUser = allUsers.find(u => u.id === targetId);
        const targetIsExt = targetUser ? "category" in targetUser : false;
        const baseUrl = targetIsExt ? "/ext-chat" : "/top/chat";
        return addDoc(collection(db, "notifications"), {
          userId: targetId,
          schoolId: userData.schoolId,
          title: "グループ名が変更されました",
          body: `${userData.name}さんがグループ名を「${newName.trim()}」に変更しました。`,
          sourceApp: "chat",
          linkUrl: `${baseUrl}?room=${room.id}`,
          isRead: false,
          isFlagged: false,
          createdAt: serverTimestamp()
        });
      });
      await Promise.all(notifyPromises);

      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSubmitting(true);
    try {
      const storageRef = ref(storage, `chat_attachments/${room.id}/icon_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "chat_rooms", room.id), { iconURL: url });
      await sendSysMessage(`${userData.name} がグループアイコンを変更しました。`);
      onClose();
    } catch (error) {
      showAlert("アイコンのアップロードに失敗しました。");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) return;
    setIsSubmitting(true);
    try {
      const newMembers = [...room.members, ...selectedUsers];
      const addedNames = selectedUsers.map(id => allUsers.find(u => u.id === id)?.name).join("、");
      await updateDoc(doc(db, "chat_rooms", room.id), { members: newMembers });
      await sendSysMessage(`${userData.name} が ${addedNames} を追加しました。`);
      
      const notifyPromises = selectedUsers.map(targetId => {
        const targetUser = allUsers.find(u => u.id === targetId);
        const targetIsExt = targetUser ? "category" in targetUser : false;
        const baseUrl = targetIsExt ? "/ext-chat" : "/top/chat";
        return addDoc(collection(db, "notifications"), {
          userId: targetId,
          schoolId: userData.schoolId,
          title: "グループチャットに追加されました",
          body: `${userData.name}さんがあなたをグループ「${room.name || "名称未設定"}」に追加しました。`,
          sourceApp: "chat",
          linkUrl: `${baseUrl}?room=${room.id}`,
          isRead: false,
          isFlagged: false,
          createdAt: serverTimestamp()
        });
      });
      await Promise.all(notifyPromises);

      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = (targetId: string, targetName: string) => {
    setConfirmAlert({
      message: `${targetName} さんをグループから退出させますか？`,
      onConfirm: async () => {
        setIsSubmitting(true);
        try {
          const newMembers = room.members.filter(id => id !== targetId);
          await updateDoc(doc(db, "chat_rooms", room.id), { members: newMembers });
          await sendSysMessage(`${userData.name} が ${targetName} を退出させました。`);
          setActiveTab("menu");
        } catch (error) {
          console.error(error);
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  return (
    <>
      <div className="absolute inset-0 z-[50] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh] animate-slide-up" onClick={e => e.stopPropagation()}>
          
          <div className="p-4 border-b border-gray-100 flex items-center bg-gray-50 shrink-0">
            {activeTab !== "menu" && (
              <button onClick={() => setActiveTab("menu")} className="p-1.5 mr-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h3 className="text-sm font-black text-gray-900 flex-1 text-center pr-8">
              {activeTab === "menu" ? "チャット設定" : activeTab === "members" ? "メンバー一覧" : activeTab === "add_member" ? "メンバーの追加" : activeTab === "rename" ? "名前の変更" : "アイコン設定"}
            </h3>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-full transition-colors absolute right-4">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto custom-scrollbar flex-1 p-2">
            
            {activeTab === "menu" && (
              <div className="space-y-1 py-2">
                <button onClick={() => setActiveTab("members")} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 rounded-xl transition-colors text-left group">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform"><Users className="w-4 h-4"/></div>
                  <div>
                    <span className="text-sm font-bold text-gray-800 block">メンバーを見る</span>
                    <span className="text-[10px] font-medium text-gray-500">{roomMembers.length}名が参加中</span>
                  </div>
                </button>

                {canEdit && (
                  <>
                    <button onClick={() => setActiveTab("rename")} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 rounded-xl transition-colors text-left group">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:scale-110 transition-transform"><Edit3 className="w-4 h-4"/></div>
                      <div>
                        <span className="text-sm font-bold text-gray-800 block">グループ名を変更</span>
                        <span className="text-[10px] font-medium text-gray-500">現在の名前: {room.name || "未設定"}</span>
                      </div>
                    </button>
                    
                    <button onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 rounded-xl transition-colors text-left group">
                      <div className="p-2 bg-amber-50 text-amber-600 rounded-lg group-hover:scale-110 transition-transform"><ImageIcon className="w-4 h-4"/></div>
                      <div>
                        <span className="text-sm font-bold text-gray-800 block">アイコンを変更</span>
                        <span className="text-[10px] font-medium text-gray-500">好きな画像をアップロード</span>
                      </div>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleIconUpload} accept="image/*" className="hidden" />
                  </>
                )}
              </div>
            )}

            {activeTab === "members" && (
              <div className="p-2 space-y-3">
                {canEdit && (
                  <button onClick={() => setActiveTab("add_member")} className="w-full py-2.5 border-2 border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 mb-4">
                    <UserPlus className="w-4 h-4" /> 新しいメンバーを追加
                  </button>
                )}
                
                <div className="space-y-1">
                  {sortedMembers.map(u => {
                    const isExt = "category" in u;
                    return (
                      <div key={u.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl group">
                        <div className="flex items-center gap-3 min-w-0">
                          <UserAvatar name={u.name} url={(u as any).photoURL} isExternal={isExt} className="w-9 h-9 text-xs" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-gray-900 truncate">{u.name}</span>
                              {isExt && <span className="px-1 py-0.5 rounded text-[8px] font-black bg-amber-100 text-amber-700">外部</span>}
                            </div>
                            <p className="text-[9px] text-gray-400">
                              {!isExt && (u as UserData).attendanceNumber ? `No. ${(u as UserData).attendanceNumber}` : (u as ExternalUser).nameKana || ""}
                            </p>
                          </div>
                        </div>
                        {canEdit && u.id !== userData.id && (
                          <button 
                            onClick={() => handleRemoveMember(u.id, u.name)} 
                            className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-[10px] font-bold transition-colors"
                          >
                            退出させる
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "add_member" && (
              <div className="p-2 flex flex-col h-full">
                <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar max-h-[300px]">
                  {nonMembersData.length === 0 ? (
                    <p className="text-xs text-center text-gray-400 py-4">追加できるメンバーがいません。</p>
                  ) : (
                    nonMembersData.map(u => {
                      const isSelected = selectedUsers.includes(u.id);
                      const isExt = "category" in u;
                      return (
                        <label key={u.id} className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors border ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'border-transparent hover:bg-gray-50'}`}>
                          <input type="checkbox" checked={isSelected} onChange={(e) => { if(e.target.checked) setSelectedUsers([...selectedUsers, u.id]); else setSelectedUsers(selectedUsers.filter(id => id !== u.id)); }} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                          <UserAvatar name={u.name} url={(u as any).photoURL} isExternal={isExt} className="w-8 h-8 text-[10px]" />
                          <span className="text-xs font-bold text-gray-900 flex-1 truncate">{u.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
                <button disabled={selectedUsers.length === 0 || isSubmitting} onClick={handleAddMembers} className="w-full mt-4 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 text-xs font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {selectedUsers.length}名を追加する
                </button>
              </div>
            )}

            {activeTab === "rename" && (
              <div className="p-4">
                <label className="block text-xs font-bold text-gray-700 mb-2">新しいグループ名</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus
                />
                <button disabled={!newName.trim() || newName.trim() === room.name || isSubmitting} onClick={handleRename} className="w-full mt-6 py-3 bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 text-sm font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2">
                  保存する
                </button>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
            <button onClick={onClose} className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-xl transition-colors">
              閉じる
            </button>
          </div>
        </div>
      </div>

      {confirmAlert && (
        <div className="absolute inset-0 z-[60] bg-black/40 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center animate-slide-up shadow-2xl">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <p className="text-sm font-bold text-gray-800 mb-6 leading-relaxed">{confirmAlert.message}</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setConfirmAlert(null)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-colors">キャンセル</button>
              <button onClick={() => { confirmAlert.onConfirm(); setConfirmAlert(null); }} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-xs font-bold text-white shadow-md transition-colors">実行する</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}