import { Router } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { Customer } from '../models/Customer.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

function formatDateYYYYMMDD(date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function buildAddress(province, district, addressDetail) {
  const parts = [addressDetail, district, province].filter(Boolean);
  return parts.join(', ') || '';
}

async function generateUniqueCustomerId() {
  const datePart = formatDateYYYYMMDD(new Date());
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 hex chars
    const customerId = `KH${datePart}-${rand}`;
    const exists = await Customer.exists({ customerId });
    if (!exists) return customerId;
  }
  const fallback = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `KH${datePart}-${fallback}`;
}

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) {
      const or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { customerId: { $regex: search, $options: 'i' } },
      ];
      if (/^[0-9a-fA-F]{24}$/.test(String(search))) {
        or.push({ _id: new mongoose.Types.ObjectId(String(search)) });
      }
      filter.$or = or;
    }
    const list = await Customer.find(filter).sort({ createdAt: -1 }).lean();
    const data = list.map((c) => ({ ...c, id: c._id?.toHexString(), _id: undefined }));
    return res.json(data);
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/new-id', requireAdmin, async (_req, res) => {
  try {
    const customerId = await generateUniqueCustomerId();
    return res.json({ customerId });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/export', requireAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) {
      const or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { customerId: { $regex: search, $options: 'i' } },
      ];
      if (/^[0-9a-fA-F]{24}$/.test(String(search))) {
        or.push({ _id: new mongoose.Types.ObjectId(String(search)) });
      }
      filter.$or = or;
    }

    const list = await Customer.find(filter).sort({ createdAt: -1 }).lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'thangmay3';
    workbook.created = new Date();
    const ws = workbook.addWorksheet('KhachHang');

    ws.columns = [
      { header: 'ID', key: 'customerId', width: 18 },
      { header: 'Tên khách hàng', key: 'name', width: 28 },
      { header: 'Loại', key: 'customerType', width: 14 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Số điện thoại', key: 'phone', width: 16 },
      { header: 'Khu vực', key: 'region', width: 14 },
      { header: 'Địa chỉ', key: 'address', width: 36 },
      { header: 'Tỉnh/TP', key: 'province', width: 16 },
      { header: 'Quận/Huyện', key: 'district', width: 16 },
      { header: 'Địa chỉ chi tiết', key: 'addressDetail', width: 26 },
      { header: 'Ghi chú', key: 'note', width: 26 },
      { header: 'Ngày tạo', key: 'createdAt', width: 18 },
      { header: 'Cập nhật', key: 'updatedAt', width: 18 },
    ];

    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    for (const c of list) {
      ws.addRow({
        customerId: c.customerId ?? '',
        name: c.name ?? '',
        customerType: (c.customerType || 'individual') === 'business' ? 'Doanh nghiệp' : 'Cá nhân',
        email: c.email ?? '',
        phone: c.phone ?? '',
        region: c.region ?? '',
        address: c.address ?? '',
        province: c.province ?? '',
        district: c.district ?? '',
        addressDetail: c.addressDetail ?? '',
        note: c.note ?? '',
        createdAt: c.createdAt ? new Date(c.createdAt) : null,
        updatedAt: c.updatedAt ? new Date(c.updatedAt) : null,
      });
    }

    ws.getColumn('createdAt').numFmt = 'yyyy-mm-dd hh:mm';
    ws.getColumn('updatedAt').numFmt = 'yyyy-mm-dd hh:mm';

    const fileName = `khach-hang_${formatDateYYYYMMDD(new Date())}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(Buffer.from(buffer));
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await Customer.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const data = { ...doc, id: doc._id?.toHexString() };
    delete data._id;
    if (data.address && !data.addressDetail) data.addressDetail = data.address;
    return res.json(data);
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    body.province = String(body.province || '').trim();
    body.district = String(body.district || '').trim();
    body.addressDetail = String(body.addressDetail || '').trim();
    if (!body.province || !body.district) {
      return res.status(400).json({
        error: 'Province and district are required',
      });
    }
    if (!body.customerId) body.customerId = await generateUniqueCustomerId();
    body.address = buildAddress(body.province, body.district, body.addressDetail) || body.address || '';
    const doc = new Customer(body);
    await doc.save();
    return res.status(201).json(doc.toJSON());
  } catch (_err) {
    if (_err?.code === 11000) {
      return res.status(409).json({ error: 'Customer ID already exists' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const update = { ...(req.body || {}) };
    delete update.customerId; // system-generated; do not allow changing via update

    const doc = await Customer.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    if (!doc.customerId) {
      doc.customerId = await generateUniqueCustomerId();
    }

    Object.assign(doc, update);
    doc.address = buildAddress(doc.province, doc.district, doc.addressDetail) || doc.address || '';
    await doc.save();
    return res.json(doc.toJSON());
  } catch (_err) {
    if (_err?.code === 11000) {
      return res.status(409).json({ error: 'Customer ID already exists' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const doc = await Customer.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
