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
import MyWalletCardPage from './pages/MyWalletCardPage';
import InsightsPage from './pages/InsightsPage';

import AdminDashboard from './pages/AdminDashboard';
import AdminAnalyticsPage from './pages/AdminAnalyticsPage';
import AdminTenantsPage from './pages/AdminTenantsPage';
import AdminCardDesignerPage from './pages/AdminCardDesignerPage';
import CardDesignerPage from './pages/CardDesignerPage';
import AdminAIAssistantPage from './pages/AdminAIAssistantPage';
import AdminCampaignsPage from './pages/AdminCampaignsPage';
import AdminInsightsPage from './pages/AdminInsightsPage';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Staff and managers land on the page they *are* allowed to use instead of
    // being kicked to the landing page. Staff → /dashboard/scan; everyone else
    // back to the landing.
    if (user.role === 'staff') return <Navigate to="/dashboard/scan" replace />;
    if (user.role === 'manager') return <Navigate to="/dashboard/analytics" replace />;
    return <Navigate to="/" replace />;
  }
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
          <Route path="/card/:barcodeId" element={<MyWalletCardPage />} />

          {/* Business Owner Routes — per-page role enforcement.
              - business_owner: full access
              - manager: analytics, insights, customers, map, scan (no campaigns/settings/AI)
              - staff: scan ONLY — every other route redirects them back to /dashboard/scan */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['business_owner', 'manager', 'staff']}>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={
              <ProtectedRoute allowedRoles={['business_owner', 'manager']}>
                <OwnerDashboard />
              </ProtectedRoute>
            } />
            <Route path="analytics" element={
              <ProtectedRoute allowedRoles={['business_owner', 'manager']}>
                <AnalyticsPage />
              </ProtectedRoute>
            } />
            <Route path="insights" element={
              <ProtectedRoute allowedRoles={['business_owner', 'manager']}>
                <InsightsPage />
              </ProtectedRoute>
            } />
            <Route path="customers" element={
              <ProtectedRoute allowedRoles={['business_owner', 'manager']}>
                <CustomersPage />
              </ProtectedRoute>
            } />
            <Route path="map" element={
              <ProtectedRoute allowedRoles={['business_owner', 'manager']}>
                <CustomerMapPage />
              </ProtectedRoute>
            } />
            {/* Scan is the ONE page staff can reach. */}
            <Route path="scan" element={
              <ProtectedRoute allowedRoles={['business_owner', 'manager', 'staff']}>
                <ScanPage />
              </ProtectedRoute>
            } />
            <Route path="card-designer" element={
              <ProtectedRoute allowedRoles={['business_owner']}>
                <CardDesignerPage />
              </ProtectedRoute>
            } />
            <Route path="campaigns" element={
              <ProtectedRoute allowedRoles={['business_owner']}>
                <CampaignsPage />
              </ProtectedRoute>
            } />
            <Route path="ai-assistant" element={
              <ProtectedRoute allowedRoles={['business_owner']}>
                <AIAssistantPage />
              </ProtectedRoute>
            } />
            <Route path="settings" element={
              <ProtectedRoute allowedRoles={['business_owner']}>
                <SettingsPage />
              </ProtectedRoute>
            } />
          </Route>

          {/* Super Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
            <Route path="insights" element={<AdminInsightsPage />} />
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
