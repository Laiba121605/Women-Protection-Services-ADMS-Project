// src/pages/VictimDashboard.jsx
// Victim dashboard — standalone page AND importable panel for VolunteerDashboard
// Routes used:
//   POST /victim/request    — submit new emergency request (Note + Location)
//   GET  /victim/incidents  — view own incidents from victim_personal_view
//
// Props:
//   embeddedMode  (bool)   — when true, hides the top header/logout (used inside VolunteerDashboard)
//   onLogout      (func)   — called when logout button pressed (standalone mode only)

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

// ── Colour maps ───────────────────────────────────────────────────────────────
const severityColor = {
  High:   { bg: '#fff0f0', text: '#c0392b' },
  Medium: { bg: '#fffbf0', text: '#d68910' },
  Low:    { bg: '#f0fff4', text: '#1e8449' },
};
const statusColor = {
  Pending:   { bg: '#f5f5f5', text: '#777' },
  Ongoing:   { bg: '#fff3e0', text: '#e67e22' },
  Completed: { bg: '#e8f4fd', text: '#2980b9' },
  False:     { bg: '#fdf2f8', text: '#8e44ad' },
  True:      { bg: '#eafaf1', text: '#1e8449' },
};
const emergencyIcon = {
  'Domestic Violence': '🏠',
  'Sexual Assault':    '⚠️',
  'Harassment':        '🚨',
  'Kidnapping':        '🔒',
  'Stalking':          '👁️',
  'Medical Emergency': '🏥',
};

const fmt = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const Badge = ({ label, scheme }) => {
  const s = scheme || { bg: '#f5f5f5', text: '#555' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '20px',
      fontSize: '11px', fontWeight: '700',
      backgroundColor: s.bg, color: s.text, letterSpacing: '0.3px',
      cursor: 'default', userSelect: 'none',
    }}>{label}</span>
  );
};

const InfoRow = ({ label, value }) => (
  <div style={{ ...V.row, cursor: 'default' }}>
    <span style={V.rowLabel}>{label}</span>
    <span style={V.rowValue}>{value || '—'}</span>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const VictimDashboard = ({ embeddedMode = false, onLogout }) => {
  const { user, logout: ctxLogout } = useAuth();

  const [tab, setTab]             = useState('incidents'); // 'incidents' | 'submit'
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [toast, setToast]         = useState('');

  // Submit form state
  const [note, setNote]           = useState('');
  const [location, setLocation]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Expanded incident (shows full details)
  const [expandedId, setExpandedId] = useState(null);

  // ── Filter / search state ─────────────────────────────────────────────────
  const [searchId, setSearchId] = useState('');  // filter by Request ID
  const [dateFrom, setDateFrom] = useState('');  // filter from date
  const [dateTo,   setDateTo]   = useState('');  // filter to date

  // Derived filtered list — applied client-side on the already-fetched data
  const filteredIncidents = incidents.filter(item => {
    if (searchId.trim() && !item.Request_id?.toLowerCase().includes(searchId.trim().toLowerCase()))
      return false;
    const ts = item.Request_time ? new Date(item.Request_time) : null;
    if (dateFrom && ts && ts < new Date(dateFrom))
      return false;
    if (dateTo && ts && ts > new Date(dateTo + 'T23:59:59'))
      return false;
    return true;
  });

  const hasActiveFilters = searchId || dateFrom || dateTo;
  const clearFilters = () => { setSearchId(''); setDateFrom(''); setDateTo(''); };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ── Fetch incidents ─────────────────────────────────────────────────────────
  const fetchIncidents = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError('');
    try {
      const res = await API.get('/victim/incidents');
      const next = res.data;
      setIncidents(prev => {
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
    } catch (e) {
      if (!silent) setError(e.response?.data?.message || 'Failed to load incidents');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // ── Polling — auto-refresh every 30 seconds while on incidents tab ─────────
  const POLL_INTERVAL = 30000;

  useEffect(() => {
    fetchIncidents();

    const interval = setInterval(() => {
      if (tab === 'incidents') fetchIncidents(true);
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchIncidents, tab]);

  // ── Submit request ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!note.trim() || note.trim().length < 5) {
      setSubmitError('Please describe your situation (at least 5 characters)');
      return;
    }
    if (!location.trim() || location.trim().length < 10) {
      setSubmitError('Please provide a detailed location (at least 10 characters)');
      return;
    }

    setSubmitting(true);
    try {
      const res = await API.post('/victim/request', {
        Note:     note.trim(),
        Location: location.trim(),
      });
      showToast(`✅ Request submitted — ID: ${res.data.Request_id}`);
      setNote('');
      setLocation('');
      setTab('incidents');
      await fetchIncidents();
    } catch (e) {
      setSubmitError(e.response?.data?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Logout (standalone mode only) ──────────────────────────────────────────
  const handleLogout = () => {
    if (onLogout) { onLogout(); return; }
    ctxLogout();
  };

  // ── Incident card ───────────────────────────────────────────────────────────
  const IncidentCard = ({ item }) => {
    const isExpanded = expandedId === (item.Incident_id || item.Request_id);
    const sev = severityColor[item.Severity]          || severityColor.Low;
    const ist = statusColor[item.Incident_Status]     || statusColor.Pending;
    const ver = statusColor[item.Verification_status] || statusColor.Pending;

    // Derive case stage for the progress pipeline
    const stage = item.Incident_Status === 'Completed' ? 5
      : item.follow_up_id || item.Law_case_id           ? 4
      : item.Police_Centre || item.Ambulance_id          ? 3
      : item.Assignment_id                               ? 2
      : item.Incident_id                                 ? 1
      : 0;

    const stages = [
      { line1: 'Request',  line2: 'Submitted',  icon: '📋' },
      { line1: 'Incident', line2: 'Verified',   icon: '✅' },
      { line1: 'Response', line2: 'Dispatched', icon: '🚔' },
      { line1: 'Services', line2: 'Assigned',   icon: '🚑' },
      { line1: 'Support',  line2: 'Ongoing',    icon: '⚖️' },
      { line1: 'Case',     line2: 'Closed',     icon: '🏁' },
    ];

    return (
      <div style={V.card}>

        {/* Card header — clickable to expand */}
        <div
          style={V.cardHeader}
          onClick={() => setExpandedId(isExpanded ? null : (item.Incident_id || item.Request_id))}
        >
          <div style={V.cardHeaderLeft}>
            <span style={V.eIcon}>{emergencyIcon[item.Emergency_type] || '🚨'}</span>
            <div>
              <p style={V.eType}>{item.Emergency_type || 'Request Submitted'}</p>
              <p style={V.eId}>
                Request #{item.Request_id}
                {item.Incident_id ? ` · Incident #${item.Incident_id}` : ''}
                {' · '}{fmt(item.Request_time)}
              </p>
            </div>
          </div>
          <div style={V.cardHeaderRight}>
            <div style={V.badgeGroup}>
              {item.Severity        && <Badge label={item.Severity}          scheme={sev} />}
              {item.Incident_Status && <Badge label={item.Incident_Status}   scheme={ist} />}
              {!item.Incident_id    && <Badge label="Awaiting Review"        scheme={{ bg: '#f0f4ff', text: '#2c5fbd' }} />}
            </div>
            <span style={V.chevron}>{isExpanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Progress pipeline — always visible */}
        <div style={V.pipeline}>
          {stages.map((s, i) => {
            const done    = i < stage;
            const current = i === stage;
            return (
              <React.Fragment key={i}>
                <div style={{ ...V.pipelineStep, cursor: 'default' }}>
                  <div style={{
                    ...V.pipelineDot,
                    backgroundColor: done    ? '#27ae60'
                                   : current ? '#7b2d8b'
                                   : '#e0e0e0',
                    boxShadow: current ? '0 0 0 3px rgba(123,45,139,0.15)' : 'none',
                    cursor: 'default',
                  }}>
                    <span style={{ fontSize: done || current ? '13px' : '11px', cursor: 'default', userSelect: 'none' }}>
                      {done ? '✓' : s.icon}
                    </span>
                  </div>
                  <p style={{
                    ...V.pipelineLabel,
                    color: done ? '#27ae60' : current ? '#7b2d8b' : '#bbb',
                    fontWeight: current ? '700' : '500',
                    cursor: 'default',
                    userSelect: 'none',
                  }}>
                    {s.line1}<br/>{s.line2}
                  </p>
                </div>
                {i < stages.length - 1 && (
                  <div style={{
                    ...V.pipelineLine,
                    backgroundColor: i < stage ? '#27ae60' : '#e0e0e0',
                    cursor: 'default',
                  }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Always-visible quick summary */}
        <div style={V.summary}>
          <InfoRow label="🕐 Submitted"  value={fmt(item.Request_time)} />
          <InfoRow label="📋 Your note"  value={item.Request_Note} />
        </div>

        {/* Expanded full details */}
        {isExpanded && (
          <div style={V.expandedBody}>

            {/* ── Your Request ─────────────────────────────────────────────── */}
            <div style={V.section}>
              <p style={V.sectionTitle}>Your Request</p>
              <InfoRow label="🆔 Request ID"     value={item.Request_id} />
              <InfoRow label="🕐 Submitted"      value={fmt(item.Request_time)} />
              <InfoRow label="📋 Note"           value={item.Request_Note} />
              <InfoRow label="📍 Location"       value={item.Request_Location || item.Incident_Location} />
              <InfoRow label="📁 Type"           value={item.Request_Type} />
              <InfoRow label="🆔 Dispatcher ID"  value={item.Dispatcher_id} />
              <InfoRow label="🧑‍💼 Dispatcher"    value={item.Dispatcher_Name} />
            </div>

            {/* ── Incident — only if dispatcher created one ────────────────── */}
            {item.Incident_id ? (
              <div style={{ ...V.section, borderTop: '1px solid #f5f5f5' }}>
                <p style={V.sectionTitle}>Incident Assessment</p>
                <InfoRow label="🆔 Incident ID"     value={item.Incident_id} />
                <InfoRow label="🚨 Type"            value={item.Emergency_type} />
                <InfoRow label="📊 Severity"        value={<Badge label={item.Severity || '—'} scheme={sev} />} />
                <InfoRow label="✔ Verified"         value={<Badge label={item.Verification_status || '—'} scheme={ver} />} />
                <InfoRow label="📝 Dispatcher note" value={item.Incident_Note} />
                <InfoRow label="🕐 Time"            value={fmt(item.Incident_Time)} />
                <InfoRow label="📌 Status"          value={<Badge label={item.Incident_Status || '—'} scheme={ist} />} />
              </div>
            ) : (
              <div style={{ ...V.section, borderTop: '1px solid #f5f5f5' }}>
                <p style={V.sectionTitle}>Incident Assessment</p>
                <p style={V.pendingNote}>⏳ A dispatcher has been notified and will review your request shortly.</p>
              </div>
            )}

            {/* ── Assignment ───────────────────────────────────────────────── */}
            {item.Assignment_id ? (
              <div style={{ ...V.section, borderTop: '1px solid #f5f5f5' }}>
                <p style={V.sectionTitle}>Response Assignment</p>
                <InfoRow label="🆔 Assignment ID" value={item.Assignment_id} />
                <InfoRow label="📌 Status"        value={<Badge label={item.Assignment_Status || '—'} scheme={statusColor[item.Assignment_Status] || statusColor.Pending} />} />
                <InfoRow label="⏱ Assigned"       value={fmt(item.Assigned_time)} />
                <InfoRow label="✅ Completed"      value={item.Completion_time ? fmt(item.Completion_time) : 'In progress'} />
              </div>
            ) : item.Incident_id ? (
              <div style={{ ...V.section, borderTop: '1px solid #f5f5f5' }}>
                <p style={V.sectionTitle}>Response Assignment</p>
                <p style={V.pendingNote}>⏳ Response team is being assigned to your case.</p>
              </div>
            ) : null}

          </div>
        )}
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={embeddedMode ? V.embeddedWrapper : V.page}>

      {/* Toast */}
      {toast && <div style={V.toast}>{toast}</div>}

      {/* Header — hidden in embedded mode */}
      {!embeddedMode && (
        <div style={V.header}>
          <div style={V.headerLeft}>
            <div style={V.avatar}>🛡️</div>
            <div>
              <h1 style={V.name}>{user?.name || user?.id}</h1>
              <p style={V.meta}>Victim · {user?.id}</p>
            </div>
          </div>
          <button onClick={handleLogout} style={V.logoutBtn}>Sign Out</button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={V.errorBanner}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={V.errorClose}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={V.tabs}>
        {[
          { key: 'incidents', label: `My Incidents (${incidents.length})` },
          { key: 'submit',    label: '+ Submit Emergency Request' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              ...V.tab,
              ...(tab === t.key
                ? (t.key === 'submit' ? V.tabActiveSubmit : V.tabActiveIncidents)
                : {}),
            }}
          >
            {t.label}
          </button>
        ))}
        <span style={V.pollingBadge}>🔴 Live · updates every 30s</span>
      </div>

      {/* ── INCIDENTS TAB ────────────────────────────────────────────────── */}
      {tab === 'incidents' && (
        <div style={V.content}>

          {/* Filter bar — only shown when there are incidents */}
          {incidents.length > 0 && (
            <div style={V.filterBar}>
              <div style={V.filterField}>
                <span style={V.filterIcon}>🔍</span>
                <input
                  type="text"
                  value={searchId}
                  onChange={e => setSearchId(e.target.value)}
                  placeholder="Search by Request ID"
                  style={V.filterInput}
                />
              </div>
              <div style={V.filterField}>
                <span style={V.filterIconLabel}>📅 From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  style={V.filterInput}
                />
              </div>
              <div style={V.filterField}>
                <span style={V.filterIconLabel}>📅 To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  style={V.filterInput}
                />
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} style={V.clearBtn}>✕ Clear</button>
              )}
            </div>
          )}

          {/* Results count when filtering */}
          {hasActiveFilters && incidents.length > 0 && (
            <p style={V.filterCount}>
              Showing {filteredIncidents.length} of {incidents.length} incidents
            </p>
          )}

          {loading ? (
            <div style={V.empty}>
              <div style={V.spinner} />
              <p style={V.emptyText}>Loading incidents…</p>
            </div>
          ) : incidents.length === 0 ? (
            <div style={V.empty}>
              <p style={V.emptyIcon}>🛡️</p>
              <p style={V.emptyText}>No incidents on record yet.</p>
              <button onClick={() => setTab('submit')} style={V.emptyAction}>
                Submit an Emergency Request
              </button>
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div style={V.empty}>
              <p style={V.emptyIcon}>🔍</p>
              <p style={V.emptyText}>No incidents match your filters.</p>
              <button onClick={clearFilters} style={V.emptyAction}>Clear Filters</button>
            </div>
          ) : (
            <div style={V.grid}>
              {filteredIncidents.map((item, i) => (
                <IncidentCard key={item.Incident_id || item.Request_id || i} item={item} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SUBMIT TAB ───────────────────────────────────────────────────── */}
      {tab === 'submit' && (
        <div style={V.content}>
          <div style={V.formCard}>

            <div style={V.formHeader}>
              <span style={V.formHeaderIcon}>🚨</span>
              <div>
                <p style={V.formHeaderTitle}>Submit Emergency Request</p>
                <p style={V.formHeaderSub}>
                  A dispatcher will be notified immediately and assigned to your case.
                </p>
              </div>
            </div>

            {submitError && (
              <div style={V.formError}>
                <span style={V.formErrorDot}>●</span>
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} style={V.form} autoComplete="off">

              {/* Note */}
              <div style={V.fieldGroup}>
                <label style={V.label}>Describe Your Situation</label>
                <textarea
                  value={note}
                  onChange={e => { setNote(e.target.value); setSubmitError(''); }}
                  placeholder="Briefly describe what is happening (min 5 characters)"
                  style={V.textarea}
                  disabled={submitting}
                  rows={4}
                />
                <p style={V.charCount}>{note.trim().length} / 350 characters</p>
              </div>

              {/* Location */}
              <div style={V.fieldGroup}>
                <label style={V.label}>Your Current Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={e => { setLocation(e.target.value); setSubmitError(''); }}
                  placeholder="House no, street, area, city (min 10 characters)"
                  style={V.input}
                  disabled={submitting}
                  maxLength={150}
                />
                <p style={V.charCount}>{location.trim().length} / 150 characters</p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={submitting ? V.submitBtnDisabled : V.submitBtn}
              >
                {submitting ? (
                  <span style={V.btnContent}>
                    <span style={V.spinner2} /> Submitting…
                  </span>
                ) : (
                  <span style={V.btnContent}>🚨 Submit Emergency Request</span>
                )}
              </button>

            </form>

            {/* Warning note */}
            <div style={V.warningBox}>
              <p style={V.warningText}>
                ⚠️ If you are in immediate danger, also call <strong>1122</strong> (Rescue) or <strong>15</strong> (Police) directly.
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const V = {
  page: {
    minHeight: '100vh', backgroundColor: '#fdf5f5',
    fontFamily: "'Segoe UI', system-ui, sans-serif", paddingBottom: '60px',
  },
  embeddedWrapper: {
    fontFamily: "'Segoe UI', system-ui, sans-serif", paddingBottom: '20px',
  },
  toast: {
    position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
    backgroundColor: '#7b2d8b', color: '#fff', padding: '10px 24px',
    borderRadius: '30px', fontSize: '13px', fontWeight: '600',
    boxShadow: '0 4px 20px rgba(123,45,139,0.3)', zIndex: 9999, whiteSpace: 'nowrap',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: '16px', backgroundColor: '#fff',
    padding: '20px 32px', borderBottom: '1px solid #eee',
    boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  avatar: {
    width: '52px', height: '52px', borderRadius: '50%',
    backgroundColor: '#fdf2f8', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: '24px',
  },
  name: { margin: 0, fontSize: '18px', fontWeight: '700', color: '#1a1a2e' },
  meta: { margin: '2px 0 0', fontSize: '13px', color: '#999' },
  logoutBtn: {
    padding: '8px 18px', borderRadius: '8px', border: '1.5px solid #ddd',
    backgroundColor: '#fff', color: '#555', fontSize: '13px',
    fontWeight: '600', cursor: 'pointer',
  },
  errorBanner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff5f5', color: '#c0392b',
    padding: '12px 32px', fontSize: '13px', borderBottom: '1px solid #fecaca',
  },
  errorClose: {
    background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: '14px',
  },
  tabs: {
    display: 'flex', gap: '4px', padding: '20px 32px 0',
    borderBottom: '2px solid #eee', backgroundColor: '#fff',
    alignItems: 'flex-end',
  },
  tab: {
    padding: '10px 20px', border: 'none', background: 'none',
    fontSize: '14px', fontWeight: '600', color: '#999',
    cursor: 'pointer', borderBottom: '2px solid transparent',
    marginBottom: '-2px', borderRadius: '6px 6px 0 0',
  },
  tabActiveIncidents: {
    color: '#7b2d8b', borderBottom: '2px solid #7b2d8b', backgroundColor: '#fdf5ff',
  },
  tabActiveSubmit: {
    color: '#c0392b', borderBottom: '2px solid #c0392b', backgroundColor: '#fff5f5',
  },
  content: { padding: '24px 32px' },
  filterBar: {
    display: 'flex', flexWrap: 'wrap', gap: '10px',
    marginBottom: '16px', alignItems: 'center',
    padding: '14px 16px', backgroundColor: '#fff',
    borderRadius: '12px', border: '1px solid #eef0f3',
    boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
  },
  filterField: {
    display: 'flex', alignItems: 'center', gap: '6px',
    backgroundColor: '#f7f9fc', borderRadius: '8px',
    border: '1.5px solid #e8eaed', padding: '0 10px',
    flex: '1 1 160px', minWidth: '140px',
  },
  filterIcon: { fontSize: '13px', flexShrink: 0 },
  filterIconLabel: { fontSize: '12px', color: '#888', fontWeight: '600', flexShrink: 0, whiteSpace: 'nowrap' },
  filterInput: {
    border: 'none', outline: 'none', backgroundColor: 'transparent',
    fontSize: '13px', color: '#333', padding: '9px 0',
    width: '100%', fontFamily: 'inherit',
  },
  filterSelect: {
    border: 'none', outline: 'none', backgroundColor: 'transparent',
    fontSize: '13px', color: '#333', padding: '9px 0',
    width: '100%', cursor: 'pointer', fontFamily: 'inherit',
  },
  clearBtn: {
    padding: '8px 14px', borderRadius: '8px',
    border: '1.5px solid #fecaca', backgroundColor: '#fff5f5',
    color: '#c0392b', fontSize: '12px', fontWeight: '700',
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  filterCount: {
    fontSize: '12px', color: '#aaa', margin: '-8px 0 12px',
  },
  pollingBadge: {
    fontSize: '11px', color: '#27ae60', fontWeight: '600',
    marginLeft: '4px', marginBottom: '4px', userSelect: 'none',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))',
    gap: '16px',
  },
  empty: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '80px 20px', gap: '12px',
  },
  emptyIcon: { fontSize: '48px', margin: 0 },
  emptyText: { fontSize: '15px', color: '#aaa', margin: 0 },
  emptyAction: {
    marginTop: '8px', padding: '10px 24px', borderRadius: '8px',
    border: 'none', backgroundColor: '#c0392b', color: '#fff',
    fontSize: '13px', fontWeight: '700', cursor: 'pointer',
  },
  spinner: {
    width: '32px', height: '32px',
    border: '3px solid #f5e6fb', borderTop: '3px solid #7b2d8b',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  pipeline: {
    display: 'flex', alignItems: 'flex-start',
    padding: '16px 20px', backgroundColor: '#fafbfc',
    borderBottom: '1px solid #f0f0f0', overflowX: 'auto',
    cursor: 'default',
  },
  pipelineStep: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '6px', minWidth: '64px',
  },
  pipelineDot: {
    width: '36px', height: '36px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background-color 0.2s',
    cursor: 'default',
  },
  pipelineLabel: {
    fontSize: '10px', textAlign: 'center', lineHeight: '1.3',
    margin: 0, userSelect: 'none',
  },
  pipelineLine: {
    flex: 1, height: '2px', marginTop: '17px',
    minWidth: '16px', transition: 'background-color 0.2s',
  },
  pendingNote: {
    fontSize: '12px', color: '#aaa', margin: '4px 0 0',
    fontStyle: 'italic', cursor: 'default', userSelect: 'none',
  },
  card: {
    backgroundColor: '#fff', borderRadius: '14px',
    border: '1px solid #eef0f3',
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: '10px', padding: '16px 20px',
    backgroundColor: '#fafbfc', borderBottom: '1px solid #f0f0f0',
    cursor: 'pointer', userSelect: 'none',
  },
  cardHeaderLeft: { display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'default' },
  eIcon: { fontSize: '28px', lineHeight: 1, cursor: 'default' },
  eType: { margin: 0, fontSize: '15px', fontWeight: '700', color: '#1a1a2e', cursor: 'default', userSelect: 'none' },
  eId:   { margin: '2px 0 0', fontSize: '11px', color: '#aaa', cursor: 'default', userSelect: 'none' },
  cardHeaderRight: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'default' },
  badgeGroup: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', cursor: 'default' },
  chevron: { fontSize: '11px', color: '#bbb', cursor: 'default', userSelect: 'none' },
  summary: { padding: '12px 20px', cursor: 'default' },
  expandedBody: { backgroundColor: '#fafbfc', cursor: 'default' },
  section: { padding: '12px 20px', cursor: 'default' },
  sectionTitle: {
    margin: '0 0 8px', fontSize: '11px', fontWeight: '700',
    color: '#bbb', textTransform: 'uppercase', letterSpacing: '1px',
    cursor: 'default', userSelect: 'none',
  },
  row: { display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '3px 0' },
  rowLabel: { fontSize: '12px', color: '#aaa', fontWeight: '600', minWidth: '110px', flexShrink: 0, cursor: 'default', userSelect: 'none' },
  rowValue: { fontSize: '13px', color: '#333', fontWeight: '500', wordBreak: 'break-word', cursor: 'default' },
  formCard: {
    maxWidth: '600px',
    backgroundColor: '#fff', borderRadius: '16px',
    border: '1px solid #eef0f3',
    boxShadow: '0 2px 16px rgba(0,0,0,0.06)', overflow: 'hidden',
  },
  formHeader: {
    display: 'flex', alignItems: 'flex-start', gap: '14px',
    padding: '20px 24px', backgroundColor: '#fff5f5',
    borderBottom: '1px solid #fee2e2',
  },
  formHeaderIcon: { fontSize: '32px', lineHeight: 1 },
  formHeaderTitle: { margin: '0 0 4px', fontSize: '16px', fontWeight: '700', color: '#1a1a2e' },
  formHeaderSub:   { margin: 0, fontSize: '12px', color: '#888' },
  formError: {
    display: 'flex', alignItems: 'center', gap: '8px',
    backgroundColor: '#fff5f5', color: '#c0392b',
    padding: '12px 24px', fontSize: '13px',
    borderBottom: '1px solid #fecaca',
  },
  formErrorDot: { fontSize: '8px' },
  form: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '600', color: '#555' },
  textarea: {
    padding: '12px 14px', borderRadius: '10px',
    border: '1.5px solid #e0e0e0', outline: 'none',
    fontSize: '13px', color: '#333', resize: 'vertical',
    fontFamily: 'inherit', backgroundColor: '#fafafa',
    lineHeight: '1.5',
  },
  input: {
    padding: '12px 14px', borderRadius: '10px',
    border: '1.5px solid #e0e0e0', outline: 'none',
    fontSize: '13px', color: '#333', backgroundColor: '#fafafa',
  },
  charCount: { margin: '4px 0 0', fontSize: '11px', color: '#bbb', textAlign: 'right' },
  submitBtn: {
    padding: '13px', borderRadius: '10px', border: 'none',
    background: 'linear-gradient(135deg, #c0392b, #e74c3c)',
    color: '#fff', fontSize: '15px', fontWeight: '700',
    cursor: 'pointer', boxShadow: '0 4px 15px rgba(192,57,43,0.3)',
  },
  submitBtnDisabled: {
    padding: '13px', borderRadius: '10px', border: 'none',
    backgroundColor: '#f5b7b1', color: '#fff',
    fontSize: '15px', fontWeight: '700', cursor: 'not-allowed',
  },
  btnContent: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  spinner2: {
    width: '14px', height: '14px',
    border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff',
    borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite',
  },
  warningBox: {
    margin: '0 24px 24px',
    padding: '12px 16px', borderRadius: '10px',
    backgroundColor: '#fffbf0', border: '1px solid #f9e4b7',
  },
  warningText: { margin: 0, fontSize: '12px', color: '#886127', lineHeight: '1.6' },
};

if (!document.getElementById('victim-dash-styles')) {
  const tag = document.createElement('style');
  tag.id = 'victim-dash-styles';
  tag.innerHTML = `@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`;
  document.head.appendChild(tag);
}

export default VictimDashboard;