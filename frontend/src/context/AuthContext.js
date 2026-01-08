import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, deliveryAPI } from '../lib/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('medilo_token');
    const storedUser = localStorage.getItem('medilo_user');
    
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('medilo_token');
        localStorage.removeItem('medilo_user');
      }
    }
    setLoading(false);
  }, []);

  const loginCustomer = async (phone) => {
    setError(null);
    try {
      const response = await authAPI.customerLogin({ phone });
      const { access_token, user } = response.data;
      localStorage.setItem('medilo_token', access_token);
      localStorage.setItem('medilo_user', JSON.stringify(user));
      setUser(user);
      return user;
    } catch (err) {
      const message = err.response?.data?.detail || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  const registerCustomer = async (phone, name) => {
    setError(null);
    try {
      const response = await authAPI.customerRegister({ phone, name });
      const { access_token, user } = response.data;
      localStorage.setItem('medilo_token', access_token);
      localStorage.setItem('medilo_user', JSON.stringify(user));
      setUser(user);
      return user;
    } catch (err) {
      const message = err.response?.data?.detail || 'Registration failed';
      setError(message);
      throw new Error(message);
    }
  };

  const loginStaff = async (email, password) => {
    setError(null);
    try {
      const response = await authAPI.staffLogin({ email, password });
      const { access_token, user } = response.data;
      localStorage.setItem('medilo_token', access_token);
      localStorage.setItem('medilo_user', JSON.stringify(user));
      setUser(user);
      return user;
    } catch (err) {
      const message = err.response?.data?.detail || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  const registerStaff = async (data) => {
    setError(null);
    try {
      const response = await authAPI.staffRegister(data);
      const { access_token, user } = response.data;
      localStorage.setItem('medilo_token', access_token);
      localStorage.setItem('medilo_user', JSON.stringify(user));
      setUser(user);
      return user;
    } catch (err) {
      const message = err.response?.data?.detail || 'Registration failed';
      setError(message);
      throw new Error(message);
    }
  };

  const loginDeliveryPartner = async (phone) => {
    setError(null);
    try {
      const response = await deliveryAPI.login(phone);
      const { access_token, user } = response.data;
      localStorage.setItem('medilo_token', access_token);
      localStorage.setItem('medilo_user', JSON.stringify(user));
      setUser(user);
      return user;
    } catch (err) {
      const message = err.response?.data?.detail || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  const logout = () => {
    localStorage.removeItem('medilo_token');
    localStorage.removeItem('medilo_user');
    setUser(null);
  };

  const isCustomer = user?.role === 'customer';
  const isPharmacist = user?.role === 'pharmacist';
  const isPharmacyStaff = user?.role === 'pharmacy_staff';
  const isOps = user?.role === 'ops';
  const isDeliveryPartner = user?.role === 'delivery_partner';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        loginCustomer,
        registerCustomer,
        loginStaff,
        registerStaff,
        loginDeliveryPartner,
        logout,
        isCustomer,
        isPharmacist,
        isPharmacyStaff,
        isOps,
        isDeliveryPartner,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
