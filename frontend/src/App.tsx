import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth, getDashboardPath } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { applyAppearance, getAppearance } from './utils/appearance';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import ArtistDashboard from './pages/ArtistDashboard';
import FinanceDashboard from './pages/FinanceDashboard';
import MarketingDashboard from './pages/MarketingDashboard';
import Artists from './pages/Artists';
import ArtistProfile from './pages/ArtistProfile';
import MyProfile from './pages/MyProfile';
import MyMusic from './pages/MyMusic';
import MyReleases from './pages/MyReleases';
import MyRoyalties from './pages/MyRoyalties';
import ArtistOnboarding from './pages/ArtistOnboarding';
import Songs from './pages/Songs';
import Releases from './pages/Releases';
import Contracts from './pages/Contracts';
import Finance from './pages/Finance';
import Royalties from './pages/Royalties';
import Analytics from './pages/Analytics';
import ContractTemplates from './pages/ContractTemplates';
import TaxCalendar from './pages/TaxCalendar';
import ArtistBalances from './pages/ArtistBalances';
import PerSongAnalytics from './pages/PerSongAnalytics';
import Contacts from './pages/Contacts';
import Tasks from './pages/Tasks';
import Settings from './pages/Settings';
import Projects from './pages/Projects';
import Development from './pages/Development';
import ArtistScorecard from './pages/ArtistScorecard';
import FileManager from './pages/FileManager';
import OwnershipTracker from './pages/OwnershipTracker';
import WeeklyReport from './pages/WeeklyReport';
import CampaignManager from './pages/CampaignManager';
import MetadataManager from './pages/MetadataManager';
import LnkUp from './pages/LnkUp';
import TeamManagement from './pages/TeamManagement';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-white animate-spin">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading HoodBoy Entertainment...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const RoleGuard: React.FC<{ children: React.ReactNode; roles: string[] }> = ({ children, roles }) => {
  const { user } = useAuth();
  if (user && !roles.includes(user.role)) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }
  return <>{children}</>;
};

const AccessGuard: React.FC<{ children: React.ReactNode; resource: string; action?: string }> = ({ children, resource, action = 'read' }) => {
  const { canAccess, user } = useAuth();
  if (!canAccess(resource, action)) {
    return <Navigate to={getDashboardPath(user?.role || '')} replace />;
  }
  return <>{children}</>;
};

const RoleConditional: React.FC<{ artist: React.ReactNode; staff: React.ReactNode }> = ({ artist, staff }) => {
  const { user } = useAuth();
  return user?.role === 'artist' ? <>{artist}</> : <>{staff}</>;
};

const AppRoutes: React.FC = () => {
  const { user } = useAuth();
  const dashPath = getDashboardPath(user?.role || '');

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        {/* Role-specific dashboards */}
        <Route index element={
          user?.role === 'admin' ? <AdminDashboard /> :
          user?.role === 'manager' ? <ManagerDashboard /> :
          user?.role === 'artist' ? <ArtistDashboard /> :
          user?.role === 'finance' ? <FinanceDashboard /> :
          user?.role === 'marketing' ? <MarketingDashboard /> :
          <Dashboard />
        } />
        <Route path="manager-dashboard" element={<RoleGuard roles={['manager']}><ManagerDashboard /></RoleGuard>} />
        <Route path="artist-dashboard" element={<RoleGuard roles={['artist']}><ArtistDashboard /></RoleGuard>} />
        <Route path="finance-dashboard" element={<RoleGuard roles={['finance']}><FinanceDashboard /></RoleGuard>} />
        <Route path="marketing-dashboard" element={<RoleGuard roles={['marketing']}><MarketingDashboard /></RoleGuard>} />

        {/* Admin & Manager */}
        <Route path="artists" element={<AccessGuard resource="artists"><Artists /></AccessGuard>} />
        <Route path="artists/new" element={<AccessGuard resource="artists" action="write"><ArtistOnboarding /></AccessGuard>} />
        <Route path="artists/onboarding/:id" element={<AccessGuard resource="artists" action="write"><ArtistOnboarding /></AccessGuard>} />
        <Route path="artists/:id" element={<AccessGuard resource="artists"><ArtistProfile /></AccessGuard>} />
        <Route path="songs" element={<AccessGuard resource="songs"><Songs /></AccessGuard>} />
        <Route path="releases" element={<AccessGuard resource="releases"><Releases /></AccessGuard>} />
        <Route path="the-lnk-up" element={<AccessGuard resource="theLnkUp"><LnkUp /></AccessGuard>} />
        <Route path="projects" element={<AccessGuard resource="projects"><Projects /></AccessGuard>} />
        <Route path="development" element={<AccessGuard resource="development"><Development /></AccessGuard>} />
        <Route path="development/artist/:artistId" element={<AccessGuard resource="development"><ArtistScorecard /></AccessGuard>} />
        <Route path="files" element={<AccessGuard resource="files"><FileManager /></AccessGuard>} />
        <Route path="files/folder/:folderId" element={<AccessGuard resource="files"><FileManager /></AccessGuard>} />
        <Route path="metadata" element={<AccessGuard resource="metadata"><MetadataManager /></AccessGuard>} />
        <Route path="ownership" element={<AccessGuard resource="ownership"><OwnershipTracker /></AccessGuard>} />
        <Route path="weekly-report" element={<AccessGuard resource="weeklyReports"><WeeklyReport /></AccessGuard>} />
        <Route path="analytics" element={<AccessGuard resource="analytics"><Analytics /></AccessGuard>} />

        {/* Finance */}
        <Route path="finance" element={<AccessGuard resource="finance"><Finance /></AccessGuard>} />
        <Route path="artist-balances" element={<AccessGuard resource="artistBalances"><ArtistBalances /></AccessGuard>} />
        <Route path="budgets" element={<AccessGuard resource="budgets"><Finance /></AccessGuard>} />
        <Route path="tax-calendar" element={<AccessGuard resource="taxCalendar"><TaxCalendar /></AccessGuard>} />
        <Route path="contract-templates" element={<AccessGuard resource="contractTemplates"><ContractTemplates /></AccessGuard>} />

        {/* Contracts - Admin, Manager (read), Finance (read) */}
        <Route path="contracts" element={<AccessGuard resource="contracts"><Contracts /></AccessGuard>} />

        {/* Marketing */}
        <Route path="campaigns" element={<AccessGuard resource="campaigns"><CampaignManager /></AccessGuard>} />
        <Route path="contacts" element={<AccessGuard resource="contacts"><Contacts /></AccessGuard>} />
        <Route path="song-analytics" element={<AccessGuard resource="songAnalytics"><PerSongAnalytics /></AccessGuard>} />

        {/* Artist-only routes */}
        <Route path="my-music" element={<RoleGuard roles={['artist']}><MyMusic /></RoleGuard>} />
        <Route path="my-releases" element={<RoleGuard roles={['artist']}><MyReleases /></RoleGuard>} />
        <Route path="profile" element={<RoleGuard roles={['artist']}><MyProfile /></RoleGuard>} />
        <Route path="royalties" element={<RoleConditional artist={<RoleGuard roles={['artist']}><MyRoyalties /></RoleGuard>} staff={<AccessGuard resource="royalties"><Royalties /></AccessGuard>} />} />
        <Route path="tasks" element={<AccessGuard resource="tasks"><Tasks /></AccessGuard>} />

        {/* Personal settings are available to every signed-in role. */}
        <Route path="settings" element={<Settings />} />
        <Route path="team" element={<RoleGuard roles={['admin']}><TeamManagement /></RoleGuard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const ThemeInit: React.FC = () => {
  useEffect(() => {
    applyAppearance(getAppearance(), false);
  }, []);
  return null;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#18191c',
                color: '#f5f4f2',
                border: '1px solid #2a2c31',
                borderRadius: '14px',
                fontSize: '13px',
                boxShadow: '0 18px 50px rgba(0,0,0,0.38)',
              },
              success: { iconTheme: { primary: '#16A34A', secondary: '#111214' } },
              error: { iconTheme: { primary: '#DC2626', secondary: '#111214' } },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      <ThemeInit />
      {children}
    </>
  );
};

export default App;
