import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getAdminDb, rpName, rpID } from "../webauthn-utils";

export async function POST(request: Request) {
  try {
    const { uid, email } = await request.json();
    
    if (!uid || !email) {
      return NextResponse.json({ error: "UIDとEmailが必要です" }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

    // パスキー登録のためのオプション（チャレンジ等）を生成
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(uid)),
      userName: email,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    // 発行したチャレンジをFirestoreに一時保存（検証時に使用）
    await userRef.update({
      webAuthnCurrentChallenge: options.challenge
    });

    return NextResponse.json(options);
  } catch (error: any) {
    console.error("Register Options Error:", error);
    return NextResponse.json({ error: "登録オプションの生成に失敗しました" }, { status: 500 });
  }
}