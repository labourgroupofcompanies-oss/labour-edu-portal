import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { PlatformNotificationProvider, usePlatformNotifications } from '../../context/PlatformNotificationContext';
import PlatformNotificationBell from '../operations/PlatformNotificationBell';
import PlatformToastContainer from '../operations/PlatformToastContainer';
import PlatformBroadcastBanner from '../common/PlatformBroadcastBanner';

const PlatformShellContent = () => {
  const { user, logout, stopImpersonation } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { markAllAsRead } = usePlatformNotifications();
  const [mobileModuleOpen, setMobileModuleOpen] = useState(false);

  const isDevPortal = location.pathname.startsWith('/platform/developer');
  const isOpsCenter = location.pathname.startsWith('/platform/operations');

  // Close mobile module menu on route change
  useEffect(() => {
    setMobileModuleOpen(false);
  }, [location.pathname]);

  // Automatically vanish / mark notifications as read when the Super Admin opens that specific page
  useEffect(() => {
    const timer = setTimeout(() => {
      if (location.pathname.startsWith('/platform/operations/ges-radar')) {
        markAllAsRead('radar');
      } else if (location.pathname.startsWith('/platform/operations/schools')) {
        markAllAsRead('schools');
      } else if (location.pathname.startsWith('/platform/operations/support')) {
        markAllAsRead('support');
      } else if (
        location.pathname.startsWith('/platform/operations/subscriptions') ||
        location.pathname.startsWith('/platform/operations/transactions')
      ) {
        markAllAsRead('billing');
      } else if (location.pathname === '/platform/operations' || location.pathname === '/platform/operations/') {
        markAllAsRead('dashboard');
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [location.pathname, markAllAsRead]);

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#FAFAFA', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Live Floating Toast Container */}
      <PlatformToastContainer />

      {/* Topmost Platform Header */}
      <header className="platform-shell-header" style={{
        height: '56px',
        background: '#09090b',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #222226',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        {/* Brand Logo & Platform Console Badge */}
        <div className="psh-brand" style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate('/platform/operations')}>
            <img
              className="psh-brand-logo"
              src="/logo.png"
              alt="Labour Logo"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                objectFit: 'contain',
                background: '#18181b',
                border: '1px solid #27272a',
                padding: '2px'
              }}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/app-icon.png';
              }}
            />
            <div className="psh-brand-text">
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fafafa', letterSpacing: '-0.01em' }}>
                Platform Administration
              </div>
              <div style={{ fontSize: '0.64rem', color: '#71717a', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Super Admin Console
              </div>
            </div>
          </div>

          {/* Module Switcher Tabs — Desktop */}
          <div className="psh-module-tabs" style={{ display: 'flex', gap: '2px', background: '#121215', padding: '3px', borderRadius: '8px', border: '1px solid #222226', marginLeft: '1rem' }}>
            <NavLink
              to="/platform/operations"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '0.38rem 0.85rem',
                borderRadius: '6px',
                background: isOpsCenter ? '#222226' : 'transparent',
                color: isOpsCenter ? '#fafafa' : '#71717a',
                fontSize: '0.8rem',
                fontWeight: 600,
                textDecoration: 'none',
                border: isOpsCenter ? '1px solid #2e2e33' : '1px solid transparent',
                transition: 'all 0.15s ease'
              }}
            >
              <i className="fas fa-tower-observation" style={{ fontSize: '0.75rem', color: isOpsCenter ? '#3b82f6' : '#71717a' }}></i>
              <span>Operations</span>
            </NavLink>

            <NavLink
              to="/platform/developer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '0.38rem 0.85rem',
                borderRadius: '6px',
                background: isDevPortal ? '#222226' : 'transparent',
                color: isDevPortal ? '#fafafa' : '#71717a',
                fontSize: '0.8rem',
                fontWeight: 600,
                textDecoration: 'none',
                border: isDevPortal ? '1px solid #2e2e33' : '1px solid transparent',
                transition: 'all 0.15s ease'
              }}
            >
              <i className="fas fa-code" style={{ fontSize: '0.75rem', color: isDevPortal ? '#3b82f6' : '#71717a' }}></i>
              <span>Developer Portal</span>
            </NavLink>
          </div>

          {/* Module Switcher — Mobile (icon-only toggle) */}
          <div className="psh-module-tabs-mobile" style={{ display: 'none', position: 'relative' }}>
            <button
              onClick={() => setMobileModuleOpen(!mobileModuleOpen)}
              style={{
                background: '#121215',
                border: '1px solid #222226',
                borderRadius: '7px',
                color: '#fafafa',
                padding: '0.35rem 0.65rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className={`fas ${isOpsCenter ? 'fa-tower-observation' : 'fa-code'}`} style={{ color: '#3b82f6', fontSize: '0.75rem' }}></i>
              <span>{isOpsCenter ? 'Ops' : 'Dev'}</span>
              <i className="fas fa-chevron-down" style={{ fontSize: '0.55rem', color: '#71717a' }}></i>
            </button>

            {mobileModuleOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                background: '#121215',
                border: '1px solid #27272a',
                borderRadius: '8px',
                padding: '0.35rem',
                zIndex: 999,
                minWidth: '160px',
                boxShadow: '0 12px 30px rgba(0,0,0,0.5)'
              }}>
                <NavLink
                  to="/platform/operations"
                  onClick={() => setMobileModuleOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '0.45rem 0.65rem', borderRadius: '6px',
                    background: isOpsCenter ? '#222226' : 'transparent',
                    color: isOpsCenter ? '#fff' : '#a1a1aa',
                    fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
                    marginBottom: '2px'
                  }}
                >
                  <i className="fas fa-tower-observation" style={{ fontSize: '0.75rem' }}></i>
                  <span>Operations</span>
                </NavLink>
                <NavLink
                  to="/platform/developer"
                  onClick={() => setMobileModuleOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '0.45rem 0.65rem', borderRadius: '6px',
                    background: isDevPortal ? '#222226' : 'transparent',
                    color: isDevPortal ? '#fff' : '#a1a1aa',
                    fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none'
                  }}
                >
                  <i className="fas fa-code" style={{ fontSize: '0.75rem' }}></i>
                  <span>Developer Portal</span>
                </NavLink>
              </div>
            )}
          </div>
        </div>

        {/* Notification Bell, User Badge & Exit */}
        <div className="psh-right" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Real-time Notification Bell */}
          <PlatformNotificationBell />

          <span className="psh-user-badge" style={{ fontSize: '0.75rem', color: '#71717a', background: '#121215', border: '1px solid #222226', padding: '0.3rem 0.65rem', borderRadius: '6px', fontWeight: 500 }}>
            <span style={{ color: '#fafafa', fontWeight: 600 }}>{user?.email || 'admin@laboureducation.com'}</span>
          </span>

          {user?.isImpersonating && (
            <button
              onClick={async () => {
                await stopImpersonation();
                navigate('/platform/operations');
              }}
              style={{
                padding: '0.35rem 0.7rem',
                borderRadius: '6px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: '#fbbf24',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fas fa-arrow-left" style={{ fontSize: '0.7rem' }}></i>
              <span className="psh-exit-text">Exit Remote ({user.schoolName})</span>
            </button>
          )}

          <button
            onClick={async () => {
              if (window.confirm('Are you sure you want to sign out of the Platform Console?')) {
                await logout();
                navigate('/login');
              }
            }}
            style={{
              padding: '0.35rem 0.7rem',
              borderRadius: '6px',
              background: 'transparent',
              border: '1px solid #27272a',
              color: '#a1a1aa',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#3f3f46'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.borderColor = '#27272a'; }}
          >
            <i className="fas fa-sign-out-alt" style={{ fontSize: '0.72rem' }}></i>
            <span className="psh-signout-text">Sign Out</span>
          </button>
        </div>
      </header>

      {/* GES & Platform Broadcast Notification Card */}
      <PlatformBroadcastBanner />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Outlet />
      </div>
    </div>
  );
};

const PlatformShellLayout = () => {
  return (
    <PlatformNotificationProvider>
      <PlatformShellContent />
    </PlatformNotificationProvider>
  );
};

export default PlatformShellLayout;
