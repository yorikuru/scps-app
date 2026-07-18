import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { code, redirectUri } = await request.json();

    if (!code || !redirectUri) {
      return NextResponse.json({ error: "必須パラメータが不足しています。" }, { status: 400 });
    }

    const clientId = process.env.LINE_LOGIN_CHANNEL_ID;
    const clientSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;

    if (!clientId || !clientSecret) {
      console.error("LINE_LOGIN_CHANNEL_ID または LINE_LOGIN_CHANNEL_SECRET が設定されていません。");
      return NextResponse.json({ error: "サーバーの設定エラーです。" }, { status: 500 });
    }

    // 1. アクセストークンの取得
    const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("LINE token endpoint error:", errorData);
      return NextResponse.json({ error: "トークンの取得に失敗しました。" }, { status: tokenResponse.status });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. ユーザープロファイル（userId）の取得
    const profileResponse = await fetch("https://api.line.me/v2/profile", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      const errorData = await profileResponse.text();
      console.error("LINE profile endpoint error:", errorData);
      return NextResponse.json({ error: "プロフィールの取得に失敗しました。" }, { status: profileResponse.status });
    }

    const profileData = await profileResponse.json();

    // 取得したLINEユーザーIDをクライアントに返す
    return NextResponse.json({ lineUserId: profileData.userId });
    
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "内部サーバーエラーが発生しました。" }, { status: 500 });
  }
}