import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { orderAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Home, ClipboardList, ShoppingCart, User, ChevronRight, Package } from 'lucide-react';
import { formatDate, getStatusClass, getStatusName } from '../../lib/utils';

export default function Orders() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await orderAPI.getAll();
      setOrders(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load orders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-container bg-[#F4F7F6] min-h-screen pb-20">
      {/* Header */}
      <div className="sticky-header px-4 py-4 bg-white">
        <h1 className="text-lg font-semibold">My Orders</h1>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">{error}</div>
        ) : orders.length === 0 ? (
          <div className="empty-state mt-8">
            <Package className="empty-state-icon mx-auto" />
            <h3 className="empty-state-title">No Orders Yet</h3>
            <p className="empty-state-text mb-4">Place your first order to see it here</p>
            <Link to="/">
              <Button className="bg-[#0F62FE] hover:bg-[#0353E9]">Browse Medicines</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Card 
                key={order.id}
                className="p-4 card-hover cursor-pointer"
                onClick={() => navigate(`/order/${order.id}`)}
                data-testid={`order-card-${order.id}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs text-gray-500 mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                  </div>
                  <Badge className={`${getStatusClass(order.status)} text-xs`}>
                    {getStatusName(order.status)}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      {order.items.length} medicine{order.items.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-500 truncate max-w-[200px]">
                      {order.items.map((i) => i.medicine_name).join(', ')}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="flex justify-around items-center">
          <Link to="/" className="bottom-nav-item" data-testid="nav-home">
            <Home className="h-5 w-5" />
            <span>Home</span>
          </Link>
          <Link to="/orders" className="bottom-nav-item active" data-testid="nav-orders">
            <ClipboardList className="h-5 w-5" />
            <span>Orders</span>
          </Link>
          <Link to="/cart" className="bottom-nav-item" data-testid="nav-cart">
            <ShoppingCart className="h-5 w-5" />
            <span>Cart</span>
          </Link>
          <button onClick={logout} className="bottom-nav-item" data-testid="nav-logout">
            <User className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
