import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSchoolsDirectory
} from '../../services/operationsService';
import subscriptionService from '../../services/subscriptionService';
import LogoPreloader from '../../components/common/LogoPreloader';
import { useAuth } from '../../store/AuthContext';

const OperationsSupportCenter = () => {
  const navigate = useNavigate();
  const { startImpersonation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  // New Ticket Modal
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newSchoolId, setNewSchoolId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Score Entry Support');
  const [newPriority, setNewPriority] = useState('Medium');
  const [newMessage, setNewMessage] = useState('');
  const [creating, setCreating] = useState(false);

  const messagesEndRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allTickets, allSchools] = await Promise.all([
        subscriptionService.getAllSupportTickets(),
        getSchoolsDirectory()
      ]);
      setTickets(allTickets);
      setSchools(allSchools || []);
      if (allTickets.length > 0 && !selectedTicket) {
        setSelectedTicket(allTickets[0]);
      }
    } catch (err) {
      console.error('[OperationsSupportCenter] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTicket]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicket?.messages]);

  const filteredTickets = tickets.filter(t =>
    statusFilter === 'all' || t.status === statusFilter
  );

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket || sending) return;

    setSending(true);
    try {
      const updated = await subscriptionService.addTicketMessage(selectedTicket.id, selectedTicket.messages, 'Super Admin', replyText);
      const newTickets = tickets.map(t => t.id === updated.id ? updated : t);
      setTickets(newTickets);
      setSelectedTicket(updated);
      setReplyText('');
    } catch (err) {
      alert(`Error sending reply: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      const updated = await subscriptionService.updateSupportTicket(ticketId, { status: newStatus });
      const newTickets = tickets.map(t => t.id === updated.id ? updated : t);
      setTickets(newTickets);
      if (selectedTicket?.id === ticketId) setSelectedTicket(updated);
    } catch (err) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newSchoolId || !newTitle || !newMessage) return;
    setCreating(true);
    try {
      const school = schools.find(s => s.id === newSchoolId);
      const ticket = await subscriptionService.createSupportTicket(newSchoolId, school?.name || 'Unknown School', newTitle, newCategory, newPriority, newMessage);
      const newTickets = [ticket, ...tickets];
      setTickets(newTickets);
      setSelectedTicket(ticket);
      setShowNewTicket(false);
      setNewSchoolId(''); setNewTitle(''); setNewMessage('');
    } catch (err) {
      alert(`Error creating ticket: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#fafafa' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1.25rem', borderBottom: '1px solid #1f1f23' }}>
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#fafafa', margin: 0, letterSpacing: '-0.02em' }}>
            Support Desk
          </h1>
          <p style={{ color: '#a1a1aa', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
            {loading ? 'Fetching tickets…' : `${tickets.length} total tickets • ${tickets.filter(t => t.status === 'Open').length} awaiting response`}
          </p>
        </div>
        <button
          onClick={() => setShowNewTicket(true)}
          style={{ padding: '0.45rem 0.95rem', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#FFFFFF', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <i className="fas fa-plus" style={{ fontSize: '0.75rem' }}></i>
          <span>Create Ticket</span>
        </button>
      </div>

      <div className="support-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem' }}>

        {/* Ticket Inbox */}
        <div style={{ background: '#121215', borderRadius: '10px', border: '1px solid #222226', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Status filter */}
          <div style={{ padding: '0.65rem', borderBottom: '1px solid #1f1f23', display: 'flex', gap: '4px', background: '#0e0e11' }}>
            {['all', 'Open', 'In Progress', 'Resolved'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  flex: 1,
                  padding: '0.35rem 0.4rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: statusFilter === s ? '#222226' : 'transparent',
                  color: statusFilter === s ? '#fafafa' : '#71717a',
                  textTransform: 'capitalize'
                }}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>

          {/* Ticket List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '560px' }}>
            {loading ? (
              <div style={{ padding: '1rem 0' }}>
                <LogoPreloader fullScreen={false} size="sm" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#71717a', fontSize: '0.8rem' }}>
                No tickets matching this status.
              </div>
            ) : (
              filteredTickets.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: selectedTicket?.id === t.id ? '#1c1c22' : '#0e0e11',
                    border: `1px solid ${selectedTicket?.id === t.id ? '#3b82f6' : '#1f1f23'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>{t.ticket_code}</span>
                    <span style={{ fontSize: '0.65rem', color: t.priority === 'High' || t.priority === 'Urgent' ? '#f87171' : '#fbbf24', fontWeight: 600 }}>{t.priority}</span>
                  </div>
                  <div style={{ fontWeight: 600, color: '#fafafa', fontSize: '0.84rem', lineHeight: 1.3 }}>{t.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '3px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>{t.school_name}</span>
                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: 600,
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: 'rgba(56, 189, 248, 0.1)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.2)'
                    }}>
                      {t.sender_role === 'teacher' ? 'Teacher' : 'Headteacher'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.68rem', color: t.status === 'Resolved' ? '#34d399' : t.status === 'In Progress' ? '#60a5fa' : '#fbbf24', fontWeight: 600 }}>
                      ● {t.status}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#71717a' }}>
                      {t.messages?.length || 0} msg{(t.messages?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ticket Conversation */}
        {selectedTicket ? (
          <div style={{ background: '#121215', borderRadius: '10px', border: '1px solid #222226', display: 'flex', flexDirection: 'column', height: '580px', overflow: 'hidden' }}>
            {/* Ticket Header */}
            <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid #1f1f23', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#0e0e11' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>{selectedTicket.ticket_code}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: selectedTicket.priority === 'High' || selectedTicket.priority === 'Urgent' ? '#f87171' : '#fbbf24' }}>
                    {selectedTicket.priority} Priority
                  </span>
                </div>
                <h3 style={{ margin: '3px 0 0', color: '#fafafa', fontSize: '0.95rem', fontWeight: 600 }}>{selectedTicket.title}</h3>
                <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>School: <strong style={{ color: '#d4d4d8' }}>{selectedTicket.school_name}</strong></span>
                  <span>•</span>
                  <span>Category: {selectedTicket.category}</span>
                  {selectedTicket.sender_name && (
                    <>
                      <span>•</span>
                      <span style={{ color: '#60a5fa' }}>
                        {selectedTicket.sender_name} ({selectedTicket.sender_role || 'headteacher'})
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  onClick={async () => {
                    if (selectedTicket?.school_id) {
                      const targetRole = selectedTicket.sender_role === 'teacher' ? 'teacher' : 'super_admin';
                      await startImpersonation(selectedTicket.school_id, selectedTicket.school_name, targetRole, {
                        fullName: selectedTicket.sender_name || 'Impersonated User',
                        staffId: selectedTicket.sender_staff_id || null
                      });
                      navigate(targetRole === 'teacher' ? '/scores' : '/');
                    }
                  }}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    background: '#1c1c22',
                    border: '1px solid #27272a',
                    color: '#60a5fa',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <i className="fas fa-arrow-up-right-from-square" style={{ fontSize: '0.68rem' }}></i>
                  <span>Portal</span>
                </button>

                <select
                  value={selectedTicket.status}
                  onChange={e => handleStatusChange(selectedTicket.id, e.target.value)}
                  style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', background: '#1c1c22', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>
            </div>

            {/* Messages Stream */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(!selectedTicket.messages || selectedTicket.messages.length === 0) ? (
                <div style={{ textAlign: 'center', color: '#71717a', padding: '2rem', fontSize: '0.8rem' }}>
                  No messages yet. Send a reply below.
                </div>
              ) : (
                selectedTicket.messages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: msg.sender === 'Super Admin' ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      background: msg.sender === 'Super Admin' ? '#2563eb' : '#1c1c22',
                      border: msg.sender === 'Super Admin' ? 'none' : '1px solid #27272a',
                      color: '#FFFFFF',
                      padding: '0.65rem 0.9rem',
                      borderRadius: msg.sender === 'Super Admin' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                      fontSize: '0.82rem',
                      lineHeight: 1.45
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', opacity: 0.85, marginBottom: '2px', fontWeight: 600 }}>{msg.sender}</div>
                    <div>{msg.text}</div>
                    <div style={{ fontSize: '0.62rem', opacity: 0.7, marginTop: '3px', textAlign: 'right' }}>
                      {msg.time ? new Date(msg.time).toLocaleString('en-GH', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Input */}
            <form onSubmit={handleSendReply} style={{ padding: '0.75rem 1rem', borderTop: '1px solid #1f1f23', display: 'flex', gap: '8px', background: '#0e0e11' }}>
              <input
                type="text"
                placeholder="Type reply to school administrators…"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                style={{ flex: 1, padding: '0.6rem 0.85rem', borderRadius: '7px', background: '#141418', border: '1px solid #27272a', color: '#fafafa', outline: 'none', fontSize: '0.82rem' }}
              />
              <button
                type="submit"
                disabled={sending || !replyText.trim()}
                style={{ padding: '0.6rem 1rem', borderRadius: '7px', background: '#2563eb', border: 'none', color: '#FFFFFF', fontWeight: 600, fontSize: '0.8rem', cursor: sending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fas fa-paper-plane" style={{ fontSize: '0.72rem' }}></i>
                <span>Send</span>
              </button>
            </form>
          </div>
        ) : (
          <div style={{ background: '#121215', borderRadius: '10px', border: '1px solid #222226', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '580px', color: '#71717a', fontSize: '0.85rem' }}>
            Select a ticket from the inbox to read and reply.
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#141418', border: '1px solid #27272a', borderRadius: '14px', padding: '1.5rem', width: '100%', maxWidth: '480px', color: '#fafafa' }}>
            <h2 style={{ margin: '0 0 1rem', fontWeight: 700, fontSize: '1.1rem' }}>Create Support Ticket</h2>
            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 600 }}>Target School</label>
                <select
                  required
                  value={newSchoolId}
                  onChange={e => setNewSchoolId(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#0e0e11', border: '1px solid #27272a', color: '#fafafa', outline: 'none', fontSize: '0.85rem' }}
                >
                  <option value="">Select a school…</option>
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.region})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 600 }}>Subject / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Assessment broadsheet sync issue"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#0e0e11', border: '1px solid #27272a', color: '#fafafa', outline: 'none', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 600 }}>Category</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#0e0e11', border: '1px solid #27272a', color: '#fafafa', outline: 'none', fontSize: '0.85rem' }}
                  >
                    <option value="Score Entry Support">Score Entry Support</option>
                    <option value="Report Card Generation">Report Card Generation</option>
                    <option value="Billing & Invoicing">Billing &amp; Invoicing</option>
                    <option value="General Technical">General Technical</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 600 }}>Priority</label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#0e0e11', border: '1px solid #27272a', color: '#fafafa', outline: 'none', fontSize: '0.85rem' }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 600 }}>Message</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe the issue or instructions for the school…"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#0e0e11', border: '1px solid #27272a', color: '#fafafa', outline: 'none', fontSize: '0.85rem', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
                <button type="button" onClick={() => setShowNewTicket(false)} style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: '#1c1c22', border: '1px solid #27272a', color: '#a1a1aa', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={creating} style={{ padding: '0.45rem 1rem', borderRadius: '6px', background: '#2563eb', border: 'none', color: '#ffffff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                  {creating ? 'Creating…' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationsSupportCenter;
