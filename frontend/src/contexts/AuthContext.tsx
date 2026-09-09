import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../services/api';
import { authStore } from '../store';
import type { User } from '../types';

interface NavItem {
  path: string;
  label: string;
}

interface RoleAccess {
  [key: string]: { read: boolean; write: boolean } | boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  roleDescription: string;
  dashboardPath: string;
  nav: NavItem[];
  access: RoleAccess;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  canAccess: (resource: string, action?: string) => boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEFAULT_DASHBOARDS: Record<string, string> = {
  admin: '/',
  manager: '/manager-dashboard',
  artist: '/artist-dashboard',
  finance: '/finance-dashboard',
  marketing: '/marketing-dashboard',
};

export const getDashboardPath = (role: string): string => {
  return DEFAULT_DASHBOARDS[role] || '/';
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [roleDescription, setRoleDescription] = useState('');
  const [dashboardPath, setDashboardPath] = useState('/');
  const [nav, setNav] = useState<NavItem[]>([]);
  const [access, setAccess] = useState<RoleAccess>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('hbe_token');
    const storedUser = localStorage.getItem('hbe_user');
    const storedNav = localStorage.getItem('hbe_nav');
    const storedAccess = localStorage.getItem('hbe_access');
    const storedDashboard = localStorage.getItem('hbe_dashboard_path');
    const storedRoleDesc = localStorage.getItem('hbe_role_description');
    if (storedToken && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setToken(storedToken);
      setUser(parsedUser);
      setNav(storedNav ? JSON.parse(storedNav) : []);
      setAccess(storedAccess ? JSON.parse(storedAccess) : {});
      setDashboardPath(storedDashboard || getDashboardPath(parsedUser.role));
      setRoleDescription(storedRoleDesc || '');
      authStore.getState().setAuth(parsedUser, storedToken);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const { token: newToken, user: newUser, roleDescription: roleDesc, dashboardPath: dashPath, nav: userNav, access: userAccess } = res.data;
    localStorage.setItem('hbe_token', newToken);
    localStorage.setItem('hbe_user', JSON.stringify(newUser));
    localStorage.setItem('hbe_role_description', roleDesc || '');
    localStorage.setItem('hbe_dashboard_path', dashPath || '/');
    localStorage.setItem('hbe_nav', JSON.stringify(userNav || []));
    localStorage.setItem('hbe_access', JSON.stringify(userAccess || {}));
    setToken(newToken);
    setUser(newUser);
    setRoleDescription(roleDesc || '');
    setDashboardPath(dashPath || '/');
    setNav(userNav || []);
    setAccess(userAccess || {});
    authStore.getState().setAuth(newUser, newToken);
  };

  const updateUser = (updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const merged = { ...prev, ...updates };
      localStorage.setItem('hbe_user', JSON.stringify(merged));
      authStore.getState().setAuth(merged, token);
      return merged;
    });
  };

  const logout = () => {
    localStorage.removeItem('hbe_token');
    localStorage.removeItem('hbe_user');
    localStorage.removeItem('hbe_role_description');
    localStorage.removeItem('hbe_dashboard_path');
    localStorage.removeItem('hbe_nav');
    localStorage.removeItem('hbe_access');
    setToken(null);
    setUser(null);
    setRoleDescription('');
    setDashboardPath('/');
    setNav([]);
    setAccess({});
    authStore.getState().clearAuth();
  };

  const canAccess = (resource: string, action: string = 'read'): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const resourceAccess = access[resource];
    if (!resourceAccess) return false;
    if (resourceAccess === true) return true;
    const ra = resourceAccess as { read: boolean; write: boolean };
    if (action === 'read') return ra.read === true;
    if (action === 'write') return ra.write === true;
    return false;
  };

  return (
    <AuthContext.Provider value={{ user, token, roleDescription, dashboardPath, nav, access, login, logout, updateUser, canAccess, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
