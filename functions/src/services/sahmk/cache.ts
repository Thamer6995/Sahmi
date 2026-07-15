/**
 * Cache بسيط في الذاكرة (in-memory) لتقليل الطلبات المتكررة خلال نفس دورة
 * التشغيل أو عبر استدعاءات متتالية على نفس Instance دافئة (warm instance).
 *
 * هذا Cache مكمّل فقط - المصدر الدائم لتفادي إعادة الجلب غير الضروري هو
 * حقول updatedAt في Firestore (يتحقق منها كل Repo قبل استدعاء SahmkService).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();

  constructor(private readonly defaultTtlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs) });
  }

  async getOrFetch(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await fetcher();
    this.set(key, value, ttlMs);
    return value;
  }

  clear(): void {
    this.store.clear();
  }
}

// Cache مشترك على مستوى الـ module (يعيش طالما الـ instance دافئة)
export const sahmkCache = new TtlCache<unknown>(5 * 60 * 1000); // 5 دقائق افتراضيًا
