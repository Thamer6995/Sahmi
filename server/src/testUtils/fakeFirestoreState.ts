/**
 * محاكاة بسيطة بالذاكرة لجزء صغير جدًا من واجهة firebase-admin/firestore
 * (get/set/batch/getAll فقط) - كافية لاختبار financialsRepo.ts وratiosRepo.ts
 * دون الحاجة لاتصال Firestore حقيقي أو Emulator. تُستخدَم عبر jest.mock في
 * ملفات الاختبار:
 *
 *   jest.mock('firebase-admin/firestore', () =>
 *     require('../testUtils/fakeFirestoreState').fakeFirestoreModule
 *   );
 *
 * الاستدعاء عبر require() داخل الـ factory (وليس مرجعًا لمتغيّر خارجي) يتفادى
 * قيد jest بمنع الإشارة لمتغيرات خارج نطاق الـ mock factory.
 */

interface FakeDocSnapshot {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

interface FakeDocRef {
  id: string;
  path: string;
  get(): Promise<FakeDocSnapshot>;
  set(data: Record<string, unknown>): Promise<void>;
}

const store = new Map<string, Record<string, unknown>>();
export const writeLog: { path: string; data: Record<string, unknown> }[] = [];

/** يُستدعى في beforeEach لكل اختبار كي لا تتسرّب بيانات بين الاختبارات. */
export function reset(): void {
  store.clear();
  writeLog.length = 0;
}

/** يزرع مستندًا موجودًا مسبقًا لمحاكاة "بيانات مخزَّنة فعليًا من قبل". */
export function seed(path: string, data: Record<string, unknown>): void {
  store.set(path, data);
}

export function getStored(path: string): Record<string, unknown> | undefined {
  return store.get(path);
}

function makeDocRef(path: string): FakeDocRef {
  return {
    id: path.split('/').pop() as string,
    path,
    async get() {
      const data = store.get(path);
      return { exists: data !== undefined, data: () => data };
    },
    async set(data: Record<string, unknown>) {
      const existing = store.get(path) ?? {};
      const merged = { ...existing, ...data };
      store.set(path, merged);
      writeLog.push({ path, data });
    },
  };
}

function getFirestore() {
  return {
    collection(name: string) {
      return {
        doc(id: string) {
          return makeDocRef(`${name}/${id}`);
        },
      };
    },
    async getAll(...refs: FakeDocRef[]) {
      return Promise.all(refs.map((r) => r.get()));
    },
    batch() {
      const pending: { ref: FakeDocRef; data: Record<string, unknown> }[] = [];
      return {
        set(ref: FakeDocRef, data: Record<string, unknown>) {
          pending.push({ ref, data });
        },
        async commit() {
          for (const { ref, data } of pending) {
            await ref.set(data);
          }
        },
      };
    },
  };
}

export const fakeFirestoreModule = {
  getFirestore,
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
};
