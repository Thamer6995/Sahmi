const runningJobs = new Set<string>();

/**
 * قفل بسيط بالذاكرة يمنع تشغيل نفس المهمة المجدولة أكثر من مرة بالتزامن.
 *
 * لوحظ فعليًا: عندما ينتهي curl في حلقة GitHub Actions بفشل/مهلة (بعد 120
 * ثانية) بينما الطلب الأصلي لسا شغّال على السيرفر (مثلاً Firestore تعيد
 * المحاولة داخليًا لين 10 دقائق عند RESOURCE_EXHAUSTED)، كانت الحلقة تطلق
 * طلبًا جديدًا فيبدأ تشغيلة كاملة أخرى للمهمة نفسها فوق التشغيلة القديمة -
 * عشرات النسخ المتزامنة تعالج نفس البيانات من الصفر، وتضاعف الكتابة على
 * Firestore لدرجة استنزاف الحصة اليومية المجانية خلال ساعات قليلة. القفل
 * هنا يجعل أي طلب يصل أثناء تشغيلة قائمة يرجع فورًا (busy) بدل ما يبدأ
 * تشغيلة موازية جديدة.
 */
export async function withJobLock<T>(jobKey: string, fn: () => Promise<T>): Promise<{ busy: true } | { busy: false; result: T }> {
  if (runningJobs.has(jobKey)) {
    return { busy: true };
  }
  runningJobs.add(jobKey);
  try {
    const result = await fn();
    return { busy: false, result };
  } finally {
    runningJobs.delete(jobKey);
  }
}
