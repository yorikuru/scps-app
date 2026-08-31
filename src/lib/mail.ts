"use server";

/* =====================================================================
 * 【削除禁止】SCPS メール送信カテゴリ定義＆運用メモ
 * =====================================================================
 * スパム判定回避とユーザーの利便性向上のため、用途に応じて以下の10種類に分割運用する。
 * 各環境変数（.env）に設定されたアドレスと表示名が動的にマッピングされる。
 * 
 * 1. default (scps_member_support@) : SCPS メンバーサポート
 *    - ユーザーからの問い合わせ返信、目安箱の対応など「人が対応する窓口」。
 * 2. auth (scps_auth@) : SCPS アカウント管理
 *    - ログイン通知、パスワード設定、2段階認証などセキュリティ関連の必須メール。
 * 3. notice (scps_notice@) : SCPS お知らせ
 *    - システム全体通知、テナント管理者からの連絡事項（読むだけの通知）。
 * 4. action (scps_action@) : SCPS リマインダー
 *    - タスク期限切れ、アンケート回答依頼、承認依頼など「ユーザーのアクションを促す」通知。
 * 5. admin_support (scps_admin_support@) : SCPS 管理者サポート
 *    - テナント管理者（顧問・役員など）専用の運用相談・サポート窓口。
 * 6. alerts (scps_alerts@) : SCPS システム監視
 *    - エラー検知、サーバー負荷、配信失敗レポートなど、システム管理者（開発者）向け内部SOS。
 * 7. noreply (scps_noreply@) : SCPS 自動送信
 *    - 「返信不可」の汎用システムメール。新規機能追加時のデフォルト枠。
 * 8. billing (scps_billing@) : SCPS 請求・契約管理
 *    - SaaS展開時の有償プランに関する見積・請求・契約更新の案内。
 * 9. news (scps_news@) : SCPS アップデート
 *    - 新機能リリース、機能改善などのプロモーションやニュースレター。
 * 10. export (scps_export@) : SCPS データ出力
 *    - アンケートCSVやタスクPDFなど、重いデータ出力処理完了時のダウンロードURL通知。
 * ===================================================================== */

import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// 定義された10カテゴリの型
export type EmailCategory = 
  | "default" 
  | "auth" 
  | "notice" 
  | "action" 
  | "admin_support" 
  | "alerts" 
  | "noreply" 
  | "billing" 
  | "news" 
  | "export";

/**
 * Firebase Admin SDK の初期化
 */
function getAdminDb() {
  if (getApps().length === 0) {
    const base64Key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!base64Key) {
      throw new Error("環境変数 GOOGLE_SERVICE_ACCOUNT_KEY が設定されていません。");
    }
    const decodedKey = Buffer.from(base64Key, "base64").toString("utf-8");
    const credentials = JSON.parse(decodedKey);
    initializeApp({ credential: cert(credentials) });
  }
  const app = getApp();
  return getFirestore(app);
}

/**
 * 送信カテゴリに応じた「差出人アドレス」と「表示名」を取得
 */
function getSenderConfig(category: EmailCategory): { address: string; name: string } {
  const mapping: Record<EmailCategory, { addressEnv: string; nameEnv: string }> = {
    default: { addressEnv: "SENDER_EMAIL_DEFAULT", nameEnv: "SENDER_NAME_DEFAULT" },
    auth: { addressEnv: "SENDER_EMAIL_AUTH", nameEnv: "SENDER_NAME_AUTH" },
    notice: { addressEnv: "SENDER_EMAIL_NOTICE", nameEnv: "SENDER_NAME_NOTICE" },
    action: { addressEnv: "SENDER_EMAIL_ACTION", nameEnv: "SENDER_NAME_ACTION" },
    admin_support: { addressEnv: "SENDER_EMAIL_ADMIN", nameEnv: "SENDER_NAME_ADMIN" },
    alerts: { addressEnv: "SENDER_EMAIL_ALERTS", nameEnv: "SENDER_NAME_ALERTS" },
    noreply: { addressEnv: "SENDER_EMAIL_NOREPLY", nameEnv: "SENDER_NAME_NOREPLY" },
    billing: { addressEnv: "SENDER_EMAIL_BILLING", nameEnv: "SENDER_NAME_BILLING" },
    news: { addressEnv: "SENDER_EMAIL_NEWS", nameEnv: "SENDER_NAME_NEWS" },
    export: { addressEnv: "SENDER_EMAIL_EXPORT", nameEnv: "SENDER_NAME_EXPORT" },
  };

  const config = mapping[category];
  
  // 環境変数が設定されていない場合のフォールバック（デフォルト値）
  const address = process.env[config.addressEnv] || process.env.SENDER_EMAIL_DEFAULT || "scps_member_support@yorikuru.com";
  const name = process.env[config.nameEnv] || process.env.SENDER_NAME_DEFAULT || "SCPS メンバーサポート";

  return { address, name };
}

/**
 * Microsoft Graph API を使用してメールを直接送信する下請け関数
 */
export async function sendEmailMessage(
  to: string, 
  subject: string, 
  htmlContent: string, 
  category: EmailCategory = "default"
) {
  const tenantId = process.env.MS_TENANT_ID;
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  
  const sender = getSenderConfig(category);

  if (!tenantId || !clientId || !clientSecret) {
    console.error("サーバーのメール送信設定が不足しています。");
    return { success: false, error: "メール通知のシステム設定が完了していません。" };
  }

  if (!to) {
    return { success: false, error: "宛先が指定されていません。" };
  }

  try {
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenBody = new URLSearchParams();
    tokenBody.append('client_id', clientId);
    tokenBody.append('scope', 'https://graph.microsoft.com/.default');
    tokenBody.append('client_secret', clientSecret);
    tokenBody.append('grant_type', 'client_credentials');

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error("Microsoft Graph トークン取得エラー:", tokenData);
      return { success: false, error: "メールサーバーの認証に失敗しました。" };
    }

    const accessToken = tokenData.access_token;
    const mailUrl = `https://graph.microsoft.com/v1.0/users/${sender.address}/sendMail`;

    const mailContent = {
      message: {
        subject: subject,
        from: {
          emailAddress: {
            name: sender.name, // ★ 表示名
            address: sender.address // ★ 用途に応じたアドレス
          }
        },
        body: {
          contentType: "HTML",
          content: htmlContent
        },
        toRecipients: [{ emailAddress: { address: to } }]
      },
      saveToSentItems: "true"
    };

    const mailResponse = await fetch(mailUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mailContent),
    });

    if (!mailResponse.ok) {
      const errorText = await mailResponse.text();
      console.error("Microsoft Graph メール送信エラー:", errorText);
      return { success: false, error: "メールの送信に失敗しました。" };
    }

    return { success: true };
  } catch (error) {
    console.error("メールメッセージ送信処理中の通信エラー:", error);
    return { success: false, error: "通信エラーが発生しました。" };
  }
}

/**
 * ユーザーの受信設定（ON/OFF）を判定した上でメールを送る統合関数
 */
export async function sendNotificationEmailToUser(
  portalUserId: string, 
  subject: string, 
  htmlContent: string, 
  isImportant: boolean = false,
  category: EmailCategory = "default"
) {
  try {
    const adminDb = getAdminDb();
    const userDocRef = adminDb.collection("users").doc(portalUserId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return { success: false, error: "ユーザーが存在しません。" };
    }

    const userData = userDoc.data();
    const email = userData?.email;
    const isNotificationEnabled = userData?.emailNotificationEnabled !== false;

    if (!email) {
      return { success: false, error: "このユーザーにはメールアドレスが登録されていません。" };
    }

    if (!isImportant && !isNotificationEnabled) {
      return { success: true, message: "ユーザーがメール通知をOFFにしているため配信をスキップしました。" };
    }

    const finalSubject = isImportant ? `【📢 重要】${subject}` : subject;

    return await sendEmailMessage(email, finalSubject, htmlContent, category);

  } catch (error: any) {
    console.error("メール通知設定の読み込み中にエラー:", error);
    return { success: false, error: error.message || "データベースの読み込みに失敗しました。" };
  }
}