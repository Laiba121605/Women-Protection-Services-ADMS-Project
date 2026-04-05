// src/pages/AdminDashboard.jsx
// Full admin dashboard
// Tabs: Overview | Recoveries | Dispatchers | Volunteers | Victims | Incidents | System

import React, { useState, useEffect, useCallback } from 'react';
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
  <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'700', backgroundColor:bg, color, letterSpacing:'0.3px', cursor:'default', userSelect:'none' }}>{label}</span>
);

const statusBadge = (s) => {
  const m = {
    Ongoing:   { color:'#e67e22', bg:'#fff3e0' },
    Pending:   { color:'#777',    bg:'#f5f5f5' },
    Completed: { color:'#2980b9', bg:'#e8f4fd' },
    Resolved:  { color:'#1e8449', bg:'#eafaf1' },
    High:      { color:'#c0392b', bg:'#fff0f0' },
    Medium:    { color:'#d68910', bg:'#fffbf0' },
    Low:       { color:'#1e8449', bg:'#f0fff4' },
    Yes:       { color:'#1e8449', bg:'#eafaf1' },
    No:        { color:'#c0392b', bg:'#fff0f0' },
    True:      { color:'#1e8449', bg:'#eafaf1' },
    False:     { color:'#8e44ad', bg:'#fdf2f8' },
  };
  const c = m[s] || { color:'#555', bg:'#f5f5f5' };
  return <Badge label={s || '—'} color={c.color} bg={c.bg} />;
};

const Field = ({ label, value }) => (
  <div style={D.field}>
    <span style={D.fieldLabel}>{label}</span>
    <span style={D.fieldValue}>{value ?? '—'}</span>
  </div>
);

const SectionTitle = ({ children }) => <p style={D.sectionTitle}>{children}</p>;
const Err = ({ msg }) => msg ? <div style={D.errBox}>⚠️ {msg}</div> : null;
const Spinner = () => (
  <div style={{ display:'flex', justifyContent:'center', padding:'60px' }}>
    <div style={{ width:'28px', height:'28px', border:'3px solid #e0e8ef', borderTop:'3px solid #7b2d8b', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
  </div>
);
const Empty = ({ icon, text }) => (
  <div style={{ textAlign:'center', padding:'60px 20px' }}>
    <p style={{ fontSize:'40px', margin:'0 0 10px' }}>{icon}</p>
    <p style={{ fontSize:'14px', color:'#aaa', margin:0 }}>{text}</p>
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const { user, login, logout: ctxLogout } = useAuth();
  const isAlsoVictim = user?.roles?.includes('Victim');

  const [tab, setTab]           = useState('overview');
  const [toast, setToast]       = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [globalErr, setGlobalErr]   = useState('');
  const [showRegForm, setShowRegForm] = useState(false);
  const [regContact, setRegContact]   = useState('');
  const [regErr, setRegErr]           = useState('');
  const [registering, setRegistering] = useState(false);

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
    setRegistering(true);
    try {
      const res = await API.post('/victim/register', { Emergency_contact: regContact.trim() });
      if (res.data.token) {
        const b64 = res.data.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
        login(res.data.token, JSON.parse(window.atob(b64)));
      }
      showToast('Registered as Victim!');
      setShowRegForm(false); setRegContact(''); setTab('victim');
    } catch (e) { setRegErr(e.response?.data?.message || 'Registration failed'); }
    finally { setRegistering(false); }
  };

  const TABS = [
    { key:'overview',    label:'📊 Overview' },
    { key:'recoveries',  label:'🔑 Recoveries' },
    { key:'dispatchers', label:'📞 Dispatchers' },
    { key:'volunteers',  label:'🤝 Volunteers' },
    { key:'victims',     label:'🛡️ Victims' },
    { key:'incidents',   label:'🚨 Incidents' },
    { key:'system',      label:'⚙️ System' },
    { key:'tables',      label:'📋 Tables' },
    ...(isAlsoVictim ? [{ key:'victim', label:'🛡️ My Victim View' }] : []),
  ];

  return (
    <div style={D.page}>
      {toast && <div style={D.toast}>{toast}</div>}

      <div style={D.header}>
        <div style={D.headerLeft}>
          <div style={D.avatar}>🛡️</div>
          <div>
            <h1 style={D.name}>{user?.name || user?.id}</h1>
            <p style={D.meta}>Admin{isAlsoVictim ? ' · Victim' : ''} · {user?.id}</p>
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
              <p style={D.bannerSub}>Provide an emergency contact number to register.</p>
              {regErr && <p style={D.bannerErr}>⚠️ {regErr}</p>}
              <input value={regContact} onChange={e=>{setRegContact(e.target.value);setRegErr('');}}
                placeholder="03001234567" maxLength={11} style={D.bannerInput} />
            </div>
            <div style={D.bannerActions}>
              <button onClick={handleRegisterVictim} disabled={registering} style={D.bannerConfirm}>{registering?'Registering…':'Confirm'}</button>
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
            style={{ ...D.tab, ...(tab===t.key ? D.tabActive : {}) }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={D.content}>
        {tab === 'overview'    && <OverviewTab    showToast={showToast} />}
        {tab === 'recoveries'  && <RecoveriesTab  showToast={showToast} />}
        {tab === 'dispatchers' && <DispatchersTab showToast={showToast} />}
        {tab === 'volunteers'  && <VolunteersTab  showToast={showToast} />}
        {tab === 'victims'     && <VictimsTab     showToast={showToast} />}
        {tab === 'incidents'   && <IncidentsTab   showToast={showToast} />}
        {tab === 'system'      && <SystemTab      showToast={showToast} />}
        {tab === 'tables'      && <TablesTab      showToast={showToast} />}
        {tab === 'victim'      && isAlsoVictim && <VictimDashboard embeddedMode={true} />}
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

  useEffect(() => {
    (async () => {
      try { const r = await API.get('/admin/overview'); setData(r.data); }
      catch (e) { setErr(e.response?.data?.error || 'Failed to load overview'); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <Spinner />;
  if (err)     return <Err msg={err} />;
  if (!data)   return null;

  const c = data.counts;

  const statCards = [
    { label:'Victims',            val:c.victims,           icon:'🛡️' },
    { label:'Volunteers',         val:c.volunteers,        icon:'🤝' },
    { label:'Dispatchers',        val:c.dispatchers,       icon:'📞' },
    { label:'Admins',             val:c.admins,            icon:'👑' },
    { label:'Total Requests',     val:c.requests,          icon:'📋' },
    { label:'Total Incidents',    val:c.incidents,         icon:'🚨' },
    { label:'Active Incidents',   val:c.active_incidents,  icon:'🔴', highlight: c.active_incidents > 0 },
    { label:'Active Assignments', val:c.active_assignments,icon:'🚔', highlight: c.active_assignments > 0 },
    { label:'Pending Recoveries', val:c.pending_recoveries,icon:'🔑', highlight: c.pending_recoveries > 0 },
    { label:'Law Cases',          val:c.law_cases,         icon:'⚖️' },
    { label:'Follow-ups',         val:c.follow_ups,        icon:'🏥' },
  ];

  return (
    <div>
      <div style={D.overviewGrid}>
        {statCards.map(sc => (
          <div key={sc.label} style={{ ...D.statCard, ...(sc.highlight ? { borderColor:'#fecaca', backgroundColor:'#fff8f8' } : {}) }}>
            <p style={D.statLabel}>{sc.icon} {sc.label}</p>
            <p style={{ ...D.statNum, ...(sc.highlight ? { color:'#c0392b' } : {}) }}>{sc.val}</p>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'16px', marginTop:'24px' }}>
        {/* Dispatcher availability */}
        <div style={D.statCard}>
          <p style={D.statLabel}>📞 Dispatcher Availability</p>
          {data.dispatcher_availability.map(r => (
            <div key={r.Availability} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0' }}>
              {statusBadge(r.Availability)}
              <span style={{ fontSize:'18px', fontWeight:'800', color:'#1a1a2e' }}>{r.count}</span>
            </div>
          ))}
        </div>
        {/* Volunteer availability */}
        <div style={D.statCard}>
          <p style={D.statLabel}>🤝 Volunteer Availability</p>
          {data.volunteer_availability.map(r => (
            <div key={r.Availability} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0' }}>
              {statusBadge(r.Availability)}
              <span style={{ fontSize:'18px', fontWeight:'800', color:'#1a1a2e' }}>{r.count}</span>
            </div>
          ))}
        </div>
        {/* Incidents by severity */}
        <div style={D.statCard}>
          <p style={D.statLabel}>🚨 Incidents by Severity</p>
          {data.incidents_by_severity.map(r => (
            <div key={r.Severity} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0' }}>
              {statusBadge(r.Severity)}
              <span style={{ fontSize:'18px', fontWeight:'800', color:'#1a1a2e' }}>{r.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// RECOVERIES TAB
// ══════════════════════════════════════════════════════════════════════════════
const RecoveriesTab = ({ showToast }) => {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [filter, setFilter]   = useState('');
  const [search, setSearch]   = useState('');
  const [resetting, setResetting] = useState(null);
  const [deleting, setDeleting]   = useState(null);
  const [newPassword, setNewPassword] = useState(null); // shown after reset

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const param = filter ? `?status=${filter}` : '';
      const r = await API.get(`/admin/recoveries${param}`);
      setRows(r.data);
    } catch (e) { setErr(e.response?.data?.error || 'Failed to load recoveries'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const { user: currentUser } = useAuth();
  const currentAdminId = currentUser?.id;

  const resetPassword = async (id) => {
    if (!window.confirm('Reset this user\'s password? A new password will be generated.')) return;
    setResetting(id); setNewPassword(null);
    try {
      const res = await API.put(`/admin/recovery/${id}/reset-password`);
      setNewPassword({ id, password: res.data.new_password, email: res.data.user_email });
      showToast('Password reset successfully');
      await load();
    } catch (e) { setErr(e.response?.data?.error || 'Failed to reset password'); }
    finally { setResetting(null); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this recovery request?')) return;
    setDeleting(id);
    try {
      await API.delete(`/admin/recovery/${id}`);
      showToast('Request deleted');
      await load();
    } catch (e) { setErr(e.response?.data?.error || 'Failed to delete'); }
    finally { setDeleting(null); }
  };

  const filtered = rows.filter(r =>
    !search.trim() ||
    r.user_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.user_email?.toLowerCase().includes(search.toLowerCase()) ||
    r.Recovery_id?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={D.filterBar}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or email" style={{ ...D.input, flex:1 }} />
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{ ...D.select, width:'160px', flex:'none' }}>
          <option value="">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="Resolved">Resolved</option>
        </select>
        {(search||filter) && <button onClick={()=>{setSearch('');setFilter('');}} style={D.clearBtn}>✕ Clear</button>}
      </div>
      <div style={D.listHeader}>
        <p style={D.listCount}>Showing {filtered.length} of {rows.length} request{rows.length!==1?'s':''}</p>
      </div>
      <Err msg={err} />
      {newPassword && (
        <div style={{ backgroundColor:'#eafaf1', border:'1.5px solid #a9dfbf', borderRadius:'10px', padding:'14px 18px', marginBottom:'16px' }}>
          <p style={{ margin:'0 0 6px', fontSize:'13px', fontWeight:'700', color:'#1e8449' }}>
            ✅ Password reset for {newPassword.email}
          </p>
          <p style={{ margin:'0 0 8px', fontSize:'13px', color:'#555' }}>
            New password: <code style={{ backgroundColor:'#fff', padding:'2px 8px', borderRadius:'4px', fontFamily:'monospace', fontWeight:'700', fontSize:'14px' }}>{newPassword.password}</code>
          </p>
          <p style={{ margin:0, fontSize:'12px', color:'#888' }}>Share this with the user securely. This will not be shown again.</p>
          <button onClick={() => setNewPassword(null)} style={{ marginTop:'8px', ...D.smallBtn }}>Dismiss</button>
        </div>
      )}
      {filtered.length === 0
        ? <Empty icon="🔑" text={rows.length===0?'No password recovery requests.':'No requests match filters.'} />
        : filtered.map(r => (
          <div key={r.Recovery_id} style={D.listRow}>
            <div style={D.listRowLeft}>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                <span style={D.listId}>{r.Recovery_id}</span>
                {statusBadge(r.Status)}
              </div>
              <p style={{ margin:'4px 0 2px', fontSize:'13px', fontWeight:'600', color:'#333' }}>{r.user_name}</p>
              <p style={D.listSub}>{r.user_email} · {r.user_phone} · Requested: {fmt(r.Request_time)}</p>
              {r.Resolution_time && <p style={D.listSub}>Resolved: {fmt(r.Resolution_time)} by {r.admin_name || 'Admin'}</p>}
            </div>
            <div style={{ display:'flex', gap:'6px' }}>
              {r.Status === 'Pending' && r.Admin_id === currentAdminId && (
                <button onClick={() => resetPassword(r.Recovery_id)} disabled={resetting===r.Recovery_id}
                  style={{ ...D.btn, backgroundColor:'#eafaf1', color:'#1e8449', border:'1.5px solid #a9dfbf' }}>
                  {resetting===r.Recovery_id ? '…' : '🔑 Reset Password'}
                </button>
              )}
              {r.Status === 'Pending' && r.Admin_id !== currentAdminId && (
                <span style={{ fontSize:'12px', color:'#aaa' }}>Assigned to another admin</span>
              )}
              <button onClick={() => del(r.Recovery_id)} disabled={deleting===r.Recovery_id}
                style={{ ...D.smallBtn, color:'#c0392b', border:'1.5px solid #fecaca' }}>
                {deleting===r.Recovery_id ? '…' : 'Delete'}
              </button>
            </div>
          </div>
        ))
      }
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// DISPATCHERS TAB
// ══════════════════════════════════════════════════════════════════════════════
const DispatchersTab = ({ showToast }) => {
  const [rows, setRows]           = useState([]);
  const [dispatchers, setDispatchers] = useState([]); // all dispatchers for reassign dropdown
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState('');
  const [search, setSearch]       = useState('');
  const [filterAvail, setFilterAvail] = useState('');
  const [updating, setUpdating]   = useState(null);
  const [blockErr, setBlockErr]   = useState({}); // per-dispatcher error
  const [reassignTarget, setReassignTarget] = useState({}); // dispatcher to reassign incidents to
  const [reassigning, setReassigning]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await API.get('/admin/dispatchers');
      setRows(r.data);
      setDispatchers(r.data);
    }
    catch (e) { setErr(e.response?.data?.error || 'Failed to load dispatchers'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setAvail = async (id, avail) => {
    setUpdating(id);
    setBlockErr(prev => ({ ...prev, [id]: '' }));
    try {
      await API.put(`/admin/dispatcher/${id}/availability`, { availability: avail });
      showToast(`Dispatcher availability set to ${avail}`);
      await load();
    } catch (e) {
      const msg = e.response?.data?.error || 'Update failed';
      const incidents = e.response?.data?.active_incidents || [];
      setBlockErr(prev => ({ ...prev, [id]: msg }));
    }
    finally { setUpdating(null); }
  };

  // Reassign all of this dispatcher's active incidents to another dispatcher
  const reassignAll = async (fromId) => {
    const toId = reassignTarget[fromId];
    if (!toId) return setBlockErr(prev => ({ ...prev, [fromId]: 'Select a dispatcher to reassign to' }));
    setReassigning(fromId);
    try {
      // Get this dispatcher's active incidents and reassign each
      const dispRow = rows.find(r => r.User_id === fromId);
      const activeIds = dispRow?.active_incident_ids || [];
      // Re-fetch to get current active incident IDs
      const incRes = await API.get('/admin/incidents');
      const myActive = incRes.data.filter(i =>
        i.Dispatcher_id === fromId && i.incident_status !== 'Completed'
      );
      if (myActive.length === 0) {
        showToast('No active incidents to reassign');
        setReassigning(null);
        return;
      }
      await Promise.all(
        myActive.map(i => API.put(`/admin/incident/${i.Incident_id}/reassign`, { dispatcher_id: toId }))
      );
      showToast(`${myActive.length} incident(s) reassigned to ${toId}`);
      setBlockErr(prev => ({ ...prev, [fromId]: '' }));
      setReassignTarget(prev => ({ ...prev, [fromId]: '' }));
      await load();
    } catch (e) {
      setBlockErr(prev => ({ ...prev, [fromId]: e.response?.data?.error || 'Reassign failed' }));
    }
    finally { setReassigning(null); }
  };

  const filtered = rows.filter(r => {
    if (filterAvail && r.Availability !== filterAvail) return false;
    if (search.trim() &&
        !r.Name?.toLowerCase().includes(search.toLowerCase()) &&
        !r.User_id?.toLowerCase().includes(search.toLowerCase()) &&
        !r.Email?.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={D.filterBar}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, ID or email" style={{ ...D.input, flex:1 }} />
        <select value={filterAvail} onChange={e=>setFilterAvail(e.target.value)} style={{ ...D.select, width:'160px', flex:'none' }}>
          <option value="">All availability</option>
          <option value="Yes">Available</option>
          <option value="No">Unavailable</option>
        </select>
        {(search||filterAvail) && <button onClick={()=>{setSearch('');setFilterAvail('');}} style={D.clearBtn}>✕ Clear</button>}
      </div>
      <div style={D.listHeader}>
        <p style={D.listCount}>Showing {filtered.length} of {rows.length} dispatcher{rows.length!==1?'s':''}</p>
      </div>
      <Err msg={err} />
      {filtered.length === 0
        ? <Empty icon="📞" text="No dispatchers found." />
        : filtered.map(d => (
          <div key={d.User_id} style={D.listRow}>
            <div style={D.listRowLeft}>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                <span style={D.listId}>{d.User_id}</span>
                {statusBadge(d.Availability)}
                {d.active_incidents > 0 && <Badge label={`${d.active_incidents} active`} color="#c0392b" bg="#fff0f0" />}
              </div>
              <p style={{ margin:'4px 0 2px', fontSize:'13px', fontWeight:'600', color:'#333' }}>{d.Name}</p>
              <p style={D.listSub}>{d.Email} · {d.Phone_no} · {d.centre_location} · {d.total_requests} requests · {d.total_incidents} incidents</p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', alignItems:'flex-end', flexShrink:0 }}>
              <button onClick={() => setAvail(d.User_id, d.Availability==='Yes'?'No':'Yes')}
                disabled={updating===d.User_id}
                style={{ ...D.smallBtn, backgroundColor: d.Availability==='Yes'?'#fff0f0':'#eafaf1', color: d.Availability==='Yes'?'#c0392b':'#1e8449', border:`1.5px solid ${d.Availability==='Yes'?'#fecaca':'#a9dfbf'}` }}>
                {updating===d.User_id ? '…' : d.Availability==='Yes' ? 'Set Offline' : 'Set Online'}
              </button>
              {/* Show block error + reassign UI when trying to set offline fails */}
              {blockErr[d.User_id] && (
                <div style={{ maxWidth:'320px', textAlign:'right' }}>
                  <p style={{ margin:'0 0 6px', fontSize:'12px', color:'#c0392b', fontWeight:'600' }}>
                    ⚠️ {blockErr[d.User_id]}
                  </p>
                  <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                    <select value={reassignTarget[d.User_id]||''} onChange={e=>setReassignTarget(prev=>({...prev,[d.User_id]:e.target.value}))}
                      style={{ ...D.select, fontSize:'12px', padding:'4px 8px', width:'160px' }}>
                      <option value="">— Reassign all to —</option>
                      {dispatchers.filter(x => x.User_id !== d.User_id).map(x => (
                        <option key={x.User_id} value={x.User_id}>{x.Name} ({x.Availability})</option>
                      ))}
                    </select>
                    <button onClick={() => reassignAll(d.User_id)} disabled={reassigning===d.User_id}
                      style={{ ...D.smallBtn, backgroundColor:'#fff3e0', color:'#e67e22', border:'1.5px solid #f9ca9a', whiteSpace:'nowrap' }}>
                      {reassigning===d.User_id ? '…' : 'Reassign All'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))
      }
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// VOLUNTEERS TAB (all centres)
// ══════════════════════════════════════════════════════════════════════════════
const VolunteersTab = () => {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [search, setSearch]   = useState('');
  const [filterAvail, setFilterAvail] = useState('');
  const [filterCentre, setFilterCentre] = useState('');

  useEffect(() => {
    (async () => {
      try { const r = await API.get('/admin/volunteers'); setRows(r.data); }
      catch (e) { setErr(e.response?.data?.error || 'Failed to load volunteers'); }
      finally { setLoading(false); }
    })();
  }, []);

  const centres = [...new Set(rows.map(r => r.centre_location))].sort();

  const filtered = rows.filter(r => {
    if (filterAvail  && r.Availability !== filterAvail)         return false;
    if (filterCentre && r.centre_location !== filterCentre)      return false;
    if (search.trim() &&
        !r.Name?.toLowerCase().includes(search.toLowerCase()) &&
        !r.User_id?.toLowerCase().includes(search.toLowerCase()) &&
        !r.Phone_no?.includes(search))
      return false;
    return true;
  });

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={D.filterBar}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, ID or phone" style={{ ...D.input, flex:1 }} />
        <select value={filterAvail} onChange={e=>setFilterAvail(e.target.value)} style={{ ...D.select, width:'150px', flex:'none' }}>
          <option value="">All availability</option>
          <option value="Yes">Available</option>
          <option value="No">Unavailable</option>
        </select>
        <select value={filterCentre} onChange={e=>setFilterCentre(e.target.value)} style={{ ...D.select, width:'180px', flex:'none' }}>
          <option value="">All centres</option>
          {centres.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search||filterAvail||filterCentre) && <button onClick={()=>{setSearch('');setFilterAvail('');setFilterCentre('');}} style={D.clearBtn}>✕ Clear</button>}
      </div>
      <div style={D.listHeader}>
        <p style={D.listCount}>Showing {filtered.length} of {rows.length} volunteer{rows.length!==1?'s':''}</p>
      </div>
      <Err msg={err} />
      {filtered.length === 0
        ? <Empty icon="🤝" text="No volunteers found." />
        : filtered.map(v => (
          <div key={v.User_id} style={D.listRow}>
            <div style={D.listRowLeft}>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                <span style={D.listId}>{v.User_id}</span>
                {statusBadge(v.Availability)}
                {v.Status && statusBadge(v.Status)}
              </div>
              <p style={{ margin:'4px 0 2px', fontSize:'13px', fontWeight:'600', color:'#333' }}>{v.Name}</p>
              <p style={D.listSub}>{v.Phone_no} · {v.Email} · {v.centre_location} · {v.total_assignments} assignments</p>
            </div>
          </div>
        ))
      }
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// VICTIMS TAB
// ══════════════════════════════════════════════════════════════════════════════
const VictimsTab = () => {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [search, setSearch]   = useState('');

  useEffect(() => {
    (async () => {
      try { const r = await API.get('/admin/victims'); setRows(r.data); }
      catch (e) { setErr(e.response?.data?.error || 'Failed to load victims'); }
      finally { setLoading(false); }
    })();
  }, []);

  const [filterActive, setFilterActive] = useState(''); // '' | 'yes' | 'no'

  const filtered = rows.filter(r => {
    if (filterActive === 'yes' && !(r.active_incidents > 0)) return false;
    if (filterActive === 'no'  && r.active_incidents > 0)    return false;
    if (!search.trim()) return true;
    return (
      r.Name?.toLowerCase().includes(search.toLowerCase()) ||
      r.User_id?.toLowerCase().includes(search.toLowerCase()) ||
      r.Phone_no?.includes(search) ||
      r.Email?.toLowerCase().includes(search.toLowerCase())
    );
  });

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={D.filterBar}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, ID, phone or email" style={{ ...D.input, flex:1 }} />
        <select value={filterActive} onChange={e=>setFilterActive(e.target.value)} style={{ ...D.select, width:'180px', flex:'none' }}>
          <option value="">All victims</option>
          <option value="yes">Has active incidents</option>
          <option value="no">No active incidents</option>
        </select>
        {(search||filterActive) && <button onClick={()=>{setSearch('');setFilterActive('');}} style={D.clearBtn}>✕ Clear</button>}
      </div>
      <div style={D.listHeader}>
        <p style={D.listCount}>Showing {filtered.length} of {rows.length} victim{rows.length!==1?'s':''}</p>
      </div>
      <Err msg={err} />
      {filtered.length === 0
        ? <Empty icon="🛡️" text="No victims found." />
        : filtered.map(v => (
          <div key={v.User_id} style={D.listRow}>
            <div style={D.listRowLeft}>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                <span style={D.listId}>{v.User_id}</span>
                {v.active_incidents > 0 && <Badge label={`${v.active_incidents} active incident${v.active_incidents!==1?'s':''}`} color="#c0392b" bg="#fff0f0" />}
              </div>
              <p style={{ margin:'4px 0 2px', fontSize:'13px', fontWeight:'600', color:'#333' }}>{v.Name}</p>
              <p style={D.listSub}>{v.Phone_no} · {v.Email} · {v.total_requests} requests · EC: {v.Emergency_contact}</p>
            </div>
          </div>
        ))
      }
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// INCIDENTS TAB (all incidents, admin view)
// ══════════════════════════════════════════════════════════════════════════════
const IncidentsTab = ({ showToast }) => {
  const [rows, setRows]       = useState([]);
  const [dispatchers, setDispatchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [search, setSearch]   = useState('');
  const [filterSev, setFilterSev]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [reassigning, setReassigning]   = useState(null);
  const [selDispatcher, setSelDispatcher] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [iRes, dRes] = await Promise.all([
        API.get('/admin/incidents'),
        API.get('/admin/dispatchers'),
      ]);
      setRows(iRes.data);
      setDispatchers(dRes.data);
    } catch (e) { setErr(e.response?.data?.error || 'Failed to load incidents'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const reassign = async (incidentId) => {
    const dispId = selDispatcher[incidentId];
    if (!dispId) return setErr('Select a dispatcher to reassign to');
    setReassigning(incidentId);
    try {
      await API.put(`/admin/incident/${incidentId}/reassign`, { dispatcher_id: dispId });
      showToast(`Incident reassigned to ${dispId}`);
      await load();
    } catch (e) { setErr(e.response?.data?.error || 'Reassign failed'); }
    finally { setReassigning(null); }
  };

  const filtered = rows.filter(r => {
    if (filterSev    && r.Severity       !== filterSev)    return false;
    if (filterStatus && r.incident_status !== filterStatus) return false;
    if (search.trim() &&
        !r.Incident_id?.toLowerCase().includes(search.toLowerCase()) &&
        !r.victim_name?.toLowerCase().includes(search.toLowerCase()) &&
        !r.dispatcher_name?.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={D.filterBar}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by incident ID, victim or dispatcher" style={{ ...D.input, flex:1 }} />
        <select value={filterSev}    onChange={e=>setFilterSev(e.target.value)}    style={{ ...D.select, width:'130px', flex:'none' }}><option value="">All severities</option>{['High','Medium','Low'].map(s=><option key={s}>{s}</option>)}</select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...D.select, width:'130px', flex:'none' }}><option value="">All statuses</option>{['Ongoing','Pending','Completed'].map(s=><option key={s}>{s}</option>)}</select>
        {(search||filterSev||filterStatus) && <button onClick={()=>{setSearch('');setFilterSev('');setFilterStatus('');}} style={D.clearBtn}>✕ Clear</button>}
      </div>
      <div style={D.listHeader}>
        <p style={D.listCount}>Showing {filtered.length} of {rows.length} incident{rows.length!==1?'s':''}</p>
      </div>
      <Err msg={err} />
      {filtered.length === 0
        ? <Empty icon="🚨" text="No incidents found." />
        : filtered.map(i => (
          <div key={i.Incident_id} style={D.listRow}>
            <div style={D.listRowLeft}>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                <span style={D.listId}>{i.Incident_id}</span>
                {statusBadge(i.Severity)} {statusBadge(i.incident_status)}
                <span style={{ fontSize:'12px', color:'#aaa' }}>{i.Emergency_type}</span>
              </div>
              <p style={{ margin:'4px 0 2px', fontSize:'13px', color:'#333' }}>
                Victim: <strong>{i.victim_name}</strong> · Dispatcher: <strong>{i.dispatcher_name}</strong>
              </p>
              <p style={D.listSub}>{i.centre_location} · {fmt(i.incident_time)}</p>
            </div>
            {i.incident_status !== 'Completed' && (
              <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0 }}>
                <select value={selDispatcher[i.Incident_id]||''} onChange={e=>setSelDispatcher(prev=>({...prev,[i.Incident_id]:e.target.value}))} style={{ ...D.select, width:'160px', fontSize:'12px', padding:'5px 8px' }}>
                  <option value="">— Reassign to —</option>
                  {dispatchers.filter(d=>d.User_id!==i.Dispatcher_id).map(d=>(
                    <option key={d.User_id} value={d.User_id}>{d.Name} ({d.Availability})</option>
                  ))}
                </select>
                <button onClick={() => reassign(i.Incident_id)} disabled={reassigning===i.Incident_id || !selDispatcher[i.Incident_id]} style={D.smallBtn}>
                  {reassigning===i.Incident_id ? '…' : 'Reassign'}
                </button>
              </div>
            )}
          </div>
        ))
      }
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SYSTEM TAB — Priority lock management
// ══════════════════════════════════════════════════════════════════════════════
const SystemTab = ({ showToast }) => {
  const [lockStatus, setLockStatus]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [err, setErr]                 = useState('');
  const [duration, setDuration]       = useState(10);
  const [activating, setActivating]   = useState(false);
  const [releasing, setReleasing]     = useState(false);
  // Granular lock scope
  const [lockScope, setLockScope]     = useState('database'); // 'database' | 'table' | 'row'
  const [lockTable, setLockTable]     = useState('Incident');
  const [lockRowId, setLockRowId]     = useState('');

  const ALL_TABLES = [
    'Request_log','Incident','Assignment','Volunteer_assignment','Law_case',
    'Follow_up_support','Ambulance_service','Police_services','Dispatcher',
    'Victim','Admin','Centre','User','Password_Recovery','Volunteer'
  ];

  const loadStatus = useCallback(async () => {
    try { const r = await API.get('/admin/priority-lock-status'); setLockStatus(r.data); }
    catch (e) { setErr(e.response?.data?.error || 'Failed to load lock status'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadStatus();
    const t = setInterval(loadStatus, 10000);
    return () => clearInterval(t);
  }, [loadStatus]);

  const activate = async () => {
    if (duration < 1 || duration > 60) return setErr('Duration must be between 1 and 60 minutes');
    setActivating(true); setErr('');
    try {
      await API.post('/admin/priority-lock', { duration_minutes: duration });
      showToast(`Priority lock activated for ${duration} minutes`);
      await loadStatus();
    } catch (e) { setErr(e.response?.data?.error || 'Failed to activate lock'); }
    finally { setActivating(false); }
  };

  const release = async () => {
    setReleasing(true); setErr('');
    try {
      await API.post('/admin/priority-unlock');
      showToast('Priority lock released');
      await loadStatus();
    } catch (e) { setErr(e.response?.data?.error || 'Failed to release lock'); }
    finally { setReleasing(false); }
  };

  if (loading) return <Spinner />;

  const active      = lockStatus?.active;
  const remaining   = lockStatus?.remaining_ms ? Math.ceil(lockStatus.remaining_ms / 60000) : 0;

  const scopeDesc = {
    database: 'Blocks ALL dispatcher write operations across the entire system.',
    table:    `Blocks dispatcher writes only on the ${lockScope==='table'?lockTable:'selected'} table.`,
    row:      `Blocks dispatcher writes only on the specific record you specify.`,
  };

  return (
    <div style={{ maxWidth:'700px' }}>
      {/* Lock status card */}
      <div style={{ ...D.statCard, marginBottom:'24px', border: active ? '2px solid #fecaca' : '1px solid #eef0f3', backgroundColor: active ? '#fff8f8' : '#fff' }}>
        <p style={D.statLabel}>⚙️ Priority Lock Status</p>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginTop:'8px' }}>
          <Badge label={active ? '🔒 ACTIVE' : '🔓 INACTIVE'} color={active?'#c0392b':'#1e8449'} bg={active?'#fff0f0':'#eafaf1'} />
          {active && <span style={{ fontSize:'13px', color:'#c0392b', fontWeight:'600' }}>~{remaining} min remaining · expires {fmt(lockStatus.expires_at)}</span>}
        </div>
        {active && (
          <p style={{ margin:'10px 0 0', fontSize:'12px', color:'#888' }}>
            All dispatcher write operations are blocked. You (the admin) can still write freely.
          </p>
        )}
      </div>

      <Err msg={err} />

      {!active ? (
        <div style={D.formCard}>
          <SectionTitle>Activate Priority Lock</SectionTitle>

          {/* Scope selector */}
          <p style={{ fontSize:'13px', color:'#555', margin:'0 0 12px' }}>
            <strong>What to lock:</strong>
          </p>
          <div style={{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap' }}>
            {[['database','🌐 Whole Database'],['table','📋 One Table'],['row','🔲 One Row']].map(([k,l]) => (
              <button key={k} onClick={() => setLockScope(k)}
                style={{ padding:'7px 14px', borderRadius:'8px', border:`1.5px solid ${lockScope===k?'#7b2d8b':'#ddd'}`, backgroundColor: lockScope===k?'#fdf5ff':'#fff', color: lockScope===k?'#7b2d8b':'#555', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
                {l}
              </button>
            ))}
          </div>

          {/* Scope description */}
          <div style={{ backgroundColor:'#f9f4ff', border:'1px solid #e0c8f5', borderRadius:'8px', padding:'10px 14px', marginBottom:'14px' }}>
            <p style={{ margin:0, fontSize:'12px', color:'#7b2d8b' }}>
              {lockScope === 'database' && '🌐 Whole Database — blocks ALL dispatcher write operations system-wide. Use for maintenance windows.'}
              {lockScope === 'table'    && `📋 One Table — blocks dispatchers from writing to the ${lockTable} table only. Other tables remain writable.`}
              {lockScope === 'row'      && `🔲 One Row — blocks dispatcher writes on a single record (e.g. one Incident). Enter the record ID below.`}
            </p>
          </div>

          {/* Table picker (shown for table + row scope) */}
          {(lockScope === 'table' || lockScope === 'row') && (
            <div style={{ marginBottom:'10px' }}>
              <label style={{ fontSize:'12px', color:'#888', display:'block', marginBottom:'4px' }}>Table</label>
              <select value={lockTable} onChange={e=>setLockTable(e.target.value)} style={{ ...D.select, width:'220px' }}>
                {ALL_TABLES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {/* Row ID (only for row scope) */}
          {lockScope === 'row' && (
            <div style={{ marginBottom:'10px' }}>
              <label style={{ fontSize:'12px', color:'#888', display:'block', marginBottom:'4px' }}>Record ID</label>
              <input value={lockRowId} onChange={e=>setLockRowId(e.target.value)}
                placeholder="e.g. I001 or A003" style={{ ...D.input, width:'220px' }} />
            </div>
          )}

          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
            <label style={{ fontSize:'13px', color:'#555', whiteSpace:'nowrap' }}>Duration (minutes):</label>
            <input type="number" value={duration} onChange={e=>setDuration(Number(e.target.value))}
              min={1} max={60} style={{ ...D.input, width:'80px' }} />
          </div>

          {/* What can admin do while lock is active */}
          <div style={{ backgroundColor:'#f0faf4', border:'1px solid #a9dfbf', borderRadius:'8px', padding:'10px 14px', marginBottom:'16px' }}>
            <p style={{ margin:'0 0 6px', fontSize:'12px', fontWeight:'700', color:'#1e8449' }}>✅ While locked, you (admin) can still:</p>
            <ul style={{ margin:0, paddingLeft:'18px', fontSize:'12px', color:'#555', lineHeight:'1.7' }}>
              <li>Update any record in the <strong>Tables</strong> tab (use the Tables tab below)</li>
              <li>Reassign incidents between dispatchers</li>
              <li>Reset passwords and manage recoveries</li>
              <li>Set dispatcher/volunteer availability</li>
              <li>Create, update, or delete any user</li>
            </ul>
          </div>

          <button onClick={activate} disabled={activating || (lockScope==='row' && !lockRowId.trim())}
            style={{ ...D.btnPrimary, backgroundColor:'#c0392b' }}>
            {activating ? 'Activating…' : `🔒 Activate ${lockScope==='database'?'Database':lockScope==='table'?lockTable+' Table':'Row'} Lock`}
          </button>
        </div>
      ) : (
        <div style={D.formCard}>
          <SectionTitle>Release Priority Lock</SectionTitle>
          <p style={{ fontSize:'13px', color:'#888', margin:'0 0 16px' }}>
            Releasing the lock immediately allows dispatchers to resume write operations.
          </p>
          <p style={{ fontSize:'13px', color:'#555', margin:'0 0 16px' }}>
            💡 Use the <strong>Tables</strong> tab to view and edit any table while the lock is active.
          </p>
          <button onClick={release} disabled={releasing} style={{ ...D.btnPrimary, backgroundColor:'#1e8449' }}>
            {releasing ? 'Releasing…' : '🔓 Release Priority Lock'}
          </button>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// TABLES TAB — View all tables, browse records, edit individual records
// Uses existing admin.js routes: GET /admin/tables, GET /admin/{table},
// GET /admin/{table}/:id, PUT /admin/{table}/:id
// ══════════════════════════════════════════════════════════════════════════════
// All tables except 'admin' are editable (prevents privilege escalation)
const UPDATABLE = new Set([
  'request_log','law_case','follow_up_support','centre',
  'incident','assignment','ambulance_service','police_services',
  'dispatcher','victim','user','volunteer','password_recovery',
  'volunteer_assignment'
]);

const TablesTab = ({ showToast }) => {
  const [tables, setTables]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState('');
  const [selectedTable, setSelectedTable] = useState(null); // table name (lowercase)
  const [tableData, setTableData] = useState(null);          // { columns, data }
  const [loadingTable, setLoadingTable] = useState(false);
  const [search, setSearch]       = useState('');
  // Edit mode
  const [editingRow, setEditingRow]   = useState(null); // row object being edited
  const [editFields, setEditFields]   = useState({});
  const [saving, setSaving]           = useState(false);
  const [saveErr, setSaveErr]         = useState('');
  // Lock gate — edits only allowed while admin priority lock is active
  const [lockActive, setLockActive]   = useState(false);
  const [lockChecking, setLockChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [tablesRes, lockRes] = await Promise.all([
          API.get('/admin/tables'),
          API.get('/admin/priority-lock-status'),
        ]);
        setTables(tablesRes.data);
        setLockActive(lockRes.data.active === true);
      } catch (e) { setErr(e.response?.data?.error || 'Failed to load tables'); }
      finally { setLoading(false); setLockChecking(false); }
    })();
  }, []);

  // Re-check lock status every 15 seconds so the UI stays in sync
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await API.get('/admin/priority-lock-status');
        setLockActive(r.data.active === true);
      } catch { /* ignore */ }
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const loadTable = async (name) => {
    setSelectedTable(name);
    setLoadingTable(true);
    setTableData(null);
    setSearch('');
    setEditingRow(null);
    setSaveErr('');
    try {
      const r = await API.get(`/admin/${name}`);
      setTableData({ columns: r.data.columns, data: r.data.data, row_count: r.data.row_count });
    } catch (e) { setErr(e.response?.data?.error || `Failed to load ${name}`); }
    finally { setLoadingTable(false); }
  };

  const startEdit = (row) => {
    setEditingRow(row);
    setEditFields({ ...row });
    setSaveErr('');
  };

  const saveEdit = async (idField, idValue) => {
    setSaving(true); setSaveErr('');
    // Only send changed fields
    const changed = {};
    Object.keys(editFields).forEach(k => {
      if (editFields[k] !== editingRow[k]) changed[k] = editFields[k];
    });
    if (Object.keys(changed).length === 0) {
      setSaveErr('No changes made.');
      setSaving(false);
      return;
    }
    try {
      await API.put(`/admin/${selectedTable}/${idValue}`, changed);
      showToast('Record updated');
      setEditingRow(null);
      await loadTable(selectedTable);
    } catch (e) { setSaveErr(e.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const filteredData = tableData?.data.filter(row =>
    !search.trim() ||
    Object.values(row).some(v => String(v ?? '').toLowerCase().includes(search.toLowerCase()))
  ) || [];

  // Editing requires BOTH: table is in UPDATABLE set AND admin priority lock is active
  const canEdit = selectedTable && UPDATABLE.has(selectedTable.toLowerCase()) && lockActive;

  if (loading) return <Spinner />;

  return (
    <div>
      <Err msg={err} />

      {/* Lock status banner */}
      {!lockChecking && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderRadius: '10px', marginBottom: '16px',
          backgroundColor: lockActive ? '#eafaf1' : '#fffbf0',
          border: `1px solid ${lockActive ? '#a9dfbf' : '#f9e4b7'}`,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'16px' }}>{lockActive ? '🔒' : '🔓'}</span>
            <span style={{ fontSize:'13px', fontWeight:'600', color: lockActive ? '#1e8449' : '#b7770d' }}>
              {lockActive
                ? 'Priority lock is active — table editing enabled'
                : 'Priority lock is OFF — table editing is disabled. Enable it from the System tab to make changes.'}
            </span>
          </div>
          {!lockActive && (
            <span style={{ fontSize:'12px', color:'#aaa' }}>
              Go to System tab → Enable Lock
            </span>
          )}
        </div>
      )}

      {/* Table list */}
      {!selectedTable ? (
        <>
          <p style={{ ...D.listCount, marginBottom:'16px' }}>{tables.length} tables in database</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'10px' }}>
            {tables.map(t => (
              <div key={t.TABLE_NAME} onClick={() => loadTable(t.TABLE_NAME.toLowerCase())}
                style={{ backgroundColor:'#fff', borderRadius:'10px', padding:'14px 16px', border:'1px solid #eef0f3', cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.03)', transition:'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor='#7b2d8b'}
                onMouseLeave={e => e.currentTarget.style.borderColor='#eef0f3'}>
                <p style={{ margin:'0 0 4px', fontSize:'13px', fontWeight:'700', color:'#7b2d8b', fontFamily:'monospace' }}>{t.TABLE_NAME}</p>
                <p style={{ margin:0, fontSize:'12px', color:'#aaa' }}>
                  {t.COLUMN_COUNT} columns
                  {UPDATABLE.has(t.TABLE_NAME.toLowerCase()) ? (lockActive ? ' · ✏️ editable' : ' · 🔒 locked') : ''}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Table browser */}
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px', flexWrap:'wrap' }}>
            <button onClick={() => { setSelectedTable(null); setTableData(null); }} style={D.backBtn}>← All Tables</button>
            <span style={{ fontSize:'16px', fontWeight:'700', color:'#7b2d8b', fontFamily:'monospace' }}>{selectedTable}</span>
            {canEdit && <Badge label="✏️ Editable" color="#1e8449" bg="#eafaf1" />}
            {!canEdit && <Badge label="👁️ Read only" color="#888" bg="#f5f5f5" />}
          </div>

          {loadingTable ? <Spinner /> : tableData && (
            <>
              <div style={D.filterBar}>
                <input value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Search all columns…" style={{ ...D.input, flex:1 }} />
                {search && <button onClick={()=>setSearch('')} style={D.clearBtn}>✕ Clear</button>}
              </div>
              <p style={{ ...D.listCount, marginBottom:'12px' }}>
                {filteredData.length} of {tableData.row_count} rows
              </p>

              {/* Scrollable table */}
              <div style={{ overflowX:'auto', borderRadius:'10px', border:'1px solid #eef0f3', backgroundColor:'#fff' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                  <thead>
                    <tr style={{ backgroundColor:'#f9f4ff', borderBottom:'2px solid #eef0f3' }}>
                      {tableData.columns.map(col => (
                        <th key={col} style={{ padding:'10px 12px', textAlign:'left', fontWeight:'700', color:'#7b2d8b', whiteSpace:'nowrap', userSelect:'none' }}>{col}</th>
                      ))}
                      {canEdit && <th style={{ padding:'10px 12px', color:'#7b2d8b', fontWeight:'700' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length === 0
                      ? <tr><td colSpan={tableData.columns.length + (canEdit?1:0)} style={{ padding:'40px', textAlign:'center', color:'#aaa' }}>No rows found</td></tr>
                      : filteredData.map((row, i) => {
                          const idField  = tableData.columns[0];
                          const idValue  = row[idField];
                          const isEditing = editingRow?.[idField] === idValue;
                          return (
                            <tr key={i} style={{ borderBottom:'1px solid #f5f5f5', backgroundColor: isEditing ? '#fdf5ff' : i%2===0 ? '#fff' : '#fafafa' }}>
                              {tableData.columns.map(col => (
                                <td key={col} style={{ padding:'8px 12px', color:'#333', whiteSpace:'nowrap', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis' }}>
                                  {isEditing && col !== idField ? (
                                    <input
                                      value={editFields[col] ?? ''}
                                      onChange={e => setEditFields(prev => ({ ...prev, [col]: e.target.value }))}
                                      style={{ padding:'3px 6px', border:'1.5px solid #7b2d8b', borderRadius:'4px', fontSize:'12px', width:'120px' }}
                                    />
                                  ) : (
                                    <span title={String(row[col] ?? '')}>{String(row[col] ?? '—')}</span>
                                  )}
                                </td>
                              ))}
                              {canEdit && (
                                <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>
                                  {isEditing ? (
                                    <div style={{ display:'flex', gap:'4px', flexDirection:'column' }}>
                                      <div style={{ display:'flex', gap:'4px' }}>
                                        <button onClick={() => saveEdit(idField, idValue)} disabled={saving}
                                          style={{ padding:'3px 8px', borderRadius:'4px', border:'none', backgroundColor:'#7b2d8b', color:'#fff', fontSize:'11px', cursor:'pointer' }}>
                                          {saving ? '…' : 'Save'}
                                        </button>
                                        <button onClick={() => { setEditingRow(null); setSaveErr(''); }}
                                          style={{ padding:'3px 8px', borderRadius:'4px', border:'1px solid #ddd', backgroundColor:'#fff', color:'#888', fontSize:'11px', cursor:'pointer' }}>
                                          Cancel
                                        </button>
                                      </div>
                                      {saveErr && <span style={{ fontSize:'11px', color:'#c0392b' }}>{saveErr}</span>}
                                    </div>
                                  ) : (
                                    <button onClick={() => startEdit(row)}
                                      style={{ padding:'3px 10px', borderRadius:'4px', border:'1.5px solid #ddd', backgroundColor:'#fff', color:'#555', fontSize:'11px', cursor:'pointer' }}>
                                      Edit
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })
                    }
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};


// ── Styles ────────────────────────────────────────────────────────────────────
const D = {
  page:        { minHeight:'100vh', backgroundColor:'#f5f0fa', fontFamily:"'Segoe UI', system-ui, sans-serif", paddingBottom:'60px' },
  toast:       { position:'fixed', top:'20px', left:'50%', transform:'translateX(-50%)', backgroundColor:'#7b2d8b', color:'#fff', padding:'10px 24px', borderRadius:'30px', fontSize:'13px', fontWeight:'600', boxShadow:'0 4px 20px rgba(123,45,139,0.3)', zIndex:9999, whiteSpace:'nowrap' },
  header:      { display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'16px', backgroundColor:'#fff', padding:'20px 32px', borderBottom:'1px solid #eee', boxShadow:'0 1px 8px rgba(0,0,0,0.04)' },
  headerLeft:  { display:'flex', alignItems:'center', gap:'14px' },
  avatar:      { width:'52px', height:'52px', borderRadius:'50%', backgroundColor:'#f5e8fa', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px' },
  name:        { margin:0, fontSize:'18px', fontWeight:'700', color:'#1a1a2e' },
  meta:        { margin:'2px 0 0', fontSize:'13px', color:'#999' },
  headerRight: { display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' },
  regBtn:      { padding:'8px 14px', borderRadius:'8px', border:'1.5px solid #7b2d8b', backgroundColor:'transparent', color:'#7b2d8b', fontSize:'13px', fontWeight:'600', cursor:'pointer' },
  logoutBtn:   { padding:'8px 18px', borderRadius:'8px', border:'1.5px solid #ddd', backgroundColor:'#fff', color:'#555', fontSize:'13px', fontWeight:'600', cursor:'pointer' },
  banner:        { backgroundColor:'#fdf5ff', borderBottom:'1px solid #e8d0ef', padding:'16px 32px' },
  bannerInner:   { display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'16px', maxWidth:'900px' },
  bannerTitle:   { margin:'0 0 4px', fontSize:'14px', fontWeight:'700', color:'#7b2d8b' },
  bannerSub:     { margin:'0 0 10px', fontSize:'12px', color:'#888', maxWidth:'480px' },
  bannerErr:     { margin:'0 0 8px', fontSize:'12px', color:'#c0392b', fontWeight:'600' },
  bannerInput:   { padding:'9px 14px', borderRadius:'8px', border:'1.5px solid #d8b0e8', fontSize:'13px', color:'#333', outline:'none', width:'200px', fontFamily:'inherit' },
  bannerActions: { display:'flex', gap:'10px', alignItems:'center' },
  bannerConfirm: { padding:'9px 20px', borderRadius:'8px', border:'none', backgroundColor:'#7b2d8b', color:'#fff', fontSize:'13px', fontWeight:'700', cursor:'pointer' },
  bannerCancel:  { padding:'9px 16px', borderRadius:'8px', border:'1.5px solid #ccc', backgroundColor:'#fff', color:'#888', fontSize:'13px', fontWeight:'600', cursor:'pointer' },
  errBanner: { display:'flex', alignItems:'center', justifyContent:'space-between', backgroundColor:'#fff5f5', color:'#c0392b', padding:'12px 32px', fontSize:'13px', borderBottom:'1px solid #fecaca' },
  errClose:  { background:'none', border:'none', color:'#c0392b', cursor:'pointer', fontSize:'14px' },
  tabs:      { display:'flex', gap:'4px', padding:'20px 32px 0', borderBottom:'2px solid #eee', backgroundColor:'#fff', alignItems:'flex-end', overflowX:'auto' },
  tab:       { padding:'10px 18px', border:'none', background:'none', fontSize:'13px', fontWeight:'600', color:'#999', cursor:'pointer', borderBottom:'2px solid transparent', marginBottom:'-2px', borderRadius:'6px 6px 0 0', whiteSpace:'nowrap' },
  tabActive: { color:'#7b2d8b', borderBottom:'2px solid #7b2d8b', backgroundColor:'#fdf5ff' },
  content:   { padding:'24px 32px' },
  overviewGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'16px' },
  statCard:     { backgroundColor:'#fff', borderRadius:'12px', padding:'20px', border:'1px solid #eef0f3', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' },
  statLabel:    { margin:'0 0 8px', fontSize:'12px', fontWeight:'700', color:'#aaa', textTransform:'uppercase', letterSpacing:'0.8px' },
  statNum:      { margin:0, fontSize:'28px', fontWeight:'800', color:'#1a1a2e' },
  filterBar:    { display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' },
  clearBtn:     { padding:'8px 14px', borderRadius:'8px', border:'1.5px solid #fecaca', backgroundColor:'#fff5f5', color:'#c0392b', fontSize:'12px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap' },
  listHeader:   { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' },
  listCount:    { margin:0, fontSize:'13px', color:'#aaa', fontWeight:'600' },
  listRow:      { display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', padding:'14px 16px', backgroundColor:'#fff', borderRadius:'10px', border:'1px solid #eef0f3', marginBottom:'8px', boxShadow:'0 1px 4px rgba(0,0,0,0.03)' },
  listRowLeft:  { flex:1, minWidth:0 },
  listId:       { fontSize:'12px', fontWeight:'700', color:'#7b2d8b', fontFamily:'monospace' },
  listSub:      { margin:'4px 0 0', fontSize:'12px', color:'#aaa' },
  formCard:     { backgroundColor:'#fff', borderRadius:'12px', padding:'24px', border:'1px solid #eef0f3', boxShadow:'0 1px 8px rgba(0,0,0,0.04)', maxWidth:'560px', marginBottom:'20px' },
  field:        { display:'flex', gap:'8px', alignItems:'flex-start', padding:'4px 0' },
  fieldLabel:   { fontSize:'12px', color:'#aaa', fontWeight:'600', minWidth:'120px', flexShrink:0, cursor:'default', userSelect:'none' },
  fieldValue:   { fontSize:'13px', color:'#333', fontWeight:'500', wordBreak:'break-word', cursor:'default' },
  sectionTitle: { margin:'0 0 10px', fontSize:'11px', fontWeight:'700', color:'#bbb', textTransform:'uppercase', letterSpacing:'1px', cursor:'default', userSelect:'none' },
  input:    { padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e0e0e0', fontSize:'13px', color:'#333', outline:'none', backgroundColor:'#fafafa', fontFamily:'inherit', width:'100%', boxSizing:'border-box' },
  select:   { padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e0e0e0', fontSize:'13px', color:'#333', outline:'none', backgroundColor:'#fafafa', fontFamily:'inherit', width:'100%', boxSizing:'border-box', cursor:'pointer' },
  btn:        { padding:'8px 16px', borderRadius:'8px', border:'1.5px solid #7b2d8b', backgroundColor:'#fff', color:'#7b2d8b', fontSize:'13px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap' },
  backBtn: { padding:'6px 14px', borderRadius:'8px', border:'1.5px solid #ddd', backgroundColor:'#fff', color:'#555', fontSize:'13px', fontWeight:'600', cursor:'pointer' },
  btnPrimary: { padding:'9px 18px', borderRadius:'8px', border:'none', backgroundColor:'#7b2d8b', color:'#fff', fontSize:'13px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap' },
  smallBtn:   { padding:'5px 12px', borderRadius:'6px', border:'1.5px solid #ddd', backgroundColor:'#fff', color:'#555', fontSize:'12px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap' },
  errBox:     { display:'flex', alignItems:'center', gap:'8px', backgroundColor:'#fff5f5', color:'#c0392b', padding:'10px 14px', borderRadius:'8px', fontSize:'13px', border:'1px solid #fecaca', marginBottom:'10px' },
};

if (!document.getElementById('admin-dash-styles')) {
  const tag = document.createElement('style');
  tag.id = 'admin-dash-styles';
  tag.innerHTML = `@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`;
  document.head.appendChild(tag);
}

export default AdminDashboard;