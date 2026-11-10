import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getSchoolsDirectory,
  getSchoolTimelineEvents,
  overrideReportRelease,
  toggleReadOnlyMode,
  updateSchoolSubscription,
  createSupportTicket
} from '../../services/operationsService';
import subscriptionService from '../../services/subscriptionService';
import LogoPreloader from '../../components/common/LogoPreloader';
import { useAuth } from '../../store/AuthContext';

const SchoolDetailView = () => {
  const { schoolId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [school, setSchool] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [activeTab, setActiveTab] = useState('health');

  // Modals
  const [showSubModal, setShowSubModal] = useState(false);
  const [subTier, setSubTier] = useState('Standard');
  const [subStatus, setSubStatus] = useState('Active');
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgCategory, setMsgCategory] = useState('System Notice');
  const [msgPriority, setMsgPriority] = useState('Medium');
  const [messageText, setMessageText] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, allTickets] = await Promise.all([
        getSchoolsDirectory(),
        subscriptionService.getAllSupportTickets()
      ]);

      const found = list.find(x => x.id === schoolId);
      if (found) {
        setSchool(found);
        setSubTier(found.subscription_tier || 'Standard');
        setSubStatus(found.subscription_status || 'Active');

        const events = await getSchoolTimelineEvents(found.id);
        setTimeline(events);
      } else {
        console.warn('[SchoolDetailView] School not found:', schoolId);
      }

      setTickets(allTickets.filter(t => t.school_id === schoolId));
    } catch (err) {
      console.error('[SchoolDetailView] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggleReportRelease = async () => {
    if (!school) return;
    const newStatus = !school.reports_released;
    if (!window.confirm(
      `Are you sure you want to ${newStatus ? 'RELEASE' : 'LOCK'} all terminal report cards for "${school.name}"?\n\n` +
      (newStatus ? 'Parents will be able to view their children\'s reports immediately.' : 'Reports will be hidden from the Parent Portal.')
    )) return;

    setSaving(true);
    try {
      await overrideReportRelease(school.id, school.name, newStatus);
      setSchool(prev => ({ ...prev, reports_released: newStatus }));
      await loadData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleReadOnly = async () => {
    if (!school) return;
    const newStatus = !school.is_read_only;
    if (!window.confirm(
      `Are you sure you want to ${newStatus ? 'ENABLE Read-Only Mode' : 'DISABLE Read-Only Mode'} for "${school.name}"?\n\n` +
      (newStatus ? 'All teachers and the headteacher will lose edit access.' : 'Full edit access will be restored.')
    )) return;

    setSaving(true);
    try {
      await toggleReadOnlyMode(school.id, school.name, newStatus);
      setSchool(prev => ({ ...prev, is_read_only: newStatus }));
      await loadData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFreeTrial = async () => {
    if (!school) return;
    const isTerminated = Boolean(school.first_term_free_terminated);
    const actionMsg = isTerminated
      ? `Re-enable Free First Term for "${school.name}"?`
      : `Terminate Free First Term for "${school.name}"? This will require immediate subscription payment starting now.`;

    if (!window.confirm(actionMsg)) return;

    setSaving(true);
    try {
      if (isTerminated) {
        await subscriptionService.restoreSchoolFreeTrial(school.id, 'Platform Operator');
      } else {
        await subscriptionService.terminateSchoolFreeTrial(school.id, true, 'Platform Operator');
      }
      setSchool(prev => ({ ...prev, first_term_free_terminated: !isTerminated }));
      await loadData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSubscription = async (e) => {
    e.preventDefault();
    if (!school) return;
    setSaving(true);
    try {
      await updateSchoolSubscription(school.id, school.name, subTier, subStatus);
      setShowSubModal(false);
      await loadData();
      alert('Subscription profile updated successfully!');
    } catch (err) {
      alert(`Error updating subscription: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const { startImpersonation } = useAuth();

  const handleLaunchHeadteacherPortal = async () => {
    if (!school) return;
    if (!window.confirm(`Launch Live Remote Access as Headteacher for "${school.name}"?\n\nYou will enter the school portal with administrative rights to inspect learners, input scores, diagnose settings, or generate reports.`)) return;

    try {
      await startImpersonation(school.id, school.name);
      navigate('/');
    } catch (err) {
      alert(`Error launching remote session: ${err.message}`);
    }
  };

  const handleSendSupportNotice = async (e) => {
    e.preventDefault();
    if (!school || !msgTitle || !messageText) return;
    setSaving(true);
    try {
      await createSupportTicket(school.id, school.name, msgTitle, msgCategory, msgPriority, messageText);
      setShowMsgModal(false);
      setMsgTitle('');
      setMessageText('');
      await loadData();
      alert('Support notice dispatched successfully!');
    } catch (err) {
      alert(`Error sending notice: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LogoPreloader fullScreen={false} size="md" />;
  }

  if (!school) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: '#71717a' }}>
        <i className="fas fa-circle-exclamation" style={{ fontSize: '2.5rem', color: '#EF4444', marginBottom: '1rem', display: 'block' }}></i>
        <h2 style={{ color: '#fafafa', margin: '0 0 0.5rem' }}>School Not Found</h2>
        <button onClick={() => navigate('/platform/operations/schools')} style={{ padding: '0.55rem 1.15rem', borderRadius: '8px', background: '#1c1c22', color: '#fafafa', border: '1px solid #27272a', fontWeight: 600, cursor: 'pointer' }}>
          Back to Directory
        </button>
      </div>
    );
  }

  const health = school.health || { totalScore: 0, healthStatus: 'Critical', breakdown: {} };
  const scorePct = school.total_scores_count > 0
    ? Math.round((school.submitted_scores_count / school.total_scores_count) * 100)
    : 0;

  const isTrialTerminated = school.first_term_free_terminated;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#fafafa' }}>

      {/* Back + Title */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1.25rem', borderBottom: '1px solid #1f1f23' }}>
        <div>
          <button
            onClick={() => navigate('/platform/operations/schools')}
            style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginBottom: '0.35rem', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="fas fa-arrow-left" style={{ fontSize: '0.7rem' }}></i>
            <span>Back to Schools Directory</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#fafafa', margin: 0, letterSpacing: '-0.02em' }}>
              {school.name}
            </h1>
            {!isTrialTerminated && (
              <span style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#fbbf24', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                First Term Free
              </span>
            )}
          </div>
          <p style={{ color: '#a1a1aa', fontSize: '0.82rem', margin: '0.2rem 0 0' }}>
            {school.region} • {school.district} • {school.circuit} • HT: <strong style={{ color: '#fafafa' }}>{school.headteacher}</strong>
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={handleLaunchHeadteacherPortal}
            disabled={saving}
            title="Launch interactive remote support session inside this school's headteacher portal"
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '7px',
              background: '#2563eb',
              border: 'none',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '0.78rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fas fa-arrow-up-right-from-square" style={{ fontSize: '0.7rem' }}></i>
            <span>Remote Portal</span>
          </button>

          <button
            onClick={handleToggleFreeTrial}
            disabled={saving}
            style={{ padding: '0.45rem 0.8rem', borderRadius: '7px', background: '#18181c', border: '1px solid #27272a', color: isTrialTerminated ? '#34d399' : '#f87171', fontWeight: 600, fontSize: '0.78rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <i className={`fas ${isTrialTerminated ? 'fa-rotate-left' : 'fa-ban'}`} style={{ fontSize: '0.7rem' }}></i>
            <span>{isTrialTerminated ? 'Restore Trial' : 'End Trial'}</span>
          </button>

          <button
            onClick={handleToggleReportRelease}
            disabled={saving}
            style={{ padding: '0.45rem 0.8rem', borderRadius: '7px', background: '#18181c', border: '1px solid #27272a', color: school.reports_released ? '#f87171' : '#34d399', fontWeight: 600, fontSize: '0.78rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <i className={`fas ${school.reports_released ? 'fa-lock' : 'fa-unlock'}`} style={{ fontSize: '0.7rem' }}></i>
            <span>{school.reports_released ? 'Lock Reports' : 'Release Reports'}</span>
          </button>

          <button
            onClick={handleToggleReadOnly}
            disabled={saving}
            style={{ padding: '0.45rem 0.8rem', borderRadius: '7px', background: '#18181c', border: '1px solid #27272a', color: school.is_read_only ? '#60a5fa' : '#fbbf24', fontWeight: 600, fontSize: '0.78rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <i className={`fas ${school.is_read_only ? 'fa-lock-open' : 'fa-shield-halved'}`} style={{ fontSize: '0.7rem' }}></i>
            <span>{school.is_read_only ? 'Unlock Edit' : 'Set Read-Only'}</span>
          </button>

          <button
            onClick={() => setShowSubModal(true)}
            style={{ padding: '0.45rem 0.8rem', borderRadius: '7px', background: '#18181c', border: '1px solid #27272a', color: '#d4d4d8', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="fas fa-credit-card" style={{ fontSize: '0.7rem' }}></i>
            <span>Subscription</span>
          </button>

          <button
            onClick={() => setShowMsgModal(true)}
            style={{ padding: '0.45rem 0.85rem', borderRadius: '7px', background: '#18181c', border: '1px solid #27272a', color: '#fafafa', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="fas fa-paper-plane" style={{ fontSize: '0.7rem', color: '#3b82f6' }}></i>
            <span>Send Notice</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Active Learners', value: school.learners_count, color: '#fafafa' },
          { label: 'Classes', value: school.classes_count || 0, color: '#38bdf8' },
          { label: 'Teaching Staff', value: school.staff_count, color: '#818cf8' },
          { label: 'Wallet Balance', value: `GH₵ ${Number(school.wallet_balance || 0).toFixed(2)}`, color: Number(school.wallet_balance || 0) > 0 ? '#34d399' : '#f87171' },
          { label: 'Score Entry', value: `${scorePct}%`, color: scorePct >= 80 ? '#34d399' : scorePct >= 50 ? '#fbbf24' : '#f87171' },
          { label: 'Reports Released', value: school.reports_released ? 'Released' : 'Locked', color: school.reports_released ? '#34d399' : '#71717a' },
          { label: 'Access Mode', value: school.is_read_only ? 'Read Only' : 'Full Edit', color: school.is_read_only ? '#f87171' : '#34d399' },
        ].map((stat, i) => (
          <div key={i} style={{ padding: '0.75rem 0.95rem', borderRadius: '10px', background: '#121215', border: '1px solid #222226', textAlign: 'center' }}>
            <div style={{ fontSize: '0.68rem', color: '#a1a1aa', textTransform: 'uppercase', fontWeight: 600 }}>{stat.label}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: stat.color, marginTop: '2px', letterSpacing: '-0.02em' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Metadata Card */}
      <div style={{ background: '#121215', borderRadius: '10px', border: '1px solid #222226', padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#71717a', fontWeight: 600, textTransform: 'uppercase' }}>School ID</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600, color: '#fafafa', marginTop: '2px' }}>{school.id}</div>
          <div style={{ fontSize: '0.7rem', color: '#71717a', marginTop: '3px' }}>Registered: {new Date(school.created_at).toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
        </div>

        <div>
          <div style={{ fontSize: '0.7rem', color: '#71717a', fontWeight: 600, textTransform: 'uppercase' }}>Category &amp; Session</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
            <span style={{ padding: '0.15rem 0.45rem', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
              {school.school_category || school.school_type || 'Private'}
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fafafa' }}>
              {school.current_term || 'Term 1'} ({school.current_academic_year || '2025/2026'})
            </span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.7rem', color: '#71717a', fontWeight: 600, textTransform: 'uppercase' }}>Contact &amp; Location</div>
          <div style={{ fontSize: '0.82rem', color: '#d4d4d8', marginTop: '2px' }}>
            {school.phone || 'N/A'} • {school.email || 'N/A'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '2px' }}>
            {school.location || `${school.district || ''}, ${school.region || ''}`}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.7rem', color: '#71717a', fontWeight: 600, textTransform: 'uppercase' }}>Entitlement Status</div>
          {(() => {
            const isInitial = (school.initial_academic_year === school.current_academic_year && school.initial_term === school.current_term) || (!school.initial_academic_year && !school.initial_term);
            const isFree = school.is_first_term_free && !school.first_term_free_terminated && isInitial;
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '5px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    background: isFree ? 'rgba(59, 130, 246, 0.1)' : school.subscription_status === 'Active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: isFree ? '#60a5fa' : school.subscription_status === 'Active' ? '#34d399' : '#f87171',
                    border: `1px solid ${isFree ? 'rgba(59, 130, 246, 0.25)' : school.subscription_status === 'Active' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                  }}>
                    {isFree ? 'Free First Term' : isInitial ? 'Trial Ended (Paid)' : 'Subsequent Term (Paid)'}
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#71717a', marginTop: '3px' }}>
                  Rate: {school.per_learner_rate_override ? `GH₵ ${school.per_learner_rate_override}/learner (Override)` : 'Category Default'}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-nav-row" style={{ display: 'flex', gap: '4px', background: '#121215', padding: '3px', borderRadius: '8px', border: '1px solid #222226', width: 'fit-content', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {[
          { id: 'health', label: 'Health Score', icon: 'fa-chart-pie' },
          { id: 'timeline', label: 'Activity Timeline', icon: 'fa-clock-rotate-left' },
          { id: 'support', label: 'Support Tickets', icon: 'fa-ticket' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.45rem 0.95rem',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              background: activeTab === tab.id ? '#1e1e24' : 'transparent',
              color: activeTab === tab.id ? '#FFFFFF' : '#71717a',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className={`fas ${tab.icon}`} style={{ fontSize: '0.72rem', color: activeTab === tab.id ? '#3b82f6' : '#71717a' }}></i>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Health Score Tab */}
      {activeTab === 'health' && (
        <div className="content-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', background: '#121215', borderRadius: '10px', border: '1px solid #222226', padding: '1.25rem' }}>
          {/* Gauge */}
          <div style={{ background: '#0e0e11', borderRadius: '8px', padding: '1.5rem', border: '1px solid #1f1f23', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: health.healthStatus === 'Healthy' ? '#34d399' : health.healthStatus === 'Warning' ? '#fbbf24' : '#f87171', letterSpacing: '-0.03em' }}>
              {health.totalScore}%
            </div>
            <div style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              background: health.healthStatus === 'Healthy' ? 'rgba(16, 185, 129, 0.1)' : health.healthStatus === 'Warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: health.healthStatus === 'Healthy' ? '#34d399' : health.healthStatus === 'Warning' ? '#fbbf24' : '#f87171',
              border: `1px solid ${health.healthStatus === 'Healthy' ? 'rgba(16, 185, 129, 0.25)' : health.healthStatus === 'Warning' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
            }}>
              {health.healthStatus} Health
            </div>
            <div style={{ fontSize: '0.72rem', color: '#71717a', textAlign: 'center' }}>
              Computed from 6 platform telemetry factors
            </div>
          </div>

          {/* Factor Breakdown */}
          <div>
            <h3 style={{ margin: '0 0 0.85rem', color: '#fafafa', fontSize: '0.92rem', fontWeight: 600 }}>
              Diagnostic Factor Breakdown
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              {[
                { label: 'Sync Health (20%)', value: health.breakdown?.syncHealth || 0, color: '#3b82f6' },
                { label: 'Score Entry (25%)', value: health.breakdown?.scoreCompletion || 0, color: '#34d399' },
                { label: 'Reports Issued (20%)', value: health.breakdown?.reportStatus || 0, color: '#a78bfa' },
                { label: 'Support Issues (15%)', value: health.breakdown?.supportStatus || 0, color: '#fbbf24' },
                { label: 'Subscription (10%)', value: health.breakdown?.subStatus || 0, color: '#38bdf8' },
                { label: 'Active Users (10%)', value: health.breakdown?.activeUsers || 0, color: '#34d399' },
              ].map((f, i) => (
                <div key={i} style={{ background: '#0e0e11', padding: '0.85rem', borderRadius: '8px', border: '1px solid #1f1f23' }}>
                  <div style={{ fontSize: '0.68rem', color: '#71717a', fontWeight: 600 }}>{f.label}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: f.color, marginTop: '3px' }}>{f.value}%</div>
                  <div style={{ height: '3px', background: '#1f1f23', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${f.value}%`, background: f.color, borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Activity Timeline Tab */}
      {activeTab === 'timeline' && (
        <div style={{ background: '#121215', borderRadius: '10px', border: '1px solid #222226', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#fafafa', fontSize: '0.92rem', fontWeight: 600 }}>
              School Activity Timeline
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>
              {timeline.length} recorded events
            </span>
          </div>

          {timeline.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#71717a' }}>
              <i className="fas fa-clock-rotate-left" style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: '#3f3f46', display: 'block' }}></i>
              <div style={{ color: '#d4d4d8', fontWeight: 600, fontSize: '0.9rem' }}>No Timeline Events Recorded</div>
              <div style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>Events appear when interventions, score submissions, or report card releases occur.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '2px solid #27272a', paddingLeft: '1.25rem', marginLeft: '0.5rem' }}>
              {timeline.map((evt, idx) => (
                <div key={evt.id || idx} style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '-1.58rem', top: '0.4rem', width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                  <div style={{ background: '#0e0e11', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #1f1f23' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ color: '#fafafa', fontWeight: 600, fontSize: '0.85rem' }}>{evt.title}</span>
                      <span style={{ fontSize: '0.7rem', color: '#71717a', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                        {new Date(evt.created_at).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    {evt.description && (
                      <p style={{ color: '#a1a1aa', fontSize: '0.78rem', margin: '0.25rem 0 0', lineHeight: 1.4 }}>{evt.description}</p>
                    )}
                    <div style={{ fontSize: '0.68rem', color: '#60a5fa', marginTop: '0.35rem' }}>
                      Actor: {evt.actor_name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Support Tickets Tab */}
      {activeTab === 'support' && (
        <div style={{ background: '#121215', borderRadius: '10px', border: '1px solid #222226', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#fafafa', fontSize: '0.92rem', fontWeight: 600 }}>
              Support Tickets for this School
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>
              {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
            </span>
          </div>

          {tickets.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#71717a' }}>
              <i className="fas fa-ticket" style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: '#3f3f46', display: 'block' }}></i>
              <div style={{ color: '#d4d4d8', fontWeight: 600, fontSize: '0.9rem' }}>No Support Tickets</div>
              <div style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>
                Dispatch a notice using the button above to communicate directly with this school.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tickets.map(t => (
                <div key={t.id} style={{ background: '#0e0e11', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #1f1f23' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>{t.ticket_code}</span>
                      <span style={{ marginLeft: '8px', fontWeight: 600, color: '#fafafa', fontSize: '0.85rem' }}>{t.title}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: t.priority === 'High' || t.priority === 'Urgent' ? '#f87171' : '#fbbf24' }}>{t.priority}</span>
                      <span style={{ padding: '0.15rem 0.5rem', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 600, background: t.status === 'Resolved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: t.status === 'Resolved' ? '#34d399' : '#60a5fa' }}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                  {t.messages?.length > 0 && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#a1a1aa' }}>
                      {t.messages[0].sender}: "{t.messages[0].text?.substring(0, 120)}{t.messages[0].text?.length > 120 ? '…' : ''}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subscription Modal */}
      {showSubModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#141418', border: '1px solid #27272a', borderRadius: '14px', padding: '1.5rem', width: '100%', maxWidth: '440px', color: '#fafafa' }}>
            <h2 style={{ margin: '0 0 1rem', fontWeight: 700, color: '#fafafa', fontSize: '1.1rem' }}>Subscription — {school.name}</h2>
            <form onSubmit={handleSaveSubscription} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 600 }}>Subscription Tier</label>
                <select value={subTier} onChange={e => setSubTier(e.target.value)} style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#0e0e11', border: '1px solid #27272a', color: '#fafafa', outline: 'none', fontSize: '0.85rem' }}>
                  <option value="Basic">Basic (GH₵ 1,200 / yr)</option>
                  <option value="Standard">Standard (GH₵ 2,500 / yr)</option>
                  <option value="Enterprise">Enterprise (GH₵ 4,800 / yr)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 600 }}>Account Status</label>
                <select value={subStatus} onChange={e => setSubStatus(e.target.value)} style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#0e0e11', border: '1px solid #27272a', color: '#fafafa', outline: 'none', fontSize: '0.85rem' }}>
                  <option value="Active">Active</option>
                  <option value="Trial">Trial</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowSubModal(false)} style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: '#1c1c22', border: '1px solid #27272a', color: '#a1a1aa', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: '0.45rem 1rem', borderRadius: '6px', background: '#2563eb', border: 'none', color: '#ffffff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Support Notice Modal */}
      {showMsgModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#141418', border: '1px solid #27272a', borderRadius: '14px', padding: '1.5rem', width: '100%', maxWidth: '480px', color: '#fafafa' }}>
            <h2 style={{ margin: '0 0 1rem', fontWeight: 700, color: '#fafafa', fontSize: '1.1rem' }}>Send Support Notice to {school.name}</h2>
            <form onSubmit={handleSendSupportNotice} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 600 }}>Notice Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Action Required: Please verify Learner Continuous Assessment Marks"
                  value={msgTitle}
                  onChange={e => setMsgTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#0e0e11', border: '1px solid #27272a', color: '#fafafa', outline: 'none', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 600 }}>Category</label>
                  <select value={msgCategory} onChange={e => setMsgCategory(e.target.value)} style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#0e0e11', border: '1px solid #27272a', color: '#fafafa', outline: 'none', fontSize: '0.85rem' }}>
                    <option value="System Notice">System Notice</option>
                    <option value="Billing & Invoicing">Billing &amp; Invoicing</option>
                    <option value="Score Entry Support">Score Entry Support</option>
                    <option value="Report Card Generation">Report Card Generation</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 600 }}>Priority</label>
                  <select value={msgPriority} onChange={e => setMsgPriority(e.target.value)} style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#0e0e11', border: '1px solid #27272a', color: '#fafafa', outline: 'none', fontSize: '0.85rem' }}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 600 }}>Message Content</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Type the message for the school's administration portal…"
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#0e0e11', border: '1px solid #27272a', color: '#fafafa', outline: 'none', fontSize: '0.85rem', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
                <button type="button" onClick={() => setShowMsgModal(false)} style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', background: '#1c1c22', border: '1px solid #27272a', color: '#a1a1aa', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: '0.45rem 1rem', borderRadius: '6px', background: '#2563eb', border: 'none', color: '#ffffff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                  {saving ? 'Sending…' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolDetailView;
