import React from 'react';
import { Menu, Bell, Search, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface NavbarProps {
  onMenuClick: () => void;
  pageTitle: string;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick, pageTitle }) => {
  const { user } = useAuth();

  return (
    <header
      className="h-16 flex items-center px-6 gap-4 sticky top-0 z-30"
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid #E5E7EB',
      }}
    >
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1">
        <h1 className="text-lg font-bold text-gray-900">{pageTitle}</h1>
        <p className="text-xs text-gray-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200" style={{ width: '260px' }}>
        <Search size={14} className="text-gray-400" />
        <input
          type="text"
          placeholder="Search anything..."
          className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none flex-1"
        />
      </div>

      <button className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
        <Bell size={18} />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full" />
      </button>

      <div className="flex items-center gap-2 cursor-pointer group">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
        >
          {user?.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : (user?.name?.slice(0, 2).toUpperCase() || 'HB')}
        </div>
        <div className="hidden md:block">
          <div className="text-xs font-semibold text-gray-900">{user?.name || 'Admin'}</div>
          <div className="text-xs capitalize text-gray-500">{user?.role}</div>
        </div>
        <ChevronDown size={14} className="text-gray-400 group-hover:text-gray-600 transition-colors hidden md:block" />
      </div>
    </header>
  );
};

export default Navbar;
