import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import agentReferralService from '../../services/agentReferralService';

export default function AgentPortal() {
  const [searchParams] = useSearchParams();
  const { code: paramCode } = useParams();
  const initialCode = paramCode || searchParams.get('code') || searchParams.get('ref') || '';

  const [activeTab, setActiveTab] = useState(initialCode ? 'login' : 'register');
  const [loginInput, setLoginInput] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regCustomCode, setRegCustomCode] = useState('');

  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [portalData, setPortalData] = useState(null);
  const [portalTab, setPortalTab] = useState('overview');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedDemoLink, setCopiedDemoLink] = useState(false);
  const [copiedScriptId, setCopiedScriptId] = useState(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutContact, setPayoutContact] = useState('');
  const [payoutAccountName, setPayoutAccountName] = useState('');
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState('');

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) { setIsAppInstalled(true); }
    else {
      const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIosDevice) { setIsIos(true); setIsInstallable(true); }
    }
    const handleBeforeInstall = (e) => { e.preventDefault(); setDeferredPrompt(e); setIsInstallable(true); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', () => { setIsAppInstalled(true); setIsInstallable(false); });
    const savedIdentifier = localStorage.getItem('partner_agent_session');
    if (savedIdentifier) {
      loadPortalSession(savedIdentifier);
    } else if (initialCode) {
      // Security Fix: Do not auto-authenticate with public referral code!
      // Prefill login input and prompt for agent's password instead.
      setLoginInput(initialCode);
      setActiveTab('login');
    }
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, [initialCode]);

  const handleInstallClick = async () => {
    if (isIos) { setShowIosGuide(true); return; }
    if (!deferredPrompt) { alert('Open your browser menu and select "Add to Home Screen" or "Install App".'); return; }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') { setIsInstallable(false); setIsAppInstalled(true); }
    setDeferredPrompt(null);
  };

  const loadPortalSession = async (identifier) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const data = await agentReferralService.getAgentPortalData(identifier);
      if (data && data.agent) {
        setPortalData(data);
        localStorage.setItem('partner_agent_session', data.agent.phone || data.agent.id);
        if (!payoutContact) setPayoutContact(data.agent.phone || '');
        if (!payoutAccountName) setPayoutAccountName(data.agent.fullName || '');
        if (typeof window !== 'undefined' && window.history?.replaceState && data.agent.referralCode) {
          const targetUrl = `/agent/portal/${data.agent.referralCode}`;
          if (window.location.pathname !== targetUrl) window.history.replaceState(null, '', targetUrl);
        }
      } else {
        localStorage.removeItem('partner_agent_session');
      }
    } catch (err) {
      console.warn('[AgentPortal] Session load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginInput.trim()) { setErrorMessage('Please enter your Phone Number or Referral Code.'); return; }
    if (!loginPassword.trim()) { setErrorMessage('Please enter your password.'); return; }
    setLoading(true); setErrorMessage('');
    try {
      const auth = await agentReferralService.authenticateAgent(loginInput.trim(), loginPassword.trim());
      if (auth.success && auth.agent) {
        const data = await agentReferralService.getAgentPortalData(auth.agent.phone || auth.agent.id);
        if (data && data.agent) {
          setPortalData(data);
          localStorage.setItem('partner_agent_session', data.agent.phone || data.agent.id);
          setSuccessMessage(`Welcome back, ${data.agent.fullName}!`);
          setLoginPassword('');
          setTimeout(() => setSuccessMessage(''), 4000);
        } else {
          setErrorMessage('Could not load account details. Please try again.');
        }
      }
    } catch (err) { setErrorMessage(err.message || 'Login failed.'); }
    finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !regPhone.trim()) { setErrorMessage('Please provide your Full Name and Mobile Phone Number.'); return; }
    if (!regPassword || regPassword.length < 4) { setErrorMessage('Password must be at least 4 characters.'); return; }
    if (regPassword !== regConfirmPassword) { setErrorMessage('Passwords do not match.'); return; }
    setLoading(true); setErrorMessage('');
    try {
      const res = await agentReferralService.registerAgent({ fullName: regName.trim(), phone: regPhone.trim(), email: regEmail.trim(), customCode: regCustomCode.trim(), password: regPassword.trim() });
      if (res.success && res.agent) {
        await loadPortalSession(res.agent.phone);
        setSuccessMessage(res.message);
        setShowWelcomeModal(true);
        setRegPassword(''); setRegConfirmPassword('');
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (err) { setErrorMessage(err.message || 'Registration failed.'); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_agent_session');
    setPortalData(null); setLoginInput(''); setLoginPassword('');
  };

  const getReferralUrl = () => {
    const code = portalData?.agent?.referralCode || '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.laboureducation.com';
    return `${origin}/register?ref=${code}`;
  };

  const getDemoUrl = () => {
    const code = portalData?.agent?.referralCode || '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.laboureducation.com';
    return `${origin}/demo?ref=${code}`;
  };

  const copyToClipboard = (text, type = 'link') => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'link') { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2500); }
      else { setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2500); }
    }
  };

  const shareOnWhatsApp = () => {
    const code = portalData?.agent?.referralCode || '';
    const link = getReferralUrl();
    const text = encodeURIComponent(`Hello! 👋 I recommend Labour Educational Platform for school reports, terminal analytics, and academic management. Register your school with my partner code "${code}" here: ${link} to activate free onboarding!`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const copyScriptText = (id, text) => {
    if (navigator.clipboard) { navigator.clipboard.writeText(text); setCopiedScriptId(id); setTimeout(() => setCopiedScriptId(null), 2500); }
  };

  const handleOpenPayoutModal = () => {
    const available = Number(portalData?.agent?.pendingPayout || 0);
    setPayoutAmount(available > 0 ? available.toFixed(2) : '0.00');
    setPayoutContact(portalData?.agent?.phone || '');
    setPayoutAccountName(portalData?.agent?.fullName || '');
    setPayoutError('');
    setShowPayoutModal(true);
  };

  const handleSubmitPayoutRequest = async (e) => {
    e.preventDefault();
    const amt = Number(payoutAmount);
    if (isNaN(amt) || amt <= 0) { setPayoutError('Please enter a valid amount greater than GH₵0.00.'); return; }
    const targetContact = String(portalData?.agent?.phone || '').trim();
    if (!targetContact) { setPayoutError('No registered MoMo number on your account.'); return; }
    const targetName = String(portalData?.agent?.fullName || '').trim() || 'Agent Partner';
    setRequestingPayout(true); setPayoutError('');
    try {
      const res = await agentReferralService.requestPayout({ agentId: portalData.agent.id, amount: amt, payoutNetwork: 'MTN Mobile Money', payoutContact: targetContact, payoutAccountName: targetName });
      if (res.success) {
        setShowPayoutModal(false);
        setSuccessMessage(`✅ Withdrawal of GH₵ ${amt.toFixed(2)} submitted! Funds will be sent to ${targetContact}.`);
        setTimeout(() => setSuccessMessage(''), 7000);
        await loadPortalSession(portalData.agent.id);
      }
    } catch (err) { setPayoutError(err.message || 'Failed to submit withdrawal request.'); }
    finally { setRequestingPayout(false); }
  };

  // ─── STYLES ────────────────────────────────────────────────────────────────
  const S = {
    // Layout
    page: { minHeight: '100vh', background: '#f3f4f6', color: '#111827', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: '14px', lineHeight: 1.5 },
    main: { maxWidth: '1100px', margin: '0 auto', padding: '32px 20px' },

    // Navbar
    nav: { background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '0 24px', height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 },
    navBrand: { display: 'flex', alignItems: 'center', gap: '10px' },
    navLogo: { width: '38px', height: '38px', borderRadius: '10px', objectFit: 'contain', background: '#fff', border: '1px solid #e5e7eb', padding: '3px', display: 'block' },
    navTitle: { fontWeight: 800, fontSize: '15px', color: '#111827', letterSpacing: '-0.01em' },
    navSub: { fontSize: '11px', color: '#9ca3af', fontWeight: 400, marginTop: '1px' },
    navRight: { display: 'flex', alignItems: 'center', gap: '8px' },

    // Typography scale
    h1: { fontSize: '34px', fontWeight: 800, color: '#111827', margin: '0 0 12px 0', lineHeight: 1.15, letterSpacing: '-0.02em' },
    h2: { fontSize: '20px', fontWeight: 700, color: '#111827', margin: '0 0 6px 0', lineHeight: 1.3, letterSpacing: '-0.01em' },
    h3: { fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 4px 0', lineHeight: 1.3 },
    sectionTitle: { fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' },
    cardTitle: { fontSize: '13px', fontWeight: 600, color: '#111827', lineHeight: 1.4 },
    bodyText: { fontSize: '14px', color: '#374151', lineHeight: 1.6 },
    subText: { fontSize: '13px', color: '#6b7280', lineHeight: 1.5 },
    caption: { fontSize: '11px', color: '#9ca3af', lineHeight: 1.4 },
    label: { display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '5px', letterSpacing: '0.005em' },

    // Inputs
    input: { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '7px', border: '1px solid #d1d5db', color: '#111827', fontSize: '14px', outline: 'none', background: '#fff', lineHeight: 1.5 },

    // Buttons
    btnSm: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' },
    btnSmPrimary: { padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#16a34a', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' },
    btnPrimary: { padding: '9px 18px', borderRadius: '7px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px', letterSpacing: '0.01em' },
    btnSecondary: { padding: '9px 18px', borderRadius: '7px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 500, fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px' },
    btnWhatsapp: { padding: '9px 18px', borderRadius: '7px', border: 'none', background: '#25d366', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px' },
    btnClose: { position: 'absolute', top: '16px', right: '16px', background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' },

    // Cards & surfaces
    card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    alert: (type) => ({ padding: '11px 14px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '9px', background: type === 'error' ? '#fef2f2' : '#f0fdf4', border: `1px solid ${type === 'error' ? '#fecaca' : '#bbf7d0'}`, color: type === 'error' ? '#b91c1c' : '#15803d' }),

    // Tabs
    tabBar: { display: 'flex', borderBottom: '1px solid #e5e7eb', gap: '0', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' },
    tab: (active) => ({ padding: '11px 18px', border: 'none', borderBottom: `2px solid ${active ? '#16a34a' : 'transparent'}`, background: 'none', color: active ? '#16a34a' : '#6b7280', fontWeight: active ? 700 : 400, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', letterSpacing: active ? '0.005em' : 0, whiteSpace: 'nowrap', flexShrink: 0 }),

    // Stats
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' },
    statCard: (accent) => ({ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', borderTop: `3px solid ${accent}` }),
    statLabel: { fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' },
    statValue: (color) => ({ fontSize: '24px', fontWeight: 800, color: color || '#111827', lineHeight: 1.1, letterSpacing: '-0.02em' }),
    statSub: { fontSize: '12px', color: '#9ca3af', marginTop: '5px', fontWeight: 400 },

    // Tables
    tableWrap: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
    table: { width: '100%', minWidth: '550px', borderCollapse: 'collapse', fontSize: '13px' },
    th: { padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' },
    td: { padding: '12px 14px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '13px' },
    badge: (color) => ({ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: color === 'green' ? '#dcfce7' : color === 'yellow' ? '#fef9c3' : color === 'red' ? '#fee2e2' : '#f3f4f6', color: color === 'green' ? '#15803d' : color === 'yellow' ? '#a16207' : color === 'red' ? '#b91c1c' : '#6b7280' }),

    // Section heads
    sectionHead: { paddingBottom: '12px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },

    // Misc
    empty: { padding: '48px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' },
    copyRow: { display: 'flex', alignItems: 'center', gap: '8px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '8px 12px' },
    codeText: { fontFamily: "'Courier New', monospace", fontSize: '13px', color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  };

  // ─── PUBLIC: Auth Screen ──────────────────────────────────────────────────
  const renderAuthScreen = () => (
    <div>
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '52px 20px 40px', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dcfce7', color: '#15803d', padding: '5px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, marginBottom: '20px', letterSpacing: '0.03em' }}>
          <i className="fa-solid fa-circle" style={{ fontSize: '7px' }}></i> PARTNER PROGRAM · OPEN
        </div>
        <h1 style={S.h1}>
          Refer Schools.<br />Earn <span style={{ color: '#16a34a' }}>50% Commission</span>.
        </h1>
        <p style={{ ...S.subText, fontSize: '15px', maxWidth: '480px', margin: '0 auto' }}>
          Partner with Labour Educational System. When schools you refer subscribe, you earn 50% of their term fee — paid directly to your MTN MoMo.
        </p>
      </div>

      {/* 3 Steps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', maxWidth: '820px', margin: '0 auto 40px auto' }}>
        {[
          { icon: 'fa-share-nodes', color: '#16a34a', bg: '#f0fdf4', step: '01', title: 'Share Your Link', desc: 'Send your unique referral link to headteachers and school owners.' },
          { icon: 'fa-school', color: '#2563eb', bg: '#eff6ff', step: '02', title: 'School Subscribes', desc: 'When the school pays their term subscription, 50% is instantly credited to you.' },
          { icon: 'fa-mobile-screen', color: '#d97706', bg: '#fffbeb', step: '03', title: 'Withdraw to MoMo', desc: 'Request cashout anytime. Funds go directly to your registered MTN number.' },
        ].map(s => (
          <div key={s.step} style={{ ...S.card, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '16px' }}>
                <i className={`fa-solid ${s.icon}`}></i>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '3px' }}>Step {s.step}</div>
                <div style={{ ...S.cardTitle, marginBottom: '5px' }}>{s.title}</div>
                <p style={{ ...S.subText, fontSize: '12px', margin: 0 }}>{s.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Auth Card */}
      <div style={{ maxWidth: '440px', margin: '0 auto' }}>
        <div style={S.card}>
          {/* Tab switcher */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e5e7eb' }}>
            <button onClick={() => setActiveTab('register')} style={{ padding: '15px', border: 'none', borderBottom: `2px solid ${activeTab === 'register' ? '#16a34a' : 'transparent'}`, background: 'none', fontWeight: activeTab === 'register' ? 700 : 400, color: activeTab === 'register' ? '#16a34a' : '#6b7280', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
              <i className="fa-solid fa-user-plus" style={{ fontSize: '12px' }}></i> Create Account
            </button>
            <button onClick={() => setActiveTab('login')} style={{ padding: '15px', border: 'none', borderBottom: `2px solid ${activeTab === 'login' ? '#16a34a' : 'transparent'}`, background: 'none', fontWeight: activeTab === 'login' ? 700 : 400, color: activeTab === 'login' ? '#16a34a' : '#6b7280', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
              <i className="fa-solid fa-right-to-bracket" style={{ fontSize: '12px' }}></i> Sign In
            </button>
          </div>

          <div style={{ padding: '24px' }}>
            {activeTab === 'register' ? (
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={S.label}><i className="fa-solid fa-user" style={{ marginRight: '6px', color: '#9ca3af' }}></i>Full Name *</label>
                  <input style={S.input} type="text" placeholder="e.g. Kofi Mensah" value={regName} onChange={e => setRegName(e.target.value)} required />
                </div>
                <div>
                  <label style={S.label}><i className="fa-solid fa-phone" style={{ marginRight: '6px', color: '#9ca3af' }}></i>MTN MoMo Phone Number *</label>
                  <input style={S.input} type="tel" placeholder="e.g. 0244123456" value={regPhone} onChange={e => setRegPhone(e.target.value)} required />
                  <p style={{ margin: '5px 0 0', ...S.caption, color: '#6b7280' }}>Payouts go to this number. Permanently linked to your account.</p>
                </div>
                <div>
                  <label style={S.label}><i className="fa-solid fa-envelope" style={{ marginRight: '6px', color: '#9ca3af' }}></i>Email (Optional)</label>
                  <input style={S.input} type="email" placeholder="kofi@example.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                </div>
                <div>
                  <label style={S.label}><i className="fa-solid fa-lock" style={{ marginRight: '6px', color: '#9ca3af' }}></i>Set Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...S.input, paddingRight: '40px' }} type={showRegPassword ? 'text' : 'password'} placeholder="At least 4 characters" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={4} />
                    <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                      <i className={showRegPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                    </button>
                  </div>
                </div>
                <div>
                  <label style={S.label}><i className="fa-solid fa-lock" style={{ marginRight: '6px', color: '#9ca3af' }}></i>Confirm Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...S.input, paddingRight: '40px', borderColor: regPassword && regConfirmPassword && regPassword !== regConfirmPassword ? '#f87171' : '#d1d5db' }} type={showRegConfirmPassword ? 'text' : 'password'} placeholder="Re-enter password" value={regConfirmPassword} onChange={e => setRegConfirmPassword(e.target.value)} required minLength={4} />
                    <button type="button" onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                      <i className={showRegConfirmPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                    </button>
                  </div>
                  {regPassword && regConfirmPassword && regPassword !== regConfirmPassword && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#ef4444' }}><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '4px' }}></i>Passwords don't match</p>}
                </div>
                <div>
                  <label style={S.label}><i className="fa-solid fa-tag" style={{ marginRight: '6px', color: '#9ca3af' }}></i>Custom Referral Code (Optional)</label>
                  <input style={S.input} type="text" placeholder="e.g. KOFI2026 — leave blank to auto-generate" value={regCustomCode} onChange={e => setRegCustomCode(e.target.value.toUpperCase())} />
                </div>
                <button type="submit" disabled={loading} style={{ ...S.btnPrimary, justifyContent: 'center', padding: '12px', fontSize: '14px', marginTop: '4px', opacity: loading ? 0.7 : 1 }}>
                  <i className={loading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-user-plus'}></i>
                  {loading ? 'Creating account…' : 'Create Account & Get My Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={S.label}><i className="fa-solid fa-phone" style={{ marginRight: '6px', color: '#9ca3af' }}></i>Registered Phone Number *</label>
                  <input style={S.input} type="tel" placeholder="e.g. 0244123456" value={loginInput} onChange={e => setLoginInput(e.target.value)} required />
                  <p style={{ margin: '5px 0 0', ...S.caption, color: '#6b7280' }}>Enter the phone number linked to your account.</p>
                </div>
                <div>
                  <label style={S.label}><i className="fa-solid fa-lock" style={{ marginRight: '6px', color: '#9ca3af' }}></i>Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...S.input, paddingRight: '40px' }} type={showLoginPassword ? 'text' : 'password'} placeholder="Enter your password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                      <i className={showLoginPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading} style={{ ...S.btnPrimary, justifyContent: 'center', padding: '12px', fontSize: '14px', marginTop: '4px', opacity: loading ? 0.7 : 1 }}>
                  <i className={loading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-right-to-bracket'}></i>
                  {loading ? 'Signing in…' : 'Access My Dashboard'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ─── DASHBOARD ────────────────────────────────────────────────────────────
  const renderDashboard = () => {
    const agent = portalData.agent;
    const available = Number(agent.pendingPayout || 0);
    const held = Number(agent.heldInRequest || 0);
    const earned = Number(agent.totalEarned || 0);
    const paid = Number(agent.totalPaid || 0);

    return (
      <div>
        {/* Profile + Referral Code bar */}
        <div style={{ ...S.card, padding: '16px 20px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px' }}>
                {agent.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px', color: '#111827' }}>{agent.fullName}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{agent.phone}{agent.email ? ` · ${agent.email}` : ''}</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            {/* Partner Code chip */}
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>Partner Code</span>
              <code style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>{agent.referralCode}</code>
              <button onClick={() => copyToClipboard(agent.referralCode, 'code')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13px', padding: '0' }} title="Copy code">
                <i className={copiedCode ? 'fa-solid fa-check' : 'fa-solid fa-copy'} style={{ color: copiedCode ? '#16a34a' : undefined }}></i>
              </button>
            </div>
            <button onClick={() => copyToClipboard(getReferralUrl(), 'link')} style={{ ...S.btnSecondary }}>
              <i className={copiedLink ? 'fa-solid fa-check' : 'fa-solid fa-link'} style={{ color: copiedLink ? '#16a34a' : undefined }}></i>
              {copiedLink ? 'Copied!' : 'Copy Invite Link'}
            </button>
            <button onClick={shareOnWhatsApp} style={{ ...S.btnWhatsapp }}>
              <i className="fa-brands fa-whatsapp"></i> WhatsApp
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div style={S.statGrid}>
          <div style={S.statCard('#16a34a')}>
            <div style={S.statLabel}>Available to Withdraw</div>
            <div style={S.statValue('#16a34a')}>GH₵ {available.toFixed(2)}</div>
            <button onClick={handleOpenPayoutModal} disabled={available <= 0} style={{ marginTop: '12px', width: '100%', ...S.btnPrimary, justifyContent: 'center', opacity: available <= 0 ? 0.5 : 1, cursor: available <= 0 ? 'not-allowed' : 'pointer' }}>
              <i className="fa-solid fa-money-bill-transfer"></i> Request Withdrawal
            </button>
          </div>
          <div style={S.statCard('#f59e0b')}>
            <div style={S.statLabel}>Pending Disbursal</div>
            <div style={S.statValue('#d97706')}>GH₵ {held.toFixed(2)}</div>
            <div style={S.statSub}>Awaiting Labour MoMo transfer</div>
          </div>
          <div style={S.statCard('#3b82f6')}>
            <div style={S.statLabel}>Total Earned (50%)</div>
            <div style={S.statValue('#2563eb')}>GH₵ {earned.toFixed(2)}</div>
            <div style={S.statSub}>1-Term commission total</div>
          </div>
          <div style={S.statCard('#8b5cf6')}>
            <div style={S.statLabel}>Total Paid to You</div>
            <div style={S.statValue('#7c3aed')}>GH₵ {paid.toFixed(2)}</div>
            <div style={S.statSub}>Received via Mobile Money</div>
          </div>
        </div>

        {/* Nav Tabs */}
        <div style={{ ...S.tabBar, background: '#fff', borderRadius: '10px 10px 0 0', border: '1px solid #e5e7eb', borderBottom: 'none', padding: '0 8px' }}>
          {[
            { key: 'overview', icon: 'fa-chart-simple', label: 'Overview' },
            { key: 'leads', icon: 'fa-bullseye', label: `Leads (${portalData.leads?.length || 0})` },
            { key: 'marketing', icon: 'fa-qrcode', label: 'Marketing Kit' },
            { key: 'guide', icon: 'fa-book-open', label: 'Guide & Rules' },
          ].map(t => (
            <button key={t.key} onClick={() => setPortalTab(t.key)} style={S.tab(portalTab === t.key)}>
              <i className={`fa-solid ${t.icon}`}></i> {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content wrapper */}
        <div style={{ ...S.card, borderRadius: '0 0 10px 10px', border: '1px solid #e5e7eb', borderTop: 'none', padding: '24px' }}>

          {/* ── OVERVIEW ── */}
          {portalTab === 'overview' && (
            <>
              {/* Quick Guide & Support Notice */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '18px 20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>
                    <i className="fa-solid fa-headset"></i>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#14532d' }}>
                      The Labour Team Takes Care of Onboarding &amp; Training
                    </div>
                    <div style={{ fontSize: '12px', color: '#166534' }}>
                      You only share your link — our support team helps schools onboard learners and trains their teachers completely free!
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid #dcfce7', paddingTop: '14px' }}>
                  {[
                    { icon: 'fa-chalkboard-user', color: '#2563eb', title: 'Teacher Training Handled', body: 'Our experts guide headteachers & teachers on entering scores, SBA grading, and printing reports.' },
                    { icon: 'fa-users-gear', color: '#16a34a', title: 'Learner Onboarding Included', body: 'The Labour technical team assists schools in uploading and setting up all their learners.' },
                    { icon: 'fa-shield-halved', color: '#d97706', title: 'School Approval & Verification', body: 'Referred schools are verified & approved by Labour before commissions can be withdrawn.' },
                  ].map(g => (
                    <div key={g.title} style={{ flex: '1 1 220px', display: 'flex', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fff', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: g.color, fontSize: '13px' }}>
                        <i className={`fa-solid ${g.icon}`}></i>
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#111827', marginBottom: '3px' }}>{g.title}</div>
                        <div style={{ fontSize: '12px', color: '#4b5563', lineHeight: 1.45 }}>{g.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Referred Schools */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ ...S.sectionHead, padding: '0 0 12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={S.sectionTitle}>
                    <i className="fa-solid fa-school" style={{ color: '#16a34a' }}></i> Referred Schools ({portalData.schools?.length || 0})
                  </h3>
                  <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <i className="fa-solid fa-circle-info" style={{ color: '#16a34a' }}></i>
                    Schools must be approved before withdrawal
                  </span>
                </div>
                {portalData.schools && portalData.schools.length > 0 ? (
                  <div style={{ ...S.tableWrap, border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>School Name</th>
                          <th style={S.th}>Location</th>
                          <th style={S.th}>Labour Approval</th>
                          <th style={S.th}>Subscription Status</th>
                          <th style={{ ...S.th, textAlign: 'right' }}>Your 50%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portalData.schools.map((s, idx) => (
                          <tr key={s.id || idx}>
                            <td style={S.td}>
                              <div style={{ fontWeight: 600, color: '#111827' }}>{s.name}</div>
                              <div style={{ fontSize: '11px', color: '#9ca3af' }}>ID: {s.id}</div>
                            </td>
                            <td style={{ ...S.td, color: '#6b7280' }}>
                              <i className="fa-solid fa-location-dot" style={{ marginRight: '5px', color: '#9ca3af', fontSize: '11px' }}></i>
                              {s.location}
                            </td>
                            <td style={S.td}>
                              <span style={S.badge(s.isApproved ? 'green' : 'yellow')}>
                                <i className={`fa-solid ${s.isApproved ? 'fa-circle-check' : 'fa-clock'}`}></i>
                                {s.isApproved ? 'Approved' : 'Pending Verification'}
                              </span>
                            </td>
                            <td style={S.td}>
                              <span style={S.badge(s.isTerm1Rewarded ? 'green' : 'yellow')}>
                                <i className={`fa-solid ${s.isTerm1Rewarded ? 'fa-circle-dollar-to-slot' : 'fa-gift'}`}></i>
                                {s.isTerm1Rewarded ? 'Paid & Rewarded' : '1st Term Free Trial'}
                              </span>
                            </td>
                            <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: s.commissionAmount > 0 ? '#16a34a' : '#9ca3af' }}>
                              GH₵ {Number(s.commissionAmount || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ ...S.empty, border: '1px dashed #e5e7eb', borderRadius: '8px' }}>
                    <i className="fa-solid fa-share-nodes" style={{ fontSize: '28px', color: '#d1d5db', display: 'block', marginBottom: '10px' }}></i>
                    No schools referred yet. Share your invite link above to start earning!
                  </div>
                )}
              </div>

              {/* Payout History */}
              <div>
                <div style={{ ...S.sectionHead, padding: '0 0 12px 0' }}>
                  <h3 style={S.sectionTitle}><i className="fa-solid fa-receipt" style={{ color: '#3b82f6' }}></i> Withdrawal History</h3>
                </div>
                {portalData.payoutRequests && portalData.payoutRequests.length > 0 ? (
                  <div style={{ ...S.tableWrap, border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>Date</th>
                          <th style={S.th}>Amount</th>
                          <th style={S.th}>Destination</th>
                          <th style={S.th}>Status</th>
                          <th style={S.th}>Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portalData.payoutRequests.map(req => (
                          <tr key={req.id}>
                            <td style={{ ...S.td, color: '#6b7280' }}>
                              {new Date(req.requestedAt).toLocaleDateString()}&nbsp;
                              <span style={{ fontSize: '11px' }}>{new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </td>
                            <td style={{ ...S.td, fontWeight: 600 }}>GH₵ {Number(req.amount).toFixed(2)}</td>
                            <td style={S.td}>
                              <div style={{ fontWeight: 500 }}>{req.payoutContact}</div>
                              <div style={{ fontSize: '11px', color: '#9ca3af' }}>{req.payoutNetwork}</div>
                            </td>
                            <td style={S.td}>
                              <span style={S.badge(req.status === 'DISBURSED' ? 'green' : req.status === 'REJECTED' ? 'red' : 'yellow')}>
                                {req.status === 'DISBURSED' ? '✓ Sent' : req.status === 'REJECTED' ? '✕ Rejected' : '⏳ Pending'}
                              </span>
                            </td>
                            <td style={S.td}>
                              {req.disbursalReference
                                ? <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: '#374151' }}>{req.disbursalReference}</code>
                                : <span style={{ color: '#9ca3af', fontSize: '12px' }}>—</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ ...S.empty, border: '1px dashed #e5e7eb', borderRadius: '8px' }}>
                    No withdrawals yet. Once commissions are credited, click "Request Withdrawal" to receive your money.
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── LEADS ── */}
          {portalTab === 'leads' && (
            <div>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#92400e', marginBottom: '6px' }}>
                  <i className="fa-solid fa-lock" style={{ marginRight: '6px' }}></i> 60-Day Attribution Lock
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#78350f', lineHeight: 1.5 }}>
                  Headteachers who book a demo through your link are locked to your account for 60 days. Even if they register weeks later, your 50% commission is guaranteed.
                </p>
                <div style={S.copyRow}>
                  <span style={S.codeText}>{getDemoUrl()}</span>
                  <button onClick={() => { copyToClipboard(getDemoUrl(), 'demo'); setCopiedDemoLink(true); setTimeout(() => setCopiedDemoLink(false), 2500); }} style={{ ...S.btnPrimary, padding: '6px 12px', fontSize: '12px' }}>
                    <i className={copiedDemoLink ? 'fa-solid fa-check' : 'fa-solid fa-copy'}></i> {copiedDemoLink ? 'Copied!' : 'Copy Demo Link'}
                  </button>
                </div>
              </div>

              {portalData.leads && portalData.leads.length > 0 ? (
                <div style={{ ...S.tableWrap, border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>School</th>
                        <th style={S.th}>Contact</th>
                        <th style={S.th}>Region</th>
                        <th style={S.th}>Lock Expires</th>
                        <th style={S.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portalData.leads.map(lead => (
                        <tr key={lead.id}>
                          <td style={S.td}>
                            <div style={{ fontWeight: 500, color: '#111827' }}>{lead.schoolName}</div>
                            <div style={{ fontSize: '11px', color: '#9ca3af' }}>{new Date(lead.createdAt).toLocaleDateString()}</div>
                          </td>
                          <td style={S.td}>
                            <div style={{ fontWeight: 500 }}>{lead.contactPerson}</div>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>{lead.phone}</div>
                          </td>
                          <td style={{ ...S.td, color: '#6b7280' }}>{lead.region || 'Ghana'}</td>
                          <td style={S.td}>
                            <span style={S.badge(lead.isExpired ? 'red' : 'green')}>
                              {lead.isExpired ? 'Expired' : `${lead.daysRemaining}d left`}
                            </span>
                          </td>
                          <td style={S.td}>
                            <span style={S.badge(lead.status === 'CONVERTED' ? 'green' : 'yellow')}>
                              {lead.status === 'CONVERTED' ? '✓ Registered' : '⏳ Demo Scheduled'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ ...S.empty, border: '1px dashed #e5e7eb', borderRadius: '8px' }}>
                  <i className="fa-solid fa-bullseye" style={{ fontSize: '28px', color: '#d1d5db', display: 'block', marginBottom: '10px' }}></i>
                  No leads captured yet. Share your Demo Booking Link to start building your pipeline.
                </div>
              )}
            </div>
          )}

          {/* ── MARKETING KIT ── */}
          {portalTab === 'marketing' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              {/* Printable Flyer */}
              <div>
                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                    <i className="fa-solid fa-print" style={{ marginRight: '7px', color: '#6b7280' }}></i>Printable Promo Flyer
                  </h3>
                  <button onClick={() => window.print()} style={{ ...S.btnPrimary, fontSize: '12px', padding: '7px 14px' }}>
                    <i className="fa-solid fa-print"></i> Print / Save PDF
                  </button>
                </div>

                {/* ── THE ACTUAL PRINTABLE FLYER ── */}
                <div id="partner-printable-flyer" style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  borderRadius: '12px',
                  border: '2px solid #16a34a',
                  overflow: 'hidden',
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}>
                  {/* Header band */}
                  <div style={{ background: '#16a34a', padding: '20px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.75)', marginBottom: '6px' }}>
                      Ghana Educational Innovation
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', lineHeight: 1.1, marginBottom: '4px' }}>
                      Labour Educational Portal
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
                      Complete School Management &amp; Automated GES Terminal Reports
                    </div>
                  </div>

                  <div style={{ padding: '20px 24px' }}>
                    {/* Tag line */}
                    <div style={{ textAlign: 'center', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', marginBottom: '18px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#15803d' }}>
                        First Term 100% FREE — No Upfront Cost!
                      </span>
                      <div style={{ fontSize: '12px', color: '#166534', marginTop: '3px' }}>
                        Generate all your GES terminal reports free. Pay only when you're satisfied.
                      </div>
                    </div>

                    {/* Feature list */}
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                        What Schools Get (Full Support Included)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {[
                          { icon: 'fa-file-invoice', color: '#2563eb', label: 'Automated Terminal Reports', sub: 'GES-compliant, print-ready in seconds' },
                          { icon: 'fa-calculator', color: '#16a34a', label: 'Automatic SBA Grading', sub: 'Scores, class positions & grades computed' },
                          { icon: 'fa-users-gear', color: '#7c3aed', label: 'Free Learner Onboarding', sub: 'The Labour technical team uploads your learners' },
                          { icon: 'fa-chalkboard-user', color: '#d97706', label: 'Free Teacher Training', sub: 'Our specialists train your teachers & staff' },
                        ].map(f => (
                          <div key={f.label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '10px 12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#fff', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: f.color, fontSize: '13px' }}>
                              <i className={`fa-solid ${f.icon}`}></i>
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '12px', color: '#111827' }}>{f.label}</div>
                              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{f.sub}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* QR + Agent info side by side */}
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', borderTop: '1px solid #e5e7eb', paddingTop: '18px' }}>
                      {/* QR Code */}
                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ display: 'inline-block', padding: '8px', background: '#fff', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=6&color=111827&bgcolor=ffffff&data=${encodeURIComponent(getReferralUrl())}`}
                            alt="Scan to register"
                            style={{ width: '120px', height: '120px', display: 'block' }}
                          />
                        </div>
                        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '5px', fontWeight: 500 }}>Scan to register</div>
                      </div>

                      {/* Agent info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#16a34a', marginBottom: '8px' }}>
                          Your School Representative
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '17px', color: '#111827', marginBottom: '6px' }}>{agent.fullName}</div>
                        <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                          <span style={{ color: '#6b7280' }}>Phone: </span><strong>{agent.phone}</strong>
                        </div>
                        <div style={{ fontSize: '13px', color: '#374151', marginBottom: '12px' }}>
                          <span style={{ color: '#6b7280' }}>Partner Code: </span>
                          <span style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '1px 7px', borderRadius: '5px', fontWeight: 700, fontSize: '14px', border: '1px solid #e5e7eb', color: '#111827' }}>
                            {agent.referralCode}
                          </span>
                        </div>

                        {/* Registration link */}
                        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px' }}>
                          <div style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '3px' }}>Registration Link</div>
                          <div style={{ fontSize: '11px', color: '#374151', wordBreak: 'break-all', fontFamily: 'monospace' }}>{getReferralUrl()}</div>
                        </div>
                      </div>
                    </div>

                    {/* Footer note */}
                    <div style={{ marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '12px', textAlign: 'center', fontSize: '11px', color: '#9ca3af' }}>
                      Register at <strong style={{ color: '#374151' }}>{window.location.origin}</strong> &nbsp;·&nbsp; Labour Educational System &nbsp;·&nbsp; Ghana
                    </div>
                  </div>
                </div>
              </div>

              {/* Pitch Scripts */}
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 600, color: '#111827' }}>Ready-Made Pitch Scripts</h3>
                <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#6b7280' }}>Copy and send directly to headteachers, school proprietors, and education groups.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {portalData.marketingScripts?.map(script => (
                    <div key={script.id} style={{ ...S.card, padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>{script.title}</div>
                          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{script.description}</div>
                        </div>
                        <button onClick={() => copyScriptText(script.id, script.text)} style={{ ...S.btnSecondary, fontSize: '12px', padding: '5px 10px', flexShrink: 0 }}>
                          <i className={copiedScriptId === script.id ? 'fa-solid fa-check' : 'fa-solid fa-copy'} style={{ color: copiedScriptId === script.id ? '#16a34a' : undefined }}></i>
                          {copiedScriptId === script.id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <pre style={{ margin: '8px 0', background: '#f9fafb', padding: '10px', borderRadius: '6px', fontSize: '12px', color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontFamily: 'inherit', border: '1px solid #e5e7eb', maxHeight: '160px', overflowY: 'auto' }}>
                        {script.text}
                      </pre>
                      <button onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(script.text)}`, '_blank')} style={{ ...S.btnWhatsapp, fontSize: '12px', padding: '6px 12px', marginTop: '6px' }}>
                        <i className="fa-brands fa-whatsapp"></i> Send on WhatsApp
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── GUIDE ── */}
          {portalTab === 'guide' && (
            <div style={{ maxWidth: '800px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px' }}>
                  <i className="fa-solid fa-book-open"></i>
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>Partner Guide &amp; Commission Rules</h2>
              </div>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 24px 0' }}>Everything you need to know about the system, school approval, onboarding support, and how payouts work.</p>

              {/* Section 1: What The App Does + Support Guarantee */}
              <div style={{ ...S.card, padding: '20px', marginBottom: '16px', borderLeft: '4px solid #3b82f6' }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-file-invoice" style={{ color: '#3b82f6' }}></i> 1. What The Platform Does
                </div>
                <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.6, margin: '0 0 14px 0' }}>
                  <strong style={{ color: '#111827' }}>The Headteacher's Headache:</strong> Most Ghanaian schools spend weeks handwriting report cards, calculating positions by hand, and struggling with exam spreadsheets.<br /><br />
                  <strong style={{ color: '#16a34a' }}>The Labour Solution:</strong> Our web portal automatically grades SBA, ranks positions, and prints beautiful GES-compliant terminal reports with single-click ease.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  {[
                    { icon: 'fa-calculator', label: 'Automatic SBA & Exam Scoring' },
                    { icon: 'fa-ranking-star', label: 'Class Positions & GES Grades' },
                    { icon: 'fa-table-list', label: 'Master Broadsheets' },
                    { icon: 'fa-money-bill-wave', label: 'Fee Tracking & MoMo' },
                  ].map(f => (
                    <div key={f.label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className={`fa-solid ${f.icon}`} style={{ color: '#3b82f6', fontSize: '13px' }}></i>
                      <span style={{ fontSize: '12px', color: '#374151', fontWeight: 600 }}>{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: 1st Term 100% Free Guarantee */}
              <div style={{ ...S.card, padding: '20px', marginBottom: '16px', borderLeft: '4px solid #16a34a' }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-gift" style={{ color: '#16a34a' }}></i> 2. The &ldquo;1st Term 100% Free&rdquo; Guarantee
                </div>
                <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.6, margin: '0 0 12px 0' }}>
                  Every single school you refer enjoys their first academic term completely free with full access to terminal report card generation.
                </p>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fa-solid fa-bullhorn" style={{ fontSize: '16px', flexShrink: 0 }}></i>
                  <div>
                    Your sales pitch: <strong>&ldquo;Use it free for the whole term. Generate all your terminal reports. If you don't love it, you pay GH₵0!&rdquo;</strong>
                  </div>
                </div>
              </div>

              {/* Section 3: How & When You Get Paid + Approval & Onboarding Highlights */}
              <div style={{ ...S.card, padding: '22px', marginBottom: '16px', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-money-bill-transfer" style={{ color: '#f59e0b' }}></i> 3. How &amp; When You Get Paid
                </div>

                {/* Important Requirement: Approval & Verification Banner */}
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '13px 15px', marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px', fontSize: '12px' }}>
                    <i className="fa-solid fa-shield-halved"></i>
                  </div>
                  <div style={{ fontSize: '13px', color: '#991b1b', lineHeight: 1.5 }}>
                    <strong>School Approval Required Before Withdrawal:</strong> Every referred school must be reviewed and <strong>approved by Labour</strong> before referral commissions can be cashed out. This safeguards genuine partners, confirms the school is an active educational institution, and prevents fraudulent registrations.
                  </div>
                </div>

                {/* Hands-off Guarantee: Labour Team Handles Everything */}
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '13px 15px', marginBottom: '18px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px', fontSize: '12px' }}>
                    <i className="fa-solid fa-handshake-angle"></i>
                  </div>
                  <div style={{ fontSize: '13px', color: '#1e40af', lineHeight: 1.5 }}>
                    <strong>The Labour Team Does All The Heavy Lifting:</strong> You do <em>not</em> need to enter student names, set up subjects, or train teachers yourself! The dedicated <strong>Labour Support &amp; Technical Team</strong> personally assists the school with onboarding all their learners and provides thorough, step-by-step training to their headteachers and staff.
                  </div>
                </div>

                {/* Step Flow */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                  {[
                    { step: '1', icon: 'fa-share-nodes', color: '#16a34a', label: 'School Registers', body: 'They register using your partner code & are locked to you permanently.' },
                    { step: '2', icon: 'fa-chalkboard-user', color: '#2563eb', label: 'Labour Team Onboards & Trains', body: 'Our team uploads learners & trains their teachers for free.' },
                    { step: '3', icon: 'fa-shield-check', color: '#d97706', label: 'School is Approved', body: 'Labour verifies and approves the school to authorize commission eligibility.' },
                    { step: '4', icon: 'fa-credit-card', color: '#8b5cf6', label: 'School Pays Term 2 Fee', body: '50% commission is immediately credited to your partner wallet.' },
                    { step: '5', icon: 'fa-mobile-screen', color: '#16a34a', label: 'Instant MoMo Cashout', body: 'Click "Request Withdrawal" & receive funds on your MTN phone.' },
                  ].map(s => (
                    <div key={s.step} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Step {s.step}</span>
                        <i className={`fa-solid ${s.icon}`} style={{ color: s.color, fontSize: '13px' }}></i>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#111827', marginBottom: '4px' }}>{s.label}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.4 }}>{s.body}</div>
                    </div>
                  ))}
                </div>

                {/* Earning Calculation Example */}
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px 16px', fontSize: '13px', color: '#15803d', lineHeight: 1.6, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <i className="fa-solid fa-coins" style={{ fontSize: '20px', flexShrink: 0 }}></i>
                  <div>
                    <strong>Real Example:</strong> An approved school with 250 learners paying GH₵2/learner = <strong>GH₵500 term fee</strong>.<br />
                    Your 50% commission = <strong>GH₵250 cash</strong>. Refer 10 schools = <strong>GH₵2,500 directly to your MTN Mobile Money wallet!</strong>
                  </div>
                </div>
              </div>

              {/* Frequently Asked Questions */}
              <div style={{ ...S.card, padding: '22px' }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-circle-question" style={{ color: '#16a34a' }}></i> Frequently Asked Questions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    {
                      q: 'Do I have to train the teachers or help the school onboard their learners?',
                      a: 'No, absolutely not! You only introduce the school to the platform. The dedicated Labour Support Team takes full responsibility for helping the school onboard their learners, setting up classes, and conducting comprehensive training for their headteachers and teachers at zero charge.'
                    },
                    {
                      q: 'Why does a referred school need to be approved before I can withdraw?',
                      a: 'To maintain the highest standard of platform integrity and prevent fraudulent registrations, Labour verifies and approves every registered school. Once a school is approved and their first paid subscription is completed, your 50% commission is immediately unlocked and ready for cashout.'
                    },
                    {
                      q: 'When does the school make their first paid subscription payment?',
                      a: 'Every referred school enjoys their entire first term 100% free with unlimited automated terminal report cards. Their first paid subscription begins in their second term. When that payment is made, 50% of the entire amount is instantly credited to your wallet.'
                    },
                    {
                      q: 'Can a school claim they were not referred by me?',
                      a: 'No. When a school registers using your unique partner referral code or visits your demo link, our system permanently links that school to your Agent ID. No one else can claim attribution.'
                    },
                    {
                      q: 'How fast are Mobile Money withdrawal requests processed?',
                      a: 'Once you click "Request Withdrawal", our finance team verifies the approved school records and disburses funds directly to your registered MTN Mobile Money number.'
                    },
                  ].map(f => (
                    <div key={f.q} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#111827', marginBottom: '6px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <i className="fa-solid fa-circle-question" style={{ color: '#16a34a', marginTop: '2px', fontSize: '13px' }}></i>
                        <span>{f.q}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.55, paddingLeft: '21px' }}>{f.a}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Print Styles — isolate the flyer on paper */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 18mm 16mm; }
          body * { visibility: hidden !important; }
          #partner-printable-flyer,
          #partner-printable-flyer * { visibility: visible !important; }
          #partner-printable-flyer {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
      {/* Navbar */}
      <nav style={S.nav}>
        <div style={S.navBrand}>
          <img
              src="/logo.png"
              alt="Labour Edu"
              style={S.navLogo}
              onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/app-icon.png'; }}
            />
          <div>
            <div style={S.navTitle}>Labour Edu <span style={{ color: '#16a34a' }}>Partners</span></div>
            <div style={S.navSub}>School Referral & Affiliate Program</div>
          </div>
        </div>
        <div style={S.navRight}>
          {!isAppInstalled && (
            <button onClick={handleInstallClick} style={S.btnSm}>
              <i className="fa-solid fa-download" style={{ marginRight: '5px' }}></i> Install App
            </button>
          )}
          {portalData && (
            <button onClick={handleLogout} style={S.btnSm}>
              <i className="fa-solid fa-arrow-right-from-bracket" style={{ marginRight: '5px' }}></i> Sign Out
            </button>
          )}
        </div>
      </nav>

      {/* Main */}
      <main style={S.main}>
        {errorMessage && (
          <div style={S.alert('error')}>
            <i className="fa-solid fa-circle-exclamation"></i> {errorMessage}
          </div>
        )}
        {successMessage && (
          <div style={S.alert('success')}>
            <i className="fa-solid fa-circle-check"></i> {successMessage}
          </div>
        )}
        {loading && !portalData && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '12px', display: 'block' }}></i>
            Loading your portal…
          </div>
        )}
        {!loading && !portalData && renderAuthScreen()}
        {portalData && renderDashboard()}
      </main>

      {/* ── Payout Modal ── */}
      {showPayoutModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '440px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', position: 'relative' }}>
            <button onClick={() => setShowPayoutModal(false)} style={S.btnClose} title="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ca8a04', fontSize: '18px' }}>
                <i className="fa-solid fa-mobile-screen"></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>Withdraw to MTN MoMo</h3>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Direct Mobile Money Transfer</span>
              </div>
            </div>
            <p style={{ margin: '8px 0 14px', fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>
              Funds are disbursed to your registered MTN number for commissions earned from approved schools.
            </p>

            {payoutError && <div style={{ ...S.alert('error'), marginBottom: '14px' }}>{payoutError}</div>}

            <form onSubmit={handleSubmitPayoutRequest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Linked MoMo display */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ca8a04', fontSize: '18px', flexShrink: 0 }}>
                  <i className="fa-solid fa-sim-card"></i>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#ca8a04', textTransform: 'uppercase', marginBottom: '2px' }}>MTN Mobile Money · Auto-Linked</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{portalData?.agent?.phone}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{portalData?.agent?.fullName}</div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <label style={S.label}>Amount (GH₵)</label>
                  <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 500 }}>Available: GH₵ {Number(portalData?.agent?.pendingPayout || 0).toFixed(2)}</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input type="number" step="0.01" min="1" max={portalData?.agent?.pendingPayout || 0} value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} required style={{ ...S.input, paddingRight: '60px', fontSize: '18px', fontWeight: 700, color: '#16a34a' }} />
                  <button type="button" onClick={() => setPayoutAmount(Number(portalData?.agent?.pendingPayout || 0).toFixed(2))} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: '#dcfce7', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '5px', cursor: 'pointer' }}>MAX</button>
                </div>
              </div>

              <button type="submit" disabled={requestingPayout || Number(portalData?.agent?.pendingPayout || 0) <= 0} style={{ ...S.btnPrimary, justifyContent: 'center', padding: '11px', fontSize: '14px', opacity: requestingPayout || Number(portalData?.agent?.pendingPayout || 0) <= 0 ? 0.6 : 1, cursor: requestingPayout || Number(portalData?.agent?.pendingPayout || 0) <= 0 ? 'not-allowed' : 'pointer' }}>
                <i className="fa-solid fa-money-bill-transfer"></i>
                {requestingPayout ? 'Submitting…' : `Confirm & Withdraw GH₵ ${Number(payoutAmount || 0).toFixed(2)}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── iOS Install Guide Modal ── */}
      {showIosGuide && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '360px', padding: '24px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <i className="fa-brands fa-apple" style={{ fontSize: '36px', color: '#374151', display: 'block', marginBottom: '12px' }}></i>
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: '#111827' }}>Install on iPhone / iPad</h3>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>Add your Partner Portal to your home screen:</p>
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', textAlign: 'left', marginBottom: '16px', fontSize: '13px', color: '#374151', lineHeight: 1.7 }}>
              <div>1. Tap the <strong>Share</strong> button at the bottom of Safari.</div>
              <div>2. Tap <strong>"Add to Home Screen"</strong>.</div>
              <div>3. Tap <strong>Add</strong> at the top right. Done!</div>
            </div>
            <button onClick={() => setShowIosGuide(false)} style={{ ...S.btnPrimary, width: '100%', justifyContent: 'center', padding: '10px' }}>Close</button>
          </div>
        </div>
      )}

      {/* ── Welcome Modal ── */}
      {showWelcomeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 130, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '28px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', position: 'relative' }}>
            <button onClick={() => setShowWelcomeModal(false)} style={S.btnClose} title="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fa-solid fa-handshake-angle" style={{ color: '#16a34a', fontSize: '22px' }}></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#111827' }}>Welcome to the Partner Program!</h3>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#6b7280' }}>Your account is live. Here is how your partnership works:</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {[
                { icon: 'fa-chalkboard-user', title: '1. Labour Team Handles Onboarding & Training', body: 'You only introduce the school! Our support team onboards all their learners and trains their teachers completely free.', color: '#2563eb', bg: '#eff6ff' },
                { icon: 'fa-gift', title: '2. 1st Term 100% Free For Schools', body: 'Every school you refer uses the system with unlimited report cards free for Term 1, making it effortless to sign up.', color: '#16a34a', bg: '#f0fdf4' },
                { icon: 'fa-shield-halved', title: '3. Labour Approval & 50% MoMo Payout', body: 'Once the school is approved by Labour and pays their Term 2 subscription, 50% is credited directly to your wallet.', color: '#d97706', bg: '#fffbeb' },
              ].map(p => (
                <div key={p.title} style={{ display: 'flex', gap: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: p.bg, border: `1px solid #e5e7eb`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: p.color, flexShrink: 0 }}>
                    <i className={`fa-solid ${p.icon}`}></i>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#111827' }}>{p.title}</div>
                    <div style={{ fontSize: '12px', color: '#4b5563', lineHeight: 1.45, marginTop: '2px' }}>{p.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setShowWelcomeModal(false)} style={{ ...S.btnPrimary, width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px' }}>
              Go to My Dashboard <i className="fa-solid fa-arrow-right" style={{ marginLeft: '6px' }}></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
