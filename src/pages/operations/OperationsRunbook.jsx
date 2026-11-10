import React, { useState } from 'react';

const RUNBOOK_SECTIONS = [
  {
    id: 'architecture',
    title: '1. Architecture & Tech Stack',
    icon: 'fa-server',
    color: '#38bdf8',
    content: (
      <div>
        <p style={{ color: '#a1a1aa', lineHeight: '1.6', marginBottom: '1.25rem' }}>
          Labour Educational Report System is an <strong style={{ color: '#fafafa' }}>offline-first, multi-tenant Progressive Web App (PWA)</strong> engineered for basic schools in Ghana to record scores, manage learners, compile terminal reports, and sync securely with the cloud.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', background: '#18181c', borderRadius: '8px', border: '1px solid #27272a' }}>
            <strong style={{ color: '#fafafa' }}>Frontend / Client</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#71717a' }}>React 18, Vite, Workbox PWA, FontAwesome</p>
          </div>
          <div style={{ padding: '1rem', background: '#18181c', borderRadius: '8px', border: '1px solid #27272a' }}>
            <strong style={{ color: '#fafafa' }}>Local IndexedDB</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#71717a' }}>Dexie.js (LabourEduReportSystem_v1)</p>
          </div>
          <div style={{ padding: '1rem', background: '#18181c', borderRadius: '8px', border: '1px solid #27272a' }}>
            <strong style={{ color: '#fafafa' }}>Cloud Database</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#71717a' }}>Supabase (PostgreSQL 15 + RLS)</p>
          </div>
          <div style={{ padding: '1rem', background: '#18181c', borderRadius: '8px', border: '1px solid #27272a' }}>
            <strong style={{ color: '#fafafa' }}>Payments & Billing</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#71717a' }}>Paystack Webhook & Inline Checkout</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'isolation',
    title: '2. Multi-Tenant School Isolation',
    icon: 'fa-shield-halved',
    color: '#34d399',
    content: (
      <div>
        <p style={{ color: '#a1a1aa', lineHeight: '1.6', marginBottom: '1.25rem' }}>
          All tables in Supabase and IndexedDB are shared across multiple schools on the same browser origin. <strong style={{ color: '#fafafa' }}>Every record carries a <code>schoolId</code> / <code>school_id</code> foreign key.</strong>
        </p>
        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '1rem 1.25rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', color: '#34d399', fontWeight: 600 }}>The 3 Tenancy Isolation Rules</h4>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#a1a1aa', fontSize: '0.875rem', lineHeight: '1.6' }}>
            <li><strong style={{ color: '#fafafa' }}>Supabase Row-Level Security:</strong> <code>WITH CHECK (school_id = public.jwt_school_id())</code> rejects foreign insertions with HTTP 403.</li>
            <li><strong style={{ color: '#fafafa' }}>Frontend Scoping:</strong> All live Dexie queries must strictly filter by active <code>user.schoolId</code>.</li>
            <li><strong style={{ color: '#fafafa' }}>Sync Firewall:</strong> <code>syncEngine.js</code> drops score rows or learners pointing outside the active tenant context.</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'sync',
    title: '3. Offline Sync Engine & Outbox',
    icon: 'fa-arrows-rotate',
    color: '#fbbf24',
    content: (
      <div>
        <p style={{ color: '#a1a1aa', lineHeight: '1.6', marginBottom: '1.25rem' }}>
          The bidirectional sync engine ensures teachers can enter marks, take attendance, and register learners offline with zero data loss.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: '#18181c', borderRadius: '8px', border: '1px solid #27272a' }}>
            <strong style={{ color: '#fbbf24' }}>Outbound Sync (Local → Supabase)</strong>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#a1a1aa', lineHeight: '1.5' }}>
              Mutations are placed into <code>db.outbox</code>. When online, <code>drainOutbox()</code> resolves integer IDs to UUIDs and executes operations. Toxic 403 items are auto-discarded.
            </p>
          </div>
          <div style={{ padding: '1rem', background: '#18181c', borderRadius: '8px', border: '1px solid #27272a' }}>
            <strong style={{ color: '#38bdf8' }}>Inbound Sync (Supabase → Local)</strong>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#a1a1aa', lineHeight: '1.5' }}>
              <code>syncDown.js</code> pulls updated cloud state. Learner reconciliation strictly matches within the active school and respects local offline dirty edits.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'troubleshooting',
    title: '4. Troubleshooting & Playbooks',
    icon: 'fa-wrench',
    color: '#f87171',
    content: (
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: '#18181c', borderRadius: '8px', border: '1px solid #27272a' }}>
            <strong style={{ color: '#f87171' }}>Issue: 403 Forbidden / RLS Loop on Sync</strong>
            <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.85rem', color: '#a1a1aa' }}>
              Occurs when an outbox item contains data from another school context.
            </p>
            <span style={{ fontSize: '0.8rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontFamily: 'monospace' }}>
              Auto-purged on startup by SyncEngineProvider. Or run: await db.outbox.clear();
            </span>
          </div>

          <div style={{ padding: '1rem', background: '#18181c', borderRadius: '8px', border: '1px solid #27272a' }}>
            <strong style={{ color: '#c084fc' }}>Issue: Stale Cache on Shared Machine</strong>
            <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.85rem', color: '#a1a1aa' }}>
              Open DevTools (F12) → Application → Storage → Click <strong style={{ color: '#fafafa' }}>"Clear site data"</strong> and refresh.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'schema',
    title: '5. Core Database Tables',
    icon: 'fa-table',
    color: '#a78bfa',
    content: (
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: '580px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#18181c', textAlign: 'left', color: '#a1a1aa', borderBottom: '1px solid #222226' }}>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Local Store</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Supabase Table</th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Primary Responsibility</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #1f1f23' }}>
              <td style={{ padding: '0.75rem 1rem' }}><code style={{ color: '#38bdf8' }}>schools</code></td>
              <td style={{ padding: '0.75rem 1rem' }}><code style={{ color: '#a1a1aa' }}>report_schools</code></td>
              <td style={{ padding: '0.75rem 1rem', color: '#fafafa' }}>School profile, active term/year, branding</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #1f1f23' }}>
              <td style={{ padding: '0.75rem 1rem' }}><code style={{ color: '#38bdf8' }}>classes</code></td>
              <td style={{ padding: '0.75rem 1rem' }}><code style={{ color: '#a1a1aa' }}>report_classes</code></td>
              <td style={{ padding: '0.75rem 1rem', color: '#fafafa' }}>Class levels (Basic 1 - JHS 3)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #1f1f23' }}>
              <td style={{ padding: '0.75rem 1rem' }}><code style={{ color: '#38bdf8' }}>subjects</code></td>
              <td style={{ padding: '0.75rem 1rem' }}><code style={{ color: '#a1a1aa' }}>report_subjects</code></td>
              <td style={{ padding: '0.75rem 1rem', color: '#fafafa' }}>Curriculum subjects</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #1f1f23' }}>
              <td style={{ padding: '0.75rem 1rem' }}><code style={{ color: '#38bdf8' }}>learners</code></td>
              <td style={{ padding: '0.75rem 1rem' }}><code style={{ color: '#a1a1aa' }}>report_learners</code></td>
              <td style={{ padding: '0.75rem 1rem', color: '#fafafa' }}>Student biodata, guardian contacts, class assigned</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #1f1f23' }}>
              <td style={{ padding: '0.75rem 1rem' }}><code style={{ color: '#38bdf8' }}>scores</code></td>
              <td style={{ padding: '0.75rem 1rem' }}><code style={{ color: '#a1a1aa' }}>report_scores</code></td>
              <td style={{ padding: '0.75rem 1rem', color: '#fafafa' }}>Class assessment & exam marks</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #1f1f23' }}>
              <td style={{ padding: '0.75rem 1rem' }}><code style={{ color: '#38bdf8' }}>reportSummaries</code></td>
              <td style={{ padding: '0.75rem 1rem' }}><code style={{ color: '#a1a1aa' }}>report_summaries</code></td>
              <td style={{ padding: '0.75rem 1rem', color: '#fafafa' }}>Computed aggregates, positions, remarks</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }
];

export default function OperationsRunbook() {
  const [activeTab, setActiveTab] = useState('architecture');

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '3rem', color: '#fafafa' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fafafa', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ display: 'inline-flex', padding: '0.4rem', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', fontSize: '1.1rem', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              <i className="fa-solid fa-book-bookmark"></i>
            </span>
            Operations Runbook & Architecture Guide
          </h1>
          <p style={{ color: '#a1a1aa', margin: '0.35rem 0 0', fontSize: '0.88rem' }}>
            System specifications, multi-tenant rules, offline sync engine, and incident resolution protocols.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <span style={{ padding: '0.35rem 0.75rem', background: '#18181c', border: '1px solid #27272a', color: '#38bdf8', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
            v0.1.1 Production
          </span>
          <span style={{ padding: '0.35rem 0.75rem', background: '#18181c', border: '1px solid #27272a', color: '#34d399', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
            Offline PWA
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #222226', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {RUNBOOK_SECTIONS.map((sec) => (
          <button
            key={sec.id}
            onClick={() => setActiveTab(sec.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.55rem 1rem',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: activeTab === sec.id ? sec.color : '#27272a',
              background: activeTab === sec.id ? `${sec.color}15` : '#121215',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.82rem',
              color: activeTab === sec.id ? sec.color : '#a1a1aa',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <i className={`fa-solid ${sec.icon}`}></i>
            {sec.title}
          </button>
        ))}
      </div>

      {/* Active Section Content */}
      <div style={{ background: '#121215', borderRadius: '12px', padding: '1.75rem', border: '1px solid #222226' }}>
        {RUNBOOK_SECTIONS.find(s => s.id === activeTab)?.content}
      </div>

      {/* Quick Links Footer */}
      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.15rem', background: '#121215', borderRadius: '8px', border: '1px solid #222226', fontSize: '0.84rem', color: '#71717a', flexWrap: 'wrap', gap: '0.75rem' }}>
        <span>Local Markdown specification: <code style={{ color: '#fafafa' }}>RUNBOOK.md</code> in project root</span>
        <a 
          href="https://supabase.com/dashboard/project/qyavwtumduldesrajvzm" 
          target="_blank" 
          rel="noreferrer" 
          style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          Supabase Dashboard <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.75rem' }}></i>
        </a>
      </div>
    </div>
  );
}
