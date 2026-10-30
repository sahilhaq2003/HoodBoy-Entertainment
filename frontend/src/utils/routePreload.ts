type PageModule = { default: unknown };
type PageLoader = () => Promise<PageModule>;

const loaders: Record<string, PageLoader> = {
  '/': () => import('../pages/AdminDashboard'),
  '/manager-dashboard': () => import('../pages/ManagerDashboard'),
  '/artist-dashboard': () => import('../pages/ArtistDashboard'),
  '/finance-dashboard': () => import('../pages/FinanceDashboard'),
  '/marketing-dashboard': () => import('../pages/MarketingDashboard'),
  '/artists': () => import('../pages/Artists'),
  '/songs': () => import('../pages/Songs'),
  '/releases': () => import('../pages/Releases'),
  '/distribution': () => import('../pages/Distribution'),
  '/the-lnk-up': () => import('../pages/LnkUp'),
  '/projects': () => import('../pages/Projects'),
  '/development': () => import('../pages/Development'),
  '/files': () => import('../pages/FileManager'),
  '/metadata': () => import('../pages/MetadataManager'),
  '/ownership': () => import('../pages/OwnershipTracker'),
  '/weekly-report': () => import('../pages/WeeklyReport'),
  '/analytics': () => import('../pages/Analytics'),
  '/finance': () => import('../pages/Finance'),
  '/budgets': () => import('../pages/Finance'),
  '/artist-balances': () => import('../pages/ArtistBalances'),
  '/royalties': () => import('../pages/Royalties'),
  '/tax-calendar': () => import('../pages/TaxCalendar'),
  '/contract-templates': () => import('../pages/ContractTemplates'),
  '/contracts': () => import('../pages/Contracts'),
  '/campaigns': () => import('../pages/CampaignManager'),
  '/contacts': () => import('../pages/Contacts'),
  '/song-analytics': () => import('../pages/PerSongAnalytics'),
  '/tasks': () => import('../pages/Tasks'),
  '/settings': () => import('../pages/Settings'),
  '/team': () => import('../pages/TeamManagement'),
  '/my-music': () => import('../pages/MyMusic'),
  '/my-releases': () => import('../pages/MyReleases'),
  '/profile': () => import('../pages/MyProfile'),
};

const pending = new Map<string, Promise<PageModule>>();

const normalizeRoute = (path: string) => {
  const clean = `/${path.split('?')[0].split('#')[0].replace(/^\/+|\/+$/g, '')}`;
  if (clean.startsWith('/artists/onboarding/')) return '/artists';
  if (clean.startsWith('/artists/')) return '/artists';
  if (clean.startsWith('/distribution/')) return '/distribution';
  if (clean.startsWith('/development/')) return '/development';
  if (clean.startsWith('/files/')) return '/files';
  return clean === '//' ? '/' : clean;
};

export const preloadRoute = (path: string): Promise<unknown> => {
  const route = normalizeRoute(path);
  const loader = loaders[route];
  if (!loader) return Promise.resolve();
  const existing = pending.get(route);
  if (existing) return existing;
  const request = loader().catch(error => {
    pending.delete(route);
    throw error;
  });
  pending.set(route, request);
  return request;
};

export const preloadRoutes = async (paths: string[], concurrency = 3) => {
  const queue = [...new Set(paths)];
  let index = 0;
  const worker = async () => {
    while (index < queue.length) {
      const path = queue[index++];
      try { await preloadRoute(path); } catch { /* A click can retry a failed preload. */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
};
