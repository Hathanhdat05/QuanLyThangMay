import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'products');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '.png';
    const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('image/')) return cb(null, true);
    return cb(new Error('Only image files are allowed'));
  },
});

function formatDateYYYYMMDD(date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

async function generateUniqueProductId() {
  const datePart = formatDateYYYYMMDD(new Date());
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 hex chars
    const productId = `SP${datePart}-${rand}`;
    const exists = await Product.exists({ productId });
    if (!exists) return productId;
  }
  const fallback = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `SP${datePart}-${fallback}`;
}

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) {
      const or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { productId: { $regex: search, $options: 'i' } },
      ];
      if (/^[0-9a-fA-F]{24}$/.test(String(search))) {
        or.push({ _id: new mongoose.Types.ObjectId(String(search)) });
      }
      filter.$or = or;
    }
    const list = await Product.find(filter).sort({ createdAt: -1 }).lean();
    const data = list.map((p) => ({ ...p, id: p._id?.toHexString(), _id: undefined }));
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/new-id', requireAdmin, async (_req, res) => {
  try {
    const productId = await generateUniqueProductId();
    return res.json({ productId });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/upload-image', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    const image_url = `/uploads/products/${file.filename}`;
    return res.json({ image_url });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await Product.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const data = { ...doc, id: doc._id?.toHexString() };
    delete data._id;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    if (!body.productId) body.productId = await generateUniqueProductId();
    const doc = new Product(body);
    await doc.save();
    return res.status(201).json(doc.toJSON());
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'Product ID already exists' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const update = { ...(req.body || {}) };
    delete update.productId; // system-generated; do not allow changing via update
    const doc = await Product.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const data = { ...doc, id: doc._id?.toHexString() };
    delete data._id;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const doc = await Product.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
