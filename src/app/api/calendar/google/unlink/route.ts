import { NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { uid } = body;

    if (!uid) {
      return NextResponse.json({ error: "ユーザーIDが不足しています" }, { status: 400 });
    }

    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
    }

    const adminDb = getFirestore();

    // ⭕️ 修正ポイント： update() ではなく set({ ... }, { merge: true }) を使う
    // これにより、もしドキュメントが未作成の場合でもエラーにならず安全に処理されます。
    await adminDb.collection("users").doc(uid).set({
      isGoogleCalendarLinked: false,
      googleCalendarEmail: null,
      googleCalendarTokens: FieldValue.delete(), 
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`✅ [API-PROD] ユーザー(${uid})のGoogleカレンダー連携データをFirestoreから削除しました`);

    return NextResponse.json({ success: true, message: "連携を解除しました" }, { status: 200 });

  } catch (error: any) {
    // どんなエラーが起きたかターミナルに詳細を出す
    console.error("=== Google Calendar Unlink API Error ===");
    console.error(error.message || error);
    
    return NextResponse.json({ error: "サーバー内部エラーが発生しました", details: error.message }, { status: 500 });
  }
}