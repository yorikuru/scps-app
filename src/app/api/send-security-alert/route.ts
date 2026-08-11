import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, name, action } = await request.json();

    if (!email) {
      return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
    }

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const senderEmail = process.env.SENDER_EMAIL;

    if (!tenantId || !clientId || !clientSecret || !senderEmail) {
      return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 });
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
    if (!tokenResponse.ok) throw new Error('トークン取得失敗');

    const accessToken = tokenData.access_token;
    const mailUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;

    const title = action === "setup" ? "アカウント初期設定完了のお知らせ" : "パスワード変更完了のお知らせ";

    const mailContent = {
      message: {
        subject: `【SCPS セキュリティ】${title}`,
        body: {
          contentType: "HTML",
          content: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
              <h2 style="color: #1e3a8a; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">${title}</h2>
              <p style="color: #555; line-height: 1.6;">${name || 'ユーザー'} 様</p>
              <p style="color: #555; line-height: 1.6;">生徒会ポータルシステム ゲストチャットへの${title}をご報告します。</p>
              <p style="color: #555; line-height: 1.6;">ご自身で行った操作であれば、このままご利用いただけます。</p>
              <p style="font-size: 12px; color: #ef4444; margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee;">
                ※もしこの操作に心当たりがない場合は、第三者が不正にアクセスしている可能性があります。至急管理者までご連絡ください。
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

    if (!mailResponse.ok) throw new Error('メール送信失敗');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}