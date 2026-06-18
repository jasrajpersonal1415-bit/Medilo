import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { orderAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { 
  ArrowLeft, Download, XCircle, Upload, MapPin,
  Home, ClipboardList, ShoppingCart, User, Check
} from 'lucide-react';
import { 
  formatDate, formatDateTime, formatCurrency, 
  getStatusClass, getStatusName, getBucketClass, getBucketName,
  ORDER_STEPS, getStepIndex, fileToBase64
} from '../../lib/utils';
import { toast } from 'sonner';

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await orderAPI.getOne(orderId);
      setOrder(response.data);
    } catch (err) {
      toast.error('Failed to load order');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    
    setCancelling(true);
    try {
      await orderAPI.cancel(orderId);
      toast.success('Order cancelled');
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const handleUploadPrescription = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      await orderAPI.uploadPrescription(orderId, base64);
      toast.success('Prescription uploaded');
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  const canCancel = order && !['out_for_delivery', 'delivered', 'cancelled'].includes(order.status);
  const needsPrescription = order?.status === 'prescription_requested';
  const currentStep = order ? getStepIndex(order.status) : -1;

  if (loading) {
    return (
      <div className="mobile-container bg-white min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="mobile-container bg-[#F4F7F6] min-h-screen pb-20">
      {/* Header */}
      <div className="sticky-header px-4 py-4 bg-white">
        <div className="flex items-center gap-3">
          <Link to="/orders">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Order Details</h1>
            <p className="text-xs text-gray-500 mono">#{order.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Status Card */}
        <Card className="p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-500">Order Status</p>
              <Badge className={`${getStatusClass(order.status)} mt-1`}>
                {getStatusName(order.status)}
              </Badge>
            </div>
            <p className="text-xs text-gray-400">{formatDateTime(order.updated_at)}</p>
          </div>

          {/* Timeline */}
          {order.status !== 'cancelled' && order.status !== 'pharmacist_rejected' && order.status !== 'pharmacy_rejected' && (
            <div className="timeline mt-4">
              {ORDER_STEPS.map((step, idx) => (
                <div 
                  key={step.status}
                  className={`timeline-item ${idx < currentStep ? 'completed' : ''} ${idx === currentStep ? 'current' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    {idx <= currentStep && <Check className="h-3 w-3 text-white" />}
                    <span className={`text-sm ${idx <= currentStep ? 'font-medium' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rejection reason */}
          {(order.status === 'pharmacist_rejected' || order.status === 'pharmacy_rejected') && order.rejection_reason && (
            <div className="notice notice-error mt-4">
              <strong>Reason:</strong> {order.rejection_reason}
            </div>
          )}
        </Card>

        {/* Prescription Request */}
        {needsPrescription && (
          <Card className="p-4 border-yellow-300 bg-yellow-50">
            <h3 className="font-semibold text-yellow-800 mb-2">Prescription Required</h3>
            <p className="text-sm text-yellow-700 mb-3">
              The pharmacist has requested a prescription for this order.
            </p>
            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={handleUploadPrescription}
                className="hidden"
                disabled={uploading}
              />
              <Button variant="outline" className="w-full" disabled={uploading}>
                {uploading ? (
                  <div className="spinner h-4 w-4 mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Prescription
              </Button>
            </label>
          </Card>
        )}

        {/* Items */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Medicines</h3>
          <div className="space-y-3">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start pb-3 border-b last:border-0 last:pb-0">
                <div>
                  <Badge className={`${getBucketClass(item.medicine_bucket)} text-xs mb-1`}>
                    {getBucketName(item.medicine_bucket)}
                  </Badge>
                  <p className="font-medium text-sm">{item.medicine_name}</p>
                  <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                  {item.batch_number && (
                    <p className="text-xs text-gray-400">Batch: {item.batch_number} • Exp: {item.expiry_date}</p>
                  )}
                </div>
                {item.unit_price && (
                  <p className="text-sm font-medium">{formatCurrency(item.unit_price * item.quantity)}</p>
                )}
              </div>
            ))}
          </div>
          
          {order.total_amount && (
            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="font-semibold text-lg">{formatCurrency(order.total_amount)}</span>
            </div>
          )}
        </Card>

        {/* Delivery */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Delivery Details</h3>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-gray-400 mt-1" />
            <p className="text-sm text-gray-700">{order.delivery_address}</p>
          </div>
          {order.pharmacy_name && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-gray-500">Fulfilling Pharmacy</p>
              <p className="text-sm font-medium">{order.pharmacy_name}</p>
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="space-y-2">
          {order.invoice_generated && (
            <Button
              variant="outline"
              className="w-full"
              disabled={downloadingInvoice}
              onClick={async () => {
                setDownloadingInvoice(true);
                try {
                  const response = await orderAPI.getInvoice(order.id);
                  const blob = new Blob([response.data], { type: 'application/pdf' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `MEDILO_Invoice_${order.id.slice(0, 8).toUpperCase()}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  }, 200);
                  toast.success('Invoice downloaded');
                } catch (err) {
                  toast.error('Failed to download invoice');
                } finally {
                  setDownloadingInvoice(false);
                }
              }}
              data-testid="download-invoice-btn"
            >
              {downloadingInvoice ? (
                <div className="spinner h-4 w-4 mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download Invoice
            </Button>
          )}
          
          {canCancel && (
            <Button 
              variant="outline" 
              className="w-full text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <div className="spinner h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="flex justify-around items-center">
          <Link to="/" className="bottom-nav-item" data-testid="nav-home">
            <Home className="h-5 w-5" />
            <span>Home</span>
          </Link>
          <Link to="/orders" className="bottom-nav-item active" data-testid="nav-orders">
            <ClipboardList className="h-5 w-5" />
            <span>Orders</span>
          </Link>
          <Link to="/cart" className="bottom-nav-item" data-testid="nav-cart">
            <ShoppingCart className="h-5 w-5" />
            <span>Cart</span>
          </Link>
          <button onClick={logout} className="bottom-nav-item" data-testid="nav-logout">
            <User className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
