import { SAHMK_API_KEY, SAHMK_BASE_URL } from '../../config/env';
import { logger } from '../../utils/logger';
import { SahmkApiError, SahmkErrorKind } from './types';
import { assertWithinDailyBudget, recordApiRequest } from './rateTracker';

const MAX_RETRIES = 3;
const BACKOFF_FACTOR_MS = 500; // 0.5s -> 1s -> 2s، مطابق لسلوك SDK الرسمي
const REQUEST_TIMEOUT_MS = 15_000;

// عند 429، بعض الأحيان تطلب SAHMK انتظارًا أطول بكثير من الـ backoff
// الأسّي القصير أعلاه (لوحظ فعليًا حتى 30 ثانية أثناء تحديث شامل لكامل
// السوق) - مؤكَّد من رسالة الخطأ نفسها "Expected available in N seconds".
// بدون احترام هذه القيمة، إعادة المحاولة تفشل بشكل دائم لعشرات الرموز في
// كل تحديث أسبوعي رغم أن البيانات متاحة فعليًا بعد انتظار كافٍ.
const MAX_RATE_LIMIT_RETRIES = 6;
const MAX_RATE_LIMIT_WAIT_MS = 35_000;

function parseRetryAfterMs(bodyText: string): number | undefined {
  const match = bodyText.match(/available in\s+([\d.]+)\s*second/i);
  if (!match) return undefined;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds)) return undefined;
  return Math.min(Math.ceil(seconds * 1000) + 500, MAX_RATE_LIMIT_WAIT_MS); // +500ms هامش أمان
}

interface RequestOptions {
  query?: Record<string, string | number | string[] | undefined>;
  /** لا تُعِد المحاولة تلقائيًا (تُستخدم لطلبات ذات كلفة خاصة إن لزم) */
  noRetry?: boolean;
  /** إشارة إلغاء تعاوني (من jobLock.ts للمهام المجدولة) - تُنهي الطلب/إعادة المحاولة فورًا عند التفعيل. */
  signal?: AbortSignal;
}

function abortError(path: string): SahmkApiError {
  return new SahmkApiError('UNKNOWN', `أُلغي الطلب على ${path} (AbortSignal)`, path);
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const url = new URL(baseUrl.replace(/\/$/, '') + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        url.searchParams.set(key, value.join(','));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function classifyError(status: number): SahmkErrorKind {
  if (status === 401 || status === 403) {
    // SAHMK قد تُرجع 403 لكل من مفتاح غير صحيح أو تجاوز حدود الباقة.
    // نميّزها لاحقًا عبر نص الاستجابة إن أمكن.
    return 'PLAN_LIMIT';
  }
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ينفّذ طلب GET واحد إلى SAHMK API مع:
 * - إضافة X-API-Key من Secret (لا يظهر أبدًا في السجلات).
 * - Retry تلقائي مع exponential backoff للأخطاء المؤقتة (429 و5xx فقط).
 * - Timeout للطلبات المعلّقة.
 * - تسجيل عدّاد الاستخدام اليومي التقريبي في Firestore.
 * - رفض الطلب مسبقًا إذا تجاوزنا السقف اليومي المحدد (5000).
 */
export async function sahmkGet<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  if (options.signal?.aborted) throw abortError(path);
  await assertWithinDailyBudget();

  const baseUrl = SAHMK_BASE_URL();
  const apiKey = SAHMK_API_KEY();
  const url = buildUrl(baseUrl, path, options.query);

  let lastError: SahmkApiError | undefined;
  // سقف المحاولات ديناميكي: يبدأ بالحد العادي، ويمتد فقط إذا واجهنا فعليًا
  // 429 (تحتاج انتظارًا أطول من الأخطاء الأخرى القابلة لإعادة المحاولة).
  let maxAttempts = options.noRetry ? 1 : MAX_RETRIES + 1;
  let nextDelayMs: number | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // فحص الإلغاء قبل بدء أي محاولة جديدة - لا نبدأ طلب HTTP جديد بعد الإلغاء
    if (options.signal?.aborted) throw abortError(path);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    // نربط إشارة الإلغاء التعاوني (إن وُجدت) بمتحكّم هذه المحاولة تحديدًا،
    // حتى يتوقف الطلب الحالي فورًا بدل انتظار مهلة الـ15 ثانية كاملة.
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onExternalAbort);

    try {
      await recordApiRequest(path);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const json = (await response.json()) as T;
        return json;
      }

      const kind = classifyError(response.status);
      const bodyText = await response.text().catch(() => '');
      const err = new SahmkApiError(
        kind,
        `SAHMK API error ${response.status} على ${path}`,
        path,
        response.status
      );

      // لا تُعِد المحاولة على أخطاء لا تُصلحها إعادة المحاولة
      const retryable = kind === 'RATE_LIMITED' || kind === 'SERVER_ERROR';
      logger.warn('sahmk_request_failed', {
        path,
        status: response.status,
        kind,
        attempt,
        retryable,
        bodySnippet: bodyText.slice(0, 300),
      });

      if (!retryable) {
        throw err;
      }

      if (kind === 'RATE_LIMITED' && !options.noRetry) {
        maxAttempts = Math.max(maxAttempts, MAX_RATE_LIMIT_RETRIES + 1);
        nextDelayMs = parseRetryAfterMs(bodyText);
      }

      if (attempt === maxAttempts - 1) {
        throw err;
      }
      lastError = err;
    } catch (error) {
      clearTimeout(timeout);
      if (options.signal?.aborted) {
        // الإلغاء جاء من الإشارة التعاونية الخارجية (jobLock) لا من مهلتنا الداخلية -
        // نرمي فورًا بدون أي إعادة محاولة إطلاقًا.
        logger.warn('sahmk_request_aborted', { path, attempt });
        throw abortError(path);
      }
      if (error instanceof SahmkApiError) {
        if (attempt === maxAttempts - 1) throw error;
        lastError = error;
      } else if ((error as Error).name === 'AbortError') {
        const timeoutErr = new SahmkApiError('TIMEOUT', `انتهت مهلة الطلب على ${path}`, path);
        logger.warn('sahmk_request_timeout', { path, attempt });
        if (attempt === maxAttempts - 1) throw timeoutErr;
        lastError = timeoutErr;
      } else {
        const unknownErr = new SahmkApiError(
          'UNKNOWN',
          `خطأ غير متوقع أثناء الاتصال بـ SAHMK: ${(error as Error).message}`,
          path
        );
        logger.error('sahmk_request_unknown_error', { path, message: (error as Error).message });
        if (attempt === maxAttempts - 1) throw unknownErr;
        lastError = unknownErr;
      }
    } finally {
      options.signal?.removeEventListener('abort', onExternalAbort);
    }

    // لا تنتظر (backoff) إذا طُلِب الإلغاء أثناء الانتظار بين المحاولات
    if (options.signal?.aborted) throw abortError(path);

    const delay = nextDelayMs ?? BACKOFF_FACTOR_MS * Math.pow(2, attempt);
    nextDelayMs = undefined;
    await sleep(delay);
  }

  // لن نصل هنا عمليًا لكن TypeScript يحتاج مسارًا نهائيًا
  throw lastError ?? new SahmkApiError('UNKNOWN', `فشل الطلب على ${path} بدون سبب محدد`, path);
}
