const { LabelGridError, safeMessage } = require('./labelgridErrors');

const DEFAULT_BASE_URL = 'https://api.labelgrid.com/api/public';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class LabelGridClient {
  constructor({ baseUrl = process.env.LABELGRID_BASE_URL || DEFAULT_BASE_URL, token = process.env.LABELGRID_API_TOKEN } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/$/, '');
    this.token = token;
  }

  isConfigured() { return Boolean(this.token); }

  async request(path, { method = 'GET', query, body, headers = {}, retries = 2 } = {}) {
    if (!this.token) throw new LabelGridError('LabelGrid is not configured.', { code: 'LABELGRID_NOT_CONFIGURED', status: 503 });
    const url = new URL(`${this.baseUrl}/${String(path).replace(/^\//, '')}`);
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      (Array.isArray(value) ? value : [value]).forEach(item => url.searchParams.append(key, String(item)));
    });
    const options = { method, headers: { Accept: 'application/json', Authorization: `Bearer ${this.token}`, ...headers } };
    if (body !== undefined) {
      if (body instanceof FormData || Buffer.isBuffer(body)) options.body = body;
      else { options.body = JSON.stringify(body); options.headers['Content-Type'] = 'application/json'; }
    }
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      let response;
      try { response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) }); }
      catch (error) {
        if (attempt < retries) { await sleep(250 * (2 ** attempt)); continue; }
        throw new LabelGridError('LabelGrid is temporarily unavailable.', { code: 'LABELGRID_UNAVAILABLE', details: error.message, retryable: true });
      }
      const text = await response.text();
      let data = null;
      if (text) { try { data = JSON.parse(text); } catch { data = text; } }
      if (response.ok) return data;
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < retries) {
        const retryAfter = Number(response.headers.get('retry-after'));
        await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 300 * (2 ** attempt));
        continue;
      }
      throw new LabelGridError(safeMessage(response.status), {
        code: response.status === 401 || response.status === 403 ? 'LABELGRID_AUTHENTICATION_ERROR' : `LABELGRID_HTTP_${response.status}`,
        status: response.status, details: data, retryable,
      });
    }
  }

  get(path, query) { return this.request(path, { query }); }
  post(path, body) { return this.request(path, { method: 'POST', body }); }
  patch(path, body) { return this.request(path, { method: 'PATCH', body }); }
  put(path, body) { return this.request(path, { method: 'PUT', body }); }
}

module.exports = { LabelGridClient, DEFAULT_BASE_URL };
