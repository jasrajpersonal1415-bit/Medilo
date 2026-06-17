import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '../../components/ui/dialog';
import { 
  ArrowLeft, Plus, FileText, Trash2, Eye, Download, Upload, X, Image, File
} from 'lucide-react';
import { toast } from 'sonner';

export default function Prescriptions() {
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { fetchPrescriptions(); }, []);

  const fetchPrescriptions = async () => {
    try {
      const res = await customerAPI.getPrescriptions();
      setPrescriptions(res.data);
    } catch (err) {
      toast.error('Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be less than 10MB');
      return;
    }
    setUploading(true);
    try {
      await customerAPI.uploadPrescription(file);
      toast.success('Prescription uploaded');
      fetchPrescriptions();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (id) => {
    try {
      await customerAPI.deletePrescription(id);
      setPrescriptions(prescriptions.filter(p => p.id !== id));
      toast.success('Prescription deleted');
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleView = (item) => {
    setViewItem(item);
    setViewOpen(true);
  };

  const handleDownload = (item) => {
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/files/${item.file_path}`;
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', item.file_name || 'prescription');
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 200);
  };

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isImage = (type) => type?.startsWith('image/');

  return (
    <div className="mobile-container bg-[#F4F7F6] min-h-screen pb-6">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/profile')} data-testid="prescriptions-back-btn">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold">My Prescriptions</h1>
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleUpload} className="hidden" data-testid="prescription-file-input" />
          <Button
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="bg-[#0F62FE] hover:bg-[#0353E9] h-8"
            data-testid="upload-prescription-btn"
          >
            {uploading ? <div className="spinner h-4 w-4" /> : <><Plus className="h-4 w-4 mr-1" /> Upload</>}
          </Button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : prescriptions.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-500">No Prescriptions</h3>
            <p className="text-sm text-gray-400 mt-1">Upload prescriptions to use while ordering</p>
            <Button
              onClick={() => fileRef.current?.click()}
              className="mt-4 bg-[#0F62FE] hover:bg-[#0353E9]"
              data-testid="upload-first-prescription-btn"
            >
              <Upload className="h-4 w-4 mr-2" /> Upload Prescription
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {prescriptions.map((item) => (
              <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm flex gap-3" data-testid={`prescription-card-${item.id}`}>
                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {isImage(item.file_type) ? (
                    <img
                      src={`${process.env.REACT_APP_BACKEND_URL}/api/files/${item.file_path}`}
                      alt="Prescription"
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <File className="h-6 w-6 text-gray-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.file_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{formatDate(item.created_at)}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{formatSize(item.file_size)}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] mt-1">
                    {item.file_type?.split('/')[1]?.toUpperCase() || 'FILE'}
                  </Badge>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  {isImage(item.file_type) && (
                    <button onClick={() => handleView(item)} className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100" data-testid={`view-prescription-${item.id}`}>
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => handleDownload(item)} className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center text-green-600 hover:bg-green-100" data-testid={`download-prescription-${item.id}`}>
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100" data-testid={`delete-prescription-${item.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="truncate text-sm">{viewItem?.file_name}</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="py-2">
              <img
                src={`${process.env.REACT_APP_BACKEND_URL}/api/files/${viewItem.file_path}`}
                alt="Prescription"
                className="w-full rounded-lg max-h-[60vh] object-contain"
              />
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handleDownload(viewItem)}>
                  <Download className="h-4 w-4 mr-1" /> Download
                </Button>
                <Button size="sm" variant="outline" className="text-red-500" onClick={() => { handleDelete(viewItem.id); setViewOpen(false); }}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
