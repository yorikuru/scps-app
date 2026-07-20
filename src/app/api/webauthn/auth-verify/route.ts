import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
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

    const passkeys = userData.passkeys || [];
    const expectedChallenge = userData.webAuthnCurrentChallenge;

    // クライアントから送られたBase64URLのIDを正規化し、登録済みパスキーと照合する
    const targetPasskey = passkeys.find((pk: any) => {
      let normalizedResponseId = response.id.replace(/-/g, '+').replace(/_/g, '/');
      while (normalizedResponseId.length % 4) {
        normalizedResponseId += '=';
      }
      return pk.credentialID === normalizedResponseId;
    });

    if (!targetPasskey) {
      return NextResponse.json({ error: "この端末のパスキーは登録されていません" }, { status: 400 });
    }

    // TypeScriptエラー修正: 最新仕様に合わせて credential.id に string (response.id) を渡す
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: response.id,
        publicKey: new Uint8Array(Buffer.from(targetPasskey.credentialPublicKey, 'base64')),
        counter: targetPasskey.counter,
        transports: targetPasskey.transports,
      },
    });

    if (verification.verified && verification.authenticationInfo) {
      const { newCounter } = verification.authenticationInfo;

      // 複製攻撃防止のため、カウンターを更新して保存
      const updatedPasskeys = passkeys.map((pk: any) => {
         if (pk.credentialID === targetPasskey.credentialID) {
           return { ...pk, counter: newCounter };
         }
         return pk;
      });

      await userRef.update({
        passkeys: updatedPasskeys,
        webAuthnCurrentChallenge: null,
      });

      return NextResponse.json({ verified: true });
    } else {
      return NextResponse.json({ error: "検証に失敗しました" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Auth Verify Error:", error);
    return NextResponse.json({ error: "認証中にエラーが発生しました" }, { status: 500 });
  }
}