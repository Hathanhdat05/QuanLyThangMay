import jwt from 'jsonwebtoken';
import { User, VIEW_PERMISSIONS } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const ADMIN_ONLY_VIEW_PERMISSIONS = ['maintenanceOrders', 'users'];

function normalizeUserViewPermissions(user) {
  if (!user) return [];
  if (user.role === 'admin') return [...VIEW_PERMISSIONS];

  const allowedForUser = VIEW_PERMISSIONS.filter((permission) => !ADMIN_ONLY_VIEW_PERMISSIONS.includes(permission));
  const raw = user.view_permissions;
  if (typeof raw === 'undefined' || raw === null) {
    return allowedForUser;
  }

  if (!Array.isArray(raw)) return [];
  const valid = [...new Set(raw.map((value) => String(value || '').trim()).filter(Boolean))].filter((value) =>
    allowedForUser.includes(value)
  );
  return valid;
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Token required' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

export async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.userId).select('role').lean();
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin required' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export function requireViewPermission(permission) {
  return async function viewPermissionMiddleware(req, res, next) {
    try {
      const user = await User.findById(req.userId).select('role view_permissions').lean();
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
      }
      const viewPermissions = normalizeUserViewPermissions(user);
      if (!viewPermissions.includes(permission)) {
        return res.status(403).json({ error: 'Forbidden', message: 'You are not allowed to access this module' });
      }
      next();
    } catch (err) {
      return res.status(500).json({ error: 'Server error' });
    }
  };
}

export function requireAnyViewPermissions(permissions) {
  const permissionList = Array.isArray(permissions) ? permissions : [];
  return async function anyViewPermissionMiddleware(req, res, next) {
    try {
      const user = await User.findById(req.userId).select('role view_permissions').lean();
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
      }
      const viewPermissions = normalizeUserViewPermissions(user);
      const hasAny = permissionList.some((permission) => viewPermissions.includes(permission));
      if (!hasAny) {
        return res.status(403).json({ error: 'Forbidden', message: 'You are not allowed to access this module' });
      }
      next();
    } catch (err) {
      return res.status(500).json({ error: 'Server error' });
    }
  };
}

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}
