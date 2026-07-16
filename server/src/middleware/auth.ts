import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { unauthenticated } from '../utils/httpError';

export interface AuthedRequest extends Request {
  uid?: string;
}

/**
 * يتحقق من Firebase ID Token المُمرَّر في Authorization: Bearer <token>.
 * الواجهة تحصل على هذا التوكن عبر auth.currentUser.getIdToken() بعد
 * تسجيل الدخول بحساب المستخدم الوحيد - المصادقة نفسها تبقى على Firebase
 * (مجانية تمامًا، لا تحتاج خطة Blaze) رغم أن هذا الخادم منفصل عنها.
 */
export async function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(unauthenticated());
    return;
  }

  try {
    const decoded = await getAuth().verifyIdToken(header.slice('Bearer '.length));
    req.uid = decoded.uid;
    next();
  } catch {
    next(unauthenticated());
  }
}
