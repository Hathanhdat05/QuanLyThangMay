import { Router } from 'express';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { Contract } from '../models/Contract.js';
import { ErrorReport } from '../models/ErrorReport.js';
import { MaintenanceSchedule } from '../models/MaintenanceSchedule.js';
import { MaintenanceOrder } from '../models/MaintenanceOrder.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import { generateNextContractNumber, previewNextContractNumber } from '../utils/contractNumber.js';
import { parseDateOnlyToDate, toDateOnly } from '../utils/dateOnly.js';
import { syncScheduleToGoogleCalendar, deleteScheduleFromGoogleCalendar } from '../services/googleCalendarSync.js';

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

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

/** Tự động tạo lịch bảo trì định kỳ khi hợp đồng lắp đặt hoàn thành (có start_date, end_date). Trả về số mục đã thêm. */
async function generateMaintenanceScheduleForContract(contractId) {
  const doc = await Contract.findById(contractId)
    .populate('items.elevator_id', 'name')
    .populate('customer_id', 'name')
    .lean();
  if (!doc || doc.contract_type !== 'installation' || doc.status !== 'completed') return 0;
  const startDate = doc.start_date ? new Date(doc.start_date) : null;
  const endDate = doc.end_date ? new Date(doc.end_date) : null;
  const frequencyMonths = doc.maintenance_frequency_per_month != null ? Number(doc.maintenance_frequency_per_month) : 0;
  if (!startDate || Number.isNaN(startDate.getTime())) return 0;
  if (!endDate || Number.isNaN(endDate.getTime())) return 0;
  if (startDate > endDate) return 0;
  if (frequencyMonths <= 0) return 0;

  let created = 0;
  const todayDateOnly = toDateOnly(new Date());
  const contractNumber = doc.contract_number || '';
  const customerId = doc.customer_id?._id ?? doc.customer_id;
  const customerName = (typeof doc.customer_id === 'object' && doc.customer_id?.name) ? doc.customer_id.name : '';

  for (const it of doc.items || []) {
    if (!it.elevator_id || it.item_type !== 'elevator') continue;
    const elev = it.elevator_id;
    const elevatorId = elev._id;
    const elevatorName = elev.name || 'Thang máy';
    const dates = [];
    // Lịch bảo trì định kỳ chạy trong khoảng ngày hợp đồng: lần đầu = ngày bắt đầu + 1 chu kỳ
    let d = addMonths(new Date(startDate), frequencyMonths);
    while (d <= endDate) {
      const scheduleDateOnly = toDateOnly(d);
      if (scheduleDateOnly) dates.push(scheduleDateOnly);
      d = addMonths(d, frequencyMonths);
    }

    for (const scheduledDate of dates) {
      const exists = await MaintenanceSchedule.findOne({
        contract_id: doc._id,
        elevator_id: elevatorId,
        scheduled_date: scheduledDate,
      });
      if (!exists) {
        const initialStatus =
          todayDateOnly && scheduledDate < todayDateOnly ? 'completed' : 'planned';
        const dateObj = parseDateOnlyToDate(scheduledDate) || new Date();
        const month = dateObj.getMonth() + 1;
        const year = dateObj.getFullYear();
        const monthYear = `${String(month).padStart(2, '0')}/${year}`;
        const title = `Bảo trì định kì - ${monthYear} - ${customerName || elevatorName}`;
        const scheduleDoc = await MaintenanceSchedule.create({
          contract_id: doc._id,
          elevator_id: elevatorId,
          scheduled_date: scheduledDate,
          title,
          status: initialStatus,
          contract_number: contractNumber,
          elevator_name: elevatorName,
          customer_id: customerId || undefined,
          customer_name: customerName,
        });
        syncScheduleToGoogleCalendar(scheduleDoc).catch((err) =>
          console.error('Google Calendar sync schedule error:', err?.message || err)
        );
        await MaintenanceOrder.create({
          maintenance_schedule_id: scheduleDoc._id,
          contract_id: doc._id,
          elevator_id: elevatorId,
          customer_id: customerId || undefined,
          scheduled_date: scheduledDate,
          title,
          status: initialStatus,
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

    let data = list.map((c) => {
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

    const today = parseDateOnlyToDate(new Date()) || new Date();
    for (const c of data) {
      // Trạng thái bảo trì/bảo hành chỉ áp dụng khi hợp đồng lắp đặt đã hoàn thành.
      if (c.contract_type !== 'installation' || c.status !== 'completed') {
        c.warranty_status = null;
        continue;
      }
      const contractEndDate = c.end_date ? new Date(c.end_date) : null;
      if (!contractEndDate || Number.isNaN(contractEndDate.getTime())) {
        c.warranty_status = null;
      } else {
        c.warranty_status = contractEndDate >= today ? 'under_warranty' : 'expired';
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
      .populate('items.elevator_id', 'name')
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
    if (!doc.start_date || !doc.end_date) {
      return res.status(400).json({ error: 'Hợp đồng chưa có đầy đủ ngày bắt đầu và ngày kết thúc' });
    }
    if (!doc.maintenance_frequency_per_month || Number(doc.maintenance_frequency_per_month) < 1) {
      return res.status(400).json({ error: 'Hợp đồng chưa có tần suất bảo trì hợp lệ' });
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
    const contractDurationYears =
      body.contract_duration_years != null && body.contract_duration_years !== ''
        ? Number(body.contract_duration_years)
        : null;
    if (
      contractDurationYears != null &&
      (!Number.isFinite(contractDurationYears) || contractDurationYears < 1)
    ) {
      return res.status(400).json({ error: 'Thời gian hợp đồng (năm) không hợp lệ' });
    }
    const startDateInput = body.start_date || null;
    let endDateInput = body.end_date || null;
    if (startDateInput && contractDurationYears != null) {
      const start = new Date(startDateInput);
      if (!Number.isNaN(start.getTime())) {
        endDateInput = addYears(start, contractDurationYears);
      }
    }
    const items = (body.items || body.contract_products || []).map((it) => ({
      item_type: it.item_type || (it.elevator_id ? 'elevator' : 'product'),
      product_id: it.product_id || null,
      elevator_id: it.elevator_id || null,
      quantity: it.quantity ?? 1,
      unit_price: it.unit_price ?? 0,
    }));
    const payloadBase = {
      customer_id: body.customer_id || null,
      start_date: startDateInput,
      end_date: endDateInput,
      maintenance_frequency_per_month:
        body.maintenance_frequency_per_month != null && body.maintenance_frequency_per_month !== ''
          ? Number(body.maintenance_frequency_per_month)
          : null,
      contract_type: body.contract_type || 'installation',
      status: body.status || 'draft',
      total_value: body.total_value ?? 0,
      notes: body.notes || '',
      items,
    };

    const hasElevatorItems = items.some((it) => it.item_type === 'elevator' && it.elevator_id);
    const isInstallationContract = payloadBase.contract_type === 'installation';
    if (isInstallationContract && hasElevatorItems) {
      if (!payloadBase.start_date || !payloadBase.end_date) {
        return res.status(400).json({ error: 'Hợp đồng lắp đặt phải có ngày bắt đầu và ngày kết thúc' });
      }
      const startDate = new Date(payloadBase.start_date);
      const endDate = new Date(payloadBase.end_date);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
        return res.status(400).json({ error: 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu' });
      }
      if (!payloadBase.maintenance_frequency_per_month || payloadBase.maintenance_frequency_per_month < 1) {
        return res.status(400).json({ error: 'Vui lòng nhập tần suất bảo trì (tháng/lần)' });
      }
    }

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
    const contractDurationYears =
      body.contract_duration_years != null && body.contract_duration_years !== ''
        ? Number(body.contract_duration_years)
        : null;
    if (
      contractDurationYears != null &&
      (!Number.isFinite(contractDurationYears) || contractDurationYears < 1)
    ) {
      return res.status(400).json({ error: 'Thời gian hợp đồng (năm) không hợp lệ' });
    }
    const startDateInput = body.start_date ?? null;
    let endDateInput = body.end_date ?? null;
    if (startDateInput && contractDurationYears != null) {
      const start = new Date(startDateInput);
      if (!Number.isNaN(start.getTime())) {
        endDateInput = addYears(start, contractDurationYears);
      }
    }
    const items = (body.items || body.contract_products || []).map((it) => ({
      item_type: it.item_type || (it.elevator_id ? 'elevator' : 'product'),
      product_id: it.product_id || null,
      elevator_id: it.elevator_id || null,
      quantity: it.quantity ?? 1,
      unit_price: it.unit_price ?? 0,
    }));
    const payload = {
      customer_id: body.customer_id ?? undefined,
      start_date: startDateInput,
      end_date: endDateInput,
      maintenance_frequency_per_month:
        body.maintenance_frequency_per_month != null && body.maintenance_frequency_per_month !== ''
          ? Number(body.maintenance_frequency_per_month)
          : null,
      contract_type: body.contract_type ?? undefined,
      status: body.status ?? 'draft',
      total_value: body.total_value ?? 0,
      notes: body.notes ?? '',
      items,
    };
    const hasElevatorItems = items.some((it) => it.item_type === 'elevator' && it.elevator_id);
    const nextContractType = payload.contract_type ?? body.contract_type;
    if (nextContractType === 'installation' && hasElevatorItems) {
      if (!payload.start_date || !payload.end_date) {
        return res.status(400).json({ error: 'Hợp đồng lắp đặt phải có ngày bắt đầu và ngày kết thúc' });
      }
      const startDate = new Date(payload.start_date);
      const endDate = new Date(payload.end_date);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
        return res.status(400).json({ error: 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu' });
      }
      if (!payload.maintenance_frequency_per_month || payload.maintenance_frequency_per_month < 1) {
        return res.status(400).json({ error: 'Vui lòng nhập tần suất bảo trì (tháng/lần)' });
      }
    }
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
    const scheduleIds = await MaintenanceSchedule.find({ contract_id: contractId })
      .select('_id google_calendar_event_id')
      .lean();
    const ids = (scheduleIds || []).map((s) => s._id);
    if (ids.length > 0) {
      await Promise.all(
        scheduleIds.map((schedule) =>
          deleteScheduleFromGoogleCalendar(schedule).catch((err) =>
            console.error('Google Calendar delete schedule error:', err?.message || err)
          )
        )
      );
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
