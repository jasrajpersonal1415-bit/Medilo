import React, { useState, useEffect, useCallback } from 'react';
import { opsAPI } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../../../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '../../../components/ui/dialog';
import {
  Users, Search, Eye, MapPin, Heart, FileText, ClipboardList,
  Headphones, Bell, BarChart3, Send, IndianRupee, Package, TrendingUp, X, Phone
} from 'lucide-react';
import { formatCurrency, formatDateTime, getStatusName, getStatusClass } from '../../../lib/utils';
import { toast } from 'sonner';
import { TICKET_STATUSES, ticketStatusClass, Empty } from './shared';

export default function SupportTab() {
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState(null);

  const load = useCallback(async (status) => {
    setLoading(true);
    try {
      const res = await opsAPI.listTickets(status && status !== 'all' ? status : undefined);
      setTickets(res.data);
    } catch (err) {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(statusFilter); }, [load, statusFilter]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Label className="text-sm">Filter:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" data-testid="ticket-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tickets</SelectItem>
            {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : tickets.length === 0 ? (
        <Empty text="No support tickets" />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm" data-testid="tickets-table">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Ticket</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Subject</th>
                <th className="text-left px-4 py-3">Updated</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t hover:bg-gray-50" data-testid={`ticket-row-${t.id}`}>
                  <td className="px-4 py-3 font-mono text-xs">{t.ticket_number}</td>
                  <td className="px-4 py-3">{t.customer_name || '—'}<br/><span className="text-xs text-gray-400">{t.customer_phone}</span></td>
                  <td className="px-4 py-3 text-gray-600">{t.category}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate">{t.subject}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(t.updated_at)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={ticketStatusClass(t.status)}>{t.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button size="sm" variant="outline" onClick={() => setActiveTicket(t.id)} data-testid={`open-ticket-${t.id}`}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTicket && (
        <TicketDialog
          ticketId={activeTicket}
          onClose={() => setActiveTicket(null)}
          onChanged={() => load(statusFilter)}
        />
      )}
    </div>
  );
}


function TicketDialog({ ticketId, onClose, onChanged }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await opsAPI.getTicket(ticketId);
      setTicket(res.data);
      setStatus(res.data.status);
    } catch (err) {
      toast.error('Failed to load ticket');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [ticketId, onClose]);

  useEffect(() => { load(); }, [load]);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await opsAPI.replyTicket(ticketId, reply.trim());
      setReply('');
      toast.success('Reply sent');
      await load();
      onChanged && onChanged();
    } catch (err) {
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    try {
      await opsAPI.updateTicketStatus(ticketId, newStatus);
      toast.success(`Status set to ${newStatus}`);
      await load();
      onChanged && onChanged();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-auto" data-testid="ticket-dialog">
        <DialogHeader>
          <DialogTitle>{loading || !ticket ? 'Ticket' : ticket.subject}</DialogTitle>
          <DialogDescription>
            {ticket ? `${ticket.ticket_number} · ${ticket.category}` : 'Loading ticket conversation'}
          </DialogDescription>
        </DialogHeader>

        {loading || !ticket ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-600">
                {ticket.customer_name} · {ticket.customer_phone}
              </div>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-36 h-8 text-xs" data-testid="ticket-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 max-h-64 overflow-auto bg-gray-50 rounded-lg p-3" data-testid="ticket-messages">
              {(ticket.messages || []).map((m, i) => (
                <div key={i} className={`flex ${m.sender === 'customer' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    m.sender === 'customer' ? 'bg-white border' : m.sender === 'system' ? 'bg-gray-200 text-gray-600' : 'bg-[#0F62FE] text-white'
                  }`}>
                    <p>{m.message}</p>
                    <p className={`text-[10px] mt-1 ${m.sender === 'support' ? 'text-blue-100' : 'text-gray-400'}`}>
                      {m.sender === 'customer' ? 'Customer' : m.sender === 'system' ? 'System' : 'Support'} · {formatDateTime(m.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your reply..."
                rows={2}
                data-testid="ticket-reply-input"
              />
              <div className="flex justify-end mt-2">
                <Button onClick={handleReply} disabled={sending || !reply.trim()} className="bg-[#0F62FE] hover:bg-[#0353E9]" data-testid="ticket-reply-btn">
                  <Send className="h-4 w-4 mr-1.5" /> {sending ? 'Sending...' : 'Send Reply'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

