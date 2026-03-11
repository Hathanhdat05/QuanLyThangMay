import { google } from 'googleapis';
import { MaintenanceSchedule } from '../models/MaintenanceSchedule.js';
import { parseDateOnlyToDate } from '../utils/dateOnly.js';

const GOOGLE_CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar'];
const DEFAULT_TIMEZONE = process.env.GOOGLE_CALENDAR_TIMEZONE || 'Asia/Ho_Chi_Minh';
const COMPANY_CALENDAR_SUMMARY = process.env.GOOGLE_COMPANY_CALENDAR_SUMMARY || 'Lich bao tri cong ty';
const COMPANY_CALENDAR_DESCRIPTION =
  process.env.GOOGLE_COMPANY_CALENDAR_DESCRIPTION || 'Lich bao tri duoc dong bo tu he thong ThangMay3';
const SHARE_SCOPE = (process.env.GOOGLE_CALENDAR_SHARE_SCOPE || 'public').toLowerCase();
const SHARE_DOMAIN = process.env.GOOGLE_CALENDAR_SHARE_DOMAIN || '';
const SHARE_EMAILS = (process.env.GOOGLE_CALENDAR_SHARE_EMAILS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

let calendarClientPromise = null;
let runtimeCalendarId = '';
let firstCalendarBootstrapResyncTriggered = false;

function parsePrivateKey(raw) {
  return String(raw || '').replace(/\\n/g, '\n');
}

function isGoogleCalendarConfigured() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
}

async function getCalendarClient() {
  if (calendarClientPromise) return calendarClientPromise;
  calendarClientPromise = (async () => {
    if (!isGoogleCalendarConfigured()) {
      throw new Error('Google Calendar service account is not configured');
    }
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: parsePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
      scopes: GOOGLE_CALENDAR_SCOPES,
    });
    await auth.authorize();
    return google.calendar({ version: 'v3', auth });
  })();
  return calendarClientPromise;
}

function getScheduleSummary(schedule) {
  return schedule.title || `Bao tri dinh ky - ${schedule.elevator_name || 'Thang may'}`;
}

function getScheduleDescription(schedule) {
  const chunks = [];
  if (schedule.customer_name) chunks.push(`Khach hang: ${schedule.customer_name}`);
  if (schedule.elevator_name) chunks.push(`Thang may: ${schedule.elevator_name}`);
  if (schedule.contract_number) chunks.push(`Hop dong: ${schedule.contract_number}`);
  return chunks.join(' | ');
}

function toEventDate(scheduleDate) {
  const start = parseDateOnlyToDate(scheduleDate) || new Date(scheduleDate);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(10, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function ensureAclRule(calendar, calendarId, scope) {
  try {
    await calendar.acl.insert({
      calendarId,
      requestBody: { role: 'reader', scope },
    });
  } catch (err) {
    if (err?.code === 409 || err?.response?.status === 409) return;
    throw err;
  }
}

async function ensureCalendarSharing(calendarId) {
  const calendar = await getCalendarClient();
  if (SHARE_SCOPE === 'domain') {
    if (!SHARE_DOMAIN) {
      throw new Error('GOOGLE_CALENDAR_SHARE_DOMAIN is required when GOOGLE_CALENDAR_SHARE_SCOPE=domain');
    }
    await ensureAclRule(calendar, calendarId, { type: 'domain', value: SHARE_DOMAIN });
    return;
  }

  if (SHARE_SCOPE === 'emails') {
    if (SHARE_EMAILS.length === 0) {
      throw new Error('GOOGLE_CALENDAR_SHARE_EMAILS is required when GOOGLE_CALENDAR_SHARE_SCOPE=emails');
    }
    for (const email of SHARE_EMAILS) {
      await ensureAclRule(calendar, calendarId, { type: 'user', value: email });
    }
    return;
  }

  // default: public reader access, so anyone with link can subscribe.
  await ensureAclRule(calendar, calendarId, { type: 'default' });
}

async function ensureCompanyCalendarId() {
  if (runtimeCalendarId) return runtimeCalendarId;
  if (process.env.GOOGLE_COMPANY_CALENDAR_ID) {
    runtimeCalendarId = process.env.GOOGLE_COMPANY_CALENDAR_ID;
    await ensureCalendarSharing(runtimeCalendarId);
    return runtimeCalendarId;
  }

  const calendar = await getCalendarClient();
  const result = await calendar.calendars.insert({
    requestBody: {
      summary: COMPANY_CALENDAR_SUMMARY,
      description: COMPANY_CALENDAR_DESCRIPTION,
      timeZone: DEFAULT_TIMEZONE,
    },
  });
  runtimeCalendarId = result.data.id || '';
  if (runtimeCalendarId) {
    await ensureCalendarSharing(runtimeCalendarId);
    console.log('Google Calendar created. Set GOOGLE_COMPANY_CALENDAR_ID to:', runtimeCalendarId);
    if (!firstCalendarBootstrapResyncTriggered) {
      firstCalendarBootstrapResyncTriggered = true;
      // First-time bootstrap: push existing schedules to newly created shared calendar.
      setTimeout(() => {
        resyncAllSchedulesToGoogleCalendar()
          .then((stats) => {
            console.log(
              `Google Calendar bootstrap resync done: total=${stats.total}, synced=${stats.synced}, failed=${stats.failed}`
            );
          })
          .catch((err) => {
            console.error('Google Calendar bootstrap resync error:', err?.message || err);
          });
      }, 0);
    }
  }
  return runtimeCalendarId;
}

export async function getGoogleCalendarSharedLink() {
  if (!isGoogleCalendarConfigured()) {
    throw new Error('Google Calendar integration is not configured');
  }
  const calendarId = await ensureCompanyCalendarId();
  if (!calendarId) throw new Error('Cannot resolve company calendar id');
  return `https://calendar.google.com/calendar/u/0?cid=${encodeURIComponent(calendarId)}`;
}

async function createGoogleEventForSchedule(schedule) {
  const calendar = await getCalendarClient();
  const calendarId = await ensureCompanyCalendarId();
  const when = toEventDate(schedule.scheduled_date);

  const result = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: getScheduleSummary(schedule),
      description: getScheduleDescription(schedule),
      status: 'confirmed',
      start: { dateTime: when.start, timeZone: DEFAULT_TIMEZONE },
      end: { dateTime: when.end, timeZone: DEFAULT_TIMEZONE },
      reminders: {
        // Google Calendar API does not allow useDefault=true with overrides together.
        // Keep a fixed email reminder at 12h before event.
        useDefault: false,
        overrides: [{ method: 'email', minutes: 1 }],
      },
      extendedProperties: {
        private: {
          maintenance_schedule_id: schedule._id?.toString?.() || '',
        },
      },
    },
  });

  const googleEventId = result.data.id || '';
  if (googleEventId) {
    await MaintenanceSchedule.findByIdAndUpdate(schedule._id, {
      google_calendar_event_id: googleEventId,
    });
  }
}

async function updateGoogleEventForSchedule(schedule) {
  const calendar = await getCalendarClient();
  const calendarId = await ensureCompanyCalendarId();
  const when = toEventDate(schedule.scheduled_date);

  await calendar.events.patch({
    calendarId,
    eventId: schedule.google_calendar_event_id,
    requestBody: {
      summary: getScheduleSummary(schedule),
      description: getScheduleDescription(schedule),
      status: 'confirmed',
      start: { dateTime: when.start, timeZone: DEFAULT_TIMEZONE },
      end: { dateTime: when.end, timeZone: DEFAULT_TIMEZONE },
      reminders: {
        // Google Calendar API does not allow useDefault=true with overrides together.
        // Keep a fixed email reminder at 12h before event.
        useDefault: false,
        overrides: [{ method: 'email', minutes: 12 * 60 }],
      },
      extendedProperties: {
        private: {
          maintenance_schedule_id: schedule._id?.toString?.() || '',
        },
      },
    },
  });
}

export async function deleteScheduleFromGoogleCalendar(scheduleOrId) {
  if (!isGoogleCalendarConfigured()) return;
  const scheduleId = typeof scheduleOrId === 'string' ? scheduleOrId : scheduleOrId?._id?.toString?.();
  if (!scheduleId) return;
  const schedule =
    typeof scheduleOrId === 'string'
      ? await MaintenanceSchedule.findById(scheduleOrId).select('google_calendar_event_id').lean()
      : scheduleOrId;

  const googleEventId = schedule?.google_calendar_event_id;
  if (!googleEventId) return;

  const calendar = await getCalendarClient();
  const calendarId = await ensureCompanyCalendarId();
  try {
    await calendar.events.delete({ calendarId, eventId: googleEventId });
  } catch (err) {
    if (err?.code !== 404) throw err;
  }
  await MaintenanceSchedule.findByIdAndUpdate(scheduleId, { google_calendar_event_id: '' });
}

export async function syncScheduleToGoogleCalendar(scheduleOrId) {
  if (!isGoogleCalendarConfigured()) return;
  const schedule =
    typeof scheduleOrId === 'string'
      ? await MaintenanceSchedule.findById(scheduleOrId).lean()
      : scheduleOrId?.toObject
        ? scheduleOrId.toObject()
        : scheduleOrId;
  if (!schedule?._id) return;

  if (schedule.status === 'cancelled') {
    await deleteScheduleFromGoogleCalendar(schedule);
    return;
  }

  if (schedule.status !== 'planned') return;

  try {
    if (schedule.google_calendar_event_id) {
      await updateGoogleEventForSchedule(schedule);
    } else {
      await createGoogleEventForSchedule(schedule);
    }
  } catch (err) {
    if (err?.code === 404 || err?.response?.status === 404) {
      await MaintenanceSchedule.findByIdAndUpdate(schedule._id, { google_calendar_event_id: '' });
      await createGoogleEventForSchedule({ ...schedule, google_calendar_event_id: '' });
      return;
    }
    throw err;
  }
}

export async function resyncAllSchedulesToGoogleCalendar() {
  if (!isGoogleCalendarConfigured()) {
    throw new Error('Google Calendar integration is not configured');
  }

  const schedules = await MaintenanceSchedule.find({})
    .select('_id status scheduled_date title customer_name elevator_name contract_number google_calendar_event_id')
    .sort({ scheduled_date: 1 })
    .lean();

  const stats = {
    total: schedules.length,
    synced: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const schedule of schedules) {
    try {
      if (!schedule?.scheduled_date) {
        stats.skipped += 1;
        continue;
      }
      await syncScheduleToGoogleCalendar(schedule);
      if (schedule.status === 'planned' || schedule.status === 'cancelled') {
        stats.synced += 1;
      } else {
        stats.skipped += 1;
      }
    } catch (err) {
      stats.failed += 1;
      console.error(
        'Google Calendar resync failed for schedule:',
        schedule._id?.toString?.() || '',
        '-',
        err?.message || err
      );
      if (stats.errors.length < 20) {
        stats.errors.push({
          schedule_id: schedule._id?.toString?.() || '',
          message: err?.message || 'Unknown error',
        });
      }
    }
  }

  return stats;
}
