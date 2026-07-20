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

    // 修正: 複雑な文字コード変換を廃止し、正しいID同士でシンプルに照合する
    const targetPasskey = passkeys.find((pk: any) => pk.credentialID === response.id);

    if (!targetPasskey) {
      return NextResponse.json({ error: "この端末のパスキーは登録されていません" }, { status: 400 });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: targetPasskey.credentialID,
        publicKey: new Uint8Array(Buffer.from(targetPasskey.credentialPublicKey, 'base64')),
        counter: targetPasskey.counter,
        transports: targetPasskey.transports,
      },
    });

    if (verification.verified && verification.authenticationInfo) {
      const { newCounter } = verification.authenticationInfo;

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