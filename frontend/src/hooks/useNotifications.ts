import { useEffect, useCallback } from 'react';
import { notificationsApi } from '../services/api';
import { useStore } from '../store/createStore';
import { notificationStore } from '../store';

export const useNotifications = () => {
  const unreadCount = useStore(notificationStore, (s) => s.unreadCount);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await notificationsApi.getUnreadCount();
      notificationStore.getState().setUnreadCount(res.data.data.count);
    } catch {
      // notification count polling silently ignored
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  return { unreadCount, refresh: loadUnreadCount };
};
