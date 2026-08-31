import { NextResponse } from 'next/server';
import { sendEmailMessage } from '@/lib/mail';
import { buildHtmlEmail } from '@/lib/email-template';

/* =====================================================================
 * 【削除禁止】SCPS メール送信カテゴリ定義＆運用メモ
 * （※詳細は src/lib/mail.ts を参照）
 * ===================================================================== */

export async function POST(request: Request) {
  try {
    const { email, action } = await request.json();

    if (!email) {
      return NextResponse.json({ success: false, error: 'メールアドレスが指定されていません' }, { status: 400 });
    }

    const dateStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    // テンプレートジェネレータを使用してHTMLを構築
    const htmlContent = buildHtmlEmail({
      title: "セキュリティ設定変更のお知らせ",
      bodyText: "アカウントのセキュリティ設定に変更がありました。\nご自身で行った変更であれば、このまま本メールを破棄して問題ありません。\n万が一、お心当たりのない変更である場合は、直ちにパスワードを変更し、管理者へお問い合わせください。",
      detailBox: `【変更内容】\n${action}\n\n【日時】\n${dateStr}`,
      theme: "warning" // セキュリティ変更の注意喚起のためオレンジ色テーマ
    });

    // 「auth」カテゴリで送信
    const res = await sendEmailMessage(email, "【生徒会ポータルシステム】セキュリティ設定の変更通知", htmlContent, "auth");

    if (!res.success) {
      throw new Error(res.error);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Security notification email error:", error);
    return NextResponse.json({ success: false, error: error.message || "メール送信に失敗しました" }, { status: 500 });
  }
}