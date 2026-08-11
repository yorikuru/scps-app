"use client";

import React, { useEffect, useState, useRef } from "react";
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Send, Paperclip, ImagePlus, FileIcon, Loader2, X, Pencil, Trash2, SmilePlus, Bold, Italic, Underline, Strikethrough, Link as LinkIcon, Palette, Highlighter, Info, Type, Users, Reply } from "lucide-react";
import { UserData, ExternalUser, ChatRoom, ChatMessage, ChatAttachment, ChatReaction, AppConfig, COLOR_MAPPINGS, Position, getDefaultChatPermissions } from "../types";
import ChatRoomHeader from "./ChatRoomHeader";
import ChatRoomSettingsModal from "./ChatRoomSettingsModal";
import { useDialog } from "@/components/DialogContext";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🎉", "🔥", "👀"];
const COLORS = ["#000000", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899"];

// ★ アバターのサイズを縮小
const UserAvatar = ({ name, url, isExternal = false, className = "w-7 h-7 text-[10px]" }: { name: string, url?: string | null, isExternal?: boolean, className?: string }) => {
  return url ? (
    <img src={url} alt={name} className={`${className} rounded-full object-cover shadow-sm flex-shrink-0 border border-gray-200 bg-white`} />
  ) : (
    <div className={`${className} rounded-full bg-gradient-to-tr ${isExternal ? 'from-yellow-400 to-amber-500' : 'from-indigo-500 to-purple-600'} flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm`}>
      {name.charAt(0)}
    </div>
  );
};

type Props = {
  userData: UserData | ExternalUser;
  tenantUsers: UserData[];
  externalUsers: ExternalUser[];
  positions: Position[]; 
  room: ChatRoom;
  onBack: () => void;
  appConfig: AppConfig;
  onOpenProfile?: (user: UserData | ExternalUser) => void;
  onTogglePin?: (roomId: string, isPinned: boolean) => void;
  schoolName?: string;
  schoolLogoURL?: string;
};

export default function ChatRoomWindow({ userData, tenantUsers, externalUsers, positions, room, onBack, appConfig, onOpenProfile, onTogglePin, schoolName, schoolLogoURL }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [editorHtml, setEditorHtml] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { showAlert, showConfirm } = useDialog();

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const [showReactionMenuFor, setShowReactionMenuFor] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [reactionDetailMsg, setReactionDetailMsg] = useState<ChatMessage | null>(null);
  const [readDetailMsg, setReadDetailMsg] = useState<ChatMessage | null>(null); 
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [savedRange, setSavedRange] = useState<Range | null>(null);
  const [mentionState, setMentionState] = useState<{ show: boolean; query: string }>({ show: false, query: "" });
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showToolbar, setShowToolbar] = useState(false); // スマホでは初期表示オフがおすすめ

  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editEditorRef = useRef<HTMLDivElement>(null);

  const isInternalUser = !("category" in userData);
  const perms = isInternalUser ? getDefaultChatPermissions(userData as UserData) : {
    canUseChat: true, canCreateExternalUser: false, canViewExternalUser: false, 
    canEditExternalUser: false, canDeleteExternalUser: false, 
    canCreateCustomGroup: false, canSendPhoto: true, canSendFile: true,
  };

  const getUserById = (id: string) => tenantUsers.find(u => u.id === id) || externalUsers.find(e => e.id === id);

  const displayedMessages = searchQuery ? messages.filter(m => m.text.replace(/<[^>]*>?/gm, '').toLowerCase().includes(searchQuery.toLowerCase())) : messages;

  const getRoomMembers = () => {
    if (room.type === "direct") {
      const otherId = room.members.find(id => id !== userData.id);
      const otherUser = getUserById(otherId || "");
      return otherUser ? [otherUser, userData] : [userData];
    }
    if (room.type === "custom_group") return room.members.map(id => getUserById(id)).filter(Boolean) as (UserData | ExternalUser)[];
    if (room.type === "tenant_all") return tenantUsers;
    if (room.type === "role_admin") return tenantUsers.filter(u => u.role === "admin" || u.role === "system_admin" || u.isITManager);
    if (room.type === "role_teacher") return tenantUsers.filter(u => u.role === "teacher");
    if (room.type === "role_manager") return tenantUsers.filter(u => u.isManager);
    if (room.type === "position") return tenantUsers.filter(u => u.positionIds?.includes(room.targetId!) || u.primaryPositionId === room.targetId);
    return [];
  };

  const roomMembers = getRoomMembers();

  const filteredMentionUsers = [
    { id: "all", name: "all", role: "" },
    ...roomMembers.map(u => ({ id: u.id, name: u.name, role: "role" in u ? u.role : "外部" }))
  ].filter(u => u.name.toLowerCase().includes(mentionState.query.toLowerCase()));

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (replyingTo) {
          setReplyingTo(null);
        } else if (!showLinkModal && !reactionDetailMsg && !readDetailMsg && !mentionState.show && !showSettings) {
          onBack();
        }
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onBack, showLinkModal, reactionDetailMsg, readDetailMsg, mentionState.show, showSettings, replyingTo]);

  useEffect(() => {
    setShowSettings(false);
    setReplyingTo(null); 
  }, [room.id]);

  useEffect(() => {
    if (!room.id) return;
    if (room.unreadCount?.[userData.id] && room.unreadCount[userData.id] > 0) {
      updateDoc(doc(db, "chat_rooms", room.id), { [`unreadCount.${userData.id}`]: 0 }).catch(console.error);
    }
  }, [room.id, room.unreadCount, userData.id]);

  useEffect(() => {
    if (!room.id) return;
    const q = query(collection(db, "chat_messages"), where("roomId", "==", room.id), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: ChatMessage[] = [];
      const unreadDocs: any[] = [];
      snapshot.forEach(d => {
        const data = d.data();
        fetched.push({ id: d.id, ...data, createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString() } as ChatMessage);
        if (data.senderId !== userData.id && data.senderId !== "system" && !data.readBy?.includes(userData.id)) unreadDocs.push(d);
      });
      setMessages(fetched);
      if(!searchQuery) setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

      if (unreadDocs.length > 0 && !searchQuery) {
        const batch = writeBatch(db);
        unreadDocs.forEach(d => batch.update(d.ref, { readBy: [...(d.data().readBy || []), userData.id] }));
        batch.commit().catch(console.error);
      }
    });
    return () => unsubscribe();
  }, [room.id, userData.id, searchQuery]);

  const handleEditorInput = () => {
    setEditorHtml(editorRef.current?.innerHTML || "");
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const textBefore = range.startContainer.textContent?.slice(0, range.startOffset) || "";
      const match = textBefore.match(/@([^\s]*)$/);
      if (match) {
        setMentionState({ show: true, query: match[1] });
        setSavedRange(range.cloneRange());
        setMentionIndex(0);
      } else setMentionState({ show: false, query: "" });
    } else setMentionState({ show: false, query: "" });
  };

  const insertMention = (user: { id: string, name: string }) => {
    if (!savedRange) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(savedRange);
    const text = savedRange.startContainer.textContent || "";
    const atIndex = text.lastIndexOf("@", savedRange.startOffset);
    if (atIndex !== -1) {
      savedRange.setStart(savedRange.startContainer, atIndex);
      sel?.removeAllRanges();
      sel?.addRange(savedRange);
      
      const displayName = user.id === "all" ? "全員" : user.name;
      document.execCommand("insertHTML", false, `<span class="mention" contenteditable="false" data-mention="${user.id}">@${displayName}</span>&#8203; `);
    }
    setMentionState({ show: false, query: "" });
  };

  const handleSendMessage = async () => {
    const textContent = editorRef.current?.textContent?.trim() || "";
    const hasImage = editorRef.current?.querySelector('img') !== null;
    if (!textContent && !hasImage && attachments.length === 0) return;
    if (isSending) return;

    setIsSending(true);
    try {
      let uploadedAttachments: ChatAttachment[] = [];
      if (attachments.length > 0) {
        setIsUploading(true);
        for (const file of attachments) {
          const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
          const storageRef = ref(storage, `chat_attachments/${room.id}/${Date.now()}_${safeName}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          uploadedAttachments.push({ name: file.name, url, type: file.type, size: file.size });
        }
        setIsUploading(false);
      }

      let replyInfo = null;
      if (replyingTo) {
        const senderUser = getUserById(replyingTo.senderId);
        replyInfo = {
          messageId: replyingTo.id,
          text: replyingTo.text.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').substring(0, 50),
          senderName: senderUser?.name || "退会ユーザー"
        };
      }

      const messageHtml = editorRef.current?.innerHTML || "";
      await addDoc(collection(db, "chat_messages"), {
        roomId: room.id,
        senderId: userData.id,
        text: messageHtml,
        attachments: uploadedAttachments,
        readBy: [userData.id],
        createdAt: serverTimestamp(),
        isEdited: false,
        reactions: [],
        replyTo: replyInfo 
      });

      let previewText = textContent.replace(/\u00A0/g, ' ') || (uploadedAttachments.length > 0 ? "ファイルを送信しました" : "メッセージ");
      const newUnreadCount = { ...(room.unreadCount || {}) };
      roomMembers.forEach(u => { if (u.id !== userData.id) newUnreadCount[u.id] = (newUnreadCount[u.id] || 0) + 1; });

      await updateDoc(doc(db, "chat_rooms", room.id), {
        lastMessage: previewText,
        updatedAt: serverTimestamp(),
        unreadCount: newUnreadCount
      });

      const mentionedUserIds = new Set<string>();
      if (editorRef.current) {
        const mentionSpans = editorRef.current.querySelectorAll('.mention');
        mentionSpans.forEach(span => {
          const uid = span.getAttribute('data-mention');
          if (uid) mentionedUserIds.add(uid);
        });
      }

      const notifyPromises: Promise<any>[] = [];

      if (replyingTo && replyingTo.senderId !== userData.id && replyingTo.senderId !== "system") {
        const targetUser = roomMembers.find(u => u.id === replyingTo.senderId);
        const targetIsExt = targetUser ? "category" in targetUser : false;
        const baseUrl = targetIsExt ? "/ext-chat" : "/top/chat";

        notifyPromises.push(addDoc(collection(db, "notifications"), {
          userId: replyingTo.senderId,
          schoolId: userData.schoolId,
          title: "チャットでリプライされました",
          body: `${userData.name}さんから：「${previewText.substring(0, 40)}${previewText.length > 40 ? '...' : ''}」`,
          sourceApp: "chat",
          linkUrl: `${baseUrl}?room=${room.id}`,
          isRead: false,
          isFlagged: false,
          createdAt: serverTimestamp()
        }));
      }

      if (mentionedUserIds.size > 0) {
        let targets: string[] = [];
        if (mentionedUserIds.has("all")) {
          targets = roomMembers.map(u => u.id).filter(id => id !== userData.id);
        } else {
          targets = Array.from(mentionedUserIds).filter(id => id !== userData.id);
        }
        
        if (replyingTo) {
          targets = targets.filter(id => id !== replyingTo.senderId);
        }

        targets.forEach(targetId => {
          const targetUser = roomMembers.find(u => u.id === targetId);
          const targetIsExt = targetUser ? "category" in targetUser : false;
          const baseUrl = targetIsExt ? "/ext-chat" : "/top/chat";

          notifyPromises.push(addDoc(collection(db, "notifications"), {
            userId: targetId,
            schoolId: userData.schoolId,
            title: "チャットでメンションされました",
            body: `${userData.name}さんからメンションがありました：「${previewText.substring(0, 40)}${previewText.length > 40 ? '...' : ''}」`,
            sourceApp: "chat",
            linkUrl: `${baseUrl}?room=${room.id}`,
            isRead: false,
            isFlagged: false,
            createdAt: serverTimestamp()
          }));
        });
      }

      await Promise.all(notifyPromises);

      if(editorRef.current) editorRef.current.innerHTML = "";
      setEditorHtml("");
      setAttachments([]);
      setMentionState({ show: false, query: "" });
      setReplyingTo(null); 
    } catch (error) {
      showAlert("メッセージの送信に失敗しました", "error");
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, isEdit = false) => {
    if (mentionState.show && !isEdit) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(p => (p + 1) % filteredMentionUsers.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(p => (p - 1 + filteredMentionUsers.length) % filteredMentionUsers.length); return; }
      if (e.key === "Enter") { e.preventDefault(); insertMention(filteredMentionUsers[mentionIndex]); return; }
      if (e.key === "Escape") { e.preventDefault(); setMentionState({ show: false, query: "" }); return; }
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (isEdit && editingMessageId) handleEditSave(editingMessageId);
      else if (!isEdit) handleSendMessage();
    }
  };

  const executeDeleteMessage = async (msgId: string) => {
    try { 
      await deleteDoc(doc(db, "chat_messages", msgId)); 
      showAlert("メッセージを削除しました", "success");
    } catch (e) { 
      showAlert("削除に失敗しました", "error"); 
    }
  };

  const handleDeleteMessage = (msgId: string) => { 
    showConfirm(
      "送信を取り消しますか？この操作は元に戻せません。",
      () => executeDeleteMessage(msgId),
      "danger",
      "送信取消の確認"
    );
  };

  const startEditing = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setTimeout(() => {
      if (editEditorRef.current) {
        editEditorRef.current.innerHTML = msg.text;
        editEditorRef.current.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editEditorRef.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, 50);
  };

  const handleEditSave = async (msgId: string) => {
    const html = editEditorRef.current?.innerHTML || "";
    try { 
      await updateDoc(doc(db, "chat_messages", msgId), { text: html, isEdited: true }); 
      setEditingMessageId(null); 
      showAlert("メッセージを更新しました", "success");
    } catch (e) { 
      showAlert("編集に失敗しました", "error"); 
    }
  };

  const handleReaction = async (msgId: string, emoji: string, currentReactions: ChatReaction[] = []) => {
    const reactionIndex = currentReactions.findIndex(r => r.emoji === emoji);
    let newReactions = [...currentReactions];
    if (reactionIndex > -1) {
      if (newReactions[reactionIndex].users.includes(userData.id)) {
        newReactions[reactionIndex].users = newReactions[reactionIndex].users.filter(id => id !== userData.id);
        if (newReactions[reactionIndex].users.length === 0) newReactions.splice(reactionIndex, 1);
      } else newReactions[reactionIndex].users.push(userData.id);
    } else newReactions.push({ emoji, users: [userData.id] });
    try { await updateDoc(doc(db, "chat_messages", msgId), { reactions: newReactions }); } catch (e) {}
  };

  const handleCommand = (command: string, value?: string, refToFocus: React.RefObject<HTMLDivElement | null> = editorRef) => {
    document.execCommand(command, false, value);
    refToFocus.current?.focus();
    if(refToFocus === editorRef) setEditorHtml(editorRef.current?.innerHTML || "");
  };

  const handleLinkSave = () => {
    if (savedRange) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRange);
      document.execCommand("createLink", false, linkUrl);
    }
    setShowLinkModal(false); setSavedRange(null); setEditorHtml(editorRef.current?.innerHTML || "");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...newFiles].slice(0, 5)); 
    }
  };

  const formatTime = (dateStr: string) => { const d = new Date(dateStr); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };

  const RichTextToolbar = ({ targetRef }: { targetRef: React.RefObject<HTMLDivElement | null> }) => {
    const [colorPicker, setColorPicker] = useState<"text" | "bg" | null>(null);
    return (
      <div className="flex gap-1 items-center px-1.5 py-1 border-b border-gray-200 bg-gray-50/80 rounded-t-xl relative z-10 flex-wrap">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); handleCommand('bold', undefined, targetRef); }} className="p-1 sm:p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors" title="太字 (Ctrl+B)"><Bold className="w-3.5 h-3.5" /></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); handleCommand('italic', undefined, targetRef); }} className="p-1 sm:p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors" title="斜体 (Ctrl+I)"><Italic className="w-3.5 h-3.5" /></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); handleCommand('underline', undefined, targetRef); }} className="p-1 sm:p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors" title="下線 (Ctrl+U)"><Underline className="w-3.5 h-3.5" /></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); handleCommand('strikeThrough', undefined, targetRef); }} className="p-1 sm:p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors" title="取り消し線"><Strikethrough className="w-3.5 h-3.5" /></button>
        <div className="w-px h-3 bg-gray-300 mx-0.5"></div>
        <select defaultValue="3" onChange={(e) => handleCommand('fontSize', e.target.value, targetRef)} className="text-[10px] font-bold bg-transparent border-none p-0.5 hover:bg-gray-200 rounded focus:ring-0 cursor-pointer text-gray-700" title="文字サイズ">
          <option value="2">小</option><option value="3">標準</option><option value="5">大</option><option value="6">特大</option>
        </select>
        <div className="w-px h-3 bg-gray-300 mx-0.5"></div>
        <div className="relative">
          <button type="button" onMouseDown={(e) => { e.preventDefault(); setColorPicker(p => p === 'text' ? null : 'text'); }} className={`p-1 sm:p-1.5 rounded text-gray-700 transition-colors ${colorPicker === 'text' ? 'bg-gray-200' : 'hover:bg-gray-200'}`} title="文字色"><Palette className="w-3.5 h-3.5" /></button>
          {colorPicker === 'text' && (
            <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 shadow-xl rounded-xl p-2 flex flex-wrap w-[150px] gap-2 z-[100] animate-slide-up">
              {COLORS.map(color => (<button key={color} onMouseDown={(e) => { e.preventDefault(); handleCommand('foreColor', color, targetRef); setColorPicker(null); }} style={{backgroundColor: color}} className="w-5 h-5 rounded-full shadow-sm border border-gray-100 hover:scale-110 transition-transform" />))}
            </div>
          )}
        </div>
        <div className="relative">
          <button type="button" onMouseDown={(e) => { e.preventDefault(); setColorPicker(p => p === 'bg' ? null : 'bg'); }} className={`p-1 sm:p-1.5 rounded text-gray-700 transition-colors ${colorPicker === 'bg' ? 'bg-gray-200' : 'hover:bg-gray-200'}`} title="蛍光ペン"><Highlighter className="w-3.5 h-3.5" /></button>
          {colorPicker === 'bg' && (
            <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 shadow-xl rounded-xl p-2 flex flex-wrap w-[150px] gap-2 z-[100] animate-slide-up">
              {COLORS.map(color => (<button key={color} onMouseDown={(e) => { e.preventDefault(); handleCommand('hiliteColor', color, targetRef); setColorPicker(null); }} style={{backgroundColor: color}} className="w-5 h-5 rounded shadow-sm border border-gray-100 hover:scale-110 transition-transform" />))}
            </div>
          )}
        </div>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); const sel = window.getSelection(); if (sel && sel.rangeCount > 0) setSavedRange(sel.getRangeAt(0)); setLinkUrl(""); setShowLinkModal(true); }} className="p-1 sm:p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors" title="リンク挿入"><LinkIcon className="w-3.5 h-3.5" /></button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#eaf0ed] sm:bg-[#f3f4f6] relative font-sans">
      <style dangerouslySetInnerHTML={{__html: `
        .chat-html-content a { color: #3b82f6; text-decoration: underline; cursor: pointer; }
        .chat-html-content .mention { 
          color: #4338ca; 
          background-color: #e0e7ff; 
          padding: 0.15rem 0.4rem; 
          border-radius: 9999px; 
          font-weight: 800; 
          font-size: 0.8em; 
          border: 1px solid #c7d2fe;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          white-space: nowrap;
        }
        .placeholder-empty:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; display: block; }
      `}} />

      <ChatRoomHeader 
        room={room} 
        userData={userData} 
        roomMembers={roomMembers} 
        positions={positions} 
        onBack={onBack} 
        appConfig={appConfig}
        onOpenProfile={onOpenProfile}
        onTogglePin={onTogglePin}
        schoolName={schoolName}
        schoolLogoURL={schoolLogoURL}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenSettings={() => setShowSettings(true)}
        isExternalMode={"category" in userData}
      />

      {/* ★ スマホ画面向けのパディング縮小 (p-4 -> p-2 sm:p-4)、gap縮小 (space-y-6 -> space-y-4) */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 sm:space-y-4 custom-scrollbar" onClick={() => setShowReactionMenuFor(null)}>
        {displayedMessages.map((msg, idx) => {
          const isMe = msg.senderId === userData.id;
          const isSystem = msg.senderId === "system";
          const senderUser = getUserById(msg.senderId);

          const readCount = msg.readBy ? msg.readBy.filter(id => id !== msg.senderId).length : 0;
          const prevMsg = displayedMessages[idx - 1];
          const isNewDay = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

          return (
            <React.Fragment key={msg.id}>
              {isNewDay && !searchQuery && (
                <div className="flex justify-center my-4"><span className="px-3 py-0.5 bg-black/5 rounded-full text-[9px] font-bold text-gray-500 shadow-sm">{new Date(msg.createdAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" })}</span></div>
              )}

              {isSystem ? (
                <div className="flex justify-center my-2"><span className="px-3 py-1.5 bg-black/5 rounded-lg text-[9px] sm:text-[10px] font-bold text-gray-500 text-center whitespace-pre-wrap leading-relaxed max-w-[90%]"><span className="chat-html-content" dangerouslySetInnerHTML={{ __html: msg.text }} /></span></div>
              ) : (
                <div className={`flex items-start gap-1.5 sm:gap-2 relative group w-full transition-colors ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  <div className={`absolute -top-4 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center gap-0.5 bg-white p-0.5 rounded-lg shadow-md border border-gray-200 w-max ${isMe ? 'right-0' : 'left-0'}`}>
                    <button onClick={(e) => { e.stopPropagation(); setShowReactionMenuFor(msg.id); }} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-md transition-colors" title="リアクション"><SmilePlus className="w-3.5 h-3.5" /></button>
                    
                    <button onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); editorRef.current?.focus(); }} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-md transition-colors" title="リプライ"><Reply className="w-3.5 h-3.5" /></button>
                    
                    {isMe && readCount === 0 && !editingMessageId && (
                      <>
                        <div className="w-px h-3 bg-gray-200 mx-0.5"></div>
                        <button onClick={(e) => { e.stopPropagation(); startEditing(msg); }} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-md transition-colors" title="編集"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id); }} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-md transition-colors" title="送信取消"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>

                  {showReactionMenuFor === msg.id && (
                    <div onClick={(e) => e.stopPropagation()} className={`absolute z-30 bg-white border border-gray-200 shadow-xl rounded-2xl p-2 flex flex-wrap gap-1 w-max max-w-[180px] animate-slide-up ${isMe ? 'right-0 top-6' : 'left-0 top-6'}`}>
                      {EMOJIS.map(emoji => (<button key={emoji} onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, emoji, msg.reactions); setShowReactionMenuFor(null); }} className="hover:bg-gray-100 p-1.5 rounded-lg text-lg hover:scale-125 transition-transform">{emoji}</button>))}
                    </div>
                  )}

                  {!isMe && (
                    <div 
                      onClick={() => {
                        if (!("category" in userData) && senderUser && onOpenProfile) {
                          onOpenProfile(senderUser);
                        }
                      }}
                      className={`flex flex-col items-center shrink-0 ${!("category" in userData) && senderUser ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                    >
                      <UserAvatar name={senderUser?.name || "退会ユーザー"} url={(senderUser as any)?.photoURL} isExternal={"category" in (senderUser || {})} />
                    </div>
                  )}

                  {/* ★ 吹き出しの幅とパディングを調整 */}
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[75%]`}>
                    {!isMe && <span className="text-[9px] font-bold text-gray-500 ml-1 mb-0.5">{senderUser?.name || "退会ユーザー"}</span>}
                    <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`flex flex-col gap-1 relative ${isMe ? 'items-end' : 'items-start'}`}>
                        
                        {msg.replyTo && (
                          <div className={`mb-0.5 p-1.5 bg-black/5 rounded-lg border-l-2 ${isMe ? 'border-indigo-400' : 'border-gray-400'} text-[9px] text-gray-600 max-w-full truncate opacity-90`}>
                            <div className="font-bold mb-0.5">{msg.replyTo.senderName}</div>
                            <div className="truncate opacity-80">{msg.replyTo.text || "画像・ファイル"}</div>
                          </div>
                        )}

                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className={`flex flex-col gap-1 w-full ${isMe ? 'items-end' : 'items-start'}`}>
                            {msg.attachments.map((file, fIdx) => (
                              file.type.startsWith('image/') ? (
                                <a key={fIdx} href={file.url} target="_blank" rel="noopener noreferrer" className="block max-w-[200px] sm:max-w-[260px] overflow-hidden rounded-xl shadow-sm hover:opacity-90 transition-opacity bg-white border border-gray-200 p-0.5"><img src={file.url} alt={file.name} className="w-full h-auto rounded-lg object-cover" /></a>
                              ) : (
                                <a key={fIdx} href={file.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl border flex items-center gap-2 max-w-[200px] hover:opacity-80 transition-opacity shadow-sm bg-white border-gray-200">
                                  <div className={`p-1.5 rounded-lg ${isMe ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-600'}`}><FileIcon className="w-4 h-4"/></div>
                                  <div className="flex flex-col min-w-0"><span className="text-[10px] font-bold truncate text-gray-900">{file.name}</span><span className="text-[8px] text-gray-400">ファイル</span></div>
                                </a>
                              )
                            ))}
                          </div>
                        )}
                        {msg.text && (
                          editingMessageId === msg.id ? (
                            <div className="flex flex-col w-full min-w-[240px] bg-white rounded-xl border border-indigo-500 shadow-lg overflow-visible z-20">
                              <RichTextToolbar targetRef={editEditorRef} />
                              <div ref={editEditorRef} contentEditable onKeyDown={(e) => handleKeyDown(e, true)} className="text-[13px] p-2 focus:outline-none min-h-[50px] chat-html-content bg-white rounded-b-xl" />
                              <div className="flex justify-end gap-1.5 p-1.5 bg-gray-50 border-t border-gray-100 rounded-b-xl"><button onClick={() => setEditingMessageId(null)} className="text-[10px] font-bold px-2.5 py-1 text-gray-600 hover:bg-gray-200 rounded transition-colors">キャンセル</button><button onClick={() => handleEditSave(msg.id)} className="text-[10px] font-bold px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow-sm transition-colors">保存</button></div>
                            </div>
                          ) : (
                            <div className={`px-3 py-2 rounded-[18px] shadow-sm text-[13px] sm:text-[14px] break-words whitespace-pre-wrap leading-relaxed chat-html-content ${isMe ? 'bg-[#98e6a1] text-gray-900 border border-[#85cc8e] rounded-tr-sm' : 'bg-white text-gray-900 rounded-tl-sm border border-gray-200'}`}>
                              <div dangerouslySetInnerHTML={{ __html: msg.text }} />
                              {msg.isEdited && <span className={`text-[8px] font-bold block mt-1 ${isMe ? 'text-[#5ca364]' : 'text-gray-400'}`}>(編集済み)</span>}
                            </div>
                          )
                        )}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className={`flex flex-wrap gap-1 mt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {msg.reactions.map((r, i) => (
                              <button key={i} onClick={() => handleReaction(msg.id, r.emoji, msg.reactions)} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold transition-colors shadow-sm ${r.users.includes(userData.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}><span className="text-[11px]">{r.emoji}</span><span>{r.users.length}</span></button>
                            ))}
                            <button onClick={() => setReactionDetailMsg(msg)} className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors bg-white rounded-full border border-gray-200 shadow-sm" title="詳細を見る"><Info className="w-3 h-3" /></button>
                          </div>
                        )}
                      </div>
                      
                      <div className={`flex flex-col gap-0.5 shrink-0 ${isMe ? 'items-end' : 'items-start'}`}>
                        {isMe && room.type !== "direct" ? (
                          <button onClick={() => setReadDetailMsg(msg)} className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors underline decoration-indigo-200 underline-offset-2">
                            既読 {readCount}
                          </button>
                        ) : isMe && readCount > 0 ? (
                          <span className="text-[9px] font-bold text-gray-500">既読</span>
                        ) : null}
                        <span className="text-[9px] font-bold text-gray-400">{formatTime(msg.createdAt)}</span>
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
        {displayedMessages.length === 0 && searchQuery && <div className="flex justify-center my-10 text-xs font-bold text-gray-400">一致するメッセージは見つかりませんでした</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* ★ 入力欄エリアのコンパクト化 */}
      <div className="m-2 sm:m-4 bg-white border border-gray-300 rounded-xl shadow-sm shrink-0 flex flex-col focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all relative z-30">
        
        {mentionState.show && filteredMentionUsers.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 shadow-xl rounded-xl w-64 max-h-48 overflow-y-auto z-[100] custom-scrollbar animate-slide-up">
            <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-100 text-[9px] font-bold text-gray-500 sticky top-0 z-10">メンションする人を選択</div>
            {filteredMentionUsers.map((u, i) => (
              <div key={u.id} onClick={() => insertMention(u)} onMouseEnter={() => setMentionIndex(i)} className={`px-2 py-2 flex items-center gap-2 cursor-pointer border-b border-gray-50 last:border-0 ${i === mentionIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                {u.id === "all" ? <div className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center"><Users className="w-3.5 h-3.5 text-indigo-600" /></div> : <UserAvatar name={u.name} url={(getUserById(u.id) as any)?.photoURL} className="w-6 h-6 text-[9px]" />}
                <div className="flex flex-col min-w-0"><span className={`text-[11px] font-bold truncate ${i === mentionIndex ? 'text-indigo-800' : 'text-gray-900'}`}>@{u.id === 'all' ? '全員' : u.name}</span>{u.role && <span className="text-[9px] text-gray-500">{u.role === "teacher" ? "教職員" : u.role}</span>}</div>
              </div>
            ))}
          </div>
        )}

        {replyingTo && (
          <div className="flex items-center justify-between p-1.5 bg-gray-50 border-b border-gray-100 rounded-t-xl z-20 relative">
            <div className="flex items-center gap-1.5 min-w-0">
              <Reply className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-bold text-gray-700">{getUserById(replyingTo.senderId)?.name || "退会ユーザー"} に返信</span>
                <span className="text-[10px] text-gray-500 truncate">{replyingTo.text.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ') || "画像・ファイル"}</span>
              </div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {showToolbar && <RichTextToolbar targetRef={editorRef} />}
        
        {attachments.length > 0 && (
          <div className="flex gap-1.5 p-2 bg-white border-b border-gray-100 overflow-x-auto no-scrollbar">
            {attachments.map((file, idx) => (
              <div key={idx} className="relative p-1.5 bg-gray-50 rounded border border-gray-200 flex items-center gap-1.5 max-w-[140px] shadow-sm shrink-0">
                {file.type.startsWith('image/') ? <img src={URL.createObjectURL(file)} className="w-6 h-6 object-cover rounded shadow-sm" alt="preview"/> : <div className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center"><FileIcon className="w-3 h-3 text-gray-500"/></div>}
                <span className="text-[9px] font-medium text-gray-700 truncate">{file.name}</span>
                <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-1.5 -right-1.5 bg-gray-500 hover:bg-red-500 text-white rounded-full p-0.5 shadow-md transition-colors"><X className="w-3 h-3"/></button>
              </div>
            ))}
          </div>
        )}

        {/* スマホで無駄なスクロールを防ぐため min-h を縮小 */}
        <div ref={editorRef} contentEditable onInput={handleEditorInput} onKeyDown={(e) => handleKeyDown(e, false)} data-placeholder="メッセージを入力... (@でメンション)" className={`flex-1 max-h-32 min-h-[36px] px-3 py-2 text-[13px] sm:text-[14px] focus:outline-none overflow-y-auto custom-scrollbar placeholder-empty chat-html-content bg-white ${showToolbar && !replyingTo ? '' : 'rounded-t-xl'}`} />

        <div className="flex items-center justify-between px-1.5 py-1 bg-white border-t border-gray-100 rounded-b-xl">
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => setShowToolbar(!showToolbar)} className={`p-1.5 rounded transition-colors ${showToolbar ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`} title="書式設定"><Type className="w-4 h-4" /></button>
            <div className="w-px h-3 bg-gray-200 mx-0.5"></div>
            
            {perms.canSendPhoto && (
              <>
                <button type="button" onClick={() => imageInputRef.current?.click()} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="画像を添付"><ImagePlus className="w-4 h-4" /></button>
                <input type="file" ref={imageInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />
              </>
            )}

            {perms.canSendFile && (
              <>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="ファイルを添付"><Paperclip className="w-4 h-4" /></button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="*/*" multiple className="hidden" />
              </>
            )}
          </div>

          <button onClick={handleSendMessage} disabled={(!editorHtml && attachments.length === 0) || isSending || isUploading} className={`px-3 py-1.5 rounded text-[12px] font-bold transition-all flex items-center gap-1 ${editorHtml || attachments.length > 0 ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm' : 'bg-gray-100 text-gray-400'}`}>
            {isSending || isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> <span className="hidden sm:inline">送信</span></>}
          </button>
        </div>
      </div>

      {showLinkModal && (
        <div className="absolute inset-0 z-[110] flex justify-center items-center bg-black/40 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center"><h3 className="text-xs font-black text-gray-900 flex items-center gap-1.5"><LinkIcon className="w-3.5 h-3.5 text-indigo-600" /> リンクを挿入</h3><button onClick={() => setShowLinkModal(false)} className="p-1.5 hover:bg-gray-200 rounded-md text-gray-500"><X className="w-3.5 h-3.5"/></button></div>
            <div className="p-4">
              <label className="block text-[10px] font-bold text-gray-600 mb-1">URL</label>
              <input type="url" placeholder="https://..." value={linkUrl} onChange={e => setLinkUrl(e.target.value)} autoFocus className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none" />
              <button onClick={handleLinkSave} disabled={!linkUrl} className="w-full mt-4 py-2 bg-indigo-600 text-white text-[11px] font-bold rounded-lg shadow-sm hover:bg-indigo-700 disabled:bg-gray-300 transition-colors">挿入する</button>
            </div>
          </div>
        </div>
      )}

      {reactionDetailMsg && (
        <div className="absolute inset-0 z-[110] flex justify-center items-center bg-black/40 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50"><h3 className="text-xs font-black text-gray-900">リアクションした人</h3><button onClick={() => setReactionDetailMsg(null)} className="p-1.5 hover:bg-gray-200 rounded-md text-gray-500"><X className="w-3.5 h-3.5"/></button></div>
            <div className="p-3 max-h-[300px] overflow-y-auto space-y-4 custom-scrollbar">
              {reactionDetailMsg.reactions?.map((r, i) => (
                <div key={i}>
                  <h4 className="text-[11px] font-bold text-gray-700 flex items-center gap-1 mb-1.5 border-b border-gray-100 pb-1"><span className="text-base">{r.emoji}</span> <span>{r.users.length}名</span></h4>
                  <div className="flex flex-wrap gap-1.5">
                    {r.users.map(uid => { const u = getUserById(uid); return (<div key={uid} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm"><UserAvatar name={u?.name || "退会ユーザー"} url={(u as any)?.photoURL} className="w-5 h-5 text-[8px]" /><span className="text-[9px] font-bold text-gray-800">{u?.name || "退会ユーザー"}</span></div>) })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {readDetailMsg && (
        <div className="absolute inset-0 z-[110] flex justify-center items-center bg-black/40 p-4 animate-fade-in" onClick={() => setReadDetailMsg(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xs font-black text-gray-900">既読・未読ステータス</h3>
              <button onClick={() => setReadDetailMsg(null)} className="p-1.5 hover:bg-gray-200 rounded-md text-gray-500"><X className="w-3.5 h-3.5"/></button>
            </div>
            <div className="p-3 max-h-[400px] overflow-y-auto space-y-4 custom-scrollbar bg-white">
              {(() => {
                const readUsers = roomMembers.filter(u => u.id !== readDetailMsg.senderId && readDetailMsg.readBy?.includes(u.id));
                const unreadUsers = roomMembers.filter(u => u.id !== readDetailMsg.senderId && !readDetailMsg.readBy?.includes(u.id));

                return (
                  <>
                    <div>
                      <h4 className="text-[10px] font-black text-indigo-700 mb-1.5 border-b border-indigo-100 pb-1 flex items-center gap-1">
                        既読 <span className="bg-indigo-100 text-indigo-800 px-1 py-0.5 rounded-full text-[8px]">{readUsers.length}</span>
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {readUsers.length > 0 ? readUsers.map(u => (
                          <div key={u.id} className="flex items-center gap-1.5 bg-indigo-50/50 px-2 py-1 rounded border border-indigo-100 shadow-sm">
                            <UserAvatar name={u.name} url={(u as any).photoURL} isExternal={"category" in u} className="w-4 h-4 text-[7px]" />
                            <span className="text-[9px] font-bold text-gray-800">{u.name}</span>
                          </div>
                        )) : <span className="text-[9px] text-gray-400">なし</span>}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-gray-500 mb-1.5 border-b border-gray-200 pb-1 flex items-center gap-1 mt-1.5">
                        未読 <span className="bg-gray-200 text-gray-600 px-1 py-0.5 rounded-full text-[8px]">{unreadUsers.length}</span>
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {unreadUsers.length > 0 ? unreadUsers.map(u => (
                          <div key={u.id} className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-200 shadow-sm opacity-75">
                            <UserAvatar name={u.name} url={(u as any).photoURL} isExternal={"category" in u} className="w-4 h-4 text-[7px]" />
                            <span className="text-[9px] font-bold text-gray-600">{u.name}</span>
                          </div>
                        )) : <span className="text-[9px] text-gray-400">全員既読です</span>}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <ChatRoomSettingsModal 
          room={room}
          userData={userData}
          roomMembers={roomMembers}
          tenantUsers={tenantUsers}
          externalUsers={externalUsers}
          positions={positions}
          onClose={() => setShowSettings(false)}
        />
      )}

    </div>
  );
}