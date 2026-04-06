// src/pages/DispatcherDashboard.jsx
// Full dispatcher dashboard
// Tabs: Overview | Calls | Incidents | Cases | Resources | Volunteers | Backups | Victim
//
// ── CHANGES ──────────────────────────────────────────────────────────────────
// 1. Added NotificationStack component — renders a fixed stack of popup toasts
//    at top-right of screen. Multiple notifications stack vertically, each with
//    its own dismiss button and auto-dismiss after 8 seconds.
// 2. Added useDispatcherNotifications hook — polls /dispatcher/workload every
//    15 seconds and /dispatcher/incidents to detect:
//      a) New incoming requests: active_requests count increases → shows
//         "🆕 New request received" notification.
//      b) Volunteer arrived: scans all incidents for volunteers whose status
//         changed to 'Arrived' → shows "🤝 Volunteer arrived — Incident #X"
//         notification with the incident ID.
//    Both checks compare against a ref of the previous poll state so only
//    genuine changes trigger a notification (not the initial load).
// 3. Hook is called inside DispatcherDashboard and passes addNotification down
//    to OverviewTab so the overview stats also stay live.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import VictimDashboard from './VictimDashboard';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const Badge = ({ label, color = '#888', bg = '#f5f5f5' }) => (
  <span style={{
    display: 'inline-block', padding: '2px 10px', borderRadius: '20px',
    fontSize: '11px', fontWeight: '700', backgroundColor: bg, color,
    letterSpacing: '0.3px', cursor: 'default', userSelect: 'none',
  }}>{label}</span>
);

const statusBadge = (s) => {
  const m = {
    Ongoing:   { color: '#e67e22', bg: '#fff3e0' },
    Pending:   { color: '#777',    bg: '#f5f5f5' },
    Completed: { color: '#2980b9', bg: '#e8f4fd' },
    Arrived:   { color: '#27ae60', bg: '#eafaf1' },
    High:      { color: '#c0392b', bg: '#fff0f0' },
    Medium:    { color: '#d68910', bg: '#fffbf0' },
    Low:       { color: '#1e8449', bg: '#f0fff4' },
    True:      { color: '#1e8449', bg: '#eafaf1' },
    False:     { color: '#8e44ad', bg: '#fdf2f8' },
    Yes:       { color: '#1e8449', bg: '#eafaf1' },
    No:        { color: '#c0392b', bg: '#fff0f0' },
  };
  const c = m[s] || { color: '#555', bg: '#f5f5f5' };
  return <Badge label={s || '—'} color={c.color} bg={c.bg} />;
};

const Field = ({ label, value }) => (
  <div style={D.field}>
    <span style={D.fieldLabel}>{label}</span>
    <span style={D.fieldValue}>{value ?? '—'}</span>
  </div>
);

const SectionTitle = ({ children }) => (
  <p style={D.sectionTitle}>{children}</p>
);

const Err = ({ msg }) => msg ? (
  <div style={D.errBox}>⚠️ {msg}</div>
) : null;

const Spinner = () => (
  <div style={{ display:'flex', justifyContent:'center', padding:'60px' }}>
    <div style={{ width:'28px', height:'28px', border:'3px solid #e0e8ef', borderTop:'3px solid #2d6a8b', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
  </div>
);

const Empty = ({ icon, text }) => (
  <div style={{ textAlign:'center', padding:'60px 20px' }}>
    <p style={{ fontSize:'40px', margin:'0 0 10px' }}>{icon}</p>
    <p style={{ fontSize:'14px', color:'#aaa', margin:0 }}>{text}</p>
  </div>
);

const EMERGENCY_TYPES = ['Domestic Violence', 'Sexual Assault', 'Harassment', 'Kidnapping', 'Stalking', 'Medical Emergency'];
const SEVERITIES      = ['High', 'Medium', 'Low'];
const CASE_TYPES      = ['Support', 'Penalty'];
const REQUEST_TYPES   = ['Emergency', 'Query', 'False'];
const STATUSES        = ['Ongoing', 'Pending', 'Completed'];

// ── CHANGE: NotificationStack — fixed top-right stack of popup toasts ─────────
// Each notification has: id, message, type ('arrival' | 'new_request')
// Multiple notifications stack vertically below each other.
// Auto-dismissed after 8 seconds, or manually via ✕ button.
const NotificationStack = ({ notifications, onDismiss }) => {
  if (!notifications.length) return null;
  return (
    <div style={{
      position: 'fixed',
      top: '80px',        // below the header
      right: '24px',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '340px',
      pointerEvents: 'none',  // container doesn't block clicks
    }}>
      {notifications.map(n => (
        <div
          key={n.id}
          style={{
            pointerEvents: 'all',
            backgroundColor: n.type === 'arrival' ? '#eafaf1' : '#f0f7fb',
            border: `1.5px solid ${n.type === 'arrival' ? '#a9dfbf' : '#b5d4f4'}`,
            borderLeft: `4px solid ${n.type === 'arrival' ? '#27ae60' : '#2d6a8b'}`,
            borderRadius: '10px',
            padding: '12px 14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            animation: 'slideInRight 0.25s ease-out',
          }}
        >
          <span style={{ fontSize: '18px', flexShrink: 0, lineHeight: 1.2 }}>
            {n.type === 'arrival' ? '🤝' : '🆕'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: '0 0 2px',
              fontSize: '13px',
              fontWeight: '700',
              color: n.type === 'arrival' ? '#1e8449' : '#185fa5',
            }}>
              {n.type === 'arrival' ? 'Volunteer Arrived' : 'New Request Received'}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#555', wordBreak: 'break-word' }}>
              {n.message}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#aaa' }}>
              {new Date(n.ts).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </p>
          </div>
          <button
            onClick={() => onDismiss(n.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '14px', color: '#aaa', flexShrink: 0,
              padding: '0 2px', lineHeight: 1,
            }}
          >✕</button>
        </div>
      ))}
    </div>
  );
};

// ── CHANGE: useDispatcherNotifications hook ────────────────────────────────────
// Polls every 15 seconds. Compares against previous values stored in refs.
// - Detects increase in active_requests (new call came in)
// - Detects any volunteer whose status became 'Arrived' in any incident
// Returns { notifications, addNotification, dismissNotification }
const useDispatcherNotifications = () => {
  const [notifications, setNotifications] = useState([]);

  // Refs to hold previous poll values — using refs so the interval closure
  // always has fresh values without needing to re-register the interval.
  const prevRequestCount  = useRef(null);   // previous active_requests count
  const prevVolStatuses   = useRef({});     // map of volunteerId -> status per incident

  const addNotification = useCallback((message, type) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, type, ts: Date.now() }]);
    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 8000);
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        // Check active_requests count for new incoming requests
        const workloadRes = await API.get('/dispatcher/workload');
        const currentCount = workloadRes.data?.current_workload?.active_requests ?? 0;

        if (prevRequestCount.current !== null && currentCount > prevRequestCount.current) {
          const diff = currentCount - prevRequestCount.current;
          addNotification(
            `${diff} new emergency request${diff > 1 ? 's' : ''} assigned to you.`,
            'new_request'
          );
        }
        prevRequestCount.current = currentCount;

        // Check volunteer statuses across all incidents for 'Arrived' changes
        const incidentsRes = await API.get('/dispatcher/incidents');
        const incidents = incidentsRes.data || [];

        for (const incident of incidents) {
          if (!incident.Assignment_id) continue;
          try {
            const volRes = await API.get(`/dispatcher/incident/${incident.Incident_id}/volunteers`);
            const volunteers = volRes.data || [];

            for (const vol of volunteers) {
              const key = `${incident.Incident_id}_${vol.Volunteer_id}`;
              const prevStatus = prevVolStatuses.current[key];

              // Notify only when status *changes to* Arrived (not on first load)
              if (
                prevStatus !== undefined &&
                prevStatus !== 'Arrived' &&
                vol.volunteer_status === 'Arrived'
              ) {
                addNotification(
                  `${vol.volunteer_name} arrived on scene — Incident #${incident.Incident_id}`,
                  'arrival'
                );
              }

              // Always update the stored status
              prevVolStatuses.current[key] = vol.volunteer_status;
            }
          } catch {
            // Ignore per-incident fetch errors silently
          }
        }
      } catch {
        // Ignore poll errors silently — don't disrupt the UI
      }
    };

    // Initial poll to seed the ref values (no notifications on first run
    // because prevRequestCount.current starts as null and prevVolStatuses
    // starts empty — conditions above won't fire on first load)
    poll();

    const interval = setInterval(poll, 15000); // every 15 seconds
    return () => clearInterval(interval);
  }, [addNotification]);

  return { notifications, addNotification, dismissNotification };
};

// ── Main Component ────────────────────────────────────────────────────────────
const DispatcherDashboard = () => {
  const { user, login, logout: ctxLogout } = useAuth();
  const isAlsoVictim = user?.roles?.includes('Victim');

  const [tab, setTab]           = useState('overview');
  const [toast, setToast]       = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [globalErr, setGlobalErr]   = useState('');
  const [showRegForm, setShowRegForm]       = useState(false);
  const [regContact, setRegContact]         = useState('');
  const [registeringVictim, setRegisteringVictim] = useState(false);
  const [regErr, setRegErr]                 = useState('');

  // CHANGE: Hook provides notification state and handlers (addNotification is internal to the hook)
  const { notifications, dismissNotification } = useDispatcherNotifications();

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await API.post('/auth/logout');
      ctxLogout();
    } catch (e) {
      setGlobalErr(e.response?.data?.message || e.response?.data?.error || 'Logout failed');
      setLoggingOut(false);
    }
  };

  const handleRegisterVictim = async () => {
    setRegErr('');
    if (!regContact.trim())              return setRegErr('Emergency contact is required');
    if (!/^\d{10,11}$/.test(regContact)) return setRegErr('Must be 10 or 11 digits');
    if (!regContact.startsWith('03'))    return setRegErr('Must start with 03');
    setRegisteringVictim(true);
    try {
      const res = await API.post('/victim/register', { Emergency_contact: regContact.trim() });
      if (res.data.token) {
        const b64 = res.data.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
        login(res.data.token, JSON.parse(window.atob(b64)));
      }
      showToast('Registered as Victim successfully!');
      setShowRegForm(false); setRegContact(''); setTab('victim');
    } catch (e) {
      setRegErr(e.response?.data?.message || 'Registration failed');
    } finally {
      setRegisteringVictim(false);
    }
  };

  const TABS = [
    { key: 'overview',   label: '📊 Overview' },
    { key: 'calls',      label: '📋 Calls' },
    { key: 'incidents',  label: '🚨 Incidents' },
    { key: 'cases',      label: '⚖️ Cases' },
    { key: 'resources',  label: '🚔 Resources' },
    { key: 'volunteers', label: '🤝 Volunteers' },
    { key: 'backups',    label: '🆘 Backups' },
    ...(isAlsoVictim ? [{ key: 'victim', label: '🛡️ My Victim View' }] : []),
  ];

  return (
    <div style={D.page}>
      {toast && <div style={D.toast}>{toast}</div>}

      {/* CHANGE: Notification stack renders fixed top-right, outside normal flow */}
      <NotificationStack notifications={notifications} onDismiss={dismissNotification} />

      <div style={D.header}>
        <div style={D.headerLeft}>
          <div style={D.avatar}>📞</div>
          <div>
            <h1 style={D.name}>{user?.name || user?.id}</h1>
            <p style={D.meta}>Dispatcher{isAlsoVictim ? ' · Victim' : ''} · {user?.id}</p>
          </div>
        </div>
        <div style={D.headerRight}>
          {!isAlsoVictim && !showRegForm && (
            <button onClick={() => setShowRegForm(true)} style={D.regBtn}>🛡️ Register as Victim</button>
          )}
          <button onClick={handleLogout} disabled={loggingOut} style={D.logoutBtn}>
            {loggingOut ? 'Logging out…' : 'Sign Out'}
          </button>
        </div>
      </div>

      {showRegForm && (
        <div style={D.banner}>
          <div style={D.bannerInner}>
            <div>
              <p style={D.bannerTitle}>Register as a Victim</p>
              <p style={D.bannerSub}>Provide an emergency contact to register yourself as a victim.</p>
              {regErr && <p style={D.bannerErr}>⚠️ {regErr}</p>}
              <input value={regContact} onChange={e=>{setRegContact(e.target.value);setRegErr('');}}
                placeholder="03001234567" maxLength={11} style={D.bannerInput} />
            </div>
            <div style={D.bannerActions}>
              <button onClick={handleRegisterVictim} disabled={registeringVictim} style={D.bannerConfirm}>
                {registeringVictim ? 'Registering…' : 'Confirm'}
              </button>
              <button onClick={()=>{setShowRegForm(false);setRegErr('');setRegContact('');}} style={D.bannerCancel}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {globalErr && (
        <div style={D.errBanner}>
          <span>⚠️ {globalErr}</span>
          <button onClick={()=>setGlobalErr('')} style={D.errClose}>✕</button>
        </div>
      )}

      <div style={D.tabs}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ ...D.tab, ...(tab === t.key ? D.tabActive : {}) }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={D.content}>
        {tab === 'overview'   && <OverviewTab   showToast={showToast} />}
        {tab === 'calls'      && <CallsTab      showToast={showToast} userId={user?.id} />}
        {tab === 'incidents'  && <IncidentsTab  showToast={showToast} />}
        {tab === 'cases'      && <CasesTab      showToast={showToast} />}
        {tab === 'resources'  && <ResourcesTab  showToast={showToast} />}
        {tab === 'volunteers' && <VolunteersTab showToast={showToast} />}
        {tab === 'backups'    && <BackupsTab    showToast={showToast} />}
        {tab === 'victim'     && isAlsoVictim && <VictimDashboard embeddedMode={true} />}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ══════════════════════════════════════════════════════════════════════════════
const OverviewTab = ({ showToast }) => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [updatingAvail, setUpdatingAvail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await API.get('/dispatcher/workload'); setData(res.data); }
    catch (e) { setErr(e.response?.data?.error || 'Failed to load workload'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleAvailability = async () => {
    if (!data) return;
    const next = data.availability === 'Yes' ? 'No' : 'Yes';
    setUpdatingAvail(true);
    try {
      await API.put('/dispatcher/availability', { availability: next });
      setData(prev => ({ ...prev, availability: next }));
      showToast(`Availability set to ${next}`);
    } catch (e) { setErr(e.response?.data?.error || 'Failed to update availability'); }
    finally { setUpdatingAvail(false); }
  };

  if (loading) return <Spinner />;
  if (err)     return <Err msg={err} />;
  if (!data)   return null;

  const cw = data.current_workload;
  const h  = data.history;

  return (
    <div style={D.overviewGrid}>
      <div style={D.statCard}>
        <p style={D.statLabel}>Availability</p>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginTop:'8px' }}>
          {statusBadge(data.availability)}
          <button onClick={toggleAvailability} disabled={updatingAvail} style={{
            ...D.smallBtn,
            backgroundColor: data.availability === 'Yes' ? '#fff0f0' : '#eafaf1',
            color:            data.availability === 'Yes' ? '#c0392b' : '#1e8449',
            border:           `1.5px solid ${data.availability === 'Yes' ? '#fecaca' : '#a9dfbf'}`,
          }}>
            {updatingAvail ? '…' : data.availability === 'Yes' ? 'Set Offline' : 'Set Online'}
          </button>
        </div>
      </div>
      <div style={D.statCard}><p style={D.statLabel}>Active Requests</p><p style={D.statNum}>{cw.active_requests}</p>{cw.oldest_request && <p style={D.statSub}>Oldest: {fmt(cw.oldest_request)}</p>}</div>
      <div style={D.statCard}><p style={D.statLabel}>Active Incidents</p><p style={D.statNum}>{cw.active_incidents}</p></div>
      <div style={D.statCard}><p style={D.statLabel}>Total Handled</p><p style={D.statNum}>{h.total_handled}</p></div>
      <div style={D.statCard}><p style={D.statLabel}>Total Incidents</p><p style={D.statNum}>{h.total_incidents}</p></div>
      <div style={D.statCard}><p style={D.statLabel}>Avg Response Time</p><p style={D.statNum}>{h.avg_response_time != null ? `${Math.round(h.avg_response_time)} min` : '—'}</p></div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// CALLS TAB
// ══════════════════════════════════════════════════════════════════════════════
const CallsTab = ({ showToast, userId }) => {
  const [calls, setCalls]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [view, setView]       = useState('list');
  const [detailCall, setDetailCall] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchBy,    setSearchBy]    = useState('phone');
  const [victimResult, setVictimResult] = useState(null);
  const [searchingV,   setSearchingV]   = useState(false);
  const [searchErr,    setSearchErr]    = useState('');

  const [callNote,     setCallNote]     = useState('');
  const [callLocation, setCallLocation] = useState('');
  const [callType,     setCallType]     = useState('Emergency');
  const [loggingCall,  setLoggingCall]  = useState(false);
  const [callErr,      setCallErr]      = useState('');

  const [editingCallId, setEditingCallId] = useState(null);
  const [editNote,      setEditNote]      = useState('');
  const [editType,      setEditType]      = useState('');
  const [savingEdit,    setSavingEdit]    = useState(false);
  const [editErr,       setEditErr]       = useState('');

  const [filterStatus, setFilterStatus] = useState('');
  const [searchCall,   setSearchCall]   = useState('');

  const loadCalls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/dispatcher/calls');
      setCalls(res.data);
    } catch (e) { setErr(e.response?.data?.error || 'Failed to load calls'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCalls(); }, [loadCalls]);

  const filteredCalls = calls.filter(c => {
    if (filterStatus && c.call_status !== filterStatus) return false;
    if (searchCall.trim()) {
      const q = searchCall.trim().toLowerCase();
      if (!c.Request_id?.toLowerCase().includes(q) &&
          !c.victim_name?.toLowerCase().includes(q) &&
          !c.victim_phone?.includes(q) &&
          !c.Victim_id?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const searchVictim = async () => {
    if (!searchQuery.trim()) return setSearchErr('Enter a search value');
    if (searchBy === 'phone' && !/^\d{10,11}$/.test(searchQuery.trim()))
      return setSearchErr('Phone must be 10 or 11 digits');
    if (searchBy === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchQuery.trim()))
      return setSearchErr('Enter a valid email address');
    setSearchingV(true); setSearchErr(''); setVictimResult(null);
    try {
      const param = searchBy === 'phone'   ? `phone=${searchQuery.trim()}`
                  : searchBy === 'user_id' ? `user_id=${searchQuery.trim()}`
                  :                          `email=${searchQuery.trim()}`;
      const res = await API.get(`/dispatcher/victim/search?${param}`);
      setVictimResult(res.data);
    } catch (e) { setSearchErr(e.response?.data?.error || 'Search failed'); }
    finally { setSearchingV(false); }
  };

  const logCall = async () => {
    setCallErr('');
    if (!victimResult?.user)              return setCallErr('Find a victim first');
    const u = victimResult.user;
    const isVictim = u.is_victim === 1 || u.is_victim === true || victimResult.confirmed;
    if (!isVictim) return setCallErr('This person is not registered as a victim. Ask an Admin to register them first.');
    if (!callNote.trim())                  return setCallErr('Note is required');
    if (callNote.trim().length < 5)        return setCallErr('Note must be at least 5 characters');
    if (!callLocation.trim())              return setCallErr('Location is required');
    if (callLocation.trim().length < 10)   return setCallErr('Location must be at least 10 characters (be specific)');
    setLoggingCall(true);
    try {
      const res = await API.post('/dispatcher/call-log', {
        victim_id: victimResult.user.User_id, note: callNote.trim(),
        location: callLocation.trim(), type: callType,
      });
      showToast(`Call logged — Request ID: ${res.data.request_id}`);
      setView('list'); setVictimResult(null); setSearchQuery('');
      setCallNote(''); setCallLocation(''); setCallType('Emergency');
      await loadCalls();
    } catch (e) { setCallErr(e.response?.data?.error || 'Failed to log call'); }
    finally { setLoggingCall(false); }
  };

  const loadDetail = async (id) => {
    try { const res = await API.get(`/dispatcher/calls/${id}`); setDetailCall(res.data); setView('detail'); }
    catch (e) { setErr(e.response?.data?.error || 'Failed to load call'); }
  };

  const saveEdit = async () => {
    setEditErr('');
    if (!editNote.trim() && !editType) return setEditErr('Nothing to update');
    setSavingEdit(true);
    try {
      await API.put(`/dispatcher/calls/${editingCallId}`, {
        ...(editNote.trim() ? { note: editNote.trim() } : {}),
        ...(editType        ? { type: editType }         : {}),
      });
      showToast('Call updated'); setEditingCallId(null); await loadCalls();
    } catch (e) { setEditErr(e.response?.data?.error || 'Update failed'); }
    finally { setSavingEdit(false); }
  };

  const clearFilters = () => { setSearchCall(''); setFilterStatus(''); };
  const hasFilters   = searchCall || filterStatus;

  if (loading) return <Spinner />;

  if (view === 'detail' && detailCall) return (
    <div>
      <button onClick={() => setView('list')} style={D.backBtn}>← Back to Calls</button>
      <div style={D.detailCard}>
        <SectionTitle>Call Details</SectionTitle>
        <Field label="Request ID"  value={detailCall.Request_id} />
        <Field label="Logged"      value={fmt(detailCall.Request_time)} />
        <Field label="Dispatcher"  value={detailCall.Dispatcher_id} />
        <Field label="Type"        value={statusBadge(detailCall.call_type)} />
        <Field label="Note"        value={detailCall.call_note} />
        <Field label="Location"    value={detailCall.call_location} />
        <div style={D.divider} />
        <SectionTitle>Victim</SectionTitle>
        <Field label="Name"    value={detailCall.victim_name} />
        <Field label="Phone"   value={detailCall.victim_phone} />
        <Field label="CNIC"    value={detailCall.victim_cnic} />
        <Field label="Address" value={detailCall.victim_address} />
        <Field label="Emergency Contact" value={detailCall.Emergency_contact} />
        <div style={D.divider} />
        <SectionTitle>Incident</SectionTitle>
        {detailCall.Incident_id ? (
          <>
            <Field label="Incident ID" value={detailCall.Incident_id} />
            <Field label="Type"        value={detailCall.Emergency_type} />
            <Field label="Severity"    value={statusBadge(detailCall.Severity)} />
            <Field label="Status"      value={statusBadge(detailCall.incident_status)} />
            <Field label="Verified"    value={statusBadge(detailCall.Verification_status)} />
          </>
        ) : <p style={D.pendingNote}>⏳ No incident created yet for this call.</p>}
      </div>
    </div>
  );

  if (view === 'new') return (
    <div>
      <button onClick={() => {
        setView('list'); setVictimResult(null); setSearchErr('');
        setSearchQuery(''); setCallNote(''); setCallLocation(''); setCallErr('');
      }} style={D.backBtn}>← Back</button>

      <div style={D.formCard}>
        <SectionTitle>Step 1 — Find Victim</SectionTitle>
        <p style={{ fontSize:'12px', color:'#888', margin:'0 0 10px' }}>
          Search for an existing registered victim.
        </p>
        <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
          <select value={searchBy} onChange={e => { setSearchBy(e.target.value); setSearchQuery(''); setVictimResult(null); setSearchErr(''); }}
            style={{ ...D.select, width:'140px', flex:'none' }}>
            <option value="phone">Phone</option>
            <option value="user_id">User ID</option>
            <option value="email">Email</option>
          </select>
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setVictimResult(null); setSearchErr(''); }}
            onKeyDown={e => e.key === 'Enter' && searchVictim()}
            placeholder={searchBy === 'phone' ? '03001234567' : searchBy === 'user_id' ? 'U019' : 'user@email.com'}
            style={{ ...D.input, flex:1 }}
          />
          <button onClick={searchVictim} disabled={searchingV} style={{ ...D.btn, flex:'none' }}>
            {searchingV ? '…' : 'Search'}
          </button>
        </div>
        <Err msg={searchErr} />

        {victimResult?.found && (() => {
          const u = victimResult.user;
          const isVictim = u.is_victim === 1 || u.is_victim === true || victimResult.confirmed;
          if (!isVictim) return (
            <div style={D.warnBox}>
              <p style={{ margin:'0 0 6px', fontWeight:'700' }}>⚠️ User found but not registered as a victim</p>
              <p style={{ margin:'0 0 8px', fontSize:'13px' }}><strong>{u.Name}</strong> — {u.Phone_no} (ID: {u.User_id})</p>
              <p style={{ margin:0, fontSize:'12px', color:'#888' }}>Please ask an Admin to register this person as a victim, then search again.</p>
            </div>
          );
          return <div style={D.successBox}>✅ Victim found: <strong>{u.Name}</strong> — {u.Phone_no} (ID: {u.User_id})</div>;
        })()}

        {victimResult && !victimResult.found && (
          <div style={D.infoBox}>
            <p style={{ margin:0, fontSize:'13px', color:'#555' }}>
              ⚠️ No user found with that {searchBy === 'phone' ? 'phone number' : searchBy === 'user_id' ? 'User ID' : 'email'}.
            </p>
          </div>
        )}

        <div style={D.divider} />
        <SectionTitle>Step 2 — Log the Call</SectionTitle>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <textarea value={callNote}     onChange={e=>setCallNote(e.target.value)}     placeholder="Describe the situation *" rows={3} style={D.textarea} />
          <input    value={callLocation} onChange={e=>setCallLocation(e.target.value)} placeholder="Location (e.g. 14 Gulberg III, Lahore) *" style={D.input} />
          <select   value={callType}     onChange={e=>setCallType(e.target.value)}     style={D.select}>
            {REQUEST_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <Err msg={callErr} />
          <button
            onClick={logCall}
            disabled={loggingCall || !victimResult?.user || !(victimResult.user.is_victim === 1 || victimResult.user.is_victim === true || victimResult.confirmed)}
            style={D.btnPrimary}
          >
            {loggingCall ? 'Logging…' : '📋 Log Call'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={D.filterBar}>
        <input value={searchCall} onChange={e=>setSearchCall(e.target.value)} placeholder="Search by Request ID, victim name, phone, or victim ID" style={{ ...D.input, flex:1 }} />
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...D.select, width:'160px', flex:'none' }}>
          <option value="">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="Processed">Processed</option>
        </select>
        {hasFilters && <button onClick={clearFilters} style={D.clearBtn}>✕ Clear</button>}
      </div>

      <div style={D.listHeader}>
        <p style={D.listCount}>Showing {filteredCalls.length} of {calls.length} call{calls.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setView('new')} style={D.btnPrimary}>+ Log New Call</button>
      </div>
      <Err msg={err} />
      {filteredCalls.length === 0
        ? <Empty icon="📋" text={calls.length === 0 ? 'No calls yet.' : 'No calls match filters.'} />
        : filteredCalls.map(c => (
          <div key={c.Request_id} style={D.listRow}>
            <div style={D.listRowLeft}>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                <span style={D.listId}>{c.Request_id}</span>
                {statusBadge(c.Type)} {statusBadge(c.call_status)}
              </div>
              <p style={D.listSub}>{c.victim_name} · {c.victim_phone} · {c.Victim_id} · Logged: {fmt(c.Request_time)}</p>
              <p style={D.listNote}>{c.Note}</p>
            </div>
            <div style={D.listRowActions}>
              <button onClick={() => loadDetail(c.Request_id)} style={D.smallBtn}>View</button>
              {editingCallId === c.Request_id ? (
                <div style={{ display:'flex', flexDirection:'column', gap:'6px', minWidth:'200px' }}>
                  <textarea value={editNote} onChange={e=>setEditNote(e.target.value)} placeholder="New note" rows={2} style={D.textarea} />
                  <select value={editType} onChange={e=>setEditType(e.target.value)} style={D.select}>
                    <option value="">— Keep type —</option>
                    {REQUEST_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                  <Err msg={editErr} />
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={saveEdit} disabled={savingEdit} style={D.btn}>{savingEdit?'…':'Save'}</button>
                    <button onClick={()=>setEditingCallId(null)} style={D.btnGhost}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={()=>{setEditingCallId(c.Request_id);setEditNote(c.Note||'');setEditType(c.Type||'');setEditErr('');}} style={D.smallBtn}>Edit</button>
              )}
            </div>
          </div>
        ))
      }
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// INCIDENTS TAB
// ══════════════════════════════════════════════════════════════════════════════
const IncidentsTab = ({ showToast }) => {
  const [incidents, setIncidents] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState('');
  const [view,      setView]      = useState('list');
  const [detail,    setDetail]    = useState(null);

  const [searchInc,    setSearchInc]    = useState('');
  const [filterSev,    setFilterSev]    = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [newRequestId,    setNewRequestId]    = useState('');
  const [newEType,        setNewEType]        = useState(EMERGENCY_TYPES[0]);
  const [newSeverity,     setNewSeverity]     = useState('Medium');
  const [newNote,         setNewNote]         = useState('');
  const [newVerification, setNewVerification] = useState('True');
  const [newLocation,     setNewLocation]     = useState('');
  const [creating,        setCreating]        = useState(false);
  const [createErr,       setCreateErr]       = useState('');

  const [editId,       setEditId]       = useState(null);
  const [editStatus,   setEditStatus]   = useState('');
  const [editSeverity, setEditSeverity] = useState('');
  const [editVerif,    setEditVerif]    = useState('');
  const [editNote,     setEditNote]     = useState('');
  const [saving,       setSaving]       = useState(false);
  const [saveErr,      setSaveErr]      = useState('');

  const [volunteers,   setVolunteers]   = useState([]);
  const [resources,    setResources]    = useState(null);
  const [assignedVols, setAssignedVols] = useState([]);
  const [selVols,      setSelVols]      = useState([]);
  const [selPolice,    setSelPolice]    = useState('');
  const [selAmb,       setSelAmb]       = useState('');
  const [assigning,    setAssigning]    = useState(false);
  const [assignErr,    setAssignErr]    = useState('');
  const [removingVolId,setRemovingVolId]= useState(null);
  const [removeErr,    setRemoveErr]    = useState('');
  // CHANGE: tracks whether the dispatcher clicked Completed once (shows inline confirm)
  const [confirmComplete, setConfirmComplete] = useState(false);

  const [calls, setCalls] = useState([]);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const [iRes, cRes] = await Promise.all([
        API.get('/dispatcher/incidents'),
        API.get('/dispatcher/calls'),
      ]);
      setIncidents(iRes.data);
      setCalls(cRes.data.filter(c => c.call_status === 'Pending'));
    } catch (e) { setErr(e.response?.data?.error || 'Failed to load incidents'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadIncidents(); }, [loadIncidents]);

  const filteredIncidents = incidents.filter(i => {
    if (filterSev    && i.Severity        !== filterSev)    return false;
    if (filterStatus && i.incident_status !== filterStatus) return false;
    if (searchInc.trim() &&
        !i.Incident_id?.toLowerCase().includes(searchInc.toLowerCase()) &&
        !i.victim_name?.toLowerCase().includes(searchInc.toLowerCase()))
      return false;
    return true;
  });

  const loadDetail = async (id) => {
    try {
      const [detRes, volRes, resRes] = await Promise.all([
        API.get(`/dispatcher/incidents/${id}`),
        API.get('/dispatcher/volunteers/available'),
        API.get('/dispatcher/resources/available'),
      ]);
      setDetail(detRes.data);
      setVolunteers(volRes.data);
      setResources(resRes.data);
      setView('detail');
      try {
        const avRes = await API.get(`/dispatcher/incident/${id}/volunteers`);
        setAssignedVols(avRes.data);
      } catch { setAssignedVols([]); }
    } catch (e) { setErr(e.response?.data?.error || 'Failed to load incident'); }
  };

  const createIncident = async () => {
    setCreateErr('');
    if (!newRequestId) return setCreateErr('Please select a request');
    setCreating(true);
    try {
      const res = await API.post('/dispatcher/incident', {
        request_id: newRequestId, emergency_type: newEType, severity: newSeverity,
        note: newNote.trim() || undefined, verification_status: newVerification,
        location: newLocation.trim() || undefined,
      });
      showToast(`Incident created — ID: ${res.data.incident_id}`);
      setView('list'); setNewRequestId(''); setNewNote(''); setNewLocation('');
      await loadIncidents();
    } catch (e) { setCreateErr(e.response?.data?.error || 'Failed to create incident'); }
    finally { setCreating(false); }
  };

  const saveEdit = async () => {
    setSaving(true); setSaveErr('');
    try {
      await API.put(`/dispatcher/incident/${editId}`, {
        ...(editStatus   ? { status: editStatus }             : {}),
        ...(editSeverity ? { severity: editSeverity }         : {}),
        ...(editVerif    ? { verification_status: editVerif } : {}),
        ...(editNote     ? { note: editNote }                 : {}),
      });
      showToast('Incident updated'); setEditId(null);
      if (view === 'detail') await loadDetail(editId);
      else await loadIncidents();
    } catch (e) { setSaveErr(e.response?.data?.error || 'Update failed'); }
    finally { setSaving(false); }
  };

  const createAssignment = async () => {
    if (!detail) return;
    setAssigning(true); setAssignErr('');
    try {
      const res = await API.post('/dispatcher/assignment', {
        incident_id: detail.Incident_id,
        police_id: selPolice || undefined, ambulance_id: selAmb || undefined,
        volunteer_ids: selVols.length ? selVols : undefined,
      });
      showToast(`Assignment created — ID: ${res.data.assignment_id}`);
      setSelVols([]); setSelPolice(''); setSelAmb('');
      await loadDetail(detail.Incident_id);
    } catch (e) { setAssignErr(e.response?.data?.error || 'Assignment failed'); }
    finally { setAssigning(false); }
  };

  const assignMoreVolunteers = async () => {
    if (!selVols.length) return setAssignErr('Select at least one volunteer');
    setAssigning(true); setAssignErr('');
    try {
      await API.post(`/dispatcher/incident/${detail.Incident_id}/assign-volunteers`, { volunteer_ids: selVols });
      showToast('Volunteers assigned'); setSelVols([]);
      await loadDetail(detail.Incident_id);
    } catch (e) { setAssignErr(e.response?.data?.error || 'Assign failed'); }
    finally { setAssigning(false); }
  };

  const removeVolunteer = async (volAssignmentId) => {
    setRemovingVolId(volAssignmentId); setRemoveErr('');
    try {
      await API.delete(`/dispatcher/volunteer-assignment/${volAssignmentId}`);
      showToast('Volunteer removed'); await loadDetail(detail.Incident_id);
    } catch (e) { setRemoveErr(e.response?.data?.error || 'Remove failed'); }
    finally { setRemovingVolId(null); }
  };

  if (loading) return <Spinner />;

  if (view === 'detail' && detail) {
    const isCompleted = detail.incident_status === 'Completed' || detail.assignment_status === 'Completed';
    return (
      <div>
        <button onClick={() => { setView('list'); setDetail(null); setConfirmComplete(false); }} style={D.backBtn}>← Back</button>
        <div style={D.detailCard}>
          <SectionTitle>Incident</SectionTitle>
          <Field label="ID"       value={detail.Incident_id} />
          <Field label="Type"     value={detail.Emergency_type} />
          <Field label="Severity" value={statusBadge(detail.Severity)} />
          <Field label="Status"   value={statusBadge(detail.incident_status)} />
          <Field label="Verified" value={statusBadge(detail.Verification_status)} />
          <Field label="Location" value={detail.incident_location} />
          <Field label="Note"     value={detail.incident_note} />
          <Field label="Time"     value={fmt(detail.incident_time)} />
          <div style={D.divider} />
          <SectionTitle>Victim</SectionTitle>
          <Field label="Name"  value={detail.victim_name} />
          <Field label="Phone" value={detail.victim_phone} />

          <div style={D.divider} />
          <SectionTitle>Update Incident</SectionTitle>
          {isCompleted ? (
            <div style={D.infoBox}><p style={{ margin:0, fontSize:'13px', color:'#555' }}>🔒 This incident is <strong>Completed</strong> — no further edits are allowed.</p></div>
          ) : editId === detail.Incident_id ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <select value={editStatus}   onChange={e=>setEditStatus(e.target.value)}   style={D.select}><option value="">— Status —</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
              <select value={editSeverity} onChange={e=>setEditSeverity(e.target.value)} style={D.select}><option value="">— Severity —</option>{SEVERITIES.map(s=><option key={s}>{s}</option>)}</select>
              <select value={editVerif}    onChange={e=>setEditVerif(e.target.value)}    style={D.select}><option value="">— Verification —</option><option>True</option><option>False</option></select>
              <textarea value={editNote} onChange={e=>setEditNote(e.target.value)} placeholder="Update note" rows={2} style={D.textarea} />
              <Err msg={saveErr} />
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={saveEdit} disabled={saving} style={D.btn}>{saving?'…':'Save'}</button>
                <button onClick={()=>setEditId(null)} style={D.btnGhost}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={()=>{setEditId(detail.Incident_id);setEditStatus('');setEditSeverity('');setEditVerif('');setEditNote('');setSaveErr('');}} style={D.btn}>Edit Incident</button>
          )}

          <div style={D.divider} />
          <SectionTitle>Assignment</SectionTitle>

          {isCompleted && detail.Assignment_id && (
            <>
              <Field label="Assignment ID" value={detail.Assignment_id} />
              <Field label="Status"        value={statusBadge(detail.assignment_status)} />
              <Field label="Completed"     value={fmt(detail.Completion_time)} />
              <Field label="Police"        value={detail.police_centre || 'Not assigned'} />
              <Field label="Ambulance"     value={detail.Ambulance_id  || 'Not assigned'} />
              <div style={D.field}>
                <span style={D.fieldLabel}>Volunteers</span>
                <div>
                  {assignedVols.length === 0
                    ? <span style={D.fieldValue}>None</span>
                    : assignedVols.map(v => (
                      <div key={v.Vol_assignment_id} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                        <span style={D.fieldValue}>{v.volunteer_name} ({v.Centre_id} · {v.centre_location})</span>
                        {v.volunteer_status && statusBadge(v.volunteer_status)}
                        <span title="Cannot modify — assignment is Completed" style={{ fontSize:'11px', color:'#ccc', cursor:'default' }}>🔒</span>
                      </div>
                    ))
                  }
                </div>
              </div>
              <div style={{ marginTop:'10px' }}>
                <div style={D.infoBox}><p style={{ margin:0, fontSize:'13px', color:'#555' }}>🔒 Assignment is <strong>Completed</strong> — status changes and volunteer assignments are disabled.</p></div>
              </div>
            </>
          )}

          {!isCompleted && detail.Assignment_id && (
            <>
              <Field label="Assignment ID" value={detail.Assignment_id} />
              <Field label="Status"        value={statusBadge(detail.assignment_status)} />
              <Field label="Police"        value={detail.police_centre || 'Not assigned'} />
              <Field label="Ambulance"     value={detail.Ambulance_id  || 'Not assigned'} />
              <div style={D.field}>
                <span style={D.fieldLabel}>Volunteers</span>
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  {assignedVols.length === 0
                    ? <span style={D.fieldValue}>None</span>
                    : assignedVols.map(v => (
                      <div key={v.Vol_assignment_id} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={D.fieldValue}>{v.volunteer_name} ({v.Centre_id} · {v.centre_location})</span>
                        {v.volunteer_status && statusBadge(v.volunteer_status)}
                        {detail.assignment_status === 'Pending' ? (
                          <button onClick={() => removeVolunteer(v.Vol_assignment_id)} disabled={removingVolId === v.Vol_assignment_id}
                            style={{ padding:'2px 8px', borderRadius:'6px', border:'1.5px solid #fecaca', backgroundColor:'#fff5f5', color:'#c0392b', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>
                            {removingVolId === v.Vol_assignment_id ? '…' : 'Remove'}
                          </button>
                        ) : (
                          <span title={`Cannot remove — assignment is ${detail.assignment_status}`} style={{ fontSize:'11px', color:'#ccc', cursor:'default', userSelect:'none' }}>🔒</span>
                        )}
                      </div>
                    ))
                  }
                  {removeErr && <span style={{ fontSize:'12px', color:'#c0392b' }}>⚠️ {removeErr}</span>}
                </div>
              </div>

              {/* CHANGE: Completed button shows inline "Are you sure?" before firing.
                   Ongoing and Pending fire immediately as before. */}
              <div style={{ marginTop:'12px', display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
                {STATUSES.filter(s => s !== 'Completed').map(s => (
                  <button key={s} onClick={async () => {
                    setConfirmComplete(false);
                    try { await API.put(`/dispatcher/assignment/${detail.Assignment_id}`, { status: s }); showToast(`Assignment → ${s}`); await loadDetail(detail.Incident_id); }
                    catch (e) { setAssignErr(e.response?.data?.error || 'Update failed'); }
                  }} style={{ ...D.smallBtn, opacity: detail.assignment_status === s ? 0.4 : 1 }}>{s}</button>
                ))}

                {!confirmComplete ? (
                  <button
                    onClick={() => setConfirmComplete(true)}
                    style={{ ...D.smallBtn, opacity: detail.assignment_status === 'Completed' ? 0.4 : 1 }}
                  >
                    Completed
                  </button>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 10px', borderRadius:'8px', backgroundColor:'#fff5f5', border:'1.5px solid #fecaca' }}>
                    <span style={{ fontSize:'12px', color:'#c0392b', fontWeight:'600' }}>Mark as complete?</span>
                    <button
                      onClick={async () => {
                        setConfirmComplete(false);
                        try { await API.put(`/dispatcher/assignment/${detail.Assignment_id}`, { status: 'Completed' }); showToast('Assignment → Completed'); await loadDetail(detail.Incident_id); }
                        catch (e) { setAssignErr(e.response?.data?.error || 'Update failed'); }
                      }}
                      style={{ padding:'3px 10px', borderRadius:'6px', border:'none', backgroundColor:'#c0392b', color:'#fff', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}
                    >
                      Yes, complete
                    </button>
                    <button
                      onClick={() => setConfirmComplete(false)}
                      style={{ padding:'3px 10px', borderRadius:'6px', border:'1.5px solid #ddd', backgroundColor:'#fff', color:'#888', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {volunteers.length > 0 && (
                <>
                  <div style={D.divider} />
                  <SectionTitle>Assign More Volunteers</SectionTitle>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'10px' }}>
                    {volunteers.map(v => (
                      <label key={v.User_id} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 10px', borderRadius:'20px', cursor:'pointer', backgroundColor: selVols.includes(v.User_id) ? '#e8f5e9' : '#f5f5f5', border:`1.5px solid ${selVols.includes(v.User_id) ? '#27ae60' : '#ddd'}`, fontSize:'12px', fontWeight:'600' }}>
                        <input type="checkbox" checked={selVols.includes(v.User_id)} onChange={e => setSelVols(prev => e.target.checked ? [...prev, v.User_id] : prev.filter(x=>x!==v.User_id))} style={{ display:'none' }} />
                        {v.Name} <span style={{ fontWeight:'400', color:'#888' }}>({v.Centre_id})</span>
                      </label>
                    ))}
                  </div>
                  <Err msg={assignErr} />
                  <button onClick={assignMoreVolunteers} disabled={assigning || !selVols.length} style={D.btn}>{assigning?'…':'Assign Selected'}</button>
                </>
              )}
              {volunteers.length === 0 && assignedVols.length === 0 && (
                <p style={D.pendingNote}>No volunteers available.</p>
              )}
            </>
          )}

          {!isCompleted && !detail.Assignment_id && (
            <>
              <p style={D.pendingNote}>No assignment yet. Create one below.</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginTop:'12px' }}>
                <select value={selPolice} onChange={e=>setSelPolice(e.target.value)} style={D.select}>
                  <option value="">— Select Police Centre (optional) —</option>
                  {resources?.police?.map(p => <option key={p.Centre_id} value={p.Centre_id}>{p.Centre_id} — {p.Location}</option>)}
                </select>
                <select value={selAmb} onChange={e=>setSelAmb(e.target.value)} style={D.select}>
                  <option value="">— Select Ambulance (optional) —</option>
                  {resources?.ambulance?.map(a => <option key={a.Ambulance_id} value={a.Ambulance_id}>{a.Ambulance_id} — {a.Relevant_hospital}</option>)}
                </select>
                <p style={{ fontSize:'12px', color:'#888', margin:'4px 0' }}>Available volunteers (all centres):</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                  {volunteers.map(v => (
                    <label key={v.User_id} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 10px', borderRadius:'20px', cursor:'pointer', backgroundColor: selVols.includes(v.User_id) ? '#e8f5e9' : '#f5f5f5', border:`1.5px solid ${selVols.includes(v.User_id) ? '#27ae60' : '#ddd'}`, fontSize:'12px', fontWeight:'600' }}>
                      <input type="checkbox" checked={selVols.includes(v.User_id)} onChange={e => setSelVols(prev => e.target.checked ? [...prev, v.User_id] : prev.filter(x=>x!==v.User_id))} style={{ display:'none' }} />
                      {v.Name} <span style={{ fontWeight:'400', color:'#888' }}>({v.Centre_id})</span>
                    </label>
                  ))}
                  {volunteers.length === 0 && <p style={D.pendingNote}>No volunteers available.</p>}
                </div>
                <Err msg={assignErr} />
                <button onClick={createAssignment} disabled={assigning} style={D.btnPrimary}>{assigning?'Creating…':'🚔 Create Assignment'}</button>
              </div>
            </>
          )}

          {isCompleted && !detail.Assignment_id && (
            <p style={D.pendingNote}>This completed incident has no assignment record.</p>
          )}
        </div>
      </div>
    );
  }

  if (view === 'new') return (
    <div>
      <button onClick={() => setView('list')} style={D.backBtn}>← Back</button>
      <div style={D.formCard}>
        <SectionTitle>Create Incident</SectionTitle>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <select value={newRequestId} onChange={e=>setNewRequestId(e.target.value)} style={D.select}>
            <option value="">— Select Request (from unprocessed calls) * —</option>
            {calls.map(c => <option key={c.Request_id} value={c.Request_id}>{c.Request_id} — {c.victim_name} ({c.Type})</option>)}
          </select>
          {calls.length === 0 && <p style={D.pendingNote}>No unprocessed calls. Log a call first from the Calls tab.</p>}
          <select value={newEType}        onChange={e=>setNewEType(e.target.value)}        style={D.select}>{EMERGENCY_TYPES.map(t=><option key={t}>{t}</option>)}</select>
          <select value={newSeverity}     onChange={e=>setNewSeverity(e.target.value)}     style={D.select}>{SEVERITIES.map(s=><option key={s}>{s}</option>)}</select>
          <select value={newVerification} onChange={e=>setNewVerification(e.target.value)} style={D.select}><option value="True">Verified (True)</option><option value="False">False Report (False)</option></select>
          <input    value={newLocation} onChange={e=>setNewLocation(e.target.value)} placeholder="Location (leave blank to use request location)" style={D.input} />
          <textarea value={newNote}     onChange={e=>setNewNote(e.target.value)}     placeholder="Incident note (leave blank to use call note)" rows={3} style={D.textarea} />
          <Err msg={createErr} />
          <button onClick={createIncident} disabled={creating} style={D.btnPrimary}>{creating?'Creating…':'🚨 Create Incident'}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={D.filterBar}>
        <input value={searchInc} onChange={e=>setSearchInc(e.target.value)} placeholder="Search by Incident ID or victim name" style={{ ...D.input, flex:1 }} />
        <select value={filterSev}    onChange={e=>setFilterSev(e.target.value)}    style={{ ...D.select, width:'130px', flex:'none' }}><option value="">All severities</option>{SEVERITIES.map(s=><option key={s}>{s}</option>)}</select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...D.select, width:'130px', flex:'none' }}><option value="">All statuses</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
        {(searchInc||filterSev||filterStatus) && <button onClick={()=>{setSearchInc('');setFilterSev('');setFilterStatus('');}} style={D.clearBtn}>✕ Clear</button>}
      </div>
      <div style={D.listHeader}>
        <p style={D.listCount}>Showing {filteredIncidents.length} of {incidents.length} incident{incidents.length!==1?'s':''}</p>
        <button onClick={() => setView('new')} style={D.btnPrimary}>+ Create Incident</button>
      </div>
      <Err msg={err} />
      {filteredIncidents.length === 0
        ? <Empty icon="🚨" text={incidents.length===0?'No incidents yet.':'No incidents match filters.'} />
        : filteredIncidents.map(i => (
          <div key={i.Incident_id} style={D.listRow}>
            <div style={D.listRowLeft}>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                <span style={D.listId}>{i.Incident_id}</span>
                {statusBadge(i.Severity)} {statusBadge(i.incident_status)}
                <span style={{ fontSize:'12px', color:'#aaa' }}>{i.Emergency_type}</span>
              </div>
              <p style={D.listSub}>{i.victim_name} · {fmt(i.incident_time)}</p>
              <p style={D.listNote}>{i.incident_note}</p>
            </div>
            <button onClick={() => loadDetail(i.Incident_id)} style={D.smallBtn}>Manage</button>
          </div>
        ))
      }
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// CASES TAB
// ══════════════════════════════════════════════════════════════════════════════
const CasesTab = ({ showToast }) => {
  const [lawCases,    setLawCases]    = useState([]);
  const [followups,   setFollowups]   = useState([]);
  const [incidents,   setIncidents]   = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [referredCentres, setReferredCentres] = useState([]);
  const [lawFirms,    setLawFirms]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState('');
  const [subTab,      setSubTab]      = useState('law');
  const [managingLaw, setManagingLaw] = useState(null);
  const [managingFup, setManagingFup] = useState(null);

  const [editingLawId,  setEditingLawId]  = useState(null);
  const [editLawFirm,   setEditLawFirm]   = useState('');
  const [editLawType,   setEditLawType]   = useState('');
  const [savingLaw,     setSavingLaw]     = useState(false);
  const [lawEditErr,    setLawEditErr]    = useState('');

  const [editingFupId,  setEditingFupId]  = useState(null);
  const [editFupCentre, setEditFupCentre] = useState('');
  const [editFupType,   setEditFupType]   = useState('');
  const [savingFup,     setSavingFup]     = useState(false);
  const [fupEditErr,    setFupEditErr]    = useState('');

  const [showLawForm,   setShowLawForm]   = useState(false);
  const [lawIncident,   setLawIncident]   = useState('');
  const [lawFirmSel,    setLawFirmSel]    = useState('');
  const [lawFirmCustom, setLawFirmCustom] = useState('');
  const [lawCaseType,   setLawCaseType]   = useState('Support');
  const [creatingLaw,   setCreatingLaw]   = useState(false);
  const [lawErr,        setLawErr]        = useState('');

  const [showFupForm,    setShowFupForm]    = useState(false);
  const [fupAssign,      setFupAssign]      = useState('');
  const [fupCentreSel,   setFupCentreSel]   = useState('');
  const [fupCentreCustom,setFupCentreCustom]= useState('');
  const [fupCaseType,    setFupCaseType]    = useState('Support');
  const [creatingFup,    setCreatingFup]    = useState(false);
  const [fupErr,         setFupErr]         = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [lRes, fRes, iRes, rcRes, lfRes] = await Promise.all([
        API.get('/dispatcher/lawcases'),
        API.get('/dispatcher/followups'),
        API.get('/dispatcher/incidents'),
        API.get('/dispatcher/referred-centres'),
        API.get('/dispatcher/lawfirms'),
      ]);
      setLawCases(lRes.data || []);
      setFollowups(fRes.data || []);
      setIncidents(iRes.data || []);
      setReferredCentres(Array.isArray(rcRes.data) ? rcRes.data : []);
      setLawFirms(Array.isArray(lfRes.data) ? lfRes.data : []);
      setAssignments((iRes.data || []).filter(i => i.Assignment_id).map(i => ({
        Assignment_id: i.Assignment_id,
        label: `${i.Assignment_id} — ${i.victim_name} (${i.Emergency_type})`,
      })));
    } catch (e) { setErr(e.response?.data?.error || 'Failed to load cases.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const createLawCase = async () => {
    setLawErr('');
    if (!lawIncident) return setLawErr('Please select an incident');
    if (lawFirmSel === 'other' && !lawFirmCustom.trim()) return setLawErr('Please enter a law firm name');
    const resolvedFirm = lawFirmSel === 'other' ? lawFirmCustom.trim() : lawFirmSel || undefined;
    setCreatingLaw(true);
    try {
      const res = await API.post('/dispatcher/lawcase', { incident_id: lawIncident, lawfirm_name: resolvedFirm, case_type: lawCaseType });
      showToast(`Law case created — ID: ${res.data.law_case_id}`);
      setShowLawForm(false); setLawIncident(''); setLawFirmSel(''); setLawFirmCustom('');
      await loadAll();
    } catch (e) { setLawErr(e.response?.data?.error || 'Failed to create law case'); }
    finally { setCreatingLaw(false); }
  };

  const createFollowup = async () => {
    setFupErr('');
    if (!fupAssign) return setFupErr('Please select an assignment');
    if (fupCentreSel === 'other' && !fupCentreCustom.trim()) return setFupErr('Please enter a centre name');
    const resolvedCentre = fupCentreSel === 'other' ? fupCentreCustom.trim() : fupCentreSel || '';
    setCreatingFup(true);
    try {
      const res = await API.post('/dispatcher/followup', { assignment_id: fupAssign, referred_centre: resolvedCentre, case_type: fupCaseType });
      showToast(`Follow-up created — ID: ${res.data.follow_up_id}`);
      setShowFupForm(false); setFupAssign(''); setFupCentreSel(''); setFupCentreCustom('');
      await loadAll();
    } catch (e) { setFupErr(e.response?.data?.error || 'Failed to create follow-up'); }
    finally { setCreatingFup(false); }
  };

  const saveLawEdit = async () => {
    setLawEditErr('');
    if (!editLawFirm.trim() && !editLawType) return setLawEditErr('Enter a new firm name or select a case type');
    setSavingLaw(true);
    try {
      await API.put(`/dispatcher/lawcase/${editingLawId}`, {
        ...(editLawFirm.trim() ? { lawfirm_name: editLawFirm.trim() } : {}),
        ...(editLawType        ? { case_type: editLawType }            : {}),
      });
      showToast('Law case updated');
      setEditingLawId(null);
      setManagingLaw(prev => prev ? { ...prev, Lawfirm_name: editLawFirm.trim() || prev.Lawfirm_name, Case_type: editLawType || prev.Case_type } : null);
      await loadAll();
    } catch (e) { setLawEditErr(e.response?.data?.error || 'Update failed'); }
    finally { setSavingLaw(false); }
  };

  const saveFupEdit = async () => {
    setFupEditErr('');
    if (!editFupCentre.trim() && !editFupType) return setFupEditErr('Enter a new centre name or select a case type');
    setSavingFup(true);
    try {
      await API.put(`/dispatcher/followup/${editingFupId}`, {
        ...(editFupCentre.trim() ? { referred_centre: editFupCentre.trim() } : {}),
        ...(editFupType          ? { case_type: editFupType }                : {}),
      });
      showToast('Follow-up updated');
      setEditingFupId(null);
      setManagingFup(prev => prev ? { ...prev, Referred_centre: editFupCentre.trim() || prev.Referred_centre, Case_type: editFupType || prev.Case_type } : null);
      await loadAll();
    } catch (e) { setFupEditErr(e.response?.data?.error || 'Update failed'); }
    finally { setSavingFup(false); }
  };

  if (loading) return <Spinner />;
  if (err) return (
    <div style={{ padding:'20px 0' }}>
      <Err msg={err} />
      <button onClick={loadAll} style={{ ...D.btn, marginTop:'12px' }}>↻ Retry</button>
    </div>
  );

  if (managingLaw) return (
    <div>
      <button onClick={() => { setManagingLaw(null); setEditingLawId(null); setLawEditErr(''); }} style={D.backBtn}>← Back</button>
      <div style={D.detailCard}>
        <SectionTitle>Law Case</SectionTitle>
        <Field label="Case ID"   value={managingLaw.Law_case_id} />
        <Field label="Law Firm"  value={managingLaw.Lawfirm_name} />
        <Field label="Type"      value={statusBadge(managingLaw.Case_type)} />
        <Field label="Incident"  value={managingLaw.Incident_id} />
        <Field label="Emergency" value={managingLaw.Emergency_type} />
        <Field label="Severity"  value={statusBadge(managingLaw.Severity)} />
        <Field label="Victim"    value={managingLaw.victim_name} />
        <div style={D.divider} />
        <SectionTitle>Edit Law Case</SectionTitle>
        {editingLawId === managingLaw.Law_case_id ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            <input value={editLawFirm} onChange={e=>setEditLawFirm(e.target.value)} placeholder="New law firm name (optional)" style={D.input} />
            <select value={editLawType} onChange={e=>setEditLawType(e.target.value)} style={D.select}>
              <option value="">— Case type (optional) —</option>
              {CASE_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
            <Err msg={lawEditErr} />
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={saveLawEdit} disabled={savingLaw} style={D.btn}>{savingLaw?'…':'Save'}</button>
              <button onClick={()=>{setEditingLawId(null);setLawEditErr('');}} style={D.btnGhost}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={()=>{setEditingLawId(managingLaw.Law_case_id);setEditLawFirm(managingLaw.Lawfirm_name||'');setEditLawType('');setLawEditErr('');}} style={D.btn}>Edit</button>
        )}
      </div>
    </div>
  );

  if (managingFup) return (
    <div>
      <button onClick={() => { setManagingFup(null); setEditingFupId(null); setFupEditErr(''); }} style={D.backBtn}>← Back</button>
      <div style={D.detailCard}>
        <SectionTitle>Follow-up Support</SectionTitle>
        <Field label="Follow-up ID"    value={managingFup.follow_up_id} />
        <Field label="Referred Centre" value={managingFup.Referred_centre} />
        <Field label="Type"            value={statusBadge(managingFup.Case_type)} />
        <Field label="Assignment"      value={managingFup.Assignment_id} />
        <Field label="Emergency"       value={managingFup.Emergency_type} />
        <Field label="Victim"          value={managingFup.victim_name} />
        <div style={D.divider} />
        <SectionTitle>Edit Follow-up</SectionTitle>
        {editingFupId === managingFup.follow_up_id ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            <input value={editFupCentre} onChange={e=>setEditFupCentre(e.target.value)} placeholder="New referred centre (optional)" style={D.input} />
            <select value={editFupType} onChange={e=>setEditFupType(e.target.value)} style={D.select}>
              <option value="">— Case type (optional) —</option>
              {CASE_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
            <Err msg={fupEditErr} />
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={saveFupEdit} disabled={savingFup} style={D.btn}>{savingFup?'…':'Save'}</button>
              <button onClick={()=>{setEditingFupId(null);setFupEditErr('');}} style={D.btnGhost}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={()=>{setEditingFupId(managingFup.follow_up_id);setEditFupCentre(managingFup.Referred_centre||'');setEditFupType('');setFupEditErr('');}} style={D.btn}>Edit</button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display:'flex', gap:'4px', marginBottom:'20px', borderBottom:'2px solid #eee' }}>
        {[['law',`⚖️ Law Cases (${lawCases.length})`],['followup',`🏥 Follow-ups (${followups.length})`]].map(([k,l]) => (
          <button key={k} onClick={() => setSubTab(k)} style={{ ...D.tab, ...(subTab===k ? D.tabActive : {}) }}>{l}</button>
        ))}
      </div>

      {subTab === 'law' && (
        <>
          <div style={D.listHeader}>
            <p style={D.listCount}>{lawCases.length} law case{lawCases.length!==1?'s':''}</p>
            <button onClick={() => { setShowLawForm(!showLawForm); setLawErr(''); }} style={D.btnPrimary}>+ New Law Case</button>
          </div>
          {showLawForm && (
            <div style={D.formCard}>
              <SectionTitle>Create Law Case</SectionTitle>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                <select value={lawIncident} onChange={e=>setLawIncident(e.target.value)} style={D.select}>
                  <option value="">— Select Incident * —</option>
                  {incidents.filter(i => !lawCases.find(lc => lc.Incident_id === i.Incident_id)).map(i => (
                    <option key={i.Incident_id} value={i.Incident_id}>{i.Incident_id} — {i.victim_name} ({i.Emergency_type}, {i.Severity})</option>
                  ))}
                </select>
                <select value={lawFirmSel} onChange={e => { setLawFirmSel(e.target.value); setLawFirmCustom(''); }} style={D.select}>
                  <option value="">— Law firm (blank = Legal Aid Dept) —</option>
                  {lawFirms.map(f => <option key={f} value={f}>{f}</option>)}
                  <option value="other">Other (enter below)</option>
                </select>
                {lawFirmSel === 'other' && <input value={lawFirmCustom} onChange={e=>setLawFirmCustom(e.target.value)} placeholder="Enter law firm name" style={D.input} />}
                <select value={lawCaseType} onChange={e=>setLawCaseType(e.target.value)} style={D.select}>{CASE_TYPES.map(t=><option key={t}>{t}</option>)}</select>
                <Err msg={lawErr} />
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={createLawCase} disabled={creatingLaw} style={D.btn}>{creatingLaw?'Creating…':'Create'}</button>
                  <button onClick={()=>{setShowLawForm(false);setLawErr('');}} style={D.btnGhost}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          {lawCases.length === 0 ? <Empty icon="⚖️" text="No law cases yet." />
            : lawCases.map(lc => (
              <div key={lc.Law_case_id} style={D.listRow}>
                <div style={D.listRowLeft}>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                    <span style={D.listId}>{lc.Law_case_id}</span>{statusBadge(lc.Case_type)}
                  </div>
                  <p style={D.listSub}>{lc.Lawfirm_name} · {lc.victim_name} · {lc.Emergency_type}</p>
                </div>
                <button onClick={() => setManagingLaw(lc)} style={D.smallBtn}>Manage</button>
              </div>
            ))
          }
        </>
      )}

      {subTab === 'followup' && (
        <>
          <div style={D.listHeader}>
            <p style={D.listCount}>{followups.length} follow-up{followups.length!==1?'s':''}</p>
            <button onClick={() => { setShowFupForm(!showFupForm); setFupErr(''); }} style={D.btnPrimary}>+ New Follow-up</button>
          </div>
          {showFupForm && (
            <div style={D.formCard}>
              <SectionTitle>Create Follow-up Support</SectionTitle>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                <select value={fupAssign} onChange={e=>setFupAssign(e.target.value)} style={D.select}>
                  <option value="">— Select Assignment * —</option>
                  {assignments.filter(a => !followups.find(f => f.Assignment_id === a.Assignment_id)).map(a => (
                    <option key={a.Assignment_id} value={a.Assignment_id}>{a.label}</option>
                  ))}
                </select>
                <select value={fupCentreSel} onChange={e => { setFupCentreSel(e.target.value); setFupCentreCustom(''); }} style={D.select}>
                  <option value="">— Referred centre (blank = auto-assign) —</option>
                  {referredCentres.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="other">Other (enter a new centre name)</option>
                </select>
                {fupCentreSel === 'other' && <input value={fupCentreCustom} onChange={e=>setFupCentreCustom(e.target.value)} placeholder="e.g. Dastak Welfare Centre, Lahore" style={D.input} />}
                <select value={fupCaseType} onChange={e=>setFupCaseType(e.target.value)} style={D.select}>{CASE_TYPES.map(t=><option key={t}>{t}</option>)}</select>
                <Err msg={fupErr} />
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={createFollowup} disabled={creatingFup} style={D.btn}>{creatingFup?'Creating…':'Create'}</button>
                  <button onClick={()=>{setShowFupForm(false);setFupErr('');}} style={D.btnGhost}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          {followups.length === 0 ? <Empty icon="🏥" text="No follow-ups yet." />
            : followups.map(f => (
              <div key={f.follow_up_id} style={D.listRow}>
                <div style={D.listRowLeft}>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                    <span style={D.listId}>{f.follow_up_id}</span>{statusBadge(f.Case_type)}
                  </div>
                  <p style={D.listSub}>{f.Referred_centre} · {f.victim_name} · {f.Emergency_type}</p>
                </div>
                <button onClick={() => setManagingFup(f)} style={D.smallBtn}>Manage</button>
              </div>
            ))
          }
        </>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// RESOURCES TAB
// ══════════════════════════════════════════════════════════════════════════════
const ResourcesTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [subTab, setSubTab] = useState('police');
  const [searchLoc, setSearchLoc] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await API.get('/dispatcher/resources'); setData(res.data); }
    catch (e) { setErr(e.response?.data?.error || 'Failed to load resources'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (err)     return <Err msg={err} />;

  const matchLoc = (str) => !searchLoc.trim() || str?.toLowerCase().includes(searchLoc.trim().toLowerCase());
  const police    = (data?.police    || []).filter(p => matchLoc(p.Location));
  const ambulance = (data?.ambulance || []).filter(a => matchLoc(a.Location) || matchLoc(a.Relevant_hospital));

  return (
    <div>
      <div style={{ display:'flex', gap:'4px', marginBottom:'12px', borderBottom:'2px solid #eee', alignItems:'flex-end', flexWrap:'wrap' }}>
        {[['police',`👮 Police (${data?.police?.length||0})`],['ambulance',`🚑 Ambulance (${data?.ambulance?.length||0})`]].map(([k,l]) => (
          <button key={k} onClick={() => setSubTab(k)} style={{ ...D.tab, ...(subTab===k ? D.tabActive : {}) }}>{l}</button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
          <input value={searchLoc} onChange={e=>setSearchLoc(e.target.value)} placeholder="Search by location…" style={{ ...D.input, width:'200px' }} />
          {searchLoc.trim() && <button onClick={()=>setSearchLoc('')} style={D.clearBtn}>✕ Clear</button>}
        </div>
      </div>
      {subTab === 'police' && (police.length === 0 ? <Empty icon="👮" text="No police centres match filter." /> : police.map(p => (
        <div key={p.Centre_id} style={D.listRow}><div style={D.listRowLeft}><div style={{ display:'flex', gap:'8px', alignItems:'center' }}><span style={D.listId}>{p.Centre_id}</span></div><p style={D.listSub}>{p.Location} · {p.Centre_number}</p></div></div>
      )))}
      {subTab === 'ambulance' && (ambulance.length === 0 ? <Empty icon="🚑" text="No ambulances match filter." /> : ambulance.map(a => (
        <div key={a.Ambulance_id} style={D.listRow}><div style={D.listRowLeft}><div style={{ display:'flex', gap:'8px', alignItems:'center' }}><span style={D.listId}>{a.Ambulance_id}</span></div><p style={D.listSub}>{a.Relevant_hospital} · {a.Location} · {a.Contact_info}</p></div></div>
      )))}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// VOLUNTEERS TAB
// ══════════════════════════════════════════════════════════════════════════════
const VolunteersTab = () => {
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [filterAvail, setFilterAvail] = useState('');
  const [filterCentre, setFilterCentre] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await API.get('/dispatcher/volunteers'); setVolunteers(res.data); }
    catch (e) { setErr(e.response?.data?.error || 'Failed to load volunteers'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = volunteers.filter(v => {
    if (filterAvail && v.Availability !== filterAvail) return false;
    if (filterCentre && v.Centre_id !== filterCentre) return false;
    if (search.trim() && !v.Name?.toLowerCase().includes(search.toLowerCase()) && !v.User_id?.toLowerCase().includes(search.toLowerCase()) && !v.Phone_no?.includes(search)) return false;
    return true;
  });

  const centres = [...new Map(volunteers.map(v => [v.Centre_id, { id: v.Centre_id, location: v.Centre_Location }])).values()];
  const hasFilters = search || filterAvail || filterCentre;

  if (loading) return <Spinner />;
  return (
    <div>
      <div style={D.filterBar}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, User ID, or phone" style={{ ...D.input, flex:1 }} />
        <select value={filterAvail} onChange={e=>setFilterAvail(e.target.value)} style={{ ...D.select, width:'160px', flex:'none' }}>
          <option value="">All availability</option>
          <option value="Yes">Available</option>
          <option value="No">Unavailable</option>
        </select>
        <select value={filterCentre} onChange={e=>setFilterCentre(e.target.value)} style={{ ...D.select, width:'180px', flex:'none' }}>
          <option value="">All centres</option>
          {centres.map(c => <option key={c.id} value={c.id}>{c.id} — {c.location}</option>)}
        </select>
        {hasFilters && <button onClick={()=>{setSearch('');setFilterAvail('');setFilterCentre('');}} style={D.clearBtn}>✕ Clear</button>}
      </div>
      <div style={D.listHeader}><p style={D.listCount}>Showing {filtered.length} of {volunteers.length} volunteer{volunteers.length!==1?'s':''}</p></div>
      <Err msg={err} />
      {filtered.length === 0 ? <Empty icon="🤝" text={volunteers.length===0?'No volunteers.':'No volunteers match filters.'} />
        : filtered.map(v => (
          <div key={v.User_id} style={D.listRow}>
            <div style={D.listRowLeft}>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                <span style={D.listId}>{v.User_id}</span>
                {statusBadge(v.Availability === 'Yes' ? 'Yes' : 'No')}
                {v.Status && statusBadge(v.Status)}
              </div>
              <p style={{ margin:'4px 0 2px', fontSize:'13px', fontWeight:'600', color:'#333' }}>{v.Name}</p>
              <p style={D.listSub}>{v.Phone_no} · {v.Email} · Centre: {v.Centre_id} ({v.Centre_Location}) · {v.total_assignments} assignment{v.total_assignments!==1?'s':''}</p>
            </div>
          </div>
        ))
      }
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// BACKUPS TAB
// ══════════════════════════════════════════════════════════════════════════════
const BackupsTab = ({ showToast }) => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await API.get('/dispatcher/backups'); setBackups(res.data); }
    catch (e) { setErr(e.response?.data?.error || 'Failed to load backups'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  return (
    <div>
      <div style={D.listHeader}>
        <p style={D.listCount}>{backups.length} active backup request{backups.length!==1?'s':''}</p>
        <button onClick={load} style={D.btn}>↻ Refresh</button>
      </div>
      <Err msg={err} />
      {backups.length === 0 ? <Empty icon="🆘" text="No active backup requests." />
        : backups.map(b => (
          <div key={b.Incident_id} style={{ ...D.listRow, flexDirection:'column', alignItems:'stretch' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={D.listRowLeft}>
                <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ ...D.listId, color:'#c0392b' }}>🆘 {b.Incident_id}</span>
                  {statusBadge(b.Severity)} {statusBadge(b.incident_status)}
                  <Badge label={`${b.backup_requests.length} backup request${b.backup_requests.length!==1?'s':''}`} color="#c0392b" bg="#fff0f0" />
                </div>
                <p style={{ margin:'4px 0 2px', fontSize:'13px', fontWeight:'600', color:'#333' }}>{b.Emergency_type} — {b.victim_name}</p>
                <p style={D.listSub}>{b.incident_location}</p>
              </div>
              <button onClick={() => setExpanded(expanded === b.Incident_id ? null : b.Incident_id)} style={D.smallBtn}>
                {expanded === b.Incident_id ? 'Hide' : 'View Requests'}
              </button>
            </div>
            {expanded === b.Incident_id && (
              <div style={{ marginTop:'12px', borderTop:'1px solid #f5f5f5', paddingTop:'12px' }}>
                <p style={D.sectionTitle}>Backup Requests</p>
                {b.backup_requests.map((br, i) => (
                  <div key={i} style={{ padding:'8px 12px', backgroundColor:'#fff5f5', borderRadius:'8px', marginBottom:'6px', border:'1px solid #fecaca' }}>
                    <p style={{ margin:'0 0 4px', fontSize:'12px', fontWeight:'700', color:'#c0392b' }}>{br.volunteer} · {br.timestamp ? new Date(br.timestamp).toLocaleString('en-PK', { hour12: true }) : 'Unknown time'}</p>
                    <p style={{ margin:0, fontSize:'13px', color:'#555' }}>{br.details}</p>
                  </div>
                ))}
                <div style={{ marginTop:'10px' }}>
                  <p style={D.sectionTitle}>Current Resources</p>
                  <Field label="👮 Police"    value={b.police_centre  || 'Not assigned'} />
                  <Field label="🚑 Ambulance" value={b.Ambulance_id   || 'Not assigned'} />
                </div>
              </div>
            )}
          </div>
        ))
      }
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const D = {
  page:        { minHeight:'100vh', backgroundColor:'#f0f5fa', fontFamily:"'Segoe UI', system-ui, sans-serif", paddingBottom:'60px' },
  toast:       { position:'fixed', top:'20px', left:'50%', transform:'translateX(-50%)', backgroundColor:'#2d6a8b', color:'#fff', padding:'10px 24px', borderRadius:'30px', fontSize:'13px', fontWeight:'600', boxShadow:'0 4px 20px rgba(45,106,139,0.3)', zIndex:9999, whiteSpace:'nowrap' },
  header:      { display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'16px', backgroundColor:'#fff', padding:'20px 32px', borderBottom:'1px solid #eee', boxShadow:'0 1px 8px rgba(0,0,0,0.04)' },
  headerLeft:  { display:'flex', alignItems:'center', gap:'14px' },
  avatar:      { width:'52px', height:'52px', borderRadius:'50%', backgroundColor:'#e8f1f7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px' },
  name:        { margin:0, fontSize:'18px', fontWeight:'700', color:'#1a1a2e' },
  meta:        { margin:'2px 0 0', fontSize:'13px', color:'#999' },
  headerRight: { display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' },
  regBtn:      { padding:'8px 14px', borderRadius:'8px', border:'1.5px solid #7b2d8b', backgroundColor:'transparent', color:'#7b2d8b', fontSize:'13px', fontWeight:'600', cursor:'pointer' },
  logoutBtn:   { padding:'8px 18px', borderRadius:'8px', border:'1.5px solid #ddd', backgroundColor:'#fff', color:'#555', fontSize:'13px', fontWeight:'600', cursor:'pointer' },
  banner:        { backgroundColor:'#f5f9fc', borderBottom:'1px solid #d0e4ef', padding:'16px 32px' },
  bannerInner:   { display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'16px', maxWidth:'900px' },
  bannerTitle:   { margin:'0 0 4px', fontSize:'14px', fontWeight:'700', color:'#2d6a8b' },
  bannerSub:     { margin:'0 0 10px', fontSize:'12px', color:'#888', maxWidth:'480px' },
  bannerErr:     { margin:'0 0 8px', fontSize:'12px', color:'#c0392b', fontWeight:'600' },
  bannerInput:   { padding:'9px 14px', borderRadius:'8px', border:'1.5px solid #c0d8e8', fontSize:'13px', color:'#333', outline:'none', width:'200px', fontFamily:'inherit' },
  bannerActions: { display:'flex', gap:'10px', alignItems:'center' },
  bannerConfirm: { padding:'9px 20px', borderRadius:'8px', border:'none', backgroundColor:'#2d6a8b', color:'#fff', fontSize:'13px', fontWeight:'700', cursor:'pointer' },
  bannerCancel:  { padding:'9px 16px', borderRadius:'8px', border:'1.5px solid #ccc', backgroundColor:'#fff', color:'#888', fontSize:'13px', fontWeight:'600', cursor:'pointer' },
  errBanner: { display:'flex', alignItems:'center', justifyContent:'space-between', backgroundColor:'#fff5f5', color:'#c0392b', padding:'12px 32px', fontSize:'13px', borderBottom:'1px solid #fecaca' },
  errClose:  { background:'none', border:'none', color:'#c0392b', cursor:'pointer', fontSize:'14px' },
  tabs:      { display:'flex', gap:'4px', padding:'20px 32px 0', borderBottom:'2px solid #eee', backgroundColor:'#fff', alignItems:'flex-end', overflowX:'auto' },
  tab:       { padding:'10px 18px', border:'none', background:'none', fontSize:'13px', fontWeight:'600', color:'#999', cursor:'pointer', borderBottom:'2px solid transparent', marginBottom:'-2px', borderRadius:'6px 6px 0 0', whiteSpace:'nowrap' },
  tabActive: { color:'#2d6a8b', borderBottom:'2px solid #2d6a8b', backgroundColor:'#f0f7fb' },
  content:   { padding:'24px 32px' },
  overviewGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'16px' },
  statCard:  { backgroundColor:'#fff', borderRadius:'12px', padding:'20px', border:'1px solid #eef0f3', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' },
  statLabel: { margin:'0 0 8px', fontSize:'12px', fontWeight:'700', color:'#aaa', textTransform:'uppercase', letterSpacing:'0.8px' },
  statNum:   { margin:0, fontSize:'28px', fontWeight:'800', color:'#1a1a2e' },
  statSub:   { margin:'4px 0 0', fontSize:'11px', color:'#bbb' },
  filterBar:    { display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' },
  clearBtn:     { padding:'8px 14px', borderRadius:'8px', border:'1.5px solid #fecaca', backgroundColor:'#fff5f5', color:'#c0392b', fontSize:'12px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap' },
  listHeader:   { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' },
  listCount:    { margin:0, fontSize:'13px', color:'#aaa', fontWeight:'600' },
  listRow:      { display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', padding:'14px 16px', backgroundColor:'#fff', borderRadius:'10px', border:'1px solid #eef0f3', marginBottom:'8px', boxShadow:'0 1px 4px rgba(0,0,0,0.03)' },
  listRowLeft:  { flex:1, minWidth:0 },
  listRowActions: { display:'flex', gap:'8px', flexShrink:0, flexWrap:'wrap', alignItems:'flex-start' },
  listId:    { fontSize:'12px', fontWeight:'700', color:'#2d6a8b', fontFamily:'monospace' },
  listSub:   { margin:'4px 0 2px', fontSize:'12px', color:'#aaa' },
  listNote:  { margin:0, fontSize:'13px', color:'#555', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'500px' },
  detailCard: { backgroundColor:'#fff', borderRadius:'12px', padding:'24px', border:'1px solid #eef0f3', boxShadow:'0 1px 8px rgba(0,0,0,0.04)', maxWidth:'700px' },
  formCard:   { backgroundColor:'#fff', borderRadius:'12px', padding:'24px', border:'1px solid #eef0f3', boxShadow:'0 1px 8px rgba(0,0,0,0.04)', maxWidth:'560px', marginBottom:'20px' },
  field:      { display:'flex', gap:'8px', alignItems:'flex-start', padding:'4px 0' },
  fieldLabel: { fontSize:'12px', color:'#aaa', fontWeight:'600', minWidth:'120px', flexShrink:0, cursor:'default', userSelect:'none' },
  fieldValue: { fontSize:'13px', color:'#333', fontWeight:'500', wordBreak:'break-word', cursor:'default' },
  sectionTitle: { margin:'0 0 10px', fontSize:'11px', fontWeight:'700', color:'#bbb', textTransform:'uppercase', letterSpacing:'1px', cursor:'default', userSelect:'none' },
  divider:    { height:'1px', backgroundColor:'#f5f5f5', margin:'16px 0' },
  pendingNote: { fontSize:'12px', color:'#aaa', fontStyle:'italic', margin:'4px 0', cursor:'default', userSelect:'none' },
  input:    { padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e0e0e0', fontSize:'13px', color:'#333', outline:'none', backgroundColor:'#fafafa', fontFamily:'inherit', width:'100%', boxSizing:'border-box' },
  textarea: { padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e0e0e0', fontSize:'13px', color:'#333', outline:'none', backgroundColor:'#fafafa', fontFamily:'inherit', width:'100%', boxSizing:'border-box', resize:'vertical' },
  select:   { padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e0e0e0', fontSize:'13px', color:'#333', outline:'none', backgroundColor:'#fafafa', fontFamily:'inherit', width:'100%', boxSizing:'border-box', cursor:'pointer' },
  btn:        { padding:'8px 16px', borderRadius:'8px', border:'1.5px solid #2d6a8b', backgroundColor:'#fff', color:'#2d6a8b', fontSize:'13px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap' },
  btnPrimary: { padding:'9px 18px', borderRadius:'8px', border:'none', backgroundColor:'#2d6a8b', color:'#fff', fontSize:'13px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap' },
  btnGhost:   { padding:'8px 14px', borderRadius:'8px', border:'1.5px solid #ddd', backgroundColor:'#fff', color:'#888', fontSize:'13px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap' },
  smallBtn:   { padding:'5px 12px', borderRadius:'6px', border:'1.5px solid #ddd', backgroundColor:'#fff', color:'#555', fontSize:'12px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap' },
  backBtn:    { display:'inline-flex', alignItems:'center', gap:'4px', padding:'6px 14px', borderRadius:'8px', border:'1.5px solid #ddd', backgroundColor:'#fff', color:'#555', fontSize:'13px', fontWeight:'600', cursor:'pointer', marginBottom:'16px' },
  errBox:    { display:'flex', alignItems:'center', gap:'8px', backgroundColor:'#fff5f5', color:'#c0392b', padding:'10px 14px', borderRadius:'8px', fontSize:'13px', border:'1px solid #fecaca', marginBottom:'10px' },
  successBox: { backgroundColor:'#eafaf1', color:'#1e8449', padding:'10px 14px', borderRadius:'8px', fontSize:'13px', border:'1px solid #a9dfbf', marginBottom:'10px' },
  warnBox:    { backgroundColor:'#fffbf0', color:'#d68910', padding:'10px 14px', borderRadius:'8px', fontSize:'13px', border:'1px solid #f9e4b7', marginBottom:'10px' },
  infoBox:    { backgroundColor:'#f0f7fb', padding:'14px', borderRadius:'8px', border:'1px solid #d0e8f5', marginBottom:'10px' },
};

if (!document.getElementById('disp-dash-styles')) {
  const tag = document.createElement('style');
  tag.id = 'disp-dash-styles';
  // CHANGE: Added slideInRight animation for notification cards
  tag.innerHTML = `
    @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
    @keyframes slideInRight{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
  `;
  document.head.appendChild(tag);
}

export default DispatcherDashboard;