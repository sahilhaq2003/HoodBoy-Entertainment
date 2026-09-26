class LabelGridError extends Error {
  constructor(message, { code = 'LABELGRID_ERROR', status = 502, details, retryable = false } = {}) {
    super(message);
    this.name = 'LabelGridError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.retryable = retryable;
  }
}

const safeMessage = (status) => {
  if (status === 401 || status === 403) return 'LabelGrid authentication failed.';
  if (status === 422) return 'LabelGrid rejected the submitted metadata.';
  if (status === 429) return 'LabelGrid rate limit reached. Please try again shortly.';
  if (status >= 500) return 'LabelGrid is temporarily unavailable.';
  return 'Unable to complete the LabelGrid request.';
};

module.exports = { LabelGridError, safeMessage };
