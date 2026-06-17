import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { customerAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../../components/ui/dialog';
import { 
  ArrowLeft, User, MapPin, Heart, ShoppingCart, ClipboardList,
  ChevronRight, LogOut, Package, IndianRupee, Calendar,
  Pencil, Home, FileText, Headphones
} from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await customerAPI.getProfile();
      setProfile(res.data);
      setEditForm({ name: res.data.name || '', email: res.data.email || '' });
    } catch (err) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await customerAPI.updateProfile(editForm);
      toast.success('Profile updated');
      setEditOpen(false);
      fetchProfile();
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    {
      section: 'My Activity',
      items: [
        { icon: ClipboardList, label: 'My Orders', desc: `${profile?.total_orders || 0} orders`, path: '/orders', color: '#3B82F6' },
        { icon: MapPin, label: 'Address Book', desc: `${profile?.address_count || 0} saved`, path: '/profile/addresses', color: '#10B981' },
        { icon: Heart, label: 'Wishlist', desc: `${profile?.wishlist_count || 0} items`, path: '/profile/wishlist', color: '#EC4899' },
        { icon: FileText, label: 'My Prescriptions', desc: 'Uploaded prescriptions', path: '/profile/prescriptions', color: '#14B8A6' },
      ]
    },
    {
      section: 'Help',
      items: [
        { icon: Headphones, label: 'Customer Support', desc: 'Raise a ticket or contact us', path: '/profile/support', color: '#F59E0B' },
      ]
    },
  ];

  if (loading) {
    return (
      <div className="mobile-container bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="mobile-container bg-[#F4F7F6] min-h-screen pb-6">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-30">
        <button onClick={() => navigate('/')} data-testid="profile-back-btn">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold">My Profile</h1>
      </div>

      {/* Profile Card */}
      <div className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm" data-testid="profile-card">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#0F62FE]/10 flex items-center justify-center shrink-0">
            <User className="h-7 w-7 text-[#0F62FE]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate" data-testid="profile-name">
              {profile?.name || 'Customer'}
            </h2>
            <p className="text-sm text-gray-500" data-testid="profile-phone">{profile?.phone}</p>
            {profile?.email && (
              <p className="text-xs text-gray-400 truncate">{profile.email}</p>
            )}
          </div>
          <button 
            onClick={() => setEditOpen(true)} 
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
            data-testid="edit-profile-btn"
          >
            <Pencil className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t">
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{profile?.total_orders || 0}</p>
            <p className="text-[11px] text-gray-500">Orders</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{formatCurrency(profile?.total_spend || 0)}</p>
            <p className="text-[11px] text-gray-500">Spent</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{profile?.address_count || 0}</p>
            <p className="text-[11px] text-gray-500">Addresses</p>
          </div>
        </div>
      </div>

      {/* Menu Sections */}
      <div className="mt-4 space-y-3 px-4">
        {menuItems.map((section) => (
          <div key={section.section} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 pt-4 pb-2">{section.section}</p>
            {section.items.map((item, idx) => (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center gap-3.5 px-5 py-3.5 hover:bg-gray-50 transition-colors ${
                  idx < section.items.length - 1 ? 'border-b border-gray-50' : ''
                }`}
                data-testid={`menu-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: item.color + '15' }}>
                  <item.icon className="h-4.5 w-4.5" style={{ color: item.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </Link>
            ))}
          </div>
        ))}
      </div>

      {/* Logout */}
      <div className="mx-4 mt-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-white rounded-2xl shadow-sm text-red-500 font-medium text-sm hover:bg-red-50 transition-colors"
          data-testid="profile-logout-btn"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>

      <p className="text-center text-[11px] text-gray-300 mt-4">MEDILO v1.0</p>

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Your name"
                data-testid="edit-name-input"
              />
            </div>
            <div>
              <Label>Email (optional)</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="your@email.com"
                data-testid="edit-email-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveProfile} 
              disabled={saving || !editForm.name.trim()}
              className="bg-[#0F62FE] hover:bg-[#0353E9]"
              data-testid="save-profile-btn"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
