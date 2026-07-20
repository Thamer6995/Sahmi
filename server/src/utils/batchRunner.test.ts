// batchRunner.ts لم يعد يستخدم Firestore إطلاقًا (Storage Refactor Phase 1:
// أُزيلت مجموعة syncJobs كليًا لأنه لا يوجد لها أي مستهلك فعلي في المشروع).
// هذا mock يرمي خطأً فورًا لو استُدعي getFirestore من أي مكان أثناء
// runBatched - أقوى إثبات ممكن أن "لا مستند جديد يُنشأ إطلاقًا" (وبالتالي لا
// نمو بلا سقف، بدل الاكتفاء بتحديد سقف 20 تشغيلة).
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => {
    throw new Error('batchRunner يجب ألا يلمس Firestore إطلاقًا بعد Storage Refactor Phase 1');
  },
}));

import { runBatched } from './batchRunner';

describe('runBatched - إزالة كتابات syncJobs بالكامل', () => {
  it('3. لا يلمس Firestore إطلاقًا حتى مع عدد كبير من العناصر ودفعات متعددة (لا نمو بلا سقف لأنه لا يوجد نمو إطلاقًا)', async () => {
    const items = Array.from({ length: 130 }, (_, i) => `SYM${i}`);
    const processed: string[] = [];

    const summary = await runBatched(
      'test-job',
      items,
      (item) => item,
      async (item) => {
        processed.push(item);
      },
      25
    );

    expect(processed.length).toBe(130);
    expect(summary.total).toBe(130);
    expect(summary.succeeded).toBe(130);
    expect(summary.failed).toBe(0);
    expect(summary.cancelled).toBe(false);
    expect(typeof summary.jobId).toBe('string');
    expect(summary.jobId.length).toBeGreaterThan(0);
  });

  it('تشغيل نفس المهمة عدة مرات متتالية (يحاكي تشغيلات مجدولة متكررة) لا يزال بدون أي لمسة Firestore', async () => {
    for (let run = 0; run < 25; run++) {
      const summary = await runBatched(
        'repeated-job',
        ['A', 'B', 'C'],
        (item) => item,
        async () => {},
        25
      );
      expect(summary.succeeded).toBe(3);
    }
    // لو runBatched لمس Firestore في أي تشغيلة من الـ 25، الـ mock أعلاه كان سيرمي خطأ ويفشل الاختبار
  });

  it('فشل عنصر واحد لا يوقف الباقي، ولا يزال بدون Firestore', async () => {
    const summary = await runBatched(
      'partial-failure-job',
      ['A', 'B', 'C'],
      (item) => item,
      async (item) => {
        if (item === 'B') throw new Error('boom');
      },
      25
    );

    expect(summary.succeeded).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.errors).toEqual([{ item: 'B', message: 'boom' }]);
  });

  it('الإلغاء عبر AbortSignal يوقف الدفعات القادمة (cancelled=true) دون أي كتابة Firestore', async () => {
    const controller = new AbortController();
    const processed: string[] = [];

    const items = Array.from({ length: 10 }, (_, i) => `S${i}`);
    const summary = await runBatched(
      'cancel-job',
      items,
      (item) => item,
      async (item) => {
        processed.push(item);
        if (item === 'S1') controller.abort();
      },
      2,
      controller.signal
    );

    expect(summary.cancelled).toBe(true);
    expect(processed.length).toBeLessThan(10);
  });
});
