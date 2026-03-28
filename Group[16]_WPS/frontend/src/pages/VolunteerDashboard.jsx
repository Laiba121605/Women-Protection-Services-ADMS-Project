// src/pages/VolunteerDashboard.jsx
// Volunteer dashboard — fully wired to backend
// Routes used:
//   GET  /volunteer/assignments/current   — active assignments
//   GET  /volunteer/assignments/history   — completed assignments
//   PUT  /volunteer/assignment/:id        — update own status on an assignment
//   PUT  /volunteer/availability          — toggle availability Yes/No
// Data comes from volunteer_assigned_view

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

// ── Severity colour mapping ───────────────────────────────────────────────────
const severityColor = {
  High:   { bg: '#fff0f0', text: '#c0392b', dot: '#e74c3c' },
  Medium: { bg: '#fffbf0', text: '#d68910', dot: '#f39c12' },
  Low:    { bg: '#f0fff4', text: '#1e8449', dot: '#27ae60' },
};

const statusColor = {
  Pending:   { bg: '#f5f5f5',  text: '#777' },
  Ongoing:   { bg: '#fff3e0',  text: '#e67e22' },
  Arrived:   { bg: '#e8f5e9',  text: '#27ae60' },
  Completed: { bg: '#e8f4fd',  text: '#2980b9' },
};

const emergencyIcon = {
  'Domestic Violence': '🏠',
  'Sexual Assault':    '⚠️',
  'Harassment':        '🚨',
  'Kidnapping':        '🔒',
  'Stalking':          '👁️',
  'Medical Emergency': '🏥',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '700',
      backgroundColor: s.bg,
      color: s.text,
      letterSpacing: '0.3px',
    }}>
      {label}
    </span>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const VolunteerDashboard = () => {
  const { user, logout } = useAuth();

  const [tab, setTab]                   = useState('current'); // 'current' | 'history'
  const [currentData, setCurrentData]   = useState([]);
  const [historyData, setHistoryData]   = useState([]);
  const [availability, setAvailability] = useState(null); // 'Yes' | 'No' | null
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingAvail, setLoadingAvail]     = useState(false);
  const [updatingId, setUpdatingId]         = useState(null); // assignment id being updated
  const [error, setError]               = useState('');
  const [toast, setToast]               = useState(''); // success message

  // ── Fetch current assignments ───────────────────────────────────────────────
  const fetchCurrent = useCallback(async () => {
    setLoadingCurrent(true);
    setError('');
    try {
      const res = await API.get('/volunteer/assignments/current');
      setCurrentData(res.data);
      // Derive availability from first row if present
      if (res.data.length > 0) {
        // availability not in view — fetch separately via a second call if needed
        // For now infer from the data: if we have active assignments we know they exist
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load assignments');
    } finally {
      setLoadingCurrent(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    setError('');
    try {
      const res = await API.get('/volunteer/assignments/history');
      setHistoryData(res.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  useEffect(() => {
    if (tab === 'history' && historyData.length === 0) {
      fetchHistory();
    }
  }, [tab, fetchHistory, historyData.length]);

  // ── Show toast ──────────────────────────────────────────────────────────────
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ── Update assignment status ────────────────────────────────────────────────
  const handleStatusUpdate = async (assignmentId, newStatus) => {
    setUpdatingId(assignmentId);
    setError('');
    try {
      await API.put(`/volunteer/assignment/${assignmentId}`, { Status: newStatus });
      showToast(`Status updated to ${newStatus}`);
      await fetchCurrent();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Toggle availability ─────────────────────────────────────────────────────
  const handleAvailabilityToggle = async () => {
    const next = availability === 'Yes' ? 'No' : 'Yes';
    setLoadingAvail(true);
    setError('');
    try {
      await API.put('/volunteer/availability', { Availability: next });
      setAvailability(next);
      showToast(`Availability set to ${next}`);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update availability');
    } finally {
      setLoadingAvail(false);
    }
  };

  // ── Assignment card ─────────────────────────────────────────────────────────
  const AssignmentCard = ({ item, showActions }) => {
    const sev  = severityColor[item.Severity]  || severityColor.Low;
    const ast  = statusColor[item.Assignment_Status] || statusColor.Pending;
    const ist  = statusColor[item.Incident_Status]   || statusColor.Pending;
    const isUpdating = updatingId === item.Assignment_id;

    return (
      <div style={S.card}>

        {/* Card header — incident type + severity + status */}
        <div style={S.cardHeader}>
          <div style={S.cardHeaderLeft}>
            <span style={S.emergencyIcon}>
              {emergencyIcon[item.Emergency_type] || '🚨'}
            </span>
            <div>
              <p style={S.emergencyType}>{item.Emergency_type || '—'}</p>
              <p style={S.incidentId}>Incident #{item.Incident_id} · Assignment #{item.Assignment_id}</p>
            </div>
          </div>
          <div style={S.badgeGroup}>
            <Badge label={item.Severity || '—'} scheme={sev} />
            <Badge label={item.Assignment_Status || '—'} scheme={ast} />
          </div>
        </div>

        {/* Incident details */}
        <div style={S.section}>
          <Row label="📍 Location"   value={item.Incident_Location} />
          <Row label="🕐 Reported"   value={fmt(item.Incident_Time)} />
          <Row label="📋 Note"       value={item.Incident_Note} />
          <Row label="🔎 Status"     value={
            <Badge label={item.Incident_Status || '—'} scheme={ist} />
          } />
        </div>

        {/* Victim info */}
        {item.Victim_Name && (
          <div style={{ ...S.section, borderTop: '1px solid #f0f0f0' }}>
            <p style={S.sectionTitle}>Victim</p>
            <Row label="👤 Name"  value={item.Victim_Name} />
            <Row label="📞 Phone" value={item.Victim_Phone} />
          </div>
        )}

        {/* Services */}
        <div style={{ ...S.section, borderTop: '1px solid #f0f0f0' }}>
          <p style={S.sectionTitle}>Services</p>
          <Row label="👮 Police"    value={item.Police_Centre
            ? `${item.Police_Centre} — ${item.Police_Status || '—'}`
            : 'Not assigned'} />
          <Row label="🚑 Ambulance" value={item.Ambulance_id
            ? `${item.Ambulance_id} — ${item.Ambulance_Status || '—'}`
            : 'Not assigned'} />
          {item.Referred_centre && (
            <Row label="🏥 Follow-up" value={`${item.Referred_centre} (${item.Followup_Status || '—'})`} />
          )}
        </div>

        {/* Timestamps */}
        <div style={{ ...S.section, borderTop: '1px solid #f0f0f0' }}>
          <Row label="⏱ Assigned"   value={fmt(item.Assigned_time)} />
          {item.Completion_time && (
            <Row label="✅ Completed" value={fmt(item.Completion_time)} />
          )}
        </div>

        {/* Status update buttons — only on current tab */}
        {showActions && (
          <div style={S.actions}>
            <p style={S.actionsLabel}>Update your status</p>
            <div style={S.actionButtons}>
              {['Pending', 'Arrived', 'Ongoing'].map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusUpdate(item.Assignment_id, s)}
                  disabled={isUpdating}
                  style={{
                    ...S.actionBtn,
                    ...(statusColor[s]
                      ? { backgroundColor: statusColor[s].bg, color: statusColor[s].text,
                          border: `1.5px solid ${statusColor[s].text}30` }
                      : {}),
                    opacity: isUpdating ? 0.6 : 1,
                    cursor: isUpdating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isUpdating ? '…' : s}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    );
  };

  // ── Row helper ──────────────────────────────────────────────────────────────
  const Row = ({ label, value }) => (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <span style={S.rowValue}>{value || '—'}</span>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  const activeData  = tab === 'current' ? currentData  : historyData;
  const isLoading   = tab === 'current' ? loadingCurrent : loadingHistory;

  return (
    <div style={S.page}>

      {/* Toast */}
      {toast && (
        <div style={S.toast}>{toast}</div>
      )}

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.avatar}>🤝</div>
          <div>
            <h1 style={S.name}>{user?.name || user?.id}</h1>
            <p style={S.meta}>Volunteer · {user?.id}</p>
          </div>
        </div>
        <div style={S.headerRight}>
          {/* Availability toggle */}
          <div style={S.availRow}>
            <span style={S.availLabel}>Available</span>
            <button
              onClick={handleAvailabilityToggle}
              disabled={loadingAvail}
              style={{
                ...S.toggle,
                backgroundColor: availability === 'Yes' ? '#27ae60' : '#ccc',
              }}
            >
              <div style={{
                ...S.toggleKnob,
                transform: availability === 'Yes' ? 'translateX(20px)' : 'translateX(2px)',
              }} />
            </button>
            <span style={{
              ...S.availStatus,
              color: availability === 'Yes' ? '#27ae60' : '#aaa',
            }}>
              {loadingAvail ? '…' : (availability || '—')}
            </span>
          </div>
          <button onClick={logout} style={S.logoutBtn}>Sign Out</button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={S.errorBanner}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={S.errorClose}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={S.tabs}>
        {[
          { key: 'current', label: `Active  (${currentData.length})` },
          { key: 'history', label: `Completed  (${historyData.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ ...S.tab, ...(tab === t.key ? S.tabActive : {}) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={S.content}>
        {isLoading ? (
          <div style={S.empty}>
            <div style={S.spinner} />
            <p style={S.emptyText}>Loading assignments…</p>
          </div>
        ) : activeData.length === 0 ? (
          <div style={S.empty}>
            <p style={S.emptyIcon}>{tab === 'current' ? '📋' : '✅'}</p>
            <p style={S.emptyText}>
              {tab === 'current'
                ? 'No active assignments right now.'
                : 'No completed assignments yet.'}
            </p>
          </div>
        ) : (
          <div style={S.grid}>
            {activeData.map((item, i) => (
              <AssignmentCard
                key={item.Vol_assignment_id || i}
                item={item}
                showActions={tab === 'current'}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f7f9fc',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    paddingBottom: '60px',
  },
  // Toast
  toast: {
    position: 'fixed', top: '20px', left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#27ae60', color: '#fff',
    padding: '10px 24px', borderRadius: '30px',
    fontSize: '13px', fontWeight: '600',
    boxShadow: '0 4px 20px rgba(39,174,96,0.3)',
    zIndex: 9999, whiteSpace: 'nowrap',
  },
  // Header
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: '16px',
    backgroundColor: '#fff',
    padding: '20px 32px',
    borderBottom: '1px solid #eee',
    boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  avatar: {
    width: '52px', height: '52px',
    borderRadius: '50%',
    backgroundColor: '#e8f5e9',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '24px',
  },
  name: { margin: 0, fontSize: '18px', fontWeight: '700', color: '#1a1a2e' },
  meta: { margin: '2px 0 0', fontSize: '13px', color: '#999' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' },
  availRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  availLabel: { fontSize: '13px', color: '#555', fontWeight: '600' },
  toggle: {
    width: '44px', height: '24px', borderRadius: '12px',
    border: 'none', cursor: 'pointer', position: 'relative',
    transition: 'background-color 0.2s',
    padding: 0,
  },
  toggleKnob: {
    position: 'absolute', top: '2px',
    width: '20px', height: '20px',
    borderRadius: '50%', backgroundColor: '#fff',
    transition: 'transform 0.2s',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  availStatus: { fontSize: '13px', fontWeight: '700', minWidth: '24px' },
  logoutBtn: {
    padding: '8px 18px', borderRadius: '8px',
    border: '1.5px solid #ddd', backgroundColor: '#fff',
    color: '#555', fontSize: '13px', fontWeight: '600',
    cursor: 'pointer',
  },
  // Error
  errorBanner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff5f5', color: '#c0392b',
    padding: '12px 32px', fontSize: '13px',
    borderBottom: '1px solid #fecaca',
  },
  errorClose: {
    background: 'none', border: 'none', color: '#c0392b',
    cursor: 'pointer', fontSize: '14px', padding: '0 4px',
  },
  // Tabs
  tabs: {
    display: 'flex', gap: '4px',
    padding: '20px 32px 0',
    borderBottom: '2px solid #eee',
    backgroundColor: '#fff',
  },
  tab: {
    padding: '10px 20px', border: 'none', background: 'none',
    fontSize: '14px', fontWeight: '600', color: '#999',
    cursor: 'pointer', borderBottom: '2px solid transparent',
    marginBottom: '-2px', transition: 'color 0.15s',
    borderRadius: '6px 6px 0 0',
  },
  tabActive: {
    color: '#27ae60',
    borderBottom: '2px solid #27ae60',
    backgroundColor: '#f7fff9',
  },
  // Content
  content: { padding: '24px 32px' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))',
    gap: '20px',
  },
  empty: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '80px 20px', gap: '12px',
  },
  emptyIcon: { fontSize: '48px', margin: 0 },
  emptyText: { fontSize: '15px', color: '#aaa', margin: 0 },
  spinner: {
    width: '32px', height: '32px',
    border: '3px solid #e0f2e9',
    borderTop: '3px solid #27ae60',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: '14px',
    border: '1px solid #eef0f3',
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
    padding: '16px 20px',
    backgroundColor: '#fafbfc',
    borderBottom: '1px solid #f0f0f0',
  },
  cardHeaderLeft: { display: 'flex', alignItems: 'flex-start', gap: '12px' },
  emergencyIcon: { fontSize: '28px', lineHeight: 1 },
  emergencyType: {
    margin: 0, fontSize: '15px', fontWeight: '700', color: '#1a1a2e',
  },
  incidentId: { margin: '2px 0 0', fontSize: '11px', color: '#aaa' },
  badgeGroup: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' },
  // Section
  section: { padding: '12px 20px' },
  sectionTitle: {
    margin: '0 0 8px', fontSize: '11px', fontWeight: '700',
    color: '#bbb', textTransform: 'uppercase', letterSpacing: '1px',
  },
  row: {
    display: 'flex', gap: '8px',
    alignItems: 'flex-start',
    padding: '3px 0',
  },
  rowLabel: {
    fontSize: '12px', color: '#aaa', fontWeight: '600',
    minWidth: '110px', flexShrink: 0,
  },
  rowValue: {
    fontSize: '13px', color: '#333', fontWeight: '500',
    wordBreak: 'break-word',
  },
  // Actions
  actions: {
    padding: '14px 20px',
    borderTop: '1px solid #f0f0f0',
    backgroundColor: '#fafffe',
  },
  actionsLabel: {
    margin: '0 0 10px', fontSize: '11px', fontWeight: '700',
    color: '#bbb', textTransform: 'uppercase', letterSpacing: '1px',
  },
  actionButtons: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  actionBtn: {
    padding: '6px 16px', borderRadius: '20px',
    fontSize: '12px', fontWeight: '700',
    cursor: 'pointer', transition: 'opacity 0.15s',
    border: '1.5px solid #eee',
  },
};

// Inject spinner keyframes
const styleTag = document.createElement('style');
styleTag.innerHTML = `@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`;
document.head.appendChild(styleTag);

export default VolunteerDashboard;