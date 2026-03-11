function pad2(value) {
  return String(value).padStart(2, '0');
}

const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
const VIETNAM_UTC_OFFSET_HOURS = 7;

function isDateOnlyString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function parseDateOnlyParts(value) {
  const dateOnly = String(value || '').trim();
  if (!isDateOnlyString(dateOnly)) return null;
  const [yyyy, mm, dd] = dateOnly.split('-').map((v) => Number(v));
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  return { yyyy, mm, dd };
}

export function toDateOnly(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' && isDateOnlyString(value)) return value;

  const parsed = value instanceof Date ? value : new Date(value);
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return '';

  // Normalize to Vietnam business date regardless of server local timezone.
  const vnDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
  return isDateOnlyString(vnDate) ? vnDate : '';
}

export function toDateOnlyOrNull(value) {
  const dateOnly = toDateOnly(value);
  return dateOnly || null;
}

export function parseDateOnlyToDate(value) {
  if (!value) return null;
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return null;
  const parts = parseDateOnlyParts(dateOnly);
  if (!parts) return null;
  const { yyyy, mm, dd } = parts;
  // Convert 00:00 Vietnam time to UTC instant.
  return new Date(Date.UTC(yyyy, mm - 1, dd, -VIETNAM_UTC_OFFSET_HOURS, 0, 0, 0));
}

export function endOfDateOnlyToDate(value) {
  if (!value) return null;
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return null;
  const parts = parseDateOnlyParts(dateOnly);
  if (!parts) return null;
  const { yyyy, mm, dd } = parts;
  // Convert 23:59:59.999 Vietnam time to UTC instant.
  return new Date(Date.UTC(yyyy, mm - 1, dd, 23 - VIETNAM_UTC_OFFSET_HOURS, 59, 59, 999));
}

export function addDaysToDateOnly(value, days) {
  const dateOnly = toDateOnly(value);
  const parts = parseDateOnlyParts(dateOnly);
  if (!parts) return '';
  const d = new Date(Date.UTC(parts.yyyy, parts.mm - 1, parts.dd));
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function addMonthsToDateOnly(value, months) {
  const dateOnly = toDateOnly(value);
  const parts = parseDateOnlyParts(dateOnly);
  if (!parts) return '';
  const d = new Date(Date.UTC(parts.yyyy, parts.mm - 1, parts.dd));
  d.setUTCMonth(d.getUTCMonth() + Number(months || 0));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
