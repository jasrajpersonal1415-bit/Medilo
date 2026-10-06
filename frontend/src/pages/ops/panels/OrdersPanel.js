import React from 'react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Eye } from 'lucide-react';
import { formatDateTime, getStatusClass, getStatusName } from '../../../lib/utils';

export default function OrdersPanel({ orders, loading, onViewTimeline }) {
  return (
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
                      onClick={() => onViewTimeline(order)}
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
  );
}
