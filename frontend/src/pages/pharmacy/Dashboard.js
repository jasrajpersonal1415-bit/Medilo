import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { pharmacyStaffAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../../components/ui/dialog';
import { 
  LogOut, Package, CheckCircle, XCircle, Truck, Clock,
  MapPin, AlertTriangle, Clipboard
} from 'lucide-react';
import { 
  formatDateTime, formatCurrency, getStatusClass, getStatusName, 
  getBucketClass, getBucketName 
} from '../../lib/utils';
import { toast } from 'sonner';

export default function PharmacyDashboard() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actionDialog, setActionDialog] = useState({ open: false, type: null });
  const [rejectionReason, setRejectionReason] = useState('');
  const [inventoryData, setInventoryData] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await pharmacyStaffAPI.getOrders();
      setOrders(response.data);
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const openInventoryDialog = (order) => {
    setSelectedOrder(order);
    setInventoryData(order.items.map(item => ({
      medicine_id: item.medicine_id,
      medicine_name: item.medicine_name,
      quantity: item.quantity,
      unit_price: item.unit_price, // Price from MEDILO master (read-only)
      batch_number: '',
      expiry_date: ''
    })));
    setActionDialog({ open: true, type: 'inventory' });
  };

  const handleAction = async (type) => {
    if (!selectedOrder) return;
    
    setActionLoading(true);
    try {
      if (type === 'confirm_inventory') {
        // Validate inventory data (batch & expiry only - NO price)
        const invalid = inventoryData.some(i => !i.batch_number || !i.expiry_date);
        if (invalid) {
          toast.error('Please fill batch number and expiry date for all items');
          setActionLoading(false);
          return;
        }
        
        await pharmacyStaffAPI.confirmInventory(selectedOrder.id, {
          items: inventoryData.map(i => ({
            medicine_id: i.medicine_id,
            batch_number: i.batch_number,
            expiry_date: i.expiry_date
          }))
        });
        toast.success('Inventory confirmed');
      } else if (type === 'reject') {
        if (!rejectionReason) {
          toast.error('Please provide a reason');
          setActionLoading(false);
          return;
        }
        await pharmacyStaffAPI.performAction(selectedOrder.id, {
          action: 'reject',
          rejection_reason: rejectionReason
        });
        toast.success('Order rejected');
      } else {
        await pharmacyStaffAPI.performAction(selectedOrder.id, { action: type });
        toast.success('Order updated');
      }
      
      setActionDialog({ open: false, type: null });
      setSelectedOrder(null);
      setRejectionReason('');
      setInventoryData([]);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const updateInventoryItem = (idx, field, value) => {
    const updated = [...inventoryData];
    updated[idx][field] = value;
    setInventoryData(updated);
  };

  const getActionButtons = (order) => {
    switch (order.status) {
      case 'assigned_to_pharmacy':
        return (
          <>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                setSelectedOrder(order);
                handleAction('accept');
              }}
              data-testid={`accept-${order.id}`}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600"
              onClick={() => {
                setSelectedOrder(order);
                setActionDialog({ open: true, type: 'reject' });
              }}
              data-testid={`reject-${order.id}`}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </>
        );
      case 'pharmacy_accepted':
        return (
          <Button
            size="sm"
            className="bg-[#0F62FE] hover:bg-[#0353E9]"
            onClick={() => openInventoryDialog(order)}
            data-testid={`confirm-inventory-${order.id}`}
          >
            <Clipboard className="h-4 w-4 mr-1" />
            Confirm Inventory
          </Button>
        );
      case 'inventory_confirmed':
        return (
          <Button
            size="sm"
            className="bg-yellow-600 hover:bg-yellow-700"
            onClick={() => {
              setSelectedOrder(order);
              handleAction('mark_preparing');
            }}
            data-testid={`preparing-${order.id}`}
          >
            <Package className="h-4 w-4 mr-1" />
            Mark Preparing
          </Button>
        );
      case 'preparing':
        return (
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => {
              setSelectedOrder(order);
              handleAction('mark_ready');
            }}
            data-testid={`ready-${order.id}`}
          >
            <Truck className="h-4 w-4 mr-1" />
            Ready for Pickup
          </Button>
        );
      case 'out_for_delivery':
        return (
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => {
              setSelectedOrder(order);
              handleAction('mark_delivered');
            }}
            data-testid={`delivered-${order.id}`}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Mark Delivered
          </Button>
        );
      default:
        return null;
    }
  };

  const statusCounts = {
    assigned: orders.filter(o => o.status === 'assigned_to_pharmacy').length,
    accepted: orders.filter(o => o.status === 'pharmacy_accepted').length,
    preparing: orders.filter(o => ['inventory_confirmed', 'preparing'].includes(o.status)).length,
    delivery: orders.filter(o => o.status === 'out_for_delivery').length,
  };

  return (
    <div className="dashboard-shell">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="mb-8">
          <div className="medilo-logo">MEDILO</div>
          <p className="text-xs text-gray-500 mt-1">Pharmacy Panel</p>
        </div>

        <div className="space-y-4">
          <div className="p-3 bg-yellow-50 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">New Orders</span>
            </div>
            <p className="text-2xl font-bold text-yellow-900 mt-1">{statusCounts.assigned}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 text-blue-800">
              <Package className="h-4 w-4" />
              <span className="text-sm font-medium">In Progress</span>
            </div>
            <p className="text-2xl font-bold text-blue-900 mt-1">{statusCounts.accepted + statusCounts.preparing}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <Truck className="h-4 w-4" />
              <span className="text-sm font-medium">Out for Delivery</span>
            </div>
            <p className="text-2xl font-bold text-green-900 mt-1">{statusCounts.delivery}</p>
          </div>
        </div>

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
          <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
          <p className="text-gray-500">Manage and fulfill medicine orders</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <Package className="empty-state-icon mx-auto" />
            <h3 className="empty-state-title">No Orders</h3>
            <p className="empty-state-text">No orders assigned to your pharmacy yet</p>
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
                    <table className="data-table text-sm">
                      <thead>
                        <tr>
                          <th>Medicine</th>
                          <th>Qty</th>
                          {order.items[0]?.batch_number && <th>Batch</th>}
                          {order.items[0]?.unit_price && <th>Price</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <Badge className={`${getBucketClass(item.medicine_bucket)} text-xs mr-2`}>
                                {getBucketName(item.medicine_bucket)}
                              </Badge>
                              {item.medicine_name}
                            </td>
                            <td>{item.quantity}</td>
                            {item.batch_number && <td>{item.batch_number}</td>}
                            {item.unit_price && <td>{formatCurrency(item.unit_price)}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {order.total_amount && (
                    <div className="mb-4 text-right">
                      <span className="font-semibold">Total: {formatCurrency(order.total_amount)}</span>
                    </div>
                  )}

                  {/* Delivery Address */}
                  <div className="mb-4 flex items-start gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mt-0.5" />
                    <span>{order.delivery_address}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    {getActionButtons(order)}
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

      {/* Rejection Dialog */}
      <Dialog 
        open={actionDialog.open && actionDialog.type === 'reject'} 
        onOpenChange={(open) => !open && setActionDialog({ open: false, type: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Order</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Reason for rejection</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Provide reason for rejection"
              rows={3}
              data-testid="rejection-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, type: null })}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleAction('reject')} 
              disabled={actionLoading || !rejectionReason}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-reject"
            >
              {actionLoading ? <div className="spinner h-4 w-4" /> : 'Reject Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventory Dialog */}
      <Dialog 
        open={actionDialog.open && actionDialog.type === 'inventory'} 
        onOpenChange={(open) => !open && setActionDialog({ open: false, type: null })}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Inventory</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {inventoryData.map((item, idx) => (
              <div key={idx} className="p-4 border rounded-lg">
                <p className="font-medium mb-3">{item.medicine_name} (Qty: {item.quantity})</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Batch Number</Label>
                    <Input
                      value={item.batch_number}
                      onChange={(e) => updateInventoryItem(idx, 'batch_number', e.target.value)}
                      placeholder="e.g., BTH001"
                      data-testid={`batch-${idx}`}
                    />
                  </div>
                  <div>
                    <Label>Expiry Date</Label>
                    <Input
                      type="date"
                      value={item.expiry_date}
                      onChange={(e) => updateInventoryItem(idx, 'expiry_date', e.target.value)}
                      data-testid={`expiry-${idx}`}
                    />
                  </div>
                  <div>
                    <Label>Unit Price (₹)</Label>
                    <Input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateInventoryItem(idx, 'unit_price', e.target.value)}
                      placeholder="e.g., 50"
                      data-testid={`price-${idx}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, type: null })}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleAction('confirm_inventory')} 
              disabled={actionLoading}
              className="bg-[#0F62FE] hover:bg-[#0353E9]"
              data-testid="confirm-inventory-btn"
            >
              {actionLoading ? <div className="spinner h-4 w-4" /> : 'Confirm & Generate Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
