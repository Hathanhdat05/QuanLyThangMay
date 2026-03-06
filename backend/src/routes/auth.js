import { Router } from 'express';
import { User, comparePassword } from '../models/User.js';
import { authMiddleware } from '../middleware/auth.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+passwordHash').lean();
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    delete user.passwordHash;
    user.id = user._id?.toHexString();
    delete user._id;
    const token = signToken(user.id);
    return res.json({ token, user });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const profile = { ...user, id: user._id?.toHexString() };
    delete profile._id;
    return res.json(profile);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
