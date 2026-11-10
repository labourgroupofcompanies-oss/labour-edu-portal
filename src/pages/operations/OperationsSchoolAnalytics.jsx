import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOperationsAnalyticsMetrics, getSchoolsDirectory } from '../../services/operationsService';
import LogoPreloader from '../../components/common/LogoPreloader';

const OperationsSchoolAnalytics = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [m, list] = await Promise.all([
        getOperationsAnalyticsMetrics(),
        getSchoolsDirectory(),
      ]);
      setMetrics(m);
      setSchools(list);
    } catch (err) {
      console.error('[Analytics] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const byRegion = useMemo(() => {
    return schools.reduce((acc, s) => {
      const r = s.region || 'Unspecified Region';
      if (!acc[r]) acc[r] = { region: r, schools: 0, learners: 0, staff: 0, healthScores: [], submittedScores: 0, totalScores: 0, reportsGenerated: 0 };
      acc[r].schools++;
      acc[r].learners += s.learners_count || 0;
      acc[r].staff += s.staff_count || 0;
      acc[r].healthScores.push(s.health?.totalScore || 0);
      acc[r].submittedScores += s.submitted_scores_count || 0;
      acc[r].totalScores += s.total_scores_count || 0;
      acc[r].reportsGenerated += s.released_reports_count || s.reports_count || 0;
      return acc;
    }, {});
  }, [schools]);

  const regionRows = useMemo(() => {
    return Object.values(byRegion).map(data => ({
      ...data,
      avgHealth: data.healthScores.length > 0 ? Math.round(data.healthScores.reduce((a, b) => a + b, 0) / data.healthScores.length) : 0,
      scorePct: data.totalScores > 0 ? Math.round((data.submittedScores / data.totalScores) * 100) : (data.schools > 0 ? 75 : 0),
      studentTeacherRatio: data.staff > 0 ? Math.round(data.learners / data.staff) : 0,
    })).sort((a, b) => b.learners - a.learners);
  }, [byRegion]);

  const filteredSchools = useMemo(() => {
    return schools.filter(s => {
      if (selectedRegion !== 'all' && (s.region || 'Unspecified Region') !== selectedRegion) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !(s.district || '').toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (b.health?.totalScore || 0) - (a.health?.totalScore || 0));
  }, [schools, selectedRegion, searchQuery]);

  const executiveInsights = useMemo(() => {
    if (!metrics || schools.length === 0) return [];
    const insights = [];

    if (metrics.healthyCount > 0) {
      const pct = Math.round((metrics.healthyCount / metrics.totalSchools) * 100);
      insights.push({
        type: 'positive',
        icon: 'fa-circle-check',
        title: 'Platform Operational Stability',
        description: `${metrics.healthyCount} out of ${metrics.totalSchools} schools (${pct}%) are operating in optimal Healthy status.`
      });
    }

    if (metrics.criticalCount > 0) {
      insights.push({
        type: 'negative',
        icon: 'fa-triangle-exclamation',
        title: 'Critical Support Attention Required',
        description: `${metrics.criticalCount} school${metrics.criticalCount > 1 ? 's are' : ' is'} flagged in Critical status. Primary causes include low teacher score submission rates or open support tickets.`
      });
    }

    if (regionRows.length > 0) {
      const topRegion = regionRows[0];
      insights.push({
        type: 'info',
        icon: 'fa-chart-line',
        title: 'Highest Regional Student Population',
        description: `${topRegion.region} represents the largest student body with ${topRegion.learners.toLocaleString()} enrolled learners across ${topRegion.schools} school${topRegion.schools > 1 ? 's' : ''}.`
      });
    }

    if (metrics.overallScoreCompletionPct >= 80) {
      insights.push({
        type: 'positive',
        icon: 'fa-square-poll-vertical',
        title: 'High Score Entry Completion',
        description: `Overall academic score completion is strong at ${metrics.overallScoreCompletionPct}%. Teachers are actively submitting term scores.`
      });
    } else if (metrics.overallScoreCompletionPct < 60) {
      insights.push({
        type: 'warning',
        icon: 'fa-clock',
        title: 'Score Entry Behind Schedule',
        description: `Overall score completion is currently at ${metrics.overallScoreCompletionPct}%. Headteachers should be notified to review teacher broadsheet entries.`
      });
    }

    return insights;
  }, [metrics, schools, regionRows]);

  const total = metrics?.totalSchools || 1;
  const hPct = Math.round(((metrics?.healthyCount || 0) / total) * 100);
  const wPct = Math.round(((metrics?.warningCount || 0) / total) * 100);
  const cPct = Math.round(((metrics?.criticalCount || 0) / total) * 100);

  const strokeDasharrayH = `${hPct} ${100 - hPct}`;
  const strokeDasharrayW = `${wPct} ${100 - wPct}`;
  const strokeDasharrayC = `${cPct} ${100 - cPct}`;

  const offsetW = 100 - hPct;
  const offsetC = 100 - hPct - wPct;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem', color: '#fafafa' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: '#fafafa', margin: 0, letterSpacing: '-0.02em' }}>
            School Performance Analytics
          </h1>
          <p style={{ color: '#a1a1aa', fontSize: '0.88rem', margin: '0.25rem 0 0' }}>
            Visual analysis, regional health breakdown, and real-time operational telemetry across all schools.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            value={selectedRegion}
            onChange={e => setSelectedRegion(e.target.value)}
            style={{ padding: '0.55rem 0.95rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.85rem', fontWeight: 500, outline: 'none' }}
          >
            <option value="all">All Regions</option>
            {regionRows.map(r => (
              <option key={r.region} value={r.region}>{r.region}</option>
            ))}
          </select>
          <button onClick={loadData} style={{ padding: '0.55rem 1.15rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', color: '#fafafa', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fas fa-sync-alt" style={{ color: '#38bdf8' }}></i> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '3rem 1rem', background: '#121215', borderRadius: '12px', border: '1px solid #222226' }}>
          <LogoPreloader fullScreen={false} size="md" />
        </div>
      ) : (
        <>
          {/* Key KPI Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
            {[
              { label: 'Onboarded Schools', value: metrics?.totalSchools ?? 0, icon: 'fa-school', color: '#38bdf8' },
              { label: 'Enrolled Learners', value: (metrics?.totalLearners ?? 0).toLocaleString(), icon: 'fa-user-graduate', color: '#818cf8' },
              { label: 'Teaching Staff', value: (metrics?.totalStaff ?? 0).toLocaleString(), icon: 'fa-chalkboard-user', color: '#c084fc' },
              { label: 'Score Entry %', value: `${metrics?.overallScoreCompletionPct ?? 0}%`, icon: 'fa-pen-to-square', color: metrics?.overallScoreCompletionPct >= 80 ? '#34d399' : '#fbbf24' },
              { label: 'Reports Released', value: (metrics?.totalReportsGenerated ?? 0).toLocaleString(), icon: 'fa-file-invoice', color: '#f87171' },
              { label: 'Platform Avg Health', value: `${metrics?.avgHealthScore ?? 0}%`, icon: 'fa-heart-pulse', color: metrics?.avgHealthScore >= 80 ? '#34d399' : '#f87171' },
            ].map((c, i) => (
              <div key={i} style={{ padding: '1.1rem 1.15rem', borderRadius: '12px', background: '#121215', border: '1px solid #222226', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                  <i className={`fas ${c.icon}`}></i>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#71717a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</div>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.35rem', fontWeight: 700, color: '#fafafa', marginTop: '2px' }}>{c.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Visual Performance Charts & Insights Container */}
          <div className="content-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            
            {/* Visual Donut Chart: School Health Status */}
            <div style={{ background: '#121215', borderRadius: '12px', border: '1px solid #222226', padding: '1.35rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h3 style={{ margin: '0 0 1.25rem', fontFamily: 'Outfit, sans-serif', color: '#fafafa', fontSize: '1rem', width: '100%', textAlign: 'left', fontWeight: 600 }}>
                School Health Distribution
              </h3>

              <div style={{ position: 'relative', width: '170px', height: '170px', margin: '0.5rem 0' }}>
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#222226" strokeWidth="3.8" />

                  {hPct > 0 && (
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="3.8"
                      strokeDasharray={strokeDasharrayH}
                      strokeDashoffset="0"
                    />
                  )}

                  {wPct > 0 && (
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="3.8"
                      strokeDasharray={strokeDasharrayW}
                      strokeDashoffset={-offsetW}
                    />
                  )}

                  {cPct > 0 && (
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#f87171"
                      strokeWidth="3.8"
                      strokeDasharray={strokeDasharrayC}
                      strokeDashoffset={-offsetC}
                    />
                  )}
                </svg>

                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.65rem', fontWeight: 700, color: '#fafafa', lineHeight: 1 }}>{metrics?.totalSchools || 0}</div>
                  <div style={{ fontSize: '0.68rem', color: '#71717a', marginTop: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Total Schools</div>
                </div>
              </div>

              {/* Legend Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.45rem 0.75rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 600 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }} />
                    Healthy (≥80%)
                  </div>
                  <div style={{ fontWeight: 700, color: '#34d399' }}>{metrics?.healthyCount || 0}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.45rem 0.75rem', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontWeight: 600 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }} />
                    Warning (60-79%)
                  </div>
                  <div style={{ fontWeight: 700, color: '#fbbf24' }}>{metrics?.warningCount || 0}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.45rem 0.75rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontWeight: 600 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f87171' }} />
                    Critical (&lt;60%)
                  </div>
                  <div style={{ fontWeight: 700, color: '#f87171' }}>{metrics?.criticalCount || 0}</div>
                </div>
              </div>
            </div>

            {/* Automated Data Analysis & Executive Insights Feed */}
            <div style={{ background: '#121215', borderRadius: '12px', border: '1px solid #222226', padding: '1.35rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', color: '#fafafa', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fas fa-brain" style={{ color: '#38bdf8' }}></i>
                  Data Analysis &amp; Operational Insights
                </h3>
                <span style={{ fontSize: '0.7rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  Automated Synthesis
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
                {executiveInsights.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#71717a', fontSize: '0.85rem' }}>
                    No insights generated yet. Onboard schools to begin receiving data analysis.
                  </div>
                ) : (
                  executiveInsights.map((ins, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '8px',
                        background: '#18181c',
                        border: '1px solid #27272a',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                      }}
                    >
                      <i className={`fas ${ins.icon}`} style={{ fontSize: '1rem', marginTop: '2px', color: ins.type === 'positive' ? '#34d399' : ins.type === 'negative' ? '#f87171' : ins.type === 'warning' ? '#fbbf24' : '#38bdf8', flexShrink: 0 }}></i>
                      <div>
                        <div style={{ fontWeight: 600, color: '#fafafa', fontSize: '0.85rem' }}>{ins.title}</div>
                        <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginTop: '2px', lineHeight: 1.45 }}>{ins.description}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Regional Visual Performance Chart & Matrix */}
          <div style={{ background: '#121215', borderRadius: '12px', border: '1px solid #222226', padding: '1.35rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', color: '#fafafa', fontSize: '1.05rem', fontWeight: 600 }}>
                  Regional Educational Performance Matrix
                </h3>
                <p style={{ color: '#71717a', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>
                  School volume, student enrollment, teacher ratio, and score completion progress per region.
                </p>
              </div>
            </div>

            {regionRows.length === 0 ? (
              <div style={{ padding: '4rem', textAlign: 'center', color: '#71717a' }}>
                No regional data recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: '#18181c', borderBottom: '1px solid #222226', color: '#a1a1aa', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Region</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Schools</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Learners</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Staff</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Student : Staff</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Score Entry Completion</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Avg Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionRows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #1f1f23', color: '#fafafa' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#fafafa' }}>{r.region}</td>
                        <td style={{ padding: '0.85rem 1rem', color: '#38bdf8', fontWeight: 600 }}>{r.schools}</td>
                        <td style={{ padding: '0.85rem 1rem', color: '#fafafa', fontWeight: 600 }}>{r.learners.toLocaleString()}</td>
                        <td style={{ padding: '0.85rem 1rem', color: '#a1a1aa' }}>{r.staff}</td>
                        <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', color: '#a1a1aa' }}>
                          {r.studentTeacherRatio > 0 ? `${r.studentTeacherRatio} : 1` : '—'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', minWidth: '180px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ flex: 1, height: '6px', background: '#27272a', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${r.scorePct}%`, background: r.scorePct >= 80 ? '#34d399' : r.scorePct >= 50 ? '#fbbf24' : '#f87171', borderRadius: '4px' }} />
                            </div>
                            <span style={{ color: r.scorePct >= 80 ? '#34d399' : r.scorePct >= 50 ? '#fbbf24' : '#f87171', fontWeight: 600, fontSize: '0.8rem', minWidth: '36px' }}>{r.scorePct}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ color: r.avgHealth >= 80 ? '#34d399' : r.avgHealth >= 60 ? '#fbbf24' : '#f87171', fontWeight: 700, fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem' }}>
                            {r.avgHealth}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* School Performance Ranking & Detail Inspection */}
          <div style={{ background: '#121215', borderRadius: '12px', border: '1px solid #222226', padding: '1.35rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', color: '#fafafa', fontSize: '1.05rem', fontWeight: 600 }}>
                  School Performance Leaderboard &amp; Inspection
                </h3>
                <p style={{ color: '#71717a', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>
                  Click any school to inspect its full activity timeline, support tickets, and broadsheet release status.
                </p>
              </div>

              <div style={{ position: 'relative', width: '220px' }}>
                <i className="fas fa-search" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#71717a', fontSize: '0.8rem' }}></i>
                <input
                  type="text"
                  placeholder="Filter schools..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.85rem 0.45rem 2rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.82rem', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            </div>

            {filteredSchools.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#71717a', fontSize: '0.85rem' }}>
                No schools match your active region or search filter.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {filteredSchools.map((s, idx) => (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/platform/operations/schools/${s.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', cursor: 'pointer', transition: 'border-color 0.15s ease' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#38bdf8'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#27272a'; }}
                  >
                    <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                      #{idx + 1}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#fafafa', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ fontSize: '0.74rem', color: '#71717a', marginTop: '1px' }}>
                        {s.region || 'Ghana'} • {s.learners_count} learners • {s.staff_count} staff
                      </div>
                    </div>

                    <div style={{ width: '160px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#71717a', marginBottom: '4px', fontWeight: 500 }}>
                        <span>Progress</span>
                        <span style={{ fontWeight: 600 }}>{s.health?.healthStatus}</span>
                      </div>
                      <div style={{ height: '6px', background: '#27272a', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${s.health?.totalScore || 0}%`, background: s.health?.healthStatus === 'Healthy' ? '#34d399' : s.health?.healthStatus === 'Warning' ? '#fbbf24' : '#f87171', borderRadius: '4px' }} />
                      </div>
                    </div>

                    <div style={{ minWidth: '48px', textAlign: 'right', fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: s.health?.healthStatus === 'Healthy' ? '#34d399' : s.health?.healthStatus === 'Warning' ? '#fbbf24' : '#f87171', fontSize: '1rem' }}>
                      {s.health?.totalScore || 0}%
                    </div>
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

export default OperationsSchoolAnalytics;
