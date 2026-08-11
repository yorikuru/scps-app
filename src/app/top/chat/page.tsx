"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, setDoc, updateDoc, serverTimestamp, orderBy, arrayUnion, arrayRemove } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import * as LucideIcons from "lucide-react";
import { Loader2, AlertTriangle, MessageCircle, Lock } from "lucide-react";

import { UserData, ExternalUser, ChatRoom, AppConfig, COLOR_MAPPINGS, Position, ChatRoomType, getDefaultChatPermissions } from "./types";
import ChatList from "./components/ChatList";
import ChatRoomWindow from "./components/ChatRoomWindow";
import ExternalUserManagement from "./components/ExternalUserManagement"; 
import UserProfileModal from "./components/UserProfileModal"; 
import ChatSettings from "./components/ChatSettings"; 
import { useDialog } from "@/components/DialogContext";

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Box;
  return <IconComponent className={className} />;
};

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomQuery = searchParams.get("room");

  const { showAlert, showConfirm } = useDialog();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]);
  const [externalUsers, setExternalUsers] = useState<ExternalUser[]>([]); 
  const [positions, setPositions] = useState<Position[]>([]); 
  const [schoolData, setSchoolData] = useState<any>(null); 
  
  const [appConfig, setAppConfig] = useState<AppConfig>({ name: "チャット", icon: "MessageCircle", color: "green" });
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(true);

  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const [extManageMode, setExtManageMode] = useState<{
    show: boolean;
    mode: "create" | "edit" | "view";
    targetUser?: ExternalUser | null;
  }>({ show: false, mode: "view", targetUser: null });

  const [settingsState, setSettingsState] = useState<{ show: boolean; category: "general" | "external" | "media" }>({
    show: false,
    category: "general"
  });

  const [selectedProfileUser, setSelectedProfileUser] = useState<UserData | ExternalUser | null>(null);

  const privateRoomsRef = useRef<ChatRoom[]>([]);
  const officialRoomsRef = useRef<ChatRoom[]>([]);

  useEffect(() => {
    let unsubCurrentUser: () => void;
    let unsubUsers: () => void;
    let unsubExternal: () => void;
    let unsubPositions: () => void;
    let unsubPrivateRooms: () => void;
    let unsubOfficialRooms: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocSnap = await getDoc(doc(db, "users", user.uid));
          if (!userDocSnap.exists()) { router.push("/login"); return; }
          let currentUserData = { id: user.uid, ...userDocSnap.data() } as UserData;
          
          const schoolDocSnap = await getDoc(doc(db, "schools", currentUserData.schoolId));
          if (schoolDocSnap.exists()) {
            setSchoolData(schoolDocSnap.data());
          }

          unsubCurrentUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
              const updatedData = { id: docSnap.id, ...docSnap.data() } as UserData;
              setUserData(updatedData);

              const perms = getDefaultChatPermissions(updatedData);
              if (updatedData.role === "guest" || (!perms.canUseChat && updatedData.role !== "admin" && updatedData.role !== "system_admin" && !updatedData.isITManager)) {
                setHasPermission(false);
              } else {
                setHasPermission(true);
              }
            } else {
              router.push("/login");
            }
          });

          unsubUsers = onSnapshot(query(collection(db, "users"), where("schoolId", "==", currentUserData.schoolId)), (snapshot) => {
            const fetchedUsers: UserData[] = [];
            snapshot.forEach(d => fetchedUsers.push({ id: d.id, ...d.data() } as UserData));
            setTenantUsers(fetchedUsers);
          });

          unsubExternal = onSnapshot(query(collection(db, "external_users"), where("schoolId", "==", currentUserData.schoolId)), (snapshot) => {
            const fetchedExt: ExternalUser[] = [];
            snapshot.forEach(d => fetchedExt.push({ id: d.id, ...d.data() } as ExternalUser));
            setExternalUsers(fetchedExt);
          });

          unsubPositions = onSnapshot(query(collection(db, "positions"), where("schoolId", "==", currentUserData.schoolId), orderBy("shokui", "asc")), (snapshot) => {
            const fetchedPos: Position[] = [];
            snapshot.forEach(d => fetchedPos.push({ id: d.id, ...d.data() } as Position));
            setPositions(fetchedPos);
          });

          const mergeAndFilterRooms = () => {
            const merged = [...privateRoomsRef.current, ...officialRoomsRef.current];
            const uniqueMap = new Map<string, ChatRoom>();
            merged.forEach(r => uniqueMap.set(r.id, r));

            const accessibleRooms = Array.from(uniqueMap.values()).filter(r => {
              if (r.type === "direct" || r.type === "custom_group") return r.members.includes(currentUserData.id);
              if (r.type === "tenant_all") return true;
              if (r.type === "role_admin") return currentUserData.role === "admin" || currentUserData.role === "system_admin" || currentUserData.isITManager;
              if (r.type === "role_teacher") return currentUserData.role === "teacher";
              if (r.type === "role_manager") return currentUserData.isManager;
              if (r.type === "position") return currentUserData.positionIds?.includes(r.targetId!) || currentUserData.primaryPositionId === r.targetId;
              return false;
            });

            accessibleRooms.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            setChatRooms(accessibleRooms);
          };

          unsubPrivateRooms = onSnapshot(query(collection(db, "chat_rooms"), where("schoolId", "==", currentUserData.schoolId), where("members", "array-contains", currentUserData.id)), (snapshot) => {
            const fetched: ChatRoom[] = [];
            snapshot.forEach(d => {
              const data = d.data();
              fetched.push({ id: d.id, ...data, updatedAt: data.updatedAt?.toDate().toISOString() || new Date().toISOString(), createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString() } as ChatRoom);
            });
            privateRoomsRef.current = fetched;
            mergeAndFilterRooms();
          });

          unsubOfficialRooms = onSnapshot(query(collection(db, "chat_rooms"), where("schoolId", "==", currentUserData.schoolId), where("isOfficial", "==", true)), (snapshot) => {
            const fetched: ChatRoom[] = [];
            snapshot.forEach(d => {
              const data = d.data();
              fetched.push({ id: d.id, ...data, updatedAt: data.updatedAt?.toDate().toISOString() || new Date().toISOString(), createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString() } as ChatRoom);
            });
            officialRoomsRef.current = fetched;
            mergeAndFilterRooms();
          });

          setIsLoading(false);
        } catch (error) {
          setIsLoading(false);
        }
      } else {
        router.push("/login");
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubCurrentUser) unsubCurrentUser();
      if (unsubUsers) unsubUsers();
      if (unsubExternal) unsubExternal();
      if (unsubPositions) unsubPositions();
      if (unsubPrivateRooms) unsubPrivateRooms();
      if (unsubOfficialRooms) unsubOfficialRooms();
    };
  }, [router]);

  // URLに room パラメータがあれば自動選択
  useEffect(() => {
    if (roomQuery && chatRooms.some(r => r.id === roomQuery)) {
      setActiveRoomId(roomQuery);
    }
  }, [roomQuery, chatRooms]);

  useEffect(() => {
    const handleOpenProfile = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setSelectedProfileUser(customEvent.detail);
      }
    };
    window.addEventListener('open-profile', handleOpenProfile);
    return () => window.removeEventListener('open-profile', handleOpenProfile);
  }, []);

  const c = COLOR_MAPPINGS[appConfig.color] || COLOR_MAPPINGS.default;

  const handleCreatePrivateRoom = async (data: { type: "direct" | "custom_group"; name?: string; members: string[] }) => {
    if (!userData) return;
    try {
      const sysMessageText = data.type === "custom_group" ? `${userData.name}がグループ「${data.name}」を作成しました。` : `${userData.name}がチャットを開始しました。`;
      const roomRef = await addDoc(collection(db, "chat_rooms"), {
        schoolId: userData.schoolId,
        type: data.type,
        isOfficial: false,
        name: data.name || "",
        members: data.members,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: sysMessageText,
        pinnedBy: [],
        unreadCount: {}
      });
      await addDoc(collection(db, "chat_messages"), { roomId: roomRef.id, senderId: "system", text: sysMessageText, readBy: [userData.id], createdAt: serverTimestamp() });
      setActiveRoomId(roomRef.id);
      setExtManageMode({ show: false, mode: "view", targetUser: null }); 
      setSettingsState({ show: false, category: "general" });
    } catch (error) { showAlert("作成に失敗しました。", "error"); }
  };

  const handleJoinOfficialRoom = async (data: { type: ChatRoomType; targetId?: string; name: string }) => {
    if (!userData) return;
    try {
      const roomId = `${userData.schoolId}_${data.type}_${data.targetId || 'all'}`;
      const roomRef = doc(db, "chat_rooms", roomId);
      const roomSnap = await getDoc(roomRef);
      
      if (!roomSnap.exists()) {
        const sysMessageText = `「${data.name}」の公式トークルームが作成されました。\n※このルームは所属メンバーが自動的に参加・退出します。`;
        await setDoc(roomRef, {
          schoolId: userData.schoolId,
          type: data.type,
          targetId: data.targetId || null,
          isOfficial: true,
          name: data.name,
          members: [], 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: sysMessageText,
          pinnedBy: [],
          unreadCount: {}
        });
        await addDoc(collection(db, "chat_messages"), { roomId: roomId, senderId: "system", text: sysMessageText, readBy: [userData.id], createdAt: serverTimestamp() });
      }
      setActiveRoomId(roomId);
      setExtManageMode({ show: false, mode: "view", targetUser: null });
      setSettingsState({ show: false, category: "general" });
    } catch (error) { showAlert("ルームへの移動に失敗しました。", "error"); }
  };

  const handleTogglePin = async (roomId: string, isPinned: boolean) => {
    if (!userData) return;
    try {
      const roomRef = doc(db, "chat_rooms", roomId);
      if (isPinned) {
        await updateDoc(roomRef, { pinnedBy: arrayRemove(userData.id) });
      } else {
        await updateDoc(roomRef, { pinnedBy: arrayUnion(userData.id) });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenExternalUserManagement = (mode: "create" | "edit" | "view", user?: ExternalUser | null) => {
    setActiveRoomId(null); 
    setSettingsState({ show: false, category: "general" }); 
    setExtManageMode({ show: true, mode, targetUser: user || null });
  };

  const handleOpenSettings = (category: "general" | "external" | "media" = "general") => {
    setActiveRoomId(null);
    setExtManageMode({ show: false, mode: "view", targetUser: null });
    setSettingsState({ show: true, category });
  };

  if (isLoading || !userData) {
    return <div className="h-full flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }

  if (!hasPermission) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50 text-gray-900 p-4 text-center font-sans">
        <Lock className="w-16 h-16 text-gray-300 mb-6" />
        <h1 className="text-xl font-black mb-2 tracking-tight">チャット機能は制限されています</h1>
        <p className="text-sm font-bold text-gray-500 max-w-md leading-relaxed">
          管理者によってこのアカウントのチャット利用権限がオフに設定されているため、アクセスできません。
        </p>
      </div>
    );
  }

  const activeRoom = chatRooms.find(r => r.id === activeRoomId);

  return (
    <div className="h-full font-sans flex flex-col text-gray-900 bg-[#F9FAFB]">
      {/* ★ 全体的にコンパクトにするため p-3 sm:p-4 lg:p-6 を p-2 sm:p-4 lg:p-6 に調整 */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-2 sm:p-4 lg:p-6 flex flex-col min-h-0">
        
        {/* ★ スマホ画面では見出しのmb-4をmb-2に詰める */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-2 sm:mb-4 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`p-2 sm:p-2.5 ${c.lightBg} ${c.text} rounded-xl shadow-sm`}>
              <DynamicIcon name={appConfig.icon} className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 tracking-tight">{appConfig.name}</h1>
              <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 mt-0.5">役員間や外部メンバーとのリアルタイム連絡</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex bg-white rounded-2xl shadow-sm border border-gray-200 relative">
          
          <div className={`w-full sm:w-72 md:w-80 lg:w-96 flex-shrink-0 ${activeRoomId || extManageMode.show || settingsState.show ? 'hidden sm:block' : 'block'}`}>
            <ChatList 
              userData={userData} 
              tenantUsers={tenantUsers} 
              externalUsers={externalUsers}
              positions={positions} 
              chatRooms={chatRooms} 
              activeRoomId={activeRoomId} 
              onSelectRoom={(id) => {
                setActiveRoomId(id);
                setExtManageMode({ show: false, mode: "view", targetUser: null });
                setSettingsState({ show: false, category: "general" });
              }} 
              onCreatePrivateRoom={handleCreatePrivateRoom}
              onJoinOfficialRoom={handleJoinOfficialRoom}
              onTogglePin={handleTogglePin}
              onOpenExternalUserManagement={handleOpenExternalUserManagement} 
              onOpenSettings={handleOpenSettings}
              appConfig={appConfig}
              schoolName={schoolData?.name}
              schoolLogoURL={schoolData?.logoURL}
            />
          </div>

          <div className={`flex-1 flex-col bg-[#f4f7f6] ${!activeRoomId && !extManageMode.show && !settingsState.show ? 'hidden sm:flex' : 'flex'} border-l border-gray-200 relative`}>
            
            {settingsState.show ? (
              <ChatSettings 
                tenantUsers={tenantUsers}
                positions={positions}
                category={settingsState.category}
                onClose={() => setSettingsState({ show: false, category: "general" })}
              />
            ) : extManageMode.show ? (
              <ExternalUserManagement 
                userData={userData}
                mode={extManageMode.mode}
                targetUser={extManageMode.targetUser}
                onClose={() => setExtManageMode({ show: false, mode: "view", targetUser: null })}
                onSuccess={() => {}}
              />
            ) : activeRoomId && activeRoom ? (
              <ChatRoomWindow 
                userData={userData}
                tenantUsers={tenantUsers}
                externalUsers={externalUsers}
                positions={positions} 
                room={activeRoom}
                onBack={() => setActiveRoomId(null)}
                appConfig={appConfig}
                onOpenProfile={(u) => setSelectedProfileUser(u)} 
                onTogglePin={handleTogglePin}
                schoolName={schoolData?.name}
                schoolLogoURL={schoolData?.logoURL}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                <div className={`p-4 ${c.lightBg} ${c.text} rounded-2xl mb-4 shadow-sm opacity-50`}>
                  <MessageCircle className="w-10 h-10" />
                </div>
                <h3 className="text-sm font-black text-gray-600 mb-1">トークルームまたは左側のメニューを選択してください</h3>
              </div>
            )}

          </div>

        </div>
      </main>

      {selectedProfileUser && (
        <UserProfileModal 
          user={selectedProfileUser} 
          currentUser={userData} 
          positions={positions} 
          chatRooms={chatRooms} 
          appConfig={appConfig} 
          onClose={() => setSelectedProfileUser(null)} 
          onSelectRoom={(id) => {
            setActiveRoomId(id);
            setExtManageMode({ show: false, mode: "view", targetUser: null });
            setSettingsState({ show: false, category: "general" });
          }} 
          onCreatePrivateRoom={handleCreatePrivateRoom} 
        />
      )}

    </div>
  );
}