import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../../components/ui/select';
import { 
  ArrowLeft, Plus, MapPin, Pencil, Trash2, Star, Home, Briefcase, Building, MoreHorizontal
} from 'lucide-react';
import { toast } from 'sonner';

const LABEL_CONFIG = {
  Home: { icon: Home, color: '#3B82F6' },
  Work: { icon: Briefcase, color: '#10B981' },
  Hostel: { icon: Building, color: '#F59E0B' },
  Other: { icon: MoreHorizontal, color: '#8B5CF6' },
};

const EMPTY_FORM = {
  label: 'Home', full_name: '', mobile: '', house_flat: '',
  street: '', landmark: '', city: '', state: '', pincode: '', is_default: false
};

export default function AddressBook() {
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAddresses(); }, []);

  const fetchAddresses = async () => {
    try {
      const res = await customerAPI.getAddresses();
      setAddresses(res.data);
    } catch (err) {
      toast.error('Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (addr) => {
    setForm({
      label: addr.label || 'Home',
      full_name: addr.full_name || '',
      mobile: addr.mobile || '',
      house_flat: addr.house_flat || '',
      street: addr.street || '',
      landmark: addr.landmark || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
      is_default: addr.is_default || false,
    });
    setEditId(addr.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.mobile.trim() || !form.house_flat.trim() || !form.city.trim() || !form.state.trim() || !form.pincode.trim()) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await customerAPI.updateAddress(editId, form);
        toast.success('Address updated');
      } else {
        await customerAPI.createAddress(form);
        toast.success('Address added');
      }
      setDialogOpen(false);
      fetchAddresses();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await customerAPI.deleteAddress(id);
      toast.success('Address deleted');
      fetchAddresses();
    } catch (err) {
      toast.error('Failed to delete address');
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await customerAPI.setDefaultAddress(id);
      toast.success('Default address updated');
      fetchAddresses();
    } catch (err) {
      toast.error('Failed to set default');
    }
  };

  return (
    <div className="mobile-container bg-[#F4F7F6] min-h-screen pb-6">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/profile')} data-testid="addresses-back-btn">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold">Address Book</h1>
        </div>
        <Button size="sm" onClick={openAdd} className="bg-[#0F62FE] hover:bg-[#0353E9] h-8" data-testid="add-address-btn">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : addresses.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-500">No Saved Addresses</h3>
            <p className="text-sm text-gray-400 mt-1">Add your first delivery address</p>
            <Button onClick={openAdd} className="mt-4 bg-[#0F62FE] hover:bg-[#0353E9]" data-testid="add-first-address-btn">
              <Plus className="h-4 w-4 mr-2" /> Add Address
            </Button>
          </div>
        ) : (
          addresses.map((addr) => {
            const cfg = LABEL_CONFIG[addr.label] || LABEL_CONFIG.Other;
            const IconComp = cfg.icon;
            return (
              <div 
                key={addr.id} 
                className={`bg-white rounded-xl p-4 shadow-sm border-2 ${addr.is_default ? 'border-[#0F62FE]' : 'border-transparent'}`}
                data-testid={`address-card-${addr.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mt-0.5 shrink-0" style={{ backgroundColor: cfg.color + '15' }}>
                    <IconComp className="h-4 w-4" style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-800">{addr.label}</span>
                      {addr.is_default && (
                        <Badge className="bg-[#0F62FE]/10 text-[#0F62FE] text-[10px] border-0">Default</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-700">{addr.full_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {addr.house_flat}, {addr.street}
                      {addr.landmark && `, ${addr.landmark}`}
                    </p>
                    <p className="text-xs text-gray-500">{addr.city}, {addr.state} - {addr.pincode}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{addr.mobile}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                  {!addr.is_default && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSetDefault(addr.id)} data-testid={`set-default-${addr.id}`}>
                      <Star className="h-3 w-3 mr-1" /> Set Default
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(addr)} data-testid={`edit-address-${addr.id}`}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 hover:text-red-700" onClick={() => handleDelete(addr.id)} data-testid={`delete-address-${addr.id}`}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Address' : 'Add Address'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Label</Label>
              <Select value={form.label} onValueChange={(v) => setForm({ ...form, label: v })}>
                <SelectTrigger data-testid="address-label-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Home">Home</SelectItem>
                  <SelectItem value="Work">Work</SelectItem>
                  <SelectItem value="Hostel">Hostel</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Full Name *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Full name" data-testid="address-fullname" />
              </div>
              <div>
                <Label>Mobile *</Label>
                <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="Phone number" data-testid="address-mobile" />
              </div>
            </div>
            <div>
              <Label>House/Flat Number *</Label>
              <Input value={form.house_flat} onChange={(e) => setForm({ ...form, house_flat: e.target.value })} placeholder="House/Flat no." data-testid="address-house" />
            </div>
            <div>
              <Label>Street *</Label>
              <Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} placeholder="Street name" data-testid="address-street" />
            </div>
            <div>
              <Label>Landmark</Label>
              <Input value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} placeholder="Near..." data-testid="address-landmark" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>City *</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" data-testid="address-city" />
              </div>
              <div>
                <Label>State *</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" data-testid="address-state" />
              </div>
              <div>
                <Label>Pincode *</Label>
                <Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} placeholder="PIN" data-testid="address-pincode" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#0F62FE] hover:bg-[#0353E9]" data-testid="save-address-btn">
              {saving ? 'Saving...' : editId ? 'Update' : 'Add Address'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
