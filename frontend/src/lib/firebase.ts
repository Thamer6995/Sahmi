import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

/**
 * تهيئة Firebase على العميل. هذه القيم (apiKey, projectId...) ليست أسرارًا
 * حساسة بمعنى الكلمة - هي معرّفات مشروع Firebase العلنية، لكنها تُقرأ من
 * متغيرات بيئة الـ build (Vite) بدل كتابتها مباشرة، ليسهل تبديل المشروع.
 *
 * ⚠️ لا تضع هنا أبدًا SAHMK_API_KEY أو TELEGRAM_BOT_TOKEN - هذه أسرار
 * Backend فقط ولا يجوز أن تصل للمتصفح إطلاقًا.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'me-central1');
