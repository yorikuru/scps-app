"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ユーザーデータの型定義
type UserData = {
  name: string;
  schoolId: string;
  role: string;
};

// お知らせデータの型定義
type Announcement = {
  id: string;
  title: string;
  content: string;
  authorName: string;
  createdAt: Date | null;
};

// UIアラートの型定義
type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

export default function BoardPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 投稿フォーム用ステート
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alert, setAlert] = useState<AlertState>({ show: false, type: "success", message: "" });

  useEffect(() => {
    let unsubscribeAnnouncements: () => void;

    // 認証状態の監視とユーザーデータの取得
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const data = userDocSnap.data() as UserData;
            setUserData(data);

            // 所属学校のお知らせをリアルタイム取得
            const announcementsRef = collection(db, "announcements");
            const q = query(
              announcementsRef,
              where("schoolId", "==", data.schoolId),
              orderBy("createdAt", "desc")
            );

            unsubscribeAnnouncements = onSnapshot(q, (snapshot) => {
              const fetchedAnnouncements: Announcement[] = [];
              snapshot.forEach((doc) => {
                const docData = doc.data();
                fetchedAnnouncements.push({
                  id: doc.id,
                  title: docData.title,
                  content: docData.content,
                  authorName: docData.authorName,
                  // FirestoreのTimestampをDateに変換。まだサーバーに書き込まれていない場合はnull
                  createdAt: docData.createdAt ? docData.createdAt.toDate() : null,
                });
              });
              setAnnouncements(fetchedAnnouncements);
              setIsLoading(false);
            });
          } else {
            router.push("/login");
          }
        } catch (error) {
          console.error("Error fetching data:", error);
          setIsLoading(false);
        }
      } else {
        router.push("/login");
      }
    });

    // クリーンアップ関数
    return () => {
      unsubscribeAuth();
      if (unsubscribeAnnouncements) {
        unsubscribeAnnouncements();
      }
    };
  }, [router]);

  // 新規投稿の処理
  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert({ show: false, type: "success", message: "" });

    if (!newTitle.trim() || !newContent.trim()) {
      setAlert({
        show: true,
        type: "error",
        message: "タイトルと本文を入力してください。",
      });
      return;
    }

    if (!userData) return;

    setIsSubmitting(true);

    try {
      await addDoc(collection(db, "announcements"), {
        schoolId: userData.schoolId,
        title: newTitle.trim(),
        content: newContent.trim(),
        authorName: userData.name,
        authorId: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
      });

      // 成功したらフォームをリセット
      setNewTitle("");
      setNewContent("");
      setAlert({
        show: true,
        type: "success",
        message: "お知らせを投稿しました。",
      });

      // 3秒後に成功アラートを消す
      setTimeout(() => {
        setAlert((prev) => ({ ...prev, show: false }));
      }, 3000);

    } catch (error) {
      console.error("Error posting announcement:", error);
      setAlert({
        show: true,
        type: "error",
        message: "投稿に失敗しました。通信環境を確認してください。",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 日付のフォーマット関数
  const formatDate = (date: Date | null) => {
    if (!date) return "送信中...";
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 font-medium text-sm">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 truncate">お知らせボード</h1>
          <button
            onClick={() => router.push("/top")}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            &larr; トップに戻る
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* UIアラート */}
        {alert.show && (
          <div
            className={`mb-6 p-4 rounded-md text-sm shadow-sm ${
              alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {alert.message}
          </div>
        )}

        {/* 新規投稿フォーム */}
        <div className="bg-white shadow sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">新規お知らせを作成</h3>
            <form onSubmit={handlePostSubmit} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  タイトル
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border text-gray-900"
                    placeholder="例: 次回の定例会議について"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="content" className="block text-sm font-medium text-gray-700">
                  本文
                </label>
                <div className="mt-1">
                  <textarea
                    id="content"
                    rows={4}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border text-gray-900"
                    placeholder="連絡事項をここに入力してください..."
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                    isSubmitting ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  }`}
                >
                  {isSubmitting ? "投稿中..." : "投稿する"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* お知らせタイムライン */}
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">最新のお知らせ</h3>
          
          {announcements.length === 0 ? (
            <div className="text-center py-12 bg-white shadow sm:rounded-lg">
              <p className="text-sm text-gray-500">お知らせはまだありません。</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="bg-white shadow sm:rounded-lg overflow-hidden">
                  <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:justify-between sm:items-baseline">
                    <h4 className="text-md font-bold text-gray-900 break-words">
                      {announcement.title}
                    </h4>
                    <p className="mt-1 sm:mt-0 text-xs text-gray-500 shrink-0">
                      {formatDate(announcement.createdAt)}
                    </p>
                  </div>
                  <div className="px-4 py-5 sm:p-6">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center">
                      <div className="flex-shrink-0 bg-gray-200 rounded-full h-6 w-6 flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">
                          {announcement.authorName.charAt(0)}
                        </span>
                      </div>
                      <p className="ml-2 text-xs text-gray-500">
                        投稿者: {announcement.authorName}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}