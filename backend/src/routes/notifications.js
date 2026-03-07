import { Router } from 'express';
import { Notification } from '../models/Notification.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const list = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('elevator_id', 'name elevatorId')
      .populate('contract_id', 'contract_number end_date')
      .lean();
    const data = list.map((n) => {
      const id = n._id?.toHexString();
      const out = { ...n, id, _id: undefined };
      if (n.elevator_id) {
        out.elevator = n.elevator_id;
        out.elevator_id = n.elevator_id._id?.toHexString();
      }
      if (n.contract_id) {
        out.contract = n.contract_id;
        out.contract_id = n.contract_id._id?.toHexString();
      }
      return out;
    });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
