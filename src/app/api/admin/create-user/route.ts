import { NextResponse } from 'next/server';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
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
        console.log("[create-user] Firebase Admin Initialized successfully.");
      } else {
        console.warn('[create-user] WARNING: GOOGLE_SERVICE_ACCOUNT_KEY is missing.');
        initializeApp();
      }
    } catch (error) {
      console.error("[create-user] Firebase Admin init error:", error);
      throw new Error("Firebase Adminの初期化に失敗しました。環境変数を確認してください。");
    }
  }
}

export async function POST(request: Request) {
  try {
    // まず初期化を確実に行う
    initFirebaseAdmin();
    const auth = getAuth();
    
    const body = await request.json();
    const { action, uid, email, password, displayName } = body;

    if (!uid || !password) {
      return NextResponse.json({ error: "必須項目(UID, Password)が不足しています。" }, { status: 400 });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: "パスワードは6文字以上である必要があります。" }, { status: 400 });
    }

    const userParams: any = { password: password };
    if (email && email.trim() !== '') {
      userParams.email = email;
    }
    if (displayName && displayName.trim() !== '') {
      userParams.displayName = displayName;
    }

    let targetUid = uid;

    try {
      // 1. まずUIDでFirebase Auth上のユーザーが存在するか直接確認する
      await auth.getUser(targetUid);

      // 存在する場合は情報を更新
      await auth.updateUser(targetUid, userParams);
      console.log(`User ${targetUid} successfully updated in Auth.`);

    } catch (error: any) {
      // 2. UIDが存在しない場合 (auth/user-not-found)
      if (error.code === 'auth/user-not-found') {
        if (!email) {
          return NextResponse.json({ error: "新規作成にはメールアドレスが必要です。" }, { status: 400 });
        }

        try {
          // 同じメールアドレスですでに別のAuthアカウントが存在するか確認
          const existingUser = await auth.getUserByEmail(email);
          targetUid = existingUser.uid;
          
          // 既存メアドのアカウントのパスワード等を更新
          await auth.updateUser(targetUid, userParams);
          console.log(`Email ${email} already existed under UID ${targetUid}, updated instead.`);

        } catch (emailErr: any) {
          // メアドでも見つからない場合は、完全に新規作成する
          if (emailErr.code === 'auth/user-not-found') {
            const createParams = {
              uid: targetUid,
              email: email,
              password: password,
              displayName: displayName || ""
            };
            await auth.createUser(createParams);
            console.log(`User ${targetUid} successfully created in Auth.`);
          } else {
            throw emailErr;
          }
        }
      } else {
        throw error;
      }
    }

    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Admin Auth API Error Detail:', error);
    return NextResponse.json(
      { error: error.message || 'サーバー内部で予期せぬエラーが発生しました。' }, 
      { status: 500 }
    );
  }
}