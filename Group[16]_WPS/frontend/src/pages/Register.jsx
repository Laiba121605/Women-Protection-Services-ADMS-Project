// src/pages/Register.jsx
// Registration page — only for new Victims self-registering
// Admins can create other roles (Dispatcher, Volunteer, Admin) from admin dashboard
// On success, shows User ID screen — user must click proceed themselves
// autoComplete fully disabled via hidden fake fields + useEffect clear

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import {
  FaShieldAlt, FaUser, FaEnvelope, FaLock,
  FaPhone, FaMapMarkerAlt, FaIdCard,
  FaCalendarAlt, FaEye, FaEyeSlash, FaUserPlus
} from 'react-icons/fa';

const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const emptyForm = {
    Name: '',
    Email: '',
    Phone_no: '',
    Address: '',
    Password: '',
    confirmPassword: '',
    Date_of_Birth: '',
    Emergency_contact: '',
    CNIC: ''
  };

  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [registeredUserId, setRegisteredUserId] = useState(null);
  const [copied, setCopied] = useState(false);

  // Force clear all fields on mount
  // Prevents browser from autofilling previous session data
  useEffect(() => {
    setTimeout(() => {
      setFormData(emptyForm);
    }, 100);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const validate = () => {
    const {
      Name, Email, Phone_no, Address, Password,
      confirmPassword, Date_of_Birth, Emergency_contact, CNIC
    } = formData;

    // ── All fields required ──────────────────────────────
    if (!Name || !Email || !Phone_no || !Address || !Password ||
        !Date_of_Birth || !Emergency_contact || !CNIC)
      return 'All fields are required';

    // ── Full name — must have first and last name ────────
    if (Name.trim().split(' ').filter(part => part.length > 0).length < 2)
      return 'Please enter your full name (first and last name)';

    // ── Name — letters and spaces only ──────────────────
    if (!/^[a-zA-Z\s]+$/.test(Name.trim()))
      return 'Name should only contain letters — no numbers or symbols';

    // ── Email format ─────────────────────────────────────
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(Email))
      return 'Invalid email format (e.g. name@gmail.com)';

    // ── Email max length — matches DB VARCHAR(100) ───────
    if (Email.length > 100)
      return 'Email must be less than 100 characters';

    // ── Phone — digits only ──────────────────────────────
    if (!/^\d+$/.test(Phone_no))
      return 'Phone number must contain digits only — no letters or symbols';

    // ── Phone — length check ─────────────────────────────
    if (Phone_no.length < 10 || Phone_no.length > 11)
      return 'Phone number must be 10 or 11 digits long';

    // ── Phone — must start with 03 ───────────────────────
    if (!Phone_no.startsWith('03'))
      return 'Phone number must start with 03 (e.g. 03001234567)';

    // ── Emergency contact — digits only ──────────────────
    if (!/^\d+$/.test(Emergency_contact))
      return 'Emergency contact must contain digits only — no letters or symbols';

    // ── Emergency contact — length check ─────────────────
    if (Emergency_contact.length < 10 || Emergency_contact.length > 11)
      return 'Emergency contact must be 10 or 11 digits long';

    // ── Emergency contact — must start with 03 ───────────
    if (!Emergency_contact.startsWith('03'))
      return 'Emergency contact must start with 03 (e.g. 03001234567)';

    // ── Emergency contact — cannot match phone ────────────
    if (Emergency_contact === Phone_no)
      return 'Emergency contact cannot be the same as your phone number';

    // ── CNIC — digits only ───────────────────────────────
    if (!/^\d+$/.test(CNIC))
      return 'CNIC must contain digits only — no letters or symbols';

    // ── CNIC — too short ─────────────────────────────────
    if (CNIC.length < 13)
      return 'CNIC is too short — must be exactly 13 digits';

    // ── CNIC — too long ──────────────────────────────────
    if (CNIC.length > 13)
      return 'CNIC is too long — must be exactly 13 digits';

    // ── CNIC — cannot be all same digits ─────────────────
    if (/^(\d)\1+$/.test(CNIC))
      return 'Please enter a valid CNIC number';

    // ── Address — minimum 10 characters ─────────────────
    if (Address.trim().length < 10)
      return 'Address is too short — please enter your complete address';

    // ── Address — max 150 characters matches DB ──────────
    if (Address.trim().length > 150)
      return 'Address is too long — must be less than 150 characters';

    // ── Password — length check ──────────────────────────
    if (Password.length < 8)
      return 'Password is too short — must be at least 8 characters';

    // ── Password — uppercase check ───────────────────────
    if (!/[A-Z]/.test(Password))
      return 'Password must contain at least one uppercase letter';

    // ── Password — number check ──────────────────────────
    if (!/[0-9]/.test(Password))
      return 'Password must contain at least one number';

    // ── Password — special character check ───────────────
    if (!/[!@#$%^&*]/.test(Password))
      return 'Password must contain at least one special character (!@#$%^&*)';

    // ── Passwords must match ─────────────────────────────
    if (Password !== confirmPassword)
      return 'Passwords do not match';

    // ── Date of birth — valid date ───────────────────────
    const dob = new Date(Date_of_Birth);
    if (isNaN(dob.getTime()))
      return 'Invalid date of birth';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ── Date of birth — cannot be today or future ────────
    if (dob >= today)
      return 'Date of birth cannot be today or in the future';

    // ── Must be at least 3 years old ────────────────────
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
    if (age < 3)
      return 'You must be at least 3 years old to register';

    return null; // all checks passed
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError('');

    try {
      // POST /api/auth/register
      // Returns { token, user_id, roles }
      const response = await API.post('/auth/register', {
        Name:              formData.Name,
        Email:             formData.Email,
        Phone_no:          formData.Phone_no,
        Address:           formData.Address,
        Password:          formData.Password,
        Date_of_Birth:     formData.Date_of_Birth,
        Emergency_contact: formData.Emergency_contact,
        CNIC:              formData.CNIC
      });

      const { token, user_id } = response.data;

      // Decode JWT to get user info
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const userData = JSON.parse(window.atob(base64));

      // Save to context and localStorage
      login(token, userData);

      // Show success screen — user must click proceed themselves
      setRegisteredUserId(user_id);

    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Copy User ID to clipboard with confirmation feedback
  const handleCopy = () => {
    navigator.clipboard.writeText(registeredUserId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Input wrapper style — highlights purple on focus
  const getInputWrapperStyle = (fieldName) => ({
    ...styles.inputWrapper,
    border: focusedField === fieldName
      ? '1.5px solid #7b2d8b'
      : '1.5px solid #e0e0e0',
    boxShadow: focusedField === fieldName
      ? '0 0 0 3px rgba(123, 45, 139, 0.08)'
      : 'none',
  });

  // Reusable field renderer
  const renderField = (label, name, type, placeholder, icon) => (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>{label}</label>
      <div style={getInputWrapperStyle(name)}>
        <span style={styles.leftIcon}>
          {React.cloneElement(icon, {
            size: 13,
            color: focusedField === name ? '#7b2d8b' : '#bbb'
          })}
        </span>
        <input
          type={type}
          name={name}
          value={formData[name]}
          onChange={handleChange}
          onFocus={() => setFocusedField(name)}
          onBlur={() => setFocusedField(null)}
          placeholder={placeholder}
          style={styles.input}
          disabled={loading}
          autoComplete="new-password"
          readOnly={false}
        />
      </div>
    </div>
  );

  // ── SUCCESS SCREEN ───────────────────────────────────────
  if (registeredUserId) {
    return (
      <div style={styles.container}>
        <div style={styles.blobTopLeft} />
        <div style={styles.blobBottomRight} />

        <div style={{ ...styles.card, maxWidth: '460px', textAlign: 'center' }}>

          <div style={successStyles.emojiWrapper}>✅</div>
          <h2 style={successStyles.title}>Account Created!</h2>
          <p style={successStyles.subtitle}>
            Welcome to Women Protection Services
          </p>

          <div style={successStyles.idBox}>
            <p style={successStyles.idLabel}>YOUR USER ID</p>
            <p style={successStyles.idValue}>{registeredUserId}</p>
            <p style={successStyles.idWarning}>
              ⚠️ Save this ID — you need it every time you log in
            </p>
          </div>

          <button onClick={handleCopy} style={successStyles.copyButton}>
            {copied ? '✅ Copied!' : '📋 Copy User ID'}
          </button>

          <button
            onClick={() => navigate('/victim')}
            style={successStyles.proceedButton}
          >
            I've saved my ID — Go to Dashboard →
          </button>

          <p style={successStyles.footerNote}>
            🔒 Your data is protected and encrypted
          </p>

        </div>
      </div>
    );
  }

  // ── REGISTRATION FORM ────────────────────────────────────
  return (
    <div style={styles.container}>
      <div style={styles.blobTopLeft} />
      <div style={styles.blobBottomRight} />

      <div style={styles.card}>

        <div style={styles.header}>
          <div style={styles.iconWrapper}>
            <FaShieldAlt size={32} color="#ffffff" />
          </div>
          <h1 style={styles.title}>Create Your Account</h1>
          <p style={styles.subtitle}>
            Register as a victim to access protection services
          </p>
        </div>

        {error && (
          <div style={styles.errorBox}>
            <span style={styles.errorDot}>●</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form} autoComplete="off">

          <input type="text"     style={{ display: 'none' }} autoComplete="username"     readOnly />
          <input type="password" style={{ display: 'none' }} autoComplete="new-password" readOnly />

          {/* Row 1 — Name + Email */}
          <div style={styles.row}>
            {renderField('Full Name', 'Name', 'text', 'First and last name', <FaUser />)}
            {renderField('Email', 'Email', 'email', 'your@email.com', <FaEnvelope />)}
          </div>

          {/* Row 2 — Phone + Emergency Contact */}
          <div style={styles.row}>
            {renderField('Phone Number', 'Phone_no', 'text', '03001234567', <FaPhone />)}
            {renderField('Emergency Contact', 'Emergency_contact', 'text', '03001234567', <FaPhone />)}
          </div>

          {/* Row 3 — CNIC + Date of Birth */}
          <div style={styles.row}>
            {renderField('CNIC', 'CNIC', 'text', '1234567890123', <FaIdCard />)}
            {renderField('Date of Birth', 'Date_of_Birth', 'date', '', <FaCalendarAlt />)}
          </div>

          {/* Address — full width */}
          {renderField('Address', 'Address', 'text', 'House no, street, area, city', <FaMapMarkerAlt />)}

          {/* Password */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <div style={getInputWrapperStyle('Password')}>
              <span style={styles.leftIcon}>
                <FaLock size={13} color={focusedField === 'Password' ? '#7b2d8b' : '#bbb'} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="Password"
                value={formData.Password}
                onChange={handleChange}
                onFocus={() => setFocusedField('Password')}
                onBlur={() => setFocusedField(null)}
                placeholder="Min 8 chars, uppercase, number, special char"
                style={styles.input}
                disabled={loading}
                autoComplete="new-password"
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

          {/* Confirm Password */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Confirm Password</label>
            <div style={getInputWrapperStyle('confirmPassword')}>
              <span style={styles.leftIcon}>
                <FaLock size={13} color={focusedField === 'confirmPassword' ? '#7b2d8b' : '#bbb'} />
              </span>
              <input
                type={showConfirm ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                onFocus={() => setFocusedField('confirmPassword')}
                onBlur={() => setFocusedField(null)}
                placeholder="Re-enter your password"
                style={styles.input}
                disabled={loading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={styles.eyeButton}
                tabIndex={-1}
              >
                {showConfirm
                  ? <FaEyeSlash size={15} color="#aaa" />
                  : <FaEye size={15} color="#aaa" />
                }
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            style={loading ? styles.buttonDisabled : styles.button}
            disabled={loading}
          >
            {loading ? (
              <span style={styles.buttonContent}>
                <span style={styles.spinner} /> Creating account...
              </span>
            ) : (
              <span style={styles.buttonContent}>
                <FaUserPlus size={15} /> Create Account
              </span>
            )}
          </button>

        </form>

        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>Already have an account?</span>
          <div style={styles.dividerLine} />
        </div>

        <Link to="/login" style={styles.loginButton}>
          Sign In Instead
        </Link>

        <p style={styles.footerNote}>
          🔒 Your data is protected and encrypted
        </p>

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
    padding: '40px 20px',
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
    maxWidth: '700px',
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
    fontSize: '22px',
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
    gap: '16px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
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
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    padding: '12px 44px 12px 38px',
    border: 'none',
    outline: 'none',
    fontSize: '13px',
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
  },
  buttonContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
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
  loginButton: {
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

// ── Success Screen Styles ────────────────────────────────
const successStyles = {
  emojiWrapper: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#2d2d2d',
    margin: '0 0 8px 0',
    cursor: 'default',
  },
  subtitle: {
    fontSize: '14px',
    color: '#999',
    margin: '0 0 28px 0',
    cursor: 'default',
  },
  idBox: {
    backgroundColor: '#f5f0fb',
    border: '2px dashed #7b2d8b',
    borderRadius: '14px',
    padding: '24px 20px',
    marginBottom: '16px',
  },
  idLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#aaa',
    margin: '0 0 10px 0',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    cursor: 'default',
  },
  idValue: {
    fontSize: '30px',
    fontWeight: '800',
    color: '#7b2d8b',
    margin: '0 0 12px 0',
    letterSpacing: '3px',
    cursor: 'text',
    userSelect: 'text',
  },
  idWarning: {
    fontSize: '12px',
    color: '#e74c3c',
    margin: 0,
    cursor: 'default',
    userSelect: 'none',
  },
  copyButton: {
    width: '100%',
    padding: '11px',
    borderRadius: '10px',
    border: '1.5px solid #7b2d8b',
    backgroundColor: 'transparent',
    color: '#7b2d8b',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '12px',
    userSelect: 'none',
  },
  proceedButton: {
    width: '100%',
    padding: '13px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #7b2d8b, #9b3dab)',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '20px',
    boxShadow: '0 4px 15px rgba(123, 45, 139, 0.3)',
    userSelect: 'none',
  },
  footerNote: {
    fontSize: '12px',
    color: '#bbb',
    cursor: 'default',
    userSelect: 'none',
    margin: 0,
  },
};

export default Register;