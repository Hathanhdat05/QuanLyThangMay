import { Router } from 'express';
import crypto from 'crypto';
import { ErrorReport } from '../models/ErrorReport.js';
import { Contract } from '../models/Contract.js';
import { Elevator } from '../models/Elevator.js';
import { MaintenanceSchedule } from '../models/MaintenanceSchedule.js';
import { MaintenanceOrder } from '../models/MaintenanceOrder.js';
import { generateNextContractNumber } from '../utils/contractNumber.js';
import { endOfDateOnlyToDate } from '../utils/dateOnly.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

function formatDateYYYYMMDD(date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

async function generateUniqueErrorId() {
  const datePart = formatDateYYYYMMDD(new Date());
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    const errorId = `BL${datePart}-${rand}`;
    const exists = await ErrorReport.exists({ errorId });
    if (!exists) return errorId;
  }
  const fallback = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `BL${datePart}-${fallback}`;
}

/** Ánh xạ trạng thái báo lỗi sang trạng thái hợp đồng (bảo trì/bảo hành) */
const ERROR_STATUS_TO_CONTRACT_STATUS = {
  pending: 'draft',
  in_progress: 'active',
  resolved: 'completed',
  closed: 'completed',
};

/** Kiểm tra thang máy còn trong thời gian bảo trì tại ngày tham chiếu (không tính tiền vật tư). */
async function isElevatorInMaintenancePeriod(elevatorId, referenceDate) {
  if (!elevatorId) return false;
  const elevator = await Elevator.findById(elevatorId).select('maintenance_end_date').lean();
  if (!elevator?.maintenance_end_date) return false;
  const ref = endOfDateOnlyToDate(referenceDate || new Date());
  const end = endOfDateOnlyToDate(elevator.maintenance_end_date);
  if (!ref || !end) return false;
  return end >= ref;
}

function toResponse(doc) {
  if (!doc) return null;
  const d = doc.toJSON ? doc.toJSON() : doc;
  const out = { ...d, id: d._id?.toHexString?.() ?? d.id };
  if (out.elevator_id && typeof out.elevator_id === 'object') {
    out.elevators = { name: out.elevator_id.name };
    out.elevator_id = out.elevator_id._id?.toHexString?.();
  }
  if (out.customer_id && typeof out.customer_id === 'object') {
    out.customers = { name: out.customer_id.name };
    out.customer_id = out.customer_id._id?.toHexString?.();
  }
  if (out.contract_id && typeof out.contract_id === 'object') {
    out.contracts = { contract_number: out.contract_id.contract_number };
    out.contract_id = out.contract_id._id?.toHexString?.();
  }
  delete out._id;
  return out;
}

router.get('/', async (req, res) => {
  try {
    const { search, status, type } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) filter.status = status;
    if (type) filter.type = type;
    const list = await ErrorReport.find(filter)
      .populate('elevator_id', 'name')
      .populate('customer_id', 'name')
      .populate('contract_id', 'contract_number')
      .sort({ createdAt: -1 })
      .lean();
    const data = list.map((r) => {
      const out = { ...r, id: r._id?.toHexString(), _id: undefined };
      out.elevators = r.elevator_id ? { name: r.elevator_id.name } : null;
      out.customers = r.customer_id ? { name: r.customer_id.name } : null;
      out.contracts = r.contract_id ? { contract_number: r.contract_id.contract_number } : null;
      out.elevator_id = r.elevator_id?._id?.toHexString?.() ?? r.elevator_id;
      out.customer_id = r.customer_id?._id?.toHexString?.() ?? r.customer_id;
      out.contract_id = r.contract_id?._id?.toHexString?.() ?? r.contract_id;
      return out;
    });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/new-id', async (_req, res) => {
  try {
    const errorId = await generateUniqueErrorId();
    return res.json({ errorId });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await ErrorReport.findById(req.params.id)
      .populate('elevator_id', 'name type brand')
      .populate('customer_id', 'name')
      .populate('contract_id', 'contract_number')
      .populate('items.product_id', 'name unit price')
      .lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const out = { ...doc, id: doc._id?.toHexString(), _id: undefined };
    out.elevators = doc.elevator_id
      ? { name: doc.elevator_id.name, type: doc.elevator_id.type, brand: doc.elevator_id.brand }
      : null;
    out.customers = doc.customer_id ? { name: doc.customer_id.name } : null;
    out.contracts = doc.contract_id ? { contract_number: doc.contract_id.contract_number } : null;
    out.elevator_id = doc.elevator_id?._id?.toHexString?.() ?? doc.elevator_id;
    out.customer_id = doc.customer_id?._id?.toHexString?.() ?? doc.customer_id;
    out.contract_id = doc.contract_id?._id?.toHexString?.() ?? doc.contract_id;
    out.items = (doc.items || []).map((it) => {
      const productId = it.product_id?._id?.toHexString?.() ?? it.product_id?.toString?.() ?? it.product_id;
      const quantity = it.quantity ?? 1;
      const unitPrice = it.unit_price ?? 0;
      return {
        product_id: productId,
        product_name: it.product_id?.name,
        product_unit: it.product_id?.unit,
        quantity,
        unit_price: unitPrice,
        line_total: quantity * unitPrice,
      };
    });
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    if (!body.errorId) {
      body.errorId = await generateUniqueErrorId();
    }

    const inMaintenancePeriod = await isElevatorInMaintenancePeriod(
      body.elevator_id,
      body.reported_date
    );
    if (inMaintenancePeriod && Array.isArray(body.items)) {
      body.items = body.items.map((it) =>
        it && it.product_id
          ? { ...it, unit_price: 0 }
          : it
      );
    }

    const doc = new ErrorReport({
      ...body,
      reported_by: req.userId || body.reported_by,
    });
    await doc.save();

    // Luôn tạo hợp đồng bảo trì/bảo hành tương ứng và đẩy vào danh sách Hợp đồng
    try {
      if (body.customer_id) {
        const contract_number = await generateNextContractNumber();
        const contractType = body.type === 'warranty' ? 'warranty' : 'maintenance';
        const startDate = body.scheduled_date || body.reported_date || new Date();
        const endDate = body.completed_date || null;

        const elevatorItems =
          body.elevator_id
            ? [
                {
                  item_type: 'elevator',
                  elevator_id: body.elevator_id,
                  quantity: 1,
                  unit_price: 0,
                },
              ]
            : [];

        const productItems = Array.isArray(body.items)
          ? body.items
              .filter((it) => it && it.product_id)
              .map((it) => ({
                item_type: 'product',
                product_id: it.product_id,
                elevator_id: null,
                quantity: it.quantity ?? 1,
                unit_price:
                  contractType === 'warranty' ? 0 : Number.isFinite(Number(it.unit_price))
                    ? Number(it.unit_price)
                    : 0,
              }))
          : [];

        const items = [...elevatorItems, ...productItems];

        const totalValue =
          contractType === 'warranty'
            ? 0
            : productItems.reduce(
                (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
                0
              );

        const contract = new Contract({
          customer_id: body.customer_id,
          contract_number,
          contract_type: contractType,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          status: 'draft',
          total_value: totalValue,
          notes: (body.description || body.title || '').trim() || `Báo lỗi: ${body.title || contract_number}`,
          created_from_error_report_id: doc._id,
          items,
        });

        await contract.save();

        doc.contract_id = contract._id;
        await doc.save();
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to auto-create contract for error report', e);
    }
    const populated = await ErrorReport.findById(doc._id)
      .populate('elevator_id', 'name')
      .populate('customer_id', 'name')
      .populate('contract_id', 'contract_number')
      .lean();
    const out = { ...populated, id: populated._id?.toHexString(), _id: undefined };
    out.elevators = populated.elevator_id ? { name: populated.elevator_id.name } : null;
    out.customers = populated.customer_id ? { name: populated.customer_id.name } : null;
    out.contracts = populated.contract_id ? { contract_number: populated.contract_id.contract_number } : null;
    return res.status(201).json(out);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const body = { ...req.body };
    delete body.reported_by;
    delete body.errorId;

    const inMaintenancePeriod = await isElevatorInMaintenancePeriod(
      body.elevator_id,
      body.reported_date
    );
    if (inMaintenancePeriod && Array.isArray(body.items)) {
      body.items = body.items.map((it) =>
        it && it.product_id ? { ...it, unit_price: 0 } : it
      );
    }

    const newStatus = body.status;
    const doc = await ErrorReport.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    })
      .populate('elevator_id', 'name')
      .populate('customer_id', 'name')
      .populate('contract_id', 'contract_number')
      .populate('items.product_id', 'name unit')
      .lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.contract_id && newStatus && ERROR_STATUS_TO_CONTRACT_STATUS[newStatus]) {
      const contractId = doc.contract_id?._id ?? doc.contract_id;
      if (contractId) {
        await Contract.findByIdAndUpdate(
          contractId,
          { status: ERROR_STATUS_TO_CONTRACT_STATUS[newStatus] },
          { runValidators: true }
        );
      }
    }
    const out = { ...doc, id: doc._id?.toHexString(), _id: undefined };
    out.elevators = doc.elevator_id ? { name: doc.elevator_id.name } : null;
    out.customers = doc.customer_id ? { name: doc.customer_id.name } : null;
    out.contracts = doc.contract_id ? { contract_number: doc.contract_id.contract_number } : null;
    out.elevator_id = doc.elevator_id?._id?.toHexString?.() ?? doc.elevator_id;
    out.customer_id = doc.customer_id?._id?.toHexString?.() ?? doc.customer_id;
    out.contract_id = doc.contract_id?._id?.toHexString?.() ?? doc.contract_id;
    out.items = (doc.items || []).map((it) => ({
      product_id: it.product_id?._id?.toHexString?.() ?? it.product_id?.toString?.() ?? it.product_id,
      quantity: it.quantity ?? 1,
      unit_price: it.unit_price ?? 0,
    }));
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowed = ['pending', 'in_progress', 'resolved', 'closed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const report = await ErrorReport.findById(req.params.id).select('contract_id').lean();
    if (!report) return res.status(404).json({ error: 'Not found' });

    await ErrorReport.findByIdAndUpdate(req.params.id, { status }, { runValidators: true });

    if (report.contract_id) {
      const contractStatus = ERROR_STATUS_TO_CONTRACT_STATUS[status] || 'draft';
      await Contract.findByIdAndUpdate(report.contract_id, { status: contractStatus }, { runValidators: true });
    }

    const doc = await ErrorReport.findById(req.params.id).select('status _id').lean();
    return res.json({ id: doc._id?.toHexString(), status: doc.status });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const doc = await ErrorReport.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const contractId = doc.contract_id;
    if (contractId) {
      const contract = await Contract.findById(contractId).select('created_from_error_report_id').lean();
      const wasCreatedFromThisReport =
        contract?.created_from_error_report_id?.toString() === doc._id?.toString();
      if (wasCreatedFromThisReport) {
        const scheduleIds = await MaintenanceSchedule.find({ contract_id: contractId })
          .select('_id')
          .lean();
        const ids = (scheduleIds || []).map((s) => s._id);
        if (ids.length > 0) {
          await MaintenanceOrder.deleteMany({ maintenance_schedule_id: { $in: ids } });
          await MaintenanceSchedule.deleteMany({ contract_id: contractId });
        }
        await Contract.findByIdAndDelete(contractId);
      }
    }

    await ErrorReport.findByIdAndDelete(req.params.id);
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
