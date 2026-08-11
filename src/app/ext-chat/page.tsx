"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, onSnapshot, orderBy, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Loader2, AlertTriangle, LogOut, MessageCircle, Building2 } from "lucide-react";
import { useDialog } from "@/components/DialogContext";

import { UserData, ExternalUser, ChatRoom, AppConfig, COLOR_MAPPINGS, Position } from "../top/chat/types";
import ChatList from "../top/chat/components/ChatList";
import ChatRoomWindow from "../top/chat/components/ChatRoomWindow";
import UserProfileModal from "../top/chat/components/UserProfileModal";

function ExternalChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomQuery = searchParams.get("room");

  const { showAlert, showConfirm } = useDialog();
  
  const [extUser, setExtUser] = useState<ExternalUser | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]);
  const [externalUsers, setExternalUsers] = useState<ExternalUser[]>([]); 
  const [positions, setPositions] = useState<Position[]>([]); 
  const [schoolData, setSchoolData] = useState<any>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const [selectedProfileUser, setSelectedProfileUser] = useState<UserData | ExternalUser | null>(null);

  const appConfig: AppConfig = { name: "ゲストチャット", icon: "MessageCircle", color: "indigo" };
  const c = COLOR_MAPPINGS[appConfig.color] || COLOR_MAPPINGS.default;

  const privateRoomsRef = useRef<ChatRoom[]>([]);

  useEffect(() => {
    let unsubUsers: (() => void) | undefined;
    let unsubExternal: (() => void) | undefined;
    let unsubPositions: (() => void) | undefined;
    let unsubPrivateRooms: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const qExt = query(collection(db, "external_users"), where("authUid", "==", user.uid));
          const querySnapshot = await getDocs(qExt); 

          if (querySnapshot.empty) {
            setError("外部ユーザーアカウントが見つかりません。");
            setIsLoading(false);
            return;
          }

          const extDoc = querySnapshot.docs[0];
          const currentUserData = { id: extDoc.id, ...extDoc.data() } as ExternalUser;
          
          const now = Date.now();
          let isExpired = false;
          
          if ((currentUserData as any).expiresAt) {
            const expTime = typeof ((currentUserData as any).expiresAt as any).toDate === 'function' 
              ? ((currentUserData as any).expiresAt as any).toDate().getTime() 
              : new Date((currentUserData as any).expiresAt).getTime();
            
            if (expTime < now) {
              isExpired = true;
            }
          }

          if (currentUserData.status !== "active" || isExpired) {
            setError(isExpired ? "アカウントの有効期限が切れています。" : "アカウントが有効化されていないか、停止されています。");
            setIsLoading(false);
            return;
          }

          setExtUser(currentUserData);

          const schoolDocSnap = await getDoc(doc(db, "schools", currentUserData.schoolId));
          if (schoolDocSnap.exists()) {
            setSchoolData(schoolDocSnap.data());
          }

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
            const merged = [...privateRoomsRef.current];
            const uniqueMap = new Map<string, ChatRoom>();
            merged.forEach(r => uniqueMap.set(r.id, r));

            const accessibleRooms = Array.from(uniqueMap.values()).filter(r => {
              if (r.type === "direct" || r.type === "custom_group") return r.members.includes(currentUserData.id);
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

          setIsLoading(false);
        } catch (error) {
          setError("データの読み込みに失敗しました。");
          setIsLoading(false);
        }
      } else {
        router.push("/chat-login");
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUsers) unsubUsers();
      if (unsubExternal) unsubExternal();
      if (unsubPositions) unsubPositions();
      if (unsubPrivateRooms) unsubPrivateRooms();
    };
  }, [router]);

  useEffect(() => {
    if (roomQuery && chatRooms.some(r => r.id === roomQuery)) {
      setActiveRoomId(roomQuery);
    }
  }, [roomQuery, chatRooms]);

  const handleTogglePin = async (roomId: string, isPinned: boolean) => {
    if (!extUser) return;
    try {
      const roomRef = doc(db, "chat_rooms", roomId);
      if (isPinned) {
        await updateDoc(roomRef, { pinnedBy: arrayRemove(extUser.id) });
      } else {
        await updateDoc(roomRef, { pinnedBy: arrayUnion(extUser.id) });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreatePrivateRoom = async (data: { type: "direct" | "custom_group"; name?: string; members: string[] }) => {
    if (!extUser) return;
    try {
      const sysMessageText = `${extUser.name}がチャットを開始しました。`;
      const roomRef = await addDoc(collection(db, "chat_rooms"), {
        schoolId: extUser.schoolId,
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
      await addDoc(collection(db, "chat_messages"), { roomId: roomRef.id, senderId: "system", text: sysMessageText, readBy: [extUser.id], createdAt: serverTimestamp() });
      setActiveRoomId(roomRef.id);
    } catch (error) { 
      showAlert("作成に失敗しました。", "error"); 
    }
  };

  const handleLogout = () => {
    showConfirm(
      "ログアウトしますか？",
      async () => {
        await signOut(auth);
        router.push("/chat-login");
      },
      "warning",
      "ログアウトの確認"
    );
  };

  // UIエラーの際のログアウト用
  const handleErrorLogout = async () => {
    await signOut(auth);
    router.push("/chat-login");
  };

  if (isLoading) return <div className="h-screen flex justify-center items-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  if (error || !extUser) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-black text-gray-900 mb-2">アクセスできません</h1>
        <p className="text-sm font-bold text-gray-500 mb-6">{error}</p>
        <button onClick={handleErrorLogout} className="px-5 py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl flex items-center gap-2">
          <LogOut className="w-4 h-4"/> ログアウトして戻る
        </button>
      </div>
    );
  }

  const activeRoom = chatRooms.find(r => r.id === activeRoomId);

  return (
    <div className="h-screen font-sans flex flex-col text-gray-900 bg-gray-50 relative">
      
      <header className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-2.5">
          {schoolData?.logoURL ? (
            <img src={schoolData.logoURL} alt={schoolData.name} className="w-9 h-9 rounded-full object-cover bg-white border border-indigo-400" />
          ) : (
            <div className="p-2 bg-white/20 rounded-full">
              <Building2 className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-sm font-black tracking-tight">{schoolData?.name || "SCPS 利用校"}</h1>
            <p className="text-[9px] font-medium text-indigo-200">生徒会ポータルシステム ゲストチャットルーム</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-bold">{extUser.name}</span>
            <span className="text-[9px] text-indigo-200">{extUser.affiliation || "ゲスト"}</span>
          </div>
          <button onClick={handleLogout} className="p-2 bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors" title="ログアウト">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>
      

      <main className="flex-1 w-full max-w-7xl mx-auto p-2 sm:p-4 flex flex-col min-h-0">
        <div className="flex-1 overflow-hidden flex bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 relative">
          
          <div className={`w-full sm:w-80 md:w-96 flex-shrink-0 ${activeRoomId ? 'hidden sm:block' : 'block'}`}>
            <ChatList 
              userData={extUser as unknown as UserData} 
              tenantUsers={tenantUsers} 
              externalUsers={externalUsers}
              positions={positions} 
              chatRooms={chatRooms} 
              activeRoomId={activeRoomId} 
              onSelectRoom={setActiveRoomId} 
              onCreatePrivateRoom={() => {}} 
              onJoinOfficialRoom={() => {}}
              onTogglePin={handleTogglePin}
              onOpenExternalUserManagement={() => {}} 
              appConfig={appConfig}
              isExternalMode={true}
              schoolName={schoolData?.name}
              schoolLogoURL={schoolData?.logoURL}
            />
          </div>

          <div className={`flex-1 flex-col bg-[#f4f7f6] ${!activeRoomId ? 'hidden sm:flex' : 'flex'} border-l border-gray-200 relative`}>
            {!activeRoomId || !activeRoom ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                <div className={`p-4 bg-indigo-100 text-indigo-600 rounded-2xl mb-4 shadow-sm opacity-50`}>
                  <MessageCircle className="w-10 h-10" />
                </div>
                <h3 className="text-sm font-black text-gray-600 mb-1">トークルームを選択してください</h3>
                <p className="text-[10px] text-gray-400">左側のリストからチャットを選んでください。</p>
              </div>
            ) : (
              <ChatRoomWindow 
                userData={extUser as unknown as UserData} 
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
            )}
          </div>

        </div>
      </main>

      <div className="flex flex-col gap-1.5 text-[9px] font-bold text-gray-500 text-center">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
              <Link href="/legal/terms" className="hover:text-gray-300 transition-colors">利用規約</Link>
              <Link href="/legal/privacy" className="hover:text-gray-300 transition-colors">プライバシー</Link>
              <Link href="/legal/commercial" className="hover:text-gray-300 transition-colors">特定商取引法</Link>
            </div>
            <div className="text-[8px] text-gray-600 mt-0.5">
              &copy; {new Date().getFullYear()} YORIKURU / 生徒会ポータルシステム
            </div>
            <br/><br/>
          </div>


      {selectedProfileUser && (
        <UserProfileModal 
          user={selectedProfileUser} 
          currentUser={extUser as unknown as UserData} 
          positions={positions} 
          chatRooms={chatRooms} 
          appConfig={appConfig} 
          onClose={() => setSelectedProfileUser(null)} 
          onSelectRoom={setActiveRoomId} 
          onCreatePrivateRoom={handleCreatePrivateRoom} 
        />
      )}

    </div>
  );
}

export default function ExternalChatMainPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex justify-center items-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    }>
      <ExternalChatContent />
    </Suspense>
  );
}