import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getAdminDb, rpID, origin } from "../webauthn-utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { uid, response } = body;

    if (!uid || !response) {
      return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (!userDoc.exists || !userData || !userData.webAuthnCurrentChallenge) {
      return NextResponse.json({ error: "チャレンジが見つかりません" }, { status: 400 });
    }

    const expectedChallenge = userData.webAuthnCurrentChallenge;

    // 端末から送られた署名を検証
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      // 最新のライブラリ仕様に合わせて credential から取得
      const { credential } = verification.registrationInfo;
      const { id, publicKey, counter } = credential;

      // Uint8ArrayをFirestore保存用にBase64文字列に変換
      const newPasskey = {
        credentialID: Buffer.from(id).toString('base64'),
        credentialPublicKey: Buffer.from(publicKey).toString('base64'),
        counter,
        createdAt: new Date().toISOString()
      };

      // 既存のパスキー配列に追加（複数端末登録対応）
      const existingPasskeys = userData.passkeys || [];
      await userRef.update({
        passkeys: [...existingPasskeys, newPasskey],
        webAuthnCurrentChallenge: null, // 使い終わったチャレンジを破棄
      });

      return NextResponse.json({ verified: true });
    } else {
      return NextResponse.json({ error: "検証に失敗しました" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Register Verify Error:", error);
    return NextResponse.json({ error: "パスキーの検証中にエラーが発生しました" }, { status: 500 });
  }
}