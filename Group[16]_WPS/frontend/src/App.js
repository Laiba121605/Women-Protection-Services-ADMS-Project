// src/App.jsx
// This is the main routing file for the entire application
// It defines all routes and which roles can access them
// It wraps everything in AuthProvider so all pages have access to auth state

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Auth Context Provider — wraps entire app
import { AuthProvider } from './context/AuthContext';

// Protected Route Component — guards routes by role
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import VictimDashboard from './pages/VictimDashboard';
import VolunteerDashboard from './pages/VolunteerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DispatcherDashboard from './pages/DispatcherDashboard';

// This component decides where to send user after login
// based on their role from the JWT token
import RoleRedirect from './components/RoleRedirect';

const App = () => {
  return (
    // AuthProvider wraps everything so all pages can access user/token
    <AuthProvider>
      <Router>
        <Routes>

          {/* ── Public Routes (no login required) ── */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* ── Role Redirect after login ── */}
          {/* Sends user to correct dashboard based on their role */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['Admin', 'Dispatcher', 'Victim', 'Volunteer']}>
              <RoleRedirect />
            </ProtectedRoute>
          } />

          {/* ── Victim Dashboard ── */}
          {/* Only users with Victim role can access */}
          <Route path="/victim" element={
            <ProtectedRoute allowedRoles={['Victim']}>
              <VictimDashboard />
            </ProtectedRoute>
          } />

          {/* ── Volunteer Dashboard ── */}
          {/* Only users with Volunteer role can access */}
          <Route path="/volunteer" element={
            <ProtectedRoute allowedRoles={['Volunteer']}>
              <VolunteerDashboard />
            </ProtectedRoute>
          } />

          {/* ── Admin Dashboard ── */}
          {/* Only users with Admin role can access */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['Admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* ── Dispatcher Dashboard ── */}
          {/* Only users with Dispatcher role can access */}
          <Route path="/dispatcher" element={
            <ProtectedRoute allowedRoles={['Dispatcher']}>
              <DispatcherDashboard />
            </ProtectedRoute>
          } />

          {/* ── Default Route ── */}
          {/* Anyone hitting / gets sent to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* ── 404 Catch All ── */}
          {/* Any unknown route goes to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;