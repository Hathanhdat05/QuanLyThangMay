import { Router } from 'express';
import { Customer } from '../models/Customer.js';
import { Contract } from '../models/Contract.js';
import { Product } from '../models/Product.js';
import { Elevator } from '../models/Elevator.js';
import { ErrorReport } from '../models/ErrorReport.js';
import { MaintenanceSchedule } from '../models/MaintenanceSchedule.js';
import { MaintenanceOrder } from '../models/MaintenanceOrder.js';
import { User } from '../models/User.js';
import { authMiddleware, requireViewPermission } from '../middleware/auth.js';
import { toDateOnly } from '../utils/dateOnly.js';

const router = Router();

router.use(authMiddleware);
router.use(requireViewPermission('dashboard'));

function getCurrentWeekRangeDateOnly(baseDate = new Date()) {
  const current = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0);
  const day = current.getDay(); // 0 (CN) ... 6 (T7)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(current);
  weekStart.setDate(current.getDate() + diffToMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return {
    startDateOnly: toDateOnly(weekStart),
    endDateOnly: toDateOnly(weekEnd),
  };
}

router.get('/', async (req, res) => {
  try {
    const { startDateOnly, endDateOnly } = getCurrentWeekRangeDateOnly(new Date());
    const currentUser = await User.findById(req.userId).select('role').lean();
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
    }

    let allowedScheduleIds = null;
    if (currentUser.role !== 'admin') {
      const assignedOrders = await MaintenanceOrder.find({
        assigned_user_ids: req.userId,
        scheduled_date: { $gte: startDateOnly, $lte: endDateOnly },
        status: { $ne: 'cancelled' },
      })
        .select('maintenance_schedule_id')
        .lean();
      allowedScheduleIds = assignedOrders
        .map((o) => o.maintenance_schedule_id)
        .filter(Boolean);
    }

    const scheduleFilter = {
      scheduled_date: { $gte: startDateOnly, $lte: endDateOnly },
      status: { $ne: 'cancelled' },
    };
    if (Array.isArray(allowedScheduleIds)) {
      scheduleFilter._id = { $in: allowedScheduleIds };
    }

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
        MaintenanceSchedule.find(scheduleFilter)
          .sort({ scheduled_date: 1 })
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
