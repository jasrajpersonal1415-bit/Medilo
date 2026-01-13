import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { opsAPI, medicineAPI, pharmacyAPI, authAPI, deliveryAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../../components/ui/dialog';
import { 
  LogOut, Package, Users, Building2, Pill, Activity, 
  Plus, Eye, Clock, ChevronDown, Truck
} from 'lucide-react';
import { 
  formatDateTime, getStatusClass, getStatusName, 
  getBucketClass, getBucketName 
} from '../../lib/utils';
import { toast } from 'sonner';

export default function OpsDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderTimeline, setOrderTimeline] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Dialog states
  const [medicineDialog, setMedicineDialog] = useState({ open: false, data: null });
  const [pharmacyDialog, setPharmacyDialog] = useState({ open: false, data: null });
  const [staffDialog, setStaffDialog] = useState({ open: false });
  const [deliveryDialog, setDeliveryDialog] = useState({ open: false });
  const [timelineDialog, setTimelineDialog] = useState({ open: false });
  const [dialogLoading, setDialogLoading] = useState(false);

  // Form states
  const [medicineForm, setMedicineForm] = useState({
    name: '', generic_name: '', manufacturer: '', bucket: 'OTC', strength: '', form: '', pack_size: '', price: '', description: ''
  });
  const [pharmacyForm, setPharmacyForm] = useState({
    name: '', license_number: '', address: '', city: '', pincode: '', phone: '', email: ''
  });
  const [staffForm, setStaffForm] = useState({
    name: '', email: '', password: '', role: 'pharmacy_staff', pharmacy_id: ''
  });
  const [deliveryForm, setDeliveryForm] = useState({
    name: '', phone: ''
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'orders':
          const ordersRes = await opsAPI.getOrders();
          setOrders(ordersRes.data);
          break;
        case 'medicines':
          const medsRes = await medicineAPI.getAll();
          setMedicines(medsRes.data);
          break;
        case 'pharmacies':
          const pharmsRes = await pharmacyAPI.getAll();
          setPharmacies(pharmsRes.data);
          break;
        case 'users':
          const usersRes = await opsAPI.getUsers();
          setUsers(usersRes.data);
          break;
        case 'audit':
          const logsRes = await opsAPI.getAuditLogs({ limit: 200 });
          setAuditLogs(logsRes.data);
          break;
      }
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const viewOrderTimeline = async (order) => {
    setSelectedOrder(order);
    try {
      const res = await opsAPI.getOrderTimeline(order.id);
      setOrderTimeline(res.data);
      setTimelineDialog({ open: true });
    } catch (err) {
      toast.error('Failed to load timeline');
    }
  };

  const handleCreateMedicine = async () => {
    setDialogLoading(true);
    try {
      await medicineAPI.create(medicineForm);
      toast.success('Medicine created');
      setMedicineDialog({ open: false, data: null });
      setMedicineForm({ name: '', generic_name: '', manufacturer: '', bucket: 'OTC', strength: '', form: '', description: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create medicine');
    } finally {
      setDialogLoading(false);
    }
  };

  const handleCreatePharmacy = async () => {
    setDialogLoading(true);
    try {
      await pharmacyAPI.create(pharmacyForm);
      toast.success('Pharmacy created');
      setPharmacyDialog({ open: false, data: null });
      setPharmacyForm({ name: '', license_number: '', address: '', city: '', pincode: '', phone: '', email: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create pharmacy');
    } finally {
      setDialogLoading(false);
    }
  };

  const handleCreateStaff = async () => {
    setDialogLoading(true);
    try {
      await authAPI.staffRegister(staffForm);
      toast.success('Staff account created');
      setStaffDialog({ open: false });
      setStaffForm({ name: '', email: '', password: '', role: 'pharmacy_staff', pharmacy_id: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create staff');
    } finally {
      setDialogLoading(false);
    }
  };

  const handleCreateDeliveryPartner = async () => {
    setDialogLoading(true);
    try {
      await deliveryAPI.register(deliveryForm);
      toast.success('Delivery partner created');
      setDeliveryDialog({ open: false });
      setDeliveryForm({ name: '', phone: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create delivery partner');
    } finally {
      setDialogLoading(false);
    }
  };

  const toggleUserStatus = async (userId) => {
    try {
      await opsAPI.toggleUserActive(userId);
      toast.success('User status updated');
      loadData();
    } catch (err) {
      toast.error('Failed to update user');
    }
  };

  return (
    <div className="dashboard-shell">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="mb-8">
          <div className="medilo-logo">MEDILO</div>
          <p className="text-xs text-gray-500 mt-1">Operations Panel</p>
        </div>

        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab('orders')}
            className={`nav-item w-full text-left ${activeTab === 'orders' ? 'active' : ''}`}
          >
            <Package className="h-5 w-5" />
            <span>Orders</span>
          </button>
          <button
            onClick={() => setActiveTab('medicines')}
            className={`nav-item w-full text-left ${activeTab === 'medicines' ? 'active' : ''}`}
          >
            <Pill className="h-5 w-5" />
            <span>Medicines</span>
          </button>
          <button
            onClick={() => setActiveTab('pharmacies')}
            className={`nav-item w-full text-left ${activeTab === 'pharmacies' ? 'active' : ''}`}
          >
            <Building2 className="h-5 w-5" />
            <span>Pharmacies</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`nav-item w-full text-left ${activeTab === 'users' ? 'active' : ''}`}
          >
            <Users className="h-5 w-5" />
            <span>Users</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`nav-item w-full text-left ${activeTab === 'audit' ? 'active' : ''}`}
          >
            <Activity className="h-5 w-5" />
            <span>Audit Logs</span>
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
        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-semibold">All Orders</h1>
                <p className="text-gray-500">Monitor and view order details (Read-only)</p>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><div className="spinner" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Items</th>
                      <th>Pharmacy</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="mono text-xs">{order.id.slice(0, 8).toUpperCase()}</td>
                        <td>
                          <p className="font-medium">{order.customer_name}</p>
                          <p className="text-xs text-gray-500">{order.customer_phone}</p>
                        </td>
                        <td>
                          <Badge className={getStatusClass(order.status)}>
                            {getStatusName(order.status)}
                          </Badge>
                        </td>
                        <td>{order.items.length} item(s)</td>
                        <td>{order.pharmacy_name || '-'}</td>
                        <td className="text-xs">{formatDateTime(order.created_at)}</td>
                        <td>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => viewOrderTimeline(order)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Timeline
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Medicines Tab */}
        {activeTab === 'medicines' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-semibold">Medicines</h1>
                <p className="text-gray-500">Manage medicine catalog</p>
              </div>
              <Button 
                onClick={() => setMedicineDialog({ open: true, data: null })}
                className="bg-[#0F62FE] hover:bg-[#0353E9]"
                data-testid="add-medicine-btn"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Medicine
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><div className="spinner" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Generic Name</th>
                      <th>Category</th>
                      <th>Strength</th>
                      <th>Form</th>
                      <th>Manufacturer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicines.map((med) => (
                      <tr key={med.id}>
                        <td className="font-medium">{med.name}</td>
                        <td>{med.generic_name}</td>
                        <td>
                          <Badge className={getBucketClass(med.bucket)}>
                            {getBucketName(med.bucket)}
                          </Badge>
                        </td>
                        <td>{med.strength}</td>
                        <td>{med.form}</td>
                        <td>{med.manufacturer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Pharmacies Tab */}
        {activeTab === 'pharmacies' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-semibold">Pharmacies</h1>
                <p className="text-gray-500">Manage registered pharmacies</p>
              </div>
              <Button 
                onClick={() => setPharmacyDialog({ open: true, data: null })}
                className="bg-[#0F62FE] hover:bg-[#0353E9]"
                data-testid="add-pharmacy-btn"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Pharmacy
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><div className="spinner" /></div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pharmacies.map((pharmacy) => (
                  <Card key={pharmacy.id} className="card-hover">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{pharmacy.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-gray-500 mb-1">License: {pharmacy.license_number}</p>
                      <p className="text-sm text-gray-700">{pharmacy.address}</p>
                      <p className="text-sm text-gray-700">{pharmacy.city} - {pharmacy.pincode}</p>
                      <p className="text-sm text-gray-500 mt-2">{pharmacy.phone}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-semibold">Users</h1>
                <p className="text-gray-500">Manage all user accounts</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => setDeliveryDialog({ open: true })}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="add-delivery-btn"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Add Delivery Partner
                </Button>
                <Button 
                  onClick={() => setStaffDialog({ open: true })}
                  className="bg-[#0F62FE] hover:bg-[#0353E9]"
                  data-testid="add-staff-btn"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Staff
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><div className="spinner" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Contact</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="font-medium">{u.name}</td>
                        <td>
                          <p>{u.email || u.phone}</p>
                        </td>
                        <td>
                          <Badge variant="outline" className="capitalize">{u.role.replace('_', ' ')}</Badge>
                        </td>
                        <td>
                          <Badge className={u.is_active ? 'badge-approved' : 'badge-rejected'}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="text-xs">{formatDateTime(u.created_at)}</td>
                        <td>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleUserStatus(u.id)}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold">Audit Logs</h1>
              <p className="text-gray-500">System activity trail</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><div className="spinner" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>User Role</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="text-xs mono">{formatDateTime(log.timestamp)}</td>
                        <td className="font-medium">{log.action}</td>
                        <td>
                          <span className="text-xs text-gray-500">{log.entity_type}</span>
                          <p className="mono text-xs">{log.entity_id.slice(0, 8)}</p>
                        </td>
                        <td>
                          <Badge variant="outline" className="capitalize">{log.user_role.replace('_', ' ')}</Badge>
                        </td>
                        <td className="text-xs text-gray-500">
                          {log.details ? JSON.stringify(log.details).slice(0, 50) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Medicine Dialog */}
      <Dialog open={medicineDialog.open} onOpenChange={(open) => !open && setMedicineDialog({ open: false, data: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Medicine</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={medicineForm.name}
                  onChange={(e) => setMedicineForm({ ...medicineForm, name: e.target.value })}
                  placeholder="e.g., Crocin 500"
                  data-testid="medicine-name"
                />
              </div>
              <div>
                <Label>Generic Name</Label>
                <Input
                  value={medicineForm.generic_name}
                  onChange={(e) => setMedicineForm({ ...medicineForm, generic_name: e.target.value })}
                  placeholder="e.g., Paracetamol"
                  data-testid="medicine-generic"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select
                  value={medicineForm.bucket}
                  onValueChange={(v) => setMedicineForm({ ...medicineForm, bucket: v })}
                >
                  <SelectTrigger data-testid="medicine-bucket">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OTC">OTC (Green)</SelectItem>
                    <SelectItem value="SCHEDULE_H">Schedule H (Yellow)</SelectItem>
                    <SelectItem value="SCHEDULE_H1">Schedule H1 (Red)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Manufacturer</Label>
                <Input
                  value={medicineForm.manufacturer}
                  onChange={(e) => setMedicineForm({ ...medicineForm, manufacturer: e.target.value })}
                  placeholder="e.g., GSK"
                  data-testid="medicine-manufacturer"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Strength</Label>
                <Input
                  value={medicineForm.strength}
                  onChange={(e) => setMedicineForm({ ...medicineForm, strength: e.target.value })}
                  placeholder="e.g., 500mg"
                  data-testid="medicine-strength"
                />
              </div>
              <div>
                <Label>Form</Label>
                <Input
                  value={medicineForm.form}
                  onChange={(e) => setMedicineForm({ ...medicineForm, form: e.target.value })}
                  placeholder="e.g., Tablet"
                  data-testid="medicine-form"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMedicineDialog({ open: false, data: null })}>Cancel</Button>
            <Button 
              onClick={handleCreateMedicine} 
              disabled={dialogLoading}
              className="bg-[#0F62FE] hover:bg-[#0353E9]"
              data-testid="save-medicine"
            >
              {dialogLoading ? <div className="spinner h-4 w-4" /> : 'Save Medicine'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pharmacy Dialog */}
      <Dialog open={pharmacyDialog.open} onOpenChange={(open) => !open && setPharmacyDialog({ open: false, data: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Pharmacy</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pharmacy Name</Label>
                <Input
                  value={pharmacyForm.name}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, name: e.target.value })}
                  placeholder="e.g., Apollo Pharmacy"
                  data-testid="pharmacy-name"
                />
              </div>
              <div>
                <Label>License Number</Label>
                <Input
                  value={pharmacyForm.license_number}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, license_number: e.target.value })}
                  placeholder="e.g., DL-2023-1234"
                  data-testid="pharmacy-license"
                />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                value={pharmacyForm.address}
                onChange={(e) => setPharmacyForm({ ...pharmacyForm, address: e.target.value })}
                placeholder="Full address"
                data-testid="pharmacy-address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City</Label>
                <Input
                  value={pharmacyForm.city}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, city: e.target.value })}
                  placeholder="e.g., Mumbai"
                  data-testid="pharmacy-city"
                />
              </div>
              <div>
                <Label>Pincode</Label>
                <Input
                  value={pharmacyForm.pincode}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, pincode: e.target.value })}
                  placeholder="e.g., 400001"
                  data-testid="pharmacy-pincode"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input
                  value={pharmacyForm.phone}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, phone: e.target.value })}
                  placeholder="e.g., 9876543210"
                  data-testid="pharmacy-phone"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={pharmacyForm.email}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, email: e.target.value })}
                  placeholder="e.g., pharmacy@example.com"
                  data-testid="pharmacy-email"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPharmacyDialog({ open: false, data: null })}>Cancel</Button>
            <Button 
              onClick={handleCreatePharmacy} 
              disabled={dialogLoading}
              className="bg-[#0F62FE] hover:bg-[#0353E9]"
              data-testid="save-pharmacy"
            >
              {dialogLoading ? <div className="spinner h-4 w-4" /> : 'Save Pharmacy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Dialog */}
      <Dialog open={staffDialog.open} onOpenChange={(open) => !open && setStaffDialog({ open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Staff Account</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={staffForm.name}
                onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                placeholder="Enter name"
                data-testid="staff-name"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                placeholder="Enter email"
                data-testid="staff-email"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={staffForm.password}
                onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                placeholder="Set password"
                data-testid="staff-password"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={staffForm.role}
                onValueChange={(v) => setStaffForm({ ...staffForm, role: v })}
              >
                <SelectTrigger data-testid="staff-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pharmacist">Pharmacist</SelectItem>
                  <SelectItem value="pharmacy_staff">Pharmacy Staff</SelectItem>
                  <SelectItem value="ops">Operations</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {staffForm.role === 'pharmacy_staff' && (
              <div>
                <Label>Pharmacy</Label>
                <Select
                  value={staffForm.pharmacy_id}
                  onValueChange={(v) => setStaffForm({ ...staffForm, pharmacy_id: v })}
                >
                  <SelectTrigger data-testid="staff-pharmacy">
                    <SelectValue placeholder="Select pharmacy" />
                  </SelectTrigger>
                  <SelectContent>
                    {pharmacies.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStaffDialog({ open: false })}>Cancel</Button>
            <Button 
              onClick={handleCreateStaff} 
              disabled={dialogLoading}
              className="bg-[#0F62FE] hover:bg-[#0353E9]"
              data-testid="save-staff"
            >
              {dialogLoading ? <div className="spinner h-4 w-4" /> : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Timeline Dialog */}
      <Dialog open={timelineDialog.open} onOpenChange={(open) => !open && setTimelineDialog({ open: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order Timeline</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {selectedOrder && (
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <p className="font-medium">Order #{selectedOrder.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-sm text-gray-500">{selectedOrder.customer_name}</p>
              </div>
            )}
            <div className="timeline">
              {orderTimeline.map((log, idx) => (
                <div key={log.id} className="timeline-item completed">
                  <p className="font-medium text-sm">{log.action}</p>
                  <p className="text-xs text-gray-500">{log.user_role}</p>
                  <p className="text-xs text-gray-400">{formatDateTime(log.timestamp)}</p>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimelineDialog({ open: false })}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Partner Dialog */}
      <Dialog open={deliveryDialog.open} onOpenChange={(open) => !open && setDeliveryDialog({ open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Delivery Partner</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={deliveryForm.name}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, name: e.target.value })}
                placeholder="Enter name"
                data-testid="delivery-name"
              />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input
                type="tel"
                value={deliveryForm.phone}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                placeholder="10-digit mobile number"
                maxLength={10}
                data-testid="delivery-phone"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliveryDialog({ open: false })}>Cancel</Button>
            <Button 
              onClick={handleCreateDeliveryPartner} 
              disabled={dialogLoading || !deliveryForm.name || !deliveryForm.phone}
              className="bg-green-600 hover:bg-green-700"
              data-testid="save-delivery"
            >
              {dialogLoading ? <div className="spinner h-4 w-4" /> : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
