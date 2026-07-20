import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'メールアドレスと認証コードは必須です' }, { status: 400 });
    }

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const senderEmail = process.env.SENDER_EMAIL;

    if (!tenantId || !clientId || !clientSecret || !senderEmail) {
      console.error('Microsoft Graph credentials missing in .env');
      return NextResponse.json({ error: 'サーバーのメール送信設定が不足しています' }, { status: 500 });
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

    // 2. アクセストークンを使ってMFAメールを送信する
    const mailUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;

    const mailContent = {
      message: {
        subject: "【生徒会ポータルシステム】2段階認証コードのご案内",
        body: {
          contentType: "HTML",
          content: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
              <h2 style="color: #1e3a8a; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">2段階認証コード</h2>
              <p style="color: #555; line-height: 1.6;">生徒会ポータルシステムへのログイン要求がありました。</p>
              <p style="color: #555; line-height: 1.6;">以下の8桁の認証コードを入力して、ログインを完了してください。</p>
              <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
                <span style="font-size: 28px; font-weight: bold; letter-spacing: 4px; font-family: monospace; color: #111827;">${code}</span>
              </div>
              <p style="font-size: 12px; color: #6b7280;">※このコードの有効期限は発行から10分間です。</p>
              <p style="font-size: 12px; color: #ef4444; margin-top: 16px;">※本メールに心当たりがない場合は、第三者がパスワードを不正に利用している可能性があります。直ちに管理者へご報告ください。</p>
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

    console.log(`【MFAメール送信成功】宛先: ${email}`);

    return NextResponse.json({ success: true, message: 'メールを送信しました' });
  } catch (error: any) {
    console.error("MFA Mail send error details:", error);
    return NextResponse.json({ error: error.message || 'メールの送信に失敗しました' }, { status: 500 });
  }
}