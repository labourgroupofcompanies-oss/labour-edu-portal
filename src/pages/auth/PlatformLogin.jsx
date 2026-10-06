import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import authService from '../../services/authService';

const PlatformLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both administrative email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(email.trim(), password);
      const user = await authService.getCurrentUser();
      
      const isSuper = user?.role === 'super_admin' || user?.role === 'platform_developer' || user?.isPlatformDeveloper || (user?.email || '').toLowerCase() === 'shrtgallery3@gmail.com';
      if (!isSuper) {
        await authService.logout();
        throw new Error('Access denied: This portal is strictly restricted to Super Administrators and Platform Developers.');
      }

      navigate('/operations');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#09090b',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '20px',
        padding: '2.5rem 2rem',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src="/app-icon.png"
            alt="Labour Admin"
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              objectFit: 'contain',
              background: '#09090b',
              border: '1px solid #27272a',
              padding: '6px',
              boxShadow: '0 4px 18px rgba(37, 99, 235, 0.4)'
            }}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/logo.png';
            }}
          />
          <h1 style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            color: '#FFFFFF',
            fontFamily: 'Outfit, sans-serif',
            marginTop: '1rem',
            marginBottom: '0.25rem'
          }}>
            Platform Administration
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>
            Super Admin &amp; Developer Console
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#EF4444',
            padding: '0.85rem 1rem',
            borderRadius: '12px',
            fontSize: '0.82rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <i className="fas fa-circle-exclamation" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#A1A1AA', fontWeight: 600, marginBottom: '0.4rem' }}>
              Admin Email
            </label>
            <div style={{ position: 'relative' }}>
              <i className="fas fa-envelope" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@laboureducation.com"
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.85rem 1rem 0.85rem 2.75rem',
                  borderRadius: '12px',
                  background: '#09090b',
                  border: '1px solid #27272a',
                  color: '#FFFFFF',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#A1A1AA', fontWeight: 600, marginBottom: '0.4rem' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <i className="fas fa-lock" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.85rem 2.75rem 0.85rem 2.75rem',
                  borderRadius: '12px',
                  background: '#09090b',
                  border: '1px solid #27272a',
                  color: '#FFFFFF',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#71717a',
                  cursor: 'pointer'
                }}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
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
              background: '#2563eb',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? (
              <><i className="fas fa-spinner fa-spin" /> Authenticating...</>
            ) : (
              <><i className="fas fa-shield-halved" /> Sign In to Console</>
            )}
          </button>
        </form>

        <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid #27272a', textAlign: 'center', fontSize: '0.8rem', color: '#71717a' }}>
          Need initial Super Admin access?{' '}
          <Link to="/register" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 700 }}>
            Register Platform Key
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PlatformLogin;
