import { createStore } from './createStore';
import type { User } from '../types';

// ── UI Store ──────────────────────────────────────────
export interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const uiStore = createStore<UIState>({
  sidebarOpen: false,
  toggleSidebar: () =>
    uiStore.setState((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open: boolean) => uiStore.setState({ sidebarOpen: open }),
});

// ── Notification Store ────────────────────────────────
export interface NotificationState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  decrementUnread: () => void;
}

export const notificationStore = createStore<NotificationState>({
  unreadCount: 0,
  setUnreadCount: (count: number) =>
    notificationStore.setState({ unreadCount: count }),
  incrementUnread: () =>
    notificationStore.setState((s) => ({ unreadCount: s.unreadCount + 1 })),
  decrementUnread: () =>
    notificationStore.setState((s) => ({
      unreadCount: Math.max(0, s.unreadCount - 1),
    })),
});

// ── Auth Store ────────────────────────────────────────
export interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User | null, token: string | null) => void;
  clearAuth: () => void;
}

export const authStore = createStore<AuthState>({
  user: null,
  token: null,
  setAuth: (user: User | null, token: string | null) =>
    authStore.setState({ user, token }),
  clearAuth: () => authStore.setState({ user: null, token: null }),
});
