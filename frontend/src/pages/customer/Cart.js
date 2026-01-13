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
  AlertTriangle, ShoppingCart, Home, ClipboardList, User 
} from 'lucide-react';
import { getBucketClass, getBucketName, fileToBase64, formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

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
          <h2 className="font-semibold mb-3">Medicines</h2>
          <div className="space-y-3">
            {items.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center gap-3 pb-3 border-b last:border-0 last:pb-0"
                data-testid={`cart-item-${item.id}`}
              >
                <div className="flex-1 min-w-0">
                  <Badge className={`${getBucketClass(item.bucket)} text-xs mb-1`}>
                    {getBucketName(item.bucket)}
                  </Badge>
                  <h4 className="font-medium text-sm truncate">{item.name}</h4>
                  <p className="text-xs text-gray-500">{item.strength} • {item.pack_size || item.form}</p>
                  <p className="text-sm font-medium text-[#0F62FE]">{formatCurrency(item.price)} × {item.quantity}</p>
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
            ))}
          </div>
          
          {/* Order Total */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold text-[#0F62FE]">
                {formatCurrency(items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0))}
              </span>
            </div>
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
            'Place Order'
          )}
        </Button>
      </div>
    </div>
  );
}
