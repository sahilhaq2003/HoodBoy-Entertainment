/**
 * Server-side safety policy for the DistriBeats integration.
 *
 * - Test-only by default: db_live_ keys are refused unless DISTRIBEATS_ALLOW_LIVE=true.
 * - Fails closed when the key is missing or malformed.
 * - Release-date lead time and audio size limits are enforced here, never only in the browser.
 *
 * Nothing in this file ever returns or logs the API key itself.
 */

const DEFAULT_MIN_LEAD_DAYS = 9; // DistriBeats: "At least 9 calendar days" (plan-specific values are not exposed by the API)
const DEFAULT_MAX_AUDIO_BYTES = 300 * 1024 * 1024; // 300 MB upload boundary (overridden by catalogue.masterLimitBytes when present)
const DEFAULT_MAX_COVER_BYTES = 25 * 1024 * 1024;

const policyError = (message, code, status) => {
  const { DistribeatsError } = require('./distribeatsClient');
  return new DistribeatsError(message, { code, status });
};

/** 'test' | 'live' | 'invalid' | 'none' — derived from the prefix only. */
const keyMode = token => {
  const value = String(token || '');
  if (!value) return 'none';
  if (value.startsWith('db_test_')) return 'test';
  if (value.startsWith('db_live_')) return 'live';
  return 'invalid';
};

const isLiveAllowed = (env = process.env) => String(env.DISTRIBEATS_ALLOW_LIVE || '').toLowerCase() === 'true';

/** Throws unless the key may be used for authenticated calls under the current server policy. */
const assertKeyAllowed = (token = process.env.DISTRIBEATS_API_KEY, env = process.env) => {
  const mode = keyMode(token);
  if (mode === 'none' || mode === 'invalid') {
    throw policyError('Distribeats API key is not configured or has an invalid prefix.', 'DISTRIBEATS_NOT_CONFIGURED', 503);
  }
  if (mode === 'live' && !isLiveAllowed(env)) {
    throw policyError(
      'A live Distribeats API key (db_live_) is blocked. This server is in TEST mode; use a db_test_ key or explicitly set DISTRIBEATS_ALLOW_LIVE=true.',
      'DISTRIBEATS_LIVE_KEY_BLOCKED',
      403,
    );
  }
  return mode;
};

const describeMode = (token = process.env.DISTRIBEATS_API_KEY, env = process.env) => {
  const mode = keyMode(token);
  return {
    keyMode: mode,
    testMode: mode !== 'live' || !isLiveAllowed(env),
    liveAllowed: isLiveAllowed(env),
    liveBlocked: mode === 'live' && !isLiveAllowed(env),
  };
};

/* ── Release-date lead time ─────────────────────────────────────────────── */

const leadTimeConfig = (env = process.env) => {
  const days = Number.parseInt(env.DISTRIBEATS_MIN_LEAD_DAYS, 10);
  const unit = String(env.DISTRIBEATS_MIN_LEAD_UNIT || 'calendar').toLowerCase() === 'working' ? 'working' : 'calendar';
  return { days: Number.isFinite(days) && days > 0 ? days : DEFAULT_MIN_LEAD_DAYS, unit };
};

const utcDay = date => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/** Earliest allowed release date (UTC midnight). Working days are Mon–Fri and exclude the submission day. */
const earliestReleaseDate = (from = new Date(), config = leadTimeConfig()) => {
  const cursor = new Date(utcDay(from));
  if (config.unit === 'calendar') {
    cursor.setUTCDate(cursor.getUTCDate() + config.days);
    return cursor;
  }
  let remaining = config.days;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return cursor;
};

const parseDateOnly = value => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(utcDay(value));
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Returns an error message, or null when the date satisfies the configured lead time. */
const releaseDateError = (value, { now = new Date(), config = leadTimeConfig() } = {}) => {
  const date = parseDateOnly(value);
  if (!date) return 'Release date is required (YYYY-MM-DD).';
  const earliest = earliestReleaseDate(now, config);
  if (date < earliest) {
    return `Release date must be at least ${config.days} ${config.unit} day${config.days === 1 ? '' : 's'} from today (earliest ${earliest.toISOString().slice(0, 10)}). Your plan may require longer.`;
  }
  return null;
};

/* ── File limits ────────────────────────────────────────────────────────── */

/** Audio limit: uses DISTRIBEATS_MAX_AUDIO_BYTES if set, else catalogue.masterLimitBytes, else 300 MB default. */
const maxAudioBytes = (catalogue, env = process.env) => {
  const configured = Number.parseInt(env.DISTRIBEATS_MAX_AUDIO_BYTES, 10);
  if (Number.isFinite(configured) && configured > 0) return configured;
  const provider = Number(catalogue?.masterLimitBytes);
  return Number.isFinite(provider) && provider > 0 ? provider : DEFAULT_MAX_AUDIO_BYTES;
};

const maxCoverBytes = (env = process.env) => {
  const configured = Number.parseInt(env.DISTRIBEATS_MAX_COVER_BYTES, 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_COVER_BYTES;
};

const ARTWORK_SPEC = Object.freeze({ width: 3000, height: 3000, formats: ['JPG', 'PNG'], colorSpace: 'RGB' });

module.exports = {
  keyMode, isLiveAllowed, assertKeyAllowed, describeMode,
  leadTimeConfig, earliestReleaseDate, releaseDateError, parseDateOnly,
  maxAudioBytes, maxCoverBytes, ARTWORK_SPEC,
  DEFAULT_MIN_LEAD_DAYS, DEFAULT_MAX_AUDIO_BYTES,
};

