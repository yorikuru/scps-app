import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Firebase Admin SDK の初期化
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
    console.error('Firebase Admin initialization error', error);
  }
}

export async function POST(request: Request) {
  try {
    const { uid, newPassword, email, name } = await request.json();

    if (!uid || !newPassword) {
      return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
    }

    const auth = getAuth();

    try {
      // 1. まず、渡されたUID（FirestoreのID）でFirebase Auth上にユーザーが存在するか確認＆パスワード更新を試みる
      await auth.updateUser(uid, {
        password: newPassword,
      });
    } catch (authError: any) {
      // 2. もしUID指定で見つからない場合
      if (authError.code === 'auth/user-not-found') {
        if (!email) {
          throw new Error('ユーザーが見つかりません。');
        }

        try {
          // 3. 今度は「メールアドレス」で既存のFirebase Authユーザーがいないか検索する
          const existingUser = await auth.getUserByEmail(email);
          
          // すでに同じメールアドレスのAuthアカウントが存在していれば、そのUIDのパスワードを更新する
          await auth.updateUser(existingUser.uid, {
            password: newPassword,
          });
        } catch (emailError: any) {
          // 4. メールアドレスでも見つからない場合（完全に初めてAuthにアカウントを作る場合）
          if (emailError.code === 'auth/user-not-found') {
            await auth.createUser({
              uid: uid, // FirestoreのIDをそのままAuthのUIDとして使用
              email: email,
              password: newPassword,
              displayName: name || '外部ユーザー',
            });
          } else {
            throw emailError;
          }
        }
      } else {
        throw authError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Password update error:', error);
    return NextResponse.json({ error: error.message || 'パスワードの更新に失敗しました' }, { status: 500 });
  }
}