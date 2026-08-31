import { NextResponse } from 'next/server';
import { sendEmailMessage } from '@/lib/mail';
import { buildHtmlEmail } from '@/lib/email-template';

/* =====================================================================
 * 【削除禁止】SCPS メール送信カテゴリ定義＆運用メモ
 * （※詳細は src/lib/mail.ts を参照）
 * ===================================================================== */

export async function POST(request: Request) {
  try {
    const { email, name, action } = await request.json();

    if (!email) {
      return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
    }

    const title = action === "setup" ? "アカウント初期設定完了のお知らせ" : "パスワード変更完了のお知らせ";

    // テンプレートジェネレータを使用してHTMLを構築
    const htmlContent = buildHtmlEmail({
      title: title,
      greeting: `${name || 'ユーザー'} 様`,
      bodyText: `生徒会ポータルシステムへの${title}をご報告します。\nご自身で行った操作であれば、このままご利用いただけます。`,
      footerNotes: [
        "もしこの操作に心当たりがない場合は、第三者が不正にアクセスしている可能性があります。至急管理者までご連絡ください。"
      ],
      theme: "primary"
    });

    // 「auth」カテゴリで送信
    const res = await sendEmailMessage(email, `【SCPS セキュリティ】${title}`, htmlContent, "auth");

    if (!res.success) {
      throw new Error(res.error);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "メール送信に失敗しました" }, { status: 500 });
  }
}