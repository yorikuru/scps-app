import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Firebase Admin SDKの初期化
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), 
    }),
  });
}

export async function POST(request: Request) {
  try {
    const { authUid } = await request.json();

    if (!authUid) {
      return NextResponse.json({ error: 'Auth UID が指定されていません' }, { status: 400 });
    }

    // Firebase Authentication からユーザーを削除
    await getAuth().deleteUser(authUid);
    console.log(`Successfully deleted auth user: ${authUid}`);

    return NextResponse.json({ success: true, message: 'Authユーザーの削除に成功しました' });
  } catch (error: any) {
    console.error("Auth User deletion error:", error);
    if (error.code === 'auth/user-not-found') {
      return NextResponse.json({ success: true, message: 'ユーザーは既に存在しません' });
    }
    return NextResponse.json({ error: error.message || 'ユーザーの削除に失敗しました' }, { status: 500 });
  }
}