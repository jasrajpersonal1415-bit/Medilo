import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { isValidEmail } from '../../lib/utils';

export default function StaffLogin() {
  const navigate = useNavigate();
  const { loginStaff } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      // Redirect based on role
      if (user.role === 'pharmacist') {
        navigate('/pharmacist/dashboard');
      } else if (user.role === 'pharmacy_staff') {
        navigate('/pharmacy/dashboard');
      } else if (user.role === 'ops') {
        navigate('/ops/dashboard');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F7F6] p-6">
      <Card className="w-full max-w-md shadow-sm animate-fade-in">
        <CardHeader className="space-y-1 pb-4">
          <div className="medilo-logo text-center mb-4">MEDILO</div>
          <CardTitle className="text-xl font-semibold text-center">Staff Login</CardTitle>
          <CardDescription className="text-center">
            For Pharmacists, Pharmacy Staff, and Operations Team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  data-testid="staff-email-input"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  data-testid="staff-password-input"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
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
              data-testid="staff-login-btn"
              className="w-full bg-[#0F62FE] hover:bg-[#0353E9]"
              disabled={loading}
            >
              {loading ? <div className="spinner h-5 w-5" /> : 'Login'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <Link
              to="/login"
              className="block text-center text-sm text-gray-500 hover:text-gray-700"
            >
              ← Customer Login
            </Link>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-md">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> Staff accounts are created by MEDILO Operations team. 
              Contact your administrator if you need access.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
