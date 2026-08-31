import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { sendEmailMessage } from '@/lib/mail';
import { buildHtmlEmail } from '@/lib/email-template';

/* =====================================================================
 * 【削除禁止】SCPS メール送信カテゴリ定義＆運用メモ
 * （※詳細は src/lib/mail.ts を参照）
 * ===================================================================== */

// Firebase Admin SDK の安全な初期化
if (!getApps().length) {
  try {
    const serviceAccountKeyStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKeyStr) {
      let jsonString = serviceAccountKeyStr;
      if (!serviceAccountKeyStr.trim().startsWith('{')) {
        jsonString = Buffer.from(serviceAccountKeyStr, 'base64').toString('utf-8');
      }
      const serviceAccount = JSON.parse(jsonString);
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      initializeApp();
    }
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ success: false, error: 'メールアドレスが指定されていません' }, { status: 400 });
    }

    // 1. Firebase Admin SDK を使用して「パスワードリセットURL」を生成する
    let resetLink = "";
    try {
      resetLink = await getAuth().generatePasswordResetLink(email);
    } catch (authError: any) {
      console.error("Firebase Auth Error:", authError);
      if (authError.code === 'auth/user-not-found') {
        return NextResponse.json({ success: false, error: '指定されたメールアドレスのユーザーが見つかりません。' }, { status: 404 });
      }
      return NextResponse.json({ success: false, error: 'リセットリンクの生成に失敗しました。' }, { status: 500 });
    }

    // 2. 独自アプリのURLにトークンを渡す
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const parsedUrl = new URL(resetLink);
    const oobCode = parsedUrl.searchParams.get('oobCode');
    const customResetLink = `${appUrl}/password-reset?oobCode=${oobCode}`;

    // 3. テンプレートジェネレータでHTML構築
    const htmlContent = buildHtmlEmail({
      title: "パスワード再設定",
      bodyText: "パスワード再設定のリクエストを受け付けました。\n以下のボタンをクリックして新しいパスワードを設定してください。",
      actionButton: {
        label: "パスワードを再設定する",
        url: customResetLink
      },
      footerNotes: [
        `ボタンが機能しない場合は、以下のURLをブラウザにコピー＆ペーストしてください: ${customResetLink}`,
        "お心当たりがない場合は、お手数ですがこのメールを破棄してください。"
      ],
      theme: "primary"
    });

    // 4. 共通モジュールを使用して「auth」カテゴリで送信
    const res = await sendEmailMessage(email, "【生徒会ポータルシステム】パスワード再設定のご案内", htmlContent, "auth");

    if (!res.success) {
      throw new Error(res.error);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Password reset mail error:", error);
    return NextResponse.json({ success: false, error: error.message || 'メール送信に失敗しました' }, { status: 500 });
  }
}