import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { askOperationsAgent } from '../../services/operationsAgentService';
import { systemErrorTracker } from '../../services/systemErrorTracker';

// Lightweight safe Markdown renderer for chat responses
const renderMarkdown = (text) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let inTable = false;
  let tableRows = [];

  const flushTable = (keyPrefix) => {
    if (tableRows.length > 0) {
      const isHeader = tableRows[0];
      const dataRows = tableRows.slice(2);

      elements.push(
        <div key={`${keyPrefix}-tbl`} style={{ overflowX: 'auto', margin: '0.85rem 0' }}>
          <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse', border: '1px solid #222226', background: '#121215', borderRadius: '8px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#18181c', borderBottom: '1px solid #222226' }}>
                {isHeader.split('|').filter(c => c.trim()).map((col, idx) => (
                  <th key={idx} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#a1a1aa', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    {formatInline(col.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx} style={{ borderBottom: '1px solid #1f1f23', background: '#121215' }}>
                  {row.split('|').filter(c => c.trim()).map((cell, cIdx) => (
                    <td key={cIdx} style={{ padding: '8px 12px', color: '#fafafa' }}>
                      {formatInline(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
    inTable = false;
  };

  const formatInline = (str) => {
    if (!str) return '';
    const parts = [];
    let idx = 0;

    // Pattern for markdown links: [label](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(renderBasicFormatting(str.substring(lastIndex, match.index), idx++));
      }
      const label = match[1];
      const url = match[2];
      parts.push(
        <Link
          key={idx++}
          to={url}
          style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'underline' }}
        >
          {label}
        </Link>
      );
      lastIndex = linkRegex.lastIndex;
    }

    if (lastIndex < str.length) {
      parts.push(renderBasicFormatting(str.substring(lastIndex), idx++));
    }

    return parts.length > 0 ? parts : str;
  };

  const renderBasicFormatting = (text, key) => {
    if (!text) return text;

    // Tokenize bold (**text** or __text__), inline code (`code`), and italic (*text* or _text_)
    const tokenRegex = /(`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_)/g;
    const segments = [];
    let last = 0;
    let match;

    while ((match = tokenRegex.exec(text)) !== null) {
      if (match.index > last) {
        const plain = text.substring(last, match.index).replace(/[*#_`]/g, '');
        if (plain) segments.push(plain);
      }

      if (match[2]) {
        // Inline code: `code`
        segments.push(
          <code key={`${key}-c-${match.index}`} style={{
            background: '#18181c',
            border: '1px solid #27272a',
            color: '#38bdf8',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '0.85em',
            fontWeight: 500,
            fontFamily: 'monospace'
          }}>
            {match[2]}
          </code>
        );
      } else if (match[3]) {
        // Bold: **bold**
        segments.push(
          <strong key={`${key}-b-${match.index}`} style={{ fontWeight: 600, color: '#fafafa' }}>
            {match[3].replace(/[*#_`]/g, '')}
          </strong>
        );
      } else if (match[4] || match[5]) {
        // Italic: *italic* or _italic_
        const italicContent = (match[4] || match[5]).replace(/[*#_`]/g, '');
        segments.push(
          <span key={`${key}-i-${match.index}`} style={{ fontStyle: 'italic', color: '#a1a1aa' }}>
            {italicContent}
          </span>
        );
      }
      last = tokenRegex.lastIndex;
    }

    if (last < text.length) {
      const remaining = text.substring(last).replace(/[*#_`]/g, '');
      if (remaining) segments.push(remaining);
    }

    return segments.length > 0 ? segments : text.replace(/[*#_`]/g, '');
  };

  lines.forEach((line, index) => {
    let trimmed = line.trim();

    // Table detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      tableRows.push(trimmed);
      return;
    } else if (inTable) {
      flushTable(index);
    }

    // Headings: Strip all leading '#' hashes and format cleanly
    if (/^#{1,6}\s+/.test(trimmed)) {
      const headingLevel = trimmed.match(/^(#{1,6})\s+/)[1].length;
      const headingText = trimmed.replace(/^#{1,6}\s+/, '').replace(/^[*_]+|[*_]+$/g, '');

      if (headingLevel <= 2) {
        elements.push(
          <h2 key={index} style={{ margin: '1rem 0 0.4rem', fontSize: '1.1rem', fontWeight: 700, color: '#fafafa', letterSpacing: '-0.01em' }}>
            {formatInline(headingText)}
          </h2>
        );
      } else if (headingLevel === 3) {
        elements.push(
          <h3 key={index} style={{ margin: '0.85rem 0 0.35rem', fontSize: '1rem', fontWeight: 600, color: '#fafafa' }}>
            {formatInline(headingText)}
          </h3>
        );
      } else {
        elements.push(
          <h4 key={index} style={{ margin: '0.75rem 0 0.3rem', fontSize: '0.9rem', fontWeight: 600, color: '#e4e4e7' }}>
            {formatInline(headingText)}
          </h4>
        );
      }
      return;
    }

    // Unordered lists (- or • or *)
    if (/^[-•*]\s+/.test(trimmed)) {
      const listContent = trimmed.replace(/^[-•*]\s+/, '');
      elements.push(
        <div key={index} style={{ display: 'flex', gap: '8px', margin: '4px 0', fontSize: '0.86rem', lineHeight: 1.6, color: '#fafafa' }}>
          <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>&bull;</span>
          <span style={{ flex: 1 }}>{formatInline(listContent)}</span>
        </div>
      );
      return;
    }

    // Ordered numbered lists (1. or 2.)
    if (/^\d+\.\s+/.test(trimmed)) {
      const numberMatch = trimmed.match(/^(\d+)\.\s+/)[1];
      const listContent = trimmed.replace(/^\d+\.\s+/, '');
      elements.push(
        <div key={index} style={{ display: 'flex', gap: '8px', margin: '4px 0', fontSize: '0.86rem', lineHeight: 1.6, color: '#fafafa' }}>
          <span style={{ color: '#38bdf8', fontWeight: 600, minWidth: '18px' }}>{numberMatch}.</span>
          <span style={{ flex: 1 }}>{formatInline(listContent)}</span>
        </div>
      );
      return;
    }

    // Empty lines
    if (trimmed === '') {
      elements.push(<div key={index} style={{ height: '6px' }} />);
      return;
    }

    // Regular paragraphs
    elements.push(
      <p key={index} style={{ margin: '4px 0', fontSize: '0.86rem', lineHeight: 1.6, color: '#fafafa' }}>
        {formatInline(trimmed)}
      </p>
    );
  });

  if (inTable) {
    flushTable('last');
  }

  return elements;
};

const OperationsAgentView = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [unresolvedCount, setUnresolvedCount] = useState(() => systemErrorTracker.getUnresolvedErrors().length);

  useEffect(() => {
    setUnresolvedCount(systemErrorTracker.getUnresolvedErrors().length);
    const unsub = systemErrorTracker.subscribe((state) => {
      setUnresolvedCount(state.unresolved);
    });
    return () => unsub();
  }, []);

  const [messages, setMessages] = useState([
    {
      sender: 'agent',
      text: `### 🤖 Welcome to Operations Copilot
I am your internal intelligence agent built directly into the Platform Operations Center. Ask me operational, financial, or academic questions about registered schools and platform health.

Key Features:
- ⚡ Zero Latency: Powered directly by your database and local indices.
- 🔒 100% Private & Free: Zero external API keys, zero token fees.
- 🩺 Live System Telemetry: 5-pillar diagnostics, runtime exception monitor, and offline sync tracking.
- 🎯 Deep Insights: Real-time health scores, enrollment counts, wallet balances, referral bonuses, and support queues.`,
      suggestions: [
        "Run 5-pillar system diagnostics",
        "Show recent system errors",
        "Platform overview & statistics",
        "Which schools are in critical health?",
        "Top 5 schools by student population",
        "Subscription and billing status"
      ],
      queryTimeMs: 10
    }
  ]);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (questionText) => {
    const textToSend = questionText || query;
    if (!textToSend.trim() || loading) return;

    const userMessage = { sender: 'user', text: textToSend.trim() };
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setLoading(true);

    try {
      const response = await askOperationsAgent(textToSend);
      setMessages(prev => [
        ...prev,
        {
          sender: 'agent',
          text: response.text,
          suggestions: response.suggestions,
          queryTimeMs: response.queryTimeMs
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'agent',
          text: `⚠️ Query error: ${err.message}`,
          suggestions: ["Platform overview & statistics"]
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const QUICK_TOPICS = [
    { title: 'System Diagnostics', query: 'Run 5-pillar system diagnostics', icon: 'fa-heart-pulse', color: '#10B981' },
    { title: 'System Error Log', query: 'Show recent system errors', icon: 'fa-bug', color: '#EF4444' },
    { title: 'Database Census', query: 'Database census & audit', icon: 'fa-database', color: '#6366F1' },
    { title: 'Class Rosters', query: 'Show class breakdown', icon: 'fa-chalkboard-user', color: '#0284C7' },
    { title: 'Score Progress', query: 'Show score statistics', icon: 'fa-chart-line', color: '#10B981' },
    { title: 'Payment Records', query: 'Show payment ledger', icon: 'fa-money-bill-wave', color: '#F59E0B' },
    { title: 'Teacher Matrix', query: 'Show teacher assignments', icon: 'fa-chalkboard-teacher', color: '#7C3AED' },
    { title: 'Parent Portal', query: 'Parent portal stats', icon: 'fa-mobile-screen-button', color: '#0891B2' },
    { title: 'Platform Overview', query: 'Platform overview & statistics', icon: 'fa-gauge-high', color: '#F59E0B' },
    { title: 'Health Alerts', query: 'Which schools are in critical health?', icon: 'fa-triangle-exclamation', color: '#DC2626' },
    { title: 'Population Leaderboard', query: 'Top 5 schools by student population', icon: 'fa-user-graduate', color: '#8B5CF6' },
    { title: 'Billing & Subscriptions', query: 'Subscription and billing status', icon: 'fa-receipt', color: '#059669' },
    { title: 'Referral Rewards', query: 'Referral rewards and deductions', icon: 'fa-gift', color: '#D97706' },
    { title: 'Support Queue', query: 'Show open support tickets', icon: 'fa-headset', color: '#3B82F6' },
    { title: 'Admin Interventions', query: 'Show recent admin interventions', icon: 'fa-user-shield', color: '#64748B' },
    { title: 'All Schools List', query: 'Show all schools directory', icon: 'fa-school-flag', color: '#14B8A6' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', background: '#09090b', color: '#fafafa' }}>
      <style>{`
        .topic-pill {
          background: #121215;
          border: 1px solid #222226;
          border-radius: 8px;
          padding: 0.6rem 0.85rem;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .topic-pill:hover {
          border-color: #38bdf8;
          background: #18181c;
        }
        .chat-prompt-chip {
          background: #18181c;
          border: 1px solid #27272a;
          color: #a1a1aa;
          border-radius: 6px;
          padding: 5px 12px;
          font-size: 0.76rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .chat-prompt-chip:hover {
          background: rgba(56, 189, 248, 0.12);
          border-color: #38bdf8;
          color: #38bdf8;
        }
        .ops-agent-sidebar {
          width: 280px;
          background: #0d0d10;
          border-right: 1px solid #222226;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          overflow-y: auto;
          flex-shrink: 0;
        }
        @media (max-width: 900px) {
          .ops-agent-sidebar {
            display: none !important;
          }
        }
      `}</style>

      {/* ── Page Header ── */}
      <div style={{
        padding: '1rem 1.5rem',
        background: '#09090b',
        borderBottom: '1px solid #222226',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        color: '#fafafa'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem'
          }}>
            <i className="fas fa-headset" />
          </div>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '0.15rem 0.5rem', borderRadius: '4px', color: '#38bdf8', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
              <i className="fas fa-bolt" /> Local Intelligence
            </div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fafafa', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}>
              Operations Assistant
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: unresolvedCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.12)',
            color: unresolvedCount > 0 ? '#f87171' : '#34d399',
            border: unresolvedCount > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '0.75rem',
            fontWeight: 600
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: unresolvedCount > 0 ? '#f87171' : '#34d399'
            }} />
            {unresolvedCount > 0 ? `${unresolvedCount} Error${unresolvedCount > 1 ? 's' : ''}` : 'Telemetry Online'}
          </span>

          <button
            type="button"
            onClick={() => setMessages([messages[0]])}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              background: '#18181c',
              border: '1px solid #27272a',
              color: '#a1a1aa',
              fontWeight: 600,
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
            title="Reset Chat Session"
          >
            <i className="fas fa-rotate-left" /> Clear
          </button>
        </div>
      </div>

      {/* ── Main Workspace Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left Sidebar: Quick Prompts & Categories ── */}
        <div className="ops-agent-sidebar">
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Quick Prompts
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {QUICK_TOPICS.map((topic, idx) => (
              <div
                key={idx}
                className="topic-pill"
                onClick={() => handleSend(topic.query)}
              >
                <div style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  background: `${topic.color}15`,
                  color: topic.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.78rem',
                  flexShrink: 0
                }}>
                  <i className={`fas ${topic.icon}`} />
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#e4e4e7' }}>
                  {topic.title}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 'auto',
            padding: '0.85rem',
            background: '#121215',
            border: '1px solid #222226',
            borderRadius: '8px',
            fontSize: '0.75rem',
            color: '#71717a',
            lineHeight: 1.5
          }}>
            <strong style={{ color: '#fafafa', display: 'block', marginBottom: '2px' }}>
              Natural Language Tips:
            </strong>
            Ask questions like <em>"Which schools need attention?"</em>, <em>"Who has low balance?"</em>, or <em>"Show open tickets"</em>.
          </div>
        </div>

        {/* ── Center: Interactive Chat Feed ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#09090b' }}>
          {unresolvedCount > 0 && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '8px 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.82rem',
              color: '#f87171'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-triangle-exclamation" style={{ color: '#f87171' }} />
                <span>
                  <strong>Telemetry:</strong> {unresolvedCount} unresolved system error{unresolvedCount > 1 ? 's' : ''} detected.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleSend('Show recent system errors')}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '3px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Inspect
                </button>
                <button
                  type="button"
                  onClick={() => handleSend('Run 5-pillar system diagnostics')}
                  style={{
                    background: '#18181c',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '6px',
                    padding: '3px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Diagnostics
                </button>
              </div>
            </div>
          )}

          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {messages.map((m, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start'
                }}>
                  <div style={{
                    maxWidth: '82%',
                    borderRadius: m.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    padding: m.sender === 'user' ? '0.7rem 1.15rem' : '1rem 1.25rem',
                    background: m.sender === 'user' ? '#2563eb' : '#121215',
                    color: '#ffffff',
                    fontSize: '0.86rem',
                    border: m.sender === 'user' ? 'none' : '1px solid #222226',
                  }}>
                    {m.sender === 'user' ? (
                      <span style={{ fontWeight: 500 }}>{m.text}</span>
                    ) : (
                      renderMarkdown(m.text)
                    )}
                  </div>
                </div>

                {m.queryTimeMs !== undefined && (
                  <div style={{
                    fontSize: '0.7rem',
                    color: '#71717a',
                    paddingLeft: m.sender === 'user' ? '0' : '6px',
                    textAlign: m.sender === 'user' ? 'right' : 'left'
                  }}>
                    Database query: <strong>{m.queryTimeMs}ms</strong>
                  </div>
                )}

                {/* Suggestions pill list */}
                {m.suggestions && m.suggestions.length > 0 && idx === messages.length - 1 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {m.suggestions.map((s, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        className="chat-prompt-chip"
                        onClick={() => handleSend(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#71717a', fontSize: '0.82rem', padding: '0.5rem' }}>
                <i className="fas fa-spinner fa-spin" style={{ color: '#38bdf8', fontSize: '0.9rem' }} />
                <span>Querying telemetry and database...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Bar ── */}
          <div style={{
            padding: '1rem 1.5rem',
            background: '#121215',
            borderTop: '1px solid #222226'
          }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              style={{ display: 'flex', gap: '10px', alignItems: 'center' }}
            >
              <input
                type="text"
                placeholder="Ask Operations Assistant (e.g. 'Which schools need attention?', 'Search St. Paul')..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.15rem',
                  borderRadius: '8px',
                  border: '1px solid #27272a',
                  fontSize: '0.86rem',
                  outline: 'none',
                  background: '#18181c',
                  color: '#fafafa',
                  transition: 'border-color 0.15s ease'
                }}
              />
              <button
                type="submit"
                disabled={!query.trim() || loading}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.25rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  opacity: (!query.trim() || loading) ? 0.5 : 1,
                  transition: 'background 0.15s ease'
                }}
              >
                <span>Ask</span>
                <i className="fas fa-paper-plane" />
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OperationsAgentView;
