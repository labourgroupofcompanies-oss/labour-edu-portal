import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import agentReferralService from '../../services/agentReferralService';
import agentNotificationService from '../../services/agentNotificationService';

export default function IndividualAgentsTab() {
  const [agents, setAgents] = useState([]);
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [leads, setLeads] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);

  // Filters and Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'
  const [sortBy, setSortBy] = useState('EARNINGS_DESC'); // 'EARNINGS_DESC' | 'SCHOOLS_DESC' | 'BALANCE_DESC' | 'NAME_ASC' | 'NEWEST'
  const [activeSection, setActiveSection] = useState('directory'); // 'directory' | 'payouts' | 'commissions' | 'leads' | 'audit'
  const [payoutSubTab, setPayoutSubTab] = useState('pending'); // 'pending' | 'history'

  // Modals
  // 1. Add Referrer Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPhone, setNewAgentPhone] = useState('');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentCode, setNewAgentCode] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [newAgentRate, setNewAgentRate] = useState(50);
  const [newAgentRegion, setNewAgentRegion] = useState('');
  const [savingAgent, setSavingAgent] = useState(false);
  const [addError, setAddError] = useState('');

  // 2. Edit Referrer Modal
  const [editModal, setEditModal] = useState({
    isOpen: false,
    agentId: '',
    fullName: '',
    phone: '',
    email: '',
    commissionRate: 50,
    region: '',
    status: 'ACTIVE',
    payoutNetwork: 'MTN Mobile Money',
    payoutContact: '',
    payoutAccountName: '',
    password: '',
    saving: false,
    error: ''
  });

  // 3. Manual Adjustment (Bonus / Deduction) Modal
  const [adjustmentModal, setAdjustmentModal] = useState({
    isOpen: false,
    agent: null,
    type: 'BONUS', // 'BONUS' | 'DEDUCTION'
    amount: '',
    reason: '',
    saving: false,
    error: ''
  });

  // 4. Dossier / 360 Records Modal
  const [dossierModal, setDossierModal] = useState({
    isOpen: false,
    agentId: '',
    activeTab: 'overview', // 'overview' | 'schools' | 'commissions' | 'payouts' | 'leads' | 'notes' | 'audit'
    data: null,
    loading: false
  });
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // 5. Add Inbound Lead Manually Modal
  const [leadModal, setLeadModal] = useState({
    isOpen: false,
    agentId: '',
    schoolName: '',
    contactPerson: '',
    phone: '',
    email: '',
    region: '',
    estimatedLearners: '',
    notes: '',
    saving: false,
    error: ''
  });

  // 6. Disburse Modal
  const [disburseModal, setDisburseModal] = useState({
    isOpen: false,
    request: null,
    reference: '',
    notes: '',
    loading: false,
    error: ''
  });

  // 7. Success Alert Modal with WhatsApp MoMo Receipt Link
  const [receiptModal, setReceiptModal] = useState({
    isOpen: false,
    alert: null,
    payoutContact: '',
    amount: 0,
    reference: ''
  });

  // 8. Credentials Share Modal
  const [credsModal, setCredsModal] = useState({
    isOpen: false,
    agent: null,
    alert: null
  });

  // 9. Styled Referrer Deletion Modal
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    agent: null,
    unlinkSchools: true,
    purgeCommissions: true,
    purgeRequests: true,
    purgeLeads: true,
    confirmInput: '',
    loading: false,
    error: ''
  });

  // 10. Styled Payout Rejection Modal
  const [rejectPayoutModal, setRejectPayoutModal] = useState({
    isOpen: false,
    request: null,
    reason: 'Information mismatch',
    customReason: '',
    loading: false,
    error: ''
  });

  // 11. Styled Quick Status Change Modal
  const [statusConfirmModal, setStatusConfirmModal] = useState({
    isOpen: false,
    agent: null,
    newStatus: 'ACTIVE',
    reason: '',
    loading: false,
    error: ''
  });

  // 12. Share Referral Registration Link Modal
  const [shareModal, setShareModal] = useState({ isOpen: false, copied: false });

  const loadData = async () => {
    setLoading(true);
    try {
      const [allAgents, allRequests, allComms, allLeads, allLogs] = await Promise.all([
        agentReferralService.getAllAgents(),
        agentReferralService.getAllPayoutRequests(),
        agentReferralService.getAllCommissions(),
        agentReferralService.getAllLeads ? agentReferralService.getAllLeads() : [],
        agentReferralService.getAllReferrerAuditLogs ? agentReferralService.getAllReferrerAuditLogs() : []
      ]);
      setAgents(allAgents || []);
      setPayoutRequests(allRequests || []);
      setCommissions(allComms || []);
      setLeads(allLeads || []);
      setAuditLogs(allLogs || []);
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

  // ── Share Referral Registration Link ─────────────────────────────
  const getShareUrl = () => `${window.location.origin}/agent`;

  const handleCopyShareLink = () => {
    const url = getShareUrl();
    navigator.clipboard.writeText(url).then(() => {
      setShareModal(prev => ({ ...prev, copied: true }));
      setTimeout(() => setShareModal(prev => ({ ...prev, copied: false })), 2500);
    }).catch(() => {
      // fallback for environments where clipboard API is restricted
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setShareModal(prev => ({ ...prev, copied: true }));
      setTimeout(() => setShareModal(prev => ({ ...prev, copied: false })), 2500);
    });
  };

  const handleWhatsAppShare = () => {
    const url = getShareUrl();
    const msg = `Hi! 👋 Join our *LabourEdu School Referral Partner Program* and earn commissions for every school you refer.\n\n📋 Register here: ${url}\n\n✅ It's free to join — no upfront cost!\nFor questions, contact us at the admin portal.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ── Registration Handler ──────────────────────────────────────────
  const handleCreateAgent = async (e) => {
    e.preventDefault();
    if (!newAgentName.trim() || !newAgentPhone.trim()) {
      setAddError('Please enter Full Legal Name and Phone Number.');
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
        // If custom rate or region was specified, update them
        if (Number(newAgentRate) !== 50 || newAgentRegion.trim()) {
          await agentReferralService.updateAgent(res.agent.id, {
            commissionRate: Number(newAgentRate) || 50,
            region: newAgentRegion.trim()
          });
        }

        setShowAddModal(false);
        setNewAgentName('');
        setNewAgentPhone('');
        setNewAgentEmail('');
        setNewAgentCode('');
        setNewAgentPassword('');
        setNewAgentRate(50);
        setNewAgentRegion('');
        showNotification('success', `Referrer ${res.agent.fullName} registered! Code: ${res.agent.referralCode}`);
        await loadData();
      }
    } catch (err) {
      setAddError(err.message || 'Failed to create referrer.');
    } finally {
      setSavingAgent(false);
    }
  };

  // ── Edit Referrer Handler ─────────────────────────────────────────
  const handleOpenEdit = (agent) => {
    setEditModal({
      isOpen: true,
      agentId: agent.id,
      fullName: agent.fullName || '',
      phone: agent.phone || '',
      email: agent.email || '',
      commissionRate: agent.commissionRate ?? 50,
      region: agent.region || '',
      status: agent.status || 'ACTIVE',
      payoutNetwork: agent.payoutNetwork || 'MTN Mobile Money',
      payoutContact: agent.payoutContact || agent.phone || '',
      payoutAccountName: agent.payoutAccountName || agent.fullName || '',
      password: agent.password || '',
      saving: false,
      error: ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditModal(prev => ({ ...prev, saving: true, error: '' }));
    try {
      await agentReferralService.updateAgent(editModal.agentId, {
        fullName: editModal.fullName,
        phone: editModal.phone,
        email: editModal.email,
        commissionRate: Number(editModal.commissionRate) || 50,
        region: editModal.region,
        status: editModal.status,
        payoutNetwork: editModal.payoutNetwork,
        payoutContact: editModal.payoutContact,
        payoutAccountName: editModal.payoutAccountName
      });

      if (editModal.password && editModal.password.trim()) {
        await agentReferralService.resetAgentPassword(editModal.agentId, editModal.password.trim());
      }

      setEditModal(prev => ({ ...prev, isOpen: false, saving: false }));
      showNotification('success', 'Referrer record updated successfully!');
      await loadData();

      // If dossier is currently open for this agent, refresh dossier
      if (dossierModal.isOpen && dossierModal.agentId === editModal.agentId) {
        handleOpenDossier(editModal.agentId);
      }
    } catch (err) {
      setEditModal(prev => ({ ...prev, saving: false, error: err.message || 'Failed to update referrer.' }));
    }
  };

  // ── Toggle Quick Status (Active / Suspended / Inactive) ────────────
  const handleOpenStatusConfirm = (agent, newStatus) => {
    setStatusConfirmModal({
      isOpen: true,
      agent,
      newStatus,
      reason: '',
      loading: false,
      error: ''
    });
  };

  const handleToggleStatus = (agent, newStatus) => {
    handleOpenStatusConfirm(agent, newStatus);
  };

  const handleExecuteStatusChange = async (e) => {
    e.preventDefault();
    const { agent, newStatus, reason } = statusConfirmModal;
    if (!agent) return;

    setStatusConfirmModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await agentReferralService.updateAgentStatus(
        agent.id,
        newStatus,
        reason.trim() || `Admin set status to ${newStatus}`
      );
      setStatusConfirmModal({ isOpen: false, agent: null, newStatus: 'ACTIVE', reason: '', loading: false, error: '' });
      showNotification('success', res.message);
      await loadData();
      if (dossierModal.isOpen && dossierModal.agentId === agent.id) {
        handleOpenDossier(agent.id);
      }
    } catch (err) {
      setStatusConfirmModal(prev => ({ ...prev, loading: false, error: err.message || 'Failed to change status.' }));
    }
  };

  // ── Manual Balance Adjustment Handler ─────────────────────────────
  const handleOpenAdjustment = (agent, defaultType = 'BONUS') => {
    setAdjustmentModal({
      isOpen: true,
      agent,
      type: defaultType,
      amount: '',
      reason: defaultType === 'BONUS' ? 'Special performance bonus / contest reward' : 'Chargeback / refund adjustment',
      saving: false,
      error: ''
    });
  };

  const handleExecuteAdjustment = async (e) => {
    e.preventDefault();
    const amt = Number(adjustmentModal.amount);
    if (!amt || amt <= 0) {
      setAdjustmentModal(prev => ({ ...prev, error: 'Please enter a valid amount greater than GH₵0.00.' }));
      return;
    }

    setAdjustmentModal(prev => ({ ...prev, saving: true, error: '' }));
    try {
      const res = await agentReferralService.addAgentManualAdjustment({
        agentId: adjustmentModal.agent.id,
        type: adjustmentModal.type,
        amount: amt,
        reason: adjustmentModal.reason
      });

      setAdjustmentModal({ isOpen: false, agent: null, type: 'BONUS', amount: '', reason: '', saving: false, error: '' });
      showNotification('success', res.message);
      await loadData();

      if (dossierModal.isOpen && dossierModal.agentId === adjustmentModal.agent?.id) {
        handleOpenDossier(adjustmentModal.agent.id);
      }
    } catch (err) {
      setAdjustmentModal(prev => ({ ...prev, saving: false, error: err.message || 'Adjustment failed.' }));
    }
  };

  // ── Referrer Dossier / 360-degree Records Modal ────────────────────
  const handleOpenDossier = async (agentId, defaultTab = 'overview') => {
    setDossierModal({
      isOpen: true,
      agentId,
      activeTab: defaultTab,
      data: null,
      loading: true
    });
    setNewNoteText('');

    try {
      const records = await agentReferralService.getReferrerCompleteRecords(agentId);
      setDossierModal(prev => ({
        ...prev,
        data: records,
        loading: false
      }));
    } catch (err) {
      console.warn('Error loading referrer dossier:', err);
      setDossierModal(prev => ({ ...prev, loading: false }));
      showNotification('error', 'Failed to load referrer records.');
    }
  };

  const handleAddAdminNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim() || !dossierModal.agentId) return;

    setAddingNote(true);
    try {
      await agentReferralService.addAgentNote(dossierModal.agentId, {
        noteText: newNoteText.trim()
      });
      setNewNoteText('');
      showNotification('success', 'Admin note recorded.');
      // Refresh dossier records
      const refreshed = await agentReferralService.getReferrerCompleteRecords(dossierModal.agentId);
      setDossierModal(prev => ({ ...prev, data: refreshed }));
      await loadData();
    } catch (err) {
      showNotification('error', err.message || 'Failed to add note.');
    } finally {
      setAddingNote(false);
    }
  };

  // ── Add Inbound Lead Manually ─────────────────────────────────────
  const handleOpenAddLead = (defaultAgentId = '') => {
    setLeadModal({
      isOpen: true,
      agentId: defaultAgentId || (agents[0]?.id || ''),
      schoolName: '',
      contactPerson: '',
      phone: '',
      email: '',
      region: '',
      estimatedLearners: '',
      notes: '',
      saving: false,
      error: ''
    });
  };

  const handleSaveLead = async (e) => {
    e.preventDefault();
    if (!leadModal.schoolName.trim() || !leadModal.phone.trim()) {
      setLeadModal(prev => ({ ...prev, error: 'School Name and Contact Phone are required.' }));
      return;
    }

    setLeadModal(prev => ({ ...prev, saving: true, error: '' }));
    try {
      const targetAgent = agents.find(a => a.id === leadModal.agentId);
      await agentReferralService.captureLead({
        agentCode: targetAgent?.referralCode || '',
        schoolName: leadModal.schoolName.trim(),
        contactPerson: leadModal.contactPerson.trim(),
        phone: leadModal.phone.trim(),
        email: leadModal.email.trim(),
        region: leadModal.region.trim(),
        estimatedLearners: Number(leadModal.estimatedLearners || 0),
        notes: leadModal.notes.trim()
      });

      setLeadModal(prev => ({ ...prev, isOpen: false, saving: false }));
      showNotification('success', `Demo lead recorded and locked to ${targetAgent?.fullName || 'General Inbound'} for 60 days!`);
      await loadData();
    } catch (err) {
      setLeadModal(prev => ({ ...prev, saving: false, error: err.message || 'Failed to capture lead.' }));
    }
  };

  // ── Share WhatsApp Credentials Modal ──────────────────────────────
  const handleOpenCredsModal = (agent) => {
    const alert = agentNotificationService.formatAgentCredentialsAlert(agent, agent.password || agent.phone);
    setCredsModal({
      isOpen: true,
      agent,
      alert
    });
  };

  // ── Delete / Archive Referrer Handler ─────────────────────────────
  const handleOpenDelete = (agent) => {
    setDeleteModal({
      isOpen: true,
      agent,
      unlinkSchools: true,
      purgeCommissions: true,
      purgeRequests: true,
      purgeLeads: true,
      confirmInput: '',
      loading: false,
      error: ''
    });
  };

  const handleDeleteAgent = (agent) => {
    handleOpenDelete(agent);
  };

  const handleConfirmDelete = async (e) => {
    e?.preventDefault?.();
    if (!deleteModal.agent) return;

    if (deleteModal.confirmInput.trim().toUpperCase() !== 'DELETE') {
      setDeleteModal(prev => ({ ...prev, error: 'Please type DELETE in capital letters to confirm.' }));
      return;
    }

    setDeleteModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await agentReferralService.deleteAgent(
        deleteModal.agent.id,
        {
          unlinkSchools: deleteModal.unlinkSchools,
          purgeCommissions: deleteModal.purgeCommissions,
          purgeRequests: deleteModal.purgeRequests,
          purgeLeads: deleteModal.purgeLeads
        },
        'Super Admin'
      );

      const targetAgentName = deleteModal.agent.fullName;
      const targetAgentId = deleteModal.agent.id;

      setDeleteModal({
        isOpen: false,
        agent: null,
        unlinkSchools: true,
        purgeCommissions: true,
        purgeRequests: true,
        purgeLeads: true,
        confirmInput: '',
        loading: false,
        error: ''
      });

      if (dossierModal.isOpen && dossierModal.agentId === targetAgentId) {
        setDossierModal({ isOpen: false, agentId: '', activeTab: 'overview', data: null, loading: false });
      }

      showNotification('success', res.message || `Referrer "${targetAgentName}" has been permanently removed.`);
      await loadData();
    } catch (err) {
      setDeleteModal(prev => ({ ...prev, loading: false, error: err.message || 'Failed to delete referrer.' }));
    }
  };

  // ── Disburse MoMo Payout ──────────────────────────────────────────
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
        showNotification('success', `Payout of GH₵ ${currentReq.amount.toFixed(2)} disbursed to ${currentReq.payoutContact}!`);

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

  const handleOpenRejectPayout = (request) => {
    setRejectPayoutModal({
      isOpen: true,
      request,
      reason: 'Information mismatch',
      customReason: '',
      loading: false,
      error: ''
    });
  };

  const handleRejectRequest = (request) => {
    handleOpenRejectPayout(request);
  };

  const handleConfirmRejectPayout = async (e) => {
    e?.preventDefault?.();
    const currentReq = rejectPayoutModal.request;
    if (!currentReq) return;

    const finalReason = rejectPayoutModal.reason === 'CUSTOM'
      ? (rejectPayoutModal.customReason.trim() || 'Administrative rejection')
      : (rejectPayoutModal.reason || 'Information mismatch');

    setRejectPayoutModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      await agentReferralService.rejectPayout(currentReq.id, {
        reason: finalReason,
        processedBy: 'Super Admin'
      });
      setRejectPayoutModal({
        isOpen: false,
        request: null,
        reason: 'Information mismatch',
        customReason: '',
        loading: false,
        error: ''
      });
      showNotification('success', `Request rejected and GH₵ ${Number(currentReq.amount).toFixed(2)} refunded back to ${currentReq.agentName}'s balance.`);
      await loadData();
    } catch (err) {
      setRejectPayoutModal(prev => ({ ...prev, loading: false, error: err.message || 'Failed to reject payout.' }));
    }
  };

  const handleUpdateLeadStatus = async (leadId, newStatus) => {
    try {
      await agentReferralService.updateLeadStatus(leadId, newStatus);
      showNotification('success', `Lead status updated to ${newStatus}`);
      await loadData();
    } catch (err) {
      showNotification('error', err.message || 'Failed to update lead');
    }
  };

  // ── Excel & CSV Record Exporters ──────────────────────────────────
  const exportReferrersRecords = (format = 'xlsx') => {
    if (!agents || agents.length === 0) {
      showNotification('error', 'No referrers records to export.');
      return;
    }

    const exportRows = agents.map(a => ({
      'Referrer ID': a.id,
      'Full Name': a.fullName,
      'Mobile Phone': a.phone,
      'Email': a.email || 'N/A',
      'Referral Code': a.referralCode,
      'Commission Rate (%)': a.commissionRate ?? 50,
      'Region': a.region || 'Ghana',
      'Status': a.status || 'ACTIVE',
      'Schools Referred': a.referredSchoolsCount || 0,
      'Total Commissions Earned (GH₵)': Number(a.totalEarned || 0).toFixed(2),
      'Available Balance (GH₵)': Number(a.pendingPayout || 0).toFixed(2),
      'Total Paid Out (GH₵)': Number(a.totalPaid || 0).toFixed(2),
      'MoMo Contact': a.payoutContact || a.phone,
      'MoMo Network': a.payoutNetwork || 'MTN MoMo',
      'Account Name': a.payoutAccountName || a.fullName,
      'Date Registered': new Date(a.createdAt).toLocaleDateString()
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Referrers');

    const fileBase = `LabourEdu_Referrers_Master_${new Date().toISOString().slice(0, 10)}`;
    if (format === 'csv') {
      XLSX.writeFile(wb, `${fileBase}.csv`, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, `${fileBase}.xlsx`);
    }
    showNotification('success', `Referrers records exported (${format.toUpperCase()}) successfully!`);
  };

  const exportCommissionsRecords = () => {
    if (!commissions || commissions.length === 0) {
      showNotification('error', 'No commissions records to export.');
      return;
    }
    const exportRows = commissions.map(c => ({
      'Record ID': c.id,
      'Date': new Date(c.createdAt).toLocaleDateString(),
      'School Name': c.schoolName,
      'Academic Year': c.academicYear,
      'Term': c.term,
      'Subscription Paid (GH₵)': Number(c.schoolSubscriptionPaid || 0).toFixed(2),
      '50% Commission (GH₵)': Number(c.commissionAmount || 0).toFixed(2),
      'Beneficiary Referrer': c.agentName,
      'Referrer Phone': c.agentPhone,
      'Status': c.status,
      'Notes': c.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Commissions');
    XLSX.writeFile(wb, `LabourEdu_Commissions_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showNotification('success', 'Commissions audit records exported to Excel!');
  };

  const exportPayoutsRecords = () => {
    if (!payoutRequests || payoutRequests.length === 0) {
      showNotification('error', 'No payout records to export.');
      return;
    }
    const exportRows = payoutRequests.map(r => ({
      'Request ID': r.id,
      'Request Date': new Date(r.requestedAt).toLocaleDateString(),
      'Referrer Name': r.agentName,
      'Referrer Phone': r.agentPhone,
      'MoMo Contact': r.payoutContact,
      'Network': r.payoutNetwork,
      'Account Name': r.payoutAccountName,
      'Amount (GH₵)': Number(r.amount).toFixed(2),
      'Status': r.status,
      'Transaction Ref / Receipt': r.disbursalReference || 'N/A',
      'Disbursed At': r.disbursedAt ? new Date(r.disbursedAt).toLocaleDateString() : 'N/A',
      'Admin Notes': r.adminNotes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payouts');
    XLSX.writeFile(wb, `LabourEdu_Payout_Records_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showNotification('success', 'Payout history records exported to Excel!');
  };

  const exportLeadsRecords = () => {
    if (!leads || leads.length === 0) {
      showNotification('error', 'No leads records to export.');
      return;
    }
    const exportRows = leads.map(l => ({
      'Lead ID': l.id,
      'Captured Date': new Date(l.createdAt).toLocaleDateString(),
      'School Name': l.schoolName,
      'Contact Person': l.contactPerson,
      'Phone': l.phone,
      'Email': l.email || 'N/A',
      'Region': l.region || 'N/A',
      'Est. Learners': l.estimatedLearners || 0,
      'Attributed Referrer': l.agentName || 'General',
      'Referral Code': l.agentCode || 'N/A',
      'Status': l.status,
      'Days Remaining in Lock': l.daysRemaining,
      'Notes': l.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, `LabourEdu_Captured_Leads_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showNotification('success', 'Captured leads pipeline exported to Excel!');
  };

  // ── Metrics Calculations ──────────────────────────────────────────
  const pendingRequests = payoutRequests.filter(r => r.status === 'PENDING_REVIEW');
  const disbursedRequests = payoutRequests.filter(r => r.status === 'DISBURSED');
  const totalPendingPayout = pendingRequests.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalDisbursed = disbursedRequests.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalEarnedCommissions = commissions.filter(c => c.status !== 'REVOKED').reduce((sum, c) => sum + Number(c.commissionAmount || 0), 0);
  const totalReferredSchools = agents.reduce((sum, a) => sum + (a.referredSchoolsCount || 0), 0);

  const activeLeadsCount = leads.filter(l => !l.isExpired && l.status !== 'CONVERTED').length;
  const convertedLeadsCount = leads.filter(l => l.status === 'CONVERTED').length;
  const expiredLeadsCount = leads.filter(l => l.isExpired && l.status !== 'CONVERTED').length;

  // ── Filter & Sort Referrers ───────────────────────────────────────
  const filteredAndSortedAgents = useMemo(() => {
    let result = agents.filter(a => {
      // Status filter
      if (statusFilter !== 'ALL') {
        const agStatus = a.status || 'ACTIVE';
        if (agStatus !== statusFilter) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          a.fullName?.toLowerCase().includes(q) ||
          a.phone?.toLowerCase().includes(q) ||
          a.email?.toLowerCase().includes(q) ||
          a.referralCode?.toLowerCase().includes(q) ||
          a.region?.toLowerCase().includes(q)
        );
      }
      return true;
    });

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'EARNINGS_DESC':
          return (Number(b.totalEarned) || 0) - (Number(a.totalEarned) || 0);
        case 'SCHOOLS_DESC':
          return (Number(b.referredSchoolsCount) || 0) - (Number(a.referredSchoolsCount) || 0);
        case 'BALANCE_DESC':
          return (Number(b.pendingPayout) || 0) - (Number(a.pendingPayout) || 0);
        case 'NAME_ASC':
          return String(a.fullName || '').localeCompare(String(b.fullName || ''));
        case 'NEWEST':
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [agents, statusFilter, searchQuery, sortBy]);

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
    <div style={{ color: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* ── Top Alert Banner ────────────────────────────────────────── */}
      {notice && (
        <div style={{ padding: '0.85rem 1.25rem', borderRadius: '12px', marginBottom: '1.25rem', background: notice.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: notice.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)', color: notice.type === 'success' ? '#34d399' : '#fca5a5', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className={`fa-solid ${notice.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
            <span>{notice.text}</span>
          </div>
          <button onClick={() => setNotice(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* ── Human-Crafted Header & Action Toolbar ───────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', background: '#121215', padding: '1.25rem 1.5rem', borderRadius: '14px', border: '1px solid #222226' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.3rem' }}>
            <i className="fa-solid fa-users" style={{ fontSize: '0.75rem' }}></i>
            <span>Promoter Operations &amp; Commission Ledger</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.01em' }}>
            Referrers &amp; Field Partners
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#a1a1aa' }}>
            Manage promotional referrers, inspect partner dossiers, verify MoMo payout requests, and audit 50% first-term earnings.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              background: '#f59e0b',
              border: 'none',
              color: '#09090b',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)',
              transition: 'background 0.15s ease'
            }}
          >
            <i className="fa-solid fa-user-plus" style={{ fontSize: '0.82rem' }}></i>
            <span>New Referrer</span>
          </button>

          <button
            onClick={() => handleOpenAddLead()}
            style={{
              padding: '0.55rem 0.95rem',
              borderRadius: '8px',
              background: '#18181b',
              border: '1px solid #27272a',
              color: '#f4f4f5',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-solid fa-bullseye" style={{ color: '#38bdf8', fontSize: '0.82rem' }}></i>
            <span>Log Lead</span>
          </button>

          {/* Share Referral Registration Link Button */}
          <button
            onClick={() => setShareModal({ isOpen: true, copied: false })}
            title="Share referral partner registration link"
            style={{
              padding: '0.55rem 0.95rem',
              borderRadius: '8px',
              background: '#18181b',
              border: '1px solid #3b82f6',
              color: '#93c5fd',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-solid fa-share-nodes" style={{ fontSize: '0.82rem' }}></i>
            <span>Share Link</span>
          </button>

          {/* Export Records Button */}
          <button
            onClick={() => exportReferrersRecords('xlsx')}
            title="Export Master Directory to Excel"
            style={{
              padding: '0.55rem 0.95rem',
              borderRadius: '8px',
              background: '#18181b',
              border: '1px solid #27272a',
              color: '#f4f4f5',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-solid fa-file-excel" style={{ color: '#10b981', fontSize: '0.82rem' }}></i>
            <span>Export</span>
          </button>

          <button
            onClick={loadData}
            title="Refresh Data"
            style={{
              padding: '0.55rem 0.75rem',
              borderRadius: '8px',
              background: '#18181b',
              border: '1px solid #27272a',
              color: '#a1a1aa',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <i className="fa-solid fa-rotate-right" style={{ fontSize: '0.82rem' }}></i>
          </button>
        </div>
      </div>

      {/* ── Clean Metric Cards (Restrained, Professional SaaS Style) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        
        {/* Total Active Referrers */}
        <div style={{ background: '#121215', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #222226' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Referrers
            </span>
            <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.04)', color: '#d4d4d8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem' }}>
              <i className="fa-solid fa-users"></i>
            </div>
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: '#fafafa', marginTop: '0.35rem' }}>
            {agents.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>
            {agents.filter(a => a.status === 'ACTIVE' || !a.status).length} Active • {agents.filter(a => a.status === 'SUSPENDED').length} Suspended
          </div>
        </div>

        {/* Referred Schools */}
        <div style={{ background: '#121215', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #222226' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Linked Schools
            </span>
            <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.04)', color: '#d4d4d8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem' }}>
              <i className="fa-solid fa-school"></i>
            </div>
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: '#fafafa', marginTop: '0.35rem' }}>
            {totalReferredSchools}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>
            Referred by promoters
          </div>
        </div>

        {/* Total 50% Commissions Earned */}
        <div style={{ background: '#121215', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #222226' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              50% Commissions
            </span>
            <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.04)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem' }}>
              <i className="fa-solid fa-coins"></i>
            </div>
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: '#34d399', marginTop: '0.35rem' }}>
            GH₵ {totalEarnedCommissions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>
            Total commission ledger
          </div>
        </div>

        {/* Total Paid Out */}
        <div style={{ background: '#121215', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #222226' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Disbursed (MoMo)
            </span>
            <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.04)', color: '#d4d4d8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem' }}>
              <i className="fa-solid fa-receipt"></i>
            </div>
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: '#f4f4f5', marginTop: '0.35rem' }}>
            GH₵ {totalDisbursed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>
            Completed payouts
          </div>
        </div>

        {/* Pending MoMo Payouts Queue */}
        <div style={{
          background: '#121215',
          padding: '1.15rem 1.25rem',
          borderRadius: '12px',
          border: pendingRequests.length > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #222226'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: pendingRequests.length > 0 ? '#fbbf24' : '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pending Payouts
            </span>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              background: pendingRequests.length > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              color: pendingRequests.length > 0 ? '#fbbf24' : '#71717a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.82rem'
            }}>
              <i className="fa-solid fa-bell"></i>
            </div>
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: pendingRequests.length > 0 ? '#fbbf24' : '#fafafa', marginTop: '0.35rem' }}>
            GH₵ {totalPendingPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.72rem', color: pendingRequests.length > 0 ? '#fbbf24' : '#71717a', marginTop: '0.2rem' }}>
            {pendingRequests.length > 0 ? `${pendingRequests.length} transfer(s) awaiting approval` : 'Queue is all clear'}
          </div>
        </div>

      </div>

      {/* ── Modern Segmented Control Navigation ───────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '1.5rem', background: '#121215', padding: '4px', borderRadius: '10px', border: '1px solid #222226', width: 'fit-content' }}>
        <button
          onClick={() => setActiveSection('directory')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '7px',
            border: 'none',
            background: activeSection === 'directory' ? '#27272a' : 'transparent',
            color: activeSection === 'directory' ? '#fafafa' : '#a1a1aa',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: activeSection === 'directory' ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <i className="fa-solid fa-users" style={{ fontSize: '0.82rem', color: activeSection === 'directory' ? '#f59e0b' : '#71717a' }}></i>
          <span>Referrers Directory</span>
          <span style={{ background: activeSection === 'directory' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', color: activeSection === 'directory' ? '#fafafa' : '#a1a1aa', fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '6px', fontWeight: 700 }}>
            {agents.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSection('payouts')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '7px',
            border: 'none',
            background: activeSection === 'payouts' ? '#27272a' : 'transparent',
            color: activeSection === 'payouts' ? '#fafafa' : '#a1a1aa',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: activeSection === 'payouts' ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <i className="fa-solid fa-money-bill-transfer" style={{ fontSize: '0.82rem', color: activeSection === 'payouts' ? '#10b981' : '#71717a' }}></i>
          <span>Payout Requests</span>
          {pendingRequests.length > 0 ? (
            <span style={{ background: '#ef4444', color: '#ffffff', fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '6px', fontWeight: 700 }}>
              {pendingRequests.length}
            </span>
          ) : (
            <span style={{ background: activeSection === 'payouts' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', color: activeSection === 'payouts' ? '#fafafa' : '#a1a1aa', fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '6px', fontWeight: 700 }}>
              {payoutRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSection('commissions')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '7px',
            border: 'none',
            background: activeSection === 'commissions' ? '#27272a' : 'transparent',
            color: activeSection === 'commissions' ? '#fafafa' : '#a1a1aa',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: activeSection === 'commissions' ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <i className="fa-solid fa-receipt" style={{ fontSize: '0.82rem', color: activeSection === 'commissions' ? '#a78bfa' : '#71717a' }}></i>
          <span>Commissions Ledger</span>
          <span style={{ background: activeSection === 'commissions' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', color: activeSection === 'commissions' ? '#fafafa' : '#a1a1aa', fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '6px', fontWeight: 700 }}>
            {commissions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSection('leads')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '7px',
            border: 'none',
            background: activeSection === 'leads' ? '#27272a' : 'transparent',
            color: activeSection === 'leads' ? '#fafafa' : '#a1a1aa',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: activeSection === 'leads' ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <i className="fa-solid fa-bullseye" style={{ fontSize: '0.82rem', color: activeSection === 'leads' ? '#38bdf8' : '#71717a' }}></i>
          <span>Captured Leads</span>
          {leads.length > 0 && (
            <span style={{ background: activeSection === 'leads' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', color: activeSection === 'leads' ? '#fafafa' : '#a1a1aa', fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '6px', fontWeight: 700 }}>
              {leads.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSection('audit')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '7px',
            border: 'none',
            background: activeSection === 'audit' ? '#27272a' : 'transparent',
            color: activeSection === 'audit' ? '#fafafa' : '#a1a1aa',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: activeSection === 'audit' ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: '0.82rem', color: activeSection === 'audit' ? '#e2e8f0' : '#71717a' }}></i>
          <span>Audit Logs</span>
          <span style={{ background: activeSection === 'audit' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', color: activeSection === 'audit' ? '#fafafa' : '#a1a1aa', fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '6px', fontWeight: 700 }}>
            {auditLogs.length}
          </span>
        </button>
      </div>

      {/* ── SECTION 1: REFERRERS DIRECTORY & MANAGEMENT ──────────────── */}
      {activeSection === 'directory' && (
        <div style={{ background: '#121215', borderRadius: '14px', border: '1px solid #222226', overflow: 'hidden' }}>
          
          {/* Table Toolbar with Filters & Sorting */}
          <div style={{ padding: '1.15rem 1.25rem', borderBottom: '1px solid #222226', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: '#121215' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', color: '#d4d4d8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-users" style={{ fontSize: '0.9rem' }}></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif' }}>
                  Referrers Directory ({filteredAndSortedAgents.length})
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#71717a' }}>
                  Field promoters, custom referral codes, and linked commissions
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#71717a', fontSize: '0.75rem' }}></i>
                <input
                  type="text"
                  placeholder="Filter promoters..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ padding: '0.45rem 0.85rem 0.45rem 2rem', borderRadius: '8px', background: '#09090b', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.8rem', width: '190px', outline: 'none' }}
                />
              </div>

              {/* Status Filter */}
              <div style={{ display: 'flex', background: '#09090b', borderRadius: '8px', padding: '3px', border: '1px solid #27272a' }}>
                {['ALL', 'ACTIVE', 'SUSPENDED', 'INACTIVE'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: statusFilter === st ? '#27272a' : 'transparent',
                      color: statusFilter === st ? '#fafafa' : '#a1a1aa',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              {/* Sort By Selector */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', background: '#09090b', border: '1px solid #27272a', color: '#d4d4d8', fontSize: '0.78rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
              >
                <option value="EARNINGS_DESC">Earnings (High to Low)</option>
                <option value="SCHOOLS_DESC">Schools Referred</option>
                <option value="BALANCE_DESC">Wallet Balance</option>
                <option value="NAME_ASC">Name (A-Z)</option>
                <option value="NEWEST">Recently Added</option>
              </select>

              {/* CSV Export Option */}
              <button
                onClick={() => exportReferrersRecords('csv')}
                title="Export as CSV"
                style={{
                  background: '#09090b',
                  border: '1px solid #27272a',
                  color: '#d4d4d8',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <i className="fa-solid fa-file-csv" style={{ fontSize: '0.8rem' }}></i>
                <span>CSV</span>
              </button>

            </div>
          </div>

          {/* Referrers Table */}
          {filteredAndSortedAgents.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#0e0e11', color: '#71717a', borderBottom: '1px solid #222226', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.8rem 1.15rem', maxWidth: '220px', width: '220px' }}>Promoter</th>
                    <th style={{ padding: '0.8rem 0.95rem', maxWidth: '220px', width: '220px' }}>Referral Code &amp; Link</th>
                    <th style={{ padding: '0.8rem 0.75rem' }}>Rate</th>
                    <th style={{ padding: '0.8rem 0.75rem' }}>Schools</th>
                    <th style={{ padding: '0.8rem 0.95rem' }}>Total Earned</th>
                    <th style={{ padding: '0.8rem 0.95rem' }}>Wallet Balance</th>
                    <th style={{ padding: '0.8rem 0.95rem' }}>Paid Out</th>
                    <th style={{ padding: '0.8rem 0.95rem' }}>Status</th>
                    <th style={{ padding: '0.8rem 1.15rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedAgents.map(a => {
                    const isSuspended = a.status === 'SUSPENDED';
                    const isInactive = a.status === 'INACTIVE';
                    const rate = a.commissionRate ?? 50;

                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid #1f1f23', background: isSuspended ? 'rgba(239, 68, 68, 0.03)' : 'transparent', transition: 'background 0.15s' }}>
                        
                        {/* Referrer Details */}
                        <td style={{ padding: '0.9rem 1.15rem', maxWidth: '220px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              flexShrink: 0,
                              borderRadius: '8px',
                              background: isSuspended ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.12)',
                              color: isSuspended ? '#f87171' : '#f59e0b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.85rem'
                            }}>
                              {a.fullName?.charAt(0)?.toUpperCase() || 'P'}
                            </div>
                            <div style={{ minWidth: 0, overflow: 'hidden' }}>
                              <div style={{ fontWeight: 600, color: '#fafafa', display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.fullName}>{a.fullName}</span>
                                {a.region && (
                                  <span style={{ fontSize: '0.68rem', background: '#1c1c20', color: '#a1a1aa', padding: '0.1rem 0.4rem', borderRadius: '4px', flexShrink: 0 }}>
                                    {a.region}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.73rem', color: '#71717a', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.phone}>
                                  <i className="fa-solid fa-phone" style={{ fontSize: '0.65rem', marginRight: '3px' }}></i>{a.phone}
                                </span>
                                {a.email && (
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.email}>
                                    <i className="fa-regular fa-envelope" style={{ fontSize: '0.65rem', marginRight: '3px' }}></i>{a.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Referral Code & Action Links */}
                        <td style={{ padding: '0.9rem 0.95rem', maxWidth: '220px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                            <code
                              title={a.referralCode}
                              style={{
                                background: '#09090b',
                                border: '1px solid #27272a',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '5px',
                                color: '#f59e0b',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                letterSpacing: '0.02em',
                                maxWidth: '110px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'inline-block',
                                verticalAlign: 'middle',
                              }}
                            >
                              {a.referralCode}
                            </code>
                            
                            {/* Copy School Reg Link */}
                            <button
                              title="Copy School Registration Link"
                              onClick={() => {
                                const schoolBase = import.meta.env.VITE_SCHOOL_PORTAL_URL || 'https://app.labouredu.com';
                                const refUrl = `${schoolBase}/onboarding?ref=${a.referralCode}`;
                                navigator.clipboard.writeText(refUrl);
                                showNotification('success', `Copied school signup link for ${a.fullName}`);
                              }}
                              style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', padding: '0.25rem 0.45rem', borderRadius: '5px', cursor: 'pointer', fontSize: '0.72rem' }}
                            >
                              <i className="fa-regular fa-copy"></i>
                            </button>

                            {/* Share Credentials via WhatsApp */}
                            <button
                              title="Send Portal Access Info via WhatsApp"
                              onClick={() => handleOpenCredsModal(a)}
                              style={{ background: 'rgba(37, 211, 102, 0.1)', border: '1px solid rgba(37, 211, 102, 0.25)', color: '#25D366', padding: '0.25rem 0.45rem', borderRadius: '5px', cursor: 'pointer', fontSize: '0.72rem' }}
                            >
                              <i className="fa-brands fa-whatsapp"></i>
                            </button>

                            {/* Open Agent Portal in New Tab */}
                            <a
                              href={`/agent/portal/${a.referralCode}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open Referrer Portal in New Tab"
                              style={{ background: '#18181b', border: '1px solid #27272a', color: '#60a5fa', padding: '0.25rem 0.45rem', borderRadius: '5px', cursor: 'pointer', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                            >
                              <i className="fa-solid fa-arrow-up-right-from-square"></i>
                            </a>
                          </div>
                        </td>

                        {/* Commission Rate */}
                        <td style={{ padding: '0.9rem 0.75rem' }}>
                          <span style={{ color: '#d4d4d8', fontWeight: 600, fontSize: '0.8rem' }}>
                            {rate}%
                          </span>
                        </td>

                        {/* Schools Count */}
                        <td style={{ padding: '0.9rem 0.75rem' }}>
                          <span style={{ fontWeight: 600, color: '#fafafa', fontSize: '0.88rem' }}>{a.referredSchoolsCount || 0}</span>
                        </td>

                        {/* Total Earned */}
                        <td style={{ padding: '0.9rem 0.95rem', fontWeight: 600, color: '#34d399' }}>
                          GH₵ {Number(a.totalEarned || 0).toFixed(2)}
                        </td>

                        {/* Available Balance */}
                        <td style={{ padding: '0.9rem 0.95rem' }}>
                          <div style={{ color: Number(a.pendingPayout || 0) > 0 ? '#fbbf24' : '#a1a1aa', fontWeight: 600 }}>
                            GH₵ {Number(a.pendingPayout || 0).toFixed(2)}
                          </div>
                          {Number(a.heldInRequest || 0) > 0 && (
                            <div style={{ fontSize: '0.68rem', color: '#f87171', marginTop: '2px' }}>
                              GH₵ {Number(a.heldInRequest).toFixed(2)} held
                            </div>
                          )}
                        </td>

                        {/* Total Paid Out */}
                        <td style={{ padding: '0.9rem 0.95rem', fontWeight: 500, color: '#d4d4d8' }}>
                          GH₵ {Number(a.totalPaid || 0).toFixed(2)}
                        </td>

                        {/* Status Badge & Quick Status Selector */}
                        <td style={{ padding: '0.9rem 0.95rem' }}>
                          {isSuspended ? (
                            <span
                              onClick={() => handleToggleStatus(a, 'ACTIVE')}
                              title="Click to Activate"
                              style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <i className="fa-solid fa-ban" style={{ fontSize: '0.65rem' }}></i> Suspended
                            </span>
                          ) : isInactive ? (
                            <span
                              onClick={() => handleToggleStatus(a, 'ACTIVE')}
                              title="Click to Activate"
                              style={{ background: 'rgba(113, 113, 122, 0.1)', color: '#a1a1aa', border: '1px solid #3f3f46', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <i className="fa-solid fa-pause" style={{ fontSize: '0.65rem' }}></i> Inactive
                            </span>
                          ) : (
                            <span
                              onClick={() => handleToggleStatus(a, 'SUSPENDED')}
                              title="Click to Suspend"
                              style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <i className="fa-solid fa-circle-check" style={{ fontSize: '0.65rem' }}></i> Active
                            </span>
                          )}
                        </td>

                        {/* Row Actions */}
                        <td style={{ padding: '0.9rem 1.15rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px', alignItems: 'center' }}>
                            
                            {/* View Records & Dossier (Primary Action) */}
                            <button
                              onClick={() => handleOpenDossier(a.id)}
                              title="View Complete Partner Dossier & Referrals"
                              style={{
                                background: '#18181b',
                                border: '1px solid #27272a',
                                color: '#fafafa',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              <i className="fa-solid fa-id-card" style={{ color: '#f59e0b', fontSize: '0.75rem' }}></i>
                              <span>Dossier</span>
                            </button>

                            {/* Manual Adjustment (+/-) */}
                            <button
                              onClick={() => handleOpenAdjustment(a)}
                              title="Credit Bonus or Apply Deduction"
                              style={{
                                background: '#18181b',
                                border: '1px solid #27272a',
                                color: '#d4d4d8',
                                padding: '0.35rem 0.55rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <i className="fa-solid fa-sliders" style={{ fontSize: '0.75rem' }}></i>
                            </button>

                            {/* Edit Profile */}
                            <button
                              onClick={() => handleOpenEdit(a)}
                              title="Edit Referrer Profile & Details"
                              style={{
                                background: '#18181b',
                                border: '1px solid #27272a',
                                color: '#d4d4d8',
                                padding: '0.35rem 0.55rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <i className="fa-solid fa-pen" style={{ fontSize: '0.75rem' }}></i>
                            </button>

                            {/* Delete / Archive */}
                            <button
                              onClick={() => handleDeleteAgent(a)}
                              title="Delete Referrer Permanently"
                              style={{
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#f87171',
                                padding: '0.35rem 0.55rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <i className="fa-solid fa-trash-can" style={{ fontSize: '0.75rem' }}></i>
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
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                <i className="fa-solid fa-users" style={{ fontSize: '1.5rem', color: '#f59e0b' }}></i>
              </div>
              <h4 style={{ margin: '0 0 0.25rem 0', color: '#f8fafc', fontSize: '1rem', fontWeight: 700 }}>No Referrers Found</h4>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem' }}>No registered referrers match your search query or filter.</p>
              <button
                onClick={() => setShowAddModal(true)}
                style={{ background: '#f59e0b', color: '#000', border: 'none', padding: '0.55rem 1rem', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Register First Referrer
              </button>
            </div>
          )}

        </div>
      )}

      {/* ── SECTION 2: WITHDRAWAL REQUESTS & PAYOUT RECORDS ──────────── */}
      {activeSection === 'payouts' && (
        <div style={{ background: '#121215', borderRadius: '14px', border: '1px solid #222226', overflow: 'hidden' }}>
          
          {/* Sub Tab Switcher & Export */}
          <div style={{ padding: '1.15rem 1.25rem', borderBottom: '1px solid #222226', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#121215', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', color: '#d4d4d8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-money-bill-transfer" style={{ fontSize: '0.9rem' }}></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif' }}>
                  Payout Requests &amp; Disbursal History
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#71717a' }}>
                  Execute Mobile Money transfers and maintain complete disbursement ledger
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: '#09090b', borderRadius: '8px', padding: '3px', border: '1px solid #27272a' }}>
                <button
                  onClick={() => setPayoutSubTab('pending')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: payoutSubTab === 'pending' ? '#27272a' : 'transparent',
                    color: payoutSubTab === 'pending' ? '#fafafa' : '#a1a1aa',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Pending ({pendingRequests.length})
                </button>
                <button
                  onClick={() => setPayoutSubTab('history')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: payoutSubTab === 'history' ? '#27272a' : 'transparent',
                    color: payoutSubTab === 'history' ? '#fafafa' : '#a1a1aa',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Completed ({disbursedRequests.length})
                </button>
              </div>

              <button
                onClick={exportPayoutsRecords}
                style={{
                  background: '#09090b',
                  border: '1px solid #27272a',
                  color: '#d4d4d8',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <i className="fa-solid fa-file-excel" style={{ color: '#10b981', fontSize: '0.8rem' }}></i>
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Pending Sub-Tab */}
          {payoutSubTab === 'pending' && (
            pendingRequests.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#0e0e11', color: '#71717a', borderBottom: '1px solid #222226', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '0.8rem 1.15rem' }}>Request Date</th>
                      <th style={{ padding: '0.8rem 0.95rem' }}>Promoter</th>
                      <th style={{ padding: '0.8rem 0.95rem' }}>MoMo Destination</th>
                      <th style={{ padding: '0.8rem 0.95rem' }}>Network &amp; Name</th>
                      <th style={{ padding: '0.8rem 0.95rem', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '0.8rem 1.15rem', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map(req => {
                      const agentComms = commissions.filter(c => c.agentId === req.agentId);
                      const hasLowLearnerRisk = agentComms.some(c => c.lowLearnerWarning);

                      return (
                        <tr key={req.id} style={{ borderBottom: '1px solid #1f1f23', background: hasLowLearnerRisk ? 'rgba(239, 68, 68, 0.03)' : 'transparent' }}>
                          <td style={{ padding: '0.9rem 1.15rem', color: '#cbd5e1' }}>
                            <div style={{ fontWeight: 600, color: '#fafafa' }}>{new Date(req.requestedAt).toLocaleDateString()}</div>
                            <div style={{ fontSize: '0.7rem', color: '#71717a' }}>{new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td style={{ padding: '0.9rem 0.95rem' }}>
                            <div style={{ fontWeight: 600, color: '#fafafa' }}>{req.agentName}</div>
                            <div style={{ fontSize: '0.72rem', color: '#71717a' }}>{req.agentPhone}</div>
                            {hasLowLearnerRisk && (
                              <div style={{ marginTop: '0.2rem' }}>
                                <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600 }}>
                                  <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '3px' }}></i> Low Learners Flag
                                </span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.9rem 0.95rem' }}>
                            <span style={{ background: '#09090b', border: '1px solid #27272a', color: '#fbbf24', padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem' }}>
                              {req.payoutContact}
                            </span>
                          </td>
                          <td style={{ padding: '0.9rem 0.95rem' }}>
                            <div style={{ fontWeight: 600, color: '#fafafa' }}>{req.payoutNetwork}</div>
                            <div style={{ fontSize: '0.72rem', color: '#71717a' }}>{req.payoutAccountName}</div>
                          </td>
                          <td style={{ padding: '0.9rem 0.95rem', textAlign: 'right' }}>
                            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#34d399' }}>
                              GH₵ {Number(req.amount).toFixed(2)}
                            </span>
                          </td>
                          <td style={{ padding: '0.9rem 1.15rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                              <button
                                onClick={() => handleOpenDisburse(req)}
                                style={{
                                  background: '#10b981',
                                  border: 'none',
                                  color: '#09090b',
                                  fontWeight: 700,
                                  fontSize: '0.76rem',
                                  padding: '0.4rem 0.75rem',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <i className="fa-solid fa-paper-plane" style={{ fontSize: '0.72rem' }}></i>
                                <span>Disburse</span>
                              </button>
                              <button
                                onClick={() => handleRejectRequest(req)}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.08)',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  color: '#f87171',
                                  fontWeight: 600,
                                  fontSize: '0.76rem',
                                  padding: '0.4rem 0.75rem',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <i className="fa-solid fa-xmark" style={{ fontSize: '0.75rem' }}></i>
                                <span>Reject</span>
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
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#71717a' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
                  <i className="fa-solid fa-circle-check" style={{ fontSize: '1.3rem', color: '#10b981' }}></i>
                </div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#fafafa', fontSize: '0.95rem', fontWeight: 600 }}>Queue All Clear</h4>
                <p style={{ margin: 0, fontSize: '0.8rem' }}>No pending withdrawal requests. All referrer payouts are processed.</p>
              </div>
            )
          )}

          {/* History Sub-Tab */}
          {payoutSubTab === 'history' && (
            disbursedRequests.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#0e0e11', color: '#71717a', borderBottom: '1px solid #222226', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '0.8rem 1.15rem' }}>Disbursal Date</th>
                      <th style={{ padding: '0.8rem 0.95rem' }}>Promoter</th>
                      <th style={{ padding: '0.8rem 0.95rem' }}>Destination MoMo</th>
                      <th style={{ padding: '0.8rem 0.95rem' }}>Transaction Ref</th>
                      <th style={{ padding: '0.8rem 0.95rem', textAlign: 'right' }}>Amount Paid</th>
                      <th style={{ padding: '0.8rem 1.15rem' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disbursedRequests.map(req => (
                      <tr key={req.id} style={{ borderBottom: '1px solid #1f1f23' }}>
                        <td style={{ padding: '0.85rem 1.15rem', color: '#cbd5e1' }}>
                          <div style={{ fontWeight: 600, color: '#fafafa' }}>{new Date(req.disbursedAt || req.requestedAt).toLocaleDateString()}</div>
                          <div style={{ fontSize: '0.7rem', color: '#71717a' }}>{req.id}</div>
                        </td>
                        <td style={{ padding: '0.85rem 0.95rem' }}>
                          <div style={{ fontWeight: 600, color: '#fafafa' }}>{req.agentName}</div>
                          <div style={{ fontSize: '0.72rem', color: '#71717a' }}>{req.payoutAccountName}</div>
                        </td>
                        <td style={{ padding: '0.85rem 0.95rem' }}>
                          <span style={{ color: '#fbbf24', fontWeight: 600 }}>{req.payoutContact}</span>
                          <div style={{ fontSize: '0.7rem', color: '#71717a' }}>{req.payoutNetwork}</div>
                        </td>
                        <td style={{ padding: '0.85rem 0.95rem' }}>
                          <code style={{ background: '#09090b', border: '1px solid #27272a', padding: '0.2rem 0.45rem', borderRadius: '4px', color: '#34d399', fontWeight: 600, fontSize: '0.78rem' }}>
                            {req.disbursalReference || 'N/A'}
                          </code>
                        </td>
                        <td style={{ padding: '0.85rem 0.95rem', textAlign: 'right' }}>
                          <strong style={{ fontSize: '0.95rem', color: '#34d399' }}>
                            GH₵ {Number(req.amount).toFixed(2)}
                          </strong>
                        </td>
                        <td style={{ padding: '0.85rem 1.15rem', color: '#a1a1aa', fontSize: '0.75rem' }}>
                          {req.adminNotes || 'Completed transfer'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#71717a' }}>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>No past disbursed payouts found.</p>
              </div>
            )
          )}

        </div>
      )}

      {/* ── SECTION 3: COMMISSIONS AUDIT LEDGER ──────────────────────── */}
      {activeSection === 'commissions' && (
        <div style={{ background: '#121215', borderRadius: '14px', border: '1px solid #222226', overflow: 'hidden' }}>
          <div style={{ padding: '1.15rem 1.25rem', borderBottom: '1px solid #222226', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#121215', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', color: '#d4d4d8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-receipt" style={{ fontSize: '0.9rem' }}></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif' }}>
                  Commissions Audit Ledger ({commissions.length})
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#71717a' }}>
                  First-term 50% commission entries, manual adjustments, and active learner counts
                </span>
              </div>
            </div>

            <button
              onClick={exportCommissionsRecords}
              style={{
                background: '#09090b',
                border: '1px solid #27272a',
                color: '#d4d4d8',
                fontWeight: 600,
                fontSize: '0.78rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <i className="fa-solid fa-file-excel" style={{ color: '#10b981', fontSize: '0.8rem' }}></i>
              <span>Export</span>
            </button>
          </div>

          {commissions.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#0e0e11', color: '#71717a', borderBottom: '1px solid #222226', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.8rem 1.15rem' }}>Date &amp; Ref</th>
                    <th style={{ padding: '0.8rem 0.95rem' }}>Referred School</th>
                    <th style={{ padding: '0.8rem 0.95rem' }}>Term / Year</th>
                    <th style={{ padding: '0.8rem 0.95rem' }}>School Payment</th>
                    <th style={{ padding: '0.8rem 0.95rem' }}>50% Commission</th>
                    <th style={{ padding: '0.8rem 0.95rem' }}>Promoter</th>
                    <th style={{ padding: '0.8rem 0.95rem' }}>Validation</th>
                    <th style={{ padding: '0.8rem 1.15rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map(c => {
                    const isPositive = Number(c.commissionAmount) >= 0;

                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #1f1f23' }}>
                        <td style={{ padding: '0.85rem 1.15rem', color: '#cbd5e1' }}>
                          <div style={{ fontWeight: 600, color: '#fafafa' }}>{new Date(c.createdAt).toLocaleDateString()}</div>
                          <div style={{ fontSize: '0.68rem', color: '#71717a' }}>{c.id}</div>
                        </td>
                        <td style={{ padding: '0.85rem 0.95rem', fontWeight: 600, color: '#fafafa' }}>
                          {c.schoolName}
                        </td>
                        <td style={{ padding: '0.85rem 0.95rem' }}>
                          <span style={{ background: '#09090b', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', border: '1px solid #27272a', color: '#cbd5e1' }}>
                            {c.term} • {c.academicYear}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 0.95rem', fontWeight: 600, color: '#d4d4d8' }}>
                          GH₵ {Number(c.schoolSubscriptionPaid || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.85rem 0.95rem' }}>
                          <strong style={{ fontSize: '0.95rem', color: isPositive ? '#34d399' : '#f87171' }}>
                            {isPositive ? '+' : ''}GH₵ {Number(c.commissionAmount || 0).toFixed(2)}
                          </strong>
                        </td>
                        <td style={{ padding: '0.85rem 0.95rem' }}>
                          <div style={{ fontWeight: 600, color: '#fafafa' }}>{c.agentName}</div>
                          <div style={{ fontSize: '0.7rem', color: '#71717a' }}>{c.agentPhone}</div>
                        </td>
                        <td style={{ padding: '0.85rem 0.95rem' }}>
                          {c.isManualAdjustment ? (
                            <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                              <i className="fa-solid fa-sliders" style={{ marginRight: '3px' }}></i> Adjustment
                            </span>
                          ) : c.lowLearnerWarning ? (
                            <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '3px' }}></i> &lt; 15 Learners ({c.activeLearnersCount || 0})
                            </span>
                          ) : (
                            <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                              <i className="fa-solid fa-circle-check" style={{ marginRight: '3px' }}></i> Verified ({c.activeLearnersCount || '15+'} Learners)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1.15rem' }}>
                          {c.status === 'PAID' ? (
                            <span style={{ color: '#34d399', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <i className="fa-solid fa-circle-check" style={{ fontSize: '0.65rem' }}></i> Disbursed
                            </span>
                          ) : c.status === 'DEDUCTED' ? (
                            <span style={{ color: '#f87171', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <i className="fa-solid fa-rotate-left" style={{ fontSize: '0.65rem' }}></i> Deducted
                            </span>
                          ) : (
                            <span style={{ color: '#60a5fa', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <i className="fa-solid fa-circle" style={{ fontSize: '0.5rem' }}></i> Available
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#71717a' }}>
              <p style={{ margin: 0, fontSize: '0.82rem' }}>No commissions recorded yet.</p>
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 4: CAPTURED LEADS PIPELINE ──────────────────────── */}
      {activeSection === 'leads' && (
        <div>
          {/* Summary Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#121215', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #222226' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Inbound Leads</span>
                <i className="fa-solid fa-bullseye" style={{ color: '#38bdf8', fontSize: '0.85rem' }}></i>
              </div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.65rem', fontWeight: 700, marginTop: '0.35rem', color: '#fafafa' }}>
                {leads.length}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>Demo requests captured</div>
            </div>

            <div style={{ background: '#121215', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #222226' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>In 60-Day Lock</span>
                <i className="fa-solid fa-lock" style={{ color: '#34d399', fontSize: '0.85rem' }}></i>
              </div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.65rem', fontWeight: 700, marginTop: '0.35rem', color: '#34d399' }}>
                {activeLeadsCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>Locked to referring agent</div>
            </div>

            <div style={{ background: '#121215', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #222226' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Converted</span>
                <i className="fa-solid fa-circle-check" style={{ color: '#fbbf24', fontSize: '0.85rem' }}></i>
              </div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.65rem', fontWeight: 700, marginTop: '0.35rem', color: '#fbbf24' }}>
                {convertedLeadsCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>Registered on platform</div>
            </div>

            <div style={{ background: '#121215', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #222226' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Expired</span>
                <i className="fa-solid fa-clock" style={{ color: '#71717a', fontSize: '0.85rem' }}></i>
              </div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.65rem', fontWeight: 700, marginTop: '0.35rem', color: '#d4d4d8' }}>
                {expiredLeadsCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>Returned to open pool</div>
            </div>
          </div>

          {/* Leads Table */}
          <div style={{ background: '#121215', borderRadius: '14px', border: '1px solid #222226', overflow: 'hidden' }}>
            <div style={{ padding: '1.15rem 1.25rem', borderBottom: '1px solid #222226', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: '#121215' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', color: '#d4d4d8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-bullseye" style={{ fontSize: '0.9rem' }}></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif' }}>
                    Captured Leads Pipeline ({filteredLeads.length})
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: '#71717a' }}>
                    Prospective schools captured via promoter referral links
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleOpenAddLead()}
                  style={{
                    background: '#18181b',
                    border: '1px solid #27272a',
                    color: '#fafafa',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <i className="fa-solid fa-plus" style={{ fontSize: '0.75rem' }}></i>
                  <span>Add Lead</span>
                </button>

                <button
                  onClick={exportLeadsRecords}
                  style={{
                    background: '#09090b',
                    border: '1px solid #27272a',
                    color: '#d4d4d8',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <i className="fa-solid fa-file-excel" style={{ color: '#10b981', fontSize: '0.8rem' }}></i>
                  <span>Export</span>
                </button>
              </div>
            </div>

            {filteredLeads.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#0e0e11', color: '#71717a', borderBottom: '1px solid #222226', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '0.8rem 1.15rem' }}>School &amp; Region</th>
                      <th style={{ padding: '0.8rem 0.95rem' }}>Contact</th>
                      <th style={{ padding: '0.8rem 0.95rem' }}>Promoter</th>
                      <th style={{ padding: '0.8rem 0.95rem' }}>Protection Window</th>
                      <th style={{ padding: '0.8rem 0.95rem' }}>Status</th>
                      <th style={{ padding: '0.8rem 1.15rem', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map(lead => {
                      const headteacherWaMsg = `Hello ${lead.contactPerson}, I am reaching out from Labour Educational Portal regarding your school demo request for ${lead.schoolName}. When would be convenient for a quick walkthrough?`;
                      const headteacherWaUrl = agentNotificationService.createWhatsAppUrl(lead.phone, headteacherWaMsg);

                      return (
                        <tr key={lead.id} style={{ borderBottom: '1px solid #1f1f23' }}>
                          <td style={{ padding: '0.85rem 1.15rem' }}>
                            <div style={{ fontWeight: 600, color: '#fafafa' }}>{lead.schoolName}</div>
                            <div style={{ fontSize: '0.7rem', color: '#71717a' }}>
                              {lead.region || 'National'} • ~{lead.estimatedLearners || 0} Learners
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 0.95rem' }}>
                            <div style={{ fontWeight: 600, color: '#fafafa' }}>{lead.contactPerson}</div>
                            <div style={{ fontSize: '0.73rem', color: '#fbbf24', fontWeight: 600 }}>{lead.phone}</div>
                            {lead.email && <div style={{ fontSize: '0.7rem', color: '#71717a' }}>{lead.email}</div>}
                          </td>
                          <td style={{ padding: '0.85rem 0.95rem' }}>
                            <div style={{ fontWeight: 600, color: '#60a5fa' }}>{lead.agentName || 'General Inbound'}</div>
                            {lead.agentCode && (
                              <code style={{ background: '#09090b', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', color: '#fbbf24', border: '1px solid #27272a' }}>
                                {lead.agentCode}
                              </code>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 0.95rem' }}>
                            {lead.status === 'CONVERTED' ? (
                              <span style={{ color: '#34d399', fontWeight: 600, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <i className="fa-solid fa-circle-check" style={{ fontSize: '0.65rem' }}></i> Converted
                              </span>
                            ) : lead.isExpired ? (
                              <span style={{ color: '#71717a', fontWeight: 500, fontSize: '0.72rem' }}>
                                Window Expired
                              </span>
                            ) : (
                              <span style={{ background: '#09090b', border: '1px solid #27272a', color: '#38bdf8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600, fontSize: '0.74rem' }}>
                                <i className="fa-solid fa-hourglass-half" style={{ fontSize: '0.65rem', marginRight: '4px' }}></i> {lead.daysRemaining}d left
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 0.95rem' }}>
                            {lead.status === 'CONVERTED' ? (
                              <span style={{ color: '#34d399', fontSize: '0.75rem', fontWeight: 600 }}>● Converted</span>
                            ) : lead.status === 'CONTACTED' ? (
                              <span style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 600 }}>● Contacted</span>
                            ) : (
                              <span style={{ color: '#fbbf24', fontSize: '0.75rem', fontWeight: 600 }}>● New Inbound</span>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <a
                                href={headteacherWaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  background: 'rgba(37, 211, 102, 0.1)',
                                  border: '1px solid rgba(37, 211, 102, 0.25)',
                                  color: '#25D366',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  textDecoration: 'none',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <i className="fa-brands fa-whatsapp"></i>
                                <span>WhatsApp</span>
                              </a>

                              {lead.status !== 'CONTACTED' && lead.status !== 'CONVERTED' && (
                                <button
                                  onClick={() => handleUpdateLeadStatus(lead.id, 'CONTACTED')}
                                  style={{
                                    background: '#18181b',
                                    border: '1px solid #27272a',
                                    color: '#d4d4d8',
                                    padding: '0.35rem 0.6rem',
                                    borderRadius: '6px',
                                    fontSize: '0.74rem',
                                    fontWeight: 500,
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
                                    background: 'rgba(16, 185, 129, 0.12)',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    color: '#34d399',
                                    padding: '0.35rem 0.6rem',
                                    borderRadius: '6px',
                                    fontSize: '0.74rem',
                                    fontWeight: 600,
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
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#71717a' }}>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>No leads captured yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SECTION 5: ACTIVITY AUDIT TRAIL ─────────────────────────── */}
      {activeSection === 'audit' && (
        <div style={{ background: '#121215', borderRadius: '14px', border: '1px solid #222226', overflow: 'hidden' }}>
          <div style={{ padding: '1.15rem 1.25rem', borderBottom: '1px solid #222226', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#121215', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', color: '#d4d4d8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: '0.9rem' }}></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif' }}>
                  Activity Audit Trail ({auditLogs.length})
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#71717a' }}>
                  Immutable log of administrative interventions, status adjustments, and payouts
                </span>
              </div>
            </div>
          </div>

          {auditLogs.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#0e0e11', color: '#71717a', borderBottom: '1px solid #222226', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.8rem 1.15rem' }}>Timestamp</th>
                    <th style={{ padding: '0.8rem 0.95rem' }}>Promoter</th>
                    <th style={{ padding: '0.8rem 0.95rem' }}>Action Type</th>
                    <th style={{ padding: '0.8rem 1.25rem' }}>Details &amp; Reason</th>
                    <th style={{ padding: '0.8rem 1.15rem', textAlign: 'right' }}>Operator</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #1f1f23' }}>
                      <td style={{ padding: '0.85rem 1.15rem', color: '#cbd5e1' }}>
                        <div style={{ fontWeight: 600, color: '#fafafa' }}>{new Date(log.timestamp).toLocaleDateString()}</div>
                        <div style={{ fontSize: '0.68rem', color: '#71717a' }}>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td style={{ padding: '0.85rem 0.95rem' }}>
                        <div style={{ fontWeight: 600, color: '#fafafa' }}>{log.agentName}</div>
                        <div style={{ fontSize: '0.7rem', color: '#fbbf24' }}>{log.agentCode || log.agentPhone}</div>
                      </td>
                      <td style={{ padding: '0.85rem 0.95rem' }}>
                        <span style={{ background: '#09090b', border: '1px solid #27272a', color: '#38bdf8', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', color: '#cbd5e1', fontSize: '0.8rem' }}>
                        {log.details}
                      </td>
                      <td style={{ padding: '0.85rem 1.15rem', textAlign: 'right', color: '#a1a1aa', fontWeight: 500, fontSize: '0.75rem' }}>
                        {log.adminName || 'Super Admin'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#71717a' }}>
              <p style={{ margin: 0, fontSize: '0.82rem' }}>No audit records recorded yet.</p>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: REFERRER DOSSIER & 360° RECORDS ───────────────────── */}
      {dossierModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: '16px', width: '100%', maxWidth: '860px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', overflow: 'hidden', position: 'relative' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #222226', background: '#121215', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem' }}>
                  {dossierModal.data?.agent?.fullName?.charAt(0)?.toUpperCase() || 'P'}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{dossierModal.data?.agent?.fullName || 'Loading...'}</span>
                    <span style={{ fontSize: '0.72rem', background: '#1c1c20', color: '#f59e0b', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700, border: '1px solid #27272a' }}>
                      {dossierModal.data?.agent?.referralCode}
                    </span>
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#71717a' }}>
                    <i className="fa-solid fa-phone" style={{ fontSize: '0.68rem', marginRight: '3px' }}></i> {dossierModal.data?.agent?.phone} • Rate: {dossierModal.data?.agent?.commissionRate ?? 50}% • Status: {dossierModal.data?.agent?.status || 'ACTIVE'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleOpenCredsModal(dossierModal.data?.agent)}
                  title="Send Credentials via WhatsApp"
                  style={{ background: 'rgba(37, 211, 102, 0.1)', border: '1px solid rgba(37, 211, 102, 0.25)', color: '#25D366', padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <i className="fa-brands fa-whatsapp"></i>
                  <span>WhatsApp Info</span>
                </button>
                <button
                  onClick={() => setDossierModal(prev => ({ ...prev, isOpen: false, data: null }))}
                  style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>

            {/* Dossier Tabs Header */}
            <div style={{ display: 'flex', gap: '4px', padding: '0.5rem 1.25rem', background: '#09090b', borderBottom: '1px solid #222226', overflowX: 'auto' }}>
              {[
                { id: 'overview', label: 'Overview & Bio', icon: 'fa-id-card' },
                { id: 'schools', label: `Schools (${dossierModal.data?.schools?.length || 0})`, icon: 'fa-school' },
                { id: 'commissions', label: `Commissions (${dossierModal.data?.commissions?.length || 0})`, icon: 'fa-receipt' },
                { id: 'payouts', label: `Payouts (${dossierModal.data?.payoutRequests?.length || 0})`, icon: 'fa-money-bill-transfer' },
                { id: 'leads', label: `Leads (${dossierModal.data?.leads?.length || 0})`, icon: 'fa-bullseye' },
                { id: 'notes', label: `Admin Notes (${dossierModal.data?.adminNotes?.length || 0})`, icon: 'fa-comment-dots' },
                { id: 'audit', label: `History (${dossierModal.data?.auditLogs?.length || 0})`, icon: 'fa-clock-rotate-left' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setDossierModal(prev => ({ ...prev, activeTab: t.id }))}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: dossierModal.activeTab === t.id ? '#27272a' : 'transparent',
                    color: dossierModal.activeTab === t.id ? '#fafafa' : '#a1a1aa',
                    fontWeight: 600,
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <i className={`fa-solid ${t.icon}`}></i>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Dossier Body Content */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {dossierModal.loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#a1a1aa' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.8rem', color: '#f59e0b', marginBottom: '0.5rem', display: 'block' }}></i>
                  Loading complete records...
                </div>
              ) : !dossierModal.data ? (
                <div style={{ color: '#ef4444' }}>Records not found.</div>
              ) : (
                <>
                  {/* TAB: OVERVIEW & BIO */}
                  {dossierModal.activeTab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Metric Cards Row */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                        <div style={{ background: '#121215', padding: '1rem', borderRadius: '14px', border: '1px solid #27272a' }}>
                          <span style={{ fontSize: '0.72rem', color: '#a1a1aa', fontWeight: 700 }}>Total 50% Earned</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#34d399', marginTop: '0.2rem' }}>
                            GH₵ {Number(dossierModal.data.agent.totalEarned || 0).toFixed(2)}
                          </div>
                        </div>
                        <div style={{ background: '#121215', padding: '1rem', borderRadius: '14px', border: '1px solid #27272a' }}>
                          <span style={{ fontSize: '0.72rem', color: '#a1a1aa', fontWeight: 700 }}>Available Balance</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24', marginTop: '0.2rem' }}>
                            GH₵ {Number(dossierModal.data.agent.pendingPayout || 0).toFixed(2)}
                          </div>
                        </div>
                        <div style={{ background: '#121215', padding: '1rem', borderRadius: '14px', border: '1px solid #27272a' }}>
                          <span style={{ fontSize: '0.72rem', color: '#a1a1aa', fontWeight: 700 }}>Total Paid Out</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#a78bfa', marginTop: '0.2rem' }}>
                            GH₵ {Number(dossierModal.data.agent.totalPaid || 0).toFixed(2)}
                          </div>
                        </div>
                        <div style={{ background: '#121215', padding: '1rem', borderRadius: '14px', border: '1px solid #27272a' }}>
                          <span style={{ fontSize: '0.72rem', color: '#a1a1aa', fontWeight: 700 }}>Schools Linked</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.2rem' }}>
                            {dossierModal.data.schools.length}
                          </div>
                        </div>
                      </div>

                      {/* Bio Information Box */}
                      <div style={{ background: '#121215', padding: '1.25rem', borderRadius: '16px', border: '1px solid #27272a' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>
                          Profile &amp; Credentials Record
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.82rem' }}>
                          <div><span style={{ color: '#71717a' }}>Full Legal Name:</span> <strong style={{ color: '#f8fafc' }}>{dossierModal.data.agent.fullName}</strong></div>
                          <div><span style={{ color: '#71717a' }}>Referral Code:</span> <code style={{ color: '#fbbf24' }}>{dossierModal.data.agent.referralCode}</code></div>
                          <div><span style={{ color: '#71717a' }}>Mobile Phone:</span> <strong style={{ color: '#f8fafc' }}>{dossierModal.data.agent.phone}</strong></div>
                          <div><span style={{ color: '#71717a' }}>Email Address:</span> <strong style={{ color: '#f8fafc' }}>{dossierModal.data.agent.email || 'None'}</strong></div>
                          <div><span style={{ color: '#71717a' }}>Assigned Region:</span> <strong style={{ color: '#f8fafc' }}>{dossierModal.data.agent.region || 'Nationwide'}</strong></div>
                          <div><span style={{ color: '#71717a' }}>Commission Rate:</span> <strong style={{ color: '#34d399' }}>{dossierModal.data.agent.commissionRate ?? 50}%</strong></div>
                          <div><span style={{ color: '#71717a' }}>MoMo Payout Network:</span> <strong style={{ color: '#f8fafc' }}>{dossierModal.data.agent.payoutNetwork || 'MTN MoMo'}</strong></div>
                          <div><span style={{ color: '#71717a' }}>MoMo Account Name:</span> <strong style={{ color: '#f8fafc' }}>{dossierModal.data.agent.payoutAccountName || dossierModal.data.agent.fullName}</strong></div>
                          <div><span style={{ color: '#71717a' }}>Account Password:</span> <code style={{ color: '#34d399' }}>{dossierModal.data.agent.password?.startsWith('pbkdf2$') ? '●●●●●●●● [PBKDF2 Secured]' : (dossierModal.data.agent.password || dossierModal.data.agent.phone)}</code></div>
                          <div><span style={{ color: '#71717a' }}>Date Registered:</span> <strong style={{ color: '#f8fafc' }}>{new Date(dossierModal.data.agent.createdAt).toLocaleDateString()}</strong></div>
                        </div>
                      </div>

                      {/* Quick Action Buttons */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleOpenAdjustment(dossierModal.data.agent, 'BONUS')}
                          style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: '#10b981', border: 'none', color: '#09090b', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
                        >
                          <i className="fa-solid fa-plus-circle" style={{ marginRight: '4px' }}></i> Credit Bonus
                        </button>
                        <button
                          onClick={() => handleOpenAdjustment(dossierModal.data.agent, 'DEDUCTION')}
                          style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
                        >
                          <i className="fa-solid fa-minus-circle" style={{ marginRight: '4px' }}></i> Apply Deduction
                        </button>
                        <button
                          onClick={() => handleOpenEdit(dossierModal.data.agent)}
                          style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: '#18181b', border: '1px solid #27272a', color: '#fafafa', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
                        >
                          <i className="fa-solid fa-pen" style={{ marginRight: '4px' }}></i> Edit Profile
                        </button>
                        <button
                          onClick={() => handleOpenDelete(dossierModal.data.agent)}
                          style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
                        >
                          <i className="fa-solid fa-trash-can" style={{ marginRight: '4px' }}></i> Delete Referrer
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB: REFERRED SCHOOLS */}
                  {dossierModal.activeTab === 'schools' && (
                    <div>
                      {dossierModal.data.schools.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: '#121215', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>
                              <th style={{ padding: '0.75rem 1rem' }}>School Name</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Location</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Referred At</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Term 1 Status</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Commission</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dossierModal.data.schools.map(s => (
                              <tr key={s.id} style={{ borderBottom: '1px solid #27272a' }}>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#f8fafc' }}>{s.name}</td>
                                <td style={{ padding: '0.75rem 1rem', color: '#a1a1aa' }}>{s.location}</td>
                                <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>{s.referredAt ? new Date(s.referredAt).toLocaleDateString() : 'N/A'}</td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  {s.isTerm1Rewarded ? (
                                    <span style={{ color: '#34d399', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                      <i className="fa-solid fa-circle-check" /> Term 1 Rewarded
                                    </span>
                                  ) : (
                                    <span style={{ color: '#fbbf24', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                      <i className="fa-solid fa-clock" /> Free Term / Pending Sub
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: s.commissionAmount > 0 ? '#34d399' : '#71717a' }}>
                                  GH₵ {Number(s.commissionAmount || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ padding: '2.5rem', textAlign: 'center', color: '#a1a1aa' }}>
                          No schools linked to this referrer yet.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: COMMISSIONS */}
                  {dossierModal.activeTab === 'commissions' && (
                    <div>
                      {dossierModal.data.commissions.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: '#121215', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>
                              <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Description / School</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Term</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Amount</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dossierModal.data.commissions.map(c => (
                              <tr key={c.id} style={{ borderBottom: '1px solid #27272a' }}>
                                <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#f8fafc' }}>
                                  {c.schoolName}
                                  {c.notes && <div style={{ fontSize: '0.7rem', color: '#71717a' }}>{c.notes}</div>}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#a1a1aa' }}>{c.term}</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: Number(c.commissionAmount) >= 0 ? '#34d399' : '#f87171' }}>
                                  {Number(c.commissionAmount) >= 0 ? '+' : ''}GH₵ {Number(c.commissionAmount || 0).toFixed(2)}
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <span style={{ fontSize: '0.72rem', color: c.status === 'PAID' ? '#34d399' : '#60a5fa', fontWeight: 800 }}>
                                    {c.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ padding: '2.5rem', textAlign: 'center', color: '#a1a1aa' }}>
                          No commissions recorded yet.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: PAYOUTS */}
                  {dossierModal.activeTab === 'payouts' && (
                    <div>
                      {dossierModal.data.payoutRequests.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: '#121215', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>
                              <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Destination MoMo</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Amount</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Receipt / Ref</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dossierModal.data.payoutRequests.map(r => (
                              <tr key={r.id} style={{ borderBottom: '1px solid #27272a' }}>
                                <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>{new Date(r.requestedAt).toLocaleDateString()}</td>
                                <td style={{ padding: '0.75rem 1rem', color: '#f8fafc', fontWeight: 700 }}>
                                  {r.payoutContact} ({r.payoutNetwork})
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#34d399' }}>
                                  GH₵ {Number(r.amount).toFixed(2)}
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <code style={{ color: '#fbbf24' }}>{r.disbursalReference || 'Pending'}</code>
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <span style={{ fontSize: '0.72rem', color: r.status === 'DISBURSED' ? '#34d399' : r.status === 'REJECTED' ? '#f87171' : '#fbbf24', fontWeight: 800 }}>
                                    {r.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ padding: '2.5rem', textAlign: 'center', color: '#a1a1aa' }}>
                          No payout requests on record.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: LEADS */}
                  {dossierModal.activeTab === 'leads' && (
                    <div>
                      {dossierModal.data.leads.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: '#121215', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>
                              <th style={{ padding: '0.75rem 1rem' }}>School Name</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Contact</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Lock Window</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dossierModal.data.leads.map(l => (
                              <tr key={l.id} style={{ borderBottom: '1px solid #27272a' }}>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#f8fafc' }}>{l.schoolName}</td>
                                <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>{l.contactPerson} ({l.phone})</td>
                                <td style={{ padding: '0.75rem 1rem', color: '#38bdf8' }}>
                                  {l.status === 'CONVERTED' ? 'Converted' : l.isExpired ? 'Expired' : `${l.daysRemaining} days left`}
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <span style={{ fontSize: '0.72rem', color: l.status === 'CONVERTED' ? '#34d399' : '#fbbf24', fontWeight: 800 }}>
                                    {l.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ padding: '2.5rem', textAlign: 'center', color: '#a1a1aa' }}>
                          No inbound leads attributed to this referrer.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: ADMIN NOTES & CRM */}
                  {dossierModal.activeTab === 'notes' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Add Note Form */}
                      <form onSubmit={handleAddAdminNote} style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Type internal note (e.g. Promised bonus if 5 schools join this week)..."
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          style={{ flex: 1, padding: '0.65rem 1rem', borderRadius: '10px', background: '#121215', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.85rem', outline: 'none' }}
                        />
                        <button
                          type="submit"
                          disabled={addingNote || !newNoteText.trim()}
                          style={{ padding: '0.65rem 1.15rem', borderRadius: '10px', background: '#f59e0b', border: 'none', color: '#09090b', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}
                        >
                          {addingNote ? 'Saving...' : 'Add Note'}
                        </button>
                      </form>

                      {/* Notes List */}
                      {dossierModal.data.adminNotes && dossierModal.data.adminNotes.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {dossierModal.data.adminNotes.map(n => (
                            <div key={n.id} style={{ background: '#121215', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #27272a' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.72rem', color: '#71717a' }}>
                                <span>Author: <strong style={{ color: '#cbd5e1' }}>{n.author || 'Super Admin'}</strong></span>
                                <span>{new Date(n.createdAt).toLocaleString()}</span>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.85rem', color: '#f8fafc' }}>{n.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#a1a1aa' }}>
                          No administrative notes recorded yet.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: HISTORY / AUDIT LOG */}
                  {dossierModal.activeTab === 'audit' && (
                    <div>
                      {dossierModal.data.auditLogs && dossierModal.data.auditLogs.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {dossierModal.data.auditLogs.map(a => (
                            <div key={a.id} style={{ background: '#121215', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ background: '#27272a', color: '#38bdf8', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                                  {a.action}
                                </span>
                                <div style={{ fontSize: '0.82rem', color: '#f8fafc', marginTop: '0.3rem' }}>{a.details}</div>
                              </div>
                              <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#71717a' }}>
                                <div>{new Date(a.timestamp).toLocaleDateString()}</div>
                                <div>By: {a.adminName || 'Admin'}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding: '2.5rem', textAlign: 'center', color: '#a1a1aa' }}>
                          No audit entries logged for this referrer yet.
                        </div>
                      )}
                    </div>
                  )}

                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── MODAL: EDIT REFERRER PROFILE ─────────────────────────────── */}
      {editModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: '1rem' }}>
          <div style={{ background: '#141417', border: '1px solid #27272a', borderRadius: '14px', width: '100%', maxWidth: '500px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', position: 'relative' }}>
            
            <button
              onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <i className="fa-solid fa-xmark" style={{ fontSize: '0.8rem' }}></i>
            </button>

            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif' }}>
              Edit Referrer Record
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.78rem', color: '#71717a' }}>
              Update contact info, commission rate, region, or MoMo payout details.
            </p>

            {editModal.error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.7rem 0.9rem', borderRadius: '8px', marginBottom: '1.1rem', fontSize: '0.8rem' }}>
                {editModal.error}
              </div>
            )}

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>Full Legal Name *</label>
                  <input
                    type="text"
                    value={editModal.fullName}
                    onChange={(e) => setEditModal(prev => ({ ...prev, fullName: e.target.value }))}
                    required
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>Mobile Phone *</label>
                  <input
                    type="tel"
                    value={editModal.phone}
                    onChange={(e) => setEditModal(prev => ({ ...prev, phone: e.target.value }))}
                    required
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>Email Address</label>
                  <input
                    type="email"
                    value={editModal.email}
                    onChange={(e) => setEditModal(prev => ({ ...prev, email: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>Commission Rate (%)</label>
                  <input
                    type="number"
                    value={editModal.commissionRate}
                    onChange={(e) => setEditModal(prev => ({ ...prev, commissionRate: Number(e.target.value) }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>Status</label>
                  <select
                    value={editModal.status}
                    onChange={(e) => setEditModal(prev => ({ ...prev, status: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>Assigned Region</label>
                  <input
                    type="text"
                    placeholder="e.g. Greater Accra, Ashanti"
                    value={editModal.region}
                    onChange={(e) => setEditModal(prev => ({ ...prev, region: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #222226', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.45rem' }}>
                  Default MoMo Payout Destination
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: '#71717a', marginBottom: '0.2rem' }}>Network</label>
                    <select
                      value={editModal.payoutNetwork}
                      onChange={(e) => setEditModal(prev => ({ ...prev, payoutNetwork: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.75rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.8rem', outline: 'none' }}
                    >
                      <option value="MTN Mobile Money">MTN Mobile Money</option>
                      <option value="Vodafone / Telecel Cash">Telecel Cash</option>
                      <option value="AT Money">AT Money</option>
                      <option value="Bank Account">Bank Account</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: '#71717a', marginBottom: '0.2rem' }}>MoMo Number / Contact</label>
                    <input
                      type="tel"
                      value={editModal.payoutContact}
                      onChange={(e) => setEditModal(prev => ({ ...prev, payoutContact: e.target.value }))}
                      placeholder="e.g. 0244123456"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.75rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.8rem', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>
                  Account Password (Leave blank to keep current)
                </label>
                <input
                  type="text"
                  placeholder="Set custom password"
                  value={editModal.password}
                  onChange={(e) => setEditModal(prev => ({ ...prev, password: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                  style={{ padding: '0.55rem 1rem', borderRadius: '7px', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editModal.saving}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '7px',
                    background: '#f59e0b',
                    border: 'none',
                    color: '#09090b',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: editModal.saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {editModal.saving ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── MODAL: MANUAL BALANCE ADJUSTMENT (+/-) ───────────────────── */}
      {adjustmentModal.isOpen && adjustmentModal.agent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: '1rem' }}>
          <div style={{ background: '#141417', border: '1px solid #27272a', borderRadius: '14px', width: '100%', maxWidth: '460px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', position: 'relative' }}>
            
            <button
              onClick={() => setAdjustmentModal(prev => ({ ...prev, isOpen: false }))}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <i className="fa-solid fa-xmark" style={{ fontSize: '0.8rem' }}></i>
            </button>

            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif' }}>
              Manual Balance Adjustment
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.78rem', color: '#71717a' }}>
              Apply administrative bonus credit or clawback deduction for <strong style={{ color: '#fbbf24' }}>{adjustmentModal.agent.fullName}</strong>.
            </p>

            {adjustmentModal.error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.7rem 0.9rem', borderRadius: '8px', marginBottom: '1.1rem', fontSize: '0.8rem' }}>
                {adjustmentModal.error}
              </div>
            )}

            <form onSubmit={handleExecuteAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.35rem' }}>
                  Adjustment Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setAdjustmentModal(prev => ({ ...prev, type: 'BONUS' }))}
                    style={{
                      padding: '0.6rem 0.85rem',
                      borderRadius: '8px',
                      border: adjustmentModal.type === 'BONUS' ? '1px solid #10b981' : '1px solid #27272a',
                      background: adjustmentModal.type === 'BONUS' ? 'rgba(16, 185, 129, 0.15)' : '#121215',
                      color: adjustmentModal.type === 'BONUS' ? '#34d399' : '#a1a1aa',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-circle-plus" />
                    <span>Credit Bonus (+GH₵)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentModal(prev => ({ ...prev, type: 'DEDUCTION' }))}
                    style={{
                      padding: '0.6rem 0.85rem',
                      borderRadius: '8px',
                      border: adjustmentModal.type === 'DEDUCTION' ? '1px solid #ef4444' : '1px solid #27272a',
                      background: adjustmentModal.type === 'DEDUCTION' ? 'rgba(239, 68, 68, 0.15)' : '#121215',
                      color: adjustmentModal.type === 'DEDUCTION' ? '#f87171' : '#a1a1aa',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-circle-minus" />
                    <span>Clawback (-GH₵)</span>
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.35rem' }}>
                  Amount (GH₵) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 50.00"
                  value={adjustmentModal.amount}
                  onChange={(e) => setAdjustmentModal(prev => ({ ...prev, amount: e.target.value }))}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.95rem', fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.35rem' }}>
                  Audit Reason / Notes *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Top promoter bonus or adjustment note..."
                  value={adjustmentModal.reason}
                  onChange={(e) => setAdjustmentModal(prev => ({ ...prev, reason: e.target.value }))}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setAdjustmentModal(prev => ({ ...prev, isOpen: false }))}
                  style={{ padding: '0.55rem 1rem', borderRadius: '7px', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustmentModal.saving}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '7px',
                    background: adjustmentModal.type === 'BONUS' ? '#10b981' : '#ef4444',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: adjustmentModal.saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {adjustmentModal.saving ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <i className={adjustmentModal.type === 'BONUS' ? 'fa-solid fa-circle-plus' : 'fa-solid fa-circle-minus'} />
                      <span>Confirm {adjustmentModal.type === 'BONUS' ? 'Bonus' : 'Deduction'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── MODAL: LOG INBOUND LEAD MANUALLY ─────────────────────────── */}
      {leadModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: '1rem' }}>
          <div style={{ background: '#141417', border: '1px solid #27272a', borderRadius: '14px', width: '100%', maxWidth: '480px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', position: 'relative' }}>
            
            <button
              onClick={() => setLeadModal(prev => ({ ...prev, isOpen: false }))}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <i className="fa-solid fa-xmark" style={{ fontSize: '0.8rem' }}></i>
            </button>

            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif' }}>
              Log Inbound School Lead
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.78rem', color: '#71717a' }}>
              Record a demo inquiry or prospective school and attribute it to a referrer for the 60-day lock window.
            </p>

            {leadModal.error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.7rem 0.9rem', borderRadius: '8px', marginBottom: '1.1rem', fontSize: '0.8rem' }}>
                {leadModal.error}
              </div>
            )}

            <form onSubmit={handleSaveLead} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>Attributed Referrer *</label>
                <select
                  value={leadModal.agentId}
                  onChange={(e) => setLeadModal(prev => ({ ...prev, agentId: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.fullName} ({a.referralCode})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>School Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Grace International Academy"
                  value={leadModal.schoolName}
                  onChange={(e) => setLeadModal(prev => ({ ...prev, schoolName: e.target.value }))}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>Contact Person *</label>
                  <input
                    type="text"
                    placeholder="e.g. Mrs. Mensah"
                    value={leadModal.contactPerson}
                    onChange={(e) => setLeadModal(prev => ({ ...prev, contactPerson: e.target.value }))}
                    required
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>Phone Number *</label>
                  <input
                    type="tel"
                    placeholder="0244..."
                    value={leadModal.phone}
                    onChange={(e) => setLeadModal(prev => ({ ...prev, phone: e.target.value }))}
                    required
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>Region</label>
                  <input
                    type="text"
                    placeholder="e.g. Ashanti"
                    value={leadModal.region}
                    onChange={(e) => setLeadModal(prev => ({ ...prev, region: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>Est. Learners</label>
                  <input
                    type="number"
                    placeholder="e.g. 250"
                    value={leadModal.estimatedLearners}
                    onChange={(e) => setLeadModal(prev => ({ ...prev, estimatedLearners: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>Notes</label>
                <input
                  type="text"
                  placeholder="Special requests or callback time..."
                  value={leadModal.notes}
                  onChange={(e) => setLeadModal(prev => ({ ...prev, notes: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setLeadModal(prev => ({ ...prev, isOpen: false }))}
                  style={{ padding: '0.55rem 1rem', borderRadius: '7px', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={leadModal.saving}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '7px',
                    background: '#0284c7',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: leadModal.saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {leadModal.saving ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-bullseye" />
                      <span>Record Lead (60-Day Lock)</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── MODAL: WHATSAPP CREDENTIALS READY ────────────────────────── */}
      {credsModal.isOpen && credsModal.agent && credsModal.alert && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '1rem' }}>
          <div style={{ background: '#141417', border: '1px solid #27272a', borderRadius: '14px', width: '100%', maxWidth: '480px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', position: 'relative' }}>
            
            <button
              onClick={() => setCredsModal({ isOpen: false, agent: null, alert: null })}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <i className="fa-solid fa-xmark" style={{ fontSize: '0.8rem' }}></i>
            </button>

            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(37, 211, 102, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              <i className="fa-brands fa-whatsapp" style={{ color: '#25D366', fontSize: '1.5rem' }}></i>
            </div>

            <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.15rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif', textAlign: 'center' }}>
              WhatsApp Message Ready
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', color: '#71717a', textAlign: 'center' }}>
              Send login link, password, and referral links directly to <strong style={{ color: '#fafafa' }}>{credsModal.agent.fullName}</strong>.
            </p>

            <div style={{ background: '#121215', border: '1px solid #222226', borderRadius: '10px', padding: '0.85rem', marginBottom: '1.25rem', whiteSpace: 'pre-wrap', fontSize: '0.78rem', color: '#d4d4d8', maxHeight: '160px', overflowY: 'auto', fontFamily: 'monospace' }}>
              {credsModal.alert.text}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a
                href={credsModal.alert.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setCredsModal({ isOpen: false, agent: null, alert: null })}
                style={{
                  padding: '0.65rem 1.15rem',
                  borderRadius: '8px',
                  background: '#25D366',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-brands fa-whatsapp" style={{ fontSize: '1rem' }}></i>
                <span>Open WhatsApp &amp; Send to Referrer</span>
              </a>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(credsModal.alert.text);
                  showNotification('success', 'Message text copied to clipboard!');
                  setCredsModal({ isOpen: false, agent: null, alert: null });
                }}
                style={{
                  padding: '0.6rem',
                  borderRadius: '8px',
                  background: '#1c1c20',
                  border: '1px solid #27272a',
                  color: '#a1a1aa',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                Copy Text Instead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRM MOMO DISBURSAL ────────────────────────────── */}
      {disburseModal.isOpen && disburseModal.request && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#141417', border: '1px solid #27272a', borderRadius: '14px', width: '100%', maxWidth: '480px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', position: 'relative' }}>
            
            <button
              onClick={() => setDisburseModal({ isOpen: false, request: null, reference: '', notes: '', loading: false, error: '' })}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <i className="fa-solid fa-xmark" style={{ fontSize: '0.8rem' }}></i>
            </button>

            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif' }}>
              Confirm MoMo Disbursal
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.78rem', color: '#71717a' }}>
              Send funds via your business MoMo/Bank and input the transaction reference below.
            </p>

            {disburseModal.error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.7rem 0.9rem', borderRadius: '8px', marginBottom: '1.1rem', fontSize: '0.8rem' }}>
                {disburseModal.error}
              </div>
            )}

            {/* Payout Details Card */}
            <div style={{ background: '#121215', border: '1px solid #222226', borderRadius: '10px', padding: '0.9rem', marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.74rem', color: '#71717a' }}>Recipient Referrer:</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fafafa' }}>{disburseModal.request.agentName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.74rem', color: '#71717a' }}>Destination MoMo Contact:</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fbbf24' }}>{disburseModal.request.payoutContact}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.74rem', color: '#71717a' }}>Network / Account Name:</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8' }}>{disburseModal.request.payoutNetwork} ({disburseModal.request.payoutAccountName})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #222226', paddingTop: '0.45rem', marginTop: '0.45rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#d4d4d8' }}>Amount to Transfer:</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#34d399' }}>GH₵ {Number(disburseModal.request.amount).toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmDisbursal} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.35rem' }}>
                  MoMo Transaction ID / Reference *
                </label>
                <input
                  type="text"
                  placeholder="e.g. MM-2026-998812"
                  value={disburseModal.reference}
                  onChange={(e) => setDisburseModal(prev => ({ ...prev, reference: e.target.value.toUpperCase() }))}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.9rem', fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.35rem' }}>
                  Admin Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via MTN MoMo Merchant"
                  value={disburseModal.notes}
                  onChange={(e) => setDisburseModal(prev => ({ ...prev, notes: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setDisburseModal({ isOpen: false, request: null, reference: '', notes: '', loading: false, error: '' })}
                  style={{ padding: '0.55rem 1rem', borderRadius: '7px', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disburseModal.loading}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '7px',
                    background: '#10b981',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: disburseModal.loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {disburseModal.loading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check" />
                      <span>Mark Disbursed &amp; Completed</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── MODAL: WHATSAPP RECEIPT DELIVERED ────────────────────────── */}
      {receiptModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: '1rem' }}>
          <div style={{ background: '#141417', border: '1px solid #27272a', borderRadius: '14px', width: '100%', maxWidth: '440px', padding: '1.75rem', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', position: 'relative' }}>
            
            <button
              onClick={() => setReceiptModal({ isOpen: false, alert: null, payoutContact: '', amount: 0, reference: '' })}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <i className="fa-solid fa-xmark" style={{ fontSize: '0.8rem' }}></i>
            </button>

            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              <i className="fa-solid fa-check" style={{ color: '#34d399', fontSize: '1.4rem' }}></i>
            </div>

            <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.15rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif' }}>
              Payout Recorded Successfully!
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', color: '#71717a', lineHeight: 1.5 }}>
              GH₵ {Number(receiptModal.amount).toFixed(2)} recorded as paid to <strong style={{ color: '#fbbf24' }}>{receiptModal.payoutContact}</strong> (Ref: {receiptModal.reference}).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a
                href={receiptModal.alert?.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setReceiptModal({ isOpen: false, alert: null, payoutContact: '', amount: 0, reference: '' })}
                style={{
                  padding: '0.65rem 1.15rem',
                  borderRadius: '8px',
                  background: '#25D366',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-brands fa-whatsapp" style={{ fontSize: '1rem' }}></i>
                <span>Send WhatsApp Receipt to Referrer</span>
              </a>

              <button
                onClick={() => setReceiptModal({ isOpen: false, alert: null, payoutContact: '', amount: 0, reference: '' })}
                style={{
                  padding: '0.6rem',
                  borderRadius: '8px',
                  background: '#1c1c20',
                  border: '1px solid #27272a',
                  color: '#a1a1aa',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                Close (Receipt Saved)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REGISTER NEW REFERRER ────────────────────────────── */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#141417', border: '1px solid #27272a', borderRadius: '14px', width: '100%', maxWidth: '500px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', position: 'relative' }}>
            
            <button
              onClick={() => setShowAddModal(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <i className="fa-solid fa-xmark" style={{ fontSize: '0.8rem' }}></i>
            </button>

            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif' }}>
              Register Referral Partner
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.78rem', color: '#71717a' }}>
              Onboard a new field promoter, affiliate agent, or education representative.
            </p>

            {addError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.7rem 0.9rem', borderRadius: '8px', marginBottom: '1.1rem', fontSize: '0.8rem' }}>
                {addError}
              </div>
            )}

            <form onSubmit={handleCreateAgent} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kwame Asante"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 0244123456"
                    value={newAgentPhone}
                    onChange={(e) => setNewAgentPhone(e.target.value)}
                    required
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="kwame@example.com"
                    value={newAgentEmail}
                    onChange={(e) => setNewAgentEmail(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>
                    Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    value={newAgentRate}
                    onChange={(e) => setNewAgentRate(Number(e.target.value))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>
                    Region / Territory
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Greater Accra"
                    value={newAgentRegion}
                    onChange={(e) => setNewAgentRegion(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>
                    Custom Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto (e.g. REF-AGT-KWAME)"
                    value={newAgentCode}
                    onChange={(e) => setNewAgentCode(e.target.value.toUpperCase())}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.3rem' }}>
                    Password (Optional)
                  </label>
                  <input
                    type="password"
                    placeholder="Defaults to phone"
                    value={newAgentPassword}
                    onChange={(e) => setNewAgentPassword(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '0.55rem 1rem', borderRadius: '7px', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAgent}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '7px',
                    background: '#f59e0b',
                    border: 'none',
                    color: '#09090b',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: savingAgent ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {savingAgent ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-user-plus" />
                      <span>Confirm Registration</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── MODAL: STYLED DELETE REFERRER PERMANENTLY ──────────────── */}
      {deleteModal.isOpen && deleteModal.agent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '1rem' }}>
          <div style={{ background: '#141417', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '14px', width: '100%', maxWidth: '480px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.85)', position: 'relative' }}>
            
            <button
              onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false, agent: null, error: '' }))}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <i className="fa-solid fa-xmark" style={{ fontSize: '0.8rem' }}></i>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-trash-can" style={{ color: '#ef4444', fontSize: '1.1rem' }}></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif' }}>
                  Delete Referrer Permanently
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#f87171', fontWeight: 600 }}>
                  Irreversible Removal &amp; Data Cleanup
                </span>
              </div>
            </div>

            {deleteModal.error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.7rem 0.9rem', borderRadius: '8px', marginBottom: '1.1rem', fontSize: '0.8rem' }}>
                {deleteModal.error}
              </div>
            )}

            {/* Referrer Snapshot */}
            <div style={{ background: '#121215', border: '1px solid #222226', borderRadius: '10px', padding: '0.9rem', marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.74rem', color: '#71717a' }}>Referrer Name:</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fafafa' }}>{deleteModal.agent.fullName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.74rem', color: '#71717a' }}>Referral Code:</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24', background: '#27272a', padding: '0.1rem 0.45rem', borderRadius: '5px' }}>
                  {deleteModal.agent.referralCode}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.74rem', color: '#71717a' }}>Contact Phone:</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#d4d4d8' }}>{deleteModal.agent.phone}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #222226', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                <span style={{ fontSize: '0.74rem', color: '#71717a' }}>Unwithdrawn Balance:</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#34d399' }}>
                  GH₵ {Number(deleteModal.agent.unpaidBalance || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Warning Box */}
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '0.8rem', marginBottom: '1.1rem', fontSize: '0.75rem', color: '#fca5a5', lineHeight: 1.45 }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#ef4444', marginBottom: '0.2rem' }}>
                <i className="fa-solid fa-triangle-exclamation" /> Permanent Action
              </strong>
              This will completely delete this referrer account from Dexie and Supabase Cloud. Configure cleanup options below:
            </div>

            {/* Options Checkboxes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1.1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#d4d4d8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={deleteModal.unlinkSchools}
                  onChange={(e) => setDeleteModal(prev => ({ ...prev, unlinkSchools: e.target.checked }))}
                  style={{ accentColor: '#ef4444', width: '15px', height: '15px' }}
                />
                <span><strong>Unlink referred schools</strong> (frees schools from referee lock)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#d4d4d8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={deleteModal.purgeCommissions}
                  onChange={(e) => setDeleteModal(prev => ({ ...prev, purgeCommissions: e.target.checked }))}
                  style={{ accentColor: '#ef4444', width: '15px', height: '15px' }}
                />
                <span><strong>Purge commissions ledger</strong> &amp; reward transaction history</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#d4d4d8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={deleteModal.purgeRequests}
                  onChange={(e) => setDeleteModal(prev => ({ ...prev, purgeRequests: e.target.checked }))}
                  style={{ accentColor: '#ef4444', width: '15px', height: '15px' }}
                />
                <span><strong>Purge payout requests</strong> submitted by this agent</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#d4d4d8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={deleteModal.purgeLeads}
                  onChange={(e) => setDeleteModal(prev => ({ ...prev, purgeLeads: e.target.checked }))}
                  style={{ accentColor: '#ef4444', width: '15px', height: '15px' }}
                />
                <span><strong>Purge captured inbound leads</strong> associated with this referrer</span>
              </label>
            </div>

            {/* Confirmation input */}
            <form onSubmit={handleConfirmDelete}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#fafafa', marginBottom: '0.35rem' }}>
                  To confirm deletion, type <code style={{ color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>DELETE</code> below:
                </label>
                <input
                  type="text"
                  placeholder="Type DELETE"
                  value={deleteModal.confirmInput}
                  onChange={(e) => setDeleteModal(prev => ({ ...prev, confirmInput: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#121215', border: '1px solid #3f3f46', color: '#fafafa', fontSize: '0.9rem', fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: false, agent: null, error: '' }))}
                  style={{ padding: '0.55rem 1rem', borderRadius: '7px', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteModal.loading || deleteModal.confirmInput.trim().toUpperCase() !== 'DELETE'}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '7px',
                    background: deleteModal.confirmInput.trim().toUpperCase() === 'DELETE' ? '#ef4444' : '#27272a',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: (deleteModal.loading || deleteModal.confirmInput.trim().toUpperCase() !== 'DELETE') ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {deleteModal.loading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-trash-can"></i>
                      <span>Permanently Delete Referrer</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── MODAL: STYLED REJECT PAYOUT REQUEST ──────────────────────── */}
      {rejectPayoutModal.isOpen && rejectPayoutModal.request && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '1rem' }}>
          <div style={{ background: '#141417', border: '1px solid rgba(244, 63, 94, 0.35)', borderRadius: '14px', width: '100%', maxWidth: '460px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.85)', position: 'relative' }}>
            
            <button
              onClick={() => setRejectPayoutModal({ isOpen: false, request: null, reason: 'Information mismatch', customReason: '', loading: false, error: '' })}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <i className="fa-solid fa-xmark" style={{ fontSize: '0.8rem' }}></i>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-circle-xmark" style={{ color: '#f43f5e', fontSize: '1.1rem' }}></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif' }}>
                  Reject Payout Request
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#f43f5e', fontWeight: 600 }}>
                  Funds Will Be Refunded to Wallet
                </span>
              </div>
            </div>

            {rejectPayoutModal.error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.7rem 0.9rem', borderRadius: '8px', marginBottom: '1.1rem', fontSize: '0.8rem' }}>
                {rejectPayoutModal.error}
              </div>
            )}

            {/* Request Summary Card */}
            <div style={{ background: '#121215', border: '1px solid #222226', borderRadius: '10px', padding: '0.85rem', marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.74rem', color: '#71717a' }}>Referrer Name:</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fafafa' }}>{rejectPayoutModal.request.agentName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.74rem', color: '#71717a' }}>Destination Contact:</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fbbf24' }}>
                  {rejectPayoutModal.request.payoutContact} ({rejectPayoutModal.request.payoutNetwork})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #222226', paddingTop: '0.45rem', marginTop: '0.45rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#d4d4d8' }}>Requested Amount:</span>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#34d399' }}>
                  GH₵ {Number(rejectPayoutModal.request.amount).toFixed(2)}
                </span>
              </div>
            </div>

            <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1.1rem', fontSize: '0.75rem', color: '#fde68a', lineHeight: 1.45, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-circle-info" style={{ color: '#f59e0b', fontSize: '0.85rem', flexShrink: 0 }} />
              <span>Rejecting updates the audit trail and returns <strong>GH₵ {Number(rejectPayoutModal.request.amount).toFixed(2)}</strong> to wallet balance.</span>
            </div>

            <form onSubmit={handleConfirmRejectPayout}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.35rem' }}>
                  Reason for Rejection *
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '0.75rem' }}>
                  {[
                    'Information mismatch',
                    'Suspected fraud / Unverified school link',
                    'MoMo contact unreachable or invalid',
                    'Agent requested cancellation',
                    'CUSTOM'
                  ].map(option => (
                    <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#d4d4d8', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="rejectReason"
                        checked={rejectPayoutModal.reason === option}
                        onChange={() => setRejectPayoutModal(prev => ({ ...prev, reason: option }))}
                        style={{ accentColor: '#f43f5e' }}
                      />
                      <span>{option === 'CUSTOM' ? 'Other / Custom reason...' : option}</span>
                    </label>
                  ))}
                </div>

                {rejectPayoutModal.reason === 'CUSTOM' && (
                  <textarea
                    rows={2}
                    placeholder="Provide specific rejection reason for the audit log..."
                    value={rejectPayoutModal.customReason}
                    onChange={(e) => setRejectPayoutModal(prev => ({ ...prev, customReason: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #3f3f46', color: '#fafafa', fontSize: '0.8rem', outline: 'none' }}
                    required
                  />
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setRejectPayoutModal({ isOpen: false, request: null, reason: 'Information mismatch', customReason: '', loading: false, error: '' })}
                  style={{ padding: '0.55rem 1rem', borderRadius: '7px', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectPayoutModal.loading}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '7px',
                    background: '#f43f5e',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: rejectPayoutModal.loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {rejectPayoutModal.loading ? 'Processing...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── MODAL: STYLED STATUS CHANGE CONFIRMATION ────────────────── */}
      {statusConfirmModal.isOpen && statusConfirmModal.agent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '1rem' }}>
          <div style={{ background: '#141417', border: '1px solid #27272a', borderRadius: '14px', width: '100%', maxWidth: '440px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.85)', position: 'relative' }}>
            
            <button
              onClick={() => setStatusConfirmModal({ isOpen: false, agent: null, newStatus: 'ACTIVE', reason: '', loading: false, error: '' })}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <i className="fa-solid fa-xmark" style={{ fontSize: '0.8rem' }}></i>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: statusConfirmModal.newStatus === 'ACTIVE'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : statusConfirmModal.newStatus === 'SUSPENDED'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(113, 113, 122, 0.2)',
                border: `1px solid ${statusConfirmModal.newStatus === 'ACTIVE' ? 'rgba(16, 185, 129, 0.3)' : statusConfirmModal.newStatus === 'SUSPENDED' ? 'rgba(239, 68, 68, 0.3)' : '#3f3f46'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <i className={`fa-solid ${statusConfirmModal.newStatus === 'ACTIVE' ? 'fa-circle-check' : statusConfirmModal.newStatus === 'SUSPENDED' ? 'fa-ban' : 'fa-pause'}`}
                  style={{
                    color: statusConfirmModal.newStatus === 'ACTIVE' ? '#34d399' : statusConfirmModal.newStatus === 'SUSPENDED' ? '#f87171' : '#a1a1aa',
                    fontSize: '1.1rem'
                  }}
                ></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif' }}>
                  {statusConfirmModal.newStatus === 'ACTIVE' ? 'Activate Referrer' : statusConfirmModal.newStatus === 'SUSPENDED' ? 'Suspend Referrer' : 'Deactivate Referrer'}
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#71717a' }}>
                  Updating account for {statusConfirmModal.agent.fullName}
                </span>
              </div>
            </div>

            {statusConfirmModal.error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.7rem 0.9rem', borderRadius: '8px', marginBottom: '1.1rem', fontSize: '0.8rem' }}>
                {statusConfirmModal.error}
              </div>
            )}

            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', color: '#a1a1aa', lineHeight: 1.5 }}>
              {statusConfirmModal.newStatus === 'ACTIVE' && (
                <>Activating enables this referrer to earn commissions and request MoMo payouts.</>
              )}
              {statusConfirmModal.newStatus === 'SUSPENDED' && (
                <>Suspending will freeze payouts and lock active referral links until reactivated.</>
              )}
              {statusConfirmModal.newStatus === 'INACTIVE' && (
                <>Setting to inactive archives this referrer while preserving their historical ledger records.</>
              )}
            </p>

            <form onSubmit={handleExecuteStatusChange}>
              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.35rem' }}>
                  Reason / Audit Log Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified by compliance, Account under review..."
                  value={statusConfirmModal.reason}
                  onChange={(e) => setStatusConfirmModal(prev => ({ ...prev, reason: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setStatusConfirmModal({ isOpen: false, agent: null, newStatus: 'ACTIVE', reason: '', loading: false, error: '' })}
                  style={{ padding: '0.55rem 1rem', borderRadius: '7px', background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statusConfirmModal.loading}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '7px',
                    background: statusConfirmModal.newStatus === 'ACTIVE'
                      ? '#10b981'
                      : statusConfirmModal.newStatus === 'SUSPENDED'
                        ? '#ef4444'
                        : '#3f3f46',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: statusConfirmModal.loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {statusConfirmModal.loading ? 'Updating...' : `Confirm ${statusConfirmModal.newStatus}`}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── Share Referral Registration Link Modal ───────────────────── */}
      {shareModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#141417', border: '1px solid #27272a', borderRadius: '14px', width: '100%', maxWidth: '480px', padding: '1.75rem', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>

            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-share-nodes" style={{ color: '#60a5fa', fontSize: '1.1rem' }}></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif' }}>
                    Share Registration Link
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: '#71717a' }}>Invite people to become referral partners</span>
                </div>
              </div>
              <button
                onClick={() => setShareModal({ isOpen: false, copied: false })}
                style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#1c1c20', border: '1px solid #27272a', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0 }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Description */}
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.82rem', color: '#a1a1aa', lineHeight: 1.6, background: 'rgba(59, 130, 246, 0.07)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '8px', padding: '0.75rem 0.9rem' }}>
              <i className="fa-solid fa-circle-info" style={{ color: '#60a5fa', marginRight: '6px' }}></i>
              Share this link with anyone interested in joining the LabourEdu School Referral Partner Program. They'll land directly on the partner registration page.
            </p>

            {/* URL Field */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                Registration Link
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1, background: '#121215', border: '1px solid #27272a', borderRadius: '8px', padding: '0.65rem 0.9rem', color: '#a1a1aa', fontSize: '0.82rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text', userSelect: 'all' }}>
                  {getShareUrl()}
                </div>
                <button
                  onClick={handleCopyShareLink}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: '8px',
                    background: shareModal.copied ? '#10b981' : '#f59e0b',
                    border: 'none',
                    color: shareModal.copied ? '#fff' : '#09090b',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    whiteSpace: 'nowrap',
                    transition: 'background 0.2s ease',
                    minWidth: '90px',
                    justifyContent: 'center'
                  }}
                >
                  <i className={`fa-solid ${shareModal.copied ? 'fa-check' : 'fa-copy'}`}></i>
                  <span>{shareModal.copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* QR Code */}
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
                QR Code
              </label>
              <div style={{ display: 'inline-block', background: '#ffffff', borderRadius: '10px', padding: '10px' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getShareUrl())}&bgcolor=ffffff&color=09090b&margin=4`}
                  alt="QR Code for referral registration"
                  width={160}
                  height={160}
                  style={{ display: 'block', borderRadius: '4px' }}
                />
              </div>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.74rem', color: '#52525b' }}>Scan to open on mobile</p>
            </div>

            {/* Share Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={handleWhatsAppShare}
                style={{
                  width: '100%',
                  padding: '0.7rem 1rem',
                  borderRadius: '8px',
                  background: '#25D366',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-brands fa-whatsapp" style={{ fontSize: '1.05rem' }}></i>
                <span>Share via WhatsApp</span>
              </button>

              <button
                onClick={() => setShareModal({ isOpen: false, copied: false })}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#1c1c20', border: '1px solid #27272a', color: '#71717a', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
