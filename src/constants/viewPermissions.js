export const VIEW_PERMISSION_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'customers', label: 'Khach hang' },
  { value: 'contracts', label: 'Hop dong' },
  { value: 'products', label: 'San pham' },
  { value: 'elevators', label: 'Thang may' },
  { value: 'errorReports', label: 'Bao loi' },
  { value: 'maintenanceCalendar', label: 'Lich bao tri' },
  { value: 'maintenanceOrders', label: 'Don bao tri' },
  { value: 'myJobs', label: 'Cong viec cua toi' },
  { value: 'notifications', label: 'Thong bao' },
  { value: 'users', label: 'Quan ly User' },
];

export const VIEW_PERMISSION_KEYS = VIEW_PERMISSION_OPTIONS.map((option) => option.value);
export const ADMIN_ONLY_VIEW_PERMISSIONS = ['maintenanceOrders', 'users'];
export const USER_VIEW_PERMISSION_KEYS = VIEW_PERMISSION_KEYS.filter(
  (key) => !ADMIN_ONLY_VIEW_PERMISSIONS.includes(key)
);
export const LEGACY_DEFAULT_USER_VIEW_PERMISSIONS = [...USER_VIEW_PERMISSION_KEYS];

const ROUTE_PERMISSION_PAIRS = [
  ['dashboard', '/'],
  ['customers', '/customers'],
  ['contracts', '/contracts'],
  ['products', '/products'],
  ['elevators', '/elevators'],
  ['errorReports', '/error-reports'],
  ['maintenanceCalendar', '/maintenance-calendar'],
  ['maintenanceOrders', '/maintenance-orders'],
  ['myJobs', '/my-jobs'],
  ['notifications', '/notifications'],
  ['users', '/users'],
];

export function normalizeViewPermissions(viewPermissions, role) {
  const source = Array.isArray(viewPermissions)
    ? viewPermissions.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const valid = [...new Set(source.filter((value) => VIEW_PERMISSION_KEYS.includes(value)))];
  if (role === 'admin') return VIEW_PERMISSION_KEYS;
  if (valid.length > 0) return valid.filter((value) => !ADMIN_ONLY_VIEW_PERMISSIONS.includes(value));
  return [...LEGACY_DEFAULT_USER_VIEW_PERMISSIONS];
}

export function hasViewPermission(profile, permission) {
  if (!permission) return true;
  if (profile?.role === 'admin') return true;
  const normalized = normalizeViewPermissions(profile?.view_permissions, profile?.role);
  return normalized.includes(permission);
}

export function getDefaultRouteForProfile(profile) {
  if (!profile) return '/login';
  const normalized = normalizeViewPermissions(profile.view_permissions, profile.role);
  const matched = ROUTE_PERMISSION_PAIRS.find(([permission]) => normalized.includes(permission));
  return matched?.[1] || '/login';
}
