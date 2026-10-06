import React from 'react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Download } from 'lucide-react';
import { formatDateTime } from '../../../lib/utils';

export default function AuditPanel({
  auditLogs, loading, exportStartDate, exportEndDate,
  setExportStartDate, setExportEndDate, exporting, onExport,
}) {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Audit Logs</h1>
          <p className="text-gray-500">System activity trail</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-gray-500">From</Label>
            <Input
              type="date"
              value={exportStartDate}
              onChange={(e) => setExportStartDate(e.target.value)}
              className="w-40"
              data-testid="audit-export-start-date"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">To</Label>
            <Input
              type="date"
              value={exportEndDate}
              onChange={(e) => setExportEndDate(e.target.value)}
              className="w-40"
              data-testid="audit-export-end-date"
            />
          </div>
          <Button
            onClick={onExport}
            disabled={exporting}
            className="bg-[#0F62FE] hover:bg-[#0353E9]"
            data-testid="audit-export-csv-btn"
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export CSV'}
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
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity</th>
                <th>User Role</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="text-xs mono">{formatDateTime(log.timestamp)}</td>
                  <td className="font-medium">{log.action}</td>
                  <td>
                    <span className="text-xs text-gray-500">{log.entity_type}</span>
                    <p className="mono text-xs">{log.entity_id.slice(0, 8)}</p>
                  </td>
                  <td>
                    <Badge variant="outline" className="capitalize">{log.user_role.replace('_', ' ')}</Badge>
                  </td>
                  <td className="text-xs text-gray-500">
                    {log.details ? JSON.stringify(log.details).slice(0, 50) : '-'}
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
