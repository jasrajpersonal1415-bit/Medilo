import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Format date for display
export function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Format date with time
export function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format currency (INR)
export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
}

// Get bucket badge class
export function getBucketClass(bucket) {
  switch (bucket) {
    case 'OTC':
      return 'bucket-otc';
    case 'SCHEDULE_H':
      return 'bucket-schedule-h';
    case 'SCHEDULE_H1':
      return 'bucket-schedule-h1';
    default:
      return '';
  }
}

// Get bucket display name
export function getBucketName(bucket) {
  switch (bucket) {
    case 'OTC':
      return 'OTC';
    case 'SCHEDULE_H':
      return 'Schedule H';
    case 'SCHEDULE_H1':
      return 'Schedule H1';
    default:
      return bucket;
  }
}

// Get status badge class
export function getStatusClass(status) {
  if (status.includes('pending') || status.includes('review')) return 'badge-pending';
  if (status.includes('approved') || status.includes('confirmed')) return 'badge-approved';
  if (status.includes('rejected') || status.includes('cancelled')) return 'badge-rejected';
  if (status.includes('preparing') || status.includes('delivery') || status.includes('assigned') || status.includes('accepted')) return 'badge-processing';
  if (status.includes('delivered')) return 'badge-delivered';
  return '';
}

// Get status display name
export function getStatusName(status) {
  const statusNames = {
    'pending_pharmacist_review': 'Pending Review',
    'pharmacist_approved': 'Approved',
    'pharmacist_rejected': 'Rejected',
    'prescription_requested': 'Prescription Needed',
    'assigned_to_pharmacy': 'Assigned',
    'pharmacy_accepted': 'Accepted',
    'pharmacy_rejected': 'Pharmacy Rejected',
    'inventory_confirmed': 'Inventory Confirmed',
    'preparing': 'Preparing',
    'ready_for_pickup': 'Ready for Pickup',
    'picked_up': 'Picked Up',
    'out_for_delivery': 'Out for Delivery',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled',
  };
  return statusNames[status] || status;
}

// Convert file to base64
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

// Validate phone number (Indian)
export function isValidPhone(phone) {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone);
}

// Validate email
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Truncate text
export function truncate(str, length = 50) {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

// Get user initials
export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Order status steps for timeline
export const ORDER_STEPS = [
  { status: 'pending_pharmacist_review', label: 'Under Review' },
  { status: 'pharmacist_approved', label: 'Approved' },
  { status: 'assigned_to_pharmacy', label: 'Assigned' },
  { status: 'pharmacy_accepted', label: 'Accepted' },
  { status: 'inventory_confirmed', label: 'Confirmed' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'ready_for_pickup', label: 'Ready' },
  { status: 'picked_up', label: 'Picked Up' },
  { status: 'out_for_delivery', label: 'Out for Delivery' },
  { status: 'delivered', label: 'Delivered' },
];

// Get current step index
export function getStepIndex(status) {
  const idx = ORDER_STEPS.findIndex((s) => s.status === status);
  return idx >= 0 ? idx : -1;
}
