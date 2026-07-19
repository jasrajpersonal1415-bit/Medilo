import React from 'react';

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const fileUrl = (path) => path ? `${BACKEND_URL}/api/files/${path}` : null;

export const TICKET_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

export const ticketStatusClass = (status) => {
  switch (status) {
    case 'Open': return 'bg-blue-100 text-blue-700';
    case 'In Progress': return 'bg-amber-100 text-amber-700';
    case 'Resolved': return 'bg-green-100 text-green-700';
    case 'Closed': return 'bg-gray-100 text-gray-600';
    default: return 'bg-gray-100 text-gray-600';
  }
};

export function StatChip({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-lg px-2 py-2 text-center">
      <p className="text-sm font-bold text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}


export function AnalyticsCard({ icon: Icon, color, label, value }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}


export function Empty({ text }) {
  return <div className="text-center py-10 text-gray-400 text-sm">{text}</div>;
}
