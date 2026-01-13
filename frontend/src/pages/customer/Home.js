import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { medicineAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Search, ShoppingCart, Home, ClipboardList, User, Plus, Package } from 'lucide-react';
import { getBucketClass, getBucketName, formatCurrency } from '../../lib/utils';

export default function CustomerHome() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { items, addItem, itemCount } = useCart();
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMedicines();
  }, [search]);

  const fetchMedicines = async () => {
    setLoading(true);
    try {
      const response = await medicineAPI.getAll({ search: search || undefined });
      setMedicines(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load medicines');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (medicine) => {
    addItem(medicine);
  };

  const isInCart = (medicineId) => {
    return items.some((item) => item.id === medicineId);
  };

  return (
    <div className="mobile-container bg-white min-h-screen pb-20">
      {/* Header */}
      <div className="sticky-header px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="medilo-logo-sm">MEDILO</h1>
            <p className="text-xs text-gray-500">Hi, {user?.name}</p>
          </div>
          <Link 
            to="/cart" 
            className="relative p-2"
            data-testid="cart-link"
          >
            <ShoppingCart className="h-6 w-6 text-gray-700" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#0F62FE] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            data-testid="medicine-search-input"
            type="text"
            placeholder="Search medicines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-gray-50"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {/* Category Legend */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <Badge className="bucket-otc text-xs">OTC - No Rx</Badge>
          <Badge className="bucket-schedule-h text-xs">Schedule H</Badge>
          <Badge className="bucket-schedule-h1 text-xs">Schedule H1</Badge>
        </div>

        {loading && medicines.length === 0 ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">{error}</div>
        ) : medicines.length === 0 ? (
          <div className="empty-state">
            <Package className="empty-state-icon mx-auto" />
            <h3 className="empty-state-title">No Medicines Found</h3>
            <p className="empty-state-text">
              {search ? 'Try a different search term' : 'Medicines will appear here once added'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {medicines.map((medicine) => (
              <Card 
                key={medicine.id} 
                className="p-4 card-hover"
                data-testid={`medicine-card-${medicine.id}`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${getBucketClass(medicine.bucket)} text-xs`}>
                        {getBucketName(medicine.bucket)}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-gray-900 truncate">{medicine.name}</h3>
                    <p className="text-sm text-gray-500 truncate">{medicine.generic_name}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {medicine.strength} • {medicine.pack_size || medicine.form} • {medicine.manufacturer}
                    </p>
                    <p className="text-base font-semibold text-[#0F62FE] mt-1">
                      {formatCurrency(medicine.price)}
                    </p>
                  </div>
                  <Button
                    data-testid={`add-to-cart-${medicine.id}`}
                    onClick={() => handleAddToCart(medicine)}
                    size="sm"
                    variant={isInCart(medicine.id) ? 'secondary' : 'default'}
                    className={isInCart(medicine.id) ? '' : 'bg-[#0F62FE] hover:bg-[#0353E9]'}
                  >
                    {isInCart(medicine.id) ? (
                      'Added'
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="flex justify-around items-center">
          <Link to="/" className="bottom-nav-item active" data-testid="nav-home">
            <Home className="h-5 w-5" />
            <span>Home</span>
          </Link>
          <Link to="/orders" className="bottom-nav-item" data-testid="nav-orders">
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
