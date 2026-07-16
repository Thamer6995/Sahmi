export type AlertTier = '70-79' | '80-89' | '90-100' | null;

/** يحدد نوع التنبيه حسب الدرجة الكلية. أقل من 70 = لا تنبيه إطلاقًا. */
export function determineAlertTier(totalScore: number): AlertTier {
  if (totalScore >= 90) return '90-100';
  if (totalScore >= 80) return '80-89';
  if (totalScore >= 70) return '70-79';
  return null;
}
