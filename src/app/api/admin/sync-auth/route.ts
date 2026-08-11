import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Firebase Admin SDKの安全な初期化
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

export async function POST(request: Request) {
  try {
    const { users } = await request.json(); 
    
    const results = { success: 0, error: 0, errors: [] as any[] };

    for (const user of users) {
      try {
        // UIDでユーザーがすでにAuthenticationに存在するか確認
        try {
          await getAuth().getUser(user.uid);
          // 既存ユーザーの場合：メールアドレスと名前だけ更新（既存のパスワードは上書き破壊しない）
          await getAuth().updateUser(user.uid, {
            email: user.email,
            displayName: user.displayName
          });
        } catch (e: any) {
          if (e.code === 'auth/user-not-found') {
            // 新規ユーザーの場合：Authenticationに新規作成（初期パスワードをセット）
            await getAuth().createUser({
              uid: user.uid,
              email: user.email,
              password: user.password,
              displayName: user.displayName,
            });
          } else {
            throw e;
          }
        }
        results.success++;
      } catch (err: any) {
        console.error(`Auth sync error for ${user.uid}:`, err);
        results.error++;
        results.errors.push({ uid: user.uid, message: err.message });
      }
    }

    if (results.error > 0) {
      return NextResponse.json({ error: "一部のユーザーの認証情報登録に失敗しました。", details: results.errors }, { status: 500 });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}