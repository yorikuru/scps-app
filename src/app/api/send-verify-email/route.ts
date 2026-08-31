import { NextResponse } from 'next/server';
import { sendEmailMessage } from '@/lib/mail';
import { buildHtmlEmail } from '@/lib/email-template';

/* =====================================================================
 * 【削除禁止】SCPS メール送信カテゴリ定義＆運用メモ
 * （※詳細は src/lib/mail.ts を参照）
 * ===================================================================== */

export async function POST(request: Request) {
  try {
    const { email, verifyUrl, name } = await request.json();

    if (!email || !verifyUrl) {
      return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
    }

    // テンプレートジェネレータを使用してHTMLを構築
    const htmlContent = buildHtmlEmail({
      title: "メールアドレスの確認",
      greeting: `${name || "ユーザー"} 様`,
      bodyText: "生徒会ポータルシステム ゲストチャットへのご登録ありがとうございます。\n以下のボタンをクリックして、パスワードの設定へ進んでください。",
      actionButton: {
        label: "パスワードを設定する",
        url: verifyUrl
      },
      footerNotes: [
        "このURLの有効期限は発行から24時間です。",
        "このメールに心当たりがない場合は、そのまま破棄してください。"
      ],
      theme: "primary"
    });

    // 「auth」カテゴリで送信
    const result = await sendEmailMessage(email, "【SCPS】メールアドレスの確認とパスワード設定", htmlContent, "auth");

    if (!result.success) {
      throw new Error(result.error);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("パスワード設定メール送信エラー:", error);
    return NextResponse.json({ error: error.message || 'メールの送信に失敗しました' }, { status: 500 });
  }
}