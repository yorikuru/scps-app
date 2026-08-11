import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, resetUrl, name } = await request.json();

    if (!email || !resetUrl) {
      return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
    }

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const senderEmail = process.env.SENDER_EMAIL;

    if (!tenantId || !clientId || !clientSecret || !senderEmail) {
      return NextResponse.json({ error: 'サーバーのメール送信設定が不足しています' }, { status: 500 });
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
    if (!tokenResponse.ok) throw new Error('メールサーバーの認証に失敗しました');

    const accessToken = tokenData.access_token;
    const mailUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;

    const mailContent = {
      message: {
        subject: "【SCPS】パスワード再設定のご案内",
        body: {
          contentType: "HTML",
          content: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
              <h2 style="color: #1e3a8a; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">パスワードの再設定</h2>
              <p style="color: #555; line-height: 1.6;">${name || 'ゲスト'} 様</p>
              <p style="color: #555; line-height: 1.6;">パスワード再設定のリクエストを受け付けました。<br>以下のボタンをクリックして、新しいパスワードを設定してください。</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">パスワードを再設定する</a>
              </div>
              <p style="font-size: 12px; color: #6b7280;">※このURLの有効期限は発行から1時間です。</p>
              <p style="font-size: 12px; color: #6b7280; margin-top: 16px;">※このメールに心当たりがない場合は、他の方が誤ってメールアドレスを入力した可能性があります。その場合はそのまま破棄してください。</p>
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

    if (!mailResponse.ok) throw new Error('メールの送信に失敗しました');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}