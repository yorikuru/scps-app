import { NextResponse } from "next/server";
import { google } from "googleapis";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const { uid, schoolId, googleEventId } = await request.json();

    if (!uid || !googleEventId) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }
    const userData = userDoc.data();

    let targetCalendarId = 'primary';
    if (schoolId) {
      const schoolDoc = await adminDb.collection("schools").doc(schoolId).get();
      if (schoolDoc.exists) {
        const schoolData = schoolDoc.data();
        if (schoolData?.sharedGoogleCalendarId) {
          targetCalendarId = schoolData.sharedGoogleCalendarId;
        }
      }
    }

    if (!userData?.isGoogleCalendarLinked || !userData?.googleCalendarRefreshToken) {
      return NextResponse.json({ synced: false });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendar/google/callback`
    );

    oauth2Client.setCredentials({
      access_token: userData.googleCalendarAccessToken,
      refresh_token: userData.googleCalendarRefreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: targetCalendarId,
      eventId: googleEventId,
    });

    return NextResponse.json({ deleted: true });

  } catch (error: any) {
    console.error("Google Calendar Delete Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete event" }, { status: 500 });
  }
}