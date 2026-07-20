// rateLimit.ts لم يعد يستخدم Firestore إطلاقًا (Storage Refactor Phase 1:
// أُزيلت مجموعة _rateLimits ونُقل العدّاد بالكامل للذاكرة). هذا mock يرمي
// خطأً فورًا لو استُدعي getFirestore من أي مكان - إثبات مباشر أن الحد لا
// يلمس Firestore بتاتًا.
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => {
    throw new Error('rateLimit يجب ألا يلمس Firestore إطلاقًا بعد Storage Refactor Phase 1');
  },
}));

import { enforceRateLimit } from './rateLimit';

describe('enforceRateLimit - نافذة ثابتة بالذاكرة فقط', () => {
  it('4. لا يلمس Firestore إطلاقًا عبر عدة استدعاءات، بعضها ضمن الحد وبعضها خارجه', async () => {
    const key = `test-key-${Date.now()}-a`;

    // أول 3 استدعاءات ضمن الحد (maxCalls=3) يجب أن تمر بدون خطأ
    await expect(enforceRateLimit(key, 3, 3600)).resolves.toBeUndefined();
    await expect(enforceRateLimit(key, 3, 3600)).resolves.toBeUndefined();
    await expect(enforceRateLimit(key, 3, 3600)).resolves.toBeUndefined();

    // الاستدعاء الرابع يتجاوز الحد - يجب أن يرمي (وليس Firestore mock)
    await expect(enforceRateLimit(key, 3, 3600)).rejects.toThrow();
  });

  it('مفاتيح مختلفة لا تتشارك نفس العداد', async () => {
    const keyA = `test-key-${Date.now()}-b1`;
    const keyB = `test-key-${Date.now()}-b2`;

    await enforceRateLimit(keyA, 1, 3600);
    await expect(enforceRateLimit(keyA, 1, 3600)).rejects.toThrow(); // keyA استنفد حده

    await expect(enforceRateLimit(keyB, 1, 3600)).resolves.toBeUndefined(); // keyB مستقل تمامًا
  });

  it('نافذة زمنية مختلفة (windowSeconds صغير) تسمح بتجاوز الحد بعد انتهاء النافذة القديمة', async () => {
    const key = `test-key-${Date.now()}-c`;

    await enforceRateLimit(key, 1, 1); // نافذة ثانية واحدة فقط
    await expect(enforceRateLimit(key, 1, 1)).rejects.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 1100)); // ننتظر تجاوز النافذة

    await expect(enforceRateLimit(key, 1, 1)).resolves.toBeUndefined();
  });
});
