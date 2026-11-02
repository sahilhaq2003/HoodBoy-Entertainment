import type { Artist } from '../types';

export const formatCurrency = (amount: number): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0';
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
};

export const formatNumber = (num: number): string => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toLocaleString();
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const daysUntil = (dateStr: string): number => {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export const getStatusClass = (status: string): string => {
  const map: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40',
    in_progress: 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800/40',
    not_started: 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700',
    delayed: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40',
    waiting_approval: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40',
    active: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40',
    released: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40',
    planned: 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700',
    expired: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40',
    upcoming: 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800/40',
    on_hold: 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/40',
    inactive: 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700',
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40',
    rejected: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40',
    pending_approval: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40',
    draft: 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700',
    pending_signature: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40',
    renewed: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40',
    terminated: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40',
    submitted: 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800/40',
    in_preparation: 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800/40',
    scheduled: 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700',
    cancelled: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40',
    paused: 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/40',
  };
  return map[status] || 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700';
};

export const getPriorityClass = (priority: string): string => {
  const map: Record<string, string> = {
    critical: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40',
    high: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40',
    medium: 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/40',
    low: 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700',
  };
  return map[priority] || 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700';
};

export const formatStatus = (status: string): string => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export const getInitials = (name: string): string => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export const getAvatarColor = (name: string): string => {
  const colors = [
    '#4F46E5',
    '#7C3AED',
    '#7C3AED',
    '#059669',
    '#DC2626',
    '#D97706',
    '#EC4899',
    '#0891B2',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
};

// ── Fast Artist & Image Preload Cache ─────────────────────────────────────────
const artistMemoryCache = new Map<string, Artist>();
const preloadedImages = new Set<string>();

export const preloadImageUrl = (url?: string | null): void => {
  if (!url || typeof window === 'undefined' || preloadedImages.has(url)) return;
  preloadedImages.add(url);
  const img = new window.Image();
  img.decoding = 'async';
  img.src = url;
};

export const preloadArtistMedia = (artist?: Partial<Artist> | null): void => {
  if (!artist) return;
  preloadImageUrl(artist.coverPhoto);
  preloadImageUrl(artist.image);
};

export const setCachedArtist = (artist?: Artist | null): void => {
  if (!artist?._id) return;
  artistMemoryCache.set(artist._id, artist);
  preloadArtistMedia(artist);
};

export const cacheArtists = (artists?: Artist[] | null): void => {
  if (!Array.isArray(artists)) return;
  artists.forEach(a => setCachedArtist(a));
};

export const getCachedArtist = (id?: string | null): Artist | null => {
  if (!id) return null;
  return artistMemoryCache.get(id) || null;
};

/**
 * Resize and compress profile/banner images on the client before upload so
 * banners and avatars download in milliseconds instead of multi-megabyte raw files.
 */
export const optimizeUploadImage = async (
  file: File,
  field: 'image' | 'coverPhoto' = 'image'
): Promise<File> => {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) return file;
  const maxWidth = field === 'coverPhoto' ? 1600 : 512;
  const maxHeight = field === 'coverPhoto' ? 720 : 512;

  return new Promise<File>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width <= maxWidth && height <= maxHeight && file.size <= 180 * 1024) {
        resolve(file);
        return;
      }
      const scale = Math.min(maxWidth / width, maxHeight / height, 1);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const outputType = 'image/webp';
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, '') || field;
          resolve(new File([blob], `${baseName}.webp`, { type: outputType }));
        },
        outputType,
        0.88
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
};
