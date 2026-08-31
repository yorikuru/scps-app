import { NextResponse } from 'next/server';
import { sendEmailMessage } from '@/lib/mail';
import { buildHtmlEmail } from '@/lib/email-template';

/* =====================================================================
 * 【削除禁止】SCPS メール送信カテゴリ定義＆運用メモ
 * （※詳細は src/lib/mail.ts を参照）
 * ===================================================================== */

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'メールアドレスと認証コードは必須です' }, { status: 400 });
    }

    // テンプレートジェネレータでHTML構築（テキストを6桁に修正）
    const htmlContent = buildHtmlEmail({
      title: "2段階認証コード",
      bodyText: "生徒会ポータルシステムへのログイン要求がありました。\n以下の6桁の認証コードを入力して、ログインを完了してください。",
      bodyHtml: `
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0; border: 1px solid #e5e7eb;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; font-family: monospace; color: #111827;">${code}</span>
        </div>
      `,
      footerNotes: [
        "このコードの有効期限は発行から10分間です。",
        "本メールに心当たりがない場合は、第三者がパスワードを不正に利用している可能性があります。直ちに管理者へご報告ください。"
      ],
      theme: "primary"
    });

    // 共通モジュールを使用して「auth」カテゴリで送信
    const res = await sendEmailMessage(email, "【生徒会ポータルシステム】2段階認証コードのご案内", htmlContent, "auth");

    if (!res.success) {
      throw new Error(res.error);
    }

    console.log(`【MFAメール送信成功】宛先: ${email}`);
    return NextResponse.json({ success: true, message: 'メールを送信しました' });
  } catch (error: any) {
    console.error("MFA Mail send error details:", error);
    return NextResponse.json({ error: error.message || 'メールの送信に失敗しました' }, { status: 500 });
  }
}