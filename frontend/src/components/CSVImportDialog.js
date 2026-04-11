import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from './ui/dialog';
import { Upload, FileText, AlertTriangle, CheckCircle2, X, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';

const STEPS = ['Upload', 'Preview', 'Confirm', 'Import'];

export default function CSVImportDialog({ open, onOpenChange, onSuccess }) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validation, setValidation] = useState(null);
  const [result, setResult] = useState(null);
  const [previewPage, setPreviewPage] = useState(0);
  const fileRef = useRef(null);
  const ROWS_PER_PAGE = 50;

  const reset = () => {
    setStep(0);
    setFile(null);
    setValidating(false);
    setImporting(false);
    setValidation(null);
    setResult(null);
    setPreviewPage(0);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setFile(selected);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      if (!dropped.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setFile(dropped);
    }
  };

  const handleValidate = async () => {
    if (!file) return;
    setValidating(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/ops/products/import/validate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setValidation(res.data);
      setStep(1);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Validation failed';
      toast.error(msg);
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    if (!validation) return;
    setImporting(true);
    try {
      const res = await api.post('/ops/products/import/confirm', {
        rows: validation.all_data
      });
      setResult(res.data);
      setStep(3);
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const previewData = validation?.preview || [];
  const totalPages = Math.ceil(previewData.length / ROWS_PER_PAGE);
  const pagedData = previewData.slice(previewPage * ROWS_PER_PAGE, (previewPage + 1) * ROWS_PER_PAGE);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Products from CSV</DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 py-3 border-b" data-testid="csv-import-steps">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 text-sm font-medium ${
                i === step ? 'text-[#0F62FE]' : i < step ? 'text-green-600' : 'text-gray-400'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === step ? 'bg-[#0F62FE] text-white' : i < step ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                {s}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-gray-300" />}
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 overflow-auto py-4">
          {/* Step 0: Upload */}
          {step === 0 && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center cursor-pointer hover:border-[#0F62FE] hover:bg-blue-50/30 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                data-testid="csv-drop-zone"
              >
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">
                  {file ? file.name : 'Drop CSV file here or click to browse'}
                </p>
                {file && (
                  <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                  data-testid="csv-file-input"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p className="font-medium text-gray-800 mb-2">Required CSV Format:</p>
                <p className="font-mono text-xs bg-white p-2 rounded border mb-2">
                  Product Name, Category, Type, Batch, Expiry Date, Quantity, MRP, Purchase Price, Manufacturer
                </p>
                <ul className="space-y-1 text-xs">
                  <li><strong>Category:</strong> Medicine, Wellness, Beauty, or Device</li>
                  <li><strong>Type:</strong> OTC, SCHEDULE_H, or SCHEDULE_H1 (for Medicines only)</li>
                  <li><strong>Expiry Date:</strong> YYYY-MM-DD or DD-MM-YYYY</li>
                  <li><strong>Max rows:</strong> 10,000</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 1: Preview */}
          {step === 1 && validation && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{validation.total_rows}</p>
                  <p className="text-xs text-blue-600">Total Rows</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{validation.new_entries}</p>
                  <p className="text-xs text-green-600">New Products</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{validation.update_entries}</p>
                  <p className="text-xs text-amber-600">Updates (Qty Add)</p>
                </div>
                <div className={`rounded-lg p-3 text-center ${validation.errors.length > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className={`text-2xl font-bold ${validation.errors.length > 0 ? 'text-red-700' : 'text-gray-500'}`}>
                    {validation.errors.length}
                  </p>
                  <p className={`text-xs ${validation.errors.length > 0 ? 'text-red-600' : 'text-gray-500'}`}>Errors</p>
                </div>
              </div>

              {/* Errors */}
              {validation.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3" data-testid="csv-errors">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-medium text-red-800">Validation Errors ({validation.errors.length})</p>
                  </div>
                  <div className="max-h-32 overflow-auto space-y-1">
                    {validation.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-700">{e}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Duplicate warnings */}
              {validation.duplicates_in_csv?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-medium text-amber-800">Duplicates within CSV</p>
                  </div>
                  <div className="max-h-24 overflow-auto space-y-1">
                    {validation.duplicates_in_csv.map((d, i) => (
                      <p key={i} className="text-xs text-amber-700">{d}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Preview Table */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Category</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Batch</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Expiry</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">MRP</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Purchase</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Manufacturer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pagedData.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-xs text-gray-400">{row.row_num}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs">{row.product_type || '-'}</Badge>
                        </td>
                        <td className="px-3 py-2 text-xs">{row.bucket || '-'}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.batch}</td>
                        <td className="px-3 py-2 text-xs">{row.expiry_date}</td>
                        <td className="px-3 py-2 text-right">{row.quantity}</td>
                        <td className="px-3 py-2 text-right">{row.price != null ? `₹${row.price}` : '-'}</td>
                        <td className="px-3 py-2 text-right">{row.purchase_price != null ? `₹${row.purchase_price}` : '-'}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{row.manufacturer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Showing {previewPage * ROWS_PER_PAGE + 1}-{Math.min((previewPage + 1) * ROWS_PER_PAGE, previewData.length)} of {previewData.length} (preview capped at 100)</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={previewPage === 0} onClick={() => setPreviewPage(p => p - 1)}>Prev</Button>
                    <Button size="sm" variant="outline" disabled={previewPage >= totalPages - 1} onClick={() => setPreviewPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Confirm */}
          {step === 2 && validation && (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <FileText className="h-12 w-12 text-[#0F62FE] mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900">Ready to Import</h3>
                <p className="text-sm text-gray-500 mt-1">Please review the summary before confirming</p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-6 space-y-3 max-w-md mx-auto">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total rows</span>
                  <span className="font-semibold">{validation.total_rows}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">New products to create</span>
                  <span className="font-semibold text-green-700">{validation.new_entries}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Existing products to update</span>
                  <span className="font-semibold text-amber-700">{validation.update_entries}</span>
                </div>
                {validation.errors.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Rows with errors (skipped)</span>
                    <span className="font-semibold text-red-700">{validation.errors.length}</span>
                  </div>
                )}
                <hr />
                <p className="text-xs text-gray-500">
                  Duplicate handling: Same product + batch will have quantity added. Different batch creates a new entry.
                  Products sorted by expiry date.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Result */}
          {step === 3 && result && (
            <div className="space-y-6 py-4 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Import Complete</h3>
                <p className="text-sm text-gray-500 mt-1">Products are now available in the catalog</p>
              </div>
              <div className="bg-green-50 rounded-lg p-6 space-y-3 max-w-md mx-auto">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Products created</span>
                  <span className="font-semibold text-green-700">{result.created}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Products updated</span>
                  <span className="font-semibold text-amber-700">{result.updated}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total processed</span>
                  <span className="font-semibold">{result.total_processed}</span>
                </div>
                {result.errors?.length > 0 && (
                  <div className="mt-2 text-left">
                    <p className="text-xs font-medium text-red-700">Errors:</p>
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="border-t pt-4">
          {step === 0 && (
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleValidate}
                disabled={!file || validating}
                className="bg-[#0F62FE] hover:bg-[#0353E9]"
                data-testid="csv-validate-btn"
              >
                {validating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Validating...</> : 'Validate & Preview'}
              </Button>
            </div>
          )}
          {step === 1 && (
            <div className="flex justify-between w-full">
              <Button variant="outline" onClick={() => { setStep(0); setValidation(null); setFile(null); }}>
                Back
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={validation?.has_errors}
                className="bg-[#0F62FE] hover:bg-[#0353E9]"
                data-testid="csv-proceed-btn"
              >
                {validation?.has_errors ? 'Fix Errors First' : 'Proceed to Confirm'}
              </Button>
            </div>
          )}
          {step === 2 && (
            <div className="flex justify-between w-full">
              <Button variant="outline" onClick={() => setStep(1)}>Back to Preview</Button>
              <Button
                onClick={handleImport}
                disabled={importing}
                className="bg-green-600 hover:bg-green-700"
                data-testid="csv-confirm-import-btn"
              >
                {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing...</> : 'Confirm Import'}
              </Button>
            </div>
          )}
          {step === 3 && (
            <div className="flex justify-end w-full">
              <Button onClick={handleClose} className="bg-[#0F62FE] hover:bg-[#0353E9]" data-testid="csv-done-btn">
                Done
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
