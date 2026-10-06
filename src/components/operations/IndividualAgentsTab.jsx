import React, { useState, useEffect } from 'react';
import agentReferralService from '../../services/agentReferralService';
import agentNotificationService from '../../services/agentNotificationService';

export default function IndividualAgentsTab() {
  const [agents, setAgents] = useState([]);
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('directory'); // 'directory' | 'leads'

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPhone, setNewAgentPhone] = useState('');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentCode, setNewAgentCode] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [savingAgent, setSavingAgent] = useState(false);
  const [addError, setAddError] = useState('');

  // Disburse Modal
  const [disburseModal, setDisburseModal] = useState({
    isOpen: false,
    request: null,
    reference: '',
    notes: '',
    loading: false,
    error: ''
  });

  // Success Alert Modal with WhatsApp MoMo Receipt Link
  const [receiptModal, setReceiptModal] = useState({
    isOpen: false,
    alert: null,
    payoutContact: '',
    amount: 0,
    reference: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [allAgents, allRequests, allComms, allLeads] = await Promise.all([
        agentReferralService.getAllAgents(),
        agentReferralService.getAllPayoutRequests(),
        agentReferralService.getAllCommissions(),
        agentReferralService.getAllLeads ? agentReferralService.getAllLeads() : []
      ]);
      setAgents(allAgents || []);
      setPayoutRequests(allRequests || []);
      setCommissions(allComms || []);
      setLeads(allLeads || []);
    } catch (err) {
      console.warn('[IndividualAgentsTab] Data load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (type, text) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 5000);
  };

  // Register New Agent
  const handleCreateAgent = async (e) => {
    e.preventDefault();
    if (!newAgentName.trim() || !newAgentPhone.trim()) {
      setAddError('Please enter Full Name and Mobile Phone Number.');
      return;
    }

    setSavingAgent(true);
    setAddError('');
    try {
      const res = await agentReferralService.registerAgent({
        fullName: newAgentName.trim(),
        phone: newAgentPhone.trim(),
        email: newAgentEmail.trim(),
        customCode: newAgentCode.trim(),
        password: newAgentPassword.trim() || newAgentPhone.trim()
      });

      if (res.success) {
        setShowAddModal(false);
        setNewAgentName('');
        setNewAgentPhone('');
        setNewAgentEmail('');
        setNewAgentCode('');
        setNewAgentPassword('');
        showNotification('success', `✅ Agent ${res.agent.fullName} registered! Code: ${res.agent.referralCode}`);
        await loadData();
      }
    } catch (err) {
      setAddError(err.message || 'Failed to create agent.');
    } finally {
      setSavingAgent(false);
    }
  };

  // Open Disbursal Modal
  const handleOpenDisburse = (request) => {
    setDisburseModal({
      isOpen: true,
      request,
      reference: '',
      notes: '',
      loading: false,
      error: ''
    });
  };

  // Execute Disbursal & Show WhatsApp Receipt Button
  const handleConfirmDisbursal = async (e) => {
    e.preventDefault();
    if (!disburseModal.reference.trim()) {
      setDisburseModal(prev => ({ ...prev, error: 'Please enter the MoMo transaction reference / receipt ID.' }));
      return;
    }

    setDisburseModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const currentReq = disburseModal.request;
      const refCode = disburseModal.reference.trim();
      const res = await agentReferralService.disbursePayout(currentReq.id, {
        disbursalReference: refCode,
        adminNotes: disburseModal.notes.trim(),
        processedBy: 'Super Admin'
      });

      if (res.success) {
        setDisburseModal({ isOpen: false, request: null, reference: '', notes: '', loading: false, error: '' });
        showNotification('success', `✅ Payout of GH₵ ${currentReq.amount.toFixed(2)} disbursed to ${currentReq.payoutContact}!`);

        // If WhatsApp alert was generated, display Receipt Modal for 1-click WhatsApp delivery
        if (res.whatsAppAlert) {
          setReceiptModal({
            isOpen: true,
            alert: res.whatsAppAlert,
            payoutContact: currentReq.payoutContact,
            amount: currentReq.amount,
            reference: refCode
          });
        }

        await loadData();
      }
    } catch (err) {
      setDisburseModal(prev => ({ ...prev, loading: false, error: err.message || 'Disbursal failed.' }));
    }
  };

  // Reject Request
  const handleRejectRequest = async (request) => {
    const reason = window.prompt(`Reject payout request of GH₵ ${request.amount.toFixed(2)} for ${request.agentName}? Enter reason:`, 'Information mismatch');
    if (reason === null) return;

    try {
      await agentReferralService.rejectPayout(request.id, { reason, processedBy: 'Super Admin' });
      showNotification('success', `Request rejected and funds returned to ${request.agentName}'s balance.`);
      await loadData();
    } catch (err) {
      showNotification('error', err.message || 'Failed to reject payout.');
    }
  };

  // Update Lead Status (e.g. CONTACTED, CONVERTED)
  const handleUpdateLeadStatus = async (leadId, newStatus) => {
    try {
      await agentReferralService.updateLeadStatus(leadId, newStatus);
      showNotification('success', `Lead status updated to ${newStatus}`);
      await loadData();
    } catch (err) {
      showNotification('error', err.message || 'Failed to update lead');
    }
  };

  // Calculations
  const pendingRequests = payoutRequests.filter(r => r.status === 'PENDING_REVIEW');
  const totalPendingPayout = pendingRequests.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalDisbursed = payoutRequests.filter(r => r.status === 'DISBURSED').reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalEarnedCommissions = commissions.filter(c => c.status !== 'REVOKED').reduce((sum, c) => sum + Number(c.commissionAmount || 0), 0);
  const totalReferredSchools = agents.reduce((sum, a) => sum + (a.referredSchoolsCount || 0), 0);

  // Leads metrics
  const activeLeadsCount = leads.filter(l => !l.isExpired && l.status !== 'CONVERTED').length;
  const convertedLeadsCount = leads.filter(l => l.status === 'CONVERTED').length;
  const expiredLeadsCount = leads.filter(l => l.isExpired && l.status !== 'CONVERTED').length;

  // Filtered agents
  const filteredAgents = agents.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.fullName?.toLowerCase().includes(q) ||
      a.phone?.toLowerCase().includes(q) ||
      a.referralCode?.toLowerCase().includes(q)
    );
  });

  // Filtered leads
  const filteredLeads = leads.filter(l => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.schoolName?.toLowerCase().includes(q) ||
      l.contactPerson?.toLowerCase().includes(q) ||
      l.phone?.toLowerCase().includes(q) ||
      l.agentName?.toLowerCase().includes(q) ||
      l.agentCode?.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      
      {/* Top Banner Notice */}
      {notice && (
        <div style={{ padding: '0.85rem 1.25rem', borderRadius: '12px', marginBottom: '1.25rem', background: notice.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: notice.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)', color: notice.type === 'success' ? '#34d399' : '#fca5a5', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className={`fa-solid ${notice.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
          <span>{notice.text}</span>
        </div>
      )}

      {/* Program Header & Action Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', background: '#18181b', padding: '1.25rem 1.5rem', borderRadius: '20px', border: '1px solid #27272a', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.35rem' }}>
            <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: '6px' }}>50% BENEFIT</span>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
              Individual Referral &amp; Affiliate System
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
            Promoters earn <strong>50% of the school's subscription fee for 1 term</strong>. Withdrawals are requested by agents with explicit MoMo payout contact.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '0.6rem 1.15rem',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.83rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="fa-solid fa-user-plus"></i>
            <span>Register New Agent</span>
          </button>

          <a
            href="/agent"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '10px',
              background: '#09090b',
              border: '1px solid #27272a',
              color: '#38bdf8',
              fontWeight: 700,
              fontSize: '0.82rem',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-solid fa-arrow-up-right-from-square"></i>
            <span>Agent Portal</span>
          </a>

          <a
            href="/demo"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '10px',
              background: '#09090b',
              border: '1px solid #27272a',
              color: '#a78bfa',
              fontWeight: 700,
              fontSize: '0.82rem',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-solid fa-calendar-check"></i>
            <span>Demo Page</span>
          </a>

          <button
            onClick={loadData}
            title="Refresh Data"
            style={{
              padding: '0.6rem 0.9rem',
              borderRadius: '10px',
              background: '#09090b',
              border: '1px solid #27272a',
              color: '#94a3b8',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            <i className="fa-solid fa-sync-alt" style={{ color: '#f59e0b' }}></i>
          </button>
        </div>
      </div>

      {/* ── Key Metrics Cards (Uncluttered, 4 Cards) ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        
        {/* Total Active Agents */}
        <div style={{ background: '#18181b', padding: '1.25rem', borderRadius: '18px', border: '1px solid #27272a', boxShadow: '0 4px 15px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Agents</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
              <i className="fa-solid fa-users"></i>
            </div>
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.85rem', fontWeight: 900, color: '#f8fafc' }}>
            {agents.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>Registered Promoters</div>
        </div>

        {/* Referred Schools */}
        <div style={{ background: '#18181b', padding: '1.25rem', borderRadius: '18px', border: '1px solid #27272a', boxShadow: '0 4px 15px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schools Linked</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
              <i className="fa-solid fa-school"></i>
            </div>
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.85rem', fontWeight: 900, color: '#f8fafc' }}>
            {totalReferredSchools}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>Referred by agents</div>
        </div>

        {/* Total 50% Commissions Earned */}
        <div style={{ background: '#18181b', padding: '1.25rem', borderRadius: '18px', border: '1px solid #27272a', boxShadow: '0 4px 15px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>50% Commissions</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
              <i className="fa-solid fa-sack-dollar"></i>
            </div>
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.85rem', fontWeight: 900, color: '#34d399' }}>
            GH₵ {totalEarnedCommissions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>GH₵ {totalDisbursed.toLocaleString(undefined, { minimumFractionDigits: 2 })} paid out</div>
        </div>

        {/* Pending MoMo Payouts Queue */}
        <div style={{ background: '#18181b', padding: '1.25rem', borderRadius: '18px', border: pendingRequests.length > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #27272a', boxShadow: pendingRequests.length > 0 ? '0 4px 20px rgba(239, 68, 68, 0.15)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', color: pendingRequests.length > 0 ? '#f87171' : '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pending MoMo Payouts
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: pendingRequests.length > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(148, 163, 184, 0.1)', color: pendingRequests.length > 0 ? '#ef4444' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
              <i className="fa-solid fa-bell"></i>
            </div>
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.85rem', fontWeight: 900, color: pendingRequests.length > 0 ? '#f87171' : '#f8fafc' }}>
            GH₵ {totalPendingPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.72rem', color: pendingRequests.length > 0 ? '#fca5a5' : '#71717a', marginTop: '0.2rem' }}>
            {pendingRequests.length > 0 ? `${pendingRequests.length} transfer(s) awaiting approval` : 'Queue is all clear'}
          </div>
        </div>

      </div>

      {/* ── Section Navigation Switcher (One Focused View at a Time) ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1.75rem', background: '#121215', padding: '6px', borderRadius: '16px', border: '1px solid #27272a', width: 'fit-content' }}>
        <button
          onClick={() => setActiveSection('directory')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '10px',
            border: 'none',
            background: activeSection === 'directory' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
            color: activeSection === 'directory' ? '#09090b' : '#a1a1aa',
            fontWeight: 800,
            fontSize: '0.83rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <i className="fa-solid fa-users"></i>
          <span>Agents Directory</span>
          <span style={{ background: activeSection === 'directory' ? 'rgba(0,0,0,0.25)' : '#27272a', color: activeSection === 'directory' ? '#09090b' : '#f4f4f5', fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '999px', fontWeight: 900 }}>
            {agents.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSection('payouts')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '10px',
            border: 'none',
            background: activeSection === 'payouts' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
            color: activeSection === 'payouts' ? '#ffffff' : '#a1a1aa',
            fontWeight: 800,
            fontSize: '0.83rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <i className="fa-solid fa-money-bill-transfer"></i>
          <span>Withdrawal Requests</span>
          {pendingRequests.length > 0 ? (
            <span style={{ background: '#ef4444', color: '#ffffff', fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '999px', fontWeight: 900 }}>
              {pendingRequests.length} PENDING
            </span>
          ) : (
            <span style={{ background: activeSection === 'payouts' ? 'rgba(0,0,0,0.25)' : '#27272a', color: activeSection === 'payouts' ? '#ffffff' : '#a1a1aa', fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '999px', fontWeight: 700 }}>
              {payoutRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSection('leads')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '10px',
            border: 'none',
            background: activeSection === 'leads' ? 'linear-gradient(135deg, #38bdf8, #0284c7)' : 'transparent',
            color: activeSection === 'leads' ? '#09090b' : '#a1a1aa',
            fontWeight: 800,
            fontSize: '0.83rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <i className="fa-solid fa-magnet"></i>
          <span>Captured Leads Pipeline</span>
          {leads.length > 0 && (
            <span style={{ background: activeSection === 'leads' ? 'rgba(0,0,0,0.25)' : '#27272a', color: activeSection === 'leads' ? '#09090b' : '#f4f4f5', fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '999px', fontWeight: 900 }}>
              {leads.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSection('commissions')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '10px',
            border: 'none',
            background: activeSection === 'commissions' ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'transparent',
            color: activeSection === 'commissions' ? '#ffffff' : '#a1a1aa',
            fontWeight: 800,
            fontSize: '0.83rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <i className="fa-solid fa-receipt"></i>
          <span>Commissions Audit</span>
          <span style={{ background: activeSection === 'commissions' ? 'rgba(0,0,0,0.25)' : '#27272a', color: activeSection === 'commissions' ? '#ffffff' : '#f4f4f5', fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '999px', fontWeight: 700 }}>
            {commissions.length}
          </span>
        </button>
      </div>

      {/* ── SECTION: WITHDRAWAL REQUESTS QUEUE ────────────────────────── */}
      {activeSection === 'payouts' && (
        <div style={{ background: '#18181b', borderRadius: '18px', border: '1px solid #27272a', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#121215', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: pendingRequests.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-money-bill-transfer" style={{ color: pendingRequests.length > 0 ? '#ef4444' : '#10b981', fontSize: '1.1rem' }}></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
                  Withdrawal Requests Queue ({pendingRequests.length} Pending)
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>
                  Agents request disbursement to their specific contact number
                </span>
              </div>
            </div>
            {pendingRequests.length > 0 && (
              <span style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.75rem', fontWeight: 800, padding: '0.35rem 0.75rem', borderRadius: '999px' }}>
                Action Required: {pendingRequests.length} Waiting
              </span>
            )}
          </div>

          {pendingRequests.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#09090b', color: '#a1a1aa', borderBottom: '1px solid #27272a', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.9rem 1.25rem' }}>Request Date</th>
                    <th style={{ padding: '0.9rem 1rem' }}>Agent Name &amp; Telemetry</th>
                    <th style={{ padding: '0.9rem 1rem' }}>Disburse MoMo To</th>
                    <th style={{ padding: '0.9rem 1rem' }}>Network &amp; Name</th>
                    <th style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map(req => {
                    const agentComms = commissions.filter(c => c.agentId === req.agentId);
                    const hasLowLearnerRisk = agentComms.some(c => c.lowLearnerWarning);

                    return (
                      <tr key={req.id} style={{ borderBottom: '1px solid #27272a', background: hasLowLearnerRisk ? 'rgba(239, 68, 68, 0.04)' : 'transparent' }}>
                        <td style={{ padding: '1rem 1.25rem', color: '#cbd5e1' }}>
                          <div style={{ fontWeight: 600 }}>{new Date(req.requestedAt).toLocaleDateString()}</div>
                          <div style={{ fontSize: '0.72rem', color: '#71717a' }}>{new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: 800, color: '#f8fafc' }}>{req.agentName}</div>
                          <div style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>Account: {req.agentPhone}</div>
                          {hasLowLearnerRisk && (
                            <div style={{ marginTop: '0.25rem' }}>
                              <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800 }}>
                                ⚠️ Anti-Fraud: &lt; 15 Active Learners Flagged
                              </span>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{ background: '#121215', border: '1px solid #f59e0b', color: '#fbbf24', padding: '0.35rem 0.75rem', borderRadius: '8px', fontWeight: 900, fontSize: '0.92rem', letterSpacing: '0.05em' }}>
                            {req.payoutContact}
                          </span>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: 700, color: '#f8fafc' }}>{req.payoutNetwork}</div>
                          <div style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>Name: {req.payoutAccountName}</div>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <strong style={{ fontSize: '1.15rem', color: '#34d399' }}>
                            GH₵ {Number(req.amount).toFixed(2)}
                          </strong>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                            <button
                              onClick={() => handleOpenDisburse(req)}
                              style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                border: 'none',
                                color: '#ffffff',
                                fontWeight: 800,
                                fontSize: '0.78rem',
                                padding: '0.55rem 0.95rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)'
                              }}
                            >
                              <i className="fa-solid fa-paper-plane"></i>
                              Disburse Payout
                            </button>
                            <button
                              onClick={() => handleRejectRequest(req)}
                              style={{
                                background: 'transparent',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                color: '#f87171',
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                padding: '0.55rem 0.85rem',
                                borderRadius: '8px',
                                cursor: 'pointer'
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#a1a1aa' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                <i className="fa-solid fa-check" style={{ fontSize: '1.5rem', color: '#34d399' }}></i>
              </div>
              <h4 style={{ margin: '0 0 0.25rem 0', color: '#f8fafc', fontSize: '1rem', fontWeight: 700 }}>All Caught Up!</h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>No pending withdrawal requests. All agent payouts are up to date.</p>
            </div>
          )}
        </div>
      )}

      {/* ── SECTION: AGENTS DIRECTORY ─────────────────────────────── */}
      {activeSection === 'directory' && (
        <div style={{ background: '#18181b', borderRadius: '18px', border: '1px solid #27272a', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #27272a', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: '#121215' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-users-viewfinder" style={{ color: '#f59e0b', fontSize: '1.1rem' }}></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
                  Registered Field Agents ({filteredAgents.length})
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Active promoters generating referral leads &amp; school signups</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#71717a', fontSize: '0.8rem' }}></i>
                <input
                  type="text"
                  placeholder="Search agents by name, phone or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ padding: '0.6rem 1rem 0.6rem 2.2rem', borderRadius: '10px', background: '#09090b', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.85rem', width: '280px', outline: 'none' }}
                />
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  padding: '0.6rem 1rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-user-plus"></i>
                Add Agent
              </button>
            </div>
          </div>

          {filteredAgents.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#09090b', color: '#a1a1aa', borderBottom: '1px solid #27272a', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.9rem 1.25rem' }}>Agent Details</th>
                    <th style={{ padding: '0.9rem 1rem' }}>Referral Code &amp; Link</th>
                    <th style={{ padding: '0.9rem 1rem' }}>Schools</th>
                    <th style={{ padding: '0.9rem 1rem' }}>Total 50% Earned</th>
                    <th style={{ padding: '0.9rem 1rem' }}>Available Balance</th>
                    <th style={{ padding: '0.9rem 1rem' }}>Total Paid Out</th>
                    <th style={{ padding: '0.9rem 1.25rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAgents.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #27272a' }}>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 800, color: '#f8fafc' }}>{a.fullName}</div>
                        <div style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>Phone: {a.phone} {a.email && `• ${a.email}`}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <code style={{ background: '#121215', border: '1px solid #27272a', padding: '0.25rem 0.55rem', borderRadius: '6px', color: '#fbbf24', fontWeight: 800, fontSize: '0.85rem' }}>
                            {a.referralCode}
                          </code>
                          <button
                            title="Copy Agent Referral Link"
                            onClick={() => {
                              const refUrl = `${window.location.origin}/register?ref=${a.referralCode}`;
                              navigator.clipboard.writeText(refUrl);
                              showNotification('success', `Copied link for ${a.fullName}`);
                            }}
                            style={{ background: 'transparent', border: '1px solid #27272a', color: '#a1a1aa', padding: '0.25rem 0.45rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem' }}
                          >
                            <i className="fa-solid fa-copy"></i>
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ fontWeight: 800, color: '#f8fafc' }}>{a.referredSchoolsCount || 0}</span>
                        <span style={{ color: '#71717a', fontSize: '0.75rem', marginLeft: '4px' }}>schools</span>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 800, color: '#60a5fa' }}>
                        GH₵ {Number(a.totalEarned || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <strong style={{ color: Number(a.pendingPayout || 0) > 0 ? '#34d399' : '#71717a', fontSize: '0.95rem' }}>
                          GH₵ {Number(a.pendingPayout || 0).toFixed(2)}
                        </strong>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 700, color: '#a78bfa' }}>
                        GH₵ {Number(a.totalPaid || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.25rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800 }}>
                          ● Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#a1a1aa' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                <i className="fa-solid fa-users" style={{ fontSize: '1.5rem', color: '#f59e0b' }}></i>
              </div>
              <h4 style={{ margin: '0 0 0.25rem 0', color: '#f8fafc', fontSize: '1rem', fontWeight: 700 }}>No Agents Found</h4>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem' }}>No registered promoters matching your query.</p>
              <button
                onClick={() => setShowAddModal(true)}
                style={{ background: '#f59e0b', color: '#000', border: 'none', padding: '0.55rem 1rem', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Register First Agent
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── SECTION: COMMISSIONS AUDIT LEDGER ─────────────────────── */}
      {activeSection === 'commissions' && (
        <div style={{ background: '#18181b', borderRadius: '18px', border: '1px solid #27272a', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#121215', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-receipt" style={{ color: '#a78bfa', fontSize: '1.1rem' }}></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
                  Commissions Audit Ledger ({commissions.length})
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>
                  1-Term 50% commission entries with active learner telemetry (&gt; 15 requirement)
                </span>
              </div>
            </div>
          </div>

          {commissions.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#09090b', color: '#a1a1aa', borderBottom: '1px solid #27272a', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.9rem 1.25rem' }}>Date &amp; ID</th>
                    <th style={{ padding: '0.9rem 1rem' }}>School Name</th>
                    <th style={{ padding: '0.9rem 1rem' }}>Term / Academic Year</th>
                    <th style={{ padding: '0.9rem 1rem' }}>School Sub Paid</th>
                    <th style={{ padding: '0.9rem 1rem' }}>50% Commission</th>
                    <th style={{ padding: '0.9rem 1rem' }}>Agent Beneficiary</th>
                    <th style={{ padding: '0.9rem 1rem' }}>Fraud / Learner Audit</th>
                    <th style={{ padding: '0.9rem 1.25rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #27272a' }}>
                      <td style={{ padding: '1rem 1.25rem', color: '#cbd5e1' }}>
                        <div style={{ fontWeight: 600 }}>{new Date(c.createdAt).toLocaleDateString()}</div>
                        <div style={{ fontSize: '0.7rem', color: '#71717a' }}>{c.id}</div>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 800, color: '#f8fafc' }}>
                        {c.schoolName}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ background: '#121215', padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid #27272a', color: '#e4e4e7' }}>
                          {c.term} • {c.academicYear} (1 of 1 Term)
                        </span>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                        GH₵ {Number(c.schoolSubscriptionPaid || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <strong style={{ fontSize: '1.05rem', color: '#34d399' }}>
                          GH₵ {Number(c.commissionAmount || 0).toFixed(2)}
                        </strong>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>{c.agentName}</div>
                        <div style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>Phone: {c.agentPhone}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {c.lowLearnerWarning ? (
                          <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                            ⚠️ &lt; 15 Learners ({c.activeLearnersCount || 0})
                          </span>
                        ) : (
                          <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                            🛡️ Clean ({c.activeLearnersCount || '15+'} Learners)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        {c.status === 'PAID' ? (
                          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.25rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800 }}>
                            ✓ Disbursed
                          </span>
                        ) : (
                          <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.25rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800 }}>
                            ● Available in Balance
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#a1a1aa' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                <i className="fa-solid fa-receipt" style={{ fontSize: '1.5rem', color: '#a78bfa' }}></i>
              </div>
              <h4 style={{ margin: '0 0 0.25rem 0', color: '#f8fafc', fontSize: '1rem', fontWeight: 700 }}>No Commissions Recorded</h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>When a referred school completes their subscription payment, the 50% payout credit will appear here automatically.</p>
            </div>
          )}
        </div>
      )}

      {/* ── SECTION: CAPTURED LEADS PIPELINE ────────────────────── */}
      {activeSection === 'leads' && (
        <div>
          {/* Leads Summary Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#18181b', padding: '1.25rem', borderRadius: '16px', border: '1px solid #27272a', borderLeft: '4px solid #38bdf8' }}>
              <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase' }}>Total Inbound Leads</div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.85rem', fontWeight: 900, marginTop: '0.2rem', color: '#f8fafc' }}>
                {leads.length}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>Demo requests captured</div>
            </div>

            <div style={{ background: '#18181b', padding: '1.25rem', borderRadius: '16px', border: '1px solid #27272a', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase' }}>Active in 60-Day Lock</div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.85rem', fontWeight: 900, marginTop: '0.2rem', color: '#34d399' }}>
                {activeLeadsCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>Locked to referring agent</div>
            </div>

            <div style={{ background: '#18181b', padding: '1.25rem', borderRadius: '16px', border: '1px solid #27272a', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase' }}>Converted Schools</div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.85rem', fontWeight: 900, marginTop: '0.2rem', color: '#fbbf24' }}>
                {convertedLeadsCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>Registered on platform</div>
            </div>

            <div style={{ background: '#18181b', padding: '1.25rem', borderRadius: '16px', border: '1px solid #27272a', borderLeft: '4px solid #71717a' }}>
              <div style={{ fontSize: '0.72rem', color: '#a1a1aa', fontWeight: 800, textTransform: 'uppercase' }}>Expired (&gt; 60 Days)</div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.85rem', fontWeight: 900, marginTop: '0.2rem', color: '#a1a1aa' }}>
                {expiredLeadsCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#71717a' }}>Returned to open pool</div>
            </div>
          </div>

          {/* Leads Table */}
          <div style={{ background: '#18181b', borderRadius: '18px', border: '1px solid #27272a', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #27272a', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: '#121215' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-magnet" style={{ color: '#38bdf8', fontSize: '1.1rem' }}></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
                    Captured School Leads Pipeline ({filteredLeads.length})
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>
                    Schools that requested a demo or registered through an agent's referral link
                  </span>
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#71717a', fontSize: '0.8rem' }}></i>
                <input
                  type="text"
                  placeholder="Search leads by school, contact, phone, or agent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ padding: '0.6rem 1rem 0.6rem 2.2rem', borderRadius: '10px', background: '#09090b', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.85rem', width: '320px', outline: 'none' }}
                />
              </div>
            </div>

            {filteredLeads.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#09090b', color: '#a1a1aa', borderBottom: '1px solid #27272a', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '0.9rem 1.25rem' }}>School Name &amp; Region</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Contact Person &amp; Phone</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Attributed Agent</th>
                      <th style={{ padding: '0.9rem 1rem' }}>60-Day Lock Window</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map(lead => {
                      const headteacherWaMsg = `Hello ${lead.contactPerson}, I am reaching out from Labour Educational Portal regarding your school demo request for ${lead.schoolName}. When would be convenient for a quick walkthrough?`;
                      const headteacherWaUrl = agentNotificationService.createWhatsAppUrl(lead.phone, headteacherWaMsg);

                      return (
                        <tr key={lead.id} style={{ borderBottom: '1px solid #27272a' }}>
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <div style={{ fontWeight: 800, color: '#f8fafc' }}>{lead.schoolName}</div>
                            <div style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>
                              {lead.region || 'Region Unspecified'} • ~{lead.estimatedLearners || 0} Learners
                            </div>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ fontWeight: 700, color: '#f8fafc' }}>{lead.contactPerson}</div>
                            <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 800 }}>{lead.phone}</div>
                            {lead.email && <div style={{ fontSize: '0.7rem', color: '#71717a' }}>{lead.email}</div>}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ fontWeight: 700, color: '#38bdf8' }}>{lead.agentName || 'General Inbound'}</div>
                            {lead.agentCode && (
                              <code style={{ background: '#121215', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', color: '#fbbf24', border: '1px solid #27272a' }}>
                                {lead.agentCode}
                              </code>
                            )}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            {lead.status === 'CONVERTED' ? (
                              <span style={{ color: '#34d399', fontWeight: 800, fontSize: '0.78rem' }}>
                                ✓ Converted to School
                              </span>
                            ) : lead.isExpired ? (
                              <span style={{ color: '#71717a', fontWeight: 700, fontSize: '0.75rem' }}>
                                ⚠️ Window Expired
                              </span>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ background: '#121215', border: '1px solid #0284c7', color: '#38bdf8', padding: '0.2rem 0.55rem', borderRadius: '6px', fontWeight: 800, fontSize: '0.78rem' }}>
                                  ⏳ {lead.daysRemaining} days left
                                </span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            {lead.status === 'CONVERTED' ? (
                              <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800 }}>
                                ● Converted
                              </span>
                            ) : lead.status === 'CONTACTED' ? (
                              <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800 }}>
                                ● Contacted
                              </span>
                            ) : (
                              <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800 }}>
                                ● New Inbound
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <a
                                href={headteacherWaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  background: '#25D366',
                                  color: '#ffffff',
                                  padding: '0.45rem 0.75rem',
                                  borderRadius: '8px',
                                  textDecoration: 'none',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <i className="fa-brands fa-whatsapp"></i>
                                WhatsApp
                              </a>

                              {lead.status !== 'CONTACTED' && lead.status !== 'CONVERTED' && (
                                <button
                                  onClick={() => handleUpdateLeadStatus(lead.id, 'CONTACTED')}
                                  style={{
                                    background: '#121215',
                                    border: '1px solid #27272a',
                                    color: '#cbd5e1',
                                    padding: '0.45rem 0.65rem',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Mark Contacted
                                </button>
                              )}

                              {lead.status !== 'CONVERTED' && (
                                <button
                                  onClick={() => handleUpdateLeadStatus(lead.id, 'CONVERTED')}
                                  style={{
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    border: '1px solid #10b981',
                                    color: '#34d399',
                                    padding: '0.45rem 0.65rem',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Mark Converted
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#a1a1aa' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                  <i className="fa-solid fa-magnet" style={{ fontSize: '1.5rem', color: '#38bdf8' }}></i>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>When headteachers book a demo at <code>/demo?ref=CODE</code>, their 60-day attribution lock will appear here.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: Disburse Payout (Admin Enters MoMo Reference) ────── */}
      {disburseModal.isOpen && disburseModal.request && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '24px', width: '100%', maxWidth: '480px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', position: 'relative' }}>
            
            <button
              onClick={() => setDisburseModal({ isOpen: false, request: null, reference: '', notes: '', loading: false, error: '' })}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#121215', border: '1px solid #27272a', color: '#a1a1aa', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ✕
            </button>

            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
              Confirm MoMo Disbursal
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: '#a1a1aa' }}>
              Send funds via your business MoMo/Bank and input the transaction reference below.
            </p>

            {disburseModal.error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                {disburseModal.error}
              </div>
            )}

            {/* Payout Details Card */}
            <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: '14px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Recipient Agent:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>{disburseModal.request.agentName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Destination MoMo Contact:</span>
                <span style={{ fontSize: '1rem', fontWeight: 900, color: '#fbbf24' }}>{disburseModal.request.payoutContact}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Network / Account Name:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1' }}>{disburseModal.request.payoutNetwork} ({disburseModal.request.payoutAccountName})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #27272a', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1' }}>Amount to Transfer:</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#34d399' }}>GH₵ {Number(disburseModal.request.amount).toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmDisbursal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  MoMo Transaction ID / Reference *
                </label>
                <input
                  type="text"
                  placeholder="e.g. MM-2026-998812"
                  value={disburseModal.reference}
                  onChange={(e) => setDisburseModal(prev => ({ ...prev, reference: e.target.value.toUpperCase() }))}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#09090b', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.95rem', fontWeight: 800, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Admin Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via MTN MoMo Merchant"
                  value={disburseModal.notes}
                  onChange={(e) => setDisburseModal(prev => ({ ...prev, notes: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#09090b', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              <button
                type="submit"
                disabled={disburseModal.loading}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  cursor: disburseModal.loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                }}
              >
                {disburseModal.loading ? 'Recording Payout...' : 'Mark Disbursed & Completed'}
              </button>
            </form>

          </div>
        </div>
      )}

      {/* ── MODAL: WhatsApp MoMo Receipt Delivery ──────────────────── */}
      {receiptModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: '1rem' }}>
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '24px', width: '100%', maxWidth: '460px', padding: '2rem', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.25)' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              <i className="fa-solid fa-check" style={{ color: '#34d399', fontSize: '1.8rem' }}></i>
            </div>

            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
              Payout Recorded Successfully!
            </h3>
            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: '#a1a1aa', lineHeight: 1.5 }}>
              GH₵ {Number(receiptModal.amount).toFixed(2)} has been recorded as paid to <strong style={{ color: '#fbbf24' }}>{receiptModal.payoutContact}</strong> (Ref: {receiptModal.reference}).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href={receiptModal.alert?.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setReceiptModal({ isOpen: false, alert: null, payoutContact: '', amount: 0, reference: '' })}
                style={{
                  padding: '0.85rem 1.25rem',
                  borderRadius: '12px',
                  background: '#25D366',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '0.92rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(37, 211, 102, 0.35)'
                }}
              >
                <i className="fa-brands fa-whatsapp" style={{ fontSize: '1.2rem' }}></i>
                <span>Send WhatsApp Receipt to Agent</span>
              </a>

              <button
                onClick={() => setReceiptModal({ isOpen: false, alert: null, payoutContact: '', amount: 0, reference: '' })}
                style={{
                  padding: '0.75rem',
                  borderRadius: '12px',
                  background: '#121215',
                  border: '1px solid #27272a',
                  color: '#cbd5e1',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Close (Receipt Saved)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Register New Agent ──────────────────────────────── */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '24px', width: '100%', maxWidth: '480px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', position: 'relative' }}>
            
            <button
              onClick={() => setShowAddModal(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#121215', border: '1px solid #27272a', color: '#a1a1aa', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ✕
            </button>

            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
              Register Referral Partner
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: '#a1a1aa' }}>
              Onboard a new field agent or education promoter.
            </p>

            {addError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                {addError}
              </div>
            )}

            <form onSubmit={handleCreateAgent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kwame Asante"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#09090b', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Mobile Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 0244123456"
                  value={newAgentPhone}
                  onChange={(e) => setNewAgentPhone(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#09090b', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="kwame@example.com"
                  value={newAgentEmail}
                  onChange={(e) => setNewAgentEmail(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#09090b', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Custom Partner Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-generate (e.g. REF-AGT-KWAME-101)"
                  value={newAgentCode}
                  onChange={(e) => setNewAgentCode(e.target.value.toUpperCase())}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#09090b', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Account Password (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Leave blank to default to phone number"
                  value={newAgentPassword}
                  onChange={(e) => setNewAgentPassword(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#09090b', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.25rem', display: 'block' }}>
                  If omitted, defaults to the phone number so the agent can log in immediately.
                </span>
              </div>

              <button
                type="submit"
                disabled={savingAgent}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  cursor: savingAgent ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)'
                }}
              >
                {savingAgent ? 'Creating Partner...' : 'Confirm Registration'}
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
