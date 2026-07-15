import { logger as fnLogger } from 'firebase-functions/v2';

const SECRET_PATTERNS: RegExp[] = [
  /sahmk_api_key/i,
  /x-api-key/i,
  /telegram_bot_token/i,
  /bot\d+:[A-Za-z0-9_-]+/, // شكل توكن تيليجرام bot<id>:<token>
];

/**
 * يزيل أي قيمة يُحتمل أنها سر من نص السجل قبل طباعته، حتى لو مرّرها
 * المستدعي عن طريق الخطأ ضمن كائن الخطأ أو الرسالة.
 */
function redact(value: unknown): unknown {
  if (typeof value === 'string') {
    let redacted = value;
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(redacted)) {
        redacted = redacted.replace(pattern, '[REDACTED]');
      }
    }
    return redacted;
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/api[_-]?key|token|secret|authorization/i.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

export const logger = {
  info: (message: string, data?: Record<string, unknown>) =>
    fnLogger.info(message, data ? (redact(data) as Record<string, unknown>) : undefined),
  warn: (message: string, data?: Record<string, unknown>) =>
    fnLogger.warn(message, data ? (redact(data) as Record<string, unknown>) : undefined),
  error: (message: string, data?: Record<string, unknown>) =>
    fnLogger.error(message, data ? (redact(data) as Record<string, unknown>) : undefined),
};
