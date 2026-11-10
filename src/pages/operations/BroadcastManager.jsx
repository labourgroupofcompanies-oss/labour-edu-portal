import React, { useState, useEffect } from 'react';
import broadcastService from '../../services/broadcastService';
import blogService from '../../services/blogService';
import schoolNotificationService from '../../services/schoolNotificationService';

const PRESET_TEMPLATES = [
  {
    name: '🎒 Welcome Back From Vacation',
    title: '🎉 Welcome Back to a Productive New Term!',
    targetAudience: 'all',
    severity: 'success',
    bannerEnabled: true,
    modalEnabled: true,
    blogUrl: '',
    blogTitle: '',
    content: 'Dear School Leaders, Teachers, and Parents, welcome back from the vacation! We hope you had a refreshing break. Labour Edu is fully prepared to support your school with seamless terminal reporting and academic operations this term.',
    actionUrl: '/',
    actionLabel: 'Open Dashboard'
  },
  {
    name: '🇬🇭 GES Curriculum & Assessment Directive',
    title: '🇬🇭 Official GES Continuous Assessment & Terminal Grading Window',
    targetAudience: 'all',
    severity: 'warning',
    bannerEnabled: true,
    modalEnabled: false,
    blogUrl: '/blog/ges-continuous-assessment-policy-guide',
    blogTitle: 'GES Continuous Assessment Policy Guide',
    content: 'All Basic Schools are instructed to complete class assessment entries (30%) and end-of-term examinations (70%) in alignment with the standard Ministry of Education / GES guidelines.',
    actionUrl: '/scores',
    actionLabel: 'Check Scores Status'
  },
  {
    name: '⚡ Scheduled Platform Upgrade Window',
    title: '⚡ Scheduled Maintenance & BroadSheet Cloud Sync Optimization',
    targetAudience: 'headteacher',
    severity: 'info',
    bannerEnabled: true,
    modalEnabled: false,
    blogUrl: '/manuals',
    blogTitle: 'System Updates & Maintenance Guide',
    content: 'The platform cloud database will undergo routine sync optimization this Sunday from 10:00 PM to 11:30 PM GMT. Offline marks entry will remain fully operational on local devices.',
    actionUrl: '/',
    actionLabel: 'View Dashboard'
  },
  {
    name: '📅 Teacher Score Entry Deadline Notice',
    title: '⏰ Urgent: Continuous Assessment & Exam Marks Submission Deadline',
    targetAudience: 'teacher',
    severity: 'urgent',
    bannerEnabled: true,
    modalEnabled: true,
    blogUrl: '/guides',
    blogTitle: 'Teacher Marks Entry & Submission Guide',
    content: 'Teaching staff are reminded that broadsheet marks entry closes this Friday at 5:00 PM. Please ensure all student assessment marks are entered and synchronized.',
    actionUrl: '/scores',
    actionLabel: 'Enter Marks Now'
  },
  {
    name: '🎉 Terminal Report Cards Release Announcement',
    title: '🎓 Term Report Cards Now Officially Available on Parent Portal',
    targetAudience: 'parent',
    severity: 'success',
    bannerEnabled: true,
    modalEnabled: true,
    blogUrl: '/blog/accessing-terminal-reports-parent-guide',
    blogTitle: 'Accessing Terminal Reports Parent Guide',
    content: 'Official terminal report cards, conduct remarks, and attendance summaries have been published and signed by the Headteacher. Parents can view and download report summaries.',
    actionUrl: '/parent/dashboard',
    actionLabel: 'View Child Report'
  }
];

const BroadcastManager = () => {
  const [broadcasts, setBroadcasts] = useState([]);
  const [blogPosts, setBlogPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'compose'
  const [successMessage, setSuccessMessage] = useState('');

  // Composer Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetAudience, setTargetAudience] = useState('all');
  const [severity, setSeverity] = useState('info');
  const [bannerEnabled, setBannerEnabled] = useState(true);
  const [modalEnabled, setModalEnabled] = useState(false);
  const [blogUrl, setBlogUrl] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [actionLabel, setActionLabel] = useState('View Details');
  const [submitting, setSubmitting] = useState(false);

  const loadBroadcasts = async () => {
    setLoading(true);
    const data = await broadcastService.getAllBroadcasts();
    setBroadcasts(data);
    setLoading(false);
  };

  const loadBlogPosts = async () => {
    try {
      const posts = await blogService.getAllPosts();
      setBlogPosts(posts || []);
    } catch (e) {
      console.warn('Could not load blog posts for selector:', e);
    }
  };

  useEffect(() => {
    loadBroadcasts();
    loadBlogPosts();
  }, []);

  const handleApplyTemplate = (tpl) => {
    setTitle(tpl.title);
    setContent(tpl.content);
    setTargetAudience(tpl.targetAudience);
    setSeverity(tpl.severity);
    setBannerEnabled(tpl.bannerEnabled);
    setModalEnabled(tpl.modalEnabled);
    setBlogUrl(tpl.blogUrl || '');
    setActionUrl(tpl.actionUrl || '');
    setActionLabel(tpl.actionLabel || 'View Details');
  };

  const handleSelectBlogPost = (postSlug) => {
    if (!postSlug) return;
    const post = blogPosts.find(p => p.slug === postSlug || String(p.id) === postSlug);
    if (post) {
      const targetSlug = post.slug || `manual-${post.id}`;
      setBlogUrl(`/blog/${targetSlug}`);
      if (!title) setTitle(post.title);
      if (!content && post.summary) setContent(post.summary);
    }
  };

  const handleCreateBroadcast = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      const newBroadcast = await broadcastService.createBroadcast({
        title,
        content,
        targetAudience,
        severity,
        bannerEnabled,
        modalEnabled,
        blogUrl: blogUrl.trim() || null,
        actionUrl: actionUrl.trim() || null,
        actionLabel: actionLabel.trim() || 'View Details'
      });

      // Also trigger instant notification into notification bell
      try {
        schoolNotificationService.addNotification({
          id: `broadcast_${newBroadcast.id}`,
          title: `📢 ${newBroadcast.title}`,
          message: newBroadcast.content,
          category: 'broadcast',
          timestamp: newBroadcast.createdAt,
          actionUrl: newBroadcast.actionUrl,
          actionLabel: newBroadcast.actionLabel,
          severity: newBroadcast.severity
        }, true, true);
      } catch (notifErr) {}

      setSuccessMessage('Broadcast announcement successfully dispatched across target portals!');
      setTitle('');
      setContent('');
      setBlogUrl('');
      setActionUrl('');
      loadBroadcasts();
      setActiveTab('list');

      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (err) {
      console.error('Error creating broadcast:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    await broadcastService.toggleBroadcastStatus(id, !currentStatus);
    loadBroadcasts();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this broadcast announcement?')) {
      await broadcastService.deleteBroadcast(id);
      loadBroadcasts();
    }
  };

  const getSeverityStyle = (s) => {
    switch (s) {
      case 'urgent': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '#EF4444', label: 'Urgent' };
      case 'warning': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: '#F59E0B', label: 'Warning / Caution' };
      case 'success': return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '#10B981', label: 'Success / Milestone' };
      case 'info': default: return { bg: 'rgba(37, 99, 235, 0.15)', color: '#3B82F6', border: '#3B82F6', label: 'Information' };
    }
  };

  const getAudienceLabel = (aud) => {
    switch (aud) {
      case 'headteacher': return 'Headteachers Only';
      case 'teacher': return 'Teachers Only';
      case 'parent': return 'Parents Portal';
      case 'all': default: return 'All Portals & Schools';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: '#fafafa' }}>
      
      {/* Header Banner */}
      <div style={{
        padding: '1.75rem 2rem',
        borderRadius: '16px',
        background: '#09090b',
        border: '1px solid #222226',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.25rem',
        color: '#fafafa'
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '0.2rem 0.65rem', borderRadius: '4px', color: '#38bdf8', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
            <i className="fas fa-bullhorn"></i> Circulars &amp; Alerts
          </div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#fafafa', letterSpacing: '-0.02em' }}>
            Broadcast Dispatcher
          </h1>
          <p style={{ margin: '0.35rem 0 0', color: '#a1a1aa', fontSize: '0.88rem', maxWidth: '650px', lineHeight: 1.5 }}>
            Publish directives, announcements, and term notices instantly to Headteachers, Teachers, and Parents across all registered schools.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('list')}
            style={{
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: activeTab === 'list' ? '#38bdf8' : '#27272a',
              background: activeTab === 'list' ? 'rgba(56, 189, 248, 0.12)' : '#18181c',
              color: activeTab === 'list' ? '#38bdf8' : '#a1a1aa',
              fontWeight: 600,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fas fa-list-ul"></i> Active Broadcasts ({broadcasts.length})
          </button>

          <button
            onClick={() => setActiveTab('compose')}
            style={{
              padding: '0.55rem 1.2rem',
              borderRadius: '8px',
              border: 'none',
              background: '#2563eb',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fas fa-plus"></i> Compose Dispatch
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          color: '#34d399',
          padding: '0.85rem 1.15rem',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <i className="fas fa-check-circle" style={{ fontSize: '1rem', color: '#34d399' }}></i>
          <span>{successMessage}</span>
        </div>
      )}

      {/* TAB 1: LIST ACTIVE BROADCASTS */}
      {activeTab === 'list' && (
        <div style={{ background: '#121215', borderRadius: '12px', border: '1px solid #222226', padding: '1.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', fontSize: '1.05rem', color: '#fafafa', fontWeight: 600 }}>
              Broadcast Announcements Ledger
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#71717a' }}>
              Showing {broadcasts.length} system announcements
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#71717a' }}>Loading broadcasts...</div>
          ) : broadcasts.length === 0 ? (
            <div style={{ padding: '3.5rem', textAlign: 'center', color: '#71717a' }}>
              <i className="fas fa-bullhorn" style={{ fontSize: '2.5rem', color: '#52525b', marginBottom: '0.75rem', display: 'block' }}></i>
              <div style={{ fontWeight: 600, color: '#fafafa' }}>No Broadcasts Dispatched Yet</div>
              <p style={{ fontSize: '0.85rem', margin: '0.4rem 0 1rem 0' }}>Click "Compose Dispatch" to publish your first circular or directive.</p>
              <button
                onClick={() => setActiveTab('compose')}
                style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', borderRadius: '6px', border: 'none', fontWeight: 600, cursor: 'pointer' }}
              >
                + Compose First Broadcast
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {broadcasts.map((b) => {
                const sev = getSeverityStyle(b.severity);
                return (
                  <div
                    key={b.id}
                    style={{
                      background: '#18181c',
                      border: '1px solid #27272a',
                      borderLeft: `3px solid ${b.isActive ? sev.border : '#52525b'}`,
                      borderRadius: '8px',
                      padding: '1.15rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      opacity: b.isActive ? 1 : 0.65
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '4px', background: sev.bg, color: sev.color }}>
                          {sev.label}
                        </span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '4px', background: '#222226', color: '#a1a1aa' }}>
                          {getAudienceLabel(b.targetAudience)}
                        </span>
                        {b.bannerEnabled && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 500, color: '#38bdf8' }}>
                            <i className="fas fa-flag"></i> Top Banner
                          </span>
                        )}
                        {b.modalEnabled && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 500, color: '#c084fc' }}>
                            <i className="fas fa-window-maximize"></i> Login Modal
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => handleToggleActive(b.id, b.isActive)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            background: b.isActive ? 'rgba(16, 185, 129, 0.12)' : '#222226',
                            border: `1px solid ${b.isActive ? 'rgba(16, 185, 129, 0.25)' : '#27272a'}`,
                            color: b.isActive ? '#34d399' : '#a1a1aa',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {b.isActive ? 'Active (Live)' : 'Paused (Hidden)'}
                        </button>

                        <button
                          onClick={() => handleDelete(b.id)}
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#f87171',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title="Delete announcement"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '0.96rem', color: '#fafafa' }}>
                      {b.title}
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#a1a1aa', lineHeight: 1.5 }}>
                      {b.content}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '0.74rem', color: '#71717a', borderTop: '1px solid #222226', paddingTop: '0.5rem' }}>
                      <div>Dispatched by: <strong style={{ color: '#fafafa' }}>{b.author || 'Platform Super Admin'}</strong> · {new Date(b.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {b.blogUrl && (
                          <span style={{ color: '#38bdf8', fontWeight: 600, background: 'rgba(56, 189, 248, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                            <i className="fas fa-book-open"></i> Read More: {b.blogUrl}
                          </span>
                        )}
                        {b.actionUrl && (
                          <span style={{ color: '#34d399', fontWeight: 500 }}>
                            Action: {b.actionLabel} ({b.actionUrl})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COMPOSE NEW BROADCAST */}
      {activeTab === 'compose' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          
          {/* Left Column: Form & Presets */}
          <div style={{ background: '#121215', borderRadius: '12px', border: '1px solid #222226', padding: '1.5rem' }}>
            
            {/* Template Presets */}
            <div style={{ marginBottom: '1.25rem', background: '#18181c', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #27272a' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fas fa-wand-magic-sparkles" style={{ color: '#38bdf8' }}></i>
                Template Presets
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {PRESET_TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    style={{
                      background: '#121215',
                      border: '1px solid #27272a',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      color: '#fafafa',
                      cursor: 'pointer'
                    }}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.76rem', color: '#a1a1aa', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Broadcast Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., GES Academic Term Directive"
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #27272a',
                    background: '#18181c',
                    color: '#fafafa',
                    fontSize: '0.86rem',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Target Audience & Severity in 2 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.76rem', color: '#a1a1aa', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                    Target Audience
                  </label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      borderRadius: '8px',
                      border: '1px solid #27272a',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      background: '#18181c',
                      color: '#fafafa',
                      outline: 'none'
                    }}
                  >
                    <option value="all">All Schools &amp; Portals</option>
                    <option value="headteacher">Headteachers Only</option>
                    <option value="teacher">Teachers Only</option>
                    <option value="parent">Parents Only</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.76rem', color: '#a1a1aa', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                    Urgency Style
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      borderRadius: '8px',
                      border: '1px solid #27272a',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      background: '#18181c',
                      color: '#fafafa',
                      outline: 'none'
                    }}
                  >
                    <option value="info">Information (Blue)</option>
                    <option value="warning">Important Notice (Amber)</option>
                    <option value="urgent">Urgent Action (Red)</option>
                    <option value="success">System Milestone (Green)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.76rem', color: '#a1a1aa', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Announcement Message Body *
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter the official circular message, guidelines, or instructions here..."
                  rows={5}
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #27272a',
                    background: '#18181c',
                    color: '#fafafa',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    fontFamily: 'inherit',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Blog Article Link (Read More Destination) */}
              <div style={{ background: '#18181c', border: '1px solid #27272a', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.76rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
                    <i className="fas fa-book-open"></i>
                    <span>Attached Blog Guide</span>
                  </label>
                </div>

                {blogPosts.length > 0 && (
                  <div>
                    <select
                      onChange={(e) => handleSelectBlogPost(e.target.value)}
                      defaultValue=""
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid #27272a',
                        background: '#121215',
                        fontSize: '0.82rem',
                        fontWeight: 500,
                        color: '#fafafa',
                        outline: 'none'
                      }}
                    >
                      <option value="">-- Choose a published blog post to link --</option>
                      {blogPosts.map((post) => (
                        <option key={post.id || post.slug} value={post.slug || post.id}>
                          {post.title} ({post.category || 'Guide'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <input
                    type="text"
                    value={blogUrl}
                    onChange={(e) => setBlogUrl(e.target.value)}
                    placeholder="e.g. /blog/ges-continuous-assessment-policy-guide"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #27272a',
                      background: '#121215',
                      fontSize: '0.84rem',
                      color: '#fafafa',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Action Button Link (Optional) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Secondary Route
                  </label>
                  <input
                    type="text"
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    placeholder="e.g. /scores, /reports"
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #27272a', background: '#18181c', color: '#fafafa', fontSize: '0.84rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Secondary Label
                  </label>
                  <input
                    type="text"
                    value={actionLabel}
                    onChange={(e) => setActionLabel(e.target.value)}
                    placeholder="View Details"
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #27272a', background: '#18181c', color: '#fafafa', fontSize: '0.84rem', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Delivery Display Checkboxes */}
              <div style={{ display: 'flex', gap: '1.25rem', background: '#18181c', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #27272a' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 500, color: '#fafafa', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={bannerEnabled}
                    onChange={(e) => setBannerEnabled(e.target.checked)}
                  />
                  <span>Show Top Pinned Banner</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 500, color: '#fafafa', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={modalEnabled}
                    onChange={(e) => setModalEnabled(e.target.checked)}
                  />
                  <span>Pop-up Modal on Login</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting || !title.trim() || !content.trim()}
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: '#2563eb',
                  border: 'none',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '0.25rem'
                }}
              >
                <i className="fas fa-paper-plane"></i>
                {submitting ? 'Dispatching...' : 'Dispatch Broadcast Now'}
              </button>
            </form>
          </div>

          {/* Right Column: Live Recipient Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: '#121215', borderRadius: '12px', border: '1px solid #222226', padding: '1.25rem', color: '#fafafa' }}>
              <div style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                <i className="fas fa-eye"></i> Live Recipient Preview
              </div>
              <div style={{ fontSize: '0.82rem', color: '#a1a1aa', marginBottom: '1rem' }}>
                How the broadcast renders at the top of <strong>{getAudienceLabel(targetAudience)}</strong> dashboards:
              </div>

              {/* Preview Banner Box - iPhone iOS Translucent Glass Push Notification Style */}
              {(() => {
                const getPreviewTheme = (sev) => {
                  switch (sev) {
                    case 'urgent': return { accent: '#FF3B30', accentGradient: 'linear-gradient(135deg, #FF3B30 0%, #FF6259 100%)', iconGlow: 'rgba(255, 59, 48, 0.4)', tagBg: 'rgba(255, 59, 48, 0.12)', tagText: '#FF3B30', border: 'rgba(255, 59, 48, 0.25)', icon: 'fa-circle-exclamation', tag: 'Urgent Alert' };
                    case 'warning': return { accent: '#FF9500', accentGradient: 'linear-gradient(135deg, #FF9500 0%, #FFB340 100%)', iconGlow: 'rgba(255, 149, 0, 0.4)', tagBg: 'rgba(255, 149, 0, 0.14)', tagText: '#D97706', border: 'rgba(255, 149, 0, 0.25)', icon: 'fa-triangle-exclamation', tag: 'Official Notice' };
                    case 'success': return { accent: '#34C759', accentGradient: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)', iconGlow: 'rgba(52, 199, 89, 0.4)', tagBg: 'rgba(52, 199, 89, 0.14)', tagText: '#15803D', border: 'rgba(52, 199, 89, 0.25)', icon: 'fa-circle-check', tag: 'System Update' };
                    case 'info':
                    default: return { accent: '#007AFF', accentGradient: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)', iconGlow: 'rgba(0, 122, 255, 0.4)', tagBg: 'rgba(0, 122, 255, 0.12)', tagText: '#007AFF', border: 'rgba(0, 122, 255, 0.22)', icon: 'fa-bolt-lightning', tag: 'Developer Broadcast' };
                  }
                };
                const theme = getPreviewTheme(severity);
                return (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.82)',
                    border: `1px solid rgba(255, 255, 255, 0.85)`,
                    borderRadius: '22px',
                    padding: '0.9rem 1.15rem 0.95rem 1.15rem',
                    color: '#0F172A',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    backdropFilter: 'blur(32px) saturate(210%)',
                    WebkitBackdropFilter: 'blur(32px) saturate(210%)',
                    boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.35), inset 0 1px 1.5px rgba(255, 255, 255, 0.95)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Header Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '7px',
                          background: theme.accentGradient,
                          boxShadow: `0 3px 8px ${theme.iconGlow}`,
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem'
                        }}>
                          <i className={`fas ${theme.icon}`}></i>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
                            LABOUR EDU
                          </span>
                          <span style={{
                            fontSize: '0.64rem',
                            fontWeight: 800,
                            color: theme.tagText,
                            background: theme.tagBg,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '5px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em'
                          }}>
                            {theme.tag}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 500 }}>• Just now</span>
                      </div>

                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                        color: '#64748B'
                      }}>
                        ✕
                      </div>
                    </div>

                    {/* Title & Preview Content (Strictly what was typed) */}
                    <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#09090B', lineHeight: 1.35, marginTop: '2px' }}>
                      {title || 'Announcement Title'}
                    </div>

                    <div style={{
                      fontSize: '0.83rem',
                      color: '#334155',
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {content || 'Your announcement message content will appear here...'}
                    </div>

                    {/* Footer Tap Hint */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(0,0,0,0.05)', fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fas fa-fingerprint" style={{ color: theme.accent, fontSize: '0.7rem' }}></i>
                        Tap to view full message
                      </span>
                      <i className="fas fa-chevron-right" style={{ fontSize: '0.65rem', color: theme.accent }}></i>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Helpful Developer Guide Card */}
            <div style={{ background: '#18181b', borderRadius: '18px', border: '1px solid #27272a', padding: '1.25rem', color: '#FFFFFF' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fas fa-info-circle" style={{ color: '#38BDF8' }}></i>
                Broadcast Delivery Highlights
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#D4D4D8', lineHeight: 1.6 }}>
                <li><strong>Floating 7s Notification:</strong> Appears gracefully over Headteacher &amp; Teacher portals and disappears after 7s without shifting the layout.</li>
                <li><strong>Bell Archival:</strong> Permanently recorded into their top-right Notification Bell for later reading.</li>
                <li><strong>Multi-Targeting:</strong> Send to All Users, Headteachers Only, Teachers Only, or Parents.</li>
              </ul>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default BroadcastManager;
