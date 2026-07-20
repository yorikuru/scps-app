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

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;
      const { id, publicKey, counter, transports } = credential;

      // 修正: idはすでに正しい文字列なので、余計な変換をせずそのまま保存する
      const newPasskey = {
        credentialID: id, 
        credentialPublicKey: Buffer.from(publicKey).toString('base64'),
        counter,
        transports: transports || [], // Touch ID等をスムーズに起動させるためのヒント
        createdAt: new Date().toISOString()
      };

      const existingPasskeys = userData.passkeys || [];
      await userRef.update({
        passkeys: [...existingPasskeys, newPasskey],
        webAuthnCurrentChallenge: null,
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