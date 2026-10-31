// Client for the Express API in server/. Same origin, so no base URL needed.
// Components never call fetch directly; they go through this file.
// Sign-in/up/out go through src/services/auth-client.js (Better Auth); its session
// cookie is sent automatically because the API is same-origin.
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}) {
  const res = await fetch('/api' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? res.statusText, body.details);
  return body;
}

export const getProducts = ({ category, q } = {}) => {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (q) params.set('q', q);
  const qs = params.toString();
  return request(`/products${qs ? `?${qs}` : ''}`);
};
export const getProviders = () => request('/providers');
export const getCategories = () => request('/categories');
export const getLoyalty = () => request('/loyalty');
export const getOrders = () => request('/orders');
export const createOrder = (body) => request('/orders', { method: 'POST', body: JSON.stringify(body) });
