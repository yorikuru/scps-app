import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getAdminDb, rpID } from "../webauthn-utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawUid = body?.uid;
    
    const uid = typeof rawUid === 'string' ? rawUid : String(rawUid || '');
    
    if (!uid || uid === 'undefined' || uid === 'null') {
      return NextResponse.json({ error: "有効なUIDが送信されていません" }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

    const userData = userDoc.data();
    const passkeys = userData?.passkeys || [];

    if (passkeys.length === 0) {
      return NextResponse.json({ error: "パスキーが登録されていません" }, { status: 400 });
    }
    
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: passkeys.map((pk: any) => ({
        id: pk.credentialID, // 正しいIDをそのまま渡す
        type: 'public-key',
        transports: pk.transports, // ローカル認証器（Touch ID等）を優先的に呼び出す指示
      })),
      userVerification: "preferred",
    });

    await userRef.update({
      webAuthnCurrentChallenge: options.challenge
    });

    return NextResponse.json(options);
  } catch (error: any) {
    console.error("Auth Options API Error Details:", error);
    return NextResponse.json({ error: "認証オプションの生成に失敗しました: " + (error.message || String(error)) }, { status: 500 });
  }
}