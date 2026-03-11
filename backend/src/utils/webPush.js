import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

const enabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (enabled) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export function isWebPushEnabled() {
  return enabled;
}

export function getWebPushPublicKey() {
  return VAPID_PUBLIC_KEY;
}

export async function sendWebPushNotification(subscription, payload) {
  if (!enabled) return { ok: false, disabled: true };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (err) {
    const statusCode = err?.statusCode;
    const expired = statusCode === 404 || statusCode === 410;
    return { ok: false, expired, error: err };
  }
}
