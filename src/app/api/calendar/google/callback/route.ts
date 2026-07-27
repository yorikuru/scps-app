import { NextResponse } from "next/server";
import { google } from "googleapis";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const uid = searchParams.get("state"); 

  if (!code || !uid) {
    return NextResponse.redirect(new URL('/account?tab=calendar&error=auth_failed', request.url));
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendar/google/callback`
  );

  try {
    // 認可コードをトークンに交換
    const { tokens } = await oauth2Client.getToken(code);

    // データベースにトークンを保存（これで次回以降、自動で同期できるようになります）
    await adminDb.collection("users").doc(uid).update({
      googleCalendarAccessToken: tokens.access_token,
      googleCalendarRefreshToken: tokens.refresh_token || null, // 初回のみ取得できる
      googleCalendarTokenExpiry: tokens.expiry_date,
      isGoogleCalendarLinked: true,
    });

    // アカウント設定画面へ戻す
    return NextResponse.redirect(new URL('/account?tab=calendar&success=google_linked', request.url));
    
  } catch (error) {
    console.error("Google Calendar Auth Error:", error);
    return NextResponse.redirect(new URL('/account?tab=calendar&error=token_failed', request.url));
  }
}