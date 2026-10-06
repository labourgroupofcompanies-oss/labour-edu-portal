import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import agentReferralService from '../../services/agentReferralService';

export default function SchoolDemoRequest() {
  const [searchParams] = useSearchParams();
  const agentRef = searchParams.get('ref') || searchParams.get('code') || '';

  const [schoolName, setSchoolName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [region, setRegion] = useState('Greater Accra');
  const [estimatedLearners, setEstimatedLearners] = useState('200');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!schoolName.trim() || !phone.trim() || !contactPerson.trim()) {
      setErrorMessage('Please enter the School Name, Administrator Name, and Contact Phone.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const res = await agentReferralService.captureLead({
        agentCode: agentRef.trim(),
        schoolName: schoolName.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
        region: region.trim(),
        estimatedLearners: Number(estimatedLearners || 0),
        notes: notes.trim()
      });

      if (res.success) {
        setSubmitted(true);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit demo request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #1e293b 0%, #0f172a 100%)', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Top Header */}
      <header style={{ borderBottom: '1px solid #334155', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', padding: '1rem 1.5rem' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-graduation-cap" style={{ color: '#ffffff', fontSize: '1.1rem' }}></i>
            </div>
            <div>
              <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#f8fafc' }}>Labour Educational System</span>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Ghana School Management &amp; Report Cards</span>
            </div>
          </div>

          <Link
            to="/login"
            style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 }}
          >
            Portal Login →
          </Link>
        </div>
      </header>

      {/* Main Form */}
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        
        {!submitted ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ⭐ First Term Free Onboarding Available
              </span>
              <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 900, margin: '1rem 0 0.5rem 0', letterSpacing: '-0.02em' }}>
                Book a Free 15-Minute School Demo
              </h1>
              <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6, maxWidth: '620px', margin: '0 auto' }}>
                See how Labour Educational Portal eliminates exam report card stress, automates continuous assessment scores, and computes class positions in seconds.
              </p>
              {agentRef && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                  Invited by Education Representative: <code style={{ color: '#f59e0b', background: '#0f172a', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>{agentRef}</code>
                </div>
              )}
            </div>

            {errorMessage && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.9rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                {errorMessage}
              </div>
            )}

            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '24px', padding: '2rem', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      School Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Crown International Academy"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      required
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #475569', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Headteacher / Administrator Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mr. Samuel Osei"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      required
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #475569', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Contact Phone / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 0244123456"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #475569', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                    />
                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>We will arrange a quick WhatsApp/video demo.</span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      School Email (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="school@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #475569', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Region / Location
                    </label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #475569', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                    >
                      <option value="Greater Accra">Greater Accra</option>
                      <option value="Ashanti">Ashanti</option>
                      <option value="Central">Central</option>
                      <option value="Western">Western</option>
                      <option value="Eastern">Eastern</option>
                      <option value="Volta">Volta</option>
                      <option value="Northern">Northern</option>
                      <option value="Other">Other Region</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Estimated Number of Students
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 250"
                      value={estimatedLearners}
                      onChange={(e) => setEstimatedLearners(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #475569', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Special Requirements or Questions (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Do you support double continuous assessment? How do we print batch cards?"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #475569', color: '#f8fafc', fontSize: '0.9rem', outline: 'none', resize: 'vertical' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.95rem',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4)',
                    transition: 'all 0.2s'
                  }}
                >
                  {loading ? 'Submitting Request...' : 'Schedule My Free Demo & Priority Setup →'}
                </button>

              </form>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', background: '#1e293b', border: '1px solid #10b981', borderRadius: '24px', padding: '3.5rem 2rem', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', fontSize: '2rem' }}>
              ✓
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 900, margin: '0 0 0.5rem 0' }}>
              Demo Request Received!
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6, maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
              Thank you, <strong>{contactPerson}</strong>! Our education specialist will call or WhatsApp you at <strong>{phone}</strong> to guide your school through the setup.
            </p>
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '12px', display: 'inline-block', border: '1px solid #334155' }}>
              <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Assigned Onboarding Priority: <strong>Tier 1 Expedited</strong></span>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
