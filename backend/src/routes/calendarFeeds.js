import { Router } from 'express';
import { authMiddleware, requireViewPermission } from '../middleware/auth.js';
import { getGoogleCalendarSharedLink } from '../services/googleCalendarSync.js';

const router = Router();

router.use(authMiddleware);
router.use(requireViewPermission('maintenanceCalendar'));

router.get('/shared-link', async (_req, res) => {
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

router.get('/company', async (_req, res) => {
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
