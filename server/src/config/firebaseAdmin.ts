import { initializeApp, cert } from 'firebase-admin/app';

/**
 * يهيّئ Firebase Admin SDK بحساب خدمة (Service Account) بدل الاعتماد
 * الضمني على بيئة Cloud Functions (لأن هذا الخادم يعمل خارج Google Cloud
 * تمامًا). المفتاح يُمرَّر كمتغيّر بيئة Base64 حتى لا يُكتب كملف على القرص
 * في منصة الاستضافة.
 */
export function initFirebaseAdmin(): void {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!encoded) {
    throw new Error('متغيّر البيئة FIREBASE_SERVICE_ACCOUNT_BASE64 مطلوب لتشغيل الخادم.');
  }

  const json = Buffer.from(encoded, 'base64').toString('utf-8');
  const serviceAccount = JSON.parse(json);

  initializeApp({ credential: cert(serviceAccount) });
}
