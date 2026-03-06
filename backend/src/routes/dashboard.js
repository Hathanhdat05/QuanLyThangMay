import { Router } from 'express';
import { Customer } from '../models/Customer.js';
import { Contract } from '../models/Contract.js';
import { Product } from '../models/Product.js';
import { Elevator } from '../models/Elevator.js';
import { ErrorReport } from '../models/ErrorReport.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const [customersCount, contractsCount, productsCount, elevatorsCount, recentReports, upcomingReports] =
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
        ErrorReport.find({ scheduled_date: { $gte: new Date(todayStr), $ne: null } })
          .populate('elevator_id', 'name')
          .populate('customer_id', 'name')
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

    return res.json({
      stats: {
        customers: customersCount,
        contracts: contractsCount,
        products: productsCount,
        elevators: elevatorsCount,
        pendingReports: recentReports.length,
        upcomingMaintenance: upcomingReports.length,
      },
      recentReports: recentReports.map(mapReport),
      upcomingEvents: upcomingReports.map(mapReport),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
