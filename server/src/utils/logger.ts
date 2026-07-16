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

function format(level: string, message: string, data?: Record<string, unknown>): string {
  const entry = { level, message, ...(data ? { data: redact(data) } : {}), time: new Date().toISOString() };
  return JSON.stringify(entry);
}

export const logger = {
  info: (message: string, data?: Record<string, unknown>) => console.log(format('info', message, data)),
  warn: (message: string, data?: Record<string, unknown>) => console.warn(format('warn', message, data)),
  error: (message: string, data?: Record<string, unknown>) => console.error(format('error', message, data)),
};
