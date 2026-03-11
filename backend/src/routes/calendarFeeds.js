import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getGoogleCalendarSharedLink } from '../services/googleCalendarSync.js';

const router = Router();

router.get('/shared-link', authMiddleware, async (_req, res) => {
  try {
    const calendarUrl = await getGoogleCalendarSharedLink();
    return res.json({ calendarUrl });
  } catch (err) {
    return res.status(503).json({
      error: 'Google Calendar unavailable',
      message: err?.message || 'Google Calendar integration is not configured',
    });
  }
});

router.get('/company', authMiddleware, async (_req, res) => {
  try {
    const calendarUrl = await getGoogleCalendarSharedLink();
    return res.json({ calendarUrl });
  } catch (err) {
    return res.status(503).json({
      error: 'Google Calendar unavailable',
      message: err?.message || 'Google Calendar integration is not configured',
    });
  }
});

export default router;
