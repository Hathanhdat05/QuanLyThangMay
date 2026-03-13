import { Router } from 'express';
import { authMiddleware, requireViewPermission } from '../middleware/auth.js';
import { PushSubscription } from '../models/PushSubscription.js';
import { getWebPushPublicKey, isWebPushEnabled, sendWebPushNotification } from '../utils/webPush.js';

const router = Router();

router.use(authMiddleware);
router.use(requireViewPermission('notifications'));

router.get('/public-key', (_req, res) => {
  if (!isWebPushEnabled()) {
    return res.status(503).json({ error: 'Web push disabled', message: 'VAPID is not configured' });
  }
  return res.json({ publicKey: getWebPushPublicKey() });
});

router.post('/subscribe', async (req, res) => {
  try {
    if (!isWebPushEnabled()) {
      return res.status(503).json({ error: 'Web push disabled', message: 'VAPID is not configured' });
    }
    const subscription = req.body?.subscription || req.body;
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Invalid subscription payload' });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        user_id: req.userId,
        endpoint,
        keys: { p256dh, auth },
        user_agent: req.headers['user-agent'] || '',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/unsubscribe', async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint is required' });
    await PushSubscription.deleteOne({ endpoint, user_id: req.userId });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/test', async (req, res) => {
  try {
    if (!isWebPushEnabled()) {
      return res.status(503).json({ error: 'Web push disabled', message: 'VAPID is not configured' });
    }
    const subscriptions = await PushSubscription.find({ user_id: req.userId }).lean();
    if (!subscriptions.length) {
      return res.status(404).json({ error: 'No subscription found for current user' });
    }

    let success = 0;
    let expired = 0;
    await Promise.all(
      subscriptions.map(async (sub) => {
        const result = await sendWebPushNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys?.p256dh,
              auth: sub.keys?.auth,
            },
          },
          {
            title: 'Thong bao thu nghiem',
            body: 'Neu ban thay thong bao nay, browser push da hoat dong.',
            icon: '/logo.png',
            badge: '/logo.png',
            url: '/notifications',
          }
        );
        if (result.ok) success += 1;
        if (result.expired) {
          expired += 1;
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      })
    );
    return res.json({ ok: true, total: subscriptions.length, success, expired });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
