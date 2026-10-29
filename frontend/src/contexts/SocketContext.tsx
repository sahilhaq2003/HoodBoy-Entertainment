/**
 * SocketContext — provides a Socket.IO client instance to the entire React tree.
 *
 * The socket is lazily connected after the user logs in (token is present in
 * localStorage/sessionStorage) and automatically disconnected on logout.
 * All ToneGrid real-time events flow through this single connection.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface DistribeatsReleaseUpdate {
  releaseId: string;
  title: string;
  status: string;
  qcStatus?: string;
  syncStatus?: string;
  distribeatsRawStatus?: string;
  distribeatsReleaseId?: string;
  storeStatuses?: { store: string; status: string; updatedAt?: string }[];
  uploadState?: Record<string, string>;
  lastSyncedAt?: string;
  lastSyncError?: string;
  event?: string;
  eventData?: { outlet?: string; outletStatus?: string; message?: string };
}

export interface DistribeatsSyncProgress {
  type: string;
  phase: string;
  current?: number;
  total?: number;
  name?: string;
  title?: string;
  artistId?: string;
  success?: boolean;
  message?: string;
  successCount?: number;
}

export interface DistribeatsWebhookReceived {
  event: string;
  releaseId: string;
  title: string;
  at: string;
}

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  /** Join a per-release room so this client receives targeted release updates. */
  joinRelease: (releaseId: string) => void;
  leaveRelease: (releaseId: string) => void;
  /** Last ToneGrid status object received from the server (broadcasted after every check). */
  distribeatsStatus: any;
  /** Real-time feed of ToneGrid webhook events (admin). */
  webhookFeed: DistribeatsWebhookReceived[];
  /** Active sync progress state (bulk artist / release sync). */
  syncProgress: DistribeatsSyncProgress | null;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  joinRelease: () => {},
  leaveRelease: () => {},
  distribeatsStatus: null,
  webhookFeed: [],
  syncProgress: null,
});

export const useSocket = () => useContext(SocketContext);

// ── Provider ──────────────────────────────────────────────────────────────────
const SOCKET_URL = import.meta.env.VITE_API_URL
  ? new URL(import.meta.env.VITE_API_URL.replace('/api', ''), window.location.origin).origin
  : window.location.origin.replace(/:\d+$/, ':5000');

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [distribeatsStatus, setDistribeatsStatus] = useState<any>(null);
  const [webhookFeed, setWebhookFeed] = useState<DistribeatsWebhookReceived[]>([]);
  const [syncProgress, setSyncProgress] = useState<DistribeatsSyncProgress | null>(null);

  // Re-connect / disconnect whenever the JWT token changes (login / logout).
  useEffect(() => {
    const token =
      localStorage.getItem('hbe_token') ||
      sessionStorage.getItem('hbe_token');

    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    // Reuse existing connected socket.
    if (socketRef.current?.connected) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;
    const connectTimer = window.setTimeout(() => socket.connect(), 0);

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // ── ToneGrid real-time events ────────────────────────────────────────────
    socket.on('distribeats:status', (data: any) => {
      setDistribeatsStatus(data);
    });

    socket.on('distribeats:release_updated', (data: DistribeatsReleaseUpdate) => {
      // Dispatch a custom DOM event so any mounted component can react.
      window.dispatchEvent(new CustomEvent('hbe:distribeats_release_updated', { detail: data }));
    });

    socket.on('distribeats:sync_progress', (data: DistribeatsSyncProgress) => {
      setSyncProgress(data);
      // Clear progress 3 s after a bulk operation completes.
      if (data.phase === 'completed') {
        setTimeout(() => setSyncProgress(null), 3000);
      }
      // Surface errors as toast messages.
      if (data.phase === 'error') {
        toast.error(`Sync failed for "${data.name || data.title}": ${data.message}`);
      }
    });

    socket.on('distribeats:webhook_received', (data: DistribeatsWebhookReceived) => {
      setWebhookFeed(prev => [data, ...prev].slice(0, 50));
      // Map Distribeats webhook events to human-readable toast messages.
      const msg: Record<string, string> = {
        'release.submitted': `Release "${data.title}" submitted for review`,
        'release.screening_passed': `Screening passed for "${data.title}"`,
        'release.approved': `Release "${data.title}" approved & DDEX compiled 🎉`,
        'release.rejected': `Release "${data.title}" rejected — check the release`,
        'release.delivered': `"${data.title}" delivered to stores`,
        'release.store_live': `"${data.title}" is now live in stores 🎉`,
        'release.takedown_completed': `"${data.title}" taken down from stores`,
      };
      const message = msg[data.event] || `Distribeats event: ${data.event}`;
      if (data.event.includes('rejected') || data.event.includes('failed') || data.event.includes('error')) {
        toast.error(message);
      } else {
        toast.success(message, { duration: 6000, icon: '🎵' });
      }
    });

    return () => {
      window.clearTimeout(connectTimer);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, []);

  const joinRelease = useCallback((releaseId: string) => {
    socketRef.current?.emit('join:release', releaseId);
  }, []);

  const leaveRelease = useCallback((releaseId: string) => {
    socketRef.current?.emit('leave:release', releaseId);
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, joinRelease, leaveRelease, distribeatsStatus, webhookFeed, syncProgress }}>
      {children}
    </SocketContext.Provider>
  );
};
