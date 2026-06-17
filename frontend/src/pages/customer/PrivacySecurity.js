import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { customerAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../../components/ui/dialog';
import { 
  ArrowLeft, Shield, FileText, Lock, Trash2, AlertTriangle, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

export default function PrivacySecurity() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [policyView, setPolicyView] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await customerAPI.requestDeleteAccount();
      toast.success('Account deletion request submitted. Our team will process it within 7 working days.');
      setDeleteDialogOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit request');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mobile-container bg-[#F4F7F6] min-h-screen pb-6">
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b sticky top-0 z-30">
        <button onClick={() => navigate('/profile')} data-testid="privacy-back-btn">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold">Privacy & Security</h1>
      </div>

      <div className="p-4 space-y-3">
        {/* Privacy Policy */}
        <div
          className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setPolicyView('privacy')}
          data-testid="privacy-policy-btn"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">Privacy Policy</p>
            <p className="text-xs text-gray-400">How we handle your data</p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </div>

        {/* Terms & Conditions */}
        <div
          className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setPolicyView('terms')}
          data-testid="terms-btn"
        >
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
            <Shield className="h-4 w-4 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">Terms & Conditions</p>
            <p className="text-xs text-gray-400">Terms of service</p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </div>

        {/* Account Security */}
        <div className="bg-white rounded-xl p-4 shadow-sm" data-testid="account-security">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
              <Lock className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Account Security</p>
              <p className="text-xs text-gray-400">Your account is secured with phone-based authentication</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1.5">
            <p>- Login via verified phone number</p>
            <p>- Session-based JWT authentication</p>
            <p>- All data encrypted in transit (HTTPS)</p>
            <p>- Prescription data stored securely</p>
          </div>
        </div>

        {/* Delete Account */}
        <div className="bg-white rounded-xl p-4 shadow-sm mt-6" data-testid="delete-account-section">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
              <Trash2 className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-600">Delete Account</p>
              <p className="text-xs text-gray-400">Permanently remove your account and data</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full text-red-500 border-red-200 hover:bg-red-50"
            onClick={() => setDeleteDialogOpen(true)}
            data-testid="delete-account-btn"
          >
            Request Account Deletion
          </Button>
        </div>
      </div>

      {/* Policy View Dialog */}
      <Dialog open={!!policyView} onOpenChange={() => setPolicyView(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{policyView === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-gray-600 space-y-4 leading-relaxed">
            {policyView === 'privacy' ? (
              <>
                <p><strong>Last Updated:</strong> January 2026</p>
                <p><strong>1. Information We Collect</strong><br/>We collect your phone number, name, delivery addresses, order history, and prescription images to provide our services.</p>
                <p><strong>2. How We Use Your Information</strong><br/>Your information is used to process orders, verify prescriptions through registered pharmacists, deliver products, and improve our services.</p>
                <p><strong>3. Data Sharing</strong><br/>We share your delivery details with assigned pharmacies and delivery partners only for order fulfillment. Prescription images are shared only with registered pharmacists for verification.</p>
                <p><strong>4. Data Security</strong><br/>All data is encrypted in transit. Prescription images are stored securely with access controls. We do not sell your personal data.</p>
                <p><strong>5. Data Retention</strong><br/>Order history and prescriptions are retained for regulatory compliance. You may request account deletion at any time.</p>
                <p><strong>6. Your Rights</strong><br/>You can access, update, or delete your personal data. Contact support@medilo.in for data-related requests.</p>
              </>
            ) : (
              <>
                <p><strong>Last Updated:</strong> January 2026</p>
                <p><strong>1. Service Description</strong><br/>MEDILO is a healthcare product delivery platform. All medicines are dispensed through licensed pharmacies and verified by registered pharmacists.</p>
                <p><strong>2. Prescription Medicines</strong><br/>Schedule H and H1 medicines require valid prescriptions. By ordering, you confirm you have a valid prescription from a licensed medical practitioner.</p>
                <p><strong>3. Pricing</strong><br/>All prices are set and controlled by MEDILO. Discounts are applied as per the prevailing discount policy and may change without notice.</p>
                <p><strong>4. Delivery</strong><br/>Delivery timelines are estimates. We are not liable for delays due to prescription verification, inventory issues, or force majeure.</p>
                <p><strong>5. Returns & Cancellation</strong><br/>Medicines cannot be returned once delivered as per regulatory requirements. Orders can be cancelled before pharmacy dispatch.</p>
                <p><strong>6. Limitation of Liability</strong><br/>MEDILO acts as a platform connecting customers with pharmacies. We ensure pharmacist verification but are not a substitute for medical advice.</p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Account?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-gray-600 space-y-2">
            <p>This will submit a request to permanently delete your account. This action includes:</p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>Removal of all personal data</li>
              <li>Deletion of saved addresses and prescriptions</li>
              <li>Loss of order history access</li>
              <li>Cancellation of any active orders</li>
            </ul>
            <p className="text-xs text-gray-500 mt-2">Processing takes up to 7 working days.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="confirm-delete-account-btn"
            >
              {deleting ? 'Submitting...' : 'Delete My Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
