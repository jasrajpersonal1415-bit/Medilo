import React, { useState, useEffect, useCallback } from 'react';
import { opsAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '../../components/ui/dialog';
import {
  Users, Search, Eye, MapPin, Heart, FileText, ClipboardList,
  Headphones, Bell, BarChart3, Send, IndianRupee, Package, TrendingUp, X, Phone
} from 'lucide-react';
import { formatCurrency, formatDateTime, getStatusName, getStatusClass } from '../../lib/utils';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const fileUrl = (path) => path ? `${BACKEND_URL}/api/files/${path}` : null;

const TICKET_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

const ticketStatusClass = (status) => {
  switch (status) {
    case 'Open': return 'bg-blue-100 text-blue-700';
    case 'In Progress': return 'bg-amber-100 text-amber-700';
    case 'Resolved': return 'bg-green-100 text-green-700';
    case 'Closed': return 'bg-gray-100 text-gray-600';
    default: return 'bg-gray-100 text-gray-600';
  }
};

export default function CustomerManagement() {
  const [subTab, setSubTab] = useState('customers');

  return (
    <div data-testid="customer-management">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-6 w-6 text-[#0F62FE]" />
        <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="customers" data-testid="subtab-customers">
            <Users className="h-4 w-4 mr-1.5" /> Customers
          </TabsTrigger>
          <TabsTrigger value="support" data-testid="subtab-support">
            <Headphones className="h-4 w-4 mr-1.5" /> Support
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="subtab-notifications">
            <Bell className="h-4 w-4 mr-1.5" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="subtab-analytics">
            <BarChart3 className="h-4 w-4 mr-1.5" /> Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers"><CustomersTab /></TabsContent>
        <TabsContent value="support"><SupportTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============== Customers Tab ============== */
function CustomersTab() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async (q) => {
    setLoading(true);
    try {
      const res = await opsAPI.listCustomers(q || undefined);
      setCustomers(res.data);
    } catch (err) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e) => {
    e.preventDefault();
    load(search.trim());
  };

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-4 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone or email"
            className="pl-9"
            data-testid="customer-search-input"
          />
        </div>
        <Button type="submit" className="bg-[#0F62FE] hover:bg-[#0353E9]" data-testid="customer-search-btn">Search</Button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 text-gray-500" data-testid="customers-empty">No customers found</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm" data-testid="customers-table">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-center px-4 py-3">Orders</th>
                <th className="text-right px-4 py-3">Spend</th>
                <th className="text-center px-4 py-3">Addr</th>
                <th className="text-center px-4 py-3">Wish</th>
                <th className="text-center px-4 py-3">Rx</th>
                <th className="text-center px-4 py-3">Tickets</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t hover:bg-gray-50" data-testid={`customer-row-${c.id}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.name || 'Unnamed'}</p>
                    {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.phone}</td>
                  <td className="px-4 py-3 text-center">{c.total_orders}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(c.total_spend)}</td>
                  <td className="px-4 py-3 text-center">{c.address_count}</td>
                  <td className="px-4 py-3 text-center">{c.wishlist_count}</td>
                  <td className="px-4 py-3 text-center">{c.prescription_count}</td>
                  <td className="px-4 py-3 text-center">
                    {c.open_tickets > 0
                      ? <Badge className="bg-amber-100 text-amber-700">{c.open_tickets}</Badge>
                      : <span className="text-gray-300">0</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button size="sm" variant="outline" onClick={() => setDetailId(c.id)} data-testid={`view-customer-${c.id}`}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailId && (
        <CustomerDetailDialog customerId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}

/* ============== Customer Detail Dialog ============== */
function CustomerDetailDialog({ customerId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await opsAPI.getCustomer(customerId);
        setData(res.data);
      } catch (err) {
        toast.error('Failed to load customer');
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [customerId, onClose]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-auto" data-testid="customer-detail-dialog">
        <DialogHeader>
          <DialogTitle>Customer Details</DialogTitle>
          <DialogDescription>Full account overview, orders, addresses, prescriptions and wishlist.</DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : (
          <div>
            {/* Profile header */}
            <div className="flex items-start justify-between bg-gray-50 rounded-xl p-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{data.profile.name || 'Unnamed'}</h3>
                <p className="text-sm text-gray-600 flex items-center gap-1.5 mt-1"><Phone className="h-3.5 w-3.5" />{data.profile.phone}</p>
                {data.profile.email && <p className="text-xs text-gray-400 mt-0.5">{data.profile.email}</p>}
                <p className="text-xs text-gray-400 mt-1">Joined {formatDateTime(data.profile.created_at)}</p>
              </div>
              <Button size="sm" className="bg-[#0F62FE] hover:bg-[#0353E9]" onClick={() => setNotifOpen(true)} data-testid="send-customer-notif-btn">
                <Bell className="h-4 w-4 mr-1.5" /> Notify
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
              <StatChip label="Orders" value={data.stats.total_orders} />
              <StatChip label="Spend" value={formatCurrency(data.stats.total_spend)} />
              <StatChip label="Addresses" value={data.stats.address_count} />
              <StatChip label="Wishlist" value={data.stats.wishlist_count} />
              <StatChip label="Rx" value={data.stats.prescription_count} />
              <StatChip label="Open Tickets" value={data.stats.open_tickets} />
            </div>

            <Tabs defaultValue="orders" className="mt-5">
              <TabsList>
                <TabsTrigger value="orders"><ClipboardList className="h-4 w-4 mr-1" />Orders</TabsTrigger>
                <TabsTrigger value="addresses"><MapPin className="h-4 w-4 mr-1" />Addresses</TabsTrigger>
                <TabsTrigger value="prescriptions"><FileText className="h-4 w-4 mr-1" />Prescriptions</TabsTrigger>
                <TabsTrigger value="wishlist"><Heart className="h-4 w-4 mr-1" />Wishlist</TabsTrigger>
              </TabsList>

              <TabsContent value="orders" className="mt-3">
                {data.orders.length === 0 ? <Empty text="No orders" /> : (
                  <div className="space-y-2">
                    {data.orders.map((o) => (
                      <div key={o.id} className="border rounded-lg p-3 flex items-center justify-between" data-testid={`detail-order-${o.id}`}>
                        <div>
                          <p className="text-sm font-medium">#{o.id.slice(0, 8)} · {o.items?.length || 0} item(s)</p>
                          <p className="text-xs text-gray-400">{formatDateTime(o.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatCurrency(o.total_amount || 0)}</p>
                          <span className={`status-badge text-[10px] ${getStatusClass(o.status)}`}>{getStatusName(o.status)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="addresses" className="mt-3">
                {data.addresses.length === 0 ? <Empty text="No addresses" /> : (
                  <div className="space-y-2">
                    {data.addresses.map((a) => (
                      <div key={a.id} className="border rounded-lg p-3" data-testid={`detail-address-${a.id}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{a.label}</span>
                          {a.is_default && <Badge className="bg-blue-100 text-blue-700 text-[10px]">Default</Badge>}
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{a.full_name} · {a.mobile}</p>
                        <p className="text-xs text-gray-500">{a.house_flat}, {a.street}{a.landmark ? `, ${a.landmark}` : ''}, {a.city}, {a.state} - {a.pincode}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="prescriptions" className="mt-3">
                {data.prescriptions.length === 0 ? <Empty text="No prescriptions" /> : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {data.prescriptions.map((p) => (
                      <a key={p.id} href={fileUrl(p.file_path)} target="_blank" rel="noreferrer"
                        className="border rounded-lg p-2 hover:shadow-md transition-shadow block" data-testid={`detail-rx-${p.id}`}>
                        {p.file_type === 'application/pdf' ? (
                          <div className="h-28 flex items-center justify-center bg-gray-50 rounded">
                            <FileText className="h-8 w-8 text-gray-400" />
                          </div>
                        ) : (
                          <img src={fileUrl(p.file_path)} alt={p.file_name} className="h-28 w-full object-cover rounded" />
                        )}
                        <p className="text-xs text-gray-600 truncate mt-1">{p.file_name}</p>
                        <p className="text-[10px] text-gray-400">{formatDateTime(p.created_at)}</p>
                      </a>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="wishlist" className="mt-3">
                {data.wishlist.length === 0 ? <Empty text="No wishlist items" /> : (
                  <div className="space-y-2">
                    {data.wishlist.map((w) => (
                      <div key={w.id} className="border rounded-lg p-3 flex items-center justify-between" data-testid={`detail-wish-${w.id}`}>
                        <div>
                          <p className="text-sm font-medium">{w.product_name}</p>
                          <p className="text-xs text-gray-400">{w.product_type}{w.manufacturer ? ` · ${w.manufacturer}` : ''}</p>
                        </div>
                        <p className="text-sm font-semibold">{formatCurrency(w.price)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>

      {notifOpen && (
        <SendNotificationDialog
          customer={data?.profile}
          onClose={() => setNotifOpen(false)}
        />
      )}
    </Dialog>
  );
}

/* ============== Support Tab ============== */
function SupportTab() {
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState(null);

  const load = useCallback(async (status) => {
    setLoading(true);
    try {
      const res = await opsAPI.listTickets(status && status !== 'all' ? status : undefined);
      setTickets(res.data);
    } catch (err) {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(statusFilter); }, [load, statusFilter]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Label className="text-sm">Filter:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" data-testid="ticket-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tickets</SelectItem>
            {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : tickets.length === 0 ? (
        <Empty text="No support tickets" />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm" data-testid="tickets-table">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Ticket</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Subject</th>
                <th className="text-left px-4 py-3">Updated</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t hover:bg-gray-50" data-testid={`ticket-row-${t.id}`}>
                  <td className="px-4 py-3 font-mono text-xs">{t.ticket_number}</td>
                  <td className="px-4 py-3">{t.customer_name || '—'}<br/><span className="text-xs text-gray-400">{t.customer_phone}</span></td>
                  <td className="px-4 py-3 text-gray-600">{t.category}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate">{t.subject}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(t.updated_at)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={ticketStatusClass(t.status)}>{t.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button size="sm" variant="outline" onClick={() => setActiveTicket(t.id)} data-testid={`open-ticket-${t.id}`}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTicket && (
        <TicketDialog
          ticketId={activeTicket}
          onClose={() => setActiveTicket(null)}
          onChanged={() => load(statusFilter)}
        />
      )}
    </div>
  );
}

/* ============== Ticket Conversation Dialog ============== */
function TicketDialog({ ticketId, onClose, onChanged }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await opsAPI.getTicket(ticketId);
      setTicket(res.data);
      setStatus(res.data.status);
    } catch (err) {
      toast.error('Failed to load ticket');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [ticketId, onClose]);

  useEffect(() => { load(); }, [load]);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await opsAPI.replyTicket(ticketId, reply.trim());
      setReply('');
      toast.success('Reply sent');
      await load();
      onChanged && onChanged();
    } catch (err) {
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    try {
      await opsAPI.updateTicketStatus(ticketId, newStatus);
      toast.success(`Status set to ${newStatus}`);
      await load();
      onChanged && onChanged();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-auto" data-testid="ticket-dialog">
        <DialogHeader>
          <DialogTitle>{loading || !ticket ? 'Ticket' : ticket.subject}</DialogTitle>
          <DialogDescription>
            {ticket ? `${ticket.ticket_number} · ${ticket.category}` : 'Loading ticket conversation'}
          </DialogDescription>
        </DialogHeader>

        {loading || !ticket ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-600">
                {ticket.customer_name} · {ticket.customer_phone}
              </div>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-36 h-8 text-xs" data-testid="ticket-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 max-h-64 overflow-auto bg-gray-50 rounded-lg p-3" data-testid="ticket-messages">
              {(ticket.messages || []).map((m, i) => (
                <div key={i} className={`flex ${m.sender === 'customer' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    m.sender === 'customer' ? 'bg-white border' : m.sender === 'system' ? 'bg-gray-200 text-gray-600' : 'bg-[#0F62FE] text-white'
                  }`}>
                    <p>{m.message}</p>
                    <p className={`text-[10px] mt-1 ${m.sender === 'support' ? 'text-blue-100' : 'text-gray-400'}`}>
                      {m.sender === 'customer' ? 'Customer' : m.sender === 'system' ? 'System' : 'Support'} · {formatDateTime(m.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your reply..."
                rows={2}
                data-testid="ticket-reply-input"
              />
              <div className="flex justify-end mt-2">
                <Button onClick={handleReply} disabled={sending || !reply.trim()} className="bg-[#0F62FE] hover:bg-[#0353E9]" data-testid="ticket-reply-btn">
                  <Send className="h-4 w-4 mr-1.5" /> {sending ? 'Sending...' : 'Send Reply'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ============== Notifications Tab (Broadcast) ============== */
function NotificationsTab() {
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

function SendNotificationDialog({ customer, onClose }) {
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

/* ============== Analytics Tab ============== */
function AnalyticsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await opsAPI.getCustomerAnalytics();
        setData(res.data);
      } catch (err) {
        toast.error('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><div className="spinner" /></div>;
  if (!data) return <Empty text="No analytics data" />;

  return (
    <div className="space-y-6" data-testid="analytics-content">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AnalyticsCard icon={Users} color="#0F62FE" label="Total Customers" value={data.total_customers} />
        <AnalyticsCard icon={TrendingUp} color="#10B981" label="Active" value={data.active_customers} />
        <AnalyticsCard icon={Package} color="#F59E0B" label="Ordering Customers" value={data.ordering_customers} />
        <AnalyticsCard icon={Headphones} color="#EC4899" label="Open Tickets" value={data.open_tickets} />
        <AnalyticsCard icon={Users} color="#8B5CF6" label="New (7 days)" value={data.new_customers_7d} />
        <AnalyticsCard icon={Users} color="#14B8A6" label="New (30 days)" value={data.new_customers_30d} />
        <AnalyticsCard icon={Headphones} color="#6B7280" label="Total Tickets" value={data.total_tickets} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><IndianRupee className="h-4 w-4 text-[#10B981]" /> Top Spenders</h3>
          {data.top_spenders.length === 0 ? <Empty text="No data" /> : (
            <div className="space-y-2" data-testid="top-spenders">
              {data.top_spenders.map((s, i) => (
                <div key={s.customer_id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gray-100 text-xs flex items-center justify-center">{i + 1}</span>
                    <span>{s.name || 'Unnamed'}<span className="text-xs text-gray-400 ml-1">{s.phone}</span></span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(s.spend)}</p>
                    <p className="text-[10px] text-gray-400">{s.orders} orders</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Heart className="h-4 w-4 text-[#EC4899]" /> Most Wishlisted Products</h3>
          {data.top_wishlist_products.length === 0 ? <Empty text="No data" /> : (
            <div className="space-y-2" data-testid="top-wishlist">
              {data.top_wishlist_products.map((w, i) => (
                <div key={w.product_id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                  <span>{w.name}<span className="text-xs text-gray-400 ml-1">{w.product_type}</span></span>
                  <Badge className="bg-pink-100 text-pink-700">{w.count} ♥</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Package className="h-4 w-4 text-[#F59E0B]" /> Order Status Distribution</h3>
        <div className="flex flex-wrap gap-2" data-testid="status-distribution">
          {Object.entries(data.order_status_distribution).map(([k, v]) => (
            <div key={k} className="px-3 py-2 rounded-lg bg-gray-50 border text-sm">
              <span className={`status-badge text-[10px] ${getStatusClass(k)}`}>{getStatusName(k)}</span>
              <span className="ml-2 font-semibold">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============== Small helpers ============== */
function StatChip({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-lg px-2 py-2 text-center">
      <p className="text-sm font-bold text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}

function AnalyticsCard({ icon: Icon, color, label, value }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function Empty({ text }) {
  return <div className="text-center py-10 text-gray-400 text-sm">{text}</div>;
}
