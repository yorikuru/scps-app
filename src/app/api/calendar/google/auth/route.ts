import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");

  if (!uid) {
    return NextResponse.json({ error: "UID is required" }, { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendar/google/callback`
  );

  // カレンダーの読み書き権限を要求
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // バックグラウンド同期に必要なリフレッシュトークンを取得
    prompt: 'consent',      // 強制的に同意画面を出し、確実にリフレッシュトークンをもらう
    scope: scopes,
    state: uid,             // コールバック時に誰のアカウントかを判別するためにUIDを渡す
  });

  return NextResponse.redirect(url);
}