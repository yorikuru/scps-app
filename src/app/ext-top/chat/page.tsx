"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, onSnapshot, orderBy, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Loader2, AlertTriangle, LogOut, MessageCircle } from "lucide-react";
import { useDialog } from "@/components/DialogContext";

import { UserData, ChatRoom, AppConfig, Position } from "@/app/top/chat/types";
import { ExternalUser } from "@/app/types/external";
import ChatList from "@/app/top/chat/components/ChatList";
import ChatRoomWindow from "@/app/top/chat/components/ChatRoomWindow";
import UserProfileModal from "@/app/top/chat/components/UserProfileModal";
import ExtHeader from "@/app/ext-top/components/ExtHeader";

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

  // ★ 各アプリの通知バッジ管理用ステート
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [hasMention, setHasMention] = useState(false);
  const [rentalsActiveCount, setRentalsActiveCount] = useState(0);
  const [hasOverdueRental, setHasOverdueRental] = useState(false);
  const [boardUnreadCount, setBoardUnreadCount] = useState(0);

  const privateRoomsRef = useRef<ChatRoom[]>([]);

  useEffect(() => {
    let unsubUsers: (() => void) | undefined;
    let unsubExternal: (() => void) | undefined;
    let unsubPositions: (() => void) | undefined;
    let unsubPrivateRooms: (() => void) | undefined;
    // ★ 連携アプリ用の監視解除関数
    let unsubRentals: (() => void) | undefined;
    let unsubBoard: (() => void) | undefined;

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
          
          const nowTimeMs = Date.now();
          let isExpired = false;
          
          if (currentUserData.expiresAt) {
            const expTime = typeof (currentUserData.expiresAt as any).toDate === 'function' 
              ? (currentUserData.expiresAt as any).toDate().getTime() 
              : new Date(currentUserData.expiresAt).getTime();
            
            if (expTime < nowTimeMs) {
              isExpired = true;
            }
          }

          if (currentUserData.status !== "active" || isExpired) {
            setError(isExpired ? "アカウントの有効期限が切れています。" : "アカウントが有効化されていないか、停止されています。");
            setIsLoading(false);
            return;
          }

          const allowedModules = currentUserData.allowedModules || [];
          if (!allowedModules.includes("chat")) {
            setError("チャットアプリの利用権限が付与されていません。");
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
            let unreadTotal = 0;
            let mentionDetected = false;

            snapshot.forEach(d => {
              const data = d.data();
              fetched.push({ id: d.id, ...data, updatedAt: data.updatedAt?.toDate().toISOString() || new Date().toISOString(), createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString() } as ChatRoom);
              
              // ★ チャットの未読・メンション計算
              const myUnread = data.unreadCount?.[currentUserData.id] || 0;
              if (myUnread > 0) {
                unreadTotal += myUnread;
                if (data.lastMessage && data.lastMessage.includes(`@${currentUserData.name}`)) {
                  mentionDetected = true;
                }
              }
            });
            privateRoomsRef.current = fetched;
            mergeAndFilterRooms();
            setChatUnreadCount(unreadTotal);
            setHasMention(mentionDetected);
          });

          // ==========================================
          // ★ 各アプリごとのリアルタイム通知監視リスナー
          // ==========================================

          // 2. Equipmentのレンタル中＆期限超過監視
          if (allowedModules.includes("equipment")) {
            const qRentals = query(
              collection(db, "rentals"),
              where("schoolId", "==", currentUserData.schoolId),
              where("borrowerId", "==", currentUserData.id)
            );
            unsubRentals = onSnapshot(qRentals, (snapshot) => {
              let activeCount = 0;
              let overdueDetected = false;
              const now = new Date();

              snapshot.forEach(d => {
                const rData = d.data();
                if (rData.status === "active" || rData.status === "partial") {
                  activeCount++;
                  if (rData.endDate && new Date(`${rData.endDate}T23:59:59`) < now) {
                    overdueDetected = true;
                  }
                }
              });
              setRentalsActiveCount(activeCount);
              setHasOverdueRental(overdueDetected);
            });
          }

          // 3. Boardの新着連絡事項監視（外部向け公開 かつ 自分が未読のもの）
          if (allowedModules.includes("board")) {
            const qBoard = query(
              collection(db, "announcements"),
              where("schoolId", "==", currentUserData.schoolId),
              where("isExternal", "==", true)
            );
            unsubBoard = onSnapshot(qBoard, (snapshot) => {
              let unreadCount = 0;
              const nowTime = new Date().getTime();
              
              snapshot.forEach(d => {
                const bData = d.data();
                const start = bData.publishStartDate ? new Date(bData.publishStartDate).getTime() : new Date(bData.createdAt).getTime();
                const end = bData.publishEndDate ? new Date(bData.publishEndDate).getTime() : null;
                
                // 公開期間内か判定
                if (start <= nowTime && (!end || end >= nowTime)) {
                  const readByExternal: string[] = bData.readByExternal || [];
                  if (!readByExternal.includes(currentUserData.id)) {
                    unreadCount++;
                  }
                }
              });
              setBoardUnreadCount(unreadCount);
            });
          }

          setIsLoading(false);
        } catch (error) {
          setError("データの読み込みに失敗しました。");
          setIsLoading(false);
        }
      } else {
        router.push("/ext-login");
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUsers) unsubUsers();
      if (unsubExternal) unsubExternal();
      if (unsubPositions) unsubPositions();
      if (unsubPrivateRooms) unsubPrivateRooms();
      if (unsubRentals) unsubRentals();
      if (unsubBoard) unsubBoard();
    };
  }, [router]);

  useEffect(() => {
    if (!isLoading && roomQuery) {
      if (chatRooms.some(r => r.id === roomQuery)) {
        setActiveRoomId(roomQuery);
      } else {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("room");
        router.replace(params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname);
      }
    }
  }, [roomQuery, chatRooms, isLoading, router, searchParams]);

  const updateRoomUrl = (roomId: string | null) => {
    setActiveRoomId(roomId);
    const params = new URLSearchParams(searchParams.toString());
    if (roomId) {
      params.set("room", roomId);
    } else {
      params.delete("room");
    }
    router.replace(params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname);
  };

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
      updateRoomUrl(roomRef.id);
    } catch (error) { 
      showAlert("作成に失敗しました。", "error"); 
    }
  };

  const handleLogout = () => {
    showConfirm(
      "ログアウトしますか？",
      async () => {
        await signOut(auth);
        router.push("/ext-login");
      },
      "warning",
      "ログアウトの確認"
    );
  };

  const handleErrorReturn = () => {
    if (error === "チャットアプリの利用権限が付与されていません。") {
      router.push("/ext-top");
    } else {
      signOut(auth).then(() => router.push("/ext-login"));
    }
  };

  if (isLoading) return <div className="h-[100dvh] flex justify-center items-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  if (error || !extUser) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-black text-gray-900 mb-2">アクセスできません</h1>
        <p className="text-sm font-bold text-gray-500 mb-6">{error}</p>
        <button onClick={handleErrorReturn} className="px-5 py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-transform hover:-translate-y-0.5 shadow-sm">
          <LogOut className="w-4 h-4"/> 戻る
        </button>
      </div>
    );
  }

  const activeRoom = chatRooms.find(r => r.id === activeRoomId);
  const appConfig: AppConfig = { 
    name: schoolData?.customExternalAppNames?.chat || schoolData?.customAppNames?.chat || "ゲストチャット", 
    icon: "MessageCircle", 
    color: "indigo" 
  };

  return (
    <div className="h-[100dvh] font-sans flex flex-col text-gray-900 bg-gray-50 relative overflow-hidden">
      
      {/* 共通の外部用ヘッダー (通知バッジデータを渡す) */}
      <ExtHeader 
        schoolData={schoolData} 
        handleLogout={handleLogout} 
        appMeta={appConfig} 
        showBackButton={true} 
        appBadges={{
          chat: { unread: chatUnreadCount, mention: hasMention },
          equipment: { active: rentalsActiveCount, overdue: hasOverdueRental },
          board: { unread: boardUnreadCount }
        }}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto sm:p-4 flex flex-col min-h-0 bg-white sm:bg-transparent">
        <div className="flex-1 overflow-hidden flex bg-white sm:rounded-2xl sm:shadow-sm sm:border border-gray-200 relative min-h-0">
          
          <div className={`w-full sm:w-80 md:w-96 flex-shrink-0 flex flex-col min-h-0 ${activeRoomId ? 'hidden sm:flex' : 'flex'}`}>
            <ChatList 
              userData={extUser as unknown as UserData} 
              tenantUsers={tenantUsers} 
              externalUsers={externalUsers}
              positions={positions} 
              chatRooms={chatRooms} 
              activeRoomId={activeRoomId} 
              onSelectRoom={updateRoomUrl} 
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

          <div className={`flex-1 flex-col bg-[#f4f7f6] ${!activeRoomId ? 'hidden sm:flex' : 'flex'} sm:border-l border-gray-200 relative min-h-0`}>
            {!activeRoomId || !activeRoom ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                <div className={`p-4 bg-indigo-100 text-indigo-600 rounded-2xl mb-4 shadow-sm opacity-50`}>
                  <MessageCircle className="w-10 h-10" />
                </div>
                <h3 className="text-sm font-black text-gray-600 mb-1">トークルームを選択してください</h3>
                <p className="text-[10px] text-gray-400 mt-1">左側のリストからチャットを選んでください。</p>
              </div>
            ) : (
              <ChatRoomWindow 
                userData={extUser as unknown as UserData} 
                tenantUsers={tenantUsers}
                externalUsers={externalUsers}
                positions={positions} 
                room={activeRoom}
                onBack={() => updateRoomUrl(null)}
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

      {/* 外部ユーザー共通の固定フッター */}
      <div className="flex flex-col gap-1.5 text-[9px] font-bold text-gray-500 text-center pb-8 pt-4">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
            <Link href="/legal/terms" className="hover:text-gray-300 transition-colors">利用規約</Link>
            <Link href="/legal/privacy" className="hover:text-gray-300 transition-colors">プライバシー</Link>
            <Link href="/legal/commercial" className="hover:text-gray-300 transition-colors">特定商取引法</Link>
          </div>
          <div className="text-[8px] text-gray-600 mt-0.5">
            &copy; {new Date().getFullYear()} YORIKURU / 生徒会ポータルシステム
          </div>
        </div>

      {selectedProfileUser && (
        <UserProfileModal 
          user={selectedProfileUser} 
          currentUser={extUser as unknown as UserData} 
          positions={positions} 
          chatRooms={chatRooms} 
          appConfig={appConfig} 
          onClose={() => setSelectedProfileUser(null)} 
          onSelectRoom={updateRoomUrl} 
          onCreatePrivateRoom={handleCreatePrivateRoom} 
        />
      )}

    </div>
  );
}

export default function ExternalChatMainPage() {
  return (
    <Suspense fallback={
      <div className="h-[100dvh] flex justify-center items-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    }>
      <ExternalChatContent />
    </Suspense>
  );
}