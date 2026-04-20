import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardLayout from './pages/DashboardLayout';
import OwnerDashboard from './pages/OwnerDashboard';
import AnalyticsPage from './pages/AnalyticsPage';
import CustomersPage from './pages/CustomersPage';
import CustomerMapPage from './pages/CustomerMapPage';
import ScanPage from './pages/ScanPage';
import CampaignsPage from './pages/CampaignsPage';
import AIAssistantPage from './pages/AIAssistantPage';
import SettingsPage from './pages/SettingsPage';
import JoinPage from './pages/JoinPage';

import AdminDashboard from './pages/AdminDashboard';
import AdminAnalyticsPage from './pages/AdminAnalyticsPage';
import AdminTenantsPage from './pages/AdminTenantsPage';
import AdminCardDesignerPage from './pages/AdminCardDesignerPage';
import AdminAIAssistantPage from './pages/AdminAIAssistantPage';
import AdminCampaignsPage from './pages/AdminCampaignsPage';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (user) {
    if (user.role === 'super_admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/join/:slug" element={<JoinPage />} />

          {/* Business Owner Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['business_owner']}>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<OwnerDashboard />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="map" element={<CustomerMapPage />} />
            <Route path="scan" element={<ScanPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="ai-assistant" element={<AIAssistantPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Super Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
            <Route path="tenants" element={<AdminTenantsPage />} />
            <Route path="campaigns" element={<AdminCampaignsPage />} />
            <Route path="card-designer" element={<AdminCardDesignerPage />} />
            <Route path="ai" element={<AdminAIAssistantPage />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
