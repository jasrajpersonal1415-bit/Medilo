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
import { fileUrl, StatChip, Empty } from './shared';
import { SendNotificationDialog } from './NotificationsTab';

export default function CustomersTab() {
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

