import { NextResponse } from 'next/server';
import * as OTPAuth from 'otpauth';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'メールアドレスがありません' }, { status: 400 });
    }

    // 20バイトの安全なシークレットキーを生成
    const secret = new OTPAuth.Secret({ size: 20 });
    
    // TOTP（Time-based One-Time Password）オブジェクトの作成
    const totp = new OTPAuth.TOTP({
      issuer: '生徒会ポータルシステム',
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret
    });

    // データベース保存用＆手動入力用のBase32文字列
    const secretString = secret.base32;
    
    // QRコード描画用の専用URI
    const uri = totp.toString();

    return NextResponse.json({ secret: secretString, uri });
  } catch (error) {
    console.error('TOTP Generate Error:', error);
    return NextResponse.json({ error: '認証アプリの設定生成に失敗しました' }, { status: 500 });
  }
}