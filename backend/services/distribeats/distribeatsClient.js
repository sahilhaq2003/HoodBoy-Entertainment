const DEFAULT_BASE_URL = 'https://distribeats.com/api/public/v1';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class DistribeatsError extends Error {
  constructor(message, { code = 'DISTRIBEATS_ERROR', status = 502, details, retryable = false } = {}) {
    super(message);
    this.name = 'DistribeatsError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.retryable = retryable;
  }
}

class DistribeatsClient {
  constructor({ baseUrl = process.env.DISTRIBEATS_BASE_URL || DEFAULT_BASE_URL, token = process.env.DISTRIBEATS_API_KEY } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/$/, '');
    this.token = token;
  }

  isConfigured() { return Boolean(this.token && /^db_(?:test|live)_/.test(this.token)); }

  async request(path, { method = 'GET', query, body, headers = {}, retries = 2, idempotencyKey, timeout = 30000, requireAuth = true } = {}) {
    if (requireAuth && !this.isConfigured()) throw new DistribeatsError('Distribeats API key is not configured or has an invalid prefix.', { code: 'DISTRIBEATS_NOT_CONFIGURED', status: 503 });
    // Fail closed: a live key is refused (before any network call) unless the server explicitly enables production.
    if (requireAuth) require('./distribeatsPolicy').assertKeyAllowed(this.token);
    const url = new URL(/^https?:\/\//i.test(path) ? path : `${this.baseUrl}/${String(path).replace(/^\//, '')}`);
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
    // Public calls (e.g. GET /catalogue) never carry a key that policy would refuse for authenticated calls.
    const keyUsable = this.isConfigured() && (requireAuth || (this.token.startsWith('db_test_') || require('./distribeatsPolicy').isLiveAllowed()));
    const requestHeaders = { Accept: 'application/json', ...(keyUsable ? { Authorization: `Bearer ${this.token}` } : {}), ...headers };
    if (idempotencyKey) requestHeaders['Idempotency-Key'] = idempotencyKey;
    let requestBody = body;
    if (body !== undefined && body !== null && !Buffer.isBuffer(body)) {
      requestBody = JSON.stringify(body);
      requestHeaders['Content-Type'] = 'application/json';
    }
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      let response;
      try { response = await fetch(url, { method, headers: requestHeaders, body: requestBody, signal: AbortSignal.timeout(timeout) }); }
      catch (error) {
        if (attempt < retries) { await sleep(300 * (2 ** attempt)); continue; }
        throw new DistribeatsError('Distribeats is temporarily unavailable.', { code: 'DISTRIBEATS_UNAVAILABLE', details: error.message, retryable: true });
      }
      const contentType = response.headers.get('content-type') || '';
      const raw = await response.text();
      let data = raw;
      if (raw && contentType.includes('json')) { try { data = JSON.parse(raw); } catch {} }
      if (response.ok) return data || null;
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < retries) {
        const reset = Number(response.headers.get('x-ratelimit-reset'));
        const delay = Number.isFinite(reset) && reset > Date.now() / 1000 ? (reset * 1000) - Date.now() : 400 * (2 ** attempt);
        await sleep(Math.min(Math.max(delay, 250), 10000));
        continue;
      }
      const apiError = data?.error || {};
      throw new DistribeatsError(apiError.message || data?.message || `Distribeats request failed (${response.status}).`, {
        code: apiError.type || `DISTRIBEATS_HTTP_${response.status}`,
        status: response.status,
        details: data,
        retryable,
      });
    }
  }

  get(path, query, options = {}) { return this.request(path, { ...options, query }); }
  post(path, body, options = {}) { return this.request(path, { ...options, method: 'POST', body }); }
  put(path, body, options = {}) { return this.request(path, { ...options, method: 'PUT', body }); }
  delete(path, options = {}) { return this.request(path, { ...options, method: 'DELETE' }); }
}

module.exports = { DistribeatsClient, DistribeatsError, DEFAULT_BASE_URL };
