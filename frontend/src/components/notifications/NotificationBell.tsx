import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, Trash2, CheckCheck, Inbox, Clock, ClipboardCheck, CreditCard, FileText, Disc3, BellRing, Megaphone, AlertTriangle, MessageSquare, UserCheck } from 'lucide-react';
import { notificationsApi } from '../../services/api';
import { useStore } from '../../store/createStore';
import { notificationStore } from '../../store';
import toast from 'react-hot-toast';

interface Notif {
  _id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  read: boolean;
  priority: string;
  createdAt: string;
}

const NOTIF_STYLES: Record<string, { tile: string; color: string; icon: React.ReactNode }> = {
  task_deadline: { color: '#DC2626', tile: 'rgba(220,38,38,0.10)', icon: <Clock size={14} /> },
  approval_needed: { color: '#D97706', tile: 'rgba(245,158,11,0.10)', icon: <ClipboardCheck size={14} /> },
  payment_due: { color: '#16A34A', tile: 'rgba(22,163,74,0.10)', icon: <CreditCard size={14} /> },
  contract_expiry: { color: '#7C3AED', tile: 'rgba(124,58,237,0.10)', icon: <FileText size={14} /> },
  release_scheduled: { color: '#0EA5E9', tile: 'rgba(14,165,233,0.10)', icon: <Disc3 size={14} /> },
  campaign_update: { color: '#DB2777', tile: 'rgba(219,39,119,0.10)', icon: <Megaphone size={14} /> },
  task_assigned: { color: '#7C3AED', tile: 'rgba(124,58,237,0.10)', icon: <UserCheck size={14} /> },
  task_update: { color: '#0EA5E9', tile: 'rgba(14,165,233,0.10)', icon: <ClipboardCheck size={14} /> },
  task_comment: { color: '#16A34A', tile: 'rgba(22,163,74,0.10)', icon: <MessageSquare size={14} /> },
};

const NotificationBell: React.FC = () => {
  const unreadCount = useStore(notificationStore, (s) => s.unreadCount);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await notificationsApi.getUnreadCount();
      notificationStore.getState().setUnreadCount(res.data.data.count);
    } catch { /* notification poll silently ignored */ }
  }, []);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.getAll({ limit: 20 });
      setNotifications(res.data.data);
      notificationStore.getState().setUnreadCount(res.data.unreadCount);
    } catch { /* notification load silently ignored */ }
    setLoading(false);
  };

  const toggleOpen = () => {
    if (!isOpen) loadNotifications();
    setIsOpen(!isOpen);
  };

  const markRead = async (id: string) => {
    await notificationsApi.markRead(id);
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    notificationStore.getState().decrementUnread();
  };

  const markAllRead = async () => {
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    notificationStore.getState().setUnreadCount(0);
    toast.success('All notifications marked as read');
  };

  const deleteNotif = async (id: string) => {
    await notificationsApi.delete(id);
    const wasUnread = !notifications.find((n) => n._id === id)?.read;
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    if (wasUnread) notificationStore.getState().decrementUnread();
  };

  const getPriorityDot = (priority: string) => {
    switch (priority) {
      case 'high': return '#DC2626';
      case 'medium': return '#F59E0B';
      default: return '#94A3B8';
    }
  };

  const getStyle = (type: string) => NOTIF_STYLES[type] || { color: '#6B7280', tile: 'rgba(107,114,128,0.10)', icon: <BellRing size={14} /> };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={toggleOpen} className="header-icon-button">
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-[#DC2626] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 shadow-lg shadow-red-500/30">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2.5 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl z-50"
          style={{ background: 'var(--hbe-panel)', border: '1px solid var(--hbe-line)', boxShadow: 'var(--hbe-shadow-float)' }}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-(--hbe-line-soft)" style={{ background: 'var(--hbe-fill-soft)' }}>
            <div className="flex items-center gap-2">
              <h3 className="text-[13.5px] font-bold text-[var(--hbe-text)]">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-[#7C3AED]/12 text-[#7C3AED] text-[10px] font-bold rounded-full">{unreadCount} new</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] text-[#7C3AED] hover:text-[#6D28D9] font-semibold transition-colors">
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="p-10 text-center">
                <div className="w-6 h-6 border-2 border-(--hbe-line) border-t-[#7C3AED] rounded-full animate-spin mx-auto" />
                <p className="text-xs text-[var(--hbe-muted)] mt-3">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-(--hbe-fill) border border-(--hbe-line) flex items-center justify-center mx-auto mb-3.5">
                  <Inbox size={20} className="text-[var(--hbe-muted)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--hbe-text)]">All caught up</p>
                <p className="text-xs text-[var(--hbe-muted)] mt-1">No new notifications</p>
              </div>
            ) : (
              notifications.map((n) => {
                const s = getStyle(n.type);
                return (
                  <div
                    key={n._id}
                    onClick={n.link ? () => { window.location.href = n.link; } : undefined}
                    className={`flex items-start gap-3 px-4 py-3.5 border-b border-(--hbe-line-soft) cursor-pointer transition-colors ${
                      !n.read ? 'bg-[#7C3AED]/[0.05]' : ''
                    } ${n.link ? ' hover:bg-(--hbe-hover-fill)' : ''}`}
                  >
                    <span
                      className="hbe-icon-tile mt-0.5 flex-shrink-0"
                      style={{ background: s.tile, color: s.color, width: 30, height: 30, borderRadius: 9 }}
                    >
                      {s.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-semibold truncate ${!n.read ? 'text-[var(--hbe-text)]' : 'text-[var(--hbe-text-soft)]'}`}>
                          {n.title}
                        </p>
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: getPriorityDot(n.priority) }}
                        />
                      </div>
                      <p className="text-[11px] text-[var(--hbe-muted)] truncate mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-[var(--hbe-muted)] mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!n.read && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markRead(n._id); }}
                          className="p-1.5 rounded-lg text-[var(--hbe-muted)] hover:text-[#16A34A] hover:bg-(--hbe-fill) transition-colors"
                          title="Mark as read"
                        >
                          <Check size={13} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotif(n._id); }}
                        className="p-1.5 rounded-lg text-[var(--hbe-muted)] hover:text-[#DC2626] hover:bg-(--hbe-fill) transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-(--hbe-line-soft) bg-(--hbe-fill-soft)">
            {notifications.some((n) => n.priority === 'high') && (
              <p className="flex items-center gap-1.5 text-[10.5px] text-[var(--hbe-muted)]">
                <AlertTriangle size={11} className="text-[#F59E0B]" />
                {notifications.filter((n) => n.priority === 'high' && !n.read).length} high-priority alerts require attention
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
