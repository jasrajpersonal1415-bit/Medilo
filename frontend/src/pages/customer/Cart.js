import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { orderAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { 
  ArrowLeft, Trash2, Plus, Minus, Upload, MapPin, 
  AlertTriangle, ShoppingCart, Home, ClipboardList, User, Tag, Percent
} from 'lucide-react';
import { getBucketClass, getBucketName, fileToBase64, formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

// Discount configuration (mirrors backend)
const CATEGORY_DISCOUNTS = {
  'Medicine': 0.10,
  'Baby Care': 0.20,
  'Wellness': 0.12,
  'Beauty & Personal Care': 0.08,
  'Device': 0.0,
};

const CART_DISCOUNT_TIERS = [
  { threshold: 3000, rate: 0.10 },
  { threshold: 2000, rate: 0.05 },
];

function calculateDiscounts(items) {
  let subtotal = 0;
  let categoryDiscount = 0;
  let medicineSubtotalAfterDiscount = 0;

  for (const item of items) {
    const itemTotal = (item.price || 0) * item.quantity;
    subtotal += itemTotal;

    const productType = item.product_type || 'Medicine';
    const catRate = CATEGORY_DISCOUNTS[productType] || 0;
    const itemDiscount = itemTotal * catRate;
    categoryDiscount += itemDiscount;

    if (productType === 'Medicine') {
      medicineSubtotalAfterDiscount += itemTotal - itemDiscount;
    }
  }

  let cartDiscount = 0;
  let cartDiscountTier = null;
  for (const tier of CART_DISCOUNT_TIERS) {
    if (medicineSubtotalAfterDiscount >= tier.threshold) {
      cartDiscount = medicineSubtotalAfterDiscount * tier.rate;
      cartDiscountTier = tier;
      break;
    }
  }

  const totalSavings = Math.round((categoryDiscount + cartDiscount) * 100) / 100;
  const totalAmount = Math.round((subtotal - totalSavings) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    categoryDiscount: Math.round(categoryDiscount * 100) / 100,
    cartDiscount: Math.round(cartDiscount * 100) / 100,
    cartDiscountTier,
    totalSavings,
    totalAmount,
    medicineSubtotalAfterDiscount: Math.round(medicineSubtotalAfterDiscount * 100) / 100,
  };
}

export default function Cart() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { 
    items, 
    updateQuantity, 
    removeItem, 
    clearCart,
    prescriptionImage,
    setPrescriptionImage,
    scheduleHDeclaration,
    setScheduleHDeclaration,
    hasScheduleH,
    hasScheduleH1,
    requiresPrescription,
    requiresDeclarationOrPrescription
  } = useCart();

  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [location, setLocation] = useState({ latitude: 0, longitude: 0 });
  const [locationError, setLocationError] = useState(null);

  const discounts = calculateDiscounts(items);

  const getLocation = () => {
    setLocationLoading(true);
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLocationLoading(false);
        toast.success('Location captured successfully');
      },
      (error) => {
        setLocationError('Unable to get your location. Please enable location access.');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      try {
        const base64 = await fileToBase64(file);
        setPrescriptionImage(base64);
        toast.success('Prescription uploaded');
      } catch (err) {
        toast.error('Failed to upload prescription');
      }
    }
  };

  const canPlaceOrder = () => {
    if (items.length === 0) return false;
    if (!address.trim()) return false;
    if (location.latitude === 0 && location.longitude === 0) return false;
    if (requiresPrescription && !prescriptionImage) return false;
    if (requiresDeclarationOrPrescription && !prescriptionImage && !scheduleHDeclaration) return false;
    return true;
  };

  const handlePlaceOrder = async () => {
    if (!canPlaceOrder()) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        items: items.map((item) => ({
          medicine_id: item.id,
          quantity: item.quantity
        })),
        prescription_image: prescriptionImage,
        schedule_h_declaration: scheduleHDeclaration,
        delivery_address: address,
        latitude: location.latitude,
        longitude: location.longitude
      };

      await orderAPI.create(orderData);
      clearCart();
      toast.success('Order placed successfully!');
      navigate('/orders');
    } catch (err) {
      const message = err.response?.data?.detail || 'Failed to place order';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryDiscountLabel = (productType) => {
    const rate = CATEGORY_DISCOUNTS[productType];
    if (!rate) return null;
    return `${Math.round(rate * 100)}% OFF`;
  };

  if (items.length === 0) {
    return (
      <div className="mobile-container bg-white min-h-screen pb-20">
        <div className="sticky-header px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/">
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </Link>
            <h1 className="text-lg font-semibold">Your Cart</h1>
          </div>
        </div>

        <div className="empty-state mt-12">
          <ShoppingCart className="empty-state-icon mx-auto" />
          <h3 className="empty-state-title">Your cart is empty</h3>
          <p className="empty-state-text mb-4">Add medicines to get started</p>
          <Link to="/">
            <Button className="bg-[#0F62FE] hover:bg-[#0353E9]">Browse Medicines</Button>
          </Link>
        </div>

        <nav className="bottom-nav">
          <div className="flex justify-around items-center">
            <Link to="/" className="bottom-nav-item" data-testid="nav-home">
              <Home className="h-5 w-5" />
              <span>Home</span>
            </Link>
            <Link to="/orders" className="bottom-nav-item" data-testid="nav-orders">
              <ClipboardList className="h-5 w-5" />
              <span>Orders</span>
            </Link>
            <Link to="/cart" className="bottom-nav-item active" data-testid="nav-cart">
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

  return (
    <div className="mobile-container bg-[#F4F7F6] min-h-screen pb-24">
      {/* Header */}
      <div className="sticky-header px-4 py-4 bg-white">
        <div className="flex items-center gap-3">
          <Link to="/">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </Link>
          <h1 className="text-lg font-semibold">Your Cart ({items.length})</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Cart Items */}
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Items</h2>
          <div className="space-y-3">
            {items.map((item) => {
              const discountLabel = getCategoryDiscountLabel(item.product_type || 'Medicine');
              const itemTotal = (item.price || 0) * item.quantity;
              const catRate = CATEGORY_DISCOUNTS[item.product_type || 'Medicine'] || 0;
              const discountedPrice = item.price * (1 - catRate);

              return (
                <div 
                  key={item.id} 
                  className="flex items-center gap-3 pb-3 border-b last:border-0 last:pb-0"
                  data-testid={`cart-item-${item.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      {item.bucket && (
                        <Badge className={`${getBucketClass(item.bucket)} text-[10px]`}>
                          {getBucketName(item.bucket)}
                        </Badge>
                      )}
                      {discountLabel && (
                        <Badge className="bg-green-100 text-green-700 text-[10px] border-green-200">
                          {discountLabel}
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-medium text-sm truncate">{item.name}</h4>
                    <p className="text-xs text-gray-500">{item.strength} {item.pack_size || item.form}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {catRate > 0 ? (
                        <>
                          <span className="text-xs text-gray-400 line-through">{formatCurrency(item.price)}</span>
                          <span className="text-sm font-medium text-green-700">{formatCurrency(discountedPrice)}</span>
                          <span className="text-xs text-gray-500">x {item.quantity}</span>
                        </>
                      ) : (
                        <span className="text-sm font-medium text-[#0F62FE]">{formatCurrency(item.price)} x {item.quantity}</span>
                      )}
                    </div>
                  </div>
                  <div className="qty-control">
                    <button 
                      className="qty-btn"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      data-testid={`qty-minus-${item.id}`}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="qty-value">{item.quantity}</span>
                    <button 
                      className="qty-btn"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      data-testid={`qty-plus-${item.id}`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                    data-testid={`remove-item-${item.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Discount Breakdown */}
        <Card className="p-4" data-testid="discount-breakdown">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-green-600" />
            Bill Summary
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal (MRP)</span>
              <span data-testid="subtotal">{formatCurrency(discounts.subtotal)}</span>
            </div>
            
            {discounts.categoryDiscount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Category Discount</span>
                <span data-testid="category-discount">-{formatCurrency(discounts.categoryDiscount)}</span>
              </div>
            )}

            {discounts.cartDiscount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>
                  Cart Discount (extra {Math.round(discounts.cartDiscountTier.rate * 100)}%)
                </span>
                <span data-testid="cart-discount">-{formatCurrency(discounts.cartDiscount)}</span>
              </div>
            )}

            {/* Show cart discount eligibility hint */}
            {discounts.cartDiscount === 0 && discounts.medicineSubtotalAfterDiscount > 0 && discounts.medicineSubtotalAfterDiscount < 2000 && (
              <div className="bg-blue-50 rounded-lg p-2 text-xs text-blue-700 flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5 shrink-0" />
                Add {formatCurrency(2000 - discounts.medicineSubtotalAfterDiscount)} more in medicines for extra 5% off
              </div>
            )}
            {discounts.cartDiscount > 0 && discounts.cartDiscountTier?.rate === 0.05 && discounts.medicineSubtotalAfterDiscount < 3000 && (
              <div className="bg-blue-50 rounded-lg p-2 text-xs text-blue-700 flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5 shrink-0" />
                Add {formatCurrency(3000 - discounts.medicineSubtotalAfterDiscount)} more in medicines for extra 10% off
              </div>
            )}

            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold">To Pay</span>
                <span className="text-lg font-bold text-[#0F62FE]" data-testid="total-amount">
                  {formatCurrency(discounts.totalAmount)}
                </span>
              </div>
            </div>

            {discounts.totalSavings > 0 && (
              <div className="bg-green-50 rounded-lg p-2 text-center" data-testid="total-savings">
                <span className="text-green-700 text-sm font-semibold">
                  You save {formatCurrency(discounts.totalSavings)} on this order!
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Prescription Requirements */}
        {(hasScheduleH || hasScheduleH1) && (
          <Card className="p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Prescription Required
            </h2>

            {hasScheduleH1 && (
              <div className="notice notice-error mb-3">
                <strong>Schedule H1 Medicine:</strong> Prescription upload is mandatory.
              </div>
            )}

            {hasScheduleH && !hasScheduleH1 && (
              <div className="notice notice-warning mb-3">
                <strong>Schedule H Medicine:</strong> Upload prescription or confirm you have a valid one.
              </div>
            )}

            {/* File Upload */}
            <div className="mb-4">
              <Label className="mb-2 block">Upload Prescription</Label>
              <label className={`upload-area cursor-pointer block ${prescriptionImage ? 'has-file' : ''}`}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  data-testid="prescription-upload"
                />
                {prescriptionImage ? (
                  <div className="text-green-600">
                    <Upload className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Prescription uploaded</p>
                    <button 
                      onClick={(e) => { e.preventDefault(); setPrescriptionImage(null); }}
                      className="text-xs text-red-500 mt-1"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="text-gray-500">
                    <Upload className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Tap to upload prescription</p>
                    <p className="text-xs">JPG, PNG up to 5MB</p>
                  </div>
                )}
              </label>
            </div>

            {/* Declaration for Schedule H */}
            {hasScheduleH && !hasScheduleH1 && !prescriptionImage && (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="declaration"
                  checked={scheduleHDeclaration}
                  onCheckedChange={(checked) => setScheduleHDeclaration(checked)}
                  data-testid="schedule-h-declaration"
                />
                <label htmlFor="declaration" className="text-sm text-gray-700">
                  I confirm that I have a valid prescription for the Schedule H medicine(s) in this order.
                </label>
              </div>
            )}
          </Card>
        )}

        {/* Delivery Address */}
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Delivery Details</h2>
          
          <div className="mb-4">
            <Label htmlFor="address" className="mb-2 block">Delivery Address</Label>
            <Textarea
              id="address"
              data-testid="delivery-address"
              placeholder="Enter your complete delivery address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label className="mb-2 block">Location</Label>
            {location.latitude !== 0 ? (
              <div className="notice notice-success">
                <MapPin className="h-4 w-4 inline mr-2" />
                Location captured
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={getLocation}
                disabled={locationLoading}
                className="w-full"
                data-testid="get-location-btn"
              >
                {locationLoading ? (
                  <div className="spinner h-4 w-4 mr-2" />
                ) : (
                  <MapPin className="h-4 w-4 mr-2" />
                )}
                Allow Location Access
              </Button>
            )}
            {locationError && (
              <p className="text-sm text-red-500 mt-2">{locationError}</p>
            )}
          </div>
        </Card>

        {/* Notice */}
        <div className="notice notice-info">
          <strong>Note:</strong> A registered pharmacist will review your order before dispatch.
        </div>
      </div>

      {/* Place Order Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 max-w-[480px] mx-auto">
        <Button
          onClick={handlePlaceOrder}
          disabled={!canPlaceOrder() || loading}
          className="w-full bg-[#0F62FE] hover:bg-[#0353E9] h-12"
          data-testid="place-order-btn"
        >
          {loading ? (
            <div className="spinner h-5 w-5" />
          ) : (
            `Place Order · ${formatCurrency(discounts.totalAmount)}`
          )}
        </Button>
      </div>
    </div>
  );
}
