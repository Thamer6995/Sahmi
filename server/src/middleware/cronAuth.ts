import { Request, Response, NextFunction } from 'express';
import { CRON_SECRET } from '../config/env';
import { unauthenticated } from '../utils/httpError';

/**
 * يحمي مسارات الجدولة (/internal/*) بسرّ مشترك بدلًا من مصادقة المستخدم،
 * لأن المستدعي هنا هو GitHub Actions (cron) وليس المستخدم من المتصفح.
 * يُمرَّر السر عبر Header: X-Cron-Secret، ويُقارن بقيمة CRON_SECRET
 * المضبوطة في متغيرات بيئة الاستضافة.
 */
export function requireCronSecret(req: Request, _res: Response, next: NextFunction): void {
  const provided = req.headers['x-cron-secret'];
  if (provided !== CRON_SECRET()) {
    next(unauthenticated('سر الجدولة غير صحيح.'));
    return;
  }
  next();
}
