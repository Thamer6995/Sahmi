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
