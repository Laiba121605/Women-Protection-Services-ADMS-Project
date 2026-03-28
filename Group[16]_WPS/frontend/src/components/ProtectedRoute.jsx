// src/components/ProtectedRoute.jsx
// This component protects routes from unauthorized access
// If user is not logged in, they get redirected to login page
// If user doesn't have the required role, they get redirected to login page
// Wrap any route with this component to protect it

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// allowedRoles: array of roles that can access this route
// e.g. allowedRoles={['Victim']} or allowedRoles={['Victim', 'Volunteer']}
const ProtectedRoute = ({ children, allowedRoles }) => {
  
  // Get auth state from context
  const { isAuthenticated, hasRole } = useAuth();

  // If user is not logged in at all, send to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If roles are specified, check if user has at least one of them
  // This matches your backend allowRoles() middleware exactly
  if (allowedRoles && !allowedRoles.some(role => hasRole(role))) {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated and has correct role, render the page
  return children;
};

export default ProtectedRoute;