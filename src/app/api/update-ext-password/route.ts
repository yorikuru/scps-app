import { NextResponse } from 'next/server';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// ★ 動いている他のAPIと同じ初期化方式（GOOGLE_SERVICE_ACCOUNT_KEY）に統一！
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
        console.log("[update-ext-password] Firebase Admin Initialized successfully.");
      } else {
        console.warn('[update-ext-password] WARNING: GOOGLE_SERVICE_ACCOUNT_KEY is missing.');
        initializeApp();
      }
    } catch (error) {
      console.error("[update-ext-password] Firebase Admin init error:", error);
    }
  }
}

export async function POST(request: Request) {
  try {
    console.log("=== API: update-ext-password START ===");
    
    // 初期化関数を呼び出す
    initFirebaseAdmin();
    const auth = getAuth();

    const body = await request.json();
    const { uid, newPassword, email, name } = body;

    console.log(`Target - UID: ${uid}, Email: ${email}`);

    if (!uid || !newPassword) {
      return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
    }

    try {
      // 1. UIDでユーザー更新を試みる
      console.log(`Step 1: Trying to update user by UID (${uid})...`);
      await auth.updateUser(uid, { password: newPassword });
      console.log("Success: User updated by UID.");

    } catch (authError: any) {
      console.log(`Step 1 Failed: [${authError.code}] ${authError.message}`);

      // 2. UIDが見つからない場合
      if (authError.code === 'auth/user-not-found') {
        if (!email) {
          throw new Error('ユーザーが見つかりません。');
        }

        try {
          // 3. メールアドレスで検索してパスワード上書き
          console.log(`Step 2: Trying to find user by Email (${email})...`);
          const existingUser = await auth.getUserByEmail(email);
          
          console.log(`Step 2 Success: User found (UID: ${existingUser.uid}). Updating password...`);
          await auth.updateUser(existingUser.uid, { password: newPassword });
          console.log("Success: User password updated by Email.");

        } catch (emailError: any) {
          console.log(`Step 2 Failed: [${emailError.code}] ${emailError.message}`);

          // 4. メールアドレスでも見つからない場合は完全新規作成
          if (emailError.code === 'auth/user-not-found') {
            console.log(`Step 3: Completely new user. Creating with UID (${uid})...`);
            await auth.createUser({
              uid: uid,
              email: email,
              password: newPassword,
              displayName: name || '外部ユーザー',
            });
            console.log("Success: New user created.");
          } else {
            throw emailError;
          }
        }
      } else {
        throw authError;
      }
    }

    console.log("=== API: update-ext-password END (SUCCESS) ===");
    return NextResponse.json({ success: true });

  } catch (error: any) {
    // サーバーのコンソール（ターミナル）にエラー詳細を赤字で出力
    console.error('=== API Error Detail ===');
    console.error(error);
    console.error('========================');
    
    return NextResponse.json(
      { error: error.message || 'パスワードの更新に失敗しました' }, 
      { status: 500 }
    );
  }
}