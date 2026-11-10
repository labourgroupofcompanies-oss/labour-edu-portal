import React, { useState, useEffect, useCallback } from 'react';
import { generateMockSandboxData, clearSandboxData, getSandboxDataStore } from '../../services/developerService';
import LogoPreloader from '../../components/common/LogoPreloader';

const SandboxEnvironment = () => {
  const [sandboxData, setSandboxData] = useState(null);
  const [existingRecords, setExistingRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [schoolName, setSchoolName] = useState('Accra Demonstration Basic School');
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState('success');

  const loadExistingData = useCallback(async () => {
    setLoadingExisting(true);
    try {
      const records = await getSandboxDataStore();
      setExistingRecords(records);
    } catch (err) {
      console.warn('[Sandbox] Could not load existing data:', err);
    } finally {
      setLoadingExisting(false);
    }
  }, []);

  useEffect(() => { loadExistingData(); }, [loadExistingData]);

  const handleGenerateSandbox = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg('');

    try {
      const result = await generateMockSandboxData(schoolName);
      setSandboxData(result);
      setStatusMsg(`✓ Sandbox dataset generated for "${schoolName}" — ${result.mockLearners.length} learners, ${result.mockTeachers.length} teachers, ${result.mockScores.length} score entries.`);
      setStatusType('success');
      await loadExistingData();
    } catch (err) {
      setStatusMsg(`✕ Error generating sandbox data: ${err.message}`);
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleClearSandbox = async () => {
    if (!window.confirm('Are you sure you want to PURGE ALL sandbox data?\n\nProduction database will remain completely unaffected.')) return;
    setLoading(true);
    try {
      await clearSandboxData();
      setSandboxData(null);
      setExistingRecords([]);
      setStatusMsg('✓ Sandbox data store purged successfully. Production data is unaffected.');
      setStatusType('success');
    } catch (err) {
      setStatusMsg(`✕ Error clearing sandbox data: ${err.message}`);
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Title */}
      <div>
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 800, color: 'white', margin: 0 }}>
          Sandbox Testing Environment
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '0.25rem 0 0' }}>
          Generate realistic Ghanaian school rosters for safe API integration testing. Sandbox data is stored in a separate <code style={{ color: '#38bdf8' }}>platform_sandbox_data</code> table and never touches production records.
        </p>
      </div>

      {/* Production Isolation Banner */}
      <div style={{ padding: '1rem 1.5rem', borderRadius: '14px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <i className="fas fa-shield-halved" style={{ fontSize: '1.4rem', flexShrink: 0 }}></i>
        <div style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>
          <strong>PRODUCTION DATA PROTECTION:</strong> All sandbox operations target the isolated <code>platform_sandbox_data</code> table. Production learner records, broadsheets, scores, and financial receipts are never altered.
        </div>
      </div>

      {/* Generator Card */}
      <div style={{ background: '#121215', borderRadius: '12px', border: '1px solid #222226', padding: '1.5rem' }}>
        <h3 style={{ fontFamily: 'Outfit, sans-serif', margin: '0 0 1.25rem', color: '#fafafa', fontSize: '1.1rem', fontWeight: 700 }}>Mock School Data Generator</h3>
        <form onSubmit={handleGenerateSandbox} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.4rem', fontWeight: 600 }}>Sandbox School Name</label>
            <input
              type="text"
              required
              value={schoolName}
              onChange={e => setSchoolName(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.88rem' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#ffffff', fontWeight: 600, fontSize: '0.85rem', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
            Generate Mock Data
          </button>
          <button
            type="button"
            onClick={handleClearSandbox}
            disabled={loading || existingRecords.length === 0}
            style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontWeight: 600, fontSize: '0.85rem', cursor: (loading || existingRecords.length === 0) ? 'not-allowed' : 'pointer', opacity: existingRecords.length === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <i className="fas fa-trash-can"></i>
            Purge All ({existingRecords.length})
          </button>
        </form>

        {statusMsg && (
          <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', borderRadius: '8px', background: statusType === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${statusType === 'success' ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}`, color: statusType === 'success' ? '#34d399' : '#f87171', fontSize: '0.85rem', fontWeight: 500 }}>
            {statusMsg}
          </div>
        )}
      </div>

      {/* Existing Sandbox Records */}
      <div style={{ background: '#121215', borderRadius: '12px', border: '1px solid #222226', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', margin: 0, color: '#fafafa', fontSize: '1.05rem', fontWeight: 700 }}>
            Sandbox Data Store
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#71717a' }}>
            {existingRecords.length} record{existingRecords.length !== 1 ? 's' : ''} in database
          </span>
        </div>

        {loadingExisting ? (
          <div style={{ padding: '2rem 0' }}>
            <LogoPreloader fullScreen={false} size="sm" />
          </div>
        ) : existingRecords.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#71717a' }}>
            <i className="fas fa-flask" style={{ fontSize: '2rem', marginBottom: '0.75rem', color: '#3f3f46' }}></i>
            <div style={{ color: '#fafafa', fontWeight: 600 }}>Sandbox Store is Empty</div>
            <div style={{ fontSize: '0.82rem', marginTop: '0.5rem', color: '#a1a1aa' }}>Use the generator above to create a mock school dataset for API testing.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {existingRecords.map(rec => (
              <div key={rec.id} style={{ background: '#18181c', padding: '1rem', borderRadius: '8px', border: '1px solid #222226' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>
                    {rec.entity_type}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#71717a' }}>
                    {new Date(rec.created_at).toLocaleDateString('en-GH', { dateStyle: 'short' })}
                  </span>
                </div>
                <pre style={{ background: '#0d0d10', border: '1px solid #222226', padding: '0.75rem', borderRadius: '6px', color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.72rem', margin: 0, overflowX: 'auto', maxHeight: '140px', overflow: 'auto' }}>
                  {JSON.stringify(rec.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Newly Generated Preview */}
      {sandboxData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          <div style={{ background: '#121215', borderRadius: '12px', border: '1px solid #222226', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontFamily: 'Outfit, sans-serif', color: '#fafafa', fontSize: '0.98rem', fontWeight: 700 }}>
              Generated Learners Roster
            </h3>
            <pre style={{ background: '#0d0d10', border: '1px solid #222226', padding: '1rem', borderRadius: '8px', color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.8rem', margin: 0, overflowX: 'auto' }}>
              {JSON.stringify(sandboxData.mockLearners, null, 2)}
            </pre>
          </div>
          <div style={{ background: '#121215', borderRadius: '12px', border: '1px solid #222226', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontFamily: 'Outfit, sans-serif', color: '#fafafa', fontSize: '0.98rem', fontWeight: 700 }}>
              Generated Assessment Scores
            </h3>
            <pre style={{ background: '#0d0d10', border: '1px solid #222226', padding: '1rem', borderRadius: '8px', color: '#a78bfa', fontFamily: 'monospace', fontSize: '0.8rem', margin: 0, overflowX: 'auto' }}>
              {JSON.stringify(sandboxData.mockScores, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default SandboxEnvironment;
