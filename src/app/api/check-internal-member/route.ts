// src/app/api/check-internal-member/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { identifier } = await req.json();
    if (!identifier) {
      return NextResponse.json({ isMember: false });
    }

    const usersRef = adminDb.collection("users");

    // 1. メールアドレスで検索
    const emailSnap = await usersRef.where("email", "==", identifier).limit(1).get();
    if (!emailSnap.empty) {
      return NextResponse.json({ isMember: true });
    }

    // 2. システム利用番号で検索
    const sysSnap = await usersRef.where("systemId", "==", identifier).limit(1).get();
    if (!sysSnap.empty) {
      return NextResponse.json({ isMember: true });
    }

    // どちらにも該当しない場合
    return NextResponse.json({ isMember: false });

  } catch (error) {
    console.error("Member check error:", error);
    return NextResponse.json({ isMember: false }, { status: 500 });
  }
}