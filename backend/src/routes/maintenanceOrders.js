import { Router } from 'express';
import mongoose from 'mongoose';
import { MaintenanceOrder } from '../models/MaintenanceOrder.js';
import { MaintenanceSchedule } from '../models/MaintenanceSchedule.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

/** Lấy hoặc tạo đơn bảo trì theo lịch (cho lịch cũ chưa có đơn) */
router.get('/by-schedule/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }
    let order = await MaintenanceOrder.findOne({ maintenance_schedule_id: scheduleId })
      .populate('contract_id', 'contract_number')
      .populate('elevator_id', 'name')
      .populate('customer_id', 'name')
      .populate('items.product_id', 'name unit price')
      .lean();

    if (!order) {
      const schedule = await MaintenanceSchedule.findById(scheduleId).lean();
      if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
      const d = schedule.scheduled_date ? new Date(schedule.scheduled_date) : new Date();
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
        items: [],
      });
      order = await MaintenanceOrder.findById(newOrder._id)
        .populate('contract_id', 'contract_number')
        .populate('elevator_id', 'name')
        .populate('customer_id', 'name')
        .populate('items.product_id', 'name unit price')
        .lean();
    }

    const out = { ...order, id: order._id?.toHexString(), _id: undefined };
    out.contract_id = order.contract_id?._id?.toHexString?.() ?? order.contract_id;
    out.contract_number = order.contract_id?.contract_number;
    out.elevator_id = order.elevator_id?._id?.toHexString?.() ?? order.elevator_id;
    out.elevator_name = order.elevator_id?.name;
    out.customer_id = order.customer_id?._id?.toHexString?.() ?? order.customer_id;
    out.customer_name = order.customer_id?.name;
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
    const { from, to, status } = req.query;
    const filter = {};
    if (from || to) {
      filter.scheduled_date = {};
      if (from) filter.scheduled_date.$gte = new Date(from);
      if (to) filter.scheduled_date.$lte = new Date(to);
    }
    if (status) filter.status = status;

    const list = await MaintenanceOrder.find(filter)
      .populate('contract_id', 'contract_number')
      .populate('elevator_id', 'name')
      .populate('customer_id', 'name')
      .sort({ scheduled_date: 1 })
      .lean();

    const data = list.map((o) => {
      const out = { ...o, id: o._id?.toHexString(), _id: undefined };
      out.contract_id = o.contract_id?._id?.toHexString?.() ?? o.contract_id;
      out.contract_number = o.contract_id?.contract_number;
      out.elevator_id = o.elevator_id?._id?.toHexString?.() ?? o.elevator_id;
      out.elevator_name = o.elevator_id?.name;
      out.customer_id = o.customer_id?._id?.toHexString?.() ?? o.customer_id;
      out.customer_name = o.customer_id?.name;
      return out;
    });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await MaintenanceOrder.findById(req.params.id)
      .populate('contract_id', 'contract_number')
      .populate('elevator_id', 'name')
      .populate('customer_id', 'name')
      .populate('items.product_id', 'name unit price');
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const out = doc.toJSON ? doc.toJSON() : doc;
    out.id = out._id?.toHexString?.() ?? out.id;
    out.contract_number = doc.contract_id?.contract_number;
    out.elevator_name = doc.elevator_id?.name;
    out.customer_name = doc.customer_id?.name;
    out.contract_id = doc.contract_id?._id?.toHexString?.() ?? doc.contract_id;
    out.elevator_id = doc.elevator_id?._id?.toHexString?.() ?? doc.elevator_id;
    out.customer_id = doc.customer_id?._id?.toHexString?.() ?? doc.customer_id;
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
    const doc = await MaintenanceOrder.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const body = req.body || {};
    if (body.work_content !== undefined) doc.work_content = String(body.work_content ?? '');
    if (body.status !== undefined && ['planned', 'in_progress', 'completed', 'cancelled'].includes(body.status)) {
      doc.status = body.status;
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

    await doc.populate([
      { path: 'contract_id', select: 'contract_number' },
      { path: 'elevator_id', select: 'name' },
      { path: 'customer_id', select: 'name' },
      { path: 'items.product_id', select: 'name unit price' },
    ]);
    const out = doc.toJSON ? doc.toJSON() : doc;
    out.id = out._id?.toHexString?.() ?? out.id;
    out.contract_number = doc.contract_id?.contract_number;
    out.elevator_name = doc.elevator_id?.name;
    out.customer_name = doc.customer_id?.name;
    out.contract_id = doc.contract_id?._id?.toHexString?.() ?? doc.contract_id;
    out.elevator_id = doc.elevator_id?._id?.toHexString?.() ?? doc.elevator_id;
    out.customer_id = doc.customer_id?._id?.toHexString?.() ?? doc.customer_id;
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
