/**
 * نتيجة تقييم بند واحد ضمن أحد الأقسام الأربعة. "available" يعني توفّرت
 * البيانات اللازمة لتقييم هذا البند (بصرف النظر عن كون النتيجة جيدة أو
 * سيئة) - "غير متوفر" شيء مختلف تمامًا عن "متوفر لكن سيئ" (مثل P/E سالب).
 * هذا التمييز هو ما يُستخدم لحساب Data Completeness Percentage.
 */
export interface ScoreCheck {
  key: string;
  points: number;
  maxPoints: number;
  available: boolean;
  /** ✅ نص يُعرض ضمن "أبرز الأسباب" عند نجاح الشرط */
  reason?: string;
  /** ⚠️ نص يُعرض ضمن "تحذيرات" (تحذير مالي أو فني حقيقي) */
  warning?: string;
  /** يُعرض إذا كانت البيانات غير متوفرة لتقييم هذا البند تحديدًا */
  missingDataNote?: string;
  /** تحذير مالي حرج (يمنع إرسال تنبيه Telegram حتى لو تجاوزت الدرجة 80 - انظر قواعد التنبيه) */
  critical?: boolean;
}

export interface CategoryResult {
  score: number;
  maxScore: number;
  checks: ScoreCheck[];
}

export function sumCategory(checks: ScoreCheck[], maxScore: number): CategoryResult {
  const score = checks.reduce((acc, c) => acc + c.points, 0);
  return { score, maxScore, checks };
}
