import { google } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
// We require a refresh token to act autonomously on behalf of a single calendar account.
// This needs to be added to .env
const REFRESH_TOKEN = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

if (REFRESH_TOKEN) {
  oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
} else {
  console.warn('⚠️ GOOGLE_CALENDAR_REFRESH_TOKEN is not set. Calendar Agent will fail to authenticate.');
}

export const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

/**
 * Check availability in the primary calendar for a given date range.
 * @param timeMin ISO string (e.g. 2026-05-01T09:00:00Z)
 * @param timeMax ISO string (e.g. 2026-05-01T17:00:00Z)
 * @returns An array of busy time slots
 */
export async function checkAvailability(timeMin: string, timeMax: string) {
  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: 'primary' }],
      },
    });

    const busySlots = response.data.calendars?.primary?.busy || [];
    return { success: true, busy: busySlots };
  } catch (error) {
    console.error('Error checking calendar availability:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Creates a calendar event.
 * @param summary Event title (e.g., "Property Viewing - Prestige Lakeside")
 * @param description Detailed context about the event
 * @param startTime ISO string for start time
 * @param endTime ISO string for end time
 * @param attendees Array of email strings (e.g., ["client@example.com"])
 */
export async function createEvent(
  summary: string,
  description: string,
  startTime: string,
  endTime: string,
  attendees: string[] = []
) {
  try {
    const event = {
      summary,
      description,
      start: {
        dateTime: startTime,
        timeZone: 'Asia/Kolkata', // Set to local timezone
      },
      end: {
        dateTime: endTime,
        timeZone: 'Asia/Kolkata',
      },
      attendees: attendees.map((email) => ({ email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: 'all', // Sends email invitations to attendees
    });

    return { success: true, eventLink: response.data.htmlLink, eventId: response.data.id };
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return { success: false, error: (error as Error).message };
  }
}
