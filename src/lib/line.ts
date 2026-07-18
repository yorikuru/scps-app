"use server";

import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Firebase Admin SDK の初期化とFirestoreインスタンスの取得を安全に行う関数
 * Cloud Run等のインスタンス再利用時のエラーや、環境変数の改行コード破壊を防ぎます。
 */
function getAdminDb() {
  if (getApps().length === 0) {
    const base64Key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!base64Key) {
      throw new Error("環境変数 GOOGLE_SERVICE_ACCOUNT_KEY が設定されていません。");
    }

    // Base64デコード処理（改行コード破壊に強い設計）
    const decodedKey = Buffer.from(base64Key, "base64").toString("utf-8");
    const credentials = JSON.parse(decodedKey);

    initializeApp({
      credential: cert(credentials),
    });
  }

  // インスタンス再利用時の「アプリが見つからない」エラーを防ぐため、明示的にappを渡す
  const app = getApp();
  return getFirestore(app);
}

/**
 * LINE Messaging API を使用してプッシュメッセージを直接送信する下請け関数
 * 
 * @param to 宛先のLINEユーザーID（Uから始まる文字列）
 * @param text 送信するメッセージの内容
 */
export async function sendLineMessage(to: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  
  if (!token) {
    console.error("環境変数 LINE_CHANNEL_ACCESS_TOKEN が設定されていません。");
    return { success: false, error: "LINE通知のシステム設定が完了していません。" };
  }

  if (!to) {
    console.error("宛先のユーザーIDが指定されていません。");
    return { success: false, error: "宛先が指定されていません。" };
  }

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        to: to,
        messages: [
          {
            type: "text",
            text: text
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("LINE API 送信エラー:", errorData);
      return { success: false, error: "LINE API 側でエラーが発生しました。" };
    }

    return { success: true };
  } catch (error) {
    console.error("LINEメッセージ送信処理中の通信エラー:", error);
    return { success: false, error: "通信エラーが発生しました。" };
  }
}

/**
 * ユーザーの受信設定（ON/OFF）を判定した上でLINE通知を送る統合関数
 * 今後、システム内の通知は基本的にこの関数を呼び出します。
 * 
 * @param portalUserId 送信先ユーザーのポータルID（FirestoreのUID）
 * @param text 送信するメッセージ内容
 * @param isImportant 重要メッセージフラグ（trueの場合は受信OFFでも強制配信）
 */
export async function sendNotificationToUser(portalUserId: string, text: string, isImportant: boolean = false) {
  try {
    const adminDb = getAdminDb();
    const userDocRef = adminDb.collection("users").doc(portalUserId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return { success: false, error: "ユーザーが存在しません。" };
    }

    const userData = userDoc.data();
    const lineUserId = userData?.lineUserId;
    // デフォルトはON（true）として扱う
    const isNotificationEnabled = userData?.lineNotificationEnabled !== false;

    // LINE連携していない場合はスキップ
    if (!lineUserId) {
      return { success: false, error: "このユーザーはLINE連携を行っていません。" };
    }

    // 通常メッセージで、かつユーザーが受信OFFにしている場合は送信しない
    if (!isImportant && !isNotificationEnabled) {
      return { success: true, message: "ユーザーが通知をOFFにしているため配信をスキップしました。" };
    }

    // メッセージの最終構築（重要な場合はヘッダーを付与）
    const finalText = isImportant ? `【📢 重要なお知らせ】\n\n${text}` : text;

    // 送信実行
    return await sendLineMessage(lineUserId, finalText);

  } catch (error: any) {
    console.error("通知設定の読み込み中にエラー:", error);
    return { success: false, error: error.message || "データベースの読み込みに失敗しました。" };
  }
}

/**
 * システム管理者（テスト用のユーザーID）に直接通知を送るショートカット関数
 */
export async function sendLineToAdmin(text: string) {
  const adminUserId = process.env.LINE_TEST_USER_ID;
  
  if (!adminUserId) {
    console.error("環境変数 LINE_TEST_USER_ID が設定されていません。");
    return { success: false, error: "管理者IDが設定されていません。" };
  }

  return await sendLineMessage(adminUserId, text);
}