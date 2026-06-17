import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_URL = `${BACKEND_URL}/api`;

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('medilo_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('medilo_token');
      localStorage.removeItem('medilo_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  customerRegister: (data) => api.post('/auth/customer/register', data),
  customerLogin: (data) => api.post('/auth/customer/login', data),
  staffRegister: (data) => api.post('/auth/staff/register', data),
  staffLogin: (data) => api.post('/auth/staff/login', data),
  getMe: () => api.get('/auth/me'),
};

// Medicine API
export const medicineAPI = {
  getAll: (params) => api.get('/medicines', { params }),
  getOne: (id) => api.get(`/medicines/${id}`),
  create: (data) => api.post('/medicines', data),
  update: (id, data) => api.put(`/medicines/${id}`, data),
  delete: (id) => api.delete(`/medicines/${id}`),
  getCategories: () => api.get('/categories'),
  uploadImage: (productId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/products/${productId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};

// Pharmacy API
export const pharmacyAPI = {
  getAll: () => api.get('/pharmacies'),
  getOne: (id) => api.get(`/pharmacies/${id}`),
  create: (data) => api.post('/pharmacies', data),
  update: (id, data) => api.put(`/pharmacies/${id}`, data),
};

// Order API
export const orderAPI = {
  create: (data) => api.post('/orders', data),
  getAll: () => api.get('/orders'),
  getOne: (id) => api.get(`/orders/${id}`),
  uploadPrescription: (id, prescription_image) => 
    api.post(`/orders/${id}/upload-prescription`, { prescription_image }),
  cancel: (id) => api.post(`/orders/${id}/cancel`),
  getInvoice: (id) => api.get(`/orders/${id}/invoice`, { responseType: 'text' }),
};

// Pharmacist API
export const pharmacistAPI = {
  getOrders: (status) => api.get('/pharmacist/orders', { params: { status } }),
  performAction: (orderId, data) => api.post(`/pharmacist/orders/${orderId}/action`, data),
  assignPharmacy: (orderId, pharmacyId) => 
    api.post(`/pharmacist/orders/${orderId}/assign?pharmacy_id=${pharmacyId}`),
};

// Pharmacy Staff API
export const pharmacyStaffAPI = {
  getOrders: () => api.get('/pharmacy/orders'),
  performAction: (orderId, data) => api.post(`/pharmacy/orders/${orderId}/action`, data),
  confirmInventory: (orderId, data) => api.post(`/pharmacy/orders/${orderId}/confirm-inventory`, data),
};

// Delivery Partner API
export const deliveryAPI = {
  login: (phone) => api.post('/auth/delivery/login', { phone }),
  register: (data) => api.post('/auth/delivery/register', data),
  getOrders: () => api.get('/delivery/orders'),
  getOrder: (id) => api.get(`/delivery/orders/${id}`),
  acceptDelivery: (orderId) => api.post(`/delivery/orders/${orderId}/accept`),
  performAction: (orderId, action) => api.post(`/delivery/orders/${orderId}/action`, { action }),
  reportIssue: (orderId, data) => api.post(`/delivery/orders/${orderId}/report-issue`, data),
};

// Ops API
export const opsAPI = {
  getOrders: (status) => api.get('/ops/orders', { params: { status } }),
  getAuditLogs: (params) => api.get('/ops/audit-logs', { params }),
  getOrderTimeline: (orderId) => api.get(`/ops/order/${orderId}/timeline`),
  getUsers: (role) => api.get('/ops/users', { params: { role } }),
  toggleUserActive: (userId) => api.post(`/ops/users/${userId}/toggle-active`),
  exportAuditLogs: (params) => api.get('/ops/audit-logs/export', { params, responseType: 'text' }),
};

// Health check
export const healthCheck = () => api.get('/health');

// Customer Profile API
export const customerAPI = {
  getProfile: () => api.get('/customer/profile'),
  updateProfile: (data) => api.put('/customer/profile', data),
  getAddresses: () => api.get('/customer/addresses'),
  createAddress: (data) => api.post('/customer/addresses', data),
  updateAddress: (id, data) => api.put(`/customer/addresses/${id}`, data),
  deleteAddress: (id) => api.delete(`/customer/addresses/${id}`),
  setDefaultAddress: (id) => api.post(`/customer/addresses/${id}/set-default`),
  getWishlist: () => api.get('/customer/wishlist'),
  addToWishlist: (productId) => api.post('/customer/wishlist', { product_id: productId }),
  removeFromWishlist: (productId) => api.delete(`/customer/wishlist/${productId}`),
};

export default api;
