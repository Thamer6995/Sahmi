import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/httpError';
import { logger } from '../utils/logger';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ ok: false, errorKind: err.code, message: err.message });
    return;
  }

  logger.error('unhandled_route_error', { path: req.path, message: (err as Error)?.message });
  res.status(500).json({ ok: false, errorKind: 'UNKNOWN', message: 'حدث خطأ غير متوقع.' });
}

/** يلتقط الأخطاء غير المتزامنة في route handlers بدون الحاجة لـ try/catch في كل مكان. */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
