import { NextResponse } from "next/server";
import { google } from "googleapis";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const { uid, schoolId, googleEventId, title, description, startAt, endAt, isAllDay, location, addMeetingLink, reminderMinutes } = await request.json();

    if (!uid || !googleEventId || !title || !startAt || !endAt) {
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
      return NextResponse.json({ synced: false, message: "Google Calendar is not linked" });
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

    const eventResource: any = {
      summary: title,
      description: `${description || ""}\n\n[生徒会ポータル（SCPS）より自動同期]`,
      location: location || "",
    };

    if (isAllDay) {
      eventResource.start = { date: startAt.split("T")[0] };
      eventResource.end = { date: endAt.split("T")[0] || startAt.split("T")[0] };
    } else {
      eventResource.start = { dateTime: new Date(startAt).toISOString() };
      eventResource.end = { dateTime: new Date(endAt).toISOString() };
    }

    // WEB会議リンク
    if (addMeetingLink) {
      eventResource.conferenceData = {
        createRequest: {
          requestId: `scps-update-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" }
        }
      };
    }

    // リマインダー通知
    if (reminderMinutes !== undefined && reminderMinutes !== null && reminderMinutes >= 0) {
      eventResource.reminders = {
        useDefault: false,
        overrides: [{ method: "popup", minutes: Number(reminderMinutes) }]
      };
    } else {
      eventResource.reminders = { useDefault: true };
    }

    const googleRes = await calendar.events.patch({
      calendarId: targetCalendarId,
      eventId: googleEventId,
      requestBody: eventResource,
      conferenceDataVersion: addMeetingLink ? 1 : 0
    });

    return NextResponse.json({
      synced: true,
      googleEventId: googleRes.data.id,
      hangoutLink: googleRes.data.hangoutLink || null
    });

  } catch (error: any) {
    console.error("Google Calendar Update Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update event" }, { status: 500 });
  }
}