import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import {
  BadgeCheck, Stethoscope, ShieldCheck, ArrowRight,
  AlertCircle, User, Truck, Briefcase
} from 'lucide-react';
import { isValidPhone } from '../../lib/utils';

const TRUST = [
  { icon: BadgeCheck, label: 'Verified Medicines' },
  { icon: Stethoscope, label: 'Licensed Pharmacists' },
  { icon: ShieldCheck, label: 'Secure & Audited' },
];

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
      setError('Please enter a valid 10-digit mobile number');
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
      if (err.message.includes('not registered')) setIsRegister(true);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (register) => {
    setIsRegister(register);
    setError('');
  };

  return (
    <div className="mobile-container min-h-screen bg-[#F4F7F6] flex flex-col">
      {/* Brand header */}
      <div className="px-6 pt-10 pb-5 text-center">
        <div className="medilo-logo text-2xl tracking-tight">MEDILO</div>
      </div>

      {/* Auth card */}
      <div className="flex-1 px-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-fade-in">
          {/* Segmented toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#F4F7F6] rounded-xl mb-5" role="tablist">
            <button
              type="button"
              data-testid="toggle-signin"
              onClick={() => switchMode(false)}
              className={`py-2 text-sm font-medium rounded-lg transition-colors ${!isRegister ? 'bg-white text-[#0F62FE] shadow-sm' : 'text-[#525252] hover:text-[#161616]'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              data-testid="toggle-register"
              onClick={() => switchMode(true)}
              className={`py-2 text-sm font-medium rounded-lg transition-colors ${isRegister ? 'bg-white text-[#0F62FE] shadow-sm' : 'text-[#525252] hover:text-[#161616]'}`}
            >
              Register
            </button>
          </div>

          <h1 className="text-xl font-semibold text-[#161616]">
            {isRegister ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-sm text-[#525252] mt-1 mb-5">
            {isRegister ? 'Enter your details to get started' : 'Enter your mobile number to continue'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-[#525252]">Full Name</label>
                <div className="mt-1.5 flex items-center rounded-lg border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-[#0F62FE] focus-within:border-[#0F62FE] transition">
                  <span className="pl-3 text-gray-400"><User className="h-4 w-4" /></span>
                  <input
                    data-testid="customer-name-input"
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 bg-transparent px-3 py-2.5 text-sm text-[#161616] outline-none placeholder:text-gray-400"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-[#525252]">Mobile Number</label>
              <div className="mt-1.5 flex items-stretch rounded-lg border border-gray-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#0F62FE] focus-within:border-[#0F62FE] transition">
                <span className="flex items-center px-3 bg-[#F4F7F6] text-sm font-medium text-[#525252] border-r border-gray-200">+91</span>
                <input
                  data-testid="customer-phone-input"
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
              data-testid="customer-login-btn"
              className="w-full h-11 bg-[#0F62FE] hover:bg-[#0353E9] text-base font-medium"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2"><span className="spinner h-4 w-4" /> Please wait...</span>
              ) : (
                <>{isRegister ? 'Create Account' : 'Continue'} <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </form>

          <p className="text-[11px] text-gray-400 text-center mt-4 leading-relaxed">
            By continuing you agree to MEDILO's Terms of Service &amp; Privacy Policy
          </p>
        </div>

        {/* Trust strip */}
        <div className="grid grid-cols-3 gap-2 mt-5">
          {TRUST.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center text-center gap-1.5 bg-white rounded-xl border border-gray-200 py-3 px-1">
              <Icon className="h-4 w-4 text-[#198038]" />
              <span className="text-[10px] font-medium text-[#525252] leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Role portal switcher */}
      <div className="px-6 py-6">
        <p className="text-center text-[11px] uppercase tracking-wider text-gray-400 mb-3">Other portals</p>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/staff/login"
            data-testid="goto-staff-login"
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-3 text-sm font-medium text-[#161616] hover:border-[#0F62FE] hover:text-[#0F62FE] transition-colors"
          >
            <Briefcase className="h-4 w-4" /> Staff / Ops
          </Link>
          <Link
            to="/delivery/login"
            data-testid="goto-delivery-login"
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-3 text-sm font-medium text-[#161616] hover:border-[#0F62FE] hover:text-[#0F62FE] transition-colors"
          >
            <Truck className="h-4 w-4" /> Delivery
          </Link>
        </div>
      </div>
    </div>
  );
}
