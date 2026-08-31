import { NextResponse } from 'next/server';
import { sendEmailMessage } from '@/lib/mail';
import { buildHtmlEmail } from '@/lib/email-template';

/* =====================================================================
 * 【削除禁止】SCPS メール送信カテゴリ定義＆運用メモ
 * （※詳細は src/lib/mail.ts を参照）
 * ===================================================================== */

export async function POST(request: Request) {
  try {
    const { email, appId, schoolName } = await request.json();

    if (!email || !appId) {
      return NextResponse.json({ success: false, error: '必須パラメータが不足しています' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const authLink = `${appUrl}/apply/complete?appId=${appId}`;

    // テンプレートジェネレータでHTML構築
    const htmlContent = buildHtmlEmail({
      title: "テナント利用申請のメール認証",
      bodyHtml: `
        <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
          <b>${schoolName || "ご担当者"}</b> のテナント利用申請を受け付けました。<br/>
          以下のボタンをクリックして、パスワードの設定と本登録を完了してください。
        </p>
      `,
      actionButton: {
        label: "本登録を完了する",
        url: authLink
      },
      footerNotes: [
        `ボタンが機能しない場合は、以下のURLをブラウザにコピー＆ペーストしてください: ${authLink}`,
        "このメールは生徒会ポータルシステムから自動送信されています。",
        "お心当たりがない場合は、お手数ですがメールを破棄してください。"
      ],
      theme: "primary"
    });

    // 共通モジュールを使用して「auth」カテゴリで送信
    const res = await sendEmailMessage(email, "【生徒会ポータルシステム】テナント利用申請のメール認証", htmlContent, "auth");

    if (!res.success) {
      throw new Error(res.error);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Mail send error details:", error);
    return NextResponse.json({ success: false, error: error.message || "メールの送信に失敗しました" }, { status: 500 });
  }
}