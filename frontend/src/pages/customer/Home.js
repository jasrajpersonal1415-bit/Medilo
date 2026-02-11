import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { medicineAPI, orderAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../../components/ui/dialog';
import { Search, ShoppingCart, Home, ClipboardList, User, Plus, Package, Pill, Heart, Sparkles, Activity, ArrowLeft, RotateCcw, Truck, Clock, CheckCircle, AlertCircle, FileUp, Upload, X, Camera } from 'lucide-react';
import { getBucketClass, getBucketName, formatCurrency, getStatusName } from '../../lib/utils';
import { toast } from 'sonner';

const CATEGORY_ICONS = {
  Medicine: Pill,
  Wellness: Heart,
  Beauty: Sparkles,
  Device: Activity,
};

const CATEGORY_COLORS = {
  Medicine: 'bg-blue-50 border-blue-200 text-blue-700',
  Wellness: 'bg-green-50 border-green-200 text-green-700',
  Beauty: 'bg-pink-50 border-pink-200 text-pink-700',
  Device: 'bg-purple-50 border-purple-200 text-purple-700',
};

export default function CustomerHome() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { items, addItem, itemCount, clearCart } = useCart();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Prescription upload state
  const [prescriptionDialog, setPrescriptionDialog] = useState(false);
  const [prescriptionImage, setPrescriptionImage] = useState(null);
  const [prescriptionPreview, setPrescriptionPreview] = useState(null);
  const [prescriptionNote, setPrescriptionNote] = useState('');
  const [uploadingPrescription, setUploadingPrescription] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchCategories();
    fetchOrders();
  }, []);

  useEffect(() => {
    if (selectedCategory || search) {
      fetchProducts();
    }
  }, [selectedCategory, search]);

  const fetchOrders = async () => {
    try {
      const response = await orderAPI.getAll();
      
      // Get active orders (not delivered or cancelled)
      const active = response.data.filter(order => 
        !['delivered', 'cancelled'].includes(order.status)
      );
      setActiveOrders(active);
      
      // Get last 3 delivered orders for quick reorder
      const delivered = response.data
        .filter(order => order.status === 'delivered')
        .slice(0, 3);
      setRecentOrders(delivered);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  };

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await medicineAPI.getCategories();
      setCategories(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load categories');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCategory) params.product_type = selectedCategory;
      if (search) params.search = search;
      
      const response = await medicineAPI.getAll(params);
      setProducts(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load products');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product) => {
    addItem(product);
  };

  const isInCart = (productId) => {
    return items.some((item) => item.id === productId);
  };

  const handleReorder = async (order) => {
    try {
      // Fetch current product details for each item in the order
      for (const item of order.items) {
        const response = await medicineAPI.getOne(item.medicine_id);
        if (response.data) {
          // Add each item to cart with the quantity from the original order
          for (let i = 0; i < item.quantity; i++) {
            addItem(response.data);
          }
        }
      }
      toast.success(`Added ${order.items.length} item(s) to cart`);
      navigate('/cart');
    } catch (err) {
      toast.error('Some items may no longer be available');
      console.error(err);
    }
  };

  // Prescription upload handlers
  const handlePrescriptionFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPrescriptionImage(reader.result);
        setPrescriptionPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePrescriptionSubmit = async () => {
    if (!prescriptionImage) {
      toast.error('Please upload a prescription image');
      return;
    }

    setUploadingPrescription(true);
    try {
      // Navigate to cart with prescription data
      // Store prescription in sessionStorage to pass to cart/checkout
      sessionStorage.setItem('pendingPrescription', JSON.stringify({
        image: prescriptionImage,
        note: prescriptionNote
      }));
      
      toast.success('Prescription uploaded! Browse medicines to add to your order.');
      setPrescriptionDialog(false);
      setPrescriptionImage(null);
      setPrescriptionPreview(null);
      setPrescriptionNote('');
      
      // Navigate to medicines category
      setSelectedCategory('Medicine');
    } catch (err) {
      toast.error('Failed to process prescription');
      console.error(err);
    } finally {
      setUploadingPrescription(false);
    }
  };

  const clearPrescriptionUpload = () => {
    setPrescriptionImage(null);
    setPrescriptionPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCategoryClick = (categoryId) => {
    setSelectedCategory(categoryId);
    setSearch('');
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setProducts([]);
    setSearch('');
  };

  const handleSearch = (value) => {
    setSearch(value);
    if (value && !selectedCategory) {
      // Search across all categories
      setSelectedCategory(null);
    }
  };

  // Get status icon and color for active order banner
  const getStatusConfig = (status) => {
    const configs = {
      pending_pharmacist_review: { icon: Clock, color: 'bg-yellow-50 border-yellow-200 text-yellow-800', label: 'Under Review' },
      pharmacist_approved: { icon: CheckCircle, color: 'bg-blue-50 border-blue-200 text-blue-800', label: 'Approved' },
      pharmacist_rejected: { icon: AlertCircle, color: 'bg-red-50 border-red-200 text-red-800', label: 'Rejected' },
      prescription_requested: { icon: AlertCircle, color: 'bg-orange-50 border-orange-200 text-orange-800', label: 'Prescription Needed' },
      assigned_to_pharmacy: { icon: Package, color: 'bg-blue-50 border-blue-200 text-blue-800', label: 'Assigned to Pharmacy' },
      pharmacy_accepted: { icon: Package, color: 'bg-blue-50 border-blue-200 text-blue-800', label: 'Pharmacy Processing' },
      pharmacy_rejected: { icon: AlertCircle, color: 'bg-red-50 border-red-200 text-red-800', label: 'Pharmacy Rejected' },
      inventory_confirmed: { icon: Package, color: 'bg-blue-50 border-blue-200 text-blue-800', label: 'Inventory Confirmed' },
      preparing: { icon: Package, color: 'bg-indigo-50 border-indigo-200 text-indigo-800', label: 'Being Prepared' },
      ready_for_pickup: { icon: Package, color: 'bg-purple-50 border-purple-200 text-purple-800', label: 'Ready for Pickup' },
      picked_up: { icon: Truck, color: 'bg-cyan-50 border-cyan-200 text-cyan-800', label: 'Picked Up' },
      out_for_delivery: { icon: Truck, color: 'bg-green-50 border-green-200 text-green-800', label: 'Out for Delivery' },
    };
    return configs[status] || { icon: Clock, color: 'bg-gray-50 border-gray-200 text-gray-800', label: getStatusName(status) };
  };

  // Render Active Order Status Banner
  const renderActiveOrderBanner = () => {
    if (activeOrders.length === 0) return null;
    
    // Show the most recent active order
    const order = activeOrders[0];
    const { icon: StatusIcon, color, label } = getStatusConfig(order.status);
    
    return (
      <div 
        className={`mb-4 p-3 rounded-lg border-2 cursor-pointer ${color}`}
        onClick={() => navigate(`/orders/${order.id}`)}
        data-testid="active-order-banner"
      >
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <StatusIcon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs opacity-80 truncate">
              {order.items.map(i => i.medicine_name).join(', ')}
            </p>
          </div>
          <div className="shrink-0 text-xs font-medium">
            View →
          </div>
        </div>
        {activeOrders.length > 1 && (
          <p className="text-xs mt-2 opacity-70">
            +{activeOrders.length - 1} more active order(s)
          </p>
        )}
      </div>
    );
  };

  // Render Prescription Upload Shortcut
  const renderPrescriptionShortcut = () => (
    <Card 
      className="mb-6 p-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-2 border-teal-200 cursor-pointer hover:shadow-md transition-all"
      onClick={() => setPrescriptionDialog(true)}
      data-testid="prescription-upload-shortcut"
    >
      <div className="flex items-center gap-4">
        <div className="shrink-0 w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
          <FileUp className="h-6 w-6 text-teal-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-teal-800">Upload Prescription</h3>
          <p className="text-xs text-teal-600">Have a prescription? Upload and order medicines directly</p>
        </div>
        <div className="shrink-0">
          <Camera className="h-5 w-5 text-teal-500" />
        </div>
      </div>
    </Card>
  );

  // Render Quick Reorder section
  const renderQuickReorder = () => {
    if (recentOrders.length === 0) return null;
    
    return (
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-gray-600" />
          Quick Reorder
        </h2>
        <div className="space-y-2">
          {recentOrders.map((order) => (
            <Card 
              key={order.id} 
              className="p-3 border border-gray-200"
              data-testid={`reorder-card-${order.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {order.items.map(i => i.medicine_name).join(', ')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {order.items.length} item(s) • {formatCurrency(order.total_amount)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReorder(order)}
                  className="ml-2 shrink-0"
                  data-testid={`reorder-btn-${order.id}`}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reorder
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  // Render category tiles
  const renderCategories = () => (
    <div className="grid grid-cols-2 gap-3">
      {categories.map((category) => {
        const IconComponent = CATEGORY_ICONS[category.id] || Package;
        const colorClass = CATEGORY_COLORS[category.id] || 'bg-gray-50 border-gray-200 text-gray-700';
        
        return (
          <Card
            key={category.id}
            className={`p-4 cursor-pointer border-2 transition-all hover:shadow-md ${colorClass}`}
            onClick={() => handleCategoryClick(category.id)}
            data-testid={`category-${category.id.toLowerCase()}`}
          >
            <div className="flex flex-col items-center text-center">
              <IconComponent className="h-8 w-8 mb-2" />
              <h3 className="font-medium text-sm">{category.name}</h3>
            </div>
          </Card>
        );
      })}
    </div>
  );

  // Render product list
  const renderProducts = () => (
    <div className="space-y-3">
      {/* Back button when viewing category */}
      {selectedCategory && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToCategories}
          className="mb-2"
          data-testid="back-to-categories"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          All Categories
        </Button>
      )}

      {/* Category legend for medicines only */}
      {selectedCategory === 'Medicine' && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <Badge className="bucket-otc text-xs">OTC - No Rx</Badge>
          <Badge className="bucket-schedule-h text-xs">Schedule H</Badge>
          <Badge className="bucket-schedule-h1 text-xs">Schedule H1</Badge>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <Package className="empty-state-icon mx-auto" />
          <h3 className="empty-state-title">No Products Found</h3>
          <p className="empty-state-text">
            {search ? 'Try a different search term' : 'Products will appear here once added'}
          </p>
        </div>
      ) : (
        products.map((product) => (
          <Card 
            key={product.id} 
            className="p-4 card-hover"
            data-testid={`product-card-${product.id}`}
          >
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {/* Show bucket badge only for medicines */}
                  {product.product_type === 'Medicine' && product.bucket ? (
                    <Badge className={`${getBucketClass(product.bucket)} text-xs`}>
                      {getBucketName(product.bucket)}
                    </Badge>
                  ) : (
                    <Badge className={`${CATEGORY_COLORS[product.product_type]?.split(' ')[0] || 'bg-gray-100'} text-xs border`}>
                      {product.product_type}
                    </Badge>
                  )}
                </div>
                <h3 className="font-medium text-gray-900 truncate">{product.name}</h3>
                <p className="text-sm text-gray-500 truncate">{product.generic_name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {product.strength && `${product.strength} • `}{product.pack_size || product.form} • {product.manufacturer}
                </p>
                <p className="text-base font-semibold text-[#0F62FE] mt-1">
                  {formatCurrency(product.price)}
                </p>
              </div>
              <Button
                data-testid={`add-to-cart-${product.id}`}
                onClick={() => handleAddToCart(product)}
                size="sm"
                variant={isInCart(product.id) ? 'secondary' : 'default'}
                className={isInCart(product.id) ? '' : 'bg-[#0F62FE] hover:bg-[#0353E9]'}
              >
                {isInCart(product.id) ? (
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
        ))
      )}
    </div>
  );

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
            data-testid="product-search-input"
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 bg-gray-50"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {/* Active Order Status Banner - always show at top */}
        {renderActiveOrderBanner()}
        
        {error ? (
          <div className="text-center py-12 text-red-600">{error}</div>
        ) : loading && !selectedCategory && !search && categories.length === 0 ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : selectedCategory || search ? (
          renderProducts()
        ) : (
          <>
            {/* Prescription Upload Shortcut */}
            {renderPrescriptionShortcut()}
            
            {/* Quick Reorder Section */}
            {renderQuickReorder()}
            
            {/* Categories */}
            <h2 className="text-lg font-semibold mb-4">Shop by Category</h2>
            {renderCategories()}
          </>
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
