import { NextResponse } from 'next/server';
import * as OTPAuth from 'otpauth';

export async function POST(request: Request) {
  try {
    const { token, secret } = await request.json();

    if (!token || !secret) {
      return NextResponse.json({ error: 'トークンまたはシークレットが不足しています' }, { status: 400 });
    }

    // 保存されているシークレットキーを使ってTOTPオブジェクトを再構築
    const totp = new OTPAuth.TOTP({
      issuer: '生徒会ポータルシステム',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret)
    });

    // 入力された6桁のコードを検証 (window: 1 は前後30秒の時間のズレを許容する設定)
    const delta = totp.validate({ token, window: 1 });

    // validateは成功すると数値(ズレの回数)、失敗すると null を返す
    if (delta !== null) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: '認証コードが正しくありません' }, { status: 400 });
    }
  } catch (error) {
    console.error('TOTP Verify Error:', error);
    return NextResponse.json({ error: '検証処理に失敗しました' }, { status: 500 });
  }
}