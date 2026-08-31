import { NextResponse } from 'next/server';
import { sendEmailMessage } from '@/lib/mail';
import { buildHtmlEmail } from '@/lib/email-template';

/* =====================================================================
 * 【削除禁止】SCPS メール送信カテゴリ定義＆運用メモ
 * （※詳細は src/lib/mail.ts を参照）
 * ===================================================================== */

export async function POST(request: Request) {
  try {
    const { email, resetUrl, name } = await request.json();

    if (!email || !resetUrl) {
      return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
    }

    // テンプレートジェネレータでHTML構築
    const htmlContent = buildHtmlEmail({
      title: "パスワードの再設定",
      greeting: `${name || 'ゲスト'} 様`,
      bodyText: "パスワード再設定のリクエストを受け付けました。\n以下のボタンをクリックして、新しいパスワードを設定してください。",
      actionButton: {
        label: "パスワードを再設定する",
        url: resetUrl
      },
      footerNotes: [
        "このURLの有効期限は発行から1時間です。",
        "このメールに心当たりがない場合は、他の方が誤ってメールアドレスを入力した可能性があります。その場合はそのまま破棄してください。"
      ],
      theme: "primary"
    });

    // 共通モジュールを使用して「auth」カテゴリで送信
    const res = await sendEmailMessage(email, "【SCPS】パスワード再設定のご案内", htmlContent, "auth");

    if (!res.success) {
      throw new Error(res.error);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'メールの送信に失敗しました' }, { status: 500 });
  }
}