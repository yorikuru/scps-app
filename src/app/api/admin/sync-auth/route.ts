import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function initFirebaseAdmin() {
  if (!getApps().length) {
    try {
      const serviceAccountKeyStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      if (serviceAccountKeyStr) {
        let jsonString = serviceAccountKeyStr;
        if (!serviceAccountKeyStr.trim().startsWith('{')) {
          jsonString = Buffer.from(serviceAccountKeyStr, 'base64').toString('utf-8');
        }
        initializeApp({ credential: cert(JSON.parse(jsonString)) });
        console.log("[sync-auth] Firebase Admin Initialized successfully.");
      } else {
        console.warn('[sync-auth] WARNING: GOOGLE_SERVICE_ACCOUNT_KEY is missing.');
        initializeApp();
      }
    } catch (error) {
      console.error("[sync-auth] Firebase Admin initialization error:", error);
      throw new Error("Firebase Adminの初期化に失敗しました。");
    }
  }
}

export async function POST(request: Request) {
  try {
    initFirebaseAdmin();
    const auth = getAuth();

    const { users } = await request.json(); 
    const results = { success: 0, error: 0, errors: [] as any[] };

    for (const user of users) {
      try {
        // UIDでユーザーがすでにAuthenticationに存在するか確認
        try {
          await auth.getUser(user.uid);
          // 既存ユーザーの場合：メールアドレスと名前だけ更新（既存のパスワードは上書き破壊しない）
          await auth.updateUser(user.uid, {
            email: user.email,
            displayName: user.displayName
          });
        } catch (e: any) {
          if (e.code === 'auth/user-not-found') {
            // 新規ユーザーの場合：Authenticationに新規作成（初期パスワードをセット）
            await auth.createUser({
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