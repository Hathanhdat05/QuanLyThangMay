export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/** Origin của API server (không có /api), dùng cho URL ảnh upload. Khi deploy, cần set VITE_API_URL đúng để ảnh load. */
export const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

/**
 * Trả về URL đầy đủ cho ảnh (upload). Nếu url đã là absolute thì dùng nguyên, không thì ghép với API_ORIGIN.
 */
export function getImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${API_ORIGIN}${path}`;
}

function getToken() {
  return localStorage.getItem('auth_token');
}

export const apiConfigured = true;

async function request(method, path, body = null, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const config = { method, headers };
  if (body != null && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    config.body = JSON.stringify(body);
  }

  const res = await fetch(url, config);
  if (res.status === 204) return { data: null, error: null };
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { data: null, error: { message: data.message || data.error || 'Request failed', status: res.status } };
  }
  return { data, error: null };
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
  getToken,
  setToken: (token) => {
    if (token) localStorage.setItem('auth_token', token);
    else localStorage.removeItem('auth_token');
  },
};
