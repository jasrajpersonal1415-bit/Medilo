import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { deliveryAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../../components/ui/dialog';
import { 
  LogOut, Truck, Package, MapPin, Phone, Navigation,
  CheckCircle, AlertTriangle, RefreshCw, ChevronRight
} from 'lucide-react';
import { formatDateTime, getStatusName } from '../../lib/utils';
import { toast } from 'sonner';

export default function DeliveryDashboard() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [issueDialog, setIssueDialog] = useState({ open: false, orderId: null });
  const [issueForm, setIssueForm] = useState({ issue_type: '', description: '' });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await deliveryAPI.getOrders();
      setOrders(response.data);
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptDelivery = async (orderId) => {
    setActionLoading(true);
    try {
      await deliveryAPI.acceptDelivery(orderId);
      toast.success('Delivery accepted');
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to accept delivery');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = async (orderId, action) => {
    setActionLoading(true);
    try {
      await deliveryAPI.performAction(orderId, action);
      const actionLabels = {
        pickup: 'Order picked up',
        out_for_delivery: 'Out for delivery',
        delivered: 'Order delivered successfully'
      };
      toast.success(actionLabels[action] || 'Status updated');
      fetchOrders();
      setSelectedOrder(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportIssue = async () => {
    if (!issueForm.issue_type || !issueForm.description) {
      toast.error('Please fill all fields');
      return;
    }
    
    setActionLoading(true);
    try {
      await deliveryAPI.reportIssue(issueDialog.orderId, issueForm);
      toast.success('Issue reported');
      setIssueDialog({ open: false, orderId: null });
      setIssueForm({ issue_type: '', description: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to report issue');
    } finally {
      setActionLoading(false);
    }
  };

  const openGoogleMaps = (lat, lng, label) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'ready_for_pickup': return 'bg-yellow-100 text-yellow-800';
      case 'picked_up': return 'bg-blue-100 text-blue-800';
      case 'out_for_delivery': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      'ready_for_pickup': 'Ready for Pickup',
      'picked_up': 'Picked Up',
      'out_for_delivery': 'Out for Delivery',
      'delivered': 'Delivered'
    };
    return labels[status] || status;
  };

  const getNextAction = (order) => {
    if (!order.delivery_partner_id) {
      return { label: 'Accept Delivery', action: 'accept', color: 'bg-[#0F62FE]' };
    }
    switch (order.status) {
      case 'ready_for_pickup':
        return { label: 'Mark Picked Up', action: 'pickup', color: 'bg-blue-600' };
      case 'picked_up':
        return { label: 'Start Delivery', action: 'out_for_delivery', color: 'bg-purple-600' };
      case 'out_for_delivery':
        return { label: 'Mark Delivered', action: 'delivered', color: 'bg-green-600' };
      default:
        return null;
    }
  };

  const availableOrders = orders.filter(o => !o.delivery_partner_id && o.status === 'ready_for_pickup');
  const myOrders = orders.filter(o => o.delivery_partner_id);

  return (
    <div className="mobile-container bg-[#F4F7F6] min-h-screen pb-6">
      {/* Header */}
      <div className="sticky-header bg-white px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-[#0F62FE]" />
            <div>
              <h1 className="medilo-logo-sm">MEDILO</h1>
              <p className="text-xs text-gray-500">Hi, {user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchOrders} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={logout}
              className="text-red-600"
              data-testid="logout-btn"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Available Orders */}
        {availableOrders.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Available for Pickup ({availableOrders.length})
            </h2>
            <div className="space-y-3">
              {availableOrders.map((order) => (
                <Card 
                  key={order.id} 
                  className="card-hover"
                  data-testid={`available-order-${order.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-xs text-gray-500 mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                        <Badge className={getStatusBadgeClass(order.status)}>
                          {getStatusLabel(order.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400">{order.item_count} item(s)</p>
                    </div>

                    {/* Pharmacy Info */}
                    <div className="mb-3 p-2 bg-blue-50 rounded">
                      <p className="text-xs text-blue-600 font-medium">PICKUP FROM</p>
                      <p className="text-sm font-medium">{order.pharmacy_name}</p>
                      <p className="text-xs text-gray-600">{order.pharmacy_address}</p>
                      {order.pharmacy_latitude && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-1 h-7 text-xs text-blue-600"
                          onClick={() => openGoogleMaps(order.pharmacy_latitude, order.pharmacy_longitude, 'Pharmacy')}
                        >
                          <Navigation className="h-3 w-3 mr-1" />
                          Navigate
                        </Button>
                      )}
                    </div>

                    {/* Delivery Address */}
                    <div className="mb-3 p-2 bg-green-50 rounded">
                      <p className="text-xs text-green-600 font-medium">DELIVER TO</p>
                      <p className="text-sm">{order.delivery_address}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-7 text-xs text-green-600"
                        onClick={() => openGoogleMaps(order.latitude, order.longitude, 'Customer')}
                      >
                        <Navigation className="h-3 w-3 mr-1" />
                        Navigate
                      </Button>
                    </div>

                    <Button
                      className="w-full bg-[#0F62FE] hover:bg-[#0353E9]"
                      onClick={() => handleAcceptDelivery(order.id)}
                      disabled={actionLoading}
                      data-testid={`accept-delivery-${order.id}`}
                    >
                      {actionLoading ? <div className="spinner h-4 w-4" /> : 'Accept Delivery'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* My Active Orders */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Truck className="h-4 w-4" />
            My Deliveries ({myOrders.length})
          </h2>

          {myOrders.length === 0 ? (
            <Card className="p-8 text-center">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No active deliveries</p>
              <p className="text-xs text-gray-400 mt-1">Accept orders from the list above</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {myOrders.map((order) => {
                const nextAction = getNextAction(order);
                return (
                  <Card 
                    key={order.id} 
                    className="card-hover cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                    data-testid={`my-order-${order.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-xs text-gray-500 mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                          <Badge className={getStatusBadgeClass(order.status)}>
                            {getStatusLabel(order.status)}
                          </Badge>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{order.delivery_address}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-4 w-4" />
                        <span>{order.customer_phone}</span>
                      </div>

                      {nextAction && order.status !== 'delivered' && (
                        <Button
                          className={`w-full mt-3 ${nextAction.color}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(order.id, nextAction.action);
                          }}
                          disabled={actionLoading}
                          data-testid={`action-${order.id}`}
                        >
                          {actionLoading ? <div className="spinner h-4 w-4" /> : nextAction.label}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Empty State */}
        {orders.length === 0 && !loading && (
          <div className="text-center py-12">
            <Truck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700">No Orders Available</h3>
            <p className="text-sm text-gray-500 mt-1">Pull down to refresh</p>
          </div>
        )}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="mono text-sm">#{selectedOrder.id.slice(0, 8).toUpperCase()}</p>
                <Badge className={getStatusBadgeClass(selectedOrder.status)}>
                  {getStatusLabel(selectedOrder.status)}
                </Badge>
              </div>

              {/* Pharmacy Details */}
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 font-medium mb-1">PICKUP LOCATION</p>
                <p className="font-medium">{selectedOrder.pharmacy_name}</p>
                <p className="text-sm text-gray-600">{selectedOrder.pharmacy_address}</p>
                {selectedOrder.pharmacy_phone && (
                  <a 
                    href={`tel:${selectedOrder.pharmacy_phone}`}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 mt-2"
                  >
                    <Phone className="h-3 w-3" />
                    {selectedOrder.pharmacy_phone}
                  </a>
                )}
                {selectedOrder.pharmacy_latitude && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => openGoogleMaps(selectedOrder.pharmacy_latitude, selectedOrder.pharmacy_longitude, 'Pharmacy')}
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Open in Maps
                  </Button>
                )}
              </div>

              {/* Delivery Details */}
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-green-600 font-medium mb-1">DELIVERY LOCATION</p>
                <p className="font-medium">{selectedOrder.customer_name}</p>
                <p className="text-sm text-gray-600">{selectedOrder.delivery_address}</p>
                <a 
                  href={`tel:${selectedOrder.customer_phone}`}
                  className="inline-flex items-center gap-1 text-sm text-green-600 mt-2"
                >
                  <Phone className="h-3 w-3" />
                  {selectedOrder.customer_phone}
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => openGoogleMaps(selectedOrder.latitude, selectedOrder.longitude, 'Customer')}
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Open in Maps
                </Button>
              </div>

              {/* Order Info */}
              <div className="text-sm text-gray-500">
                <p>Items: {selectedOrder.item_count}</p>
                <p>Created: {formatDateTime(selectedOrder.created_at)}</p>
              </div>

              {/* Actions */}
              {selectedOrder.status !== 'delivered' && (
                <div className="space-y-2">
                  {getNextAction(selectedOrder) && (
                    <Button
                      className={`w-full ${getNextAction(selectedOrder).color}`}
                      onClick={() => handleAction(selectedOrder.id, getNextAction(selectedOrder).action)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <div className="spinner h-4 w-4" /> : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {getNextAction(selectedOrder).label}
                        </>
                      )}
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    className="w-full text-red-600 border-red-200"
                    onClick={() => {
                      setIssueDialog({ open: true, orderId: selectedOrder.id });
                      setSelectedOrder(null);
                    }}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Report Issue
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Report Issue Dialog */}
      <Dialog open={issueDialog.open} onOpenChange={(open) => !open && setIssueDialog({ open: false, orderId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Issue Type</Label>
              <Select
                value={issueForm.issue_type}
                onValueChange={(v) => setIssueForm({ ...issueForm, issue_type: v })}
              >
                <SelectTrigger data-testid="issue-type-select">
                  <SelectValue placeholder="Select issue type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer_unavailable">Customer Unavailable</SelectItem>
                  <SelectItem value="wrong_address">Wrong Address</SelectItem>
                  <SelectItem value="pharmacy_issue">Pharmacy Issue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={issueForm.description}
                onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                placeholder="Describe the issue..."
                rows={3}
                data-testid="issue-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialog({ open: false, orderId: null })}>
              Cancel
            </Button>
            <Button
              onClick={handleReportIssue}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
              data-testid="submit-issue"
            >
              {actionLoading ? <div className="spinner h-4 w-4" /> : 'Submit Issue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
