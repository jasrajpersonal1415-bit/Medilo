import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { ArrowRight, AlertCircle, Truck, MapPin, PackageCheck, Briefcase } from 'lucide-react';
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
      setError('Please enter a valid 10-digit mobile number');
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
    <div className="mobile-container min-h-screen bg-[#F4F7F6] flex flex-col">
      {/* Brand header */}
      <div className="px-6 pt-10 pb-5 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0F62FE] mb-3 shadow-sm">
          <Truck className="h-7 w-7 text-white" />
        </div>
        <div className="medilo-logo text-2xl tracking-tight">MEDILO</div>
        <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#0F62FE] bg-[#0F62FE]/10 px-2.5 py-1 rounded-full">
          <PackageCheck className="h-3 w-3" /> Delivery Partner Portal
        </div>
      </div>

      {/* Auth card */}
      <div className="flex-1 px-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-fade-in">
          <h1 className="text-xl font-semibold text-[#161616]">Partner Sign In</h1>
          <p className="text-sm text-[#525252] mt-1 mb-5">Enter your registered mobile number to access your delivery queue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-[#525252]">Mobile Number</label>
              <div className="mt-1.5 flex items-stretch rounded-lg border border-gray-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#0F62FE] focus-within:border-[#0F62FE] transition">
                <span className="flex items-center px-3 bg-[#F4F7F6] text-sm font-medium text-[#525252] border-r border-gray-200">+91</span>
                <input
                  data-testid="delivery-phone-input"
                  type="tel"
                  inputMode="numeric"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  className="flex-1 bg-transparent px-3 py-2.5 text-sm text-[#161616] outline-none placeholder:text-gray-400"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-[#DA1E28] bg-[#DA1E28]/5 border border-[#DA1E28]/20 p-3 rounded-lg" data-testid="login-error">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              data-testid="delivery-login-btn"
              className="w-full h-11 bg-[#0F62FE] hover:bg-[#0353E9] text-base font-medium"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2"><span className="spinner h-4 w-4" /> Verifying...</span>
              ) : (
                <>Verify &amp; Access Queue <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </form>

          <div className="mt-5 flex items-start gap-2 text-[11px] text-[#525252] bg-[#F4F7F6] border border-gray-200 rounded-lg p-3">
            <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-[#0F62FE]" />
            <span>Partner accounts are provisioned by MEDILO Operations. Contact your coordinator if you need access.</span>
          </div>
        </div>
      </div>

      {/* Role portal switcher */}
      <div className="px-6 py-6">
        <p className="text-center text-[11px] uppercase tracking-wider text-gray-400 mb-3">Other portals</p>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/login"
            data-testid="goto-customer-login"
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-3 text-sm font-medium text-[#161616] hover:border-[#0F62FE] hover:text-[#0F62FE] transition-colors"
          >
            <PackageCheck className="h-4 w-4" /> Customer
          </Link>
          <Link
            to="/staff/login"
            data-testid="goto-staff-login"
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-3 text-sm font-medium text-[#161616] hover:border-[#0F62FE] hover:text-[#0F62FE] transition-colors"
          >
            <Briefcase className="h-4 w-4" /> Staff / Ops
          </Link>
        </div>
      </div>
    </div>
  );
}
