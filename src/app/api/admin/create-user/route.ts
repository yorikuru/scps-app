import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin'; // ★ 共通インスタンスをインポート

export async function POST(request: Request) {
  try {
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
      await adminAuth.getUser(targetUid);

      // 存在する場合は情報を更新
      await adminAuth.updateUser(targetUid, userParams);
      console.log(`User ${targetUid} successfully updated in Auth.`);

    } catch (error: any) {
      // 2. UIDが存在しない場合 (auth/user-not-found)
      if (error.code === 'auth/user-not-found') {
        if (!email) {
          return NextResponse.json({ error: "新規作成にはメールアドレスが必要です。" }, { status: 400 });
        }

        try {
          // 同じメールアドレスですでに別のAuthアカウントが存在するか確認
          const existingUser = await adminAuth.getUserByEmail(email);
          targetUid = existingUser.uid;
          
          // 既存メアドのアカウントのパスワード等を更新
          await adminAuth.updateUser(targetUid, userParams);
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
            await adminAuth.createUser(createParams);
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