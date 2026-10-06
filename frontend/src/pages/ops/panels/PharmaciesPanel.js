import React from 'react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Plus } from 'lucide-react';

export default function PharmaciesPanel({ pharmacies, loading, onAddPharmacy }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Pharmacies</h1>
          <p className="text-gray-500">Manage registered pharmacies</p>
        </div>
        <Button
          onClick={onAddPharmacy}
          className="bg-[#0F62FE] hover:bg-[#0353E9]"
          data-testid="add-pharmacy-btn"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Pharmacy
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pharmacies.map((pharmacy) => (
            <Card key={pharmacy.id} className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{pharmacy.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500 mb-1">License: {pharmacy.license_number}</p>
                <p className="text-sm text-gray-700">{pharmacy.address}</p>
                <p className="text-sm text-gray-700">{pharmacy.city} - {pharmacy.pincode}</p>
                <p className="text-sm text-gray-500 mt-2">{pharmacy.phone}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
