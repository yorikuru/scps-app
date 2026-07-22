import { NextResponse } from 'next/server';
// Firebase Admin の各モジュールを個別にインポートする（v12以降の正しい書き方）
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// ============================================================================
// Firebase Admin SDK の安全な初期化
// ============================================================================
if (!getApps().length) {
  try {
    const serviceAccountKeyStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccountKeyStr) {
      // 1. 環境変数が Base64 エンコードされている場合（JSON開始の '{' が無い場合）
      let jsonString = serviceAccountKeyStr;
      if (!serviceAccountKeyStr.trim().startsWith('{')) {
        jsonString = Buffer.from(serviceAccountKeyStr, 'base64').toString('utf-8');
      }
      
      const serviceAccount = JSON.parse(jsonString);
      
      // 2. 認証情報を使って初期化
      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("Firebase Admin SDK initialized with GOOGLE_SERVICE_ACCOUNT_KEY.");
    } else {
      console.warn("WARNING: GOOGLE_SERVICE_ACCOUNT_KEY is missing. Trying default credentials.");
      initializeApp();
    }
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

// ============================================================================
// API エンドポイント処理
// ============================================================================
export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ success: false, error: 'メールアドレスが指定されていません' }, { status: 400 });
    }

    // 1. Firebase Admin SDK を使用して「パスワードリセットURL」を安全に生成する
    let resetLink = "";
    try {
      resetLink = await getAuth().generatePasswordResetLink(email);
    } catch (authError: any) {
      console.error("Firebase Auth Error:", authError);
      if (authError.code === 'auth/user-not-found') {
        return NextResponse.json({ success: false, error: '指定されたメールアドレスのユーザーが見つかりません。' }, { status: 404 });
      }
      return NextResponse.json({ success: false, error: 'リセットリンクの生成に失敗しました。' }, { status: 500 });
    }

    // 2. Microsoft Graph API の認証
    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const senderEmail = process.env.SENDER_EMAIL;

    if (!tenantId || !clientId || !clientSecret || !senderEmail) {
      return NextResponse.json({ success: false, error: 'メールサーバー（Microsoft）の設定が不足しています' }, { status: 500 });
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

// 3. リセットリンクを含めたメールを送信
    // Firebase標準のリンクから、SCPSアプリ内の独自画面へとルーティングを乗せ替える
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const parsedUrl = new URL(resetLink);
    const oobCode = parsedUrl.searchParams.get('oobCode'); // Firebaseが発行したワンタイムトークンを取得
    
    // 独自アプリのURLにトークンを渡す
    const customResetLink = `${appUrl}/password-reset?oobCode=${oobCode}`;

    const mailUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;
    const mailContent = {
      message: {
        subject: "【生徒会ポータルシステム】パスワード再設定のご案内",
        body: {
          contentType: "HTML",
          content: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
              <h2 style="color: #333; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">パスワード再設定</h2>
              <p style="color: #555; line-height: 1.6;">パスワード再設定のリクエストを受け付けました。</p>
              <p style="color: #555; line-height: 1.6;">以下のボタンをクリックして新しいパスワードを設定してください。</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${customResetLink}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">パスワードを再設定する</a>
              </div>
              <p style="font-size: 12px; color: #999; line-height: 1.5;">
                ※ボタンが機能しない場合は、以下のURLをブラウザにコピー＆ペーストしてください。<br>
                <a href="${customResetLink}" style="color: #2563eb; word-break: break-all;">${customResetLink}</a>
              </p>
              <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 10px;">
                お心当たりがない場合は、お手数ですがこのメールを破棄してください。
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
    console.error("Password reset mail error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}