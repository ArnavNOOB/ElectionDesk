/**
 * Utility for input sanitization, NoSQL injection prevention,
 * regex escaping, and CSV formula injection neutralization.
 */

/**
 * Escapes special characters for use in a regular expression.
 * Prevents regex injection and ReDoS attacks.
 */
export function escapeRegex(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&');
}

/**
 * Strips MongoDB query operators starting with '$' or containing '.'
 * to prevent NoSQL operator injection.
 */
export function sanitizeMongoInput(input) {
  if (input === null || typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeMongoInput);
  }

  const clean = {};
  for (const [key, value] of Object.entries(input)) {
    // Drop keys that start with '$' or contain '.'
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    clean[key] = sanitizeMongoInput(value);
  }
  return clean;
}

/**
 * Prevents CSV formula injection (OWASP ASVS / CWE-1236)
 * Prefixes cells starting with '=', '+', '-', '@', '\t', '\r' with a single quote.
 */
export function sanitizeCsvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Redacts sensitive fields from objects before logging
 */
export function redactSensitiveData(obj, keysToRedact = ['password', 'passwordHash', 'token', 'mfaSecret', 'secret']) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => redactSensitiveData(item, keysToRedact));

  const redacted = {};
  for (const [k, v] of Object.entries(obj)) {
    if (keysToRedact.some((key) => k.toLowerCase().includes(key.toLowerCase()))) {
      redacted[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      redacted[k] = redactSensitiveData(v, keysToRedact);
    } else {
      redacted[k] = v;
    }
  }
  return redacted;
}
