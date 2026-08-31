"use server";

/* =====================================================================
 * 【削除禁止】SCPS メール送信カテゴリ定義＆運用メモ
 * （詳細は src/lib/mail.ts を参照）
 * ===================================================================== */

import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { sendNotificationToUser } from "@/lib/line";
import { sendNotificationEmailToUser, EmailCategory } from "@/lib/mail";
import { buildHtmlEmail } from "@/lib/email-template";

export type NotificationType = "none" | "email" | "line" | "both";

export type TargetUserInfo = {
  id: string;
  name: string;
  email: string;
};

export type DeliveryDetail = {
  id: string;
  name: string;
  email: string;
  emailSuccess: boolean;
  lineSuccess: boolean;
  emailError?: string;
  lineError?: string;
};

export type DispatchParams = {
  targetUserIds: string[];         
  targetUsersInfo?: TargetUserInfo[]; // ★ 追加：詳細レポート用ユーザー情報
  title: string;                   
  messageBody: string;             
  detailUrl?: string;              
  sourceApp?: string;              
  appName?: string;    
  isImportant?: boolean;          
  senderName?: string;             
  notificationMethod?: NotificationType; 
  senderEmailCategory?: EmailCategory; 
  replaceLinkUrl?: string; 
};

function getAdminDb() {
  if (getApps().length === 0) {
    const base64Key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!base64Key) throw new Error("環境変数 GOOGLE_SERVICE_ACCOUNT_KEY が設定されていません。");
    const decodedKey = Buffer.from(base64Key, "base64").toString("utf-8");
    const credentials = JSON.parse(decodedKey);
    initializeApp({ credential: cert(credentials) });
  }
  const app = getApp();
  return getFirestore(app);
}

export async function dispatchNotification({
  targetUserIds,
  targetUsersInfo,
  title,
  messageBody,
  detailUrl = "/top",
  sourceApp = "system",
  appName = "システムメッセージ", 
  isImportant = false,
  senderName,
  notificationMethod = "none",
  senderEmailCategory = "default",
  replaceLinkUrl
}: DispatchParams) {
  if (!targetUserIds || targetUserIds.length === 0) {
    return { success: true, count: 0, emailSuccess: 0, lineSuccess: 0, details: [] };
  }

  const adminDb = getAdminDb();
  const publishDate = new Date();
  const batch = adminDb.batch();
  let batchCount = 0;

  // 古い通知の削除
  if (replaceLinkUrl) {
    try {
      const q = adminDb.collection("notifications").where("sourceApp", "==", sourceApp).where("linkUrl", "==", replaceLinkUrl);
      const snap = await q.get();
      snap.docs.forEach(d => {
        if (batchCount < 400) { batch.delete(d.ref); batchCount++; }
      });
    } catch (e) {
      console.error("Old notifications delete error:", e);
    }
  }

  // ★ レポート用詳細データの器を作成
  const detailsMap: Record<string, DeliveryDetail> = {};
  if (targetUsersInfo) {
    targetUsersInfo.forEach(u => {
      detailsMap[u.id] = { id: u.id, name: u.name, email: u.email || "未設定", emailSuccess: false, lineSuccess: false };
    });
  }

  // アプリ内通知データの作成
  targetUserIds.forEach(uid => {
    if (batchCount >= 480) return; 
    const notifRef = adminDb.collection("notifications").doc();
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

  if (batchCount > 0) await batch.commit();

  const notifyEmail = notificationMethod === "email" || notificationMethod === "both";
  const notifyLine = notificationMethod === "line" || notificationMethod === "both";

  const emailPromises: Promise<any>[] = [];
  const linePromises: Promise<any>[] = [];

  const fullAppUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scps.yorikuru.com";
  const targetLink = `${fullAppUrl}${detailUrl}`;
  const displayTitle = isImportant ? `【緊急】${title}` : title;
  const externalHeader = senderName ? `${senderName}様より新しい投稿が配信されました。` : `新しい投稿が配信されました。`;
  
  const emailHtmlContent = buildHtmlEmail({
    title: `「${appName}」`,
    bodyText: `${externalHeader}\n\n${displayTitle}\n\n内容の詳細はポータルを開いてご確認ください。`,
    actionButton: { label: "ポータルで確認する", url: targetLink },
    footerNotes: ["このメールはシステムより自動送信されています。"],
    theme: isImportant ? "danger" : "primary" 
  });

  const lineTextContent = `「${appName}」\n${externalHeader}\n\n${displayTitle}\n\n内容の詳細はポータルを開いてご確認ください。\n\n▼ポータルで確認する\n${targetLink}`;

  targetUserIds.forEach(uid => {
    if (notifyEmail) {
      emailPromises.push(
        sendNotificationEmailToUser(uid, displayTitle, emailHtmlContent, isImportant, senderEmailCategory)
          .then(res => {
            if (detailsMap[uid]) { detailsMap[uid].emailSuccess = res.success; if (!res.success) detailsMap[uid].emailError = res.error; }
            return res;
          })
          .catch(e => {
            if (detailsMap[uid]) detailsMap[uid].emailError = e.message;
            return { success: false, error: e.message };
          })
      );
    }
    if (notifyLine) {
      linePromises.push(
        sendNotificationToUser(uid, lineTextContent, isImportant)
          .then(res => {
            if (detailsMap[uid]) { detailsMap[uid].lineSuccess = res.success; if (!res.success) detailsMap[uid].lineError = res.error; }
            return res;
          })
          .catch(e => {
            if (detailsMap[uid]) detailsMap[uid].lineError = e.message;
            return { success: false, error: e.message };
          })
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
    notifyLine,
    details: Object.values(detailsMap) // ★ ユーザー別の詳細結果を返す
  };
}