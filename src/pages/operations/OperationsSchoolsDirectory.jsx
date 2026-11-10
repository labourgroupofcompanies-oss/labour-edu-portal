import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSchoolsDirectory } from '../../services/operationsService';
import LogoPreloader from '../../components/common/LogoPreloader';
import { useAuth } from '../../store/AuthContext';

const OperationsSchoolsDirectory = () => {
  const navigate = useNavigate();
  const { startImpersonation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schools, setSchools] = useState([]);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getSchoolsDirectory();
      setSchools(data || []);
    } catch (err) {
      console.error('[OperationsSchoolsDirectory] Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = () => { loadData(true); };

  const regions = ['all', ...Array.from(new Set(schools.map(s => s.region).filter(Boolean)))];

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

  const filteredSchools = schools.filter(s => {
    const q = search.toLowerCase();
    const matchesSearch = !search ||
      s.name?.toLowerCase().includes(q) ||
      s.headteacher?.toLowerCase().includes(q) ||
      s.circuit?.toLowerCase().includes(q) ||
      s.district?.toLowerCase().includes(q);
    const matchesRegion = regionFilter === 'all' || s.region === regionFilter;
    const matchesHealth = healthFilter === 'all' || s.health?.healthStatus === healthFilter;
    return matchesSearch && matchesRegion && matchesHealth;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#fafafa' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1.25rem', borderBottom: '1px solid #1f1f23' }}>
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#fafafa', margin: 0, letterSpacing: '-0.02em' }}>
            Schools Directory
          </h1>
          <p style={{ color: '#a1a1aa', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
            {loading ? 'Fetching schools…' : `${filteredSchools.length} of ${schools.length} schools active in registry`}
          </p>
        </div>

        <div className="filter-bar" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search school, headteacher, circuit…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '0.45rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', flex: '1 1 200px', minWidth: '180px', outline: 'none' }}
          />
          <select
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            style={{ padding: '0.45rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', fontWeight: 600, outline: 'none' }}
          >
            {regions.map(r => (
              <option key={r} value={r}>{r === 'all' ? 'All Regions' : r}</option>
            ))}
          </select>
          <select
            value={healthFilter}
            onChange={e => setHealthFilter(e.target.value)}
            style={{ padding: '0.45rem 0.8rem', borderRadius: '8px', background: '#121215', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', fontWeight: 600, outline: 'none' }}
          >
            <option value="all">All Health States</option>
            <option value="Healthy">Healthy (≥80%)</option>
            <option value="Warning">Warning (60–79%)</option>
            <option value="Critical">Critical (&lt;60%)</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', color: '#d4d4d8', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <i className={`fas fa-rotate ${refreshing ? 'fa-spin' : ''}`} style={{ fontSize: '0.75rem' }}></i>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Directory Table */}
      <div style={{ background: '#121215', borderRadius: '10px', border: '1px solid #222226', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem 0' }}>
            <LogoPreloader fullScreen={false} size="sm" />
          </div>
        ) : filteredSchools.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#71717a' }}>
            <i className="fas fa-school-circle-xmark" style={{ fontSize: '2rem', marginBottom: '0.75rem', color: '#3f3f46', display: 'block' }}></i>
            <h3 style={{ color: '#d4d4d8', margin: '0 0 0.35rem', fontSize: '0.95rem', fontWeight: 600 }}>No Schools Match Filter</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#71717a' }}>
              {schools.length === 0
                ? 'Registered schools will automatically appear here once onboarded.'
                : 'Try clearing your search query or adjusting your filters.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#0e0e11', borderBottom: '1px solid #1f1f23', color: '#71717a', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '0.8rem 1rem', fontWeight: 600 }}>School Profile</th>
                  <th style={{ padding: '0.8rem 1rem', fontWeight: 600 }}>Circuit / Region</th>
                  <th style={{ padding: '0.8rem 1rem', fontWeight: 600 }}>Health Score</th>
                  <th style={{ padding: '0.8rem 1rem', fontWeight: 600 }}>Learners / Staff</th>
                  <th style={{ padding: '0.8rem 1rem', fontWeight: 600 }}>Score Entry</th>
                  <th style={{ padding: '0.8rem 1rem', fontWeight: 600 }}>Subscription</th>
                  <th style={{ padding: '0.8rem 1rem', fontWeight: 600 }}>Mode</th>
                  <th style={{ padding: '0.8rem 1rem', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchools.map(s => {
                  const badge = getHealthBadge(s.health?.healthStatus, s.health?.totalScore);
                  const scorePct = s.total_scores_count > 0
                    ? Math.round((s.submitted_scores_count / s.total_scores_count) * 100)
                    : null;
                  return (
                    <tr
                      key={s.id}
                      style={{ borderBottom: '1px solid #18181b', color: '#e4e4e7', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#15151a'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#fafafa', fontSize: '0.88rem' }}>{s.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '2px' }}>
                          HT: {s.headteacher}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ color: '#d4d4d8', fontWeight: 500 }}>{s.region}</div>
                        <div style={{ fontSize: '0.7rem', color: '#71717a' }}>{s.circuit}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ padding: '0.2rem 0.55rem', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 600, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#fafafa' }}>{s.learners_count} Learners</div>
                        <div style={{ fontSize: '0.7rem', color: '#71717a' }}>{s.staff_count} Teachers</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {scorePct !== null ? (
                          <div>
                            <div style={{ fontWeight: 600, color: scorePct >= 80 ? '#34d399' : scorePct >= 50 ? '#fbbf24' : '#f87171' }}>
                              {scorePct}%
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#71717a' }}>
                              {s.submitted_scores_count}/{s.total_scores_count}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#71717a', fontSize: '0.75rem' }}>No data</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ color: s.subscription_status === 'Active' ? '#34d399' : s.subscription_status === 'Trial' ? '#38bdf8' : '#f87171', fontWeight: 600 }}>
                          {s.subscription_status || 'Active'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#a1a1aa', marginTop: '1px' }}>
                          GH₵ {Number(s.wallet_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          padding: '0.18rem 0.5rem',
                          borderRadius: '5px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          background: s.is_read_only ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: s.is_read_only ? '#f87171' : '#34d399',
                          border: `1px solid ${s.is_read_only ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`
                        }}>
                          {s.is_read_only ? 'Read Only' : 'Full Edit'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={async () => {
                              if (window.confirm(`Launch Live Remote Access as Headteacher for "${s.name}"?`)) {
                                await startImpersonation(s.id, s.name);
                                navigate('/');
                              }
                            }}
                            title="Access school portal in remote headteacher mode"
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
                            <span>Remote</span>
                          </button>
                          <button
                            onClick={() => navigate(`/platform/operations/schools/${s.id}`)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              background: '#2563eb',
                              border: 'none',
                              color: '#FFFFFF',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Inspect
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationsSchoolsDirectory;
