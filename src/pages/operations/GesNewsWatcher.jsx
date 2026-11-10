import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import gesNewsWatcherService, { MONITORED_SOURCES } from '../../services/gesNewsWatcherService';
import broadcastService from '../../services/broadcastService';
import blogService from '../../services/blogService';

const GesNewsWatcher = () => {
  const navigate = useNavigate();
  const [newsList, setNewsList] = useState([]);
  const [selectedSource, setSelectedSource] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState('');
  const [blogModalItem, setBlogModalItem] = useState(null);
  const [broadcastModalItem, setBroadcastModalItem] = useState(null);
  const [dispatchSuccess, setDispatchSuccess] = useState('');
  const [publishingBlog, setPublishingBlog] = useState(false);

  const loadNews = () => {
    const list = gesNewsWatcherService.getNews();
    setNewsList(list);
    setLastScanned(gesNewsWatcherService.getLastScanTime());
  };

  useEffect(() => {
    loadNews();
  }, []);

  const handleScanNow = async () => {
    setScanning(true);
    try {
      await new Promise(r => setTimeout(r, 1200)); // smooth scanning UX
      const result = await gesNewsWatcherService.scanAllSources();
      setNewsList(result.items);
      setLastScanned(result.scannedAt);
    } finally {
      setScanning(false);
    }
  };

  const handleMarkRead = (id) => {
    gesNewsWatcherService.markAsRead(id);
    loadNews();
  };

  const handleConvertToBroadcast = (item) => {
    const cleanTitle = item.title.replace(/^[^\w\s]+/, '').trim();
    const blogSlug = `ges-${cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '').slice(0, 45)}`;

    setBroadcastModalItem({
      title: item.title,
      content: `${item.summary}\n\nRead the simplified 2-minute breakdown on the Labour Edu Blog.`,
      targetAudience: item.targetAudience || 'all',
      severity: item.urgency === 'urgent' ? 'urgent' : item.urgency === 'high' ? 'warning' : 'info',
      blogUrl: `/blog/${blogSlug}`,
      actionUrl: `/blog/${blogSlug}`,
      actionLabel: 'Read Blog Guide',
      officialSourceUrl: item.sourceUrl
    });
  };

  const handleOpenConvertToBlogModal = (item) => {
    const cleanTitle = item.title.replace(/^[^\w\s]+/, '').trim();
    const blogSlug = `ges-${cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '').slice(0, 45)}-${Date.now().toString().slice(-4)}`;

    const generatedMarkdown = `# ${cleanTitle}

## Executive Summary
${item.summary}

## Key Takeaways for Ghanaian Basic Schools
- **For Headteachers:** Verify class assessment records and broadsheets in your school dashboard to ensure compliance with this directive.
- **For Subject Teachers:** Ensure all continuous assessment scores and terminal exam marks are recorded and synchronized before deadlines.
- **For Parents & Guardians:** You can view terminal report cards, continuous assessment updates, and fee summaries directly on the Labour Edu Parent Portal.

---

## Official Verification & Reference Document
This simplified breakdown is prepared by the **Editorial Team** to assist schools in understanding national educational directives.

For the complete official document, statutory tables, and signed government notices, please inspect the original official page:

**[View Original Directive on ${item.sourceName}](${item.sourceUrl})**
`;

    setBlogModalItem({
      title: cleanTitle,
      slug: blogSlug,
      category: 'GES Directives & Policy',
      targetRole: item.targetAudience === 'teacher' ? 'Teachers' : item.targetAudience === 'headteacher' ? 'Headteachers' : 'All Schools & Parents',
      featuredBadge: 'Official Policy Guide',
      readTime: '2 min read',
      author: 'Labour Edu Editorial Desk',
      summary: item.summary,
      content: generatedMarkdown,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      dispatchAsBroadcast: true
    });
  };

  const handlePublishBlogPost = async (e) => {
    e.preventDefault();
    if (!blogModalItem) return;

    setPublishingBlog(true);
    try {
      // 1. Create and publish the blog post
      const newPost = await blogService.createPost({
        title: blogModalItem.title,
        slug: blogModalItem.slug,
        category: blogModalItem.category || 'GES Directives & Policy',
        target_role: blogModalItem.targetRole || 'All Schools & Parents',
        featured_badge: blogModalItem.featuredBadge || 'Official Policy Guide',
        read_time: blogModalItem.readTime || '2 min read',
        author: blogModalItem.author || 'Labour Edu Editorial Desk',
        summary: blogModalItem.summary,
        content: blogModalItem.content,
        is_published: true
      });

      // 2. Optionally dispatch as a top announcement banner across the app
      if (blogModalItem.dispatchAsBroadcast) {
        try {
          await broadcastService.createBroadcast({
            title: blogModalItem.title,
            content: blogModalItem.summary,
            targetAudience: 'all',
            severity: 'warning',
            bannerEnabled: true,
            modalEnabled: false,
            blogUrl: `/blog/${newPost.slug || blogModalItem.slug}`,
            actionUrl: `/blog/${newPost.slug || blogModalItem.slug}`,
            actionLabel: 'Read Blog Guide'
          });
        } catch (bErr) {
          console.warn('[GesNewsWatcher] Broadcast creation note:', bErr);
        }
      }

      setDispatchSuccess(`Blog post published to Blog & Manuals! Accessible at /blog/${newPost.slug || blogModalItem.slug}`);
      setBlogModalItem(null);
      setTimeout(() => setDispatchSuccess(''), 6000);
    } catch (err) {
      console.error('Error publishing blog post:', err);
      alert('Could not publish blog post. Please check console.');
    } finally {
      setPublishingBlog(false);
    }
  };

  const handleDispatchPreparedBroadcast = async () => {
    if (!broadcastModalItem) return;
    try {
      await broadcastService.createBroadcast({
        title: broadcastModalItem.title,
        content: broadcastModalItem.content,
        targetAudience: broadcastModalItem.targetAudience,
        severity: broadcastModalItem.severity,
        bannerEnabled: true,
        modalEnabled: false,
        blogUrl: broadcastModalItem.blogUrl || broadcastModalItem.actionUrl,
        actionUrl: broadcastModalItem.actionUrl,
        actionLabel: broadcastModalItem.actionLabel
      });

      setDispatchSuccess(`Broadcast dispatched to all ${broadcastModalItem.targetAudience === 'all' ? 'schools & portals' : broadcastModalItem.targetAudience + 's'}!`);
      setBroadcastModalItem(null);
      setTimeout(() => setDispatchSuccess(''), 5000);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredNews = newsList.filter(item => {
    const matchesSource = selectedSource === 'all' || item.sourceId === selectedSource;
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSource && matchesSearch;
  });

  const getUrgencyBadge = (urgency) => {
    switch (urgency) {
      case 'urgent': return { bg: '#FEE2E2', color: '#DC2626', border: '#FECACA', label: 'Urgent' };
      case 'high': return { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A', label: 'Important' };
      case 'medium': return { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE', label: 'Policy Update' };
      case 'low': default: return { bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB', label: 'Information' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: '#fafafa' }}>
      
      {/* Top Header Card */}
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
            <i className="fas fa-satellite-dish"></i> National Education Watcher
          </div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#fafafa', letterSpacing: '-0.02em' }}>
            GES &amp; Regulatory Directives
          </h1>
          <p style={{ margin: '0.35rem 0 0', color: '#a1a1aa', fontSize: '0.88rem', maxWidth: '650px', lineHeight: 1.5 }}>
            Automated intelligence monitoring official releases, curriculum directives, and exam guidelines across GES, MoE, NaCCA, WAEC, and NTC.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <button
            onClick={handleScanNow}
            disabled={scanning}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              background: scanning ? '#27272a' : '#2563eb',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: scanning ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background 0.15s ease'
            }}
          >
            <i className={`fas fa-arrows-rotate ${scanning ? 'fa-spin' : ''}`}></i>
            {scanning ? 'Scanning Portals...' : 'Scan Portals Now'}
          </button>
          
          <div style={{ fontSize: '0.74rem', color: '#71717a' }}>
            Last Scanned: <strong>{lastScanned.includes('T') ? new Date(lastScanned).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : lastScanned}</strong>
          </div>
        </div>
      </div>

      {/* Success Notification Alert with Direct Link to Blog */}
      {dispatchSuccess && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          color: '#34d399',
          padding: '0.9rem 1.15rem',
          borderRadius: '10px',
          fontWeight: 600,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-check-circle" style={{ fontSize: '1.1rem', color: '#34d399' }}></i>
            <span>{dispatchSuccess}</span>
          </div>

          <button
            onClick={() => navigate('/platform/operations/blog')}
            style={{
              background: '#18181c',
              border: '1px solid #27272a',
              color: '#34d399',
              padding: '0.35rem 0.85rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>Open Blog &amp; Manuals CMS</span>
            <i className="fas fa-arrow-right" style={{ fontSize: '0.7rem' }}></i>
          </button>
        </div>
      )}

      {/* Monitored Portals Directory Pills */}
      <div style={{ background: '#121215', borderRadius: '12px', border: '1px solid #222226', padding: '1.15rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.65rem' }}>
          Monitored Sources ({MONITORED_SOURCES.length})
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
          {MONITORED_SOURCES.map(source => (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0.55rem 0.75rem',
                borderRadius: '8px',
                background: '#18181c',
                border: '1px solid #27272a',
                textDecoration: 'none',
                color: '#fafafa',
                transition: 'border-color 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = source.badgeColor}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#27272a'}
            >
              <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: `${source.badgeColor}20`, color: source.badgeColor, border: `1px solid ${source.badgeColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', flexShrink: 0 }}>
                <i className={`fas ${source.icon}`}></i>
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {source.shortName}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#71717a' }}>
                  Live Endpoint <i className="fas fa-arrow-up-right-from-square" style={{ fontSize: '0.6rem' }}></i>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Main Feed Container */}
      <div style={{ background: '#121215', borderRadius: '12px', border: '1px solid #222226', padding: '1.25rem' }}>
        
        {/* Filter and Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid #222226', paddingBottom: '0.85rem' }}>
          
          {/* Source Tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <button
              onClick={() => setSelectedSource('all')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: selectedSource === 'all' ? '#38bdf8' : '#27272a',
                background: selectedSource === 'all' ? 'rgba(56, 189, 248, 0.12)' : '#18181c',
                color: selectedSource === 'all' ? '#38bdf8' : '#a1a1aa',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              All Sources ({newsList.length})
            </button>

            {MONITORED_SOURCES.map(s => {
              const count = newsList.filter(n => n.sourceId === s.id).length;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSource(s.id)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: selectedSource === s.id ? s.badgeColor : '#27272a',
                    background: selectedSource === s.id ? `${s.badgeColor}15` : '#18181c',
                    color: selectedSource === s.id ? s.badgeColor : '#a1a1aa',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {s.shortName} ({count})
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <i className="fas fa-search" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#71717a', fontSize: '0.8rem' }}></i>
              <input
                type="text"
                placeholder="Search circulars, marks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem 0.45rem 2rem',
                  borderRadius: '6px',
                  border: '1px solid #27272a',
                  background: '#18181c',
                  color: '#fafafa',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>

        {/* Circulars List */}
        {filteredNews.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#71717a' }}>
            <i className="fas fa-radar" style={{ fontSize: '2.5rem', color: '#52525b', marginBottom: '0.75rem', display: 'block' }}></i>
            <div style={{ fontWeight: 600, color: '#fafafa' }}>No Matching Directives Found</div>
            <p style={{ fontSize: '0.85rem', margin: '0.4rem 0 0 0' }}>Try changing the source filter or search query.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {filteredNews.map(item => {
              const urgency = getUrgencyBadge(item.urgency);
              const source = MONITORED_SOURCES.find(s => s.id === item.sourceId) || {};

              return (
                <div
                  key={item.id}
                  style={{
                    background: '#18181c',
                    border: '1px solid #27272a',
                    borderLeft: `3px solid ${source.badgeColor || '#38bdf8'}`,
                    borderRadius: '8px',
                    padding: '1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  {/* Top Metadata */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '4px', background: `${source.badgeColor}15`, color: source.badgeColor, border: `1px solid ${source.badgeColor}30` }}>
                        {item.sourceName}
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '4px', background: urgency.bg, color: urgency.color, border: `1px solid ${urgency.border}` }}>
                        {urgency.label}
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#71717a' }}>
                        {item.category}
                      </span>
                      {item.isBreaking && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                          BREAKING DIRECTIVE
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 600 }}>
                      {new Date(item.publishedDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>

                  {/* Title & Summary */}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fafafa', marginBottom: '0.35rem', lineHeight: 1.4 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.86rem', color: '#a1a1aa', lineHeight: 1.55 }}>
                      {item.summary}
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #222226', paddingTop: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
                    
                    {/* Official Portal Source Link (Direct Page) */}
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleMarkRead(item.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: source.badgeColor || '#38bdf8',
                        textDecoration: 'none'
                      }}
                    >
                      <i className="fas fa-arrow-up-right-from-square" style={{ fontSize: '0.7rem' }}></i>
                      <span>Read Notice on {source.shortName || 'Official Website'}</span>
                    </a>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      
                      {/* Convert to Blog Button */}
                      <button
                        onClick={() => handleOpenConvertToBlogModal(item)}
                        style={{
                          background: '#2563eb',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '0.45rem 0.95rem',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <i className="fas fa-pen-nib"></i>
                        <span>Convert to Blog</span>
                      </button>

                      {/* Quick Broadcast Button */}
                      <button
                        onClick={() => handleConvertToBroadcast(item)}
                        style={{
                          background: '#121215',
                          color: '#fafafa',
                          border: '1px solid #27272a',
                          padding: '0.45rem 0.85rem',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <i className="fas fa-bullhorn" style={{ color: '#fbbf24' }}></i>
                        <span>Quick Broadcast</span>
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CONVERT TO BLOG POST MODAL */}
      {blogModalItem && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#141418',
            borderRadius: '14px',
            border: '1px solid #27272a',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            color: '#fafafa'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #222226', paddingBottom: '0.85rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#fafafa', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fas fa-newspaper" style={{ color: '#38bdf8' }}></i>
                  Create Blog Post from Directive
                </div>
                <div style={{ fontSize: '0.76rem', color: '#a1a1aa', marginTop: '2px' }}>
                  Generates an article in <strong>Blog &amp; Manuals</strong> with official citation.
                </div>
              </div>
              <button
                onClick={() => setBlogModalItem(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#71717a' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePublishBlogPost} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  Blog Post Title *
                </label>
                <input
                  type="text"
                  value={blogModalItem.title}
                  onChange={(e) => setBlogModalItem({ ...blogModalItem, title: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Category
                  </label>
                  <input
                    type="text"
                    value={blogModalItem.category}
                    onChange={(e) => setBlogModalItem({ ...blogModalItem, category: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.84rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Target Audience / Role
                  </label>
                  <input
                    type="text"
                    value={blogModalItem.targetRole}
                    onChange={(e) => setBlogModalItem({ ...blogModalItem, targetRole: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.84rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  Executive Summary
                </label>
                <textarea
                  value={blogModalItem.summary}
                  onChange={(e) => setBlogModalItem({ ...blogModalItem, summary: e.target.value })}
                  rows={2}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.85rem', lineHeight: 1.4, fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.75rem', color: '#a1a1aa', textTransform: 'uppercase' }}>
                    Article Content (Markdown)
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const imgUrl = prompt('Enter Image URL:');
                        if (imgUrl) {
                          const caption = prompt('Enter Caption:');
                          setBlogModalItem(prev => ({
                            ...prev,
                            content: `${prev.content}\n\n![${caption || 'Illustration'}](${imgUrl})\n`
                          }));
                        }
                      }}
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        background: '#18181c',
                        border: '1px solid #27272a',
                        color: '#38bdf8',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <i className="fas fa-image"></i>
                      <span>+ Image</span>
                    </button>
                  </div>
                </div>
                <textarea
                  value={blogModalItem.content}
                  onChange={(e) => setBlogModalItem({ ...blogModalItem, content: e.target.value })}
                  rows={7}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.84rem', lineHeight: 1.45, fontFamily: 'monospace' }}
                />
              </div>

              {/* Direct Official Link Citation Box */}
              <div style={{ background: '#18181c', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #27272a' }}>
                <div style={{ fontSize: '0.72rem', color: '#71717a', fontWeight: 600, textTransform: 'uppercase', marginBottom: '3px' }}>
                  Official Source Link:
                </div>
                <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 500, wordBreak: 'break-all' }}>
                  {blogModalItem.sourceUrl}
                </div>
              </div>

              {/* Optional Broadcast Checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 500, color: '#fafafa', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={blogModalItem.dispatchAsBroadcast}
                  onChange={(e) => setBlogModalItem({ ...blogModalItem, dispatchAsBroadcast: e.target.checked })}
                />
                <span>Also dispatch top notification banner across school portals with "Read Blog Guide" link</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setBlogModalItem(null)}
                  style={{ padding: '0.55rem 1.15rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', color: '#a1a1aa', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={publishingBlog}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    background: '#2563eb',
                    border: 'none',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: publishingBlog ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fas fa-check"></i>
                  <span>{publishingBlog ? 'Publishing...' : 'Publish to Blog & Manuals'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK DIRECT BROADCAST MODAL */}
      {broadcastModalItem && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#141418',
            borderRadius: '14px',
            border: '1px solid #27272a',
            width: '100%',
            maxWidth: '600px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            color: '#fafafa'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#fafafa', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-bullhorn" style={{ color: '#38bdf8' }}></i>
                Quick Direct Broadcast
              </div>
              <button
                onClick={() => setBroadcastModalItem(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#71717a' }}
              >
                ✕
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                Broadcast Title
              </label>
              <input
                type="text"
                value={broadcastModalItem.title}
                onChange={(e) => setBroadcastModalItem({ ...broadcastModalItem, title: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                Target Portals
              </label>
              <select
                value={broadcastModalItem.targetAudience}
                onChange={(e) => setBroadcastModalItem({ ...broadcastModalItem, targetAudience: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.85rem' }}
              >
                <option value="all">All Schools &amp; Portals</option>
                <option value="headteacher">Headteachers Only</option>
                <option value="teacher">Teachers Only</option>
                <option value="parent">Parents Only</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  Button Action Text
                </label>
                <input
                  type="text"
                  value={broadcastModalItem.actionLabel}
                  onChange={(e) => setBroadcastModalItem({ ...broadcastModalItem, actionLabel: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.84rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  Destination Link (URL)
                </label>
                <input
                  type="text"
                  value={broadcastModalItem.actionUrl}
                  onChange={(e) => setBroadcastModalItem({ ...broadcastModalItem, actionUrl: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', color: '#fafafa', fontSize: '0.84rem' }}
                />
              </div>
            </div>

            <div style={{ background: '#18181c', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #27272a', fontSize: '0.76rem', color: '#a1a1aa' }}>
              <i className="fas fa-circle-info" style={{ color: '#38bdf8', marginRight: '5px' }}></i>
              Target users clicking <strong>"{broadcastModalItem.actionLabel || 'Read'}"</strong> will navigate to <code>{broadcastModalItem.actionUrl}</code>.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
              <button
                onClick={() => setBroadcastModalItem(null)}
                style={{ padding: '0.55rem 1.15rem', borderRadius: '8px', background: '#18181c', border: '1px solid #27272a', color: '#a1a1aa', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDispatchPreparedBroadcast}
                style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#FFFFFF', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fas fa-paper-plane"></i>
                <span>Dispatch Broadcast</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default GesNewsWatcher;
