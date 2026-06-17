import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { customerAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  ArrowLeft, Heart, ShoppingCart, Trash2, Package, Pill, Sparkles, Activity, Baby
} from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

const CATEGORY_CONFIG = {
  'Medicine': { icon: Pill, color: '#3B82F6', bg: '#EFF6FF' },
  'Beauty & Personal Care': { icon: Sparkles, color: '#EC4899', bg: '#FDF2F8' },
  'Wellness': { icon: Heart, color: '#10B981', bg: '#ECFDF5' },
  'Baby Care': { icon: Baby, color: '#F59E0B', bg: '#FFFBEB' },
  'Device': { icon: Activity, color: '#8B5CF6', bg: '#F5F3FF' },
};

export default function Wishlist() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchWishlist(); }, []);

  const fetchWishlist = async () => {
    try {
      const res = await customerAPI.getWishlist();
      setItems(res.data);
    } catch (err) {
      toast.error('Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (productId) => {
    try {
      await customerAPI.removeFromWishlist(productId);
      setItems(items.filter(i => i.product_id !== productId));
      toast.success('Removed from wishlist');
    } catch (err) {
      toast.error('Failed to remove');
    }
  };

  const handleMoveToCart = async (item) => {
    addItem({
      id: item.product_id,
      name: item.product_name,
      price: item.price,
      product_type: item.product_type,
      manufacturer: item.manufacturer,
      image_path: item.image_path,
    });
    await handleRemove(item.product_id);
    toast.success(`${item.product_name} moved to cart`);
  };

  return (
    <div className="mobile-container bg-[#F4F7F6] min-h-screen pb-6">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-30">
        <button onClick={() => navigate('/profile')} data-testid="wishlist-back-btn">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold">Wishlist</h1>
        {items.length > 0 && (
          <span className="text-sm text-gray-400 ml-auto">{items.length} items</span>
        )}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-500">Your Wishlist is Empty</h3>
            <p className="text-sm text-gray-400 mt-1">Save products you like for later</p>
            <Button onClick={() => navigate('/')} className="mt-4 bg-[#0F62FE] hover:bg-[#0353E9]">
              Browse Products
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const config = CATEGORY_CONFIG[item.product_type] || CATEGORY_CONFIG['Medicine'];
              const IconComp = config.icon;
              return (
                <div 
                  key={item.id} 
                  className="bg-white rounded-xl p-3 shadow-sm flex gap-3"
                  data-testid={`wishlist-item-${item.product_id}`}
                >
                  <div className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: config.bg }}>
                    {item.image_path ? (
                      <img 
                        src={`${process.env.REACT_APP_BACKEND_URL}/api/files/${item.image_path}`}
                        alt={item.product_name}
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                      />
                    ) : null}
                    <div className={`w-full h-full items-center justify-center ${item.image_path ? 'hidden' : 'flex'}`}>
                      <IconComp className="h-6 w-6" style={{ color: config.color }} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Badge variant="outline" className="text-[10px] mb-1">{item.product_type}</Badge>
                    <h4 className="text-sm font-medium text-gray-900 truncate">{item.product_name}</h4>
                    <p className="text-xs text-gray-400 truncate">{item.manufacturer}</p>
                    <p className="text-sm font-bold text-[#0F62FE] mt-1">{formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0 justify-center">
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs bg-[#0F62FE] hover:bg-[#0353E9]"
                      onClick={() => handleMoveToCart(item)}
                      data-testid={`move-to-cart-${item.product_id}`}
                    >
                      <ShoppingCart className="h-3 w-3 mr-1" />
                      Cart
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs text-red-500 hover:text-red-700"
                      onClick={() => handleRemove(item.product_id)}
                      data-testid={`remove-wishlist-${item.product_id}`}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
