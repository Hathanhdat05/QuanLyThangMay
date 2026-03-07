import { Router } from 'express';
import { MaintenanceSchedule } from '../models/MaintenanceSchedule.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};
    if (from || to) {
      filter.scheduled_date = {};
      if (from) filter.scheduled_date.$gte = new Date(from);
      if (to) filter.scheduled_date.$lte = new Date(to);
    }
    const list = await MaintenanceSchedule.find(filter)
      .populate({ path: 'contract_id', select: 'customer_id', populate: { path: 'customer_id', select: 'name' } })
      .sort({ scheduled_date: 1 })
      .lean();
    const data = list.map((s) => {
      const out = { ...s, id: s._id?.toHexString(), _id: undefined, source: 'schedule' };
      const contract = s.contract_id;
      if (contract && typeof contract === 'object') {
        out.contract_id = contract._id?.toHexString?.() ?? contract._id;
        if (!out.customer_name && contract.customer_id) {
          const cust = contract.customer_id;
          out.customer_id = cust._id?.toHexString?.() ?? cust._id;
          out.customer_name = typeof cust === 'object' ? cust.name : '';
        }
      }
      if (out.contract_id && typeof out.contract_id === 'object') {
        out.contract_id = out.contract_id.toHexString?.() ?? out.contract_id;
      }
      if (out.customer_id && typeof out.customer_id === 'object') {
        out.customer_id = out.customer_id.toHexString?.() ?? out.customer_id;
      }
      return out;
    });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
