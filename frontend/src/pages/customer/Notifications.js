import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  ArrowLeft, Bell, Package, Truck, FileText, CheckCircle, 
  Trash2, CheckCheck, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const TYPE_CONFIG = {
  order_update: { icon: Package, color: '#3B82F6', bg: '#EFF6FF' },
  delivery_update: { icon: Truck, color: '#10B981', bg: '#ECFDF5' },
  prescription_update: { icon: FileText, color: '#14B8A6', bg: '#F0FDFA' },
  promo: { icon: Bell, color: '#F59E0B', bg: '#FFFBEB' },
  system: { icon: AlertCircle, color: '#8B5CF6', bg: '#F5F3FF' },
};

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    try {
      const res = await customerAPI.getNotifications();
      setNotifications(res.data);
    } catch (err) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await customerAPI.markRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await customerAPI.markAllRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      toast.success('All marked as read');
    } catch (err) {
      toast.error('Failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      await customerAPI.deleteNotification(id);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleClearAll = async () => {
    try {
      await customerAPI.clearNotifications();
      setNotifications([]);
      toast.success('All notifications cleared');
    } catch (err) {
      toast.error('Failed');
    }
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = now - d;
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="mobile-container bg-[#F4F7F6] min-h-screen pb-6">
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/profile')} data-testid="notifications-back-btn">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold">Notifications</h1>
          {unreadCount > 0 && (
            <Badge className="bg-[#0F62FE] text-white text-[10px]">{unreadCount}</Badge>
          )}
        </div>
        {notifications.length > 0 && (
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleMarkAllRead} data-testid="mark-all-read-btn">
                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Read All
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={handleClearAll} data-testid="clear-all-btn">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          </div>
        )}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-500">No Notifications</h3>
            <p className="text-sm text-gray-400 mt-1">You're all caught up</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => {
              const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
              const IconComp = cfg.icon;
              return (
                <div
                  key={notif.id}
                  className={`bg-white rounded-xl p-3.5 shadow-sm flex gap-3 cursor-pointer transition-colors ${
                    !notif.is_read ? 'border-l-[3px] border-l-[#0F62FE]' : ''
                  }`}
                  onClick={() => {
                    if (!notif.is_read) handleMarkRead(notif.id);
                    if (notif.order_id) navigate(`/order/${notif.order_id}`);
                  }}
                  data-testid={`notification-${notif.id}`}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: cfg.bg }}>
                    <IconComp className="h-4 w-4" style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!notif.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{notif.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{formatDate(notif.created_at)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(notif.id); }}
                    className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50"
                    data-testid={`delete-notif-${notif.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
