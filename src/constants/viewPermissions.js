export const VIEW_PERMISSION_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'customers', label: 'Khách hàng' },
  { value: 'contracts', label: 'Hợp đồng' },
  { value: 'products', label: 'Sản phẩm' },
  { value: 'elevators', label: 'Thang máy' },
  { value: 'errorReports', label: 'Báo lỗi' },
  { value: 'maintenanceCalendar', label: 'Lịch bảo trì' },
  { value: 'maintenanceOrders', label: 'Đơn bảo trì' },
  { value: 'myJobs', label: 'Công việc của tôi' },
  { value: 'notifications', label: 'Thông báo' },
  { value: 'users', label: 'Quản lý User' },
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
