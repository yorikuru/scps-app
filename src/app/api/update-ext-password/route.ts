import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin'; // ★ 共通インスタンスをインポート

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { uid, newPassword, email, name } = body;

    if (!uid || !newPassword) {
      return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
    }

    try {
      // 1. UIDでユーザー更新を試みる
      await adminAuth.updateUser(uid, { password: newPassword });
    } catch (authError: any) {
      // 2. UIDが見つからない場合
      if (authError.code === 'auth/user-not-found') {
        if (!email) {
          throw new Error('ユーザーが見つかりません。');
        }

        try {
          // 3. メールアドレスで検索してパスワード上書き
          const existingUser = await adminAuth.getUserByEmail(email);
          await adminAuth.updateUser(existingUser.uid, { password: newPassword });
        } catch (emailError: any) {
          // 4. メールアドレスでも見つからない場合は完全新規作成
          if (emailError.code === 'auth/user-not-found') {
            await adminAuth.createUser({
              uid: uid,
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
    console.error('=== API Error Detail ===');
    console.error(error);
    
    return NextResponse.json(
      { error: error.message || 'パスワードの更新に失敗しました' }, 
      { status: 500 }
    );
  }
}