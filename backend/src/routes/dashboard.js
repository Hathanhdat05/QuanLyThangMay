import { Router } from 'express';
import { Customer } from '../models/Customer.js';
import { Contract } from '../models/Contract.js';
import { Product } from '../models/Product.js';
import { Elevator } from '../models/Elevator.js';
import { ErrorReport } from '../models/ErrorReport.js';
import { MaintenanceSchedule } from '../models/MaintenanceSchedule.js';
import { authMiddleware } from '../middleware/auth.js';
import { toDateOnly } from '../utils/dateOnly.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const today = toDateOnly(new Date());

    const [customersCount, contractsCount, productsCount, elevatorsCount, recentReports, upcomingSchedules] =
      await Promise.all([
        Customer.countDocuments(),
        Contract.countDocuments(),
        Product.countDocuments(),
        Elevator.countDocuments(),
        ErrorReport.find({ status: { $in: ['pending', 'in_progress'] } })
          .populate('elevator_id', 'name')
          .populate('customer_id', 'name')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
        MaintenanceSchedule.find({
          scheduled_date: { $gte: today },
          status: { $ne: 'cancelled' },
        })
          .sort({ scheduled_date: 1 })
          .limit(5)
          .lean(),
      ]);

    const mapReport = (r) => {
      const out = { ...r, id: r._id?.toHexString(), _id: undefined };
      out.elevators = r.elevator_id ? { name: r.elevator_id.name } : null;
      out.customers = r.customer_id ? { name: r.customer_id.name } : null;
      return out;
    };

    const mapSchedule = (s) => {
      const out = { ...s, id: s._id?.toHexString(), _id: undefined };
      out.scheduled_date = toDateOnly(s.scheduled_date) || s.scheduled_date;
      out.elevators = s.elevator_name ? { name: s.elevator_name } : null;
      out.customers = s.customer_name ? { name: s.customer_name } : null;
      return out;
    };

    const upcomingEvents = upcomingSchedules.map(mapSchedule);

    return res.json({
      stats: {
        customers: customersCount,
        contracts: contractsCount,
        products: productsCount,
        elevators: elevatorsCount,
        pendingReports: recentReports.length,
        upcomingMaintenance: upcomingEvents.length,
      },
      recentReports: recentReports.map(mapReport),
      upcomingEvents,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
