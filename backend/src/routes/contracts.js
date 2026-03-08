import { Router } from 'express';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { Contract } from '../models/Contract.js';
import { Elevator } from '../models/Elevator.js';
import { ErrorReport } from '../models/ErrorReport.js';
import { MaintenanceSchedule } from '../models/MaintenanceSchedule.js';
import { MaintenanceOrder } from '../models/MaintenanceOrder.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import { generateNextContractNumber, previewNextContractNumber } from '../utils/contractNumber.js';

const router = Router();

router.use(authMiddleware);

function formatDateYYYYMMDD(date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Tự động tạo lịch bảo trì định kỳ khi hợp đồng lắp đặt hoàn thành (có start_date, end_date). Trả về số mục đã thêm. */
async function generateMaintenanceScheduleForContract(contractId) {
  const doc = await Contract.findById(contractId)
    .populate('items.elevator_id', 'name maintenance_months maintenance_frequency_per_month')
    .populate('customer_id', 'name')
    .lean();
  if (!doc || doc.contract_type !== 'installation' || doc.status !== 'completed') return 0;
  const endDate = doc.end_date ? new Date(doc.end_date) : null;
  if (!endDate || Number.isNaN(endDate.getTime())) return 0;

  let created = 0;
  const contractNumber = doc.contract_number || '';
  const customerId = doc.customer_id?._id ?? doc.customer_id;
  const customerName = (typeof doc.customer_id === 'object' && doc.customer_id?.name) ? doc.customer_id.name : '';

  for (const it of doc.items || []) {
    if (!it.elevator_id || it.item_type !== 'elevator') continue;
    const elev = it.elevator_id;
    const elevatorId = elev._id;
    const elevatorName = elev.name || 'Thang máy';
    const maintenanceMonths = elev.maintenance_months != null ? Number(elev.maintenance_months) : 0;
    const frequencyMonths = elev.maintenance_frequency_per_month != null ? Number(elev.maintenance_frequency_per_month) : 0;
    if (frequencyMonths <= 0 || maintenanceMonths <= 0) continue;

    const periodEnd = addMonths(endDate, maintenanceMonths);
    const dates = [];
    // Lịch bảo trì gần nhất = ngày hoàn thành + 1 chu kỳ (vd: 21/3 + 1 tháng → 21/4)
    let d = addMonths(new Date(endDate), frequencyMonths);
    d.setHours(0, 0, 0, 0);
    while (d <= periodEnd) {
      dates.push(new Date(d));
      d = addMonths(d, frequencyMonths);
    }

    for (const scheduledDate of dates) {
      const exists = await MaintenanceSchedule.findOne({
        contract_id: doc._id,
        elevator_id: elevatorId,
        scheduled_date: { $eq: scheduledDate },
      });
      if (!exists) {
        const month = scheduledDate.getMonth() + 1;
        const year = scheduledDate.getFullYear();
        const monthYear = `${String(month).padStart(2, '0')}/${year}`;
        const title = `Bảo trì định kì - ${monthYear} - ${customerName || elevatorName}`;
        const scheduleDoc = await MaintenanceSchedule.create({
          contract_id: doc._id,
          elevator_id: elevatorId,
          scheduled_date: scheduledDate,
          title,
          status: 'planned',
          contract_number: contractNumber,
          elevator_name: elevatorName,
          customer_id: customerId || undefined,
          customer_name: customerName,
        });
        await MaintenanceOrder.create({
          maintenance_schedule_id: scheduleDoc._id,
          contract_id: doc._id,
          elevator_id: elevatorId,
          customer_id: customerId || undefined,
          scheduled_date: scheduledDate,
          title,
          status: 'planned',
          work_content: '',
          items: [],
        });
        created += 1;
      }
    }
  }
  return created;
}

router.get('/', async (req, res) => {
  try {
    const { search, status, contract_type, created_from, created_to, warranty_status: warrantyStatusQuery, customer_id: customerIdQuery } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (contract_type) filter.contract_type = contract_type;
    if (customerIdQuery && mongoose.Types.ObjectId.isValid(customerIdQuery)) {
      filter.customer_id = new mongoose.Types.ObjectId(customerIdQuery);
    }

    if (created_from || created_to) {
      const createdFilter = {};
      if (created_from) {
        const fromDate = new Date(created_from);
        if (!Number.isNaN(fromDate.getTime())) {
          createdFilter.$gte = fromDate;
        }
      }
      if (created_to) {
        const toDate = new Date(created_to);
        if (!Number.isNaN(toDate.getTime())) {
          createdFilter.$lte = toDate;
        }
      }
      if (Object.keys(createdFilter).length > 0) {
        filter.createdAt = createdFilter;
      }
    }

    let list = [];
    let usedAggregate = false;

    if (search) {
      const or = [
        { contract_number: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
      if (/^[0-9a-fA-F]{24}$/.test(String(search))) {
        or.push({ _id: new mongoose.Types.ObjectId(String(search)) });
      }

      const pipeline = [
        { $match: filter },
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
          $match: {
            $or: [
              ...or,
              { 'customer.name': { $regex: search, $options: 'i' } },
            ],
          },
        },
        { $sort: { createdAt: -1 } },
      ];

      list = await Contract.aggregate(pipeline);
      usedAggregate = true;
    } else {
      list = await Contract.find(filter)
        .populate('customer_id', 'name')
        .sort({ createdAt: -1 })
        .lean();
    }

    const data = list.map((c) => {
      const id = c._id?.toString?.();
      const out = { ...c, id, _id: undefined };
      if (usedAggregate) {
        if (c.customer) {
          out.customers = { name: c.customer.name };
          out.customer_id = c.customer._id?.toString?.();
        }
        delete out.customer;
      } else if (c.customer_id) {
        out.customers = { name: c.customer_id.name };
        out.customer_id = c.customer_id._id?.toHexString();
      }
      return out;
    });

    const elevatorIds = [...new Set(data.flatMap((c) => (c.items || []).map((it) => it.elevator_id).filter(Boolean)))].map(
      (id) => (id && typeof id === 'object' && id._id ? id._id : id)
    );
    const elevatorsMap = {};
    if (elevatorIds.length > 0) {
      const elevators = await Elevator.find({ _id: { $in: elevatorIds } })
        .select('_id maintenance_end_date')
        .lean();
      for (const e of elevators) {
        const key = e._id?.toString?.();
        if (key) elevatorsMap[key] = e.maintenance_end_date;
      }
    }
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (const c of data) {
      // Trạng thái bảo hành chỉ áp dụng khi hợp đồng lắp đặt đã hoàn thành
      if (c.contract_type !== 'installation' || c.status !== 'completed') {
        c.warranty_status = null;
        continue;
      }
      const endDates = (c.items || [])
        .map((it) => {
          const eid = it.elevator_id;
          const idStr = eid && (eid._id || eid).toString ? (eid._id || eid).toString() : (eid || '').toString();
          return elevatorsMap[idStr];
        })
        .filter((d) => d != null);
      if (endDates.length === 0) {
        c.warranty_status = null;
      } else {
        const maxEnd = new Date(Math.max(...endDates.map((d) => new Date(d).getTime())));
        c.warranty_status = maxEnd >= today ? 'under_warranty' : 'expired';
      }
    }

    if (warrantyStatusQuery === 'under_warranty' || warrantyStatusQuery === 'expired') {
      data = data.filter((c) => c.warranty_status === warrantyStatusQuery);
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/export', requireAdmin, async (req, res) => {
  try {
    const { search, status, contract_type, created_from, created_to } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (contract_type) filter.contract_type = contract_type;

    if (created_from || created_to) {
      const createdFilter = {};
      if (created_from) {
        const fromDate = new Date(created_from);
        if (!Number.isNaN(fromDate.getTime())) {
          createdFilter.$gte = fromDate;
        }
      }
      if (created_to) {
        const toDate = new Date(created_to);
        if (!Number.isNaN(toDate.getTime())) {
          createdFilter.$lte = toDate;
        }
      }
      if (Object.keys(createdFilter).length > 0) {
        filter.createdAt = createdFilter;
      }
    }

    let list = [];
    let usedAggregate = false;

    if (search) {
      const or = [
        { contract_number: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
      if (/^[0-9a-fA-F]{24}$/.test(String(search))) {
        or.push({ _id: new mongoose.Types.ObjectId(String(search)) });
      }

      const pipeline = [
        { $match: filter },
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
          $match: {
            $or: [
              ...or,
              { 'customer.name': { $regex: search, $options: 'i' } },
            ],
          },
        },
        { $sort: { createdAt: -1 } },
      ];

      list = await Contract.aggregate(pipeline);
      usedAggregate = true;
    } else {
      list = await Contract.find(filter)
        .populate('customer_id', 'name')
        .sort({ createdAt: -1 })
        .lean();
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'thangmay3';
    workbook.created = new Date();
    const ws = workbook.addWorksheet('HopDong');

    ws.columns = [
      { header: 'Số hợp đồng', key: 'contract_number', width: 18 },
      { header: 'Khách hàng', key: 'customer_name', width: 26 },
      { header: 'Loại hợp đồng', key: 'contract_type', width: 16 },
      { header: 'Ngày bắt đầu', key: 'start_date', width: 14 },
      { header: 'Ngày kết thúc', key: 'end_date', width: 14 },
      { header: 'Trạng thái', key: 'status', width: 16 },
      { header: 'Tổng giá trị', key: 'total_value', width: 18 },
      { header: 'Ghi chú', key: 'notes', width: 30 },
      { header: 'Ngày tạo', key: 'createdAt', width: 18 },
      { header: 'Cập nhật', key: 'updatedAt', width: 18 },
    ];

    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const CONTRACT_TYPE_LABEL = {
      installation: 'Lắp đặt',
      maintenance: 'Bảo trì',
      warranty: 'Bảo hành',
    };

    const STATUS_LABEL = {
      draft: 'Nháp',
      active: 'Đang thực hiện',
      completed: 'Hoàn thành',
      cancelled: 'Đã hủy',
    };

    for (const c of list) {
      const customerName = usedAggregate
        ? c.customer?.name ?? ''
        : c.customer_id?.name ?? '';
      ws.addRow({
        contract_number: c.contract_number ?? '',
        customer_name: customerName,
        contract_type: CONTRACT_TYPE_LABEL[c.contract_type] || c.contract_type || '',
        start_date: c.start_date ? new Date(c.start_date) : null,
        end_date: c.end_date ? new Date(c.end_date) : null,
        status: STATUS_LABEL[c.status] || c.status || '',
        total_value: c.total_value ?? 0,
        notes: c.notes ?? '',
        createdAt: c.createdAt ? new Date(c.createdAt) : null,
        updatedAt: c.updatedAt ? new Date(c.updatedAt) : null,
      });
    }

    ws.getColumn('start_date').numFmt = 'yyyy-mm-dd';
    ws.getColumn('end_date').numFmt = 'yyyy-mm-dd';
    ws.getColumn('createdAt').numFmt = 'yyyy-mm-dd hh:mm';
    ws.getColumn('updatedAt').numFmt = 'yyyy-mm-dd hh:mm';

    const fileName = `hop-dong_${formatDateYYYYMMDD(new Date())}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/new-number', requireAdmin, async (_req, res) => {
  try {
    // Preview only: do not increment counter unless a contract is actually created
    const contract_number = await previewNextContractNumber();
    return res.json({ contract_number });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/error-reports', async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id).select('_id contract_type customer_id').lean();
    if (!contract) return res.status(404).json({ error: 'Not found' });

    const filter = { $or: [{ contract_id: req.params.id }] };
    // Với hợp đồng lắp đặt: hiển thị thêm các báo lỗi/bảo trì/bảo hành của cùng khách hàng
    if (contract.contract_type === 'installation' && contract.customer_id) {
      filter.$or.push({ customer_id: contract.customer_id });
    }

    const list = await ErrorReport.find(filter)
      .populate('elevator_id', 'name')
      .populate('contract_id', 'contract_number contract_type')
      .sort({ reported_date: -1, createdAt: -1 })
      .lean();

    // Loại bỏ trùng theo id báo lỗi (khi vừa trùng contract_id vừa trùng customer_id)
    const seen = new Set();
    const uniqueList = list.filter((r) => {
      const rid = r._id?.toString();
      if (seen.has(rid)) return false;
      seen.add(rid);
      return true;
    });

    const data = uniqueList.map((r) => {
      const out = { ...r, id: r._id?.toHexString(), _id: undefined };
      out.elevators = r.elevator_id ? { name: r.elevator_id.name } : null;
      out.elevator_id = r.elevator_id?._id?.toHexString?.() ?? r.elevator_id;
      out.contracts = r.contract_id
        ? { contract_number: r.contract_id.contract_number}
        : null;
      out.contract_id = r.contract_id?._id?.toHexString?.() ?? r.contract_id;
      return out;
    });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await Contract.findById(req.params.id)
      .populate('customer_id')
      .populate('items.product_id', 'name unit')
      .populate('items.elevator_id', 'name maintenance_months maintenance_frequency_per_month maintenance_start_date maintenance_end_date')
      .lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const data = { ...doc, id: doc._id?.toHexString() };
    delete data._id;
    if (data.customer_id && typeof data.customer_id === 'object') {
      const c = data.customer_id;
      data.customers = {
        id: c._id?.toHexString?.(),
        customerId: c.customerId,
        name: c.name,
        customerType: c.customerType,
        email: c.email,
        phone: c.phone,
        region: c.region,
        province: c.province,
        district: c.district,
        addressDetail: c.addressDetail,
        address: c.address,
        note: c.note,
      };
      data.customer_id = c._id?.toHexString?.();
    }
    data.contract_products = (doc.items || []).map((it) => ({
      id: it._id?.toHexString(),
      item_type: it.item_type || (it.elevator_id ? 'elevator' : 'product'),
      product_id: it.product_id?._id?.toHexString?.() ?? it.product_id,
      elevator_id: it.elevator_id?._id?.toHexString?.() ?? it.elevator_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
      products: it.product_id ? { name: it.product_id.name, unit: it.product_id.unit } : null,
      elevator: it.elevator_id
        ? {
            name: it.elevator_id.name,
            maintenance_months: it.elevator_id.maintenance_months,
            maintenance_frequency_per_month: it.elevator_id.maintenance_frequency_per_month,
            maintenance_start_date: it.elevator_id.maintenance_start_date || null,
            maintenance_end_date: it.elevator_id.maintenance_end_date || null,
          }
        : null,
    }));
    delete data.items;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

/** Tạo các ngày bảo trì định kỳ từ hợp đồng lắp đặt đã hoàn thành (gọi tự động khi HĐ hoàn thành; endpoint giữ để tạo lại nếu cần) */
router.post('/:id/generate-maintenance-schedule', requireAdmin, async (req, res) => {
  try {
    const doc = await Contract.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.contract_type !== 'installation' || doc.status !== 'completed') {
      return res.status(400).json({ error: 'Chỉ hợp đồng lắp đặt đã hoàn thành mới tạo được lịch bảo trì' });
    }
    if (!doc.end_date) {
      return res.status(400).json({ error: 'Hợp đồng chưa có ngày kết thúc' });
    }
    const created = await generateMaintenanceScheduleForContract(req.params.id);
    return res.json({ created, message: `Đã thêm ${created} mục vào lịch bảo trì` });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const items = (body.items || body.contract_products || []).map((it) => ({
      item_type: it.item_type || (it.elevator_id ? 'elevator' : 'product'),
      product_id: it.product_id || null,
      elevator_id: it.elevator_id || null,
      quantity: it.quantity ?? 1,
      unit_price: it.unit_price ?? 0,
    }));
    const payloadBase = {
      customer_id: body.customer_id || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      contract_type: body.contract_type || 'installation',
      status: body.status || 'draft',
      total_value: body.total_value ?? 0,
      notes: body.notes || '',
      items,
    };

    let requestedNumber = String(body.contract_number || '').trim() || null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const contract_number = requestedNumber ?? (await generateNextContractNumber());
        const doc = new Contract({ ...payloadBase, contract_number });
        await doc.save();
        if (doc.status === 'completed' && doc.contract_type === 'installation' && doc.end_date) {
          generateMaintenanceScheduleForContract(doc._id).catch((err) => console.error('Auto generate maintenance schedule:', err));
        }
        return res.status(201).json(doc.toJSON());
      } catch (err) {
        if (err?.code === 11000 && attempt < 4) {
          // If the previewed number is stale (someone else created first), fall back to system-generated number.
          requestedNumber = null;
          continue;
        }
        throw err;
      }
    }

    return res.status(500).json({ error: 'Server error' });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'Contract number already exists' });
    }
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const items = (body.items || body.contract_products || []).map((it) => ({
      item_type: it.item_type || (it.elevator_id ? 'elevator' : 'product'),
      product_id: it.product_id || null,
      elevator_id: it.elevator_id || null,
      quantity: it.quantity ?? 1,
      unit_price: it.unit_price ?? 0,
    }));
    const payload = {
      customer_id: body.customer_id ?? undefined,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      contract_type: body.contract_type ?? undefined,
      status: body.status ?? 'draft',
      total_value: body.total_value ?? 0,
      notes: body.notes ?? '',
      items,
    };
    const doc = await Contract.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    })
      .populate('items.product_id', 'name unit')
      .lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.status === 'completed' && doc.contract_type === 'installation' && doc.end_date) {
      generateMaintenanceScheduleForContract(doc._id).catch((err) => console.error('Auto generate maintenance schedule:', err));
    }
    const data = { ...doc, id: doc._id?.toHexString() };
    delete data._id;
    if (data.customer_id && typeof data.customer_id === 'object') {
      data.customer_id = data.customer_id._id?.toHexString();
    }
    data.contract_products = (doc.items || []).map((it) => ({
      id: it._id?.toHexString(),
      item_type: it.item_type || (it.elevator_id ? 'elevator' : 'product'),
      product_id: it.product_id?._id?.toHexString?.() ?? it.product_id,
      elevator_id: it.elevator_id?._id?.toHexString?.() ?? it.elevator_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
      products: it.product_id ? { name: it.product_id.name, unit: it.product_id.unit } : null,
      elevator: it.elevator_id ? { name: it.elevator_id.name } : null,
    }));
    delete data.items;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowed = ['draft', 'active', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const contract = await Contract.findById(req.params.id).lean();
    if (!contract) return res.status(404).json({ error: 'Not found' });

    if (status === 'completed' && contract.contract_type === 'installation' && Array.isArray(contract.items)) {
      const completionDate = contract.end_date || contract.start_date || new Date();
      const startOfDay = new Date(completionDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      for (const it of contract.items) {
        if (!it.elevator_id) continue;
        const elevator = await Elevator.findById(it.elevator_id).lean();
        if (!elevator) continue;
        const months = elevator.maintenance_months != null && elevator.maintenance_months >= 1 ? Number(elevator.maintenance_months) : 0;
        if (months < 1) continue;
        const endDate = new Date(startOfDay);
        endDate.setUTCMonth(endDate.getUTCMonth() + months);
        await Elevator.findByIdAndUpdate(it.elevator_id, {
          maintenance_start_date: startOfDay,
          maintenance_end_date: endDate,
        });
      }
    }

    const doc = await Contract.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    )
      .select('status _id')
      .lean();
    if (status === 'completed') {
      generateMaintenanceScheduleForContract(req.params.id).catch((err) => console.error('Auto generate maintenance schedule:', err));
    }
    return res.json({ id: doc._id?.toHexString(), status: doc.status });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const contractId = req.params.id;
    const scheduleIds = await MaintenanceSchedule.find({ contract_id: contractId }).select('_id').lean();
    const ids = (scheduleIds || []).map((s) => s._id);
    if (ids.length > 0) {
      await MaintenanceOrder.deleteMany({ maintenance_schedule_id: { $in: ids } });
      await MaintenanceSchedule.deleteMany({ contract_id: contractId });
    }
    const doc = await Contract.findByIdAndDelete(contractId);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
