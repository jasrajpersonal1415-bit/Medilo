import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Phone, User, ArrowRight, AlertCircle } from 'lucide-react';
import { isValidPhone } from '../../lib/utils';

export default function CustomerLogin() {
  const navigate = useNavigate();
  const { loginCustomer, registerCustomer } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isValidPhone(phone)) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    if (isRegister && !name.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await registerCustomer(phone, name.trim());
      } else {
        await loginCustomer(phone);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
      if (err.message.includes('not registered')) {
        setIsRegister(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-container flex flex-col min-h-screen bg-[#F4F7F6]">
      {/* Header */}
      <div className="bg-white px-6 py-8 border-b border-gray-200">
        <div className="medilo-logo text-center">MEDILO</div>
        <p className="text-center text-sm text-gray-600 mt-2">Healthcare at your doorstep</p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-sm shadow-sm animate-fade-in">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold text-center">
              {isRegister ? 'Create Account' : 'Welcome Back'}
            </CardTitle>
            <CardDescription className="text-center">
              {isRegister
                ? 'Enter your details to get started'
                : 'Enter your phone number to continue'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="name"
                      data-testid="customer-name-input"
                      type="text"
                      placeholder="Enter your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    data-testid="customer-phone-input"
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
                data-testid="customer-login-btn"
                className="w-full bg-[#0F62FE] hover:bg-[#0353E9]"
                disabled={loading}
              >
                {loading ? (
                  <div className="spinner h-5 w-5" />
                ) : (
                  <>
                    {isRegister ? 'Create Account' : 'Continue'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError('');
                }}
                className="text-sm text-[#0F62FE] hover:underline"
              >
                {isRegister
                  ? 'Already have an account? Login'
                  : "Don't have an account? Register"}
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
              <Link
                to="/staff/login"
                className="block text-center text-sm text-gray-500 hover:text-gray-700"
              >
                Staff / Pharmacist Login →
              </Link>
              <Link
                to="/delivery/login"
                className="block text-center text-sm text-gray-500 hover:text-gray-700"
              >
                Delivery Partner Login →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-xs text-gray-500">
        <p>By continuing, you agree to MEDILO's Terms of Service</p>
      </div>
    </div>
  );
}
