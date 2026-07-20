import { withJobLock } from './jobLock';
import { logger } from './logger';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function delayValue<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

describe('withJobLock', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. المهمة الطبيعية تنتهي وتحرر القفل (تشغيلة تالية تنجح فورًا)', async () => {
    const outcome = await withJobLock('scenario-1', async () => 'ok', 1000, 50);
    expect(outcome).toEqual({ status: 'completed', result: 'ok' });

    const second = await withJobLock('scenario-1', async () => 'ok2', 1000, 50);
    expect(second).toEqual({ status: 'completed', result: 'ok2' });
  });

  it('2. تشغيل متزامن ثانٍ لنفس المفتاح يرجع busy', async () => {
    const first = withJobLock('scenario-2', () => delayValue(50, 'first'), 1000, 50);
    await delay(5); // تأكيد إن الأول أخذ القفل فعليًا
    const second = await withJobLock('scenario-2', () => delayValue(10, 'second'), 1000, 50);
    expect(second).toEqual({ status: 'busy' });
    await first;
  });

  it('3. عند انتهاء المهلة يُستدعى controller.abort() فعليًا (المهمة تلاحظه)', async () => {
    let observedAborted = false;
    const task = (signal: AbortSignal) =>
      new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => {
          observedAborted = true;
          resolve();
        });
      });

    const warnSpy = jest.spyOn(logger, 'warn');
    const outcome = await withJobLock('scenario-3', task, 30, 50);

    expect(observedAborted).toBe(true);
    expect(outcome).toEqual({ status: 'timed_out_and_cancelled' });
    expect(warnSpy).toHaveBeenCalledWith('job_lock_abort_requested', { jobKey: 'scenario-3' });
  });

  it('4. loop تجريبية تتوقف عن تنفيذ خطوات إضافية بعد abort', async () => {
    const stepsExecuted: number[] = [];
    const task = async (signal: AbortSignal) => {
      for (let i = 0; i < 100; i++) {
        if (signal.aborted) break;
        stepsExecuted.push(i);
        await delay(10);
      }
    };

    await withJobLock('scenario-4', task, 25, 100);
    const countRightAfter = stepsExecuted.length;
    await delay(100); // هامش إضافي للتأكد إنها فعليًا توقفت ولا تضيف خطوات جديدة
    expect(stepsExecuted.length).toBe(countRightAfter);
    expect(stepsExecuted.length).toBeLessThan(100);
  });

  it('5. لا تبدأ كتابات وهمية جديدة بعد abort', async () => {
    let writesStarted = 0;
    const task = async (signal: AbortSignal) => {
      for (let i = 0; i < 20; i++) {
        if (signal.aborted) break;
        writesStarted += 1; // محاكاة عملية كتابة (Firestore/SAHMK) لعنصر جديد
        await delay(10);
      }
    };

    await withJobLock('scenario-5', task, 25, 100);
    const writesRightAfter = writesStarted;
    await delay(100);
    expect(writesStarted).toBe(writesRightAfter); // ما زادت الكتابات بعد التوقف
    expect(writesStarted).toBeLessThan(20);
  });

  it('6. بعد تأكيد توقف المهمة القديمة (استجابت للإلغاء)، تشغيلة جديدة تحصل على القفل بنجاح', async () => {
    const task = (signal: AbortSignal) =>
      new Promise<string>((resolve) => {
        signal.addEventListener('abort', () => resolve('cancelled-cooperatively'));
      });

    const timedOut = await withJobLock('scenario-6', task, 30, 50);
    expect(timedOut).toEqual({ status: 'timed_out_and_cancelled' });

    const fresh = await withJobLock('scenario-6', async () => 'fresh-run', 1000, 50);
    expect(fresh).toEqual({ status: 'completed', result: 'fresh-run' });
  });

  it('7. مهمة تتجاهل AbortSignal وتستمر - النظام لا يسمح بتشغيلة ثانية متزامنة معها', async () => {
    const errorSpy = jest.spyOn(logger, 'error');
    // مهمة "سيئة" تتجاهل الإشارة كليًا وتستمر 300ms بغض النظر عن الإلغاء
    const ignoresAbort = () => delayValue(300, 'ignored-abort');

    const timedOut = await withJobLock('scenario-7', ignoresAbort, 20, 30);
    expect(timedOut).toEqual({ status: 'timed_out_but_still_running' });
    expect(errorSpy).toHaveBeenCalledWith('job_lock_unresponsive_after_grace', {
      jobKey: 'scenario-7',
      timeoutMs: 20,
      abortGraceMs: 30,
    });

    // محاولة تشغيل جديدة فورًا بنفس المفتاح - يجب أن ترجع busy، ليس completed
    const secondAttemptWhileStillRunning = await withJobLock('scenario-7', async () => 'should-not-run', 1000, 50);
    expect(secondAttemptWhileStillRunning).toEqual({ status: 'busy' });

    // ننتظر المهمة الأصلية تستقر فعليًا (300ms) حتى يتحرر القفل بالخلفية
    await delay(320);
    const afterOriginalSettles = await withJobLock('scenario-7', async () => 'now-allowed', 1000, 50);
    expect(afterOriginalSettles).toEqual({ status: 'completed', result: 'now-allowed' });
  });

  it('8. لا يوجد Unhandled Promise Rejection حتى مع رفض متأخر بعد انتهاء مهلة السماح', async () => {
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
    process.on('unhandledRejection', onUnhandledRejection);

    try {
      // مهمة تتجاهل الإشارة ثم ترفض لاحقًا (بعد انتهاء مهلتي timeout وgrace كلتيهما)
      const rejectsLate = () =>
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('late-rejection-after-grace')), 100);
        });

      const outcome = await withJobLock('scenario-8', rejectsLate, 20, 30);
      expect(outcome).toEqual({ status: 'timed_out_but_still_running' });

      await delay(150); // ننتظر الرفض المتأخر (عند 100ms) يصير فعليًا بالخلفية
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }

    expect(unhandledRejections).toEqual([]);
  });

  it('يسجّل job_lock_acquired وjob_lock_released عند التشغيل الطبيعي', async () => {
    const infoSpy = jest.spyOn(logger, 'info');
    await withJobLock('logging-scenario', async () => 'ok', 1000, 50);

    expect(infoSpy).toHaveBeenCalledWith('job_lock_acquired', { jobKey: 'logging-scenario', timeoutMs: 1000, abortGraceMs: 50 });
    expect(infoSpy).toHaveBeenCalledWith('job_lock_released', { jobKey: 'logging-scenario', reason: 'completed' });
  });

  it('يحرّر القفل بعد فشل المهمة (استثناء عادي، بدون أي timeout)، ويسمح بتشغيل جديد بعده', async () => {
    await expect(withJobLock('failing-scenario', async () => Promise.reject(new Error('boom')), 1000, 50)).rejects.toThrow('boom');

    const outcome = await withJobLock('failing-scenario', async () => 'after-error', 1000, 50);
    expect(outcome).toEqual({ status: 'completed', result: 'after-error' });
  });
});
