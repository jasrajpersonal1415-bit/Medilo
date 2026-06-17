import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { medicineAPI, orderAPI, customerAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../../components/ui/dialog';
import { Search, ShoppingCart, Home, ClipboardList, User, Plus, Minus, Package, Pill, Heart, Sparkles, Activity, Baby, ArrowLeft, RotateCcw, Truck, Clock, CheckCircle, AlertCircle, FileUp, Upload, X, Camera } from 'lucide-react';
import { getBucketClass, getBucketName, formatCurrency, getStatusName } from '../../lib/utils';
import { toast } from 'sonner';

const CATEGORY_CONFIG = {
  'Medicine': { icon: Pill, color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', label: 'Medicines' },
  'Beauty & Personal Care': { icon: Sparkles, color: '#EC4899', bg: '#FDF2F8', border: '#FBCFE8', label: 'Beauty & Personal Care' },
  'Wellness': { icon: Heart, color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', label: 'Wellness' },
  'Baby Care': { icon: Baby, color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', label: 'Baby Care' },
  'Device': { icon: Activity, color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE', label: 'Devices' },
};

export default function CustomerHome() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { items, addItem, decrementItem, getItemQuantity, itemCount, clearCart } = useCart();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterCategory, setFilterCategory] = useState(null);
  
  // Prescription upload state
  const [prescriptionDialog, setPrescriptionDialog] = useState(false);
  const [prescriptionImage, setPrescriptionImage] = useState(null);
  const [prescriptionPreview, setPrescriptionPreview] = useState(null);
  const [prescriptionNote, setPrescriptionNote] = useState('');
  const [uploadingPrescription, setUploadingPrescription] = useState(false);
  const fileInputRef = useRef(null);
  const [wishlistIds, setWishlistIds] = useState(new Set());

  useEffect(() => {
    fetchCategories();
    fetchOrders();
    fetchWishlistIds();
  }, []);

  useEffect(() => {
    if (selectedCategory || search) {
      fetchProducts();
    }
  }, [selectedCategory, search, filterCategory]);

  const fetchOrders = async () => {
    try {
      const response = await orderAPI.getAll();
      const active = response.data.filter(order => 
        !['delivered', 'cancelled'].includes(order.status)
      );
      setActiveOrders(active);
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
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCategory) params.product_type = selectedCategory;
      if (filterCategory && search) params.product_type = filterCategory;
      if (search) params.search = search;
      const response = await medicineAPI.getAll(params);
      setProducts(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product) => {
    addItem(product);
  };

  const handleRemoveFromCart = (productId) => {
    decrementItem(productId);
  };

  const fetchWishlistIds = async () => {
    try {
      const res = await customerAPI.getWishlist();
      setWishlistIds(new Set(res.data.map(i => i.product_id)));
    } catch (err) {}
  };

  const toggleWishlist = async (productId) => {
    try {
      if (wishlistIds.has(productId)) {
        await customerAPI.removeFromWishlist(productId);
        setWishlistIds(prev => { const s = new Set(prev); s.delete(productId); return s; });
        toast.success('Removed from wishlist');
      } else {
        await customerAPI.addToWishlist(productId);
        setWishlistIds(prev => new Set(prev).add(productId));
        toast.success('Added to wishlist');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const handleReorder = async (order) => {
    try {
      for (const item of order.items) {
        const response = await medicineAPI.getOne(item.medicine_id);
        if (response.data) {
          for (let i = 0; i < item.quantity; i++) {
            addItem(response.data);
          }
        }
      }
      toast.success(`Added ${order.items.length} item(s) to cart`);
      navigate('/cart');
    } catch (err) {
      toast.error('Some items may no longer be available');
    }
  };

  const handleCategoryClick = (categoryId) => {
    setSelectedCategory(categoryId);
    setSearch('');
    setFilterCategory(null);
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setProducts([]);
    setSearch('');
    setFilterCategory(null);
  };

  const handleSearch = (value) => {
    setSearch(value);
    if (value && !selectedCategory) {
      setSelectedCategory(null);
    }
  };

  // Prescription handlers
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
      sessionStorage.setItem('pendingPrescription', JSON.stringify({
        image: prescriptionImage,
        note: prescriptionNote
      }));
      toast.success('Prescription uploaded! Browse medicines to add to your order.');
      setPrescriptionDialog(false);
      setPrescriptionImage(null);
      setPrescriptionPreview(null);
      setPrescriptionNote('');
      setSelectedCategory('Medicine');
    } catch (err) {
      toast.error('Failed to process prescription');
    } finally {
      setUploadingPrescription(false);
    }
  };

  const clearPrescriptionUpload = () => {
    setPrescriptionImage(null);
    setPrescriptionPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

  // ==================== RENDER SECTIONS ====================

  const renderActiveOrderBanner = () => {
    if (activeOrders.length === 0) return null;
    const order = activeOrders[0];
    const { icon: StatusIcon, color, label } = getStatusConfig(order.status);
    
    return (
      <div 
        className={`mb-4 p-3 rounded-xl border cursor-pointer ${color}`}
        onClick={() => navigate(`/order/${order.id}`)}
        data-testid="active-order-banner"
      >
        <div className="flex items-center gap-3">
          <StatusIcon className="h-5 w-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs opacity-80 truncate">
              {order.items.map(i => i.medicine_name).join(', ')}
            </p>
          </div>
          <span className="text-xs font-medium shrink-0">View →</span>
        </div>
        {activeOrders.length > 1 && (
          <p className="text-xs mt-1.5 opacity-60">+{activeOrders.length - 1} more active order(s)</p>
        )}
      </div>
    );
  };

  const renderPrescriptionBanner = () => (
    <div 
      className="mb-5 p-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white cursor-pointer active:scale-[0.98] transition-transform"
      onClick={() => setPrescriptionDialog(true)}
      data-testid="prescription-upload-shortcut"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
          <FileUp className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Upload Prescription</p>
          <p className="text-xs text-white/80">Get medicines delivered to your door</p>
        </div>
        <Camera className="h-5 w-5 text-white/70" />
      </div>
    </div>
  );

  const renderQuickReorder = () => {
    if (recentOrders.length === 0) return null;
    return (
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-3 text-gray-800">Quick Reorder</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
          {recentOrders.map((order) => (
            <div 
              key={order.id}
              className="min-w-[200px] bg-gray-50 rounded-xl p-3 border border-gray-100 shrink-0"
              data-testid={`reorder-card-${order.id}`}
            >
              <p className="text-xs font-medium text-gray-800 truncate">
                {order.items.map(i => i.medicine_name).join(', ')}
              </p>
              <p className="text-xs text-gray-400 mt-1">{order.items.length} item(s) · {formatCurrency(order.total_amount)}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReorder(order)}
                className="mt-2 w-full h-7 text-xs"
                data-testid={`reorder-btn-${order.id}`}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reorder
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCategories = () => (
    <div>
      <h2 className="text-base font-semibold mb-3 text-gray-800">Shop by Category</h2>
      <div className="grid grid-cols-3 gap-3">
        {categories.map((category) => {
          const config = CATEGORY_CONFIG[category.id] || { icon: Package, color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', label: category.name };
          const IconComp = config.icon;
          
          return (
            <div
              key={category.id}
              className="flex flex-col items-center p-3 rounded-xl cursor-pointer active:scale-95 transition-all border-2 hover:shadow-md"
              style={{ backgroundColor: config.bg, borderColor: config.border }}
              onClick={() => handleCategoryClick(category.id)}
              data-testid={`category-${category.id.toLowerCase().replace(/[^a-z]/g, '-')}`}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: config.color + '20' }}>
                <IconComp className="h-5 w-5" style={{ color: config.color }} />
              </div>
              <span className="text-xs font-medium text-center leading-tight text-gray-700">{config.label}</span>
              {category.count > 0 && (
                <span className="text-[10px] text-gray-400 mt-0.5">{category.count} items</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderCategoryFilter = () => {
    if (!search || selectedCategory) return null;
    return (
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: 'none' }} data-testid="category-filter">
        <button
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !filterCategory ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
          }`}
          onClick={() => setFilterCategory(null)}
        >
          All
        </button>
        {Object.entries(CATEGORY_CONFIG).map(([id, config]) => (
          <button
            key={id}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filterCategory === id ? 'text-white' : 'bg-white text-gray-600 border-gray-200'
            }`}
            style={filterCategory === id ? { backgroundColor: config.color, borderColor: config.color } : {}}
            onClick={() => setFilterCategory(filterCategory === id ? null : id)}
            data-testid={`filter-${id.toLowerCase().replace(/[^a-z]/g, '-')}`}
          >
            {config.label}
          </button>
        ))}
      </div>
    );
  };

  const renderProductCard = (product) => {
    const config = CATEGORY_CONFIG[product.product_type] || CATEGORY_CONFIG['Medicine'];
    const IconComp = config.icon;
    const qty = getItemQuantity(product.id);
    const inCart = qty > 0;

    return (
      <div 
        key={product.id}
        className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm hover:shadow-md transition-shadow relative"
        data-testid={`product-card-${product.id}`}
      >
        {/* Wishlist heart */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
          className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm"
          data-testid={`wishlist-btn-${product.id}`}
        >
          <Heart className={`h-3.5 w-3.5 ${wishlistIds.has(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
        </button>

        {/* Product icon area */}
        <div className="w-full h-20 rounded-lg flex items-center justify-center mb-3 overflow-hidden" style={{ backgroundColor: config.bg }}>
          {product.image_path ? (
            <img 
              src={`${process.env.REACT_APP_BACKEND_URL}/api/files/${product.image_path}`}
              alt={product.name}
              className="w-full h-full object-cover rounded-lg"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div className={`w-full h-full items-center justify-center ${product.image_path ? 'hidden' : 'flex'}`} style={{ backgroundColor: config.bg }}>
            <IconComp className="h-8 w-8" style={{ color: config.color }} />
          </div>
        </div>

        {/* Info */}
        <div className="min-h-[60px]">
          {product.product_type === 'Medicine' && product.bucket && (
            <Badge className={`${getBucketClass(product.bucket)} text-[10px] mb-1`}>
              {getBucketName(product.bucket)}
            </Badge>
          )}
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">{product.name}</h3>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{product.manufacturer}</p>
        </div>

        {/* Price + Cart */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
          <span className="text-sm font-bold text-gray-900">{formatCurrency(product.price)}</span>
          
          {inCart ? (
            <div className="flex items-center gap-1" data-testid={`qty-control-${product.id}`}>
              <button
                onClick={() => handleRemoveFromCart(product.id)}
                className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
                data-testid={`remove-from-cart-${product.id}`}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center text-sm font-semibold text-[#0F62FE]">{qty}</span>
              <button
                onClick={() => handleAddToCart(product)}
                className="w-7 h-7 rounded-lg bg-[#0F62FE] flex items-center justify-center text-white hover:bg-[#0353E9] transition-colors"
                data-testid={`add-to-cart-${product.id}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Button
              data-testid={`add-to-cart-${product.id}`}
              onClick={() => handleAddToCart(product)}
              size="sm"
              className="h-7 px-3 text-xs bg-[#0F62FE] hover:bg-[#0353E9] rounded-lg"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderProducts = () => (
    <div>
      {selectedCategory && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={handleBackToCategories}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            data-testid="back-to-categories"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-lg font-semibold text-gray-800">
            {CATEGORY_CONFIG[selectedCategory]?.label || selectedCategory}
          </h2>
        </div>
      )}

      {/* Category legend for medicines */}
      {selectedCategory === 'Medicine' && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <Badge className="bucket-otc text-xs">OTC - No Rx</Badge>
          <Badge className="bucket-schedule-h text-xs">Schedule H</Badge>
          <Badge className="bucket-schedule-h1 text-xs">Schedule H1</Badge>
        </div>
      )}

      {/* Category filter chips for search */}
      {renderCategoryFilter()}

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-medium text-gray-500">No Products Found</h3>
          <p className="text-sm text-gray-400 mt-1">
            {search ? 'Try a different search term' : 'Products will appear here once added'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map(renderProductCard)}
        </div>
      )}
    </div>
  );

  // ==================== MAIN RENDER ====================

  return (
    <div className="mobile-container bg-gray-50 min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white sticky top-0 z-30 px-4 pt-3 pb-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-[#0F62FE] tracking-tight">MEDILO</h1>
            <p className="text-xs text-gray-500">Hi, {user?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link 
              to="/profile" 
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
              data-testid="profile-link"
            >
              <User className="h-5 w-5 text-gray-700" />
            </Link>
            <Link 
              to="/cart" 
              className="relative w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
              data-testid="cart-link"
            >
              <ShoppingCart className="h-5 w-5 text-gray-700" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#0F62FE] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            data-testid="product-search-input"
            type="text"
            placeholder="Search medicines, wellness, beauty..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 bg-gray-50 rounded-xl border-gray-200 h-10 text-sm"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {renderActiveOrderBanner()}
        
        {error ? (
          <div className="text-center py-12 text-red-600">{error}</div>
        ) : loading && !selectedCategory && !search && categories.length === 0 ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : selectedCategory || search ? (
          renderProducts()
        ) : (
          <>
            {renderPrescriptionBanner()}
            {renderQuickReorder()}
            {renderCategories()}
          </>
        )}
      </div>

      {/* Floating Cart Bar */}
      {itemCount > 0 && !selectedCategory && !search && (
        <div className="fixed bottom-16 left-4 right-4 z-20 max-w-md mx-auto">
          <div 
            className="bg-[#0F62FE] text-white rounded-xl px-4 py-3 flex items-center justify-between shadow-lg cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => navigate('/cart')}
            data-testid="floating-cart-bar"
          >
            <div>
              <p className="text-sm font-semibold">{itemCount} item(s) in cart</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">View Cart</span>
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
        </div>
      )}

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

      {/* Prescription Upload Dialog */}
      <Dialog open={prescriptionDialog} onOpenChange={setPrescriptionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-teal-600" />
              Upload Prescription
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div 
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                prescriptionPreview ? 'border-teal-300 bg-teal-50' : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePrescriptionFileChange}
                className="hidden"
                data-testid="prescription-file-input"
              />
              {prescriptionPreview ? (
                <div className="relative">
                  <img src={prescriptionPreview} alt="Prescription preview" className="max-h-48 mx-auto rounded-lg" />
                  <button
                    onClick={(e) => { e.stopPropagation(); clearPrescriptionUpload(); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 font-medium">Tap to upload prescription</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG up to 5MB</p>
                </>
              )}
            </div>

            <div>
              <Label className="text-sm text-gray-600">Additional Notes (Optional)</Label>
              <Textarea
                value={prescriptionNote}
                onChange={(e) => setPrescriptionNote(e.target.value)}
                placeholder="e.g., Need 2 strips of each medicine"
                className="mt-1 h-20"
                data-testid="prescription-notes"
              />
            </div>

            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <strong>How it works:</strong> Upload your prescription, then browse and add the prescribed medicines to your cart. Our pharmacist will verify before dispatch.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPrescriptionDialog(false)}>Cancel</Button>
            <Button 
              onClick={handlePrescriptionSubmit}
              disabled={!prescriptionImage || uploadingPrescription}
              className="bg-teal-600 hover:bg-teal-700"
              data-testid="submit-prescription"
            >
              {uploadingPrescription ? <div className="spinner h-4 w-4" /> : <><Upload className="h-4 w-4 mr-2" />Continue to Medicines</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
