import React, { useState, useEffect, useCallback } from 'react';
import { opsAPI } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../../../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '../../../components/ui/dialog';
import {
  Users, Search, Eye, MapPin, Heart, FileText, ClipboardList,
  Headphones, Bell, BarChart3, Send, IndianRupee, Package, TrendingUp, X, Phone
} from 'lucide-react';
import { formatCurrency, formatDateTime, getStatusName, getStatusClass } from '../../../lib/utils';
import { toast } from 'sonner';

export default function NotificationsTab() {
  return (
    <div className="max-w-lg">
      <p className="text-sm text-gray-500 mb-4">Send a broadcast notification to all active customers, or notify a single customer from their detail view.</p>
      <SendNotificationForm broadcast />
    </div>
  );
}


function SendNotificationForm({ broadcast, customer, onSent }) {
  const [form, setForm] = useState({ title: '', message: '', type: 'system' });
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setSending(true);
    try {
      const payload = broadcast
        ? { broadcast: true, ...form }
        : { customer_id: customer.id, ...form };
      const res = await opsAPI.sendNotification(payload);
      toast.success(res.data.message);
      setForm({ title: '', message: '', type: 'system' });
      onSent && onSent();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="notification-form">
      <div>
        <Label>Type</Label>
        <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
          <SelectTrigger data-testid="notif-type-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="system">System / Announcement</SelectItem>
            <SelectItem value="promo">Promotion</SelectItem>
            <SelectItem value="order_update">Order Update</SelectItem>
            <SelectItem value="delivery_update">Delivery Update</SelectItem>
            <SelectItem value="prescription_update">Prescription Update</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Title</Label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Notification title" data-testid="notif-title-input" />
      </div>
      <div>
        <Label>Message</Label>
        <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Notification message" rows={3} data-testid="notif-message-input" />
      </div>
      <Button onClick={handleSend} disabled={sending} className="bg-[#0F62FE] hover:bg-[#0353E9]" data-testid="send-notification-btn">
        <Send className="h-4 w-4 mr-1.5" />
        {sending ? 'Sending...' : broadcast ? 'Send to All Customers' : 'Send Notification'}
      </Button>
    </div>
  );
}


export function SendNotificationDialog({ customer, onClose }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="send-notif-dialog">
        <DialogHeader>
          <DialogTitle>Notify {customer?.name || 'Customer'}</DialogTitle>
          <DialogDescription>Send a direct notification to {customer?.phone}.</DialogDescription>
        </DialogHeader>
        <SendNotificationForm customer={customer} onSent={onClose} />
      </DialogContent>
    </Dialog>
  );
}

