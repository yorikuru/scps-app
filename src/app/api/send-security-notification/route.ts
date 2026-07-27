import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, action } = await request.json();

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const senderEmail = process.env.SENDER_EMAIL;

    if (!tenantId || !clientId || !clientSecret || !senderEmail) {
      return NextResponse.json({ success: false, error: 'メールサーバーの設定が不足しています' }, { status: 500 });
    }

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
    if (!tokenResponse.ok) throw new Error('メールサーバーへの認証に失敗しました');
    const accessToken = tokenData.access_token;

    const dateStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    const mailUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;
    const mailContent = {
      message: {
        subject: "【生徒会ポータルシステム】セキュリティ設定の変更通知",
        body: {
          contentType: "HTML",
          content: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
              <h2 style="color: #333; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">セキュリティ設定変更のお知らせ</h2>
              <p style="color: #555; line-height: 1.6;">アカウントのセキュリティ設定に変更がありました。</p>
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; color: #374151; font-weight: bold;">変更内容: ${action}</p>
                <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">日時: ${dateStr}</p>
              </div>
              <p style="color: #555; line-height: 1.6;">
                ご自身で行った変更であれば、このまま本メールを破棄して問題ありません。<br>
                万が一、お心当たりのない変更である場合は、直ちにパスワードを変更し、管理者へお問い合わせください。
              </p>
            </div>
          `
        },
        toRecipients: [{ emailAddress: { address: email } }]
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

    if (!mailResponse.ok) throw new Error('メール送信に失敗しました');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Security notification email error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}