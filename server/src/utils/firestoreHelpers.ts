/**
 * يزيل أي مفتاح قيمته undefined من كائن قبل كتابته إلى Firestore، لأن
 * Firestore يرفض القيم undefined صراحة (على عكس null). هذا يضمن عدم
 * تخزين "undefined" أبدًا، تمامًا كما هو مطلوب في تصميم قاعدة البيانات.
 */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

/** يقسّم مصفوفة إلى دفعات بحجم ثابت. */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** يعيد نسخة من القيمة بمفاتيح الكائنات (بما فيها المتداخلة) مرتّبة أبجديًا،
 *  حتى تكون المقارنة عبر JSON.stringify مستقرة بغض النظر عن ترتيب الإدراج. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/**
 * مقارنة تساوي مستقرة لا تتأثر بترتيب خصائص الكائن (بخلاف `JSON.stringify`
 * المباشر، الذي يعتمد على ترتيب الإدراج). تُستخدم لتحديد هل بيانات SAHMK
 * الخام (rawMetrics وشبهها) تغيّرت فعليًا قبل الكتابة على Firestore، بدل
 * الاعتماد على وجود الحقل فقط أو على updatedAt (الذي يتغيّر دائمًا حتى لو
 * كانت القيم نفسها).
 */
export function stableEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}
