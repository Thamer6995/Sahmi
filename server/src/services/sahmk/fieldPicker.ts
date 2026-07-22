/**
 * أدوات استخراج آمنة من سجلات SAHMK الخام (القوائم المالية والنسب) حيث
 * لا تعرض الوثائق العلنية مثالًا كاملاً لأسماء الحقول. نجرّب عدة أسماء
 * محتملة (candidate keys) شائعة في APIs مالية مشابهة، وإن لم نجد أي
 * منها نُعيد undefined بدل قيمة وهمية - يُترجم لاحقًا في التقييم إلى
 * "البيانات غير متوفرة" كما هو مطلوب.
 */

export function pickNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

export function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
    // مؤكَّد من raw response فعلي: fiscal_year يصل كرقم (2025) لا كنص - نحوّله
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

/** يحاول استخراج معرّف الفترة (سنة/تاريخ) من سجل قائمة مالية خام. */
export function extractPeriodKey(record: Record<string, unknown>): string | undefined {
  return pickString(record, ['fiscal_year', 'report_date', 'period', 'period_end', 'period_end_date', 'date', 'year']);
}

/** يحاول تحديد نوع الفترة (سنوي/ربعي) من سجل قائمة مالية خام. */
export function detectPeriodType(record: Record<string, unknown>): 'annual' | 'quarterly' | undefined {
  const raw = pickString(record, ['statement_period', 'period_type', 'periodType', 'type', 'frequency']);
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower.includes('quarter') || lower === 'q') return 'quarterly';
  if (lower.includes('annual') || lower.includes('year') || lower === 'fy') return 'annual';
  return undefined;
}

/**
 * يتحقق فعليًا وقت التشغيل أن القيمة كائن عادي (وليس نصًا/رقمًا/مصفوفة/null)
 * قبل التعامل معها كسجل مفاتيح-قيم - يمنع خطأً صامتًا خطيرًا: `{...قيمة}`
 * على نص في JavaScript يفكّكه لحروف كخصائص مرقّمة بدل أن يرمي خطأً (مؤكَّد
 * فعليًا: key_metrics في استجابة /analytics/ratios/2222/ وصل كنص "core" بدل
 * كائن، وتحوّل صامتًا لـ {0:"c",1:"o",2:"r",3:"e"} داخل rawMetrics المخزَّن
 * على Firestore). الكاست `as Record<string, unknown>` وحده لا يحمي من هذا
 * لأنه فحص وقت الترجمة فقط، لا وقت التشغيل.
 */
export function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
