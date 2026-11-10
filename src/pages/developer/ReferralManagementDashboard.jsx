import React, { useState, useEffect } from 'react';
import referralAnalyticsService from '../../services/referralAnalyticsService';
import referralService from '../../services/referralService';
import rewardService from '../../services/rewardService';
import configurationService from '../../services/configurationService';
import { db } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { useLiveQuery } from 'dexie-react-hooks';
import IndividualAgentsTab from '../../components/operations/IndividualAgentsTab';

const ReferralManagementDashboard = () => {
  const [activeProgramTab, setActiveProgramTab] = useState('individual_agents'); // 'individual_agents' | 'school_rewards'
  const [telemetry, setTelemetry] = useState(null);
  const [config, setConfig] = useState({
    rewardAmount: 20.00,
    welcomeBonusAmount: 10.00,
    referralExpiryDays: 7,
    fraudThreshold: 0.4,
    isProgramEnabled: true,
    enableWelcomeBonus: true
  });
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionNotice, setActionNotice] = useState(null);
  const [rowActions, setRowActions] = useState({});
  const [cloudSchools, setCloudSchools] = useState([]);

  // Deduction Modal State
  const [deductModal, setDeductModal] = useState({
    isOpen: false,
    referral: null,
    schoolId: '',
    schoolName: '',
    amount: 20.00,
    reason: 'Referral reward clawback / administrative deduction',
    loading: false,
    error: ''
  });

  // Clear / Reset School Referrals Modal State
  const [clearModal, setClearModal] = useState({
    isOpen: false,
    schoolId: '',
    schoolName: '',
    loading: false,
    error: ''
  });

  // Purge Single Referral Record Modal State
  const [purgeModal, setPurgeModal] = useState({
    isOpen: false,
    referral: null,
    loading: false,
    error: ''
  });

  // Reject Referral Modal State
  const [rejectModal, setRejectModal] = useState({
    isOpen: false,
    referralId: null,
    reason: 'Administrative Rejection',
    customReason: '',
    loading: false,
    error: ''
  });

  const rawReferrals = useLiveQuery(() => db.referrals.toArray(), []);
  const allSchools = useLiveQuery(() => db.schools.toArray(), []);

  const loadData = async () => {
    try {
      const analytics = await referralAnalyticsService.getSuperAdminAnalytics();
      setTelemetry(analytics);

      const currentConfig = await configurationService.getReferralConfig();
      setConfig(currentConfig);

      if (navigator.onLine) {
        // Query authentic report_schools. Using core columns ensures compatibility even if total_referral_earnings isn't in cloud schema
        const { data: sList, error: sErr } = await supabase
          .from('report_schools')
          .select('id, name, wallet_balance')
          .order('name');
        if (!sErr && sList && sList.length > 0) {
          setCloudSchools(sList);
        }
      }
    } catch (err) {
      console.warn('[ReferralDashboard] Data load notice:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [rawReferrals]);

  // Combined school list for dropdown selector
  const availableSchools = (allSchools && allSchools.length > 0) ? allSchools : cloudSchools;

  // Deduction Handlers
  const handleOpenRowDeduct = (referral) => {
    const refSchool = availableSchools?.find(s => String(s.id).trim() === String(referral.referrerSchoolId).trim());
    setDeductModal({
      isOpen: true,
      referral,
      schoolId: referral.referrerSchoolId,
      schoolName: refSchool?.name || referral.referrerSchoolName || `School #${referral.referrerSchoolId}`,
      amount: Number(referral.rewardAmount || config.rewardAmount || 20.00),
      reason: 'Referral reward clawback / administrative deduction',
      loading: false,
      error: ''
    });
  };

  const handleOpenDirectDeduct = () => {
    const firstSchool = availableSchools?.[0];
    setDeductModal({
      isOpen: true,
      referral: null,
      schoolId: firstSchool ? String(firstSchool.id) : '',
      schoolName: firstSchool?.name || '',
      amount: Number(config.rewardAmount || 20.00),
      reason: 'Referral reward clawback / administrative deduction',
      loading: false,
      error: ''
    });
  };

  const handleExecuteDeduction = async (e) => {
    e.preventDefault();
    if (!deductModal.schoolId) {
      setDeductModal(prev => ({ ...prev, error: 'Please select a school to deduct from.' }));
      return;
    }
    const amt = Number(deductModal.amount);
    if (!amt || amt <= 0) {
      setDeductModal(prev => ({ ...prev, error: 'Please enter a valid deduction amount greater than 0.' }));
      return;
    }

    setDeductModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await rewardService.deductReferralReward({
        referralId: deductModal.referral?.id || null,
        schoolId: deductModal.schoolId,
        amount: amt,
        reason: deductModal.reason,
        deductedBy: 'Super Admin'
      });

      const schoolLabel = deductModal.schoolName || `School #${deductModal.schoolId}`;
      setActionNotice({
        type: 'success',
        text: `Successfully deducted GH₵ ${amt.toFixed(2)} from ${schoolLabel}. New wallet balance: GH₵ ${Number(res?.newWalletBalance || 0).toFixed(2)}.`
      });
      setTimeout(() => setActionNotice(null), 5000);

      if (deductModal.referral?.id) {
        setRowActions(prev => ({
          ...prev,
          [deductModal.referral.id]: {
            loading: null,
            status: 'REVOKED',
            message: `Deducted (-GH₵ ${amt.toFixed(2)})`
          }
        }));
      }

      setDeductModal({
        isOpen: false,
        referral: null,
        schoolId: '',
        schoolName: '',
        amount: 20.00,
        reason: '',
        loading: false,
        error: ''
      });

      await loadData();
    } catch (err) {
      setDeductModal(prev => ({ ...prev, loading: false, error: err.message || 'Deduction failed.' }));
    }
  };

  // Clear School Referrals & Messages Handlers
  const handleOpenClearModal = (defaultSchoolId = null) => {
    const target = defaultSchoolId 
      ? availableSchools?.find(s => String(s.id).trim() === String(defaultSchoolId).trim())
      : availableSchools?.[0];
    setClearModal({
      isOpen: true,
      schoolId: target ? String(target.id) : (defaultSchoolId || ''),
      schoolName: target?.name || '',
      loading: false,
      error: ''
    });
  };

  const handleExecuteClearSchool = async (e) => {
    e.preventDefault();
    if (!clearModal.schoolId) {
      setClearModal(prev => ({ ...prev, error: 'Please select a school to clear.' }));
      return;
    }

    setClearModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await referralService.clearSchoolReferralsAndHistory(clearModal.schoolId);
      const schoolLabel = clearModal.schoolName || `School #${clearModal.schoolId}`;

      if (res.success) {
        setActionNotice({
          type: 'success',
          text: `${schoolLabel}: All referrals, bonus messages, deductions, and test ledger records have been completely cleared! School can now start afresh.`
        });
        setTimeout(() => setActionNotice(null), 6000);

        setClearModal({
          isOpen: false,
          schoolId: '',
          schoolName: '',
          loading: false,
          error: ''
        });

        await loadData();
      } else {
        setClearModal(prev => ({ ...prev, loading: false, error: res.message || 'Failed to clear referrals.' }));
      }
    } catch (err) {
      setClearModal(prev => ({ ...prev, loading: false, error: err.message || 'Failed to clear referrals.' }));
    }
  };

  const handlePurgeRow = (referral) => {
    setPurgeModal({
      isOpen: true,
      referral,
      loading: false,
      error: ''
    });
  };

  const handleConfirmPurge = async (e) => {
    if (e) e.preventDefault();
    if (!purgeModal.referral) return;
    const referral = purgeModal.referral;
    const codeLabel = referral.referralCodeUsed || referral.id;
    const rowKey = referral.id || referral.referredSchoolId;
    setPurgeModal(prev => ({ ...prev, loading: true, error: '' }));
    setRowActions(prev => ({ ...prev, [rowKey]: { loading: 'purge' } }));
    try {
      const res = await referralService.purgeSingleReferral(referral.id, referral.referrerSchoolId, referral.referredSchoolId);
      if (res.success) {
        setActionNotice({ type: 'success', text: `Referral "${codeLabel}" permanently removed.` });
        setTimeout(() => setActionNotice(null), 4000);
        setPurgeModal({ isOpen: false, referral: null, loading: false, error: '' });
        await loadData();
      } else {
        setPurgeModal(prev => ({ ...prev, loading: false, error: res.message || 'Failed to remove referral.' }));
      }
    } catch (err) {
      setPurgeModal(prev => ({ ...prev, loading: false, error: err.message || 'Failed to remove referral.' }));
    } finally {
      setRowActions(prev => ({ ...prev, [rowKey]: { loading: null } }));
    }
  };

  const handleConfigSave = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await configurationService.updateReferralConfig(config);
      setActionNotice({ type: 'success', text: 'Referral program settings updated successfully!' });
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err) {
      setActionNotice({ type: 'error', text: 'Failed to update settings: ' + err.message });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleVerify = async (referralId, referredSchoolId) => {
    const rowKey = referralId || referredSchoolId;
    setRowActions(prev => ({ ...prev, [rowKey]: { loading: 'verify' } }));
    try {
      await referralService.verifyReferral(referralId, 'Super Admin');
      if (referredSchoolId) {
        await rewardService.processReferralReward(referredSchoolId, { referralId, manualOverride: true }).catch(() => null);
      }
      setRowActions(prev => ({
        ...prev,
        [rowKey]: { loading: null, status: 'VERIFIED', message: 'Verified & Queued' }
      }));
      setActionNotice({ type: 'success', text: 'Referral verified and wallet reward credited successfully!' });
      setTimeout(() => setActionNotice(null), 4000);
      await loadData();
    } catch (err) {
      setRowActions(prev => ({
        ...prev,
        [rowKey]: { loading: null, status: 'FAILED', message: err.message }
      }));
      setActionNotice({ type: 'error', text: err.message });
    }
  };

  const handleManualReward = async (referralId, referredSchoolId) => {
    const rowKey = referralId || referredSchoolId;
    setRowActions(prev => ({ ...prev, [rowKey]: { loading: 'credit' } }));
    try {
      const res = await rewardService.processReferralReward(referredSchoolId, { referralId, manualOverride: true });
      const amountCredited = Number(res?.rewardAmount || config.rewardAmount || 20.00).toFixed(2);
      setRowActions(prev => ({
        ...prev,
        [rowKey]: { loading: null, status: 'CREDITED', message: `+GH₵ ${amountCredited} Credited!` }
      }));
      setActionNotice({ type: 'success', text: `Referral reward (+GH₵ ${amountCredited}) issued & wallet credited successfully!` });
      setTimeout(() => setActionNotice(null), 4000);
      await loadData();
    } catch (err) {
      setRowActions(prev => ({
        ...prev,
        [rowKey]: { loading: null, status: 'FAILED', message: err.message || 'Crediting failed' }
      }));
      setActionNotice({ type: 'error', text: 'Failed to credit reward: ' + (err.message || 'Unknown error') });
    }
  };

  const handleReject = (referralId) => {
    setRejectModal({
      isOpen: true,
      referralId,
      reason: 'Administrative Rejection',
      customReason: '',
      loading: false,
      error: ''
    });
  };

  const handleConfirmReject = async (e) => {
    if (e) e.preventDefault();
    if (!rejectModal.referralId) return;
    const finalReason = rejectModal.reason === 'CUSTOM'
      ? (rejectModal.customReason?.trim() || 'Administrative Rejection')
      : rejectModal.reason;
    const rowKey = rejectModal.referralId;
    setRejectModal(prev => ({ ...prev, loading: true, error: '' }));
    setRowActions(prev => ({ ...prev, [rowKey]: { loading: 'reject' } }));
    try {
      await referralService.rejectReferral(rejectModal.referralId, finalReason, 'Super Admin');
      setRowActions(prev => ({
        ...prev,
        [rowKey]: { loading: null, status: 'REJECTED', message: 'Rejected' }
      }));
      setActionNotice({ type: 'success', text: 'Referral record rejected.' });
      setTimeout(() => setActionNotice(null), 3500);
      setRejectModal({ isOpen: false, referralId: null, reason: 'Administrative Rejection', customReason: '', loading: false, error: '' });
      await loadData();
    } catch (err) {
      setRejectModal(prev => ({ ...prev, loading: false, error: err.message || 'Failed to reject referral.' }));
    }
  };

  const referralsList = telemetry?.allReferrals?.length > 0 ? telemetry.allReferrals : (rawReferrals || []);

  const filteredReferrals = referralsList.filter((r) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'UNDER_VERIFICATION' && (r.status !== 'UNDER_VERIFICATION' && r.status !== 'PENDING')) return false;
      if (statusFilter === 'REVOKED' && (r.status !== 'REVOKED' && r.status !== 'DEDUCTED')) return false;
      if (statusFilter !== 'UNDER_VERIFICATION' && statusFilter !== 'REVOKED' && r.status !== statusFilter) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const code = String(r.referralCodeUsed || '').toLowerCase();
      const refSchool = (r.referrerSchoolName || allSchools?.find(s => String(s.id).trim() === String(r.referrerSchoolId).trim())?.name || '').toLowerCase();
      const newSchool = (r.referredSchoolName || allSchools?.find(s => String(s.id).trim() === String(r.referredSchoolId).trim())?.name || '').toLowerCase();
      return code.includes(q) || refSchool.includes(q) || newSchool.includes(q);
    }
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'REWARDED':
        return { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: 'rgba(34, 197, 94, 0.3)', icon: 'fa-gift', label: 'Rewarded' };
      case 'REVOKED':
      case 'DEDUCTED':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)', icon: 'fa-rotate-left', label: 'Deducted' };
      case 'VERIFIED':
        return { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)', icon: 'fa-shield-check', label: 'Verified' };
      case 'UNDER_REVIEW':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.3)', icon: 'fa-triangle-exclamation', label: 'Fraud Review' };
      case 'REJECTED':
        return { bg: 'rgba(168, 162, 158, 0.15)', color: '#d6d3d1', border: 'rgba(168, 162, 158, 0.3)', icon: 'fa-times-circle', label: 'Rejected' };
      default:
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)', icon: 'fa-clock', label: 'Under Verification' };
    }
  };

  return (
    <div className="fade-in" style={{ padding: '0.5rem 0', color: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif', background: '#09090b', minHeight: '100%' }}>
      
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #1f1f23', paddingBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.35rem' }}>
            <i className="fa-solid fa-arrows-split-up-and-left" style={{ fontSize: '0.75rem' }}></i>
            <span>Operations &amp; Growth</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: '#fafafa', letterSpacing: '-0.02em' }}>
            Referrals &amp; Partnerships
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#a1a1aa' }}>
            Manage promoter commission earnings, review payout disbursements, inspect referee records, and configure school incentives.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {activeProgramTab === 'school_rewards' && (
            <>
              <button
                onClick={handleOpenDirectDeduct}
                style={{
                  padding: '0.5rem 0.95rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.15s ease'
                }}
              >
                <i className="fa-solid fa-minus" style={{ fontSize: '0.75rem' }} />
                <span>Deduct School Reward</span>
              </button>

              <button
                onClick={() => handleOpenClearModal()}
                style={{
                  padding: '0.5rem 0.95rem',
                  borderRadius: '8px',
                  background: '#141417',
                  border: '1px solid #27272a',
                  color: '#a1a1aa',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-broom" style={{ fontSize: '0.75rem' }} />
                <span>Reset Program</span>
              </button>
            </>
          )}

          <button
            onClick={loadData}
            title="Refresh Analytics"
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '8px',
              background: '#141417',
              border: '1px solid #27272a',
              color: '#d4d4d8',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-solid fa-rotate-right" style={{ fontSize: '0.8rem', color: '#a1a1aa' }} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Human-Designed Program Mode Switcher ─────────────────────────── */}
      <div className="tab-nav-row" style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem', background: '#121214', padding: '4px', borderRadius: '10px', border: '1px solid #222226', width: 'fit-content', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <button
          type="button"
          onClick={() => setActiveProgramTab('individual_agents')}
          style={{
            background: activeProgramTab === 'individual_agents' ? '#27272a' : 'transparent',
            color: activeProgramTab === 'individual_agents' ? '#fafafa' : '#a1a1aa',
            border: 'none',
            padding: '0.55rem 1.15rem',
            borderRadius: '7px',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
            boxShadow: activeProgramTab === 'individual_agents' ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <i className="fa-solid fa-user-group" style={{ fontSize: '0.82rem', color: activeProgramTab === 'individual_agents' ? '#f59e0b' : '#71717a' }} />
          <span>Promoter &amp; Referrer Network</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveProgramTab('school_rewards')}
          style={{
            background: activeProgramTab === 'school_rewards' ? '#27272a' : 'transparent',
            color: activeProgramTab === 'school_rewards' ? '#fafafa' : '#a1a1aa',
            border: 'none',
            padding: '0.55rem 1.15rem',
            borderRadius: '7px',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
            boxShadow: activeProgramTab === 'school_rewards' ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <i className="fa-solid fa-school" style={{ fontSize: '0.82rem', color: activeProgramTab === 'school_rewards' ? '#38bdf8' : '#71717a' }} />
          <span>School-to-School Program</span>
        </button>
      </div>

      {activeProgramTab === 'individual_agents' ? (
        <IndividualAgentsTab />
      ) : (
        <>
          {/* Action Notification Banner */}
          {actionNotice && (
            <div style={{ padding: '0.75rem 1.15rem', borderRadius: '10px', marginBottom: '1.25rem', background: actionNotice.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)', border: actionNotice.type === 'success' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)', color: actionNotice.type === 'success' ? '#4ade80' : '#fca5a5', fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className={`fa-solid ${actionNotice.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`} />
              <span>{actionNotice.text}</span>
            </div>
          )}

      {/* ── Telemetry KPI Cards Grid ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        
        {/* Total Referrals */}
        <div style={{ background: '#121215', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #222226' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Referrals</span>
            <i className="fa-solid fa-school" style={{ color: '#71717a', fontSize: '0.85rem' }} />
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.65rem', fontWeight: 700, marginTop: '0.35rem', color: '#f4f4f5' }}>
            {telemetry?.totalReferrals || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>All-time submissions</div>
        </div>

        {/* Pending Verification */}
        <div style={{ background: '#121215', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #222226' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending Review</span>
            <i className="fa-solid fa-clock" style={{ color: '#f59e0b', fontSize: '0.85rem' }} />
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.65rem', fontWeight: 700, color: '#fbbf24', marginTop: '0.35rem' }}>
            {telemetry?.pendingCount || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>Awaiting verification</div>
        </div>

        {/* Fraud Flagged */}
        <div style={{ background: '#121215', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #222226' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fraud Review</span>
            <i className="fa-solid fa-triangle-exclamation" style={{ color: '#ef4444', fontSize: '0.85rem' }} />
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.65rem', fontWeight: 700, color: '#f87171', marginTop: '0.35rem' }}>
            {telemetry?.underReviewCount || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>Flagged risk entries</div>
        </div>

        {/* Rewarded */}
        <div style={{ background: '#121215', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #222226' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rewarded</span>
            <i className="fa-solid fa-circle-check" style={{ color: '#10b981', fontSize: '0.85rem' }} />
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.65rem', fontWeight: 700, color: '#34d399', marginTop: '0.35rem' }}>
            {telemetry?.rewardedCount || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>Credited successfully</div>
        </div>

        {/* Revoked / Deducted */}
        <div style={{ background: '#121215', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #222226' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Deducted</span>
            <i className="fa-solid fa-rotate-left" style={{ color: '#71717a', fontSize: '0.85rem' }} />
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.65rem', fontWeight: 700, color: '#d4d4d8', marginTop: '0.35rem' }}>
            {telemetry?.revokedCount || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>Clawed back rewards</div>
        </div>

        {/* Total Credits Issued */}
        <div style={{ background: '#121215', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #222226' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Credits Paid</span>
            <i className="fa-solid fa-coins" style={{ color: '#3b82f6', fontSize: '0.85rem' }} />
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.65rem', fontWeight: 700, color: '#f4f4f5', marginTop: '0.35rem' }}>
            GH₵ {(telemetry?.totalCreditsIssued || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.2rem' }}>Disbursed to wallets</div>
        </div>

      </div>

      {/* ── Settings & Leaderboard Section Split ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* Global Configuration Controls Form */}
        <div style={{ background: '#141417', borderRadius: '14px', border: '1px solid #222226', padding: '1.4rem', color: '#f4f4f5' }}>
          <h3 style={{ margin: '0 0 1.1rem 0', fontSize: '1rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-sliders" style={{ color: '#f59e0b', fontSize: '0.9rem' }}></i>
            <span>Global Program Configuration</span>
          </h3>

          <form onSubmit={handleConfigSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#d4d4d8', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>Referrer Reward (GH₵)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.rewardAmount}
                  onChange={(e) => setConfig({ ...config, rewardAmount: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '10px', background: '#121215', border: '1px solid #27272a', color: '#f4f4f5', fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#d4d4d8', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>Welcome Bonus (GH₵)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.welcomeBonusAmount}
                  onChange={(e) => setConfig({ ...config, welcomeBonusAmount: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '10px', background: '#121215', border: '1px solid #27272a', color: '#f4f4f5', fontWeight: 700, outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#d4d4d8', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>Expiry Window (Days)</label>
                <input
                  type="number"
                  value={config.referralExpiryDays}
                  onChange={(e) => setConfig({ ...config, referralExpiryDays: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '10px', background: '#121215', border: '1px solid #27272a', color: '#f4f4f5', fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#d4d4d8', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>Fraud Score Threshold</label>
                <input
                  type="number"
                  step="0.05"
                  value={config.fraudThreshold}
                  onChange={(e) => setConfig({ ...config, fraudThreshold: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '10px', background: '#121215', border: '1px solid #27272a', color: '#f4f4f5', fontWeight: 700, outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={config.isProgramEnabled}
                  onChange={(e) => setConfig({ ...config, isProgramEnabled: e.target.checked })}
                  style={{ accentColor: '#d97706', width: '16px', height: '16px' }}
                />
                <span>Program Active</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={config.enableWelcomeBonus}
                  onChange={(e) => setConfig({ ...config, enableWelcomeBonus: e.target.checked })}
                  style={{ accentColor: '#d97706', width: '16px', height: '16px' }}
                />
                <span>Enable Welcome Bonus</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              style={{
                marginTop: '0.6rem',
                padding: '0.65rem 1rem',
                borderRadius: '8px',
                background: '#f59e0b',
                color: '#09090b',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: savingConfig ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {savingConfig ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Saving Settings...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk"></i>
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Top Promoter Schools Leaderboard */}
        <div style={{ background: '#141417', borderRadius: '14px', border: '1px solid #222226', padding: '1.4rem', color: '#f4f4f5' }}>
          <h3 style={{ margin: '0 0 1.1rem 0', fontSize: '1rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-trophy" style={{ color: '#f59e0b', fontSize: '0.9rem' }}></i>
            <span>Top Promoter Leaderboard</span>
          </h3>

          {telemetry?.leaderboard?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '280px', overflowY: 'auto' }}>
              {telemetry.leaderboard.map((item, idx) => (
                <div key={item.schoolId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 0.95rem', background: '#121215', borderRadius: '10px', border: '1px solid #222226' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: idx === 0 ? 'rgba(245, 158, 11, 0.2)' : idx === 1 ? 'rgba(161, 161, 170, 0.2)' : idx === 2 ? 'rgba(180, 83, 9, 0.2)' : '#27272a',
                      color: idx === 0 ? '#fbbf24' : idx === 1 ? '#d4d4d8' : idx === 2 ? '#f59e0b' : '#a1a1aa',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      border: idx === 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #27272a'
                    }}>
                      {idx + 1}
                    </span>
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fafafa', display: 'block' }}>{item.schoolName}</span>
                      <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Code: <code style={{ color: '#fbbf24' }}>{item.referralCode || 'N/A'}</code></span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399', display: 'block' }}>{item.successfulCount} Schools</span>
                    <span style={{ fontSize: '0.72rem', color: '#71717a' }}>GH₵ {item.totalEarnings.toFixed(2)} Earned</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#71717a', fontSize: '0.82rem', padding: '2.5rem 1rem', textAlign: 'center', background: '#121215', borderRadius: '10px', border: '1px dashed #222226' }}>
              <i className="fa-solid fa-award" style={{ fontSize: '1.6rem', color: '#3f3f46', marginBottom: '0.5rem', display: 'block' }} />
              No promoter referrals completed yet. Share referral codes to start ranking!
            </div>
          )}
        </div>

      </div>

      {/* ── Referrals Management Directory Table ─────────────────────────── */}
      <div style={{ background: '#141417', borderRadius: '14px', border: '1px solid #222226', overflow: 'hidden', color: '#f4f4f5' }}>
        
        {/* Table Toolbar */}
        <div style={{ padding: '1.1rem 1.3rem', borderBottom: '1px solid #222226', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', background: '#141417' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: '#fafafa' }}>
              Referral Pipeline &amp; Verification Directory
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#71717a' }}>
              Filter by status, inspect risk scores, and manually verify or reward referrals.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#71717a', fontSize: '0.75rem' }} />
              <input
                type="text"
                placeholder="Search code or school..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '0.45rem 0.85rem 0.45rem 2rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.8rem', outline: 'none', width: '210px' }}
              />
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', background: '#121215', borderRadius: '8px', padding: '3px', border: '1px solid #222226' }}>
              {['ALL', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REWARDED', 'REVOKED', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: statusFilter === st ? '#27272a' : 'transparent',
                    color: statusFilter === st ? '#fafafa' : '#a1a1aa',
                    fontSize: '0.73rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {st === 'ALL' ? 'All' : st === 'UNDER_REVIEW' ? 'Review' : st === 'REVOKED' ? 'Deducted' : st.charAt(0) + st.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#121215', color: '#a1a1aa', borderBottom: '1px solid #222226' }}>
                <th style={{ padding: '0.8rem 1.1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Referral Code</th>
                <th style={{ padding: '0.8rem 1.1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Referrer School</th>
                <th style={{ padding: '0.8rem 1.1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>New Referred School</th>
                <th style={{ padding: '0.8rem 1.1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fraud Risk Meter</th>
                <th style={{ padding: '0.8rem 1.1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                <th style={{ padding: '0.8rem 1.1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReferrals.length > 0 ? (
                filteredReferrals.map((r) => {
                  const refSchool = allSchools?.find(s => String(s.id).trim() === String(r.referrerSchoolId).trim());
                  const newSchool = allSchools?.find(s => String(s.id).trim() === String(r.referredSchoolId).trim());
                  const badge = getStatusBadge(r.status);
                  const isHighRisk = r.fraudScore >= 0.4 || r.fraudFlag;

                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #222226' }}>
                      
                      {/* Code */}
                      <td style={{ padding: '0.85rem 1.1rem' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#fbbf24', background: 'rgba(245, 158, 11, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(245, 158, 11, 0.25)', fontSize: '0.78rem' }}>
                          {r.referralCodeUsed || 'N/A'}
                        </span>
                        <span style={{ display: 'block', fontSize: '0.71rem', color: '#71717a', marginTop: '3px' }}>
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </td>

                      {/* Referrer School */}
                      <td style={{ padding: '0.85rem 1.1rem', fontWeight: 600, color: '#fafafa' }}>
                        <div>{refSchool?.name || r.referrerSchoolId}</div>
                        <span style={{ fontSize: '0.71rem', color: '#71717a', fontWeight: 400 }}>Referrer</span>
                      </td>

                      {/* Referred School */}
                      <td style={{ padding: '0.85rem 1.1rem', fontWeight: 600, color: '#fafafa' }}>
                        <div>{newSchool?.name || r.referredSchoolId}</div>
                        <span style={{ fontSize: '0.71rem', color: '#71717a', fontWeight: 400 }}>New Sign-up</span>
                      </td>

                      {/* Risk Score */}
                      <td style={{ padding: '0.85rem 1.1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '60px', height: '5px', borderRadius: '3px', background: '#27272a', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, (r.fraudScore || 0) * 100)}%`, height: '100%', background: isHighRisk ? '#ef4444' : '#10b981' }} />
                          </div>
                          <span style={{ color: isHighRisk ? '#f87171' : '#34d399', fontWeight: 700, fontSize: '0.75rem' }}>
                            {(r.fraudScore || 0).toFixed(2)} {r.fraudFlag ? <i className="fa-solid fa-triangle-exclamation" style={{ color: '#ef4444', marginLeft: '3px' }}></i> : null}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.85rem 1.1rem' }}>
                        <span style={{
                          padding: '0.25rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <i className={`fa-solid ${badge.icon?.replace(/^fas\s+/, '') || 'fa-circle'}`} style={{ fontSize: '0.7rem' }} />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Action Controls */}
                      <td style={{ padding: '0.85rem 1.1rem', textAlign: 'right' }}>
                        {(() => {
                          const rowState = rowActions[r.id] || rowActions[r.referredSchoolId] || {};
                          const isRewarded = r.status === 'REWARDED' || rowState.status === 'CREDITED';
                          const isRevoked = r.status === 'REVOKED' || r.status === 'DEDUCTED' || rowState.status === 'REVOKED';
                          const rewardAmt = Number(r.rewardAmount || config.rewardAmount || 20.00).toFixed(2);

                          if (isRevoked) {
                            return (
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                <span style={{
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '6px',
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#f87171',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }} title={r.rejectionReason || 'Reward was deducted'}>
                                  <i className="fa-solid fa-rotate-left" style={{ color: '#f87171' }} />
                                  <span>Deducted (-GH₵ {rewardAmt})</span>
                                </span>

                                <button
                                  onClick={() => handlePurgeRow(r)}
                                  title="Permanently remove this referral record from the list"
                                  disabled={rowState.loading === 'purge'}
                                  style={{
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '6px',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    color: '#f87171',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                >
                                  {rowState.loading === 'purge' ? (
                                    <i className="fa-solid fa-spinner fa-spin" />
                                  ) : (
                                    <>
                                      <i className="fa-solid fa-trash-can" />
                                      <span>Clear</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            );
                          }

                          if (isRewarded) {
                            return (
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                <span style={{
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '6px',
                                  background: 'rgba(16, 185, 129, 0.12)',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  color: '#34d399',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}>
                                  <i className="fa-solid fa-circle-check" style={{ color: '#34d399' }} />
                                  <span>Credited (+GH₵ {rewardAmt})</span>
                                </span>

                                <button
                                  onClick={() => handleOpenRowDeduct(r)}
                                  title="Deduct / Clawback referral reward from school wallet"
                                  style={{
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '6px',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    color: '#f87171',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                >
                                  <i className="fa-solid fa-circle-minus" /> Deduct
                                </button>

                                <button
                                  onClick={() => handlePurgeRow(r)}
                                  title="Permanently remove this referral record"
                                  disabled={rowState.loading === 'purge'}
                                  style={{
                                    padding: '0.35rem 0.55rem',
                                    borderRadius: '6px',
                                    background: '#1c1c20',
                                    border: '1px solid #27272a',
                                    color: '#a1a1aa',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center'
                                  }}
                                >
                                  <i className="fa-solid fa-trash-can" />
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {/* Verify & Credit Button */}
                              {r.status !== 'VERIFIED' && r.status !== 'REJECTED' && (
                                rowState.loading === 'verify' ? (
                                  <button disabled style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', background: '#1c1c20', color: '#38bdf8', border: '1px solid #0284c7', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', cursor: 'not-allowed' }}>
                                    <i className="fa-solid fa-spinner fa-spin" /> Verifying...
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleVerify(r.id, r.referredSchoolId)}
                                    title="Verify Referral & Approve"
                                    disabled={Boolean(rowState.loading)}
                                    style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', background: '#0284c7', color: 'white', border: 'none', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <i className="fa-solid fa-check" /> Verify &amp; Credit
                                  </button>
                                )
                              )}

                              {/* Credit +GH₵20 Button */}
                              {r.status !== 'REJECTED' && (
                                rowState.loading === 'credit' ? (
                                  <button disabled style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', background: '#1c1c20', color: '#34d399', border: '1px solid #10b981', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', cursor: 'not-allowed' }}>
                                    <i className="fa-solid fa-spinner fa-spin" /> Crediting...
                                  </button>
                                ) : rowState.status === 'FAILED' ? (
                                  <button
                                    onClick={() => handleManualReward(r.id, r.referredSchoolId)}
                                    title={`Error: ${rowState.message || 'Click to retry'}`}
                                    style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', background: '#dc2626', color: 'white', border: 'none', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <i className="fa-solid fa-triangle-exclamation" /> Retry (+GH₵ {rewardAmt})
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleManualReward(r.id, r.referredSchoolId)}
                                    title={`Credit +GH₵ ${rewardAmt} Wallet Reward`}
                                    disabled={Boolean(rowState.loading)}
                                    style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', background: '#10b981', color: 'white', border: 'none', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <i className="fa-solid fa-gift" /> Credit +GH₵ {rewardAmt}
                                  </button>
                                )
                              )}

                              {/* Reject Button */}
                              {r.status !== 'REJECTED' && (
                                rowState.loading === 'reject' ? (
                                  <button disabled style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', background: '#1c1c20', color: '#f87171', border: '1px solid #ef4444', fontSize: '0.75rem', fontWeight: 600, cursor: 'not-allowed' }}>
                                    <i className="fa-solid fa-spinner fa-spin" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleReject(r.id)}
                                    title="Reject Referral"
                                    disabled={Boolean(rowState.loading)}
                                    style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                  >
                                    Reject
                                  </button>
                                )
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: '#71717a' }}>
                    <i className="fa-solid fa-inbox" style={{ fontSize: '1.8rem', color: '#3f3f46', marginBottom: '0.5rem', display: 'block' }} />
                    No referral records match the selected filter or search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Referral Reward Deduction Modal ───────────────────────────────── */}
      {deductModal.isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#141417',
            border: '1px solid #27272a',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.4rem',
              borderBottom: '1px solid #222226',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#121215'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444'
                }}>
                  <i className="fa-solid fa-rotate-left" style={{ fontSize: '0.9rem' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif' }}>
                    Deduct Referral Reward
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#71717a' }}>
                    Claw back referral reward directly from school wallet
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeductModal(prev => ({ ...prev, isOpen: false }))}
                style={{ background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <i className="fa-solid fa-xmark" style={{ fontSize: '0.8rem' }}></i>
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleExecuteDeduction} style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Error Message */}
              {deductModal.error && (
                <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '0.8rem', fontWeight: 600 }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }} />
                  {deductModal.error}
                </div>
              )}

              {/* Target School Info */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Target School
                </label>
                {deductModal.referral ? (
                  <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: '#121215', border: '1px solid #222226' }}>
                    <div style={{ fontWeight: 600, color: '#fafafa', fontSize: '0.88rem' }}>
                      {deductModal.schoolName}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '3px' }}>
                      Referral Code: <span style={{ color: '#fbbf24', fontWeight: 600 }}>{deductModal.referral.referralCodeUsed || 'N/A'}</span> • School ID: <span style={{ color: '#a1a1aa' }}>{deductModal.schoolId}</span>
                    </div>
                  </div>
                ) : (
                  <select
                    value={deductModal.schoolId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      const selSchool = availableSchools.find(s => String(s.id).trim() === String(selId).trim());
                      setDeductModal(prev => ({
                        ...prev,
                        schoolId: selId,
                        schoolName: selSchool?.name || ''
                      }));
                    }}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '8px',
                      background: '#121215',
                      border: '1px solid #27272a',
                      color: '#fafafa',
                      fontSize: '0.82rem',
                      outline: 'none'
                    }}
                  >
                    <option value="">-- Select School to Deduct Reward From --</option>
                    {availableSchools.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Wallet: GH₵ {Number(s.wallet_balance || s.walletBalance || 0).toFixed(2)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Deduction Amount */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Deduction Amount (GH₵)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#ef4444', fontWeight: 700, fontSize: '0.82rem' }}>
                    -GH₵
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={deductModal.amount}
                    onChange={(e) => setDeductModal(prev => ({ ...prev, amount: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.6rem 0.85rem 0.6rem 3.8rem',
                      borderRadius: '8px',
                      background: '#121215',
                      border: '1px solid #27272a',
                      color: '#ef4444',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Reason / Notice Message Input & Quick Presets */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Deduction Notice Message
                </label>
                <textarea
                  rows={2}
                  placeholder="Reason for deduction displayed to the school..."
                  value={deductModal.reason}
                  onChange={(e) => setDeductModal(prev => ({ ...prev, reason: e.target.value }))}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '8px',
                    background: '#121215',
                    border: '1px solid #27272a',
                    color: '#fafafa',
                    fontSize: '0.8rem',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: 1.45
                  }}
                />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                  {[
                    'Self-referral / abuse detected',
                    'Referred school disqualified',
                    'Duplicate school registration',
                    'Administrative correction'
                  ].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDeductModal(prev => ({ ...prev, reason: preset }))}
                      style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: '5px',
                        background: '#1c1c20',
                        border: '1px solid #27272a',
                        color: '#a1a1aa',
                        fontSize: '0.7rem',
                        cursor: 'pointer'
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Warning Notice */}
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                padding: '0.75rem 0.9rem',
                fontSize: '0.75rem',
                color: '#fca5a5',
                lineHeight: 1.45
              }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px', color: '#ef4444' }} />
                This action records a <strong>DEBIT</strong> transaction in the school wallet and updates status to <strong>REVOKED</strong>.
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setDeductModal(prev => ({ ...prev, isOpen: false }))}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '7px',
                    background: '#1c1c20',
                    border: '1px solid #27272a',
                    color: '#a1a1aa',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deductModal.loading}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '7px',
                    background: '#ef4444',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: deductModal.loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {deductModal.loading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Deducting...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check" />
                      <span>Confirm &amp; Deduct Reward</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── Clear / Reset School Referrals & Messages Modal ──────────────── */}
      {clearModal.isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.25rem'
        }}>
          <div style={{
            background: '#141417',
            border: '1px solid #27272a',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.4rem',
              background: '#121215',
              borderBottom: '1px solid #222226',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#818cf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem'
                }}>
                  <i className="fa-solid fa-broom" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fafafa' }}>
                    Clear Referrals &amp; Start Afresh
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#71717a' }}>
                    Wipe referral records, bonus messages &amp; test ledger entries
                  </p>
                </div>
              </div>

              <button
                onClick={() => setClearModal(prev => ({ ...prev, isOpen: false }))}
                style={{ background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <i className="fa-solid fa-xmark" style={{ fontSize: '0.8rem' }}></i>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleExecuteClearSchool} style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              {clearModal.error && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#fca5a5',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}>
                  {clearModal.error}
                </div>
              )}

              {/* School Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Target Institution / School
                </label>
                <select
                  value={clearModal.schoolId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const sch = availableSchools?.find(s => String(s.id).trim() === String(selectedId).trim());
                    setClearModal(prev => ({
                      ...prev,
                      schoolId: selectedId,
                      schoolName: sch?.name || ''
                    }));
                  }}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '8px',
                    background: '#121215',
                    border: '1px solid #27272a',
                    color: '#fafafa',
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                >
                  <option value="">-- Select a School --</option>
                  {availableSchools?.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Information / Scope Breakdown */}
              <div style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '8px',
                padding: '0.8rem 1rem',
                fontSize: '0.75rem',
                color: '#c7d2fe',
                lineHeight: 1.5
              }}>
                <div style={{ fontWeight: 700, color: '#e0e7ff', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-circle-info" style={{ color: '#818cf8' }} /> Scope of wipe:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <li>Referral pipelines and locks for this school will be purged.</li>
                  <li>In-app referral notifications will be removed.</li>
                  <li>Reward transactions and stats will reset to 0.</li>
                </ul>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setClearModal(prev => ({ ...prev, isOpen: false }))}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '7px',
                    background: '#1c1c20',
                    border: '1px solid #27272a',
                    color: '#a1a1aa',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={clearModal.loading || !clearModal.schoolId}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '7px',
                    background: '#6366f1',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: (clearModal.loading || !clearModal.schoolId) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {clearModal.loading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Clearing...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-broom" />
                      <span>Clear &amp; Start Afresh</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── STYLED PURGE REFERRAL RECORD MODAL ───────────────────────── */}
      {purgeModal.isOpen && purgeModal.referral && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#141417',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1.25rem 1.4rem',
              borderBottom: '1px solid #222226',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#121215'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444'
                }}>
                  <i className="fa-solid fa-trash-can" style={{ fontSize: '0.9rem' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fafafa' }}>
                    Remove Referral Record
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#71717a' }}>
                    Permanently delete from database and active list
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPurgeModal({ isOpen: false, referral: null, loading: false, error: '' })}
                style={{ background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <i className="fa-solid fa-xmark" style={{ fontSize: '0.8rem' }}></i>
              </button>
            </div>

            <div style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {purgeModal.error && (
                <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '0.8rem', fontWeight: 600 }}>
                  {purgeModal.error}
                </div>
              )}

              <div style={{ background: '#121215', border: '1px solid #222226', borderRadius: '10px', padding: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Referral Code:</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace' }}>
                    {purgeModal.referral.referralCodeUsed || purgeModal.referral.id}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Referrer School:</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fafafa' }}>
                    {allSchools?.find(s => String(s.id).trim() === String(purgeModal.referral.referrerSchoolId).trim())?.name || purgeModal.referral.referrerSchoolId}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Referred School:</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fafafa' }}>
                    {allSchools?.find(s => String(s.id).trim() === String(purgeModal.referral.referredSchoolId).trim())?.name || purgeModal.referral.referredSchoolId}
                  </span>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '0.78rem', color: '#a1a1aa', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete this referral record? This cannot be undone.
              </p>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setPurgeModal({ isOpen: false, referral: null, loading: false, error: '' })}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '7px',
                    background: '#1c1c20',
                    border: '1px solid #27272a',
                    color: '#a1a1aa',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPurge}
                  disabled={purgeModal.loading}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '7px',
                    background: '#ef4444',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: purgeModal.loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {purgeModal.loading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-trash-can" />
                      <span>Permanently Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STYLED REJECT REFERRAL MODAL ─────────────────────────────── */}
      {rejectModal.isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#141417',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1.25rem 1.4rem',
              borderBottom: '1px solid #222226',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#121215'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444'
                }}>
                  <i className="fa-solid fa-ban" style={{ fontSize: '0.9rem' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fafafa' }}>
                    Reject Referral Record
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#71717a' }}>
                    Mark this referral as disqualified
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRejectModal({ isOpen: false, referralId: null, reason: 'Administrative Rejection', customReason: '', loading: false, error: '' })}
                style={{ background: '#1c1c20', border: '1px solid #27272a', color: '#a1a1aa', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <i className="fa-solid fa-xmark" style={{ fontSize: '0.8rem' }}></i>
              </button>
            </div>

            <form onSubmit={handleConfirmReject} style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {rejectModal.error && (
                <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '0.8rem', fontWeight: 600 }}>
                  {rejectModal.error}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, marginBottom: '0.45rem' }}>
                  Select Rejection Reason
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    'Administrative Rejection',
                    'Suspected Fraud / Self Referral',
                    'Invalid or duplicate school registration',
                    'Referred school already active',
                    'CUSTOM'
                  ].map(option => (
                    <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#d4d4d8', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="schoolRejectReason"
                        checked={rejectModal.reason === option}
                        onChange={() => setRejectModal(prev => ({ ...prev, reason: option }))}
                        style={{ accentColor: '#ef4444' }}
                      />
                      <span>{option === 'CUSTOM' ? 'Other / Custom reason...' : option}</span>
                    </label>
                  ))}
                </div>

                {rejectModal.reason === 'CUSTOM' && (
                  <textarea
                    rows={2}
                    placeholder="Enter reason for rejection..."
                    value={rejectModal.customReason}
                    onChange={(e) => setRejectModal(prev => ({ ...prev, customReason: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      marginTop: '0.5rem',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '8px',
                      background: '#121215',
                      border: '1px solid #27272a',
                      color: '#fafafa',
                      fontSize: '0.8rem',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                    required
                  />
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setRejectModal({ isOpen: false, referralId: null, reason: 'Administrative Rejection', customReason: '', loading: false, error: '' })}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '7px',
                    background: '#1c1c20',
                    border: '1px solid #27272a',
                    color: '#a1a1aa',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectModal.loading}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '7px',
                    background: '#ef4444',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: rejectModal.loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {rejectModal.loading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Rejecting...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-ban" />
                      <span>Confirm Rejection</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default ReferralManagementDashboard;
