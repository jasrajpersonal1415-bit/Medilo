import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Phone, ArrowRight, AlertCircle, Truck } from 'lucide-react';
import { isValidPhone } from '../../lib/utils';

export default function DeliveryLogin() {
  const navigate = useNavigate();
  const { loginDeliveryPartner } = useAuth();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isValidPhone(phone)) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      await loginDeliveryPartner(phone);
      navigate('/delivery/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-container flex flex-col min-h-screen bg-[#F4F7F6]">
      {/* Header */}
      <div className="bg-white px-6 py-8 border-b border-gray-200">
        <div className="flex items-center justify-center gap-2">
          <Truck className="h-8 w-8 text-[#0F62FE]" />
          <div className="medilo-logo">MEDILO</div>
        </div>
        <p className="text-center text-sm text-gray-600 mt-2">Delivery Partner</p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-sm shadow-sm animate-fade-in">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold text-center">
              Delivery Partner Login
            </CardTitle>
            <CardDescription className="text-center">
              Enter your registered phone number
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    data-testid="delivery-phone-input"
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="pl-10"
                    maxLength={10}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                data-testid="delivery-login-btn"
                className="w-full bg-[#0F62FE] hover:bg-[#0353E9]"
                disabled={loading}
              >
                {loading ? (
                  <div className="spinner h-5 w-5" />
                ) : (
                  <>
                    Login
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-md">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> Delivery partner accounts are created by MEDILO Operations. 
                Contact your coordinator if you need access.
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
              <Link
                to="/login"
                className="block text-center text-sm text-gray-500 hover:text-gray-700"
              >
                Customer Login →
              </Link>
              <Link
                to="/staff/login"
                className="block text-center text-sm text-gray-500 hover:text-gray-700"
              >
                Staff / Pharmacist Login →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-xs text-gray-500">
        <p>MEDILO Healthcare Delivery</p>
      </div>
    </div>
  );
}
