import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth, getDashboardPath } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { applyAppearance, getAppearance } from './utils/appearance';

// Load only the page needed for the current route. This keeps the initial bundle
// small and avoids downloading every dashboard and management screen up front.
const Layout = lazy(() => import('./components/layout/Layout'));
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard'));
const ArtistDashboard = lazy(() => import('./pages/ArtistDashboard'));
const FinanceDashboard = lazy(() => import('./pages/FinanceDashboard'));
const MarketingDashboard = lazy(() => import('./pages/MarketingDashboard'));
const Artists = lazy(() => import('./pages/Artists'));
const ArtistProfile = lazy(() => import('./pages/ArtistProfile'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const MyMusic = lazy(() => import('./pages/MyMusic'));
const MyReleases = lazy(() => import('./pages/MyReleases'));
const MyRoyalties = lazy(() => import('./pages/MyRoyalties'));
const ArtistOnboarding = lazy(() => import('./pages/ArtistOnboarding'));
const Songs = lazy(() => import('./pages/Songs'));
const Releases = lazy(() => import('./pages/Releases'));
const Distribution = lazy(() => import('./pages/Distribution'));
const DistributionDetail = lazy(() => import('./pages/DistributionDetail'));
const Contracts = lazy(() => import('./pages/Contracts'));
const Finance = lazy(() => import('./pages/Finance'));
const Royalties = lazy(() => import('./pages/Royalties'));
const Analytics = lazy(() => import('./pages/Analytics'));
const ContractTemplates = lazy(() => import('./pages/ContractTemplates'));
const TaxCalendar = lazy(() => import('./pages/TaxCalendar'));
const ArtistBalances = lazy(() => import('./pages/ArtistBalances'));
const PerSongAnalytics = lazy(() => import('./pages/PerSongAnalytics'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Settings = lazy(() => import('./pages/Settings'));
const Projects = lazy(() => import('./pages/Projects'));
const Development = lazy(() => import('./pages/Development'));
const ArtistScorecard = lazy(() => import('./pages/ArtistScorecard'));
const FileManager = lazy(() => import('./pages/FileManager'));
const OwnershipTracker = lazy(() => import('./pages/OwnershipTracker'));
const WeeklyReport = lazy(() => import('./pages/WeeklyReport'));
const CampaignManager = lazy(() => import('./pages/CampaignManager'));
const MetadataManager = lazy(() => import('./pages/MetadataManager'));
const LnkUp = lazy(() => import('./pages/LnkUp'));
const TeamManagement = lazy(() => import('./pages/TeamManagement'));

const PageLoader = () => (
  <div className="flex min-h-64 items-center justify-center" role="status" aria-label="Loading page">
    <div className="h-9 w-9 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
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
  if (!user) {
    if (location.pathname === '/') return <Landing />;
    return <Navigate to="/login" replace />;
  }
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
    <Suspense fallback={<PageLoader />}>
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
        <Route path="distribution" element={<AccessGuard resource="distribution"><Distribution /></AccessGuard>} />
        <Route path="distribution/:id" element={<AccessGuard resource="distribution"><DistributionDetail /></AccessGuard>} />
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
    </Suspense>
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
        <SocketProvider>
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
      </SocketProvider>
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
