import { Router } from 'express';
import mongoose from 'mongoose';
import { MaintenanceOrder } from '../models/MaintenanceOrder.js';
import { MaintenanceSchedule } from '../models/MaintenanceSchedule.js';
import { User } from '../models/User.js';
import { authMiddleware, requireAnyViewPermissions } from '../middleware/auth.js';
import { syncScheduleToGoogleCalendar } from '../services/googleCalendarSync.js';
import { parseDateOnlyToDate, toDateOnly } from '../utils/dateOnly.js';

const router = Router();

router.use(authMiddleware);
router.use(requireAnyViewPermissions(['maintenanceOrders', 'myJobs']));

const USER_EDITABLE_STATUSES = ['planned', 'in_progress', 'completed'];
const ADMIN_EDITABLE_STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'];

async function getCurrentUser(req) {
  if (!req.userId) return null;
  return User.findById(req.userId).select('role').lean();
}

function isAssignedUser(order, userId) {
  if (!userId || !Array.isArray(order?.assigned_user_ids)) return false;
  const target = String(userId);
  return order.assigned_user_ids.some((item) => {
    const assignedId =
      item?._id?.toHexString?.() ??
      item?._id ??
      item?.id ??
      item?.toHexString?.() ??
      item;
    return String(assignedId) === target;
  });
}

function canEditOrder(order, user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return isAssignedUser(order, user._id);
}

function toAssignedUserIds(rawValue) {
  if (!Array.isArray(rawValue)) return [];
  return rawValue
    .map((id) => String(id || '').trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

function toOrderResponse(order, currentUser) {
  const out = { ...order, id: order._id?.toHexString?.() ?? order.id, _id: undefined };
  out.scheduled_date = toDateOnly(order.scheduled_date) || order.scheduled_date;
  out.contract_id = order.contract_id?._id?.toHexString?.() ?? order.contract_id ?? order.contract?._id?.toString?.();
  out.contract_number = order.contract_id?.contract_number ?? order.contract?.contract_number;
  out.elevator_id = order.elevator_id?._id?.toHexString?.() ?? order.elevator_id ?? order.elevator?._id?.toString?.();
  out.elevator_name = order.elevator_id?.name ?? order.elevator?.name;
  out.customer_id = order.customer_id?._id?.toHexString?.() ?? order.customer_id ?? order.customer?._id?.toString?.();
  out.customer_name = order.customer_id?.name ?? order.customer?.name;
  out.assigned_user_ids = Array.isArray(order.assigned_user_ids)
    ? order.assigned_user_ids.map(
        (u) => u?._id?.toHexString?.() ?? u?._id ?? u?.id ?? u?.toHexString?.() ?? String(u)
      )
    : [];
  const assignedUsersSource = Array.isArray(order.assigned_users) ? order.assigned_users : order.assigned_user_ids;
  out.assigned_users = Array.isArray(assignedUsersSource)
    ? assignedUsersSource
        .filter((u) => u && typeof u === 'object' && (u._id || u.id))
        .map((u) => ({
          id: u._id?.toHexString?.() ?? u.id ?? String(u._id || ''),
          full_name: u.full_name || '',
          email: u.email || '',
        }))
    : [];
  out.can_edit = canEditOrder(order, currentUser);
  delete out.contract;
  delete out.customer;
  delete out.elevator;
  return out;
}

/** Lấy hoặc tạo đơn bảo trì theo lịch (cho lịch cũ chưa có đơn) */
router.get('/by-schedule/:scheduleId', async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
    const { scheduleId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }
    let order = await MaintenanceOrder.findOne({ maintenance_schedule_id: scheduleId })
      .populate('contract_id', 'contract_number')
      .populate('elevator_id', 'name')
      .populate('customer_id', 'name')
      .populate('assigned_user_ids', 'full_name email')
      .populate('items.product_id', 'name unit price')
      .lean();

    if (!order) {
      const schedule = await MaintenanceSchedule.findById(scheduleId).lean();
      if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
      const d = parseDateOnlyToDate(schedule.scheduled_date) || new Date();
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const monthYear = `${String(month).padStart(2, '0')}/${year}`;
      const customerName = schedule.customer_name || schedule.elevator_name || 'Khách hàng';
      const title = `Bảo trì định kì - ${monthYear} - ${customerName}`;
      const newOrder = await MaintenanceOrder.create({
        maintenance_schedule_id: schedule._id,
        contract_id: schedule.contract_id,
        elevator_id: schedule.elevator_id,
        customer_id: schedule.customer_id,
        scheduled_date: schedule.scheduled_date,
        title,
        status: 'planned',
        work_content: '',
        assigned_user_ids: [],
        items: [],
      });
      order = await MaintenanceOrder.findById(newOrder._id)
        .populate('contract_id', 'contract_number')
        .populate('elevator_id', 'name')
        .populate('customer_id', 'name')
        .populate('assigned_user_ids', 'full_name email')
        .populate('items.product_id', 'name unit price')
        .lean();
    }

    const out = toOrderResponse(order, currentUser);
    out.items = (order.items || []).map((it) => ({
      product_id: it.product_id?._id?.toHexString?.() ?? it.product_id,
      product_name: it.product_id?.name,
      product_unit: it.product_id?.unit,
      quantity: it.quantity ?? 1,
      unit_price: it.unit_price ?? 0,
    }));
    if (out.contract_id && typeof out.contract_id === 'object') out.contract_id = out.contract_id.toString();
    if (out.elevator_id && typeof out.elevator_id === 'object') out.elevator_id = out.elevator_id.toString();
    if (out.customer_id && typeof out.customer_id === 'object') out.customer_id = out.customer_id.toString();
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
    const { from, to, status, search, mine } = req.query;
    const filter = {};
    if (from || to) {
      const fromDateOnly = toDateOnly(from);
      const toDateOnlyValue = toDateOnly(to);
      filter.scheduled_date = {};
      if (fromDateOnly) filter.scheduled_date.$gte = fromDateOnly;
      if (toDateOnlyValue) filter.scheduled_date.$lte = toDateOnlyValue;
      if (Object.keys(filter.scheduled_date).length === 0) delete filter.scheduled_date;
    }
    if (status) filter.status = status;
    if (mine === '1' || currentUser.role !== 'admin') {
      filter.assigned_user_ids = new mongoose.Types.ObjectId(req.userId);
    }

    let list = [];
    if (search) {
      const searchRegex = new RegExp(String(search), 'i');
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: 'contracts',
            localField: 'contract_id',
            foreignField: '_id',
            as: 'contract',
          },
        },
        { $unwind: { path: '$contract', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'customers',
            localField: 'customer_id',
            foreignField: '_id',
            as: 'customer',
          },
        },
        { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'elevators',
            localField: 'elevator_id',
            foreignField: '_id',
            as: 'elevator',
          },
        },
        { $unwind: { path: '$elevator', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'assigned_user_ids',
            foreignField: '_id',
            as: 'assigned_users',
          },
        },
        {
          $match: {
            $or: [
              { 'contract.contract_number': { $regex: searchRegex } },
              { 'customer.name': { $regex: searchRegex } },
              { 'elevator.name': { $regex: searchRegex } },
            ],
          },
        },
        { $sort: { scheduled_date: 1 } },
      ];
      list = await MaintenanceOrder.aggregate(pipeline);
    } else {
      list = await MaintenanceOrder.find(filter)
        .populate('contract_id', 'contract_number')
        .populate('elevator_id', 'name')
        .populate('customer_id', 'name')
        .populate('assigned_user_ids', 'full_name email')
        .sort({ scheduled_date: 1 })
        .lean();
    }

    const data = list.map((o) => toOrderResponse(o, currentUser));
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
    const doc = await MaintenanceOrder.findById(req.params.id)
      .populate('contract_id', 'contract_number')
      .populate('elevator_id', 'name')
      .populate('customer_id', 'name')
      .populate('assigned_user_ids', 'full_name email')
      .populate('items.product_id', 'name unit price');
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const out = toOrderResponse(doc.toJSON ? doc.toJSON() : doc, currentUser);
    out.items = (doc.items || []).map((it) => ({
      product_id: it.product_id?._id?.toHexString?.() ?? it.product_id,
      product_name: it.product_id?.name,
      product_unit: it.product_id?.unit,
      quantity: it.quantity ?? 1,
      unit_price: it.unit_price ?? 0,
    }));
    delete out._id;
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
    const doc = await MaintenanceOrder.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const canEdit = canEditOrder(doc, currentUser);
    if (!canEdit) {
      return res.status(403).json({ error: 'Forbidden', message: 'Bạn không được chỉnh sửa đơn bảo trì này' });
    }

    const body = req.body || {};
    if (body.work_content !== undefined) doc.work_content = String(body.work_content ?? '');
    const statusWhitelist = currentUser.role === 'admin' ? ADMIN_EDITABLE_STATUSES : USER_EDITABLE_STATUSES;
    if (body.status !== undefined && statusWhitelist.includes(body.status)) {
      doc.status = body.status;
    }
    if (currentUser.role === 'admin' && body.scheduled_date !== undefined) {
      const nextDateOnly = toDateOnly(body.scheduled_date);
      if (!nextDateOnly) {
        return res.status(400).json({ error: 'Invalid scheduled_date' });
      }
      doc.scheduled_date = nextDateOnly;
    }
    if (currentUser.role === 'admin' && body.assigned_user_ids !== undefined) {
      doc.assigned_user_ids = toAssignedUserIds(body.assigned_user_ids);
    }
    if (Array.isArray(body.items)) {
      doc.items = body.items
        .filter((it) => it && it.product_id)
        .map((it) => ({
          product_id: it.product_id,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) ?? 0,
        }));
    }

    await doc.save();

    if (doc.maintenance_schedule_id) {
      const scheduleStatus =
        doc.status === 'cancelled' ? 'cancelled' : doc.status === 'completed' ? 'completed' : 'planned';
      const schedule = await MaintenanceSchedule.findByIdAndUpdate(
        doc.maintenance_schedule_id,
        { status: scheduleStatus, scheduled_date: doc.scheduled_date },
        { new: true }
      ).lean();
      if (schedule) {
        syncScheduleToGoogleCalendar(schedule).catch((err) =>
          console.error('Google Calendar sync schedule status error:', err?.message || err)
        );
      }
    }

    await doc.populate([
      { path: 'contract_id', select: 'contract_number' },
      { path: 'elevator_id', select: 'name' },
      { path: 'customer_id', select: 'name' },
      { path: 'assigned_user_ids', select: 'full_name email' },
      { path: 'items.product_id', select: 'name unit price' },
    ]);
    const out = toOrderResponse(doc.toJSON ? doc.toJSON() : doc, currentUser);
    out.items = (doc.items || []).map((it) => ({
      product_id: it.product_id?._id?.toHexString?.() ?? it.product_id,
      product_name: it.product_id?.name,
      product_unit: it.product_id?.unit,
      quantity: it.quantity ?? 1,
      unit_price: it.unit_price ?? 0,
    }));
    delete out._id;
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
