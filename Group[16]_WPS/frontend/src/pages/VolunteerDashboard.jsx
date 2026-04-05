// src/pages/VolunteerDashboard.jsx
// Routes used:
//   GET  /volunteer/assignments/current   — active assignments
//   GET  /volunteer/assignments/history   — completed assignments
//   PUT  /volunteer/assignment/:id        — update own status
//   PUT  /volunteer/availability          — toggle availability
//   POST /victim/register                 — register as victim (adds Victim role)
//   GET  /victim/incidents                — victim's own incidents (victim tab)
//   POST /auth/logout                     — sets Availability=No, blocks if active assignments
//   POST /volunteer/assignment/:id/request-backup — sends backup request to dispatcher

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import VictimDashboard from './VictimDashboard';

// ── Colour maps ───────────────────────────────────────────────────────────────
const severityColor = {
  High:   { bg: '#fff0f0', text: '#c0392b' },
  Medium: { bg: '#fffbf0', text: '#d68910' },
  Low:    { bg: '#f0fff4', text: '#1e8449' },
};
const statusColor = {
  Pending:   { bg: '#f5f5f5', text: '#777' },
  Ongoing:   { bg: '#fff3e0', text: '#e67e22' },
  Arrived:   { bg: '#e8f5e9', text: '#27ae60' },
  Completed: { bg: '#e8f4fd', text: '#2980b9' },
};
const emergencyIcon = {
  'Domestic Violence': '🏠', 'Sexual Assault': '⚠️',
  'Harassment': '🚨', 'Kidnapping': '🔒',
  'Stalking': '👁️', 'Medical Emergency': '🏥',
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
    }}>{label}</span>
  );
};

const Row = ({ label, value }) => (
  <div style={S.row}>
    <span style={S.rowLabel}>{label}</span>
    <span style={S.rowValue}>{value || '—'}</span>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const VolunteerDashboard = () => {
  const { user, login, logout: ctxLogout } = useAuth();

  const [activeView, setActiveView] = useState('volunteer');
  const [tab, setTab] = useState('current');

  const [currentData,   setCurrentData]   = useState([]);
  const [historyData,   setHistoryData]   = useState([]);
  const [availability,  setAvailability]  = useState(null);

  const [loadingCurrent,  setLoadingCurrent]  = useState(true);
  const [loadingHistory,  setLoadingHistory]  = useState(false);
  const [loadingAvail,    setLoadingAvail]    = useState(false);
  const [updatingId,      setUpdatingId]      = useState(null);
  const [loggingOut,      setLoggingOut]      = useState(false);
  const [registeringVictim, setRegisteringVictim] = useState(false);

  const [requestingBackupId, setRequestingBackupId] = useState(null);
  const [backupReason,       setBackupReason]       = useState('');
  const [showBackupInput,    setShowBackupInput]    = useState(null);

  const [showRegisterForm, setShowRegisterForm] = useState(false);

  const isAlsoVictim = user?.roles?.includes('Victim');

  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [optimisticStatus, setOptimisticStatus] = useState({});

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ── Fetch current assignments ─────────────────────────────────────────────
  const fetchCurrent = useCallback(async () => {
    setLoadingCurrent(true);
    setError('');
    try {
      const res = await API.get('/volunteer/assignments/current');
      setCurrentData(res.data);
      setOptimisticStatus({});
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
    fetchHistory();
  }, [fetchCurrent, fetchHistory]);

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    setLoggingOut(true);
    setError('');
    try {
      await API.post('/auth/logout');
      ctxLogout();
    } catch (e) {
      setError(e.response?.data?.message || 'Logout failed');
      setLoggingOut(false);
    }
  };

  // ── Availability toggle ───────────────────────────────────────────────────
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

  // ── Assignment status update ──────────────────────────────────────────────
  const handleStatusUpdate = async (assignmentId, newStatus) => {
    setUpdatingId(assignmentId);
    setError('');
    setOptimisticStatus(prev => ({ ...prev, [assignmentId]: newStatus }));
    try {
      await API.put(`/volunteer/assignment/${assignmentId}`, { Status: newStatus });
      showToast(`Status updated to ${newStatus}`);
      await fetchCurrent();
    } catch (e) {
      setOptimisticStatus(prev => {
        const copy = { ...prev };
        delete copy[assignmentId];
        return copy;
      });
      setError(e.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Backup request ────────────────────────────────────────────────────────
  const handleBackupRequest = async (assignmentId) => {
    setRequestingBackupId(assignmentId);
    setError('');
    try {
      await API.post(`/volunteer/assignment/${assignmentId}/request-backup`, {
        reason: backupReason.trim() || undefined,
      });
      showToast('Backup request sent to dispatcher');
      setShowBackupInput(null);
      setBackupReason('');
      await fetchCurrent();
    } catch (e) {
      setError(e.response?.data?.message || 'Backup request failed');
    } finally {
      setRequestingBackupId(null);
    }
  };

  // ── Register as victim ────────────────────────────────────────────────────
  const handleRegisterAsVictim = async () => {
    setRegisteringVictim(true);
    setError('');
    try {
      const res = await API.post('/victim/register', {});
      const { token } = res.data;
      if (token) {
        const base64Url = token.split('.')[1];
        const base64    = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const userData  = JSON.parse(window.atob(base64));
        login(token, userData);
      }
      showToast('You are now registered as a Victim!');
      setShowRegisterForm(false);
      setActiveView('victim');
    } catch (e) {
      setError(e.response?.data?.message || 'Registration failed');
    } finally {
      setRegisteringVictim(false);
    }
  };

  // ── Assignment card ───────────────────────────────────────────────────────
  const AssignmentCard = ({ item, showActions, currentStatus }) => {
    const sev = severityColor[item.Severity]        || severityColor.Low;
    const ast = statusColor[currentStatus]          || statusColor.Pending;
    const ist = statusColor[item.Incident_Status]   || statusColor.Pending;
    const isUpdating   = updatingId === item.Assignment_id;
    const isRequesting = requestingBackupId === item.Assignment_id;
    const showInput    = showBackupInput === item.Assignment_id;

    return (
      <div style={S.card}>

        {/* Card header */}
        <div style={S.cardHeader}>
          <div style={S.cardHeaderLeft}>
            <span style={S.emergencyIcon}>{emergencyIcon[item.Emergency_type] || '🚨'}</span>
            <div>
              <p style={S.emergencyType}>{item.Emergency_type || '—'}</p>
              <p style={S.incidentId}>Incident #{item.Incident_id} · Assignment #{item.Assignment_id}</p>
            </div>
          </div>
          <div style={S.badgeGroup}>
            <Badge label={item.Severity || '—'} scheme={sev} />
            <Badge label={currentStatus || '—'} scheme={ast} />
          </div>
        </div>

        {/* Incident details */}
        <div style={S.section}>
          <Row label="📍 Location" value={item.Incident_Location} />
          <Row label="🕐 Reported" value={fmt(item.Incident_Time)} />
          <Row label="📋 Note"     value={item.Incident_Note} />
          <Row label="🔎 Status"   value={<Badge label={item.Incident_Status || '—'} scheme={ist} />} />
        </div>

        {/* Victim */}
        {item.Victim_Name && (
          <div style={{ ...S.section, borderTop: '1px solid #f0f0f0' }}>
            <p style={S.sectionTitle}>Victim</p>
            <Row label="👤 Name"  value={item.Victim_Name} />
            <Row label="📞 Phone" value={item.Victim_Phone} />
          </div>
        )}

        {/* Dispatcher */}
        {(item.Dispatcher_id || item.Dispatcher_Name) && (
          <div style={{ ...S.section, borderTop: '1px solid #f0f0f0' }}>
            <p style={S.sectionTitle}>Dispatcher</p>
            <Row label="🆔 Dispatcher ID" value={item.Dispatcher_id} />
            <Row label="🧑‍💼 Name"          value={item.Dispatcher_Name} />
          </div>
        )}

        {/* Timing */}
        <div style={{ ...S.section, borderTop: '1px solid #f0f0f0' }}>
          <Row label="⏱ Assigned"   value={fmt(item.Assigned_time)} />
          {item.Completion_time && <Row label="✅ Completed" value={fmt(item.Completion_time)} />}
        </div>

        {/* Actions — active assignments only */}
        {showActions && (
          <div style={S.actions}>
            <p style={S.actionsLabel}>Update your status</p>
            <div style={S.actionButtons}>
              {['Pending', 'Arrived', 'Ongoing'].map(s => {
                const isActive = currentStatus === s;
                const sc = statusColor[s] || { bg: '#f5f5f5', text: '#777' };
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusUpdate(item.Assignment_id, s)}
                    disabled={isUpdating || isRequesting}
                    style={{
                      ...S.actionBtn,
                      backgroundColor: sc.bg,
                      color: sc.text,
                      border: isActive
                        ? `2px solid ${sc.text}`
                        : `1.5px solid ${sc.text}30`,
                      boxShadow: isActive
                        ? `0 0 0 3px ${sc.text}28`
                        : 'none',
                      fontWeight: isActive ? '800' : '700',
                      transform: isActive ? 'scale(1.07)' : 'scale(1)',
                      opacity: (isUpdating || isRequesting) ? 0.6 : 1,
                      cursor: (isUpdating || isRequesting) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {isUpdating && optimisticStatus[item.Assignment_id] === s
                      ? '…'
                      : isActive
                        ? `✓ ${s}`
                        : s}
                  </button>
                );
              })}
            </div>

            {/* Backup request */}
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #fecaca' }}>
              {!showInput ? (
                <button
                  onClick={() => { setShowBackupInput(item.Assignment_id); setBackupReason(''); }}
                  disabled={isUpdating || isRequesting}
                  style={S.backupBtn}
                >
                  🆘 Request Backup
                </button>
              ) : (
                <div>
                  <p style={{ ...S.actionsLabel, color: '#c0392b', marginBottom: '8px' }}>
                    🆘 Request Backup from Dispatcher
                  </p>
                  <input
                    type="text"
                    value={backupReason}
                    onChange={e => setBackupReason(e.target.value)}
                    placeholder="Reason (optional) — e.g. suspect is armed, need police"
                    style={S.backupInput}
                    onKeyDown={e => e.key === 'Enter' && handleBackupRequest(item.Assignment_id)}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      onClick={() => handleBackupRequest(item.Assignment_id)}
                      disabled={isRequesting}
                      style={{
                        ...S.actionBtn,
                        backgroundColor: '#fff0f0', color: '#c0392b',
                        border: '1.5px solid #fecaca', fontWeight: '700',
                        opacity: isRequesting ? 0.6 : 1,
                        cursor: isRequesting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isRequesting ? 'Sending…' : 'Send Request'}
                    </button>
                    <button
                      onClick={() => { setShowBackupInput(null); setBackupReason(''); }}
                      disabled={isRequesting}
                      style={{
                        ...S.actionBtn,
                        backgroundColor: '#f5f5f5', color: '#888',
                        border: '1.5px solid #e0e0e0', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const displayData = tab === 'current' ? currentData : historyData;
  const isLoadingVolunteer = tab === 'current' ? loadingCurrent : loadingHistory;

  // ── Filter / search state ─────────────────────────────────────────────────
  const [searchAssignId, setSearchAssignId] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [volDateFrom,    setVolDateFrom]    = useState('');
  const [volDateTo,      setVolDateTo]      = useState('');

  const filteredData = displayData.filter(item => {
    if (searchAssignId.trim() &&
        !item.Assignment_id?.toLowerCase().includes(searchAssignId.trim().toLowerCase()) &&
        !item.Incident_id?.toLowerCase().includes(searchAssignId.trim().toLowerCase()))
      return false;
    if (filterSeverity && item.Severity !== filterSeverity)
      return false;
    const ts = item.Assigned_time ? new Date(item.Assigned_time) : null;
    if (volDateFrom && ts && ts < new Date(volDateFrom))
      return false;
    if (volDateTo   && ts && ts > new Date(volDateTo + 'T23:59:59'))
      return false;
    return true;
  });

  const hasVolFilters = searchAssignId || filterSeverity || volDateFrom || volDateTo;
  const clearVolFilters = () => {
    setSearchAssignId(''); setFilterSeverity(''); setVolDateFrom(''); setVolDateTo('');
  };

  return (
    <div style={S.page}>

      {/* Toast */}
      {toast && <div style={S.toast}>{toast}</div>}

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.avatar}>🤝</div>
          <div>
            <h1 style={S.name}>{user?.name || user?.id}</h1>
            <p style={S.meta}>
              Volunteer{isAlsoVictim ? ' · Victim' : ''} · {user?.id}
            </p>
          </div>
        </div>
        <div style={S.headerRight}>

          {activeView === 'volunteer' && (
            <div style={S.availRow}>
              <span style={S.availLabel}>Available</span>
              <button
                onClick={handleAvailabilityToggle}
                disabled={loadingAvail}
                style={{ ...S.toggle, backgroundColor: availability === 'Yes' ? '#27ae60' : '#ccc' }}
              >
                <div style={{
                  ...S.toggleKnob,
                  transform: availability === 'Yes' ? 'translateX(20px)' : 'translateX(2px)',
                }} />
              </button>
              <span style={{ ...S.availStatus, color: availability === 'Yes' ? '#27ae60' : '#aaa' }}>
                {loadingAvail ? '…' : (availability || '—')}
              </span>
            </div>
          )}

          {isAlsoVictim && (
            <div style={S.viewSwitcher}>
              <button
                onClick={() => setActiveView('volunteer')}
                style={{ ...S.viewBtn, ...(activeView === 'volunteer' ? S.viewBtnActive : {}) }}
              >
                🤝 Volunteer
              </button>
              <button
                onClick={() => setActiveView('victim')}
                style={{ ...S.viewBtn, ...(activeView === 'victim' ? S.viewBtnActiveVictim : {}) }}
              >
                🛡️ Victim
              </button>
            </div>
          )}

          {!isAlsoVictim && !showRegisterForm && (
            <button
              onClick={() => setShowRegisterForm(true)}
              style={S.registerVictimBtn}
            >
              🛡️ Register as Victim
            </button>
          )}

          <button onClick={handleLogout} disabled={loggingOut} style={S.logoutBtn}>
            {loggingOut ? 'Logging out…' : 'Sign Out'}
          </button>
        </div>
      </div>

      {/* Register as Victim inline form */}
      {showRegisterForm && (
        <div style={S.registerBanner}>
          <div style={S.registerBannerInner}>
            <div>
              <p style={S.registerBannerTitle}>Register as a Victim</p>
              <p style={S.registerBannerSub}>
                Your existing emergency contact from your volunteer profile will be used.
                This gives you access to the Victim tab to submit and track emergency requests.
              </p>
            </div>
            <div style={S.registerBannerActions}>
              <button
                onClick={handleRegisterAsVictim}
                disabled={registeringVictim}
                style={S.registerConfirmBtn}
              >
                {registeringVictim ? 'Registering…' : 'Confirm Registration'}
              </button>
              <button
                onClick={() => { setShowRegisterForm(false); setError(''); }}
                style={S.registerCancelBtn}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={S.errorBanner}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={S.errorClose}>✕</button>
        </div>
      )}

      {/* ── VOLUNTEER VIEW ─────────────────────────────────────────────────── */}
      {activeView === 'volunteer' && (
        <>
          <div style={S.tabs}>
            {[
              { key: 'current', label: `Active (${currentData.length})` },
              { key: 'history', label: `Completed (${historyData.length})` },
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

          <div style={S.content}>

            {!isLoadingVolunteer && (
              <div style={S.filterBar}>
                <div style={S.filterField}>
                  <span style={S.filterIcon}>🔍</span>
                  <input
                    type="text"
                    value={searchAssignId}
                    onChange={e => setSearchAssignId(e.target.value)}
                    placeholder="Search by Assignment / Incident ID"
                    style={S.filterInput}
                  />
                </div>
                <div style={S.filterField}>
                  <span style={S.filterIcon}>📊</span>
                  <select
                    value={filterSeverity}
                    onChange={e => setFilterSeverity(e.target.value)}
                    style={S.filterSelect}
                  >
                    <option value="">All severities</option>
                    {['High', 'Medium', 'Low'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div style={S.filterField}>
                  <span style={S.filterIconLabel}>📅 From</span>
                  <input
                    type="date"
                    value={volDateFrom}
                    onChange={e => setVolDateFrom(e.target.value)}
                    style={S.filterInput}
                  />
                </div>
                <div style={S.filterField}>
                  <span style={S.filterIconLabel}>📅 To</span>
                  <input
                    type="date"
                    value={volDateTo}
                    onChange={e => setVolDateTo(e.target.value)}
                    style={S.filterInput}
                  />
                </div>
                {hasVolFilters && (
                  <button onClick={clearVolFilters} style={S.clearBtn}>✕ Clear</button>
                )}
              </div>
            )}

            {hasVolFilters && displayData.length > 0 && (
              <p style={S.filterCount}>
                Showing {filteredData.length} of {displayData.length} assignments
              </p>
            )}

            {isLoadingVolunteer ? (
              <div style={S.empty}>
                <div style={S.spinner} />
                <p style={S.emptyText}>Loading assignments…</p>
              </div>
            ) : displayData.length === 0 ? (
              <div style={S.empty}>
                <p style={S.emptyIcon}>{tab === 'current' ? '📋' : '✅'}</p>
                <p style={S.emptyText}>
                  {tab === 'current' ? 'No active assignments right now.' : 'No completed assignments yet.'}
                </p>
              </div>
            ) : filteredData.length === 0 ? (
              <div style={S.empty}>
                <p style={S.emptyIcon}>🔍</p>
                <p style={S.emptyText}>No assignments match your filters.</p>
                <button onClick={clearVolFilters} style={S.clearBtnLg}>Clear Filters</button>
              </div>
            ) : (
              <div style={S.grid}>
                {filteredData.map((item, i) => (
                  <AssignmentCard
                    key={item.Vol_assignment_id || i}
                    item={item}
                    showActions={tab === 'current'}
                    currentStatus={optimisticStatus[item.Assignment_id] ?? item.Vol_Status ?? item.Assignment_Status}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── VICTIM VIEW — full VictimDashboard embedded ─────────────────── */}
      {activeView === 'victim' && (
        <VictimDashboard embeddedMode={true} />
      )}

    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh', backgroundColor: '#f7f9fc',
    fontFamily: "'Segoe UI', system-ui, sans-serif", paddingBottom: '60px',
  },
  toast: {
    position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
    backgroundColor: '#27ae60', color: '#fff', padding: '10px 24px',
    borderRadius: '30px', fontSize: '13px', fontWeight: '600',
    boxShadow: '0 4px 20px rgba(39,174,96,0.3)', zIndex: 9999, whiteSpace: 'nowrap',
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
    backgroundColor: '#e8f5e9', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: '24px',
  },
  name: { margin: 0, fontSize: '18px', fontWeight: '700', color: '#1a1a2e' },
  meta: { margin: '2px 0 0', fontSize: '13px', color: '#999' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  availRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  availLabel: { fontSize: '13px', color: '#555', fontWeight: '600' },
  toggle: {
    width: '44px', height: '24px', borderRadius: '12px', border: 'none',
    cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s', padding: 0,
  },
  toggleKnob: {
    position: 'absolute', top: '2px', width: '20px', height: '20px',
    borderRadius: '50%', backgroundColor: '#fff',
    transition: 'transform 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  availStatus: { fontSize: '13px', fontWeight: '700', minWidth: '24px' },
  viewSwitcher: {
    display: 'flex', borderRadius: '10px',
    overflow: 'hidden', border: '1.5px solid #e0e0e0',
  },
  viewBtn: {
    padding: '8px 16px', border: 'none', backgroundColor: '#f9f9f9',
    color: '#888', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    transition: 'all 0.15s',
  },
  viewBtnActive:       { backgroundColor: '#27ae60', color: '#fff' },
  viewBtnActiveVictim: { backgroundColor: '#7b2d8b', color: '#fff' },
  registerVictimBtn: {
    padding: '8px 14px', borderRadius: '8px',
    border: '1.5px solid #7b2d8b', backgroundColor: 'transparent',
    color: '#7b2d8b', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
  },
  logoutBtn: {
    padding: '8px 18px', borderRadius: '8px',
    border: '1.5px solid #ddd', backgroundColor: '#fff',
    color: '#555', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
  },
  registerBanner: {
    backgroundColor: '#faf5ff', borderBottom: '1px solid #e9d5ff', padding: '16px 32px',
  },
  registerBannerInner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: '16px', maxWidth: '900px',
  },
  registerBannerTitle: { margin: '0 0 4px', fontSize: '14px', fontWeight: '700', color: '#7b2d8b' },
  registerBannerSub:   { margin: 0, fontSize: '12px', color: '#888', maxWidth: '500px' },
  registerBannerActions: { display: 'flex', gap: '10px' },
  registerConfirmBtn: {
    padding: '9px 20px', borderRadius: '8px', border: 'none',
    backgroundColor: '#7b2d8b', color: '#fff',
    fontSize: '13px', fontWeight: '700', cursor: 'pointer',
  },
  registerCancelBtn: {
    padding: '9px 16px', borderRadius: '8px',
    border: '1.5px solid #ccc', backgroundColor: '#fff',
    color: '#888', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
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
    marginBottom: '-2px', transition: 'color 0.15s', borderRadius: '6px 6px 0 0',
  },
  tabActive: { color: '#27ae60', borderBottom: '2px solid #27ae60', backgroundColor: '#f7fff9' },
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
  filterIcon:      { fontSize: '13px', flexShrink: 0 },
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
    border: '1.5px solid #d5f5e3', backgroundColor: '#eafaf1',
    color: '#1e8449', fontSize: '12px', fontWeight: '700',
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  clearBtnLg: {
    marginTop: '8px', padding: '10px 24px', borderRadius: '8px',
    border: 'none', backgroundColor: '#27ae60', color: '#fff',
    fontSize: '13px', fontWeight: '700', cursor: 'pointer',
  },
  filterCount: { fontSize: '12px', color: '#aaa', margin: '-8px 0 12px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '20px' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: '12px' },
  emptyIcon: { fontSize: '48px', margin: 0 },
  emptyText: { fontSize: '15px', color: '#aaa', margin: 0 },
  spinner: { width: '32px', height: '32px', border: '3px solid #e0f2e9', borderTop: '3px solid #27ae60', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  card: { backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #eef0f3', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden' },
  cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '16px 20px', backgroundColor: '#fafbfc', borderBottom: '1px solid #f0f0f0' },
  cardHeaderLeft: { display: 'flex', alignItems: 'flex-start', gap: '12px' },
  emergencyIcon: { fontSize: '28px', lineHeight: 1 },
  emergencyType: { margin: 0, fontSize: '15px', fontWeight: '700', color: '#1a1a2e' },
  incidentId: { margin: '2px 0 0', fontSize: '11px', color: '#aaa' },
  badgeGroup: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' },
  section: { padding: '12px 20px' },
  sectionTitle: { margin: '0 0 8px', fontSize: '11px', fontWeight: '700', color: '#bbb', textTransform: 'uppercase', letterSpacing: '1px' },
  row: { display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '3px 0' },
  rowLabel: { fontSize: '12px', color: '#aaa', fontWeight: '600', minWidth: '110px', flexShrink: 0 },
  rowValue: { fontSize: '13px', color: '#333', fontWeight: '500', wordBreak: 'break-word' },
  actions: { padding: '14px 20px', borderTop: '1px solid #f0f0f0', backgroundColor: '#fafffe' },
  actionsLabel: { margin: '0 0 10px', fontSize: '11px', fontWeight: '700', color: '#bbb', textTransform: 'uppercase', letterSpacing: '1px' },
  actionButtons: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  actionBtn: { padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', transition: 'all 0.15s' },
  backupBtn: {
    padding: '6px 14px', borderRadius: '20px',
    border: '1.5px solid #fecaca', backgroundColor: '#fff0f0',
    color: '#c0392b', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
  },
  backupInput: {
    width: '100%', padding: '8px 12px', borderRadius: '8px',
    border: '1.5px solid #fecaca', fontSize: '13px',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  },
};

const styleTag = document.createElement('style');
styleTag.innerHTML = `@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`;
document.head.appendChild(styleTag);

export default VolunteerDashboard;