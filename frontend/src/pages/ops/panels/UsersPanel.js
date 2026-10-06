import React from 'react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Plus, Truck } from 'lucide-react';
import { formatDateTime } from '../../../lib/utils';

export default function UsersPanel({ users, loading, onAddDelivery, onAddStaff, onToggleStatus }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-gray-500">Manage all user accounts</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onAddDelivery}
            className="bg-green-600 hover:bg-green-700"
            data-testid="add-delivery-btn"
          >
            <Truck className="h-4 w-4 mr-2" />
            Add Delivery Partner
          </Button>
          <Button
            onClick={onAddStaff}
            className="bg-[#0F62FE] hover:bg-[#0353E9]"
            data-testid="add-staff-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Staff
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
                <th>Contact</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}</td>
                  <td>
                    <p>{u.email || u.phone}</p>
                  </td>
                  <td>
                    <Badge variant="outline" className="capitalize">{u.role.replace('_', ' ')}</Badge>
                  </td>
                  <td>
                    <Badge className={u.is_active ? 'badge-approved' : 'badge-rejected'}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="text-xs">{formatDateTime(u.created_at)}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onToggleStatus(u.id)}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
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
