// src/pages/AdminDashboard.jsx
// Placeholder - Person A will build this
import React from 'react';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🛡️ Admin Dashboard</h1>
      <p style={styles.sub}>Welcome, {user?.id}</p>
      <p style={styles.roles}>Roles: {user?.roles?.join(', ')}</p>
      <button onClick={logout} style={styles.button}>Logout</button>
    </div>
  );
};
const styles = {
  container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f0f5' },
  title: { color: '#7b2d8b', fontSize: '28px' },
  sub: { color: '#444', fontSize: '16px' },
  roles: { color: '#888', fontSize: '14px' },
  button: { marginTop: '20px', padding: '10px 24px', backgroundColor: '#7b2d8b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }
};
export default AdminDashboard;