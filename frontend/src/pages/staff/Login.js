import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import {
  Mail, Lock, AlertCircle, Eye, EyeOff, ShieldCheck,
  FileCheck2, Activity, ArrowRight
} from 'lucide-react';
import { isValidEmail } from '../../lib/utils';

const COMPLIANCE = [
  { icon: ShieldCheck, text: 'Licensed pharmacist verification active' },
  { icon: FileCheck2, text: 'Schedule H / H1 audit logging enabled' },
  { icon: Lock, text: 'Encrypted patient & order records' },
];

export default function StaffLogin() {
  const navigate = useNavigate();
  const { loginStaff } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }
    setLoading(true);
    try {
      const user = await loginStaff(email, password);
      if (user.role === 'pharmacist') navigate('/pharmacist/dashboard');
      else if (user.role === 'pharmacy_staff') navigate('/pharmacy/dashboard');
      else if (user.role === 'ops') navigate('/ops/dashboard');
      else navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F4F7F6]">
      {/* Left brand & compliance panel (desktop) */}
      <div className="hidden lg:flex lg:w-5/12 bg-[#161616] text-white flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F62FE]">
              <span className="text-white text-2xl font-bold leading-none">+</span>
            </div>
            <span className="text-xl font-bold tracking-tight">MEDILO</span>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 text-[11px] font-medium text-[#42BE65] bg-[#42BE65]/10 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#42BE65] animate-pulse" />
            MEDILO v2 &bull; System Operational
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-semibold tracking-tight leading-snug">
            Clinical operations,<br />under control.
          </h2>
          <p className="text-sm text-gray-400 mt-3 max-w-sm leading-relaxed">
            Secure workspace for pharmacists, pharmacy staff and operations. Every action is logged and auditable.
          </p>
          <div className="mt-8 space-y-3.5">
            {COMPLIANCE.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-[#0F62FE]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm text-gray-300">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Activity className="h-3.5 w-3.5" /> Closed Pilot &bull; 300 verified users
        </div>
      </div>

      {/* Right auth form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-6">
            <div className="medilo-logo text-2xl">MEDILO</div>
            <p className="text-sm text-[#525252] mt-1">Staff &amp; Operations Portal</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-7 animate-fade-in">
            <h1 className="text-xl font-semibold text-[#161616]">Staff Sign In</h1>
            <p className="text-sm text-[#525252] mt-1 mb-5">Authorized clinical &amp; ops personnel only</p>

            {/* Role legend */}
            <div className="flex flex-wrap gap-1.5 mb-5">
              {['Pharmacist', 'Pharmacy Staff', 'Operations'].map((r) => (
                <span key={r} className="text-[11px] font-medium text-[#525252] bg-[#F4F7F6] border border-gray-200 px-2.5 py-1 rounded-full">
                  {r}
                </span>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-[#525252]">Email Address</label>
                <div className="mt-1.5 flex items-center rounded-lg border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-[#0F62FE] focus-within:border-[#0F62FE] transition">
                  <span className="pl-3 text-gray-400"><Mail className="h-4 w-4" /></span>
                  <input
                    data-testid="staff-email-input"
                    type="email"
                    placeholder="you@medilo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 bg-transparent px-3 py-2.5 text-sm text-[#161616] outline-none placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-[#525252]">Password</label>
                <div className="mt-1.5 flex items-center rounded-lg border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-[#0F62FE] focus-within:border-[#0F62FE] transition">
                  <span className="pl-3 text-gray-400"><Lock className="h-4 w-4" /></span>
                  <input
                    data-testid="staff-password-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex-1 bg-transparent px-3 py-2.5 text-sm text-[#161616] outline-none placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="px-3 text-gray-400 hover:text-[#161616]"
                    data-testid="toggle-password-visibility"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
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
                data-testid="staff-login-btn"
                className="w-full h-11 bg-[#0F62FE] hover:bg-[#0353E9] text-base font-medium"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2"><span className="spinner h-4 w-4" /> Verifying...</span>
                ) : (
                  <>Sign in to Workspace <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            </form>

            <div className="mt-5 flex items-start gap-2 text-[11px] text-[#525252] bg-[#F4F7F6] border border-gray-200 rounded-lg p-3">
              <ShieldCheck className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-[#0F62FE]" />
              <span>Restricted access. All activity is logged for compliance. Staff accounts are provisioned by MEDILO Operations.</span>
            </div>

            <div className="mt-5 pt-5 border-t border-gray-200 flex items-center justify-center gap-4 text-sm">
              <Link to="/login" className="text-[#525252] hover:text-[#0F62FE]" data-testid="goto-customer-login">Customer Portal</Link>
              <span className="text-gray-300">|</span>
              <Link to="/delivery/login" className="text-[#525252] hover:text-[#0F62FE]" data-testid="goto-delivery-login">Delivery Portal</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
