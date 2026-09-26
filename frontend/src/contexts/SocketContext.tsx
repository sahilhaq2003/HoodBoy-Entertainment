/**
 * SocketContext — provides a Socket.IO client instance to the entire React tree.
 *
 * The socket is lazily connected after the user logs in (token is present in
 * localStorage/sessionStorage) and automatically disconnected on logout.
 * All LabelGrid real-time events flow through this single connection.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface LabelGridReleaseUpdate {
  releaseId: string;
  title: string;
  status: string;
  qcStatus?: string;
  syncStatus?: string;
  labelgridRawStatus?: string;
  labelgridReleaseId?: string;
  storeStatuses?: { store: string; status: string; updatedAt?: string }[];
  uploadState?: Record<string, string>;
  lastSyncedAt?: string;
  lastSyncError?: string;
  event?: string;
  eventData?: { outlet?: string; outletStatus?: string; message?: string };
}

export interface LabelGridSyncProgress {
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
  labelgridArtistId?: string;
}

export interface LabelGridWebhookReceived {
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
  /** Last LabelGrid status object received from the server (broadcasted after every check). */
  labelgridStatus: any;
  /** Real-time feed of LabelGrid webhook events (admin). */
  webhookFeed: LabelGridWebhookReceived[];
  /** Active sync progress state (bulk artist / release sync). */
  syncProgress: LabelGridSyncProgress | null;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  joinRelease: () => {},
  leaveRelease: () => {},
  labelgridStatus: null,
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
  const [labelgridStatus, setLabelgridStatus] = useState<any>(null);
  const [webhookFeed, setWebhookFeed] = useState<LabelGridWebhookReceived[]>([]);
  const [syncProgress, setSyncProgress] = useState<LabelGridSyncProgress | null>(null);

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
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // ── LabelGrid real-time events ────────────────────────────────────────────
    socket.on('labelgrid:status', (data: any) => {
      setLabelgridStatus(data);
    });

    socket.on('labelgrid:release_updated', (data: LabelGridReleaseUpdate) => {
      // Dispatch a custom DOM event so any mounted component can react.
      window.dispatchEvent(new CustomEvent('hbe:labelgrid_release_updated', { detail: data }));
    });

    socket.on('labelgrid:sync_progress', (data: LabelGridSyncProgress) => {
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

    socket.on('labelgrid:webhook_received', (data: LabelGridWebhookReceived) => {
      setWebhookFeed(prev => [data, ...prev].slice(0, 50));
      // Map LabelGrid webhook events to human-readable toast messages.
      const msg: Record<string, string> = {
        'release.review.status_changed': `Release "${data.title}" review status changed`,
        'delivery.completed': `"${data.title}" delivered to a new store 🎉`,
        'delivery.failed': `"${data.title}" delivery failed — check the release`,
        'takedown.completed': `"${data.title}" taken down from all stores`,
        'audio.transcode.completed': `Audio transcoding complete for "${data.title}"`,
        'distribution.outlet.status_changed': `"${data.title}" outlet status updated`,
      };
      const message = msg[data.event] || `LabelGrid event: ${data.event}`;
      if (data.event.includes('failed') || data.event.includes('error')) {
        toast.error(message);
      } else {
        toast.success(message, { duration: 6000, icon: '🎵' });
      }
    });

    return () => {
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
    <SocketContext.Provider value={{ socket: socketRef.current, connected, joinRelease, leaveRelease, labelgridStatus, webhookFeed, syncProgress }}>
      {children}
    </SocketContext.Provider>
  );
};
