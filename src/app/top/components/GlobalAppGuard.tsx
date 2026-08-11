"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

// ★ 1. 先ほど作った Context からフックをインポート
import { useDialog } from "@/components/DialogContext";

export default function GlobalAppGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  // ★ 2. コンポーネントの直下でフックを呼び出し、showAlert を取り出す
  const { showAlert } = useDialog();
  
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [systemApps, setSystemApps] = useState<any[]>([]);

  // 1. 初回のみ、システムに存在する全アプリ情報を取得
  useEffect(() => {
    const fetchApps = async () => {
      try {
        const appsSnap = await getDocs(collection(db, "system_apps"));
        const apps = appsSnap.docs.map(doc => doc.data());
        setSystemApps(apps);
      } catch(e) {
        console.error(e);
      }
    };
    fetchApps();
  }, []);

  // 2. URLが変更されるたびに権限をチェック
  useEffect(() => {
    if (systemApps.length === 0) return;

    // 現在のURLが、登録されているアプリのパス(path)に該当するか判定
    const currentApp = systemApps.find(app => pathname.startsWith(app.path));

    // アプリ以外のページ（/top, /top/admin など）はスルーして許可
    if (!currentApp) {
      setIsAuthorized(true);
      setIsLoading(false);
      return;
    }

    const appId = currentApp.appId;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
          router.replace("/login");
          return;
        }

        const userData = userDoc.data();
        
        // システム管理者は全スルー
        if (userData.role === "system_admin") {
          setIsAuthorized(true);
          setIsLoading(false);
          return;
        }

        const schoolDoc = await getDoc(doc(db, "schools", userData.schoolId));
        if (!schoolDoc.exists()) {
          router.replace("/top");
          return;
        }

        const schoolData = schoolDoc.data();

        // テナントと個人の権限チェック
        const isTenantAllowed = schoolData.availableModules?.includes(appId);
        const isUserAllowed = userData.allowedModules?.includes(appId);

        if (!isTenantAllowed || !isUserAllowed) {
          // ★ 3. ここで取得した showAlert を使う (見た目がエラーになるように "error" を追加)
          showAlert(`「${schoolData.customAppNames?.[appId] || currentApp.name}」にアクセスする権限がありません。`, "error");
          router.replace("/top");
        } else {
          setIsAuthorized(true);
        }
      } catch (error) {
        console.error("GlobalAppGuard error:", error);
        router.replace("/top");
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [pathname, router, systemApps, showAlert]); // 依存配列に showAlert も念のため追加

  // チェック中はローディング画面を表示
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  // 権限がない場合は画面を真っ白にしてリダイレクトを待つ
  if (!isAuthorized) {
    return null;
  }

  // 権限があればページの中身を表示する
  return <>{children}</>;
}