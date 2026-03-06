import { Router } from 'express';
import { User } from '../models/User.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { full_name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    const list = await User.find(filter).sort({ createdAt: -1 }).lean();
    const data = list.map((u) => ({ ...u, id: u._id?.toHexString(), _id: undefined }));
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await User.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const data = { ...doc, id: doc._id?.toHexString() };
    delete data._id;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { email, password, full_name, role, phone } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const existing = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const user = new User({
      email: String(email).trim().toLowerCase(),
      passwordHash: password,
      full_name: full_name || '',
      role: role === 'admin' ? 'admin' : 'user',
      phone: phone || '',
    });
    await user.save();
    const data = user.toJSON();
    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { full_name, role, phone } = req.body || {};
    const doc = await User.findByIdAndUpdate(
      req.params.id,
      { full_name, role, phone },
      { new: true, runValidators: true }
    ).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const data = { ...doc, id: doc._id?.toHexString() };
    delete data._id;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await User.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
