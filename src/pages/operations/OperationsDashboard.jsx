import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getPlatformTelemetry,
  getSchoolsDirectory,
  seedDemoSchoolTelemetry
} from '../../services/operationsService';
import LogoPreloader from '../../components/common/LogoPreloader';
import { usePlatformNotifications } from '../../context/PlatformNotificationContext';

const OperationsDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [schools, setSchools] = useState([]);
  const { notifications, unreadCount } = usePlatformNotifications();

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [telemetry, directory] = await Promise.all([
        getPlatformTelemetry(),
        getSchoolsDirectory()
      ]);
      setMetrics(telemetry);
      setSchools(directory || []);
    } catch (err) {
      console.error('[OperationsDashboard] Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    loadData(true);
  };

  const handleSeedDemoSchool = async () => {
    if (!window.confirm('Load a demonstration school into the local database? This creates "Achimota Basic School" with simulated health factors.')) {
      return;
    }
    try {
      await seedDemoSchoolTelemetry();
      await loadData(true);
    } catch (e) {
      console.error('[OperationsDashboard] Error seeding demo school:', e);
    }
  };

  const getHealthBadge = (healthStatus, score) => {
    switch (healthStatus) {
      case 'Healthy':
        return { bg: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: 'rgba(16, 185, 129, 0.25)', label: `Healthy (${score}%)` };
      case 'Warning':
        return { bg: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.25)', label: `Warning (${score}%)` };
      case 'Critical': default:
        return { bg: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: 'rgba(239, 68, 68, 0.25)', label: `Critical (${score}%)` };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: '#fafafa' }}>

      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        paddingBottom: '1.25rem',
        borderBottom: '1px solid #1f1f23'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, color: '#fafafa', letterSpacing: '-0.02em' }}>
              Operations Overview
            </h1>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '0.15rem 0.5rem', borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Live Telemetry
            </span>
          </div>
          <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.85rem' }}>
            Multi-school continuous assessment tracking, sync telemetry, and remote tenant health.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/platform/operations/runbook')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              background: '#141418',
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
            <i className="fas fa-book-bookmark" style={{ color: '#3b82f6', fontSize: '0.75rem' }}></i>
            <span>Runbook</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              background: '#141418',
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
            <i className={`fas fa-rotate ${refreshing ? 'fa-spin' : ''}`} style={{ fontSize: '0.75rem', color: '#a1a1aa' }}></i>
            <span>{refreshing ? 'Updating…' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => navigate('/platform/operations/schools')}
            style={{
              padding: '0.45rem 0.95rem',
              borderRadius: '8px',
              background: '#2563eb',
              color: '#ffffff',
              border: '1px solid #1d4ed8',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fas fa-school" style={{ fontSize: '0.75rem' }}></i>
            <span>Schools Directory</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '3rem 1rem', background: '#121215', borderRadius: '12px', border: '1px solid #222226' }}>
          <LogoPreloader fullScreen={false} size="md" />
        </div>
      ) : (
        <>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
            {[
              { label: 'Registered Schools', value: metrics?.totalSchools ?? 0, sub: `${(metrics?.totalLearners ?? 0).toLocaleString()} learners`, icon: 'fa-school', to: '/platform/operations/schools' },
              { label: 'Total Learners', value: (metrics?.totalLearners ?? 0).toLocaleString(), sub: `${metrics?.totalStaff ?? 0} teaching staff`, icon: 'fa-user-group', to: '/platform/operations/analytics' },
              { label: 'Healthy Schools (≥80%)', value: metrics?.healthyCount ?? 0, sub: 'Optimal sync status', icon: 'fa-circle-check', color: '#34d399', to: '/platform/operations/schools' },
              { label: 'Warning Status (60–79%)', value: metrics?.warningCount ?? 0, sub: 'Review needed', icon: 'fa-triangle-exclamation', color: '#fbbf24', to: '/platform/operations/schools' },
              { label: 'Critical Schools (<60%)', value: metrics?.criticalCount ?? 0, sub: 'Intervention required', icon: 'fa-circle-exclamation', color: '#f87171', to: '/platform/operations/schools' },
              { label: 'Active Subscriptions', value: metrics?.activeSubscriptions ?? 0, sub: `${metrics?.trialSubscriptions ?? 0} on trial`, icon: 'fa-receipt', to: '/platform/operations/subscriptions' },
              { label: 'Average Health', value: `${metrics?.avgHealthScore ?? 0}%`, sub: 'Across active directory', icon: 'fa-chart-line', to: '/platform/operations/analytics' },
              { label: 'Support Tickets', value: metrics?.openTickets ?? 0, sub: metrics?.openTickets > 0 ? 'Pending response' : 'Inbox clear', icon: 'fa-headset', color: metrics?.openTickets > 0 ? '#fbbf24' : '#34d399', to: '/platform/operations/support' },
            ].map((card, i) => (
              <div
                key={i}
                onClick={() => card.to && navigate(card.to)}
                style={{
                  padding: '1rem 1.15rem',
                  borderRadius: '10px',
                  background: '#121215',
                  border: '1px solid #222226',
                  cursor: card.to ? 'pointer' : 'default',
                  transition: 'border-color 0.15s ease, transform 0.15s ease'
                }}
                onMouseEnter={e => { if (card.to) { e.currentTarget.style.borderColor = '#38383f'; } }}
                onMouseLeave={e => { if (card.to) { e.currentTarget.style.borderColor = '#222226'; } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</span>
                  <i className={`fas ${card.icon}`} style={{ fontSize: '0.75rem', color: card.color || '#71717a' }}></i>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: card.color || '#fafafa', marginTop: '4px', letterSpacing: '-0.02em' }}>
                  {card.value}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '2px' }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Hub Shortcuts */}
          <div style={{
            background: '#121215',
            borderRadius: '10px',
            border: '1px solid #222226',
            padding: '0.95rem 1.25rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.85rem'
          }}>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fafafa' }}>
                Platform Operations Modules
              </div>
              <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '1px' }}>
                Quick jumps into administrative controls and registries
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <button
                onClick={() => navigate('/platform/operations/referrals')}
                style={{ padding: '0.4rem 0.75rem', borderRadius: '7px', background: '#18181c', border: '1px solid #27272a', color: '#d4d4d8', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-gift" style={{ color: '#f59e0b', fontSize: '0.75rem' }}></i>
                <span>Referrers</span>
              </button>
              <button
                onClick={() => navigate('/platform/operations/broadcasts')}
                style={{ padding: '0.4rem 0.75rem', borderRadius: '7px', background: '#18181c', border: '1px solid #27272a', color: '#d4d4d8', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-bullhorn" style={{ color: '#f97316', fontSize: '0.75rem' }}></i>
                <span>Broadcasts</span>
              </button>
              <button
                onClick={() => navigate('/platform/operations/ges-radar')}
                style={{ padding: '0.4rem 0.75rem', borderRadius: '7px', background: '#18181c', border: '1px solid #27272a', color: '#d4d4d8', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-satellite-dish" style={{ color: '#06b6d4', fontSize: '0.75rem' }}></i>
                <span>GES Radar</span>
              </button>
              <button
                onClick={() => navigate('/platform/operations/interventions')}
                style={{ padding: '0.4rem 0.75rem', borderRadius: '7px', background: '#18181c', border: '1px solid #27272a', color: '#d4d4d8', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-user-shield" style={{ color: '#818cf8', fontSize: '0.75rem' }}></i>
                <span>Interventions</span>
              </button>
              <button
                onClick={() => navigate('/platform/operations/calendar')}
                style={{ padding: '0.4rem 0.75rem', borderRadius: '7px', background: '#18181c', border: '1px solid #27272a', color: '#d4d4d8', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-calendar-alt" style={{ color: '#f472b6', fontSize: '0.75rem' }}></i>
                <span>Calendar</span>
              </button>
            </div>
          </div>

          {/* Schools Table Card */}
          <div style={{ background: '#121215', borderRadius: '10px', border: '1px solid #222226', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1f1f23', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#fafafa' }}>
                  School Health Telemetry Monitor
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '2px' }}>
                  Live scores entry rates and operational status by school
                </div>
              </div>
              <button
                onClick={() => navigate('/platform/operations/schools')}
                style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>Directory</span>
                <i className="fas fa-arrow-right" style={{ fontSize: '0.65rem' }}></i>
              </button>
            </div>

            {schools.length === 0 ? (
              <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#71717a' }}>
                <i className="fas fa-school" style={{ fontSize: '2rem', marginBottom: '0.75rem', color: '#3f3f46', display: 'block' }}></i>
                <div style={{ color: '#d4d4d8', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.95rem' }}>No Schools in Database</div>
                <div style={{ fontSize: '0.8rem', maxWidth: '380px', margin: '0 auto 1rem auto' }}>
                  Schools register through the onboarding flow. You can load simulated school data to inspect the monitor.
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => navigate('/platform/operations/schools')}
                    style={{ padding: '0.45rem 0.95rem', borderRadius: '7px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    Schools Directory
                  </button>
                  <button
                    onClick={handleSeedDemoSchool}
                    style={{ padding: '0.45rem 0.95rem', borderRadius: '7px', background: '#18181c', color: '#d4d4d8', border: '1px solid #27272a', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    Load Demo Data
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#0e0e11', borderBottom: '1px solid #1f1f23', color: '#71717a', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>School</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Region</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Health Score</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Learners</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Score Entry</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Billing</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Reports</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schools.map(s => {
                      const badge = getHealthBadge(s.health?.healthStatus, s.health?.totalScore);
                      const scorePct = s.total_scores_count > 0
                        ? Math.round((s.submitted_scores_count / s.total_scores_count) * 100)
                        : 0;
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #18181b', color: '#e4e4e7' }}>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ fontWeight: 600, color: '#fafafa', fontSize: '0.86rem' }}>{s.name}</div>
                            <div style={{ fontSize: '0.72rem', color: '#71717a' }}>HT: {s.headteacher}</div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: '#d4d4d8' }}>
                            <div>{s.region}</div>
                            <div style={{ fontSize: '0.7rem', color: '#71717a' }}>{s.circuit}</div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{ padding: '0.2rem 0.55rem', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 600, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                              {badge.label}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#38bdf8' }}>
                            {s.learners_count}
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ color: scorePct >= 80 ? '#34d399' : scorePct >= 50 ? '#fbbf24' : '#f87171', fontWeight: 600 }}>
                              {s.submitted_scores_count} / {s.total_scores_count} ({scorePct}%)
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{ color: s.subscription_status === 'Active' ? '#34d399' : s.subscription_status === 'Trial' ? '#fbbf24' : '#f87171', fontWeight: 500 }}>
                              {s.subscription_status} ({s.subscription_tier})
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ color: s.reports_released ? '#34d399' : '#71717a', fontWeight: 500 }}>
                              {s.reports_released ? 'Released' : 'Locked'}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#71717a' }}>
                              {s.reports_count} cards
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            <button
                              onClick={() => navigate(`/platform/operations/schools/${s.id}`)}
                              style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', background: '#1c1c22', border: '1px solid #27272a', color: '#d4d4d8', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Activity Stream */}
          <div style={{
            background: '#121215',
            borderRadius: '10px',
            border: '1px solid #222226',
            padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-tower-broadcast" style={{ color: '#3b82f6', fontSize: '0.82rem' }}></i>
                <h3 style={{ margin: 0, fontSize: '0.88rem', color: '#fafafa', fontWeight: 600 }}>
                  Recent Operations Feed
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#71717a' }}>
                {notifications.length} alerts logged
              </span>
            </div>

            {notifications.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#71717a', fontSize: '0.8rem' }}>
                No active notifications in queue. System operations running normally.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {notifications.slice(0, 6).map((notif, index) => (
                  <div
                    key={notif.id || index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '7px',
                      background: notif.is_read ? '#0e0e11' : '#17171c',
                      border: '1px solid #1f1f23',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: notif.severity === 'critical' ? '#ef4444' : notif.severity === 'warning' ? '#f59e0b' : '#3b82f6',
                        flexShrink: 0
                      }}></div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {notif.title}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {notif.body}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#52525b', flexShrink: 0 }}>
                      {new Date(notif.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default OperationsDashboard;
