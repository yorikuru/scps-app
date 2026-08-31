"use server";

/* =====================================================================
 * 【削除禁止】SCPS メール送信カテゴリ定義＆運用メモ
 * =====================================================================
 * （※詳細は src/lib/mail.ts を参照）
 * 1. default (scps_member_support@) : SCPS メンバーサポート
 * 2. auth (scps_auth@) : SCPS アカウント管理
 * 3. notice (scps_notice@) : SCPS お知らせ
 * 4. action (scps_action@) : SCPS リマインダー
 * 5. admin_support (scps_admin_support@) : SCPS 管理者サポート
 * 6. alerts (scps_alerts@) : SCPS システム監視
 * 7. noreply (scps_noreply@) : SCPS 自動送信
 * 8. billing (scps_billing@) : SCPS 請求・契約管理
 * 9. news (scps_news@) : SCPS アップデート
 * 10. export (scps_export@) : SCPS データ出力
 * ===================================================================== */

import { doc, collection, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sendNotificationToUser } from "@/lib/line";
import { sendNotificationEmailToUser, EmailCategory } from "@/lib/mail";

export type NotificationType = "none" | "email" | "line" | "both";

export type DispatchParams = {
  targetUserIds: string[];         // 配信対象のユーザーUID配列
  title: string;                   // 通知タイトル
  messageBody: string;             // お知らせの概要/要約本文
  detailUrl?: string;              // 遷移先URL（例: /top?msgId=xxx）
  sourceApp?: string;              // 呼び出し元アプリ識別子 (system, task, board, survey等)
  isImportant?: boolean;          // 緊急フラグ
  senderName?: string;             // 配信者名（画面表示用）
  notificationMethod?: NotificationType; // 外部通知方法
  senderEmailCategory?: EmailCategory; // メール用途カテゴリ
};

/**
 * システム全体で利用する汎用一括通知ヘルパー関数
 */
export async function dispatchNotification({
  targetUserIds,
  title,
  messageBody,
  detailUrl = "/top",
  sourceApp = "system",
  isImportant = false,
  senderName,
  notificationMethod = "none",
  senderEmailCategory = "default"
}: DispatchParams) {
  if (!targetUserIds || targetUserIds.length === 0) {
    return { success: true, count: 0, emailSuccess: 0, lineSuccess: 0 };
  }

  const publishDate = new Date();
  const batch = writeBatch(db);
  let batchCount = 0;

  // 1. アプリ内インボックス通知データの作成（Firestore）
  targetUserIds.forEach(uid => {
    if (batchCount >= 480) return; // Firestoreバッチ制限回避
    const notifRef = doc(collection(db, "notifications"));
    batch.set(notifRef, {
      userId: uid,
      schoolId: "SYSTEM",
      title: isImportant ? `【緊急】${title}` : title,
      body: messageBody,
      sourceApp: sourceApp,
      linkUrl: detailUrl,
      isRead: false,
      isFlagged: isImportant,
      createdAt: publishDate
    });
    batchCount++;
  });

  await batch.commit();

  // 2. 外部プッシュ通知（メール / LINE）の並列処理
  const notifyEmail = notificationMethod === "email" || notificationMethod === "both";
  const notifyLine = notificationMethod === "line" || notificationMethod === "both";

  const emailPromises: Promise<any>[] = [];
  const linePromises: Promise<any>[] = [];

  const fullAppUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scps.yorikuru.com";
  const targetLink = `${fullAppUrl}${detailUrl}`;
  const externalHeader = senderName ? `${senderName} 様より新しいメッセージが届きました。` : `新しいメッセージが届きました。`;
  
  const emailHtmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 12px;">
      <h3 style="color: #1e3a8a; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">${isImportant ? "【緊急】" : ""}${title}</h3>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">${externalHeader}</p>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.5; background-color: #f9fafb; padding: 12px; border-radius: 8px;">${messageBody}</p>
      <p style="color: #ef4444; font-size: 12px; font-weight: bold; margin-top: 15px;">※メッセージの本文全文および添付ファイルの確認は、以下のボタンからポータルへアクセスしてください。</p>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${targetLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">メッセージを確認する</a>
      </div>
    </div>
  `;

  const lineTextContent = `${isImportant ? "【緊急】" : ""}${title}\n\n${externalHeader}\n\n${messageBody}\n\n※内容の確認はポータルを開いてご確認ください。\n\n▼ポータルで確認する\n${targetLink}`;

  targetUserIds.forEach(uid => {
    if (notifyEmail) {
      emailPromises.push(
        sendNotificationEmailToUser(
          uid,
          isImportant ? `【緊急】${title}` : title,
          emailHtmlContent,
          isImportant,
          senderEmailCategory
        ).catch(e => console.error("Email send error:", e))
      );
    }
    if (notifyLine) {
      linePromises.push(
        sendNotificationToUser(uid, lineTextContent, isImportant).catch(e => console.error("Line send error:", e))
      );
    }
  });

  let emailSuccess = 0;
  let lineSuccess = 0;

  if (notifyEmail || notifyLine) {
    const emailResults = await Promise.allSettled(emailPromises);
    const lineResults = await Promise.allSettled(linePromises);

    emailSuccess = emailResults.filter(r => r.status === "fulfilled" && r.value?.success).length;
    lineSuccess = lineResults.filter(r => r.status === "fulfilled" && r.value?.success).length;
  }

  return {
    success: true,
    count: targetUserIds.length,
    emailSuccess,
    lineSuccess,
    notifyEmail,
    notifyLine
  };
}