import React from 'react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Plus, Pencil, Trash2, Upload } from 'lucide-react';
import { getBucketClass, getBucketName } from '../../../lib/utils';

export default function MedicinesPanel({ medicines, loading, onImportCSV, onAddMedicine, onAddProduct, onEdit, onDelete }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Medicines</h1>
          <p className="text-gray-500">Manage medicine catalog</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onImportCSV}
            variant="outline"
            data-testid="import-csv-btn"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button
            onClick={onAddMedicine}
            className="bg-[#0F62FE] hover:bg-[#0353E9]"
            data-testid="add-medicine-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Medicine
          </Button>
          <Button
            onClick={onAddProduct}
            variant="outline"
            data-testid="add-product-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Generic Name</th>
                <th>Type</th>
                <th>Category</th>
                <th>Strength</th>
                <th>Pack Size</th>
                <th>Price (₹)</th>
                <th>Manufacturer</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {medicines.map((med) => (
                <tr key={med.id}>
                  <td className="font-medium">{med.name}</td>
                  <td>{med.generic_name}</td>
                  <td>
                    <Badge variant="outline" className="text-xs">
                      {med.product_type || 'Medicine'}
                    </Badge>
                  </td>
                  <td>
                    {med.product_type === 'Medicine' && med.bucket ? (
                      <Badge className={getBucketClass(med.bucket)}>
                        {getBucketName(med.bucket)}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td>{med.strength || '-'}</td>
                  <td>{med.pack_size}</td>
                  <td className="font-medium">₹{med.price?.toFixed(2) || '0.00'}</td>
                  <td>{med.manufacturer}</td>
                  <td className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => onEdit(med)}
                      data-testid={`edit-medicine-${med.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => onDelete(med)}
                      data-testid={`delete-medicine-${med.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
