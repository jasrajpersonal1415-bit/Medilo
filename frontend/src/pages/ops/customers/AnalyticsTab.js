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
import { AnalyticsCard, Empty } from './shared';

export default function AnalyticsTab() {
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

