import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import agentReferralService from '../../services/agentReferralService';

const NETWORKS = [
  { id: 'MTN Mobile Money', label: 'MTN MoMo', icon: 'fa-mobile-screen', color: '#eab308' },
  { id: 'Telecel Cash', label: 'Telecel Cash', icon: 'fa-phone-volume', color: '#ef4444' },
  { id: 'AirtelTigo Money', label: 'AirtelTigo Money', icon: 'fa-sim-card', color: '#3b82f6' },
  { id: 'Bank Transfer', label: 'Local Bank Account', icon: 'fa-building-columns', color: '#10b981' }
];

export default function AgentPortal() {
  const [searchParams] = useSearchParams();
  const { code: paramCode } = useParams();
  const initialCode = paramCode || searchParams.get('code') || searchParams.get('ref') || '';

  const [activeTab, setActiveTab] = useState(initialCode ? 'login' : 'register');
  const [loginInput, setLoginInput] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regCustomCode, setRegCustomCode] = useState('');

  // Login Form State
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Active Agent Session Data
  const [portalData, setPortalData] = useState(null);
  const [portalTab, setPortalTab] = useState('overview'); // 'overview' | 'leads' | 'marketing' | 'guide'
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedDemoLink, setCopiedDemoLink] = useState(false);
  const [copiedScriptId, setCopiedScriptId] = useState(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Request Payment Modal State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNetwork, setPayoutNetwork] = useState('MTN Mobile Money');
  const [payoutContact, setPayoutContact] = useState('');
  const [payoutAccountName, setPayoutAccountName] = useState('');
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState('');

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  // Check saved session in localStorage & PWA detection
  useEffect(() => {
    // Detect standalone PWA mode
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      setIsAppInstalled(true);
    } else {
      const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIosDevice) {
        setIsIos(true);
        setIsInstallable(true);
      }
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', () => {
      setIsAppInstalled(true);
      setIsInstallable(false);
    });

    const savedIdentifier = localStorage.getItem('partner_agent_session');
    if (savedIdentifier) {
      loadPortalSession(savedIdentifier);
    } else if (initialCode) {
      loadPortalSession(initialCode);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, [initialCode]);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }
    if (!deferredPrompt) {
      alert('To install on your phone, open your browser menu (three dots ⋮ or Share) and select "Add to Home Screen" or "Install App".');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setIsAppInstalled(true);
    }
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
        // Pre-fill payout contact with agent's phone and name
        if (!payoutContact) setPayoutContact(data.agent.phone || '');
        if (!payoutAccountName) setPayoutAccountName(data.agent.fullName || '');
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
    if (!loginInput.trim()) {
      setErrorMessage('Please enter your Phone Number or Referral Code.');
      return;
    }
    if (!loginPassword.trim()) {
      setErrorMessage('Please enter your account password.');
      return;
    }
    setLoading(true);
    setErrorMessage('');
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
    } catch (err) {
      setErrorMessage(err.message || 'Failed to login to agent portal.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !regPhone.trim()) {
      setErrorMessage('Please provide your Full Name and Mobile Phone Number.');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setErrorMessage('Please set a password of at least 4 characters for your partner portal.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const res = await agentReferralService.registerAgent({
        fullName: regName.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim(),
        customCode: regCustomCode.trim(),
        password: regPassword.trim()
      });

      if (res.success && res.agent) {
        await loadPortalSession(res.agent.phone);
        setSuccessMessage(res.message);
        setShowWelcomeModal(true);
        setRegPassword('');
        setRegConfirmPassword('');
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_agent_session');
    setPortalData(null);
    setLoginInput('');
    setLoginPassword('');
  };

  const getReferralUrl = () => {
    const code = portalData?.agent?.referralCode || '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.laboureducation.com';
    return `${origin}/register?ref=${code}`;
  };

  const copyToClipboard = (text, type = 'link') => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2500);
      }
    }
  };

  const shareOnWhatsApp = () => {
    const code = portalData?.agent?.referralCode || '';
    const link = getReferralUrl();
    const text = encodeURIComponent(
      `Hello! 👋 I recommend Labour Educational Platform for school reports, terminal analytics, and academic management. Register your school with my partner code "${code}" here: ${link} to activate free onboarding!`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const getDemoUrl = () => {
    const code = portalData?.agent?.referralCode || '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.laboureducation.com';
    return `${origin}/demo?ref=${code}`;
  };

  const copyScriptText = (id, text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedScriptId(id);
      setTimeout(() => setCopiedScriptId(null), 2500);
    }
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
    if (isNaN(amt) || amt <= 0) {
      setPayoutError('Please enter a valid amount greater than GH₵0.00.');
      return;
    }
    if (!payoutContact.trim()) {
      setPayoutError('Please input the phone / MoMo number to take the money on.');
      return;
    }
    if (!payoutAccountName.trim()) {
      setPayoutError('Please input the registered account holder name.');
      return;
    }

    setRequestingPayout(true);
    setPayoutError('');
    try {
      const res = await agentReferralService.requestPayout({
        agentId: portalData.agent.id,
        amount: amt,
        payoutNetwork,
        payoutContact: payoutContact.trim(),
        payoutAccountName: payoutAccountName.trim()
      });

      if (res.success) {
        setShowPayoutModal(false);
        setSuccessMessage(`✅ Payout request of GH₵ ${amt.toFixed(2)} submitted! Funds will be sent to ${payoutContact.trim()} (${payoutNetwork}).`);
        setTimeout(() => setSuccessMessage(''), 7000);
        // Refresh portal data
        await loadPortalSession(portalData.agent.id);
      }
    } catch (err) {
      setPayoutError(err.message || 'Failed to submit payout request.');
    } finally {
      setRequestingPayout(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #1e293b 0%, #0f172a 100%)', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Top Navbar */}
      <header style={{ borderBottom: '1px solid #334155', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 30, padding: '1rem 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}>
              <i className="fa-solid fa-handshake" style={{ color: '#ffffff', fontSize: '1.2rem' }}></i>
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.1rem', letterSpacing: '-0.02em', color: '#f8fafc' }}>
                Labour Edu <span style={{ color: '#f59e0b' }}>Partner</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>School Referral & Affiliate Program</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {!isAppInstalled && (
              <button
                onClick={handleInstallClick}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                }}
                title="Install Partner Portal on your phone as a mobile app"
              >
                <i className="fa-solid fa-download"></i>
                <span>Install App</span>
              </button>
            )}

            {portalData && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ textAlign: 'right', display: 'none', md: 'block' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>{portalData.agent.fullName}</div>
                  <div style={{ fontSize: '0.7rem', color: '#10b981' }}>● Active Partner</div>
                </div>
                <button
                  onClick={handleLogout}
                  style={{ background: '#27272a', border: 'none', color: '#cbd5e1', padding: '0.5rem 0.85rem', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-arrow-right-from-bracket"></i> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        
        {/* Alerts */}
        {errorMessage && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.9rem 1.25rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-circle-exclamation"></i>
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#6ee7b7', padding: '0.9rem 1.25rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-circle-check"></i>
            <span>{successMessage}</span>
          </div>
        )}

        {/* ── NOT LOGGED IN: Public Registration & Access View ── */}
        {!portalData ? (
          <div>
            {/* Hero Section */}
            <div style={{ textAlign: 'center', maxWidth: '780px', margin: '1rem auto 2.5rem auto' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '1rem' }}>
                <i className="fa-solid fa-coins"></i> 50% Commission For One Term
              </div>
              <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, lineHeight: 1.15, margin: '0 0 1rem 0', letterSpacing: '-0.03em' }}>
                Refer Schools. Earn <span style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>50% Commission</span> Direct To Your MoMo.
              </h1>
              <p style={{ fontSize: '1.05rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                Partner with Labour Educational System. Refer schools, private academies, or international schools. When they subscribe, you enjoy <strong>50% of their subscription fee for one term</strong>. Request payment anytime to your Mobile Money!
              </p>
            </div>

            {/* Tab Selector */}
            <div style={{ maxWidth: '480px', margin: '0 auto 2rem auto', background: '#1e293b', padding: '4px', borderRadius: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #334155' }}>
              <button
                onClick={() => setActiveTab('register')}
                style={{
                  background: activeTab === 'register' ? '#f59e0b' : 'transparent',
                  color: activeTab === 'register' ? '#0f172a' : '#94a3b8',
                  border: 'none',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Become a Partner
              </button>
              <button
                onClick={() => setActiveTab('login')}
                style={{
                  background: activeTab === 'login' ? '#f59e0b' : 'transparent',
                  color: activeTab === 'login' ? '#0f172a' : '#94a3b8',
                  border: 'none',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Access My Portal
              </button>
            </div>

            {/* Registration Form Card */}
            {activeTab === 'register' && (
              <div style={{ maxWidth: '480px', margin: '0 auto', background: '#18181b', border: '1px solid #27272a', borderRadius: '20px', padding: '2rem', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
                  Create Partner Account
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#a1a1aa', margin: '0 0 1.5rem 0' }}>
                  Get your unique referral link immediately and start earning 50% commission.
                </p>

                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Kofi Mensah"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
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
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      required
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#09090b', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                    />
                    <span style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.25rem', display: 'block' }}>Used for your login, notifications, and MoMo disbursals.</span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="kofi@example.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#09090b', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                    />
                  </div>

                  {/* ── SET PASSWORD FIELD ── */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Set Password *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        placeholder="At least 4 characters"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                        minLength={4}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 2.5rem 0.75rem 1rem', borderRadius: '10px', background: '#09090b', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: '0.9rem' }}
                      >
                        <i className={showRegPassword ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"}></i>
                      </button>
                    </div>
                  </div>

                  {/* ── CONFIRM PASSWORD FIELD ── */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Confirm Password *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        placeholder="Re-enter your password"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        required
                        minLength={4}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 2.5rem 0.75rem 1rem', borderRadius: '10px', background: '#09090b', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: '0.9rem' }}
                      >
                        <i className={showRegConfirmPassword ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"}></i>
                      </button>
                    </div>
                    {regPassword && regConfirmPassword && regPassword !== regConfirmPassword && (
                      <span style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '0.25rem', display: 'block' }}>
                        ⚠️ Passwords do not match
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Custom Referral Code (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. KOFI2026 (Leave blank to auto-generate)"
                      value={regCustomCode}
                      onChange={(e) => setRegCustomCode(e.target.value.toUpperCase())}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#09090b', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.9rem',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '1rem',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {loading ? 'Setting up account...' : 'Create Account & Get Code'}
                  </button>
                </form>
              </div>
            )}

            {/* Login Form Card */}
            {activeTab === 'login' && (
              <div style={{ maxWidth: '480px', margin: '0 auto', background: '#18181b', border: '1px solid #27272a', borderRadius: '20px', padding: '2rem', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
                  Access Partner Dashboard
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#a1a1aa', margin: '0 0 1.5rem 0' }}>
                  Enter your registered phone number or referral code and password.
                </p>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Phone Number or Referral Code *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 0244123456 or REF-AGT-KOFI"
                      value={loginInput}
                      onChange={(e) => setLoginInput(e.target.value)}
                      required
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#09090b', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Password *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        placeholder="Enter your account password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 2.5rem 0.75rem 1rem', borderRadius: '10px', background: '#09090b', border: '1px solid #27272a', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: '0.9rem' }}
                      >
                        <i className={showLoginPassword ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"}></i>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.9rem',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '1rem',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {loading ? 'Verifying...' : 'Access My Dashboard'}
                  </button>
                </form>
              </div>
            )}

            {/* How It Works 3-Step Banner */}
            <div style={{ maxWidth: '980px', margin: '4rem auto 0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, marginBottom: '1rem' }}>
                  1
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Share Your Link</h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                  Share your unique referral link or partner code with headteachers, school administrators, and educators.
                </p>
              </div>

              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, marginBottom: '1rem' }}>
                  2
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>School Subscribes</h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                  When the school completes onboarding and pays their subscription fee for the term, 50% is credited to your balance instantly.
                </p>
              </div>

              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, marginBottom: '1rem' }}>
                  3
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Take Money On Your MoMo</h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                  Click Request Payment, input the contact number where you want the funds, and receive your money via MTN MoMo, Telecel, or AirtelTigo.
                </p>
              </div>
            </div>

          </div>
        ) : (
          /* ── LOGGED IN: Agent Live Dashboard ── */
          <div>
            
            {/* Top Partner Profile Banner */}
            <div style={{ background: '#1e293b', borderRadius: '20px', border: '1px solid #334155', padding: '1.75rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f8fafc' }}>{portalData.agent.fullName}</span>
                  <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '999px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    ● 50% 1-Term Partner
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  Account Phone: <strong style={{ color: '#cbd5e1' }}>{portalData.agent.phone}</strong> {portalData.agent.email && `• ${portalData.agent.email}`}
                </div>
              </div>

              {/* Referral Code & Share CTA */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#0f172a', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid #475569', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800, display: 'block' }}>Your Partner Code</span>
                    <strong style={{ fontSize: '1.1rem', color: '#f59e0b', letterSpacing: '0.05em' }}>{portalData.agent.referralCode}</strong>
                  </div>
                  <button
                    onClick={() => copyToClipboard(portalData.agent.referralCode, 'code')}
                    style={{ background: '#334155', border: 'none', color: '#f8fafc', padding: '0.4rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}
                  >
                    {copiedCode ? '✓ Copied' : 'Copy'}
                  </button>
                </div>

                <button
                  onClick={() => copyToClipboard(getReferralUrl(), 'link')}
                  style={{ background: '#2563eb', border: 'none', color: '#ffffff', padding: '0.75rem 1.1rem', borderRadius: '12px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' }}
                >
                  <i className="fa-solid fa-copy"></i>
                  {copiedLink ? 'Link Copied!' : 'Copy Invite Link'}
                </button>

                <button
                  onClick={shareOnWhatsApp}
                  style={{ background: '#16a34a', border: 'none', color: '#ffffff', padding: '0.75rem 1.1rem', borderRadius: '12px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)' }}
                >
                  <i className="fa-brands fa-whatsapp" style={{ fontSize: '1.1rem' }}></i>
                  WhatsApp
                </button>
              </div>
            </div>

            {/* ── Sub Navigation Tabs (Overview / Leads / Marketing Kit) ── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1.75rem', background: '#0f172a', padding: '6px', borderRadius: '14px', border: '1px solid #334155', width: 'fit-content' }}>
              <button
                type="button"
                onClick={() => setPortalTab('overview')}
                style={{
                  background: portalTab === 'overview' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
                  color: portalTab === 'overview' ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-chart-pie" />
                Overview &amp; Balance
              </button>

              <button
                type="button"
                onClick={() => setPortalTab('leads')}
                style={{
                  background: portalTab === 'leads' ? '#334155' : 'transparent',
                  color: portalTab === 'leads' ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-bullseye" />
                Captured Leads (60-Day Lock)
                {portalData.leads?.length > 0 && (
                  <span style={{ background: '#f59e0b', color: '#0f172a', fontSize: '0.7rem', fontWeight: 900, padding: '0.1rem 0.45rem', borderRadius: '999px' }}>
                    {portalData.leads.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPortalTab('marketing')}
                style={{
                  background: portalTab === 'marketing' ? '#334155' : 'transparent',
                  color: portalTab === 'marketing' ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-qrcode" />
                Marketing Kit &amp; QR Flyer
              </button>

              <button
                type="button"
                onClick={() => setPortalTab('guide')}
                style={{
                  background: portalTab === 'guide' ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'transparent',
                  color: portalTab === 'guide' ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-book-open" />
                App Info &amp; Commission Rules
              </button>
            </div>

            {portalTab === 'overview' && (
              <>
            {/* ── Partner Quick Briefing: App, 1-Term Free & Payout Policy ── */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '20px', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-lightbulb" style={{ fontSize: '1.1rem' }}></i>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#f8fafc' }}>
                      Partner Guide: What You Are Selling &amp; How You Get Paid
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                      Key knowledge every referral partner must know before recommending schools.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPortalTab('guide')}
                  style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-circle-question"></i> View Detailed Guide &amp; FAQs →
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {/* 1. What The App Does */}
                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '14px', padding: '1.2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.6rem' }}>
                      <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 900 }}>1</span>
                      <strong style={{ fontSize: '0.92rem', color: '#f8fafc' }}>Automated Report Cards</strong>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 0.5rem 0' }}>
                      The platform completely stops teachers from hand-writing report cards. It calculates:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.6 }}>
                      <li>GES standard continuous SBA scores &amp; exam totals</li>
                      <li>Automated class positions, rankings &amp; remarks</li>
                      <li>Clean printable termly student report cards</li>
                    </ul>
                  </div>
                  <div style={{ marginTop: '0.8rem', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700 }}>
                    💡 Saves schools weeks of stressful paperwork.
                  </div>
                </div>

                {/* 2. 1 Term Free */}
                <div style={{ background: '#0f172a', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '14px', padding: '1.2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.6rem' }}>
                      <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 900 }}>2</span>
                      <strong style={{ fontSize: '0.92rem', color: '#34d399' }}>1st Term 100% Free For Schools</strong>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 0.5rem 0' }}>
                      Every school you refer gets their entire <strong>first term free</strong> with full feature access:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.6 }}>
                      <li>Zero upfront payment required from the school</li>
                      <li>They can register teachers &amp; print real reports</li>
                      <li>Your pitch: <em>"Test it free for 1 term, pay nothing upfront!"</em></li>
                    </ul>
                  </div>
                  <div style={{ marginTop: '0.8rem', fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>
                    🎁 Zero financial risk for headteachers to say YES.
                  </div>
                </div>

                {/* 3. Payout Rule */}
                <div style={{ background: '#0f172a', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '14px', padding: '1.2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.6rem' }}>
                      <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 900 }}>3</span>
                      <strong style={{ fontSize: '0.92rem', color: '#fbbf24' }}>50% Paid Upon Subscription</strong>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 0.5rem 0' }}>
                      You receive your 50% commission <strong>only after the school pays their subscription</strong>:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.6 }}>
                      <li><strong>Term 1 (Free Term):</strong> School pays GH₵0, so no cashout yet.</li>
                      <li><strong>Term 2 (First Paid Term):</strong> School pays subscription → <strong>50% instantly credited to you</strong>!</li>
                      <li>Instant cashout straight to your MoMo or Bank.</li>
                    </ul>
                  </div>
                  <div style={{ marginTop: '0.8rem', fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700 }}>
                    ⚡ Money drops into your balance right after school pays.
                  </div>
                </div>
              </div>
            </div>

            {/* ── Financial KPI Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              
              {/* Ready for Withdrawal */}
              <div style={{ background: '#1e293b', border: '1px solid #10b981', borderRadius: '18px', padding: '1.4rem', borderLeft: '5px solid #10b981', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.1)' }}>
                <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Available For Withdrawal
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#34d399', margin: '0.35rem 0' }}>
                  GH₵ {Number(portalData.agent.pendingPayout || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <button
                  onClick={handleOpenPayoutModal}
                  disabled={Number(portalData.agent.pendingPayout || 0) <= 0}
                  style={{
                    marginTop: '0.5rem',
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '10px',
                    background: Number(portalData.agent.pendingPayout || 0) > 0 ? 'linear-gradient(135deg, #10b981, #059669)' : '#334155',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: Number(portalData.agent.pendingPayout || 0) > 0 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <i className="fa-solid fa-money-bill-transfer"></i>
                  Request Payment
                </button>
              </div>

              {/* In Request Queue */}
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '18px', padding: '1.4rem', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pending Disbursal
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fbbf24', margin: '0.35rem 0' }}>
                  GH₵ {Number(portalData.agent.heldInRequest || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Awaiting admin MoMo transfer</div>
              </div>

              {/* Total Earned */}
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '18px', padding: '1.4rem', borderLeft: '4px solid #3b82f6' }}>
                <div style={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total 50% Earned
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#60a5fa', margin: '0.35rem 0' }}>
                  GH₵ {Number(portalData.agent.totalEarned || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>1-Term commission total</div>
              </div>

              {/* Total Disbursed */}
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '18px', padding: '1.4rem', borderLeft: '4px solid #8b5cf6' }}>
                <div style={{ fontSize: '0.72rem', color: '#a78bfa', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Paid To You
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#a78bfa', margin: '0.35rem 0' }}>
                  GH₵ {Number(portalData.agent.totalPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Received via Mobile Money</div>
              </div>

            </div>

            {/* ── Referred Schools Table ── */}
            <div style={{ background: '#1e293b', borderRadius: '20px', border: '1px solid #334155', overflow: 'hidden', marginBottom: '2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-school" style={{ color: '#f59e0b' }}></i>
                  Referred Schools ({portalData.schools?.length || 0})
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Benefit: 50% for 1st Paid Term</span>
              </div>

              {portalData.schools && portalData.schools.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                        <th style={{ padding: '0.85rem 1.25rem' }}>School Name</th>
                        <th style={{ padding: '0.85rem 1rem' }}>Location</th>
                        <th style={{ padding: '0.85rem 1rem' }}>Subscription Status</th>
                        <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Your 50% Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portalData.schools.map((s, idx) => (
                        <tr key={s.id || idx} style={{ borderBottom: '1px solid #334155' }}>
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <div style={{ fontWeight: 700, color: '#f8fafc' }}>{s.name}</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>ID: {s.id}</div>
                          </td>
                          <td style={{ padding: '1rem', color: '#cbd5e1' }}>{s.location}</td>
                          <td style={{ padding: '1rem' }}>
                            {s.isTerm1Rewarded ? (
                              <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '0.3rem 0.65rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                ✓ Term 1 Paid & Rewarded
                              </span>
                            ) : (
                              <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '0.3rem 0.65rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                ⏳ Onboarding / Pending Term Bill
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right' }}>
                            <strong style={{ fontSize: '0.95rem', color: s.commissionAmount > 0 ? '#34d399' : '#94a3b8' }}>
                              GH₵ {Number(s.commissionAmount || 0).toFixed(2)}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                  <i className="fa-solid fa-share-nodes" style={{ fontSize: '2rem', color: '#475569', marginBottom: '0.75rem', display: 'block' }}></i>
                  You haven't referred any schools yet. Share your partner code or WhatsApp link above to start earning!
                </div>
              )}
            </div>

            {/* ── Withdrawal Requests & MoMo Receipts History ── */}
            <div style={{ background: '#1e293b', borderRadius: '20px', border: '1px solid #334155', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-receipt" style={{ color: '#10b981' }}></i>
                  Payout Requests & Receipts
                </h3>
              </div>

              {portalData.payoutRequests && portalData.payoutRequests.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                        <th style={{ padding: '0.85rem 1.25rem' }}>Request Date</th>
                        <th style={{ padding: '0.85rem 1rem' }}>Amount</th>
                        <th style={{ padding: '0.85rem 1rem' }}>Destination Contact</th>
                        <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                        <th style={{ padding: '0.85rem 1.25rem' }}>Receipt / Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portalData.payoutRequests.map((req) => (
                        <tr key={req.id} style={{ borderBottom: '1px solid #334155' }}>
                          <td style={{ padding: '1rem 1.25rem', color: '#cbd5e1' }}>
                            {new Date(req.requestedAt).toLocaleDateString()} {new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '1rem', fontWeight: 800, color: '#f8fafc' }}>
                            GH₵ {Number(req.amount).toFixed(2)}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ fontWeight: 700, color: '#f8fafc' }}>{req.payoutContact}</div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{req.payoutNetwork} ({req.payoutAccountName})</div>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            {req.status === 'DISBURSED' ? (
                              <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '0.3rem 0.65rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800 }}>
                                ✓ Disbursed
                              </span>
                            ) : req.status === 'REJECTED' ? (
                              <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '0.3rem 0.65rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800 }}>
                                ✕ Rejected
                              </span>
                            ) : (
                              <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '0.3rem 0.65rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800 }}>
                                ⏳ Pending Review
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '1rem 1.25rem' }}>
                            {req.disbursalReference ? (
                              <code style={{ background: '#0f172a', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', color: '#38bdf8' }}>
                                {req.disbursalReference}
                              </code>
                            ) : (
                              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Pending transfer</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                  No payment requests yet. When commissions are credited to your balance, click "Request Payment" to receive your money.
                </div>
              )}
            </div>
          </>
        )}

        {/* ── TAB 2: CAPTURED LEADS (60-DAY ATTRIBUTION LOCK) ── */}
        {portalTab === 'leads' && (
          <div>
            {/* Lead Funnel Explainer Card */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '20px', padding: '1.75rem', marginBottom: '1.75rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.25rem' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 800, marginBottom: '0.4rem' }}>
                  <i className="fa-solid fa-lock"></i> 60-DAY COOKIE / ATTRIBUTION GUARANTEE
                </div>
                <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                  Share Your School Demo Booking Link
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', maxWidth: '600px', lineHeight: 1.5 }}>
                  Headteachers who book a demo through your link are <strong>locked to your partner account for 60 days</strong>. Even if they register weeks later, you automatically receive your 50% commission!
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={getDemoUrl()}
                  style={{ background: '#0f172a', border: '1px solid #475569', color: '#f8fafc', padding: '0.65rem 0.9rem', borderRadius: '10px', fontSize: '0.85rem', width: '260px', outline: 'none' }}
                />
                <button
                  onClick={() => {
                    copyToClipboard(getDemoUrl(), 'demo');
                    setCopiedDemoLink(true);
                    setTimeout(() => setCopiedDemoLink(false), 2500);
                  }}
                  style={{ background: '#f59e0b', border: 'none', color: '#0f172a', padding: '0.65rem 1rem', borderRadius: '10px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  {copiedDemoLink ? '✓ Copied' : 'Copy Demo Link'}
                </button>
              </div>
            </div>

            {/* Leads Table */}
            <div style={{ background: '#1e293b', borderRadius: '20px', border: '1px solid #334155', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-users-viewfinder" style={{ color: '#38bdf8' }}></i>
                  My Captured Leads ({portalData.leads?.length || 0})
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>60-Day Lock Active</span>
              </div>

              {portalData.leads && portalData.leads.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                        <th style={{ padding: '0.85rem 1.25rem' }}>School Name</th>
                        <th style={{ padding: '0.85rem 1rem' }}>Contact Person &amp; Phone</th>
                        <th style={{ padding: '0.85rem 1rem' }}>Region</th>
                        <th style={{ padding: '0.85rem 1rem' }}>Attribution Lock</th>
                        <th style={{ padding: '0.85rem 1.25rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portalData.leads.map((lead) => (
                        <tr key={lead.id} style={{ borderBottom: '1px solid #334155' }}>
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <div style={{ fontWeight: 800, color: '#f8fafc' }}>{lead.schoolName}</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Date: {new Date(lead.createdAt).toLocaleDateString()}</div>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ fontWeight: 700, color: '#f8fafc' }}>{lead.contactPerson}</div>
                            <div style={{ fontSize: '0.72rem', color: '#38bdf8' }}>{lead.phone}</div>
                          </td>
                          <td style={{ padding: '1rem', color: '#cbd5e1' }}>{lead.region || 'Ghana'}</td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{ background: lead.isExpired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: lead.isExpired ? '#f87171' : '#34d399', padding: '0.3rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
                              {lead.isExpired ? 'Expired' : `${lead.daysRemaining} days remaining`}
                            </span>
                          </td>
                          <td style={{ padding: '1rem 1.25rem' }}>
                            {lead.status === 'CONVERTED' ? (
                              <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.3rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
                                ✓ Registered School
                              </span>
                            ) : (
                              <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '0.3rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
                                ⏳ Demo Scheduled
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                  <i className="fa-solid fa-bullseye" style={{ fontSize: '2rem', color: '#475569', marginBottom: '0.75rem', display: 'block' }}></i>
                  No leads captured yet. Share your Demo Booking Link (<code>{getDemoUrl()}</code>) with school heads to start building your pipeline!
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: MARKETING TOOLKIT & PRINTABLE QR FLYER (OPTION 4) ── */}
        {portalTab === 'marketing' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
              
              {/* Left Column: Printable School Promotion Flyer */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                    Personalized Printable Flyer
                  </h3>
                  <button
                    onClick={() => window.print()}
                    style={{ background: '#f59e0b', border: 'none', color: '#0f172a', padding: '0.55rem 1rem', borderRadius: '10px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}
                  >
                    <i className="fa-solid fa-print"></i>
                    Print / Save Flyer PDF
                  </button>
                </div>

                {/* Printable Flyer Visual Card */}
                <div id="partner-printable-flyer" style={{ background: '#ffffff', color: '#0f172a', borderRadius: '20px', padding: '2rem', border: '3px solid #f59e0b', boxShadow: '0 15px 35px rgba(0,0,0,0.3)', position: 'relative' }}>
                  
                  {/* Flyer Top Header */}
                  <div style={{ textAlign: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#d97706', marginBottom: '0.25rem' }}>
                      Ghana Educational Innovation
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.35rem 0', color: '#0f172a' }}>
                      Labour Educational Portal
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                      Complete School Management &amp; Automated GES Terminal Reports
                    </p>
                  </div>

                  {/* Highlights Grid */}
                  <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '1rem', marginBottom: '1.25rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      ✨ What Headteachers Love:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.82rem', color: '#334155', lineHeight: 1.6 }}>
                      <li><strong>Instant Terminal Reports:</strong> Hand-writing report cards is now history.</li>
                      <li><strong>Automated SBA Grading:</strong> Computes subject scores, class positions &amp; grades.</li>
                      <li><strong>Parent Fee Collection:</strong> Direct Mobile Money payment reconciliation.</li>
                      <li><strong>First Term Free:</strong> Full unlocked system access during onboarding!</li>
                    </ul>
                  </div>

                  {/* Center: Dynamic High-Res QR Code */}
                  <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'inline-block', padding: '12px', background: '#ffffff', borderRadius: '16px', border: '2px dashed #d97706', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(getReferralUrl())}`}
                        alt="Partner Referral QR Code"
                        style={{ width: '160px', height: '160px', display: 'block' }}
                      />
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', marginTop: '0.5rem' }}>
                      Scan QR code with any phone camera to register school
                    </div>
                  </div>

                  {/* Flyer Footer Badge */}
                  <div style={{ background: '#fef3c7', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid #fde68a', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 800, textTransform: 'uppercase' }}>
                      Official School Representative
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#78350f' }}>
                      {portalData.agent.fullName}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 700, marginTop: '0.2rem' }}>
                      Partner Code: <code style={{ background: '#ffffff', padding: '0.15rem 0.5rem', borderRadius: '6px', border: '1px solid #fcd34d' }}>{portalData.agent.referralCode}</code>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#78350f', marginTop: '0.25rem' }}>
                      Phone / WhatsApp: <strong>{portalData.agent.phone}</strong>
                    </div>
                  </div>

                </div>
              </div>

              {/* Right Column: Copy-Paste Pitch Scripts */}
              <div>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                  Proven Marketing &amp; Sales Scripts
                </h3>
                <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                  Copy and send these ready-made messages directly to headteachers, school proprietors, and education forums.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {portalData.marketingScripts?.map((script) => (
                    <div key={script.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#f59e0b' }}>
                          {script.title}
                        </h4>
                        <button
                          onClick={() => copyScriptText(script.id, script.text)}
                          style={{ background: '#334155', border: 'none', color: '#f8fafc', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {copiedScriptId === script.id ? '✓ Copied' : 'Copy Script'}
                        </button>
                      </div>

                      <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                        {script.description}
                      </p>

                      <pre style={{ margin: 0, background: '#0f172a', padding: '0.85rem', borderRadius: '10px', fontSize: '0.78rem', color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontFamily: 'inherit', border: '1px solid #334155', maxHeight: '180px', overflowY: 'auto' }}>
                        {script.text}
                      </pre>

                      <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => {
                            const encoded = encodeURIComponent(script.text);
                            window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
                          }}
                          style={{ background: 'rgba(22, 163, 74, 0.15)', border: '1px solid rgba(22, 163, 74, 0.4)', color: '#4ade80', padding: '0.4rem 0.85rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <i className="fa-brands fa-whatsapp"></i> Send on WhatsApp
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

              </div>

            </div>
          </div>
        )}

        {/* ── TAB 4: APP INFO, REPORT CARDS & COMMISSION RULES ── */}
        {portalTab === 'guide' && (
          <div style={{ maxWidth: '980px', margin: '0 auto' }}>
            {/* Header Banner */}
            <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '1px solid #334155', borderRadius: '24px', padding: '2rem', marginBottom: '2rem', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '0.35rem 0.85rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 800, marginBottom: '0.85rem' }}>
                <i className="fa-solid fa-graduation-cap"></i> PARTNER EDUCATION &amp; POLICY
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 900, margin: '0 0 0.5rem 0', color: '#f8fafc', letterSpacing: '-0.02em' }}>
                Everything You Need to Know: App Features &amp; Payout Rules
              </h2>
              <p style={{ margin: 0, fontSize: '0.92rem', color: '#94a3b8', lineHeight: 1.6 }}>
                Master how the Labour Educational System empowers schools, how to leverage the <strong>1-Term Free</strong> guarantee, and exactly how and when you get paid your <strong>50% commission</strong>.
              </p>
            </div>

            {/* Section 1: What The App Does (Report Cards & School Management) */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '20px', padding: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                  <i className="fa-solid fa-file-invoice"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                    1. What The App Does: Automated Terminal Report Cards
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                    How the platform solves the biggest headache facing schools every single term.
                  </p>
                </div>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.25rem', color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.6 }}>
                <strong style={{ color: '#f8fafc' }}>The Problem:</strong> In most schools, teachers spend 2 to 3 weeks hand-writing hundreds of terminal report cards by hand. They calculate percentages manually, make calculation mistakes, struggle to rank student positions, and end up with messy, damaged paper sheets.
                <br /><br />
                <strong style={{ color: '#38bdf8' }}>Our Solution:</strong> The Labour Educational System automates everything in seconds. Teachers simply type scores or import them, and the system produces clean, standardized, GES-compliant terminal reports ready to print or send to parents.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-calculator"></i> Automatic SBA &amp; Exam Scoring
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                    Computes Class SBA continuous assessments (exercises, projects, tests) and exam scores automatically without mathematical errors.
                  </p>
                </div>

                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-ranking-star"></i> Class Positions &amp; Grades
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                    Ranks students (1st, 2nd, 3rd) across class streams instantly and maps marks to official GES letter grades and teacher remarks.
                  </p>
                </div>

                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-table-list"></i> Master Broadsheets
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                    Generates full class performance summaries and broadsheets required for staff academic meetings and GES circuit supervisor inspections.
                  </p>
                </div>

                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-money-bill-wave"></i> Fee Tracking &amp; MoMo
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                    Schools track student school fees and reconcile Mobile Money payments directly inside the system.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: 1-Term Free Guarantee */}
            <div style={{ background: '#1e293b', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '20px', padding: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                  <i className="fa-solid fa-gift"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>
                    2. The "1st Term 100% Free" Guarantee
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                    Why referring schools is easy: Schools risk zero cedis to try the platform.
                  </p>
                </div>
              </div>

              <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 1.25rem 0' }}>
                Every single school that registers through your referral link or partner code is awarded <strong>1 Full Academic Term completely FREE</strong> of charge.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ color: '#10b981', fontWeight: 800, fontSize: '0.88rem', marginBottom: '0.35rem' }}>
                    ✓ Full Unlocked System Access
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                    The school is not restricted. They can enroll all their classes, add teachers, and print real end-of-term report cards.
                  </p>
                </div>

                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ color: '#10b981', fontWeight: 800, fontSize: '0.88rem', marginBottom: '0.35rem' }}>
                    ✓ No Upfront Payment Required
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                    The headteacher doesn't need to commit money or pay any setup fee. They just register and begin working.
                  </p>
                </div>

                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ color: '#10b981', fontWeight: 800, fontSize: '0.88rem', marginBottom: '0.35rem' }}>
                    ✓ The Irresistible Pitch
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                    Tell headteachers: <em>"Use it for free this whole term. Generate all your report cards. If you don't love it, you pay nothing!"</em>
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: When & How You Get Paid (50% Commission Rule) */}
            <div style={{ background: '#1e293b', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '20px', padding: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                  <i className="fa-solid fa-money-bill-transfer"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24' }}>
                    3. How &amp; When You Get Paid (50% Commission Policy)
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                    Crucial rule: Commission is paid upon the school's subscription payment.
                  </p>
                </div>
              </div>

              {/* Warning Alert Box */}
              <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.5rem', color: '#fef08a', fontSize: '0.88rem', lineHeight: 1.6 }}>
                <strong>⚠️ Clear Payout Condition:</strong> You get paid your 50% commission <strong>only after the referred school makes their subscription payment</strong>. Because the school’s first term is 100% free, no money is collected from the school during Term 1. Your commission is earned when the school subscribes for their next term.
              </div>

              {/* Timeline Sequence */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '14px', padding: '1.2rem', position: 'relative' }}>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Step 1</div>
                  <strong style={{ fontSize: '0.95rem', color: '#f8fafc', display: 'block', margin: '0.25rem 0' }}>School Registers</strong>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                    The school signs up using your code. The school is permanently linked to your account.
                  </p>
                </div>

                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '14px', padding: '1.2rem', position: 'relative' }}>
                  <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase' }}>Step 2 (Term 1)</div>
                  <strong style={{ fontSize: '0.95rem', color: '#34d399', display: 'block', margin: '0.25rem 0' }}>Free Trial Term</strong>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                    School generates report cards for free. Fee paid is GH₵0, so no cashout is generated yet.
                  </p>
                </div>

                <div style={{ background: '#0f172a', border: '1px solid #f59e0b', borderRadius: '14px', padding: '1.2rem', position: 'relative' }}>
                  <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase' }}>Step 3 (Term 2)</div>
                  <strong style={{ fontSize: '0.95rem', color: '#fbbf24', display: 'block', margin: '0.25rem 0' }}>School Pays Subscription</strong>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                    School pays their term subscription. <strong>50% is instantly credited to your wallet</strong>!
                  </p>
                </div>

                <div style={{ background: '#0f172a', border: '1px solid #10b981', borderRadius: '14px', padding: '1.2rem', position: 'relative' }}>
                  <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase' }}>Step 4</div>
                  <strong style={{ fontSize: '0.95rem', color: '#34d399', display: 'block', margin: '0.25rem 0' }}>MoMo Withdrawal</strong>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                    You click "Request Payment" and cash out straight to MTN MoMo, Telecel, AirtelTigo, or Bank!
                  </p>
                </div>
              </div>

              {/* Real Earnings Example */}
              <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '14px', padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>
                  💰 Real-World Earnings Example:
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                  If you refer a school with 250 learners paying GH₵2 per student (GH₵500 term subscription):
                  <br />
                  • The school's 1st term is <strong>GH₵0 (Free)</strong>.
                  <br />
                  • When they pay GH₵500 for the next term, you receive <strong>GH₵250.00 cash (50%)</strong>!
                  <br />
                  • If you refer <strong>10 schools</strong>, you earn <strong>GH₵2,500.00</strong> on your phone.
                </p>
              </div>
            </div>

            {/* Section 4: Frequently Asked Questions */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '20px', padding: '2rem' }}>
              <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-circle-question" style={{ color: '#38bdf8' }}></i>
                Frequently Asked Questions for Partners
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#0f172a', borderRadius: '12px', padding: '1rem', border: '1px solid #334155' }}>
                  <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                    Q: Can a school claim they were not referred by me?
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
                    No! Once a school registers with your referral code or clicks your demo link, our system permanently locks that school to your Agent ID. No other agent can claim them.
                  </p>
                </div>

                <div style={{ background: '#0f172a', borderRadius: '12px', padding: '1rem', border: '1px solid #334155' }}>
                  <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                    Q: How do I know when a school I referred registers or pays?
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
                    You receive real-time notifications on WhatsApp, and your partner dashboard updates immediately under "Referred Schools" and "Available For Withdrawal".
                  </p>
                </div>

                <div style={{ background: '#0f172a', borderRadius: '12px', padding: '1rem', border: '1px solid #334155' }}>
                  <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                    Q: How fast are Mobile Money payouts processed?
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
                    Payout requests are reviewed and disbursed promptly to your specified MTN MoMo, Telecel Cash, or AirtelTigo number.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    )}

      </main>

      {/* ── Request Payment Modal ── */}
      {showPayoutModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '24px', width: '100%', maxWidth: '480px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative' }}>
            
            <button
              onClick={() => setShowPayoutModal(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#334155', border: 'none', color: '#cbd5e1', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ✕
            </button>

            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc' }}>
              Request Payment
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Enter the contact number where you want the funds sent.
            </p>

            {payoutError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                {payoutError}
              </div>
            )}

            <form onSubmit={handleSubmitPayoutRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Amount Input */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1' }}>Amount to Withdraw (GH₵)</label>
                  <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700 }}>
                    Max: GH₵ {Number(portalData?.agent?.pendingPayout || 0).toFixed(2)}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  max={portalData?.agent?.pendingPayout || 0}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #475569', color: '#34d399', fontSize: '1.1rem', fontWeight: 800, outline: 'none' }}
                />
              </div>

              {/* Network Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>Payment Method / Network</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {NETWORKS.map(net => (
                    <button
                      key={net.id}
                      type="button"
                      onClick={() => setPayoutNetwork(net.id)}
                      style={{
                        background: payoutNetwork === net.id ? 'rgba(245, 158, 11, 0.15)' : '#0f172a',
                        border: payoutNetwork === net.id ? '2px solid #f59e0b' : '1px solid #334155',
                        color: payoutNetwork === net.id ? '#fbbf24' : '#cbd5e1',
                        padding: '0.65rem 0.5rem',
                        borderRadius: '10px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <i className={`fa-solid ${net.icon}`} style={{ color: net.color }}></i>
                      {net.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Destination Contact Number (The core user requirement) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Contact / MoMo Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 0244123456"
                  value={payoutContact}
                  onChange={(e) => setPayoutContact(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #475569', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem', display: 'block' }}>
                  Enter the phone number where you want to take the money on.
                </span>
              </div>

              {/* Account Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Registered Account Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kofi Mensah"
                  value={payoutAccountName}
                  onChange={(e) => setPayoutAccountName(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #475569', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                  Ensure this matches the registered name on your MoMo sim card.
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={requestingPayout}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  cursor: requestingPayout ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                }}
              >
                {requestingPayout ? 'Submitting Request...' : 'Confirm & Request Payout'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: iOS Add to Home Screen Instructions ──────────── */}
      {showIosGuide && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '1.25rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '24px', width: '100%', maxWidth: '380px', padding: '1.75rem', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              <i className="fa-brands fa-apple" style={{ color: '#38bdf8', fontSize: '2rem' }}></i>
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
              Install on iPhone / iPad
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
              Add your Partner Portal directly to your iPhone home screen:
            </p>
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '14px', textAlign: 'left', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '1.25rem', border: '1px solid #334155' }}>
              <div style={{ marginBottom: '0.6rem', display: 'flex', gap: '8px' }}>
                <span style={{ color: '#38bdf8', fontWeight: 800 }}>1.</span>
                <span>Tap the <strong>Share</strong> button at the bottom of Safari (<i className="fa-solid fa-arrow-up-from-bracket" style={{ color: '#38bdf8' }}></i>).</span>
              </div>
              <div style={{ marginBottom: '0.6rem', display: 'flex', gap: '8px' }}>
                <span style={{ color: '#38bdf8', fontWeight: 800 }}>2.</span>
                <span>Scroll down and tap <strong>"Add to Home Screen"</strong> (<i className="fa-solid fa-square-plus" style={{ color: '#f59e0b' }}></i>).</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: '#38bdf8', fontWeight: 800 }}>3.</span>
                <span>Tap <strong>Add</strong> at top right. Done!</span>
              </div>
            </div>
            <button
              onClick={() => setShowIosGuide(false)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', background: '#3b82f6', border: 'none', color: '#ffffff', fontWeight: 800, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: Welcome Onboarding Briefing for Newly Registered Agents ── */}
      {showWelcomeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 130, padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '2px solid #f59e0b', borderRadius: '24px', width: '100%', maxWidth: '540px', padding: '2rem', boxShadow: '0 25px 60px -12px rgba(245, 158, 11, 0.25)', position: 'relative' }}>
            
            <button
              onClick={() => setShowWelcomeModal(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#334155', border: 'none', color: '#cbd5e1', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}
            >
              ✕
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto', boxShadow: '0 8px 20px rgba(245, 158, 11, 0.4)' }}>
                <i className="fa-solid fa-handshake-angle" style={{ color: '#ffffff', fontSize: '1.75rem' }}></i>
              </div>
              <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.4rem', fontWeight: 900, color: '#f8fafc' }}>
                Welcome to the Partner Program! 🎉
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                Your account is ready! Here are the 3 key rules to start earning:
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
              
              {/* Point 1: What app does */}
              <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 900, fontSize: '0.85rem' }}>
                  1
                </div>
                <div>
                  <strong style={{ fontSize: '0.88rem', color: '#f8fafc', display: 'block' }}>What The App Does: Automated Report Cards</strong>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4, display: 'block' }}>
                    Stops teachers from hand-writing reports. Computes SBA continuous assessment, exam totals, class positions, remarks &amp; printable GES report cards automatically.
                  </span>
                </div>
              </div>

              {/* Point 2: 1 Term Free */}
              <div style={{ background: '#0f172a', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 900, fontSize: '0.85rem' }}>
                  2
                </div>
                <div>
                  <strong style={{ fontSize: '0.88rem', color: '#34d399', display: 'block' }}>1 Full Term 100% Free For Schools</strong>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4, display: 'block' }}>
                    Every school you refer pays GH₵0 upfront for their first onboarding term. They can test and generate report cards for all classes completely free of charge!
                  </span>
                </div>
              </div>

              {/* Point 3: Payout Condition */}
              <div style={{ background: '#0f172a', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 900, fontSize: '0.85rem' }}>
                  3
                </div>
                <div>
                  <strong style={{ fontSize: '0.88rem', color: '#fbbf24', display: 'block' }}>When You Get Paid (50% Commission)</strong>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4, display: 'block' }}>
                    Because Term 1 is free for the school, you get paid your <strong>50% commission as soon as the school pays their subscription</strong> for their next term. Instant cashout to Mobile Money!
                  </span>
                </div>
              </div>

            </div>

            <button
              onClick={() => setShowWelcomeModal(false)}
              style={{
                width: '100%',
                padding: '0.9rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>I Understand — Take Me To My Dashboard</span>
              <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
