import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../services/api';
import { authStore } from '../store';
import type { User } from '../types';
import { applyAppearance } from '../utils/appearance';

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
  login: (email: string, password: string, remember?: boolean) => Promise<{ requiresTwoFactor?: boolean; challengeToken?: string }>;
  verifyTwoFactor: (challengeToken: string, code: string, remember?: boolean) => Promise<void>;
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
    const storage = localStorage.getItem('hbe_token') ? localStorage : sessionStorage;
    const storedToken = storage.getItem('hbe_token');
    const storedUser = storage.getItem('hbe_user');
    const storedNav = storage.getItem('hbe_nav');
    const storedAccess = storage.getItem('hbe_access');
    const storedDashboard = storage.getItem('hbe_dashboard_path');
    const storedRoleDesc = storage.getItem('hbe_role_description');
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

  const storeAuthResponse = (data: any, remember = false) => {
    const storage = remember ? localStorage : sessionStorage;
    const otherStorage = remember ? sessionStorage : localStorage;
    ['hbe_token', 'hbe_user', 'hbe_role_description', 'hbe_dashboard_path', 'hbe_nav', 'hbe_access'].forEach(key => otherStorage.removeItem(key));
    const { token: newToken, user: newUser, roleDescription: roleDesc, dashboardPath: dashPath, nav: userNav, access: userAccess } = data;
    storage.setItem('hbe_token', newToken);
    storage.setItem('hbe_user', JSON.stringify(newUser));
    storage.setItem('hbe_role_description', roleDesc || '');
    storage.setItem('hbe_dashboard_path', dashPath || '/');
    storage.setItem('hbe_nav', JSON.stringify(userNav || []));
    storage.setItem('hbe_access', JSON.stringify(userAccess || {}));
    setToken(newToken);
    setUser(newUser);
    setRoleDescription(roleDesc || '');
    setDashboardPath(dashPath || '/');
    setNav(userNav || []);
    setAccess(userAccess || {});
    authStore.getState().setAuth(newUser, newToken);
    if (newUser.appearance) applyAppearance(newUser.appearance);
  };

  const login = async (email: string, password: string, remember = false) => {
    const res = await authApi.login(email, password);
    if (res.data.requiresTwoFactor) return { requiresTwoFactor: true, challengeToken: res.data.challengeToken };
    storeAuthResponse(res.data, remember);
    return {};
  };

  const verifyTwoFactor = async (challengeToken: string, code: string, remember = false) => {
    const res = await authApi.verifyTwoFactor(challengeToken, code);
    storeAuthResponse(res.data, remember);
  };

  const updateUser = (updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const merged = { ...prev, ...updates };
      const storage = localStorage.getItem('hbe_token') ? localStorage : sessionStorage;
      storage.setItem('hbe_user', JSON.stringify(merged));
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
    ['hbe_token', 'hbe_user', 'hbe_role_description', 'hbe_dashboard_path', 'hbe_nav', 'hbe_access'].forEach(key => sessionStorage.removeItem(key));
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
    <AuthContext.Provider value={{ user, token, roleDescription, dashboardPath, nav, access, login, verifyTwoFactor, logout, updateUser, canAccess, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
