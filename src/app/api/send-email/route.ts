import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, appId, schoolName } = await request.json();

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const senderEmail = process.env.SENDER_EMAIL;

    if (!tenantId || !clientId || !clientSecret || !senderEmail) {
      console.error('Microsoft Graph credentials missing in .env');
      return NextResponse.json({ success: false, error: 'メールサーバーの設定が不足しています' }, { status: 500 });
    }

    // 1. Microsoftの認証サーバーから「アクセストークン」を取得する
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenBody = new URLSearchParams();
    tokenBody.append('client_id', clientId);
    tokenBody.append('scope', 'https://graph.microsoft.com/.default');
    tokenBody.append('client_secret', clientSecret);
    tokenBody.append('grant_type', 'client_credentials');

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody.toString(),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error('Token fetch error:', tokenData);
      throw new Error('メールサーバーへの認証（トークン取得）に失敗しました');
    }

    const accessToken = tokenData.access_token;

    // 2. アクセストークンを使ってメールを送信する
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const authLink = `${appUrl}/apply/complete?appId=${appId}`;

    const mailUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;

    const mailContent = {
      message: {
        subject: "【生徒会ポータルシステム】テナント利用申請のメール認証",
        body: {
          contentType: "HTML",
          content: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
              <h2 style="color: #333; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">生徒会ポータルシステム テナント利用申請</h2>
              <p style="color: #555; line-height: 1.6;"><b>${schoolName}</b> のテナント利用申請を受け付けました。</p>
              <p style="color: #555; line-height: 1.6;">以下のボタンをクリックして、パスワードの設定と本登録を完了してください。</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${authLink}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">本登録を完了する</a>
              </div>
              <p style="font-size: 12px; color: #999; line-height: 1.5;">
                ※ボタンが機能しない場合は、以下のURLをブラウザにコピー＆ペーストしてください。<br>
                <a href="${authLink}" style="color: #2563eb;">${authLink}</a>
              </p>
              <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 10px;">
                このメールは生徒会ポータルシステムから自動送信されています。<br>
                お心当たりがない場合は、お手数ですがメールを破棄してください。
              </p>
            </div>
          `
        },
        toRecipients: [
          {
            emailAddress: {
              address: email
            }
          }
        ]
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

    if (!mailResponse.ok) {
      const mailErrorData = await mailResponse.json();
      console.error('Mail send error:', mailErrorData);
      throw new Error(`メール送信エラー: ${mailErrorData.error?.message || '不明なエラー'}`);
    }

    console.log("Email sent successfully via Graph API");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Mail send error details:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}