import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Target, Mail, Globe, Smartphone } from 'lucide-react';

export default function AboutMedilo() {
  const navigate = useNavigate();

  return (
    <div className="mobile-container bg-[#F4F7F6] min-h-screen pb-6">
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-30">
        <button onClick={() => navigate('/profile')} data-testid="about-back-btn">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold">About MEDILO</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Hero */}
        <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#0F62FE]/10 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-bold text-[#0F62FE]">M</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">MEDILO</h2>
          <p className="text-sm text-gray-500 mt-1">Healthcare, Delivered Right</p>
          <p className="text-xs text-gray-400 mt-2">Version 1.0.0</p>
        </div>

        {/* About */}
        <div className="bg-white rounded-2xl p-5 shadow-sm" data-testid="about-company">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-[#0F62FE]" />
            <h3 className="font-semibold text-gray-800">About Us</h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            MEDILO is a healthcare technology startup based in India, building a reliable and disciplined 
            platform for medicine delivery. We connect customers with verified pharmacies and registered 
            pharmacists to ensure safe, compliant, and timely delivery of medicines and healthcare products.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mt-3">
            Our platform supports multiple product categories including Medicines, Wellness products, 
            Beauty & Personal Care, Baby Care, and Medical Devices — all with centralized quality control 
            and pricing.
          </p>
        </div>

        {/* Mission */}
        <div className="bg-white rounded-2xl p-5 shadow-sm" data-testid="about-mission">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-[#10B981]" />
            <h3 className="font-semibold text-gray-800">Our Mission</h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            To make healthcare accessible, affordable, and auditable for every Indian household. 
            We prioritize correctness over speed, ensuring every prescription is verified by a 
            registered pharmacist before dispatch.
          </p>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl p-5 shadow-sm" data-testid="about-contact">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="h-4 w-4 text-[#F59E0B]" />
            <h3 className="font-semibold text-gray-800">Contact Us</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-gray-400" />
              <a href="mailto:support@medilo.in" className="text-[#0F62FE]">support@medilo.in</a>
            </div>
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-gray-400" />
              <a href="tel:+911800123456" className="text-[#0F62FE]">1800-123-456 (Toll Free)</a>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-gray-400" />
              <span className="text-[#0F62FE]">www.medilo.in</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          &copy; {new Date().getFullYear()} MEDILO Healthcare Pvt. Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
}
