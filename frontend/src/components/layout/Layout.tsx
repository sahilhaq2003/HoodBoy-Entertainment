import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useStore } from '../../store/createStore';
import { uiStore } from '../../store';

const Layout: React.FC = () => {
  const sidebarOpen = useStore(uiStore, (s) => s.sidebarOpen);
  const setSidebarOpen = uiStore.getState().setSidebarOpen;

  return (
    <div className="app-shell flex h-screen w-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-workspace flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopBar onMenuClick={() => uiStore.getState().toggleSidebar()} />
        <main className="app-content flex-1 overflow-y-auto px-4 py-5 sm:px-5 md:px-7 md:py-7 xl:px-9">
          <div className="mx-auto w-full max-w-[1680px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;