// src/pages/Login.jsx
// Login page for all users
// All roles (Admin, Dispatcher, Victim, Volunteer) log in from here
// After successful login, user is redirected to their role-based dashboard
// Uses AuthContext to store token and user info globally
// readOnly trick prevents Chrome autofill from injecting saved values
// Includes forgot password flow — public endpoint, no JWT needed
// Includes emergency request flow — public endpoint, no JWT needed
//   Step 1: user_id + email + role selection (Victim / Volunteer / Admin / Dispatcher)
//   Step 2: note + location
//           + emergency_contact only when role is Victim/Admin/Dispatcher AND not yet a Victim
//           Volunteer never asked — backend reuses their Emergency_contact from Volunteer table
//   Endpoint routing:
//     Victim     → POST /api/victim/emergency
//     Volunteer  → POST /api/victim/emergency/volunteer
//     Admin      → POST /api/victim/emergency/admin
//     Dispatcher → POST /api/victim/emergency/dispatcher

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import {
  FaEye, FaEyeSlash, FaShieldAlt,
  FaUser, FaLock, FaSignInAlt,
  FaKey, FaEnvelope, FaExclamationTriangle,
  FaMapMarkerAlt, FaStickyNote, FaPhone,
  FaArrowLeft, FaPaperPlane,
  FaUserShield, FaHeadset, FaHandsHelping
} from 'react-icons/fa';

// ── Emergency flow steps ─────────────────────────────────
// 'identity'  → enter user_id + email
// 'details'   → enter note + location (+ emergency_contact if needed)
// 'success'   → confirmation screen

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  // ── Login state ──────────────────────────────────────
  const [formData, setFormData] = useState({ user_id: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  // Starts as readOnly to block Chrome autofill — switches to editable after 200ms
  const [readOnly, setReadOnly] = useState(true);
  useEffect(() => {
    setTimeout(() => setReadOnly(false), 200);
  }, []);

  // ── Screen state ─────────────────────────────────────
  // 'login' | 'forgot' | 'emergency'
  const [screen, setScreen] = useState('login');

  // ── Forgot password state ────────────────────────────
  const [forgotData, setForgotData] = useState({ user_id: '', email: '' });
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // ── Emergency state ──────────────────────────────────
  const [emergencyStep, setEmergencyStep] = useState('identity'); // 'identity' | 'details' | 'success'
  const [emergencyIdentity, setEmergencyIdentity] = useState({ user_id: '', email: '' });
  // selectedRole: which public emergency endpoint to hit
  // 'Victim' | 'Volunteer' | 'Admin' | 'Dispatcher'
  const [selectedRole, setSelectedRole] = useState('Victim');
  const [emergencyDetails, setEmergencyDetails] = useState({
    note: '',
    location: '',
    emergency_contact: ''
    // emergency_contact rules by role:
    //   Victim     — asked only if not yet registered as a Victim (backend 400 tells us)
    //   Volunteer  — NEVER asked — backend reuses Emergency_contact from Volunteer table
    //   Admin      — asked only if not yet registered as a Victim
    //   Dispatcher — asked only if not yet registered as a Victim
  });
  // Admin and Dispatcher need emergency_contact UNLESS they are already in the Victim table.
  // alreadyVictim is set by the verify-identity response in Step 1.
  // Victim and Volunteer never need it on this form.
  const [alreadyVictim, setAlreadyVictim] = useState(false);
  const needsEmergencyContact =
    (selectedRole === 'Admin' || selectedRole === 'Dispatcher') && !alreadyVictim;
  const [emergencyError, setEmergencyError] = useState('');
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyRequestId, setEmergencyRequestId] = useState('');

  // ── Login handlers ───────────────────────────────────
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.user_id || !formData.password) {
      setError('Both User ID and Password are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await API.post('/auth/login', {
        user_id: formData.user_id,
        password: formData.password
      });
      const { token } = response.data;
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const userData = JSON.parse(window.atob(base64));
      login(token, userData);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password handlers ─────────────────────────
  const handleForgotChange = (e) => {
    setForgotData({ ...forgotData, [e.target.name]: e.target.value });
    setForgotError('');
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotData.user_id || !forgotData.email) {
      setForgotError('Both User ID and email are required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotData.email)) {
      setForgotError('Invalid email format');
      return;
    }
    setForgotLoading(true);
    setForgotError('');
    try {
      const response = await API.post('/password-recovery/forgot', {
        user_id: forgotData.user_id,
        email:   forgotData.email
      });
      setForgotSuccess(response.data.message);
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Request failed. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setScreen('login');
    setForgotError('');
    setForgotSuccess('');
    setForgotData({ user_id: '', email: '' });
    // Re-arm readOnly so Chrome autofill can't inject into login fields on return
    setFormData({ user_id: '', password: '' });
    setReadOnly(true);
    setTimeout(() => setReadOnly(false), 200);
  };

  // ── Emergency handlers ───────────────────────────────

  // Step 1: verify identity (user_id + email + role)
  // Makes a real API call with intentionally short note/location so the backend
  // runs its identity check first. Response codes tell us:
  //   404 → wrong user_id/email combination
  //   403 → wrong role for this endpoint
  //   400 with note/location message → identity passed, safe to go to step 2
  //   any 2xx → identity passed AND request submitted (edge case, treat as success)
  const handleEmergencyIdentityChange = (e) => {
    setEmergencyIdentity({ ...emergencyIdentity, [e.target.name]: e.target.value });
    setEmergencyError('');
  };

  const handleEmergencyIdentityNext = async (e) => {
    e.preventDefault();
    const { user_id, email } = emergencyIdentity;

    // Client-side format checks first
    if (!user_id.trim()) {
      setEmergencyError('User ID is required');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmergencyError('A valid email is required');
      return;
    }

    // Call the dedicated verify-identity endpoint — clean read-only check.
    // Returns:
    //   200 → user_id + email correct AND role matches → go to step 2
    //   404 → wrong user_id / email combination
    //   403 → identity correct but wrong role selected
    //   400 → missing/invalid fields (shouldn't happen given our client checks above)
    setEmergencyLoading(true);
    setEmergencyError('');
    try {
      const res = await API.post('/victim/verify-identity', {
        user_id: user_id.trim(),
        email:   email.trim(),
        role:    selectedRole,
      }, { validateStatus: () => true });

      const status = res.status;
      const msg    = res.data?.message || '';

      if (status === 200) {
        // Identity and role confirmed — read already_victim flag for Admin/Dispatcher
        setAlreadyVictim(res.data?.already_victim === true);
        setEmergencyStep('details');
        return;
      }

      if (status === 404) {
        setEmergencyError('No account found with this User ID and email combination.');
        return;
      }

      if (status === 403) {
        setEmergencyError(msg || `This User ID is not registered as a ${selectedRole}. Please select the correct role.`);
        return;
      }

      // Fallback
      setEmergencyError(msg || 'Verification failed. Please try again.');
    } catch (err) {
      setEmergencyError('Could not reach the server. Please check your connection.');
    } finally {
      setEmergencyLoading(false);
    }
  };

  // Step 2: collect note + location (+ emergency_contact if needed)
  const handleEmergencyDetailsChange = (e) => {
    setEmergencyDetails({ ...emergencyDetails, [e.target.name]: e.target.value });
    setEmergencyError('');
  };

  // Map role → API endpoint
  const emergencyEndpoint = {
    Victim:     '/victim/emergency',
    Volunteer:  '/victim/emergency/volunteer',
    Admin:      '/victim/emergency/admin',
    Dispatcher: '/victim/emergency/dispatcher',
  };

  const handleEmergencySubmit = async (e) => {
    e.preventDefault();
    const { note, location, emergency_contact } = emergencyDetails;

    // Client-side validation — mirrors backend rules
    if (!note.trim() || note.trim().length < 5) {
      setEmergencyError('Please describe your situation (at least 5 characters)');
      return;
    }
    if (!location.trim() || location.trim().length < 10) {
      setEmergencyError('Please provide a detailed location (at least 10 characters)');
      return;
    }
    // emergency_contact validation — only relevant for roles that might need it
    // Volunteer never needs it; for others it only appears after backend triggers it
    if (needsEmergencyContact) {
      if (!emergency_contact.trim()) {
        setEmergencyError('Emergency contact is required');
        return;
      }
      if (!/^\d{10,11}$/.test(emergency_contact)) {
        setEmergencyError('Emergency contact must be 10 or 11 digits');
        return;
      }
      if (!emergency_contact.startsWith('03')) {
        setEmergencyError('Emergency contact must start with 03');
        return;
      }
    }

    setEmergencyLoading(true);
    setEmergencyError('');

    try {
      const payload = {
        user_id:  emergencyIdentity.user_id,
        email:    emergencyIdentity.email,
        note:     note.trim(),
        location: location.trim(),
      };
      // Only attach emergency_contact for Admin and Dispatcher
      if (needsEmergencyContact && emergency_contact.trim()) {
        payload.emergency_contact = emergency_contact.trim();
      }

      const endpoint = emergencyEndpoint[selectedRole];
      const response = await API.post(endpoint, payload);
      setEmergencyRequestId(response.data.request_id || '');
      setEmergencyStep('success');

    } catch (err) {
      const msg = err.response?.data?.message || '';

      setEmergencyError(msg || 'Request failed. Please try again.');
    } finally {
      setEmergencyLoading(false);
    }
  };

  const resetEmergency = () => {
    setScreen('login');
    setEmergencyStep('identity');
    setEmergencyIdentity({ user_id: '', email: '' });
    setEmergencyDetails({ note: '', location: '', emergency_contact: '' });
    setSelectedRole('Victim');
    setAlreadyVictim(false);
    setEmergencyError('');
    setEmergencyRequestId('');
    // Re-arm readOnly so Chrome autofill can't inject into login fields on return
    setFormData({ user_id: '', password: '' });
    setReadOnly(true);
    setTimeout(() => setReadOnly(false), 200);
  };

  // ── Input wrapper style ──────────────────────────────
  const getInputWrapperStyle = (fieldName) => ({
    ...styles.inputWrapper,
    border: focusedField === fieldName
      ? '1.5px solid #7b2d8b'
      : '1.5px solid #e0e0e0',
    boxShadow: focusedField === fieldName
      ? '0 0 0 3px rgba(123, 45, 139, 0.08)'
      : 'none',
  });

  // ── Reusable field ───────────────────────────────────
  const renderField = (label, name, type, placeholder, icon, stateObj, changeFn, disabled = false) => (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>{label}</label>
      <div style={getInputWrapperStyle(name)}>
        {React.cloneElement(icon, {
          size: 13,
          color: focusedField === name ? '#7b2d8b' : '#bbb',
          style: styles.leftIcon
        })}
        <input
          type={type}
          name={name}
          value={stateObj[name]}
          onChange={changeFn}
          onFocus={() => setFocusedField(name)}
          onBlur={() => setFocusedField(null)}
          placeholder={placeholder}
          style={styles.input}
          disabled={disabled}
          autoComplete="off"
        />
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.blobTopLeft} />
      <div style={styles.blobBottomRight} />

      <div style={styles.card}>

        {/* ══════════════════════════════════════════════
            EMERGENCY FLOW
        ══════════════════════════════════════════════ */}
        {screen === 'emergency' && (
          <>
            {/* Step 1 — Identity */}
            {emergencyStep === 'identity' && (
              <>
                <div style={styles.header}>
                  <div style={{ ...styles.iconWrapper, background: 'linear-gradient(135deg, #c0392b, #e74c3c)' }}>
                    <FaExclamationTriangle size={26} color="#ffffff" />
                  </div>
                  <h1 style={styles.title}>Emergency Request</h1>
                  <p style={styles.subtitle}>
                    Submit an emergency request without logging in
                  </p>
                </div>

                {emergencyError && (
                  <div style={styles.errorBox}>
                    <span style={styles.errorDot}>●</span>
                    {emergencyError}
                  </div>
                )}

                {/* Step indicator */}
                <div style={emergencyStyles.stepBar}>
                  <div style={{ ...emergencyStyles.step, ...emergencyStyles.stepActive }}>
                    <span style={emergencyStyles.stepNum}>1</span>
                    <span style={emergencyStyles.stepLabel}>Identity</span>
                  </div>
                  <div style={emergencyStyles.stepLine} />
                  <div style={emergencyStyles.step}>
                    <span style={{ ...emergencyStyles.stepNum, ...emergencyStyles.stepNumInactive }}>2</span>
                    <span style={{ ...emergencyStyles.stepLabel, color: '#bbb' }}>Details</span>
                  </div>
                </div>

                <form onSubmit={handleEmergencyIdentityNext} style={styles.form} autoComplete="off">

                  {/* Role selector — determines which public endpoint is called */}
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>I am a...</label>
                    <div style={emergencyStyles.roleGrid}>
                      {[
                        { role: 'Victim',     icon: <FaUser />,         label: 'Victim' },
                        { role: 'Volunteer',  icon: <FaHandsHelping />, label: 'Volunteer' },
                        { role: 'Admin',      icon: <FaUserShield />,   label: 'Admin' },
                        { role: 'Dispatcher', icon: <FaHeadset />,      label: 'Dispatcher' },
                      ].map(({ role, icon, label }) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => { setSelectedRole(role); setEmergencyError(''); }}
                          style={{
                            ...emergencyStyles.roleBtn,
                            ...(selectedRole === role ? emergencyStyles.roleBtnActive : {})
                          }}
                        >
                          {React.cloneElement(icon, {
                            size: 16,
                            color: selectedRole === role ? '#c0392b' : '#aaa'
                          })}
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            color: selectedRole === role ? '#c0392b' : '#888',
                            userSelect: 'none',
                          }}>
                            {label}
                          </span>
                        </button>
                      ))}
                    </div>
                    {/* Volunteer hint */}
                    {selectedRole === 'Volunteer' && (
                      <p style={emergencyStyles.roleHint}>
                        ✓ Your emergency contact from your volunteer profile will be used automatically
                      </p>
                    )}
                  </div>

                  {renderField(
                    'Your User ID', 'user_id', 'text', 'Enter your User ID',
                    <FaUser />, emergencyIdentity, handleEmergencyIdentityChange
                  )}
                  {renderField(
                    'Registered Email', 'email', 'email', 'Enter your registered email',
                    <FaEnvelope />, emergencyIdentity, handleEmergencyIdentityChange
                  )}

                  <button
                    type="submit"
                    style={emergencyLoading ? emergencyStyles.redButtonDisabled : emergencyStyles.redButton}
                    disabled={emergencyLoading}
                  >
                    {emergencyLoading ? (
                      <span style={styles.buttonContent}>
                        <span style={styles.spinner} /> Verifying...
                      </span>
                    ) : (
                      <span style={styles.buttonContent}>
                        Continue →
                      </span>
                    )}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={resetEmergency}
                  style={forgotStyles.backButton}
                >
                  <FaArrowLeft size={11} style={{ marginRight: '5px' }} />
                  Back to Login
                </button>
              </>
            )}

            {/* Step 2 — Details */}
            {emergencyStep === 'details' && (
              <>
                <div style={styles.header}>
                  <div style={{ ...styles.iconWrapper, background: 'linear-gradient(135deg, #c0392b, #e74c3c)' }}>
                    <FaExclamationTriangle size={26} color="#ffffff" />
                  </div>
                  <h1 style={styles.title}>Emergency Request</h1>
                  <p style={styles.subtitle}>Describe your situation and location</p>
                </div>

                {emergencyError && (
                  <div style={styles.errorBox}>
                    <span style={styles.errorDot}>●</span>
                    {emergencyError}
                  </div>
                )}

                {/* Step indicator */}
                <div style={emergencyStyles.stepBar}>
                  <div style={emergencyStyles.step}>
                    <span style={{ ...emergencyStyles.stepNum, background: '#4caf50' }}>✓</span>
                    <span style={emergencyStyles.stepLabel}>Identity</span>
                  </div>
                  <div style={{ ...emergencyStyles.stepLine, background: '#c0392b' }} />
                  <div style={{ ...emergencyStyles.step, ...emergencyStyles.stepActive }}>
                    <span style={{ ...emergencyStyles.stepNum, background: '#c0392b' }}>2</span>
                    <span style={emergencyStyles.stepLabel}>Details</span>
                  </div>
                </div>

                <form onSubmit={handleEmergencySubmit} style={styles.form} autoComplete="off">

                  {/* Note / situation */}
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Describe Your Situation</label>
                    <div style={{
                      ...getInputWrapperStyle('note'),
                      alignItems: 'flex-start',
                      height: 'auto'
                    }}>
                      <FaStickyNote
                        size={13}
                        color={focusedField === 'note' ? '#c0392b' : '#bbb'}
                        style={{ ...styles.leftIcon, top: '14px' }}
                      />
                      <textarea
                        name="note"
                        value={emergencyDetails.note}
                        onChange={handleEmergencyDetailsChange}
                        onFocus={() => setFocusedField('note')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Briefly describe what is happening (min 5 characters)"
                        style={{ ...styles.input, paddingTop: '12px', paddingBottom: '12px', resize: 'vertical', minHeight: '80px' }}
                        disabled={emergencyLoading}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Your Current Location</label>
                    <div style={getInputWrapperStyle('location')}>
                      <FaMapMarkerAlt
                        size={13}
                        color={focusedField === 'location' ? '#c0392b' : '#bbb'}
                        style={styles.leftIcon}
                      />
                      <input
                        type="text"
                        name="location"
                        value={emergencyDetails.location}
                        onChange={handleEmergencyDetailsChange}
                        onFocus={() => setFocusedField('location')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="House no, street, area, city (min 10 characters)"
                        style={styles.input}
                        disabled={emergencyLoading}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  {/* Emergency contact — always shown for Admin and Dispatcher */}
                  {needsEmergencyContact && (
                    <div style={styles.fieldGroup}>
                      <label style={styles.label}>Emergency Contact</label>
                      <div style={getInputWrapperStyle('emergency_contact')}>
                        <FaPhone
                          size={13}
                          color={focusedField === 'emergency_contact' ? '#c0392b' : '#bbb'}
                          style={styles.leftIcon}
                        />
                        <input
                          type="text"
                          name="emergency_contact"
                          value={emergencyDetails.emergency_contact}
                          onChange={handleEmergencyDetailsChange}
                          onFocus={() => setFocusedField('emergency_contact')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="03001234567"
                          style={styles.input}
                          disabled={emergencyLoading}
                          autoComplete="off"
                          maxLength={11}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    style={emergencyLoading ? emergencyStyles.redButtonDisabled : emergencyStyles.redButton}
                    disabled={emergencyLoading}
                  >
                    {emergencyLoading ? (
                      <span style={styles.buttonContent}>
                        <span style={styles.spinner} /> Submitting...
                      </span>
                    ) : (
                      <span style={styles.buttonContent}>
                        <FaPaperPlane size={13} /> Submit Emergency Request
                      </span>
                    )}
                  </button>

                  {/* Back to step 1 */}
                  <button
                    type="button"
                    onClick={() => { setEmergencyStep('identity'); setEmergencyError(''); }}
                    style={forgotStyles.backButton}
                  >
                    <FaArrowLeft size={11} style={{ marginRight: '5px' }} />
                    Back
                  </button>

                </form>
              </>
            )}

            {/* Step 3 — Success */}
            {emergencyStep === 'success' && (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ fontSize: '52px', marginBottom: '12px' }}>🚨</div>
                <h2 style={{ ...forgotStyles.successTitle, color: '#c0392b' }}>
                  Request Submitted!
                </h2>
                <p style={forgotStyles.successText}>
                  A dispatcher has been notified and is on their way.
                </p>

                {emergencyRequestId && (
                  <div style={emergencyStyles.requestIdBox}>
                    <p style={emergencyStyles.requestIdLabel}>REQUEST ID</p>
                    <p style={emergencyStyles.requestIdValue}>{emergencyRequestId}</p>
                    <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
                      Save this for reference
                    </p>
                  </div>
                )}

                <div style={{ ...forgotStyles.infoBox, borderColor: 'rgba(192, 57, 43, 0.2)', marginBottom: '20px' }}>
                  <p style={forgotStyles.infoText}>
                    📋 A dispatcher has been assigned and will respond shortly.
                    If you are in immediate danger, also call <strong>1122</strong> (Rescue) or <strong>15</strong> (Police).
                  </p>
                </div>

                <button onClick={resetEmergency} style={styles.button}>
                  <span style={styles.buttonContent}>← Back to Login</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════
            FORGOT PASSWORD SCREEN
        ══════════════════════════════════════════════ */}
        {screen === 'forgot' && (
          <>
            <div style={styles.header}>
              <div style={styles.iconWrapper}>
                <FaKey size={28} color="#ffffff" />
              </div>
              <h1 style={styles.title}>Forgot Password?</h1>
              <p style={styles.subtitle}>
                Enter your User ID and email to submit a recovery request
              </p>
            </div>

            {forgotError && (
              <div style={styles.errorBox}>
                <span style={styles.errorDot}>●</span>
                {forgotError}
              </div>
            )}

            {forgotSuccess ? (
              <div style={forgotStyles.successBox}>
                <div style={forgotStyles.successIcon}>✅</div>
                <p style={forgotStyles.successTitle}>Request Submitted!</p>
                <p style={forgotStyles.successText}>
                  Your password recovery request has been sent to an admin.
                </p>
                <div style={forgotStyles.infoBox}>
                  <p style={forgotStyles.infoText}>
                    📋 The admin will verify your identity and reset your password.
                    They will share the new password with you directly.
                    You can then log in and change it.
                  </p>
                </div>
                <button onClick={handleBackToLogin} style={styles.button}>
                  <span style={styles.buttonContent}>← Back to Login</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} style={styles.form} autoComplete="off">
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>User ID</label>
                  <div style={getInputWrapperStyle('forgot_user_id')}>
                    <FaUser
                      size={13}
                      color={focusedField === 'forgot_user_id' ? '#7b2d8b' : '#bbb'}
                      style={styles.leftIcon}
                    />
                    <input
                      type="text"
                      name="user_id"
                      value={forgotData.user_id}
                      onChange={handleForgotChange}
                      onFocus={() => setFocusedField('forgot_user_id')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Enter your User ID"
                      style={styles.input}
                      disabled={forgotLoading}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Registered Email</label>
                  <div style={getInputWrapperStyle('forgot_email')}>
                    <FaEnvelope
                      size={13}
                      color={focusedField === 'forgot_email' ? '#7b2d8b' : '#bbb'}
                      style={styles.leftIcon}
                    />
                    <input
                      type="email"
                      name="email"
                      value={forgotData.email}
                      onChange={handleForgotChange}
                      onFocus={() => setFocusedField('forgot_email')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Enter your registered email"
                      style={styles.input}
                      disabled={forgotLoading}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  style={forgotLoading ? styles.buttonDisabled : styles.button}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <span style={styles.buttonContent}>
                      <span style={styles.spinner} /> Submitting...
                    </span>
                  ) : (
                    <span style={styles.buttonContent}>
                      <FaKey size={14} /> Submit Recovery Request
                    </span>
                  )}
                </button>

                <button type="button" onClick={handleBackToLogin} style={forgotStyles.backButton}>
                  <FaArrowLeft size={11} style={{ marginRight: '5px' }} />
                  Back to Login
                </button>
              </form>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════
            NORMAL LOGIN SCREEN
        ══════════════════════════════════════════════ */}
        {screen === 'login' && (
          <>
            <div style={styles.header}>
              <div style={styles.iconWrapper}>
                <FaShieldAlt size={32} color="#ffffff" />
              </div>
              <h1 style={styles.title}>Women Protection Services</h1>
              <p style={styles.subtitle}>Sign in to continue to your dashboard</p>
            </div>

            {error && (
              <div style={styles.errorBox}>
                <span style={styles.errorDot}>●</span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={styles.form} autoComplete="off">
              <div style={styles.fieldGroup}>
                <label style={styles.label}>User ID</label>
                <div style={getInputWrapperStyle('user_id')}>
                  <FaUser
                    size={13}
                    color={focusedField === 'user_id' ? '#7b2d8b' : '#bbb'}
                    style={styles.leftIcon}
                  />
                  <input
                    type="text"
                    name="user_id"
                    value={formData.user_id}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('user_id')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter your User ID"
                    style={styles.input}
                    disabled={loading}
                    autoComplete="off"
                    readOnly={readOnly}
                  />
                </div>
              </div>

              <div style={styles.fieldGroup}>
                <div style={styles.passwordLabelRow}>
                  <label style={styles.label}>Password</label>
                  <button
                    type="button"
                    onClick={() => setScreen('forgot')}
                    style={forgotStyles.forgotLink}
                  >
                    Forgot password?
                  </button>
                </div>
                <div style={getInputWrapperStyle('password')}>
                  <FaLock
                    size={13}
                    color={focusedField === 'password' ? '#7b2d8b' : '#bbb'}
                    style={styles.leftIcon}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter your password"
                    style={styles.input}
                    disabled={loading}
                    autoComplete="off"
                    readOnly={readOnly}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    tabIndex={-1}
                  >
                    {showPassword
                      ? <FaEyeSlash size={15} color="#aaa" />
                      : <FaEye size={15} color="#aaa" />
                    }
                  </button>
                </div>
              </div>

              <button
                type="submit"
                style={loading ? styles.buttonDisabled : styles.button}
                disabled={loading}
              >
                {loading ? (
                  <span style={styles.buttonContent}>
                    <span style={styles.spinner} /> Signing in...
                  </span>
                ) : (
                  <span style={styles.buttonContent}>
                    <FaSignInAlt size={15} style={{ marginRight: '8px' }} />
                    Sign In
                  </span>
                )}
              </button>
            </form>

            {/* Emergency button — prominent, below login form */}
            <div style={emergencyStyles.emergencyBanner}>
              <div style={emergencyStyles.emergencyBannerInner}>
                <FaExclamationTriangle size={14} color="#c0392b" style={{ flexShrink: 0 }} />
                <span style={emergencyStyles.emergencyBannerText}>
                  In danger but can't log in?
                </span>
                <button
                  type="button"
                  onClick={() => { setScreen('emergency'); setEmergencyStep('identity'); }}
                  style={emergencyStyles.emergencyBannerBtn}
                >
                  Request Emergency Help
                </button>
              </div>
            </div>

            <div style={styles.divider}>
              <div style={styles.dividerLine} />
              <span style={styles.dividerText}>New to the platform?</span>
              <div style={styles.dividerLine} />
            </div>

            <Link to="/register" style={styles.registerButton}>
              Create Victim Account
            </Link>

            <p style={styles.footerNote}>
              🔒 Your data is protected and encrypted
            </p>
          </>
        )}

      </div>
    </div>
  );
};

// ── Main Styles ──────────────────────────────────────────
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    userSelect: 'none',
    cursor: 'default',
    backgroundColor: '#f5f0fb',
    backgroundImage: `radial-gradient(circle, rgba(123, 45, 139, 0.06) 1px, transparent 1px)`,
    backgroundSize: '28px 28px',
    position: 'relative',
    overflow: 'hidden',
  },
  blobTopLeft: {
    position: 'fixed',
    top: '-100px',
    left: '-100px',
    width: '350px',
    height: '350px',
    borderRadius: '50%',
    backgroundColor: 'rgba(123, 45, 139, 0.06)',
    filter: 'blur(80px)',
    pointerEvents: 'none',
  },
  blobBottomRight: {
    position: 'fixed',
    bottom: '-100px',
    right: '-100px',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    backgroundColor: 'rgba(123, 45, 139, 0.05)',
    filter: 'blur(90px)',
    pointerEvents: 'none',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '44px 40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 20px 60px rgba(123, 45, 139, 0.12)',
    border: '1px solid rgba(123, 45, 139, 0.08)',
    cursor: 'default',
    position: 'relative',
    zIndex: 1,
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  iconWrapper: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #7b2d8b, #b05cc0)',
    borderRadius: '50%',
    width: '64px',
    height: '64px',
    marginBottom: '16px',
    boxShadow: '0 4px 20px rgba(123, 45, 139, 0.3)',
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#2d2d2d',
    margin: '0 0 6px 0',
    cursor: 'default',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#999',
    margin: 0,
    cursor: 'default',
  },
  errorBox: {
    backgroundColor: '#fff5f5',
    color: '#c0392b',
    padding: '12px 14px',
    borderRadius: '10px',
    marginBottom: '20px',
    fontSize: '13px',
    border: '1px solid #fecaca',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  errorDot: {
    fontSize: '8px',
    color: '#e74c3c',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  passwordLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#555',
    cursor: 'default',
    userSelect: 'none',
    letterSpacing: '0.2px',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '10px',
    backgroundColor: '#fafafa',
    transition: 'border 0.2s, box-shadow 0.2s',
    overflow: 'hidden',
  },
  leftIcon: {
    position: 'absolute',
    left: '13px',
    pointerEvents: 'none',
    transition: 'color 0.2s',
  },
  input: {
    width: '100%',
    padding: '12px 44px 12px 38px',
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    backgroundColor: 'transparent',
    cursor: 'text',
    userSelect: 'text',
    boxSizing: 'border-box',
    color: '#333',
  },
  eyeButton: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    userSelect: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
  },
  button: {
    background: 'linear-gradient(135deg, #7b2d8b, #9b3dab)',
    color: '#ffffff',
    padding: '13px',
    borderRadius: '10px',
    border: 'none',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '6px',
    userSelect: 'none',
    boxShadow: '0 4px 15px rgba(123, 45, 139, 0.3)',
    transition: 'opacity 0.2s',
    width: '100%',
  },
  buttonDisabled: {
    background: 'linear-gradient(135deg, #c9a0d0, #d4b0db)',
    color: '#ffffff',
    padding: '13px',
    borderRadius: '10px',
    border: 'none',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'not-allowed',
    marginTop: '6px',
    userSelect: 'none',
    width: '100%',
  },
  buttonContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.4)',
    borderTop: '2px solid #ffffff',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 0.8s linear infinite',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: '24px 0 16px',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: '#f0e6f5',
  },
  dividerText: {
    fontSize: '12px',
    color: '#bbb',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  registerButton: {
    display: 'block',
    textAlign: 'center',
    padding: '12px',
    borderRadius: '10px',
    border: '1.5px solid #7b2d8b',
    color: '#7b2d8b',
    fontSize: '14px',
    fontWeight: '600',
    textDecoration: 'none',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background 0.2s',
  },
  footerNote: {
    textAlign: 'center',
    marginTop: '20px',
    fontSize: '12px',
    color: '#bbb',
    cursor: 'default',
    userSelect: 'none',
  },
};

// ── Forgot Password Styles ───────────────────────────────
const forgotStyles = {
  forgotLink: {
    background: 'none',
    border: 'none',
    color: '#7b2d8b',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
    userSelect: 'none',
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#999',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '8px 0 0 0',
    textAlign: 'center',
    userSelect: 'none',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBox: {
    textAlign: 'center',
    padding: '10px 0',
  },
  successIcon: {
    fontSize: '44px',
    marginBottom: '12px',
  },
  successTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#2d2d2d',
    margin: '0 0 8px 0',
    cursor: 'default',
  },
  successText: {
    fontSize: '13px',
    color: '#555',
    margin: '0 0 16px 0',
    cursor: 'default',
  },
  infoBox: {
    backgroundColor: '#f5f0fb',
    border: '1px solid rgba(123, 45, 139, 0.15)',
    borderRadius: '10px',
    padding: '14px 16px',
    marginBottom: '24px',
  },
  infoText: {
    fontSize: '12px',
    color: '#666',
    margin: 0,
    lineHeight: '1.7',
    cursor: 'default',
    userSelect: 'none',
  },
};

// ── Emergency Styles ─────────────────────────────────────
const emergencyStyles = {
  // Banner on the login screen
  emergencyBanner: {
    marginTop: '20px',
    borderRadius: '10px',
    border: '1.5px solid rgba(192, 57, 43, 0.25)',
    backgroundColor: '#fff9f9',
    padding: '10px 14px',
  },
  emergencyBannerInner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  emergencyBannerText: {
    fontSize: '12px',
    color: '#c0392b',
    fontWeight: '600',
    flex: 1,
    minWidth: '120px',
    userSelect: 'none',
  },
  emergencyBannerBtn: {
    background: 'linear-gradient(135deg, #c0392b, #e74c3c)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '7px 12px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(192, 57, 43, 0.3)',
  },
  // Step bar
  stepBar: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '24px',
    padding: '0 10px',
  },
  step: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  stepActive: {},
  stepNum: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#c0392b',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
  },
  stepNumInactive: {
    background: '#e0e0e0',
    color: '#aaa',
  },
  stepLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#555',
    userSelect: 'none',
  },
  stepLine: {
    flex: 1,
    height: '2px',
    background: '#e0e0e0',
    margin: '0 8px',
    marginBottom: '16px',
  },
  // Red primary button
  redButton: {
    background: 'linear-gradient(135deg, #c0392b, #e74c3c)',
    color: '#ffffff',
    padding: '13px',
    borderRadius: '10px',
    border: 'none',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '6px',
    userSelect: 'none',
    boxShadow: '0 4px 15px rgba(192, 57, 43, 0.3)',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  redButtonDisabled: {
    background: 'linear-gradient(135deg, #e8a09a, #f0b8b3)',
    color: '#ffffff',
    padding: '13px',
    borderRadius: '10px',
    border: 'none',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'not-allowed',
    marginTop: '6px',
    userSelect: 'none',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  // Emergency contact required note
  requiredNote: {
    fontWeight: '400',
    fontSize: '11px',
    color: '#e74c3c',
  },
  // Success screen request ID box
  requestIdBox: {
    backgroundColor: '#fff5f5',
    border: '2px dashed #e74c3c',
    borderRadius: '12px',
    padding: '16px',
    margin: '0 0 16px 0',
  },
  requestIdLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#aaa',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    margin: '0 0 6px 0',
    userSelect: 'none',
  },
  requestIdValue: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#c0392b',
    letterSpacing: '2px',
    margin: '0 0 4px 0',
    cursor: 'text',
    userSelect: 'text',
    wordBreak: 'break-all',
  },
  // Role selector grid — 2x2 on step 1
  roleGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  roleBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '12px 8px',
    borderRadius: '10px',
    border: '1.5px solid #e0e0e0',
    backgroundColor: '#fafafa',
    cursor: 'pointer',
    transition: 'border 0.15s, background 0.15s',
    userSelect: 'none',
  },
  roleBtnActive: {
    border: '1.5px solid #c0392b',
    backgroundColor: '#fff5f5',
    boxShadow: '0 0 0 3px rgba(192, 57, 43, 0.08)',
  },
  // Small hint text below role grid
  roleHint: {
    fontSize: '11px',
    color: '#4caf50',
    margin: '4px 0 0 0',
    userSelect: 'none',
    fontWeight: '500',
  },
};

// Inject spinner + autofill styles
const styleTag = document.createElement('style');
styleTag.innerHTML = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  input::placeholder, textarea::placeholder {
    color: #ccc;
    font-size: 13px;
  }
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0px 1000px #fafafa inset !important;
    -webkit-text-fill-color: #333 !important;
    transition: background-color 5000s ease-in-out 0s;
  }
`;
document.head.appendChild(styleTag);

export default Login;