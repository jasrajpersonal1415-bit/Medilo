import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { pharmacistAPI, pharmacyAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../../components/ui/dialog';
import { 
  LogOut, ClipboardCheck, Clock, CheckCircle, XCircle, 
  FileText, Eye, Send, AlertTriangle, Package
} from 'lucide-react';
import { 
  formatDateTime, getStatusClass, getStatusName, 
  getBucketClass, getBucketName 
} from '../../lib/utils';
import { toast } from 'sonner';

export default function PharmacistDashboard() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actionDialog, setActionDialog] = useState({ open: false, type: null });
  const [actionNotes, setActionNotes] = useState('');
  const [selectedPharmacy, setSelectedPharmacy] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState('pending_pharmacist_review');

  useEffect(() => {
    fetchOrders();
    fetchPharmacies();
  }, [filter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await pharmacistAPI.getOrders(filter || undefined);
      setOrders(response.data);
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchPharmacies = async () => {
    try {
      const response = await pharmacyAPI.getAll();
      setPharmacies(response.data);
    } catch (err) {
      console.error('Failed to load pharmacies');
    }
  };

  const handleAction = async () => {
    if (!selectedOrder || !actionDialog.type) return;
    
    setActionLoading(true);
    try {
      if (actionDialog.type === 'assign') {
        if (!selectedPharmacy) {
          toast.error('Please select a pharmacy');
          return;
        }
        await pharmacistAPI.assignPharmacy(selectedOrder.id, selectedPharmacy);
        toast.success('Pharmacy assigned successfully');
      } else {
        await pharmacistAPI.performAction(selectedOrder.id, {
          action: actionDialog.type,
          notes: actionNotes
        });
        toast.success(`Order ${actionDialog.type === 'approve' ? 'approved' : actionDialog.type === 'reject' ? 'rejected' : 'updated'}`);
      }
      setActionDialog({ open: false, type: null });
      setSelectedOrder(null);
      setActionNotes('');
      setSelectedPharmacy('');
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openActionDialog = (order, type) => {
    setSelectedOrder(order);
    setActionDialog({ open: true, type });
    setActionNotes('');
    setSelectedPharmacy('');
  };

  const pendingCount = orders.filter(o => o.status === 'pending_pharmacist_review').length;
  const approvedCount = orders.filter(o => o.status === 'pharmacist_approved').length;

  return (
    <div className="dashboard-shell">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="mb-8">
          <div className="medilo-logo">MEDILO</div>
          <p className="text-xs text-gray-500 mt-1">Pharmacist Panel</p>
        </div>

        <nav className="space-y-1">
          <button
            onClick={() => setFilter('pending_pharmacist_review')}
            className={`nav-item w-full text-left ${filter === 'pending_pharmacist_review' ? 'active' : ''}`}
            data-testid="filter-pending"
          >
            <Clock className="h-5 w-5" />
            <span>Pending Review</span>
            {pendingCount > 0 && (
              <Badge className="ml-auto bg-yellow-100 text-yellow-800">{pendingCount}</Badge>
            )}
          </button>
          <button
            onClick={() => setFilter('pharmacist_approved')}
            className={`nav-item w-full text-left ${filter === 'pharmacist_approved' ? 'active' : ''}`}
            data-testid="filter-approved"
          >
            <CheckCircle className="h-5 w-5" />
            <span>Approved</span>
            {approvedCount > 0 && (
              <Badge className="ml-auto bg-green-100 text-green-800">{approvedCount}</Badge>
            )}
          </button>
          <button
            onClick={() => setFilter('')}
            className={`nav-item w-full text-left ${filter === '' ? 'active' : ''}`}
            data-testid="filter-all"
          >
            <ClipboardCheck className="h-5 w-5" />
            <span>All Orders</span>
          </button>
        </nav>

        <div className="mt-auto pt-8 border-t">
          <div className="px-4 py-2">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="nav-item w-full text-left text-red-600 hover:bg-red-50"
            data-testid="logout-btn"
          >
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Order Review</h1>
          <p className="text-gray-500">Review and approve medicine orders</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <Package className="empty-state-icon mx-auto" />
            <h3 className="empty-state-title">No Orders</h3>
            <p className="empty-state-text">No orders matching this filter</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => (
              <Card key={order.id} className="card-hover" data-testid={`order-${order.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base font-medium">
                        Order #{order.id.slice(0, 8).toUpperCase()}
                      </CardTitle>
                      <p className="text-sm text-gray-500">
                        {order.customer_name} • {order.customer_phone}
                      </p>
                    </div>
                    <Badge className={getStatusClass(order.status)}>
                      {getStatusName(order.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Items */}
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">MEDICINES</p>
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Badge className={`${getBucketClass(item.medicine_bucket)} text-xs`}>
                            {getBucketName(item.medicine_bucket)}
                          </Badge>
                          <span className="text-sm">{item.medicine_name}</span>
                          <span className="text-xs text-gray-400">x{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Prescription indicator */}
                  {order.prescription_image && (
                    <div className="mb-4 flex items-center gap-2 text-sm text-green-700">
                      <FileText className="h-4 w-4" />
                      <span>Prescription uploaded</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedOrder(order);
                          setActionDialog({ open: true, type: 'view_prescription' });
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  )}

                  {order.schedule_h_declaration && !order.prescription_image && (
                    <div className="mb-4 flex items-center gap-2 text-sm text-yellow-700">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Customer declared valid prescription</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    {order.status === 'pending_pharmacist_review' && (
                      <>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => openActionDialog(order, 'approve')}
                          data-testid={`approve-${order.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => openActionDialog(order, 'reject')}
                          data-testid={`reject-${order.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        {!order.prescription_image && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openActionDialog(order, 'request_prescription')}
                            data-testid={`request-rx-${order.id}`}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Request Prescription
                          </Button>
                        )}
                      </>
                    )}
                    {order.status === 'pharmacist_approved' && !order.pharmacy_id && (
                      <Button
                        size="sm"
                        className="bg-[#0F62FE] hover:bg-[#0353E9]"
                        onClick={() => openActionDialog(order, 'assign')}
                        data-testid={`assign-${order.id}`}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Assign Pharmacy
                      </Button>
                    )}
                  </div>
                  
                  <p className="text-xs text-gray-400 mt-3">
                    {formatDateTime(order.created_at)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Action Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, type: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === 'approve' && 'Approve Order'}
              {actionDialog.type === 'reject' && 'Reject Order'}
              {actionDialog.type === 'request_prescription' && 'Request Prescription'}
              {actionDialog.type === 'assign' && 'Assign Pharmacy'}
              {actionDialog.type === 'view_prescription' && 'Prescription'}
            </DialogTitle>
          </DialogHeader>

          {actionDialog.type === 'view_prescription' && selectedOrder?.prescription_image && (
            <div className="max-h-[400px] overflow-auto">
              <img 
                src={selectedOrder.prescription_image} 
                alt="Prescription" 
                className="w-full"
              />
            </div>
          )}

          {actionDialog.type === 'assign' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Pharmacy</label>
                <Select value={selectedPharmacy} onValueChange={setSelectedPharmacy}>
                  <SelectTrigger data-testid="pharmacy-select">
                    <SelectValue placeholder="Choose pharmacy" />
                  </SelectTrigger>
                  <SelectContent>
                    {pharmacies.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} - {p.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {(actionDialog.type === 'approve' || actionDialog.type === 'reject' || actionDialog.type === 'request_prescription') && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Notes {actionDialog.type === 'reject' && <span className="text-red-500">*</span>}
                </label>
                <Textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder={actionDialog.type === 'reject' ? 'Reason for rejection' : 'Optional notes'}
                  rows={3}
                  data-testid="action-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, type: null })}>
              Cancel
            </Button>
            {actionDialog.type !== 'view_prescription' && (
              <Button 
                onClick={handleAction} 
                disabled={actionLoading || (actionDialog.type === 'reject' && !actionNotes) || (actionDialog.type === 'assign' && !selectedPharmacy)}
                className={actionDialog.type === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0F62FE] hover:bg-[#0353E9]'}
                data-testid="confirm-action"
              >
                {actionLoading ? <div className="spinner h-4 w-4" /> : 'Confirm'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
