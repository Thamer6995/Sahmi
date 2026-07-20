import { withJobLock } from './jobLock';
import { logger } from './logger';

function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** يحاكي مهمة معلّقة تتجاوز أي مهلة معقولة في الاختبار (تنتهي لاحقًا بلا تأثير على النتائج). */
function hangingTask<T>(value: T): Promise<T> {
  return delay(300, value);
}

describe('withJobLock', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ينفّذ المهمة بنجاح ويرجع النتيجة عند التشغيل الطبيعي', async () => {
    const outcome = await withJobLock('normal-run', () => delay(10, 'done'), 1000);
    expect(outcome).toEqual({ status: 'completed', result: 'done' });
  });

  it('يرفض تشغيلًا متزامنًا ثانيًا لنفس المفتاح أثناء تشغيل الأول (busy)', async () => {
    const warnSpy = jest.spyOn(logger, 'warn');

    const first = withJobLock('concurrent-run', () => delay(50, 'first'), 1000);
    await delay(5, undefined); // نتأكد إن الأول أخذ القفل فعليًا قبل محاولة الثاني

    const second = await withJobLock('concurrent-run', () => delay(10, 'second'), 1000);
    expect(second).toEqual({ status: 'busy' });
    expect(warnSpy).toHaveBeenCalledWith('job_lock_rejected_busy', { jobKey: 'concurrent-run' });

    const firstOutcome = await first;
    expect(firstOutcome).toEqual({ status: 'completed', result: 'first' });
  });

  it('يرجع timeout عندما تتجاوز المهمة المهلة المحددة، ويحرّر القفل فورًا', async () => {
    const warnSpy = jest.spyOn(logger, 'warn');

    const outcome = await withJobLock('timeout-run', () => hangingTask('too-late'), 30);
    expect(outcome).toEqual({ status: 'timeout' });
    expect(warnSpy).toHaveBeenCalledWith('job_lock_timeout', { jobKey: 'timeout-run', timeoutMs: 30 });

    // ننتظر اكتمال المهمة "المهملة" بالخلفية حتى لا تتسرب لاختبارات لاحقة
    await delay(300, undefined);
  });

  it('يسمح بتشغيل مهمة جديدة بنفس المفتاح مباشرة بعد انتهاء المهلة (لا تعليق دائم)', async () => {
    const timedOut = await withJobLock('post-timeout-run', () => hangingTask('abandoned'), 30);
    expect(timedOut).toEqual({ status: 'timeout' });

    // فور انتهاء المهلة، القفل محرَّر - تشغيلة جديدة بنفس المفتاح يجب أن تنجح فورًا
    const fresh = await withJobLock('post-timeout-run', () => delay(10, 'fresh-run'), 1000);
    expect(fresh).toEqual({ status: 'completed', result: 'fresh-run' });

    await delay(300, undefined); // تنظيف: انتظار اكتمال المهمة المهملة الأولى بالخلفية
  });

  it('يحرّر القفل بعد فشل المهمة (استثناء)، ويسمح بتشغيل جديد بعده مباشرة', async () => {
    await expect(withJobLock('failing-run', () => Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');

    // القفل يجب أن يكون محرَّرًا فورًا (عبر finally) رغم فشل المهمة الأولى
    const outcome = await withJobLock('failing-run', () => delay(10, 'after-error'), 1000);
    expect(outcome).toEqual({ status: 'completed', result: 'after-error' });
  });

  it('يسجّل الحصول على القفل وتحريره عند التشغيل الطبيعي', async () => {
    const infoSpy = jest.spyOn(logger, 'info');

    await withJobLock('logging-run', () => delay(5, 'ok'), 1000);

    expect(infoSpy).toHaveBeenCalledWith('job_lock_acquired', { jobKey: 'logging-run', timeoutMs: 1000 });
    expect(infoSpy).toHaveBeenCalledWith('job_lock_released', { jobKey: 'logging-run' });
  });
});
