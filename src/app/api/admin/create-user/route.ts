import { NextResponse } from 'next/server';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// サーバー起動時・API呼び出し時に安全にFirebase Adminを初期化する関数
function initFirebaseAdmin() {
  if (!getApps().length) {
    try {
      const serviceAccountKeyStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      if (serviceAccountKeyStr) {
        let jsonString = serviceAccountKeyStr;
        // Base64エンコードされている場合はデコードする
        if (!serviceAccountKeyStr.trim().startsWith('{')) {
          jsonString = Buffer.from(serviceAccountKeyStr, 'base64').toString('utf-8');
        }
        initializeApp({ credential: cert(JSON.parse(jsonString)) });
        console.log('Firebase Admin SDK initialized successfully.');
      } else {
        console.warn('WARNING: GOOGLE_SERVICE_ACCOUNT_KEY is missing.');
        initializeApp();
      }
    } catch (error) {
      console.error("Firebase Admin init error:", error);
    }
  }
}

export async function POST(request: Request) {
  try {
    // APIリクエストのたびに初期化状態を確認
    initFirebaseAdmin();
    const auth = getAuth();
    
    const body = await request.json();
    const { action, uid, email, password, displayName } = body;

    // 必須パラメータのチェック
    if (!uid || !email || !password) {
      return NextResponse.json({ error: "必須項目(UID, Email, Password)が不足しています。" }, { status: 400 });
    }

    // 更新・作成用パラメータ（空文字のdisplayNameはエラーになるため除外する）
    const userParams: any = { password: password };
    if (displayName && displayName.trim() !== '') {
      userParams.displayName = displayName;
    }

    try {
      // 1. まずは既存アカウントの更新（上書き）を試みる
      await auth.updateUser(uid, userParams);
      console.log(`User ${uid} successfully updated in Auth.`);
      
    } catch (e: any) {
      // 2. ユーザーが存在しない場合は新規作成
      if (e.code === 'auth/user-not-found') {
        console.log(`User ${uid} not found. Creating new account...`);
        const createParams = { uid, email, ...userParams };
        await auth.createUser(createParams);
        console.log(`User ${uid} successfully created in Auth.`);
        
      // 3. 別のUIDですでに同じメールアドレスが使われている場合の救済処理
      } else if (e.code === 'auth/email-already-exists') {
        console.log(`Email ${email} already exists. Updating existing user...`);
        const userByEmail = await auth.getUserByEmail(email);
        await auth.updateUser(userByEmail.uid, userParams);
        
      } else {
        // その他のFirebase Auth エラー
        throw e;
      }
    }

    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Admin Auth API Error:', error);
    // クライアント側に詳細なエラーメッセージを返す
    return NextResponse.json(
      { error: error.message || 'サーバー内部で予期せぬエラーが発生しました。' }, 
      { status: 500 }
    );
  }
}