// src/components/RoleRedirect.jsx
// After login this component checks the user's roles
// and automatically sends them to the correct dashboard
// Handles dual role — Victim+Volunteer goes to a combined page
// Role priority: Admin > Dispatcher > Volunteer > Victim

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RoleRedirect = () => {

  // Get user from auth context
  const { user } = useAuth();

  // No user found, go to login
  if (!user) return <Navigate to="/login" replace />;

  const roles = user.roles || [];

  // Admin gets highest priority
  if (roles.includes('Admin')) return <Navigate to="/admin" replace />;

  // Dispatcher second priority
  if (roles.includes('Dispatcher')) return <Navigate to="/dispatcher" replace />;

  // Volunteer third priority
  // Note: dual role Victim+Volunteer goes to /volunteer
  // The VolunteerDashboard handles showing both tabs
  if (roles.includes('Volunteer')) return <Navigate to="/volunteer" replace />;

  // Victim only
  if (roles.includes('Victim')) return <Navigate to="/victim" replace />;

  // Unknown role, go back to login
  return <Navigate to="/login" replace />;
};

export default RoleRedirect;