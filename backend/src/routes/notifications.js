import { Router } from 'express';
import { Notification } from '../models/Notification.js';
import { authMiddleware, requireViewPermission } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.use(requireViewPermission('notifications'));

function formatNotification(n) {
  const id = n._id?.toHexString?.() ?? n._id;
  const out = { ...n, id, _id: undefined, __v: undefined };
  out.user_id = n.user_id?._id?.toHexString?.() ?? n.user_id;
  if (n.elevator_id && typeof n.elevator_id === 'object') {
    out.elevator = n.elevator_id;
    out.elevator_id = n.elevator_id._id?.toHexString?.() ?? n.elevator_id._id;
  }
  if (n.contract_id && typeof n.contract_id === 'object') {
    out.contract = n.contract_id;
    out.contract_id = n.contract_id._id?.toHexString?.() ?? n.contract_id._id;
  }
  if (n.maintenance_schedule_id && typeof n.maintenance_schedule_id === 'object') {
    out.maintenance_schedule = n.maintenance_schedule_id;
    out.maintenance_schedule_id = n.maintenance_schedule_id._id?.toHexString?.() ?? n.maintenance_schedule_id._id;
  }
  if (n.maintenance_order_id && typeof n.maintenance_order_id === 'object') {
    out.maintenance_order = n.maintenance_order_id;
    out.maintenance_order_id = n.maintenance_order_id._id?.toHexString?.() ?? n.maintenance_order_id._id;
  }
  return out;
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const skip = (page - 1) * limit;

    const filter = {};
    filter.user_id = req.userId;
    if (typeof req.query.type === 'string' && req.query.type.trim()) {
      filter.type = req.query.type.trim();
    }
    if (req.query.read === 'true') filter.read = true;
    else if (req.query.read === 'false') filter.read = false;

    const [list, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('elevator_id', 'name elevatorId')
        .populate('contract_id', 'contract_number end_date')
        .populate('maintenance_schedule_id', 'scheduled_date status elevator_id contract_id title')
        .populate('maintenance_order_id', 'scheduled_date status title maintenance_schedule_id')
        .lean(),
      Notification.countDocuments(filter),
    ]);

    return res.json({
      data: list.map(formatNotification),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user_id: req.userId, read: false });
    return res.json({ count });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const doc = await Notification.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      { read: true },
      { new: true },
    ).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    return res.json(formatNotification(doc));
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/mark-all-read', async (req, res) => {
  try {
    await Notification.updateMany({ user_id: req.userId, read: false }, { read: true });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await Notification.findOneAndDelete({ _id: req.params.id, user_id: req.userId });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
