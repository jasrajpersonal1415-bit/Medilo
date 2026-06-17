import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../../components/ui/select';
import { 
  ArrowLeft, Plus, Headphones, MessageSquare, Clock, CheckCircle, 
  AlertCircle, Send, Phone, Mail, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  'Order Issue', 'Delivery Issue', 'Payment Issue', 
  'Product Issue', 'Prescription Issue', 'Account Issue', 'Other'
];

const STATUS_CONFIG = {
  'Open': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertCircle },
  'In Progress': { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock },
  'Resolved': { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
};

export default function Support() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ subject: '', category: 'Order Issue', description: '', order_id: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchTickets(); }, []);

  const fetchTickets = async () => {
    try {
      const res = await customerAPI.getTickets();
      setTickets(res.data);
    } catch (err) {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error('Subject and description are required');
      return;
    }
    setCreating(true);
    try {
      await customerAPI.createTicket({
        subject: form.subject,
        category: form.category,
        description: form.description,
        order_id: form.order_id || null,
      });
      toast.success('Ticket created');
      setCreateOpen(false);
      setForm({ subject: '', category: 'Order Issue', description: '', order_id: '' });
      fetchTickets();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  const openDetail = async (ticket) => {
    try {
      const res = await customerAPI.getTicket(ticket.id);
      setSelectedTicket(res.data);
      setDetailOpen(true);
      setReplyText('');
    } catch (err) {
      toast.error('Failed to load ticket');
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await customerAPI.replyToTicket(selectedTicket.id, replyText);
      toast.success('Reply sent');
      setReplyText('');
      const res = await customerAPI.getTicket(selectedTicket.id);
      setSelectedTicket(res.data);
    } catch (err) {
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  };

  return (
    <div className="mobile-container bg-[#F4F7F6] min-h-screen pb-6">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/profile')} data-testid="support-back-btn">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold">Support</h1>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-[#0F62FE] hover:bg-[#0353E9] h-8" data-testid="create-ticket-btn">
          <Plus className="h-4 w-4 mr-1" /> New Ticket
        </Button>
      </div>

      {/* Quick Contact */}
      <div className="mx-4 mt-4 bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Quick Contact</p>
        <div className="grid grid-cols-2 gap-3">
          <a href="tel:+911800123456" className="flex items-center gap-2 p-3 rounded-xl bg-green-50 hover:bg-green-100 transition-colors" data-testid="call-support">
            <Phone className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">Call Support</span>
          </a>
          <a href="mailto:support@medilo.in" className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors" data-testid="email-support">
            <Mail className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Email Support</span>
          </a>
        </div>
      </div>

      {/* Tickets */}
      <div className="p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Your Tickets</p>
        {loading ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <Headphones className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-500">No Support Tickets</h3>
            <p className="text-sm text-gray-400 mt-1">Need help? Raise a ticket</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['Open'];
              return (
                <div 
                  key={ticket.id} 
                  className="bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => openDetail(ticket)}
                  data-testid={`ticket-card-${ticket.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{ticket.subject}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{ticket.ticket_number} · {ticket.category}</p>
                    </div>
                    <Badge className={`${statusCfg.color} text-[10px] shrink-0`}>{ticket.status}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{ticket.description}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                    <span className="text-[10px] text-gray-400">{formatDate(ticket.created_at)}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Ticket Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Raise a Support Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Subject *</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Brief description of the issue" data-testid="ticket-subject" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="ticket-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe your issue in detail..." rows={4} data-testid="ticket-description" />
            </div>
            <div>
              <Label>Order ID (optional)</Label>
              <Input value={form.order_id} onChange={(e) => setForm({ ...form, order_id: e.target.value })} placeholder="Related order ID" data-testid="ticket-order-id" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-[#0F62FE] hover:bg-[#0353E9]" data-testid="submit-ticket-btn">
              {creating ? 'Submitting...' : 'Submit Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {selectedTicket?.subject}
              <span className="block text-xs font-normal text-gray-400 mt-0.5">{selectedTicket?.ticket_number}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <>
              <div className="flex items-center gap-2 pb-3 border-b">
                <Badge className={`${(STATUS_CONFIG[selectedTicket.status] || STATUS_CONFIG['Open']).color} text-xs`}>
                  {selectedTicket.status}
                </Badge>
                <Badge variant="outline" className="text-xs">{selectedTicket.category}</Badge>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-auto space-y-3 py-3" data-testid="ticket-messages">
                {selectedTicket.messages?.map((msg, i) => (
                  <div key={i} className={`flex ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                      msg.sender === 'customer' 
                        ? 'bg-[#0F62FE] text-white' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <p className="text-sm">{msg.message}</p>
                      <p className={`text-[10px] mt-1 ${msg.sender === 'customer' ? 'text-white/60' : 'text-gray-400'}`}>
                        {formatDate(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply */}
              {selectedTicket.status !== 'Resolved' && (
                <div className="flex gap-2 pt-3 border-t">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleReply()}
                    data-testid="ticket-reply-input"
                  />
                  <Button
                    onClick={handleReply}
                    disabled={sending || !replyText.trim()}
                    size="icon"
                    className="bg-[#0F62FE] hover:bg-[#0353E9]"
                    data-testid="ticket-send-btn"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
