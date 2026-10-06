import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';

// Auth Pages
import PlatformLogin from './pages/auth/PlatformLogin';
import PlatformDeveloperRegister from './pages/auth/PlatformDeveloperRegister';

// Layouts & Guards
import SuperAdminRoute from './components/layout/SuperAdminRoute';
import PlatformShellLayout from './components/layout/PlatformShellLayout';
import DeveloperLayout from './components/developer/DeveloperLayout';
import OperationsLayout from './components/operations/OperationsLayout';

// Developer Portal Pages
import DeveloperDashboard from './pages/developer/DeveloperDashboard';
import ApiKeyManager from './pages/developer/ApiKeyManager';
import ApiDocsCenter from './pages/developer/ApiDocsCenter';
import ApiVersionManager from './pages/developer/ApiVersionManager';
import WebhookManager from './pages/developer/WebhookManager';
import SandboxEnvironment from './pages/developer/SandboxEnvironment';
import ApiAnalytics from './pages/developer/ApiAnalytics';
import SecurityCenter from './pages/developer/SecurityCenter';
import SdkDownloads from './pages/developer/SdkDownloads';
import AcademicCalendarManager from './pages/developer/AcademicCalendarManager';
import ReferralManagementDashboard from './pages/developer/ReferralManagementDashboard';

// Operations Center Pages
import OperationsDashboard from './pages/operations/OperationsDashboard';
import OperationsSchoolsDirectory from './pages/operations/OperationsSchoolsDirectory';
import SchoolDetailView from './pages/operations/SchoolDetailView';
import OperationsSupportCenter from './pages/operations/OperationsSupportCenter';
import OperationsSubscriptions from './pages/operations/OperationsSubscriptions';
import OperationsInterventionsAudit from './pages/operations/OperationsInterventionsAudit';
import OperationsSchoolAnalytics from './pages/operations/OperationsSchoolAnalytics';
import OperationsReports from './pages/operations/OperationsReports';
import BlogManager from './pages/operations/BlogManager';
import BroadcastManager from './pages/operations/BroadcastManager';
import OperationsAgentView from './pages/operations/OperationsAgentView';
import GesNewsWatcher from './pages/operations/GesNewsWatcher';
import OperationsRunbook from './pages/operations/OperationsRunbook';
import AgentPortal from './pages/public/AgentPortal';
import SchoolDemoRequest from './pages/public/SchoolDemoRequest';

function App() {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public Auth */}
          <Route path="/login" element={<PlatformLogin />} />
          <Route path="/register" element={<PlatformDeveloperRegister />} />

          {/* Public Individual Referral & Affiliate Partner Portal */}
          <Route path="/agent" element={<AgentPortal />} />
          <Route path="/agent/:code" element={<AgentPortal />} />
          <Route path="/agent/portal" element={<AgentPortal />} />
          <Route path="/agent/portal/:code" element={<AgentPortal />} />
          <Route path="/agent/register" element={<AgentPortal />} />
          <Route path="/demo" element={<SchoolDemoRequest />} />
          <Route path="/leads/request" element={<SchoolDemoRequest />} />

          {/* Root redirect to Platform Operations */}
          <Route path="/" element={<Navigate to="/platform/operations" replace />} />
          <Route path="/operations" element={<Navigate to="/platform/operations" replace />} />
          <Route path="/developer" element={<Navigate to="/platform/developer" replace />} />

          {/* Platform Console Shell (Super Admin & Developer Only) */}
          <Route 
            path="/platform" 
            element={
              <SuperAdminRoute>
                <PlatformShellLayout />
              </SuperAdminRoute>
            }
          >
            <Route index element={<Navigate to="/platform/operations" replace />} />

            {/* Operations Center Routes */}
            <Route path="operations" element={<OperationsLayout />}>
              <Route index element={<OperationsDashboard />} />
              <Route path="runbook" element={<OperationsRunbook />} />
              <Route path="copilot" element={<OperationsAgentView />} />
              <Route path="ges-radar" element={<GesNewsWatcher />} />
              <Route path="broadcasts" element={<BroadcastManager />} />
              <Route path="schools" element={<OperationsSchoolsDirectory />} />
              <Route path="schools/:schoolId" element={<SchoolDetailView />} />
              <Route path="support" element={<OperationsSupportCenter />} />
              <Route path="subscriptions" element={<OperationsSubscriptions />} />
              <Route path="transactions" element={<OperationsSubscriptions />} />
              <Route path="referrals" element={<ReferralManagementDashboard />} />
              <Route path="calendar" element={<AcademicCalendarManager />} />
              <Route path="blog" element={<BlogManager />} />
              <Route path="interventions" element={<OperationsInterventionsAudit />} />
              <Route path="analytics" element={<OperationsSchoolAnalytics />} />
              <Route path="reports" element={<OperationsReports />} />
            </Route>

            {/* Developer Portal Routes */}
            <Route path="developer" element={<DeveloperLayout />}>
              <Route index element={<DeveloperDashboard />} />
              <Route path="transactions" element={<OperationsSubscriptions />} />
              <Route path="api-keys" element={<ApiKeyManager />} />
              <Route path="api-docs" element={<ApiDocsCenter />} />
              <Route path="api-versions" element={<ApiVersionManager />} />
              <Route path="webhooks" element={<WebhookManager />} />
              <Route path="sandbox" element={<SandboxEnvironment />} />
              <Route path="analytics" element={<ApiAnalytics />} />
              <Route path="security" element={<SecurityCenter />} />
              <Route path="sdk" element={<SdkDownloads />} />
              <Route path="blog" element={<BlogManager />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/platform/operations" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
