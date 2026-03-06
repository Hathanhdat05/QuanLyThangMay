import { Router } from 'express';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { Contract } from '../models/Contract.js';
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

router.get('/', async (req, res) => {
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

router.get('/:id', async (req, res) => {
  try {
    const doc = await Contract.findById(req.params.id)
      .populate('customer_id', 'name')
      .populate('items.product_id', 'name unit')
      .populate('items.elevator_id', 'name')
      .lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const data = { ...doc, id: doc._id?.toHexString() };
    delete data._id;
    if (data.customer_id && typeof data.customer_id === 'object') {
      data.customers = { name: data.customer_id.name };
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
    const doc = await Contract.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    )
      .select('status _id')
      .lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    return res.json({ id: doc._id?.toHexString(), status: doc.status });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const doc = await Contract.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
