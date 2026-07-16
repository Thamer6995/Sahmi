/** خطأ HTTP بسيط يحمل status code، يُستخدم بدل HttpsError الخاص بـ Firebase Functions. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export const unauthenticated = (message = 'يجب تسجيل الدخول لاستخدام هذه الوظيفة.') =>
  new HttpError(401, 'unauthenticated', message);

export const invalidArgument = (message: string) => new HttpError(400, 'invalid-argument', message);

export const failedPrecondition = (message: string) => new HttpError(412, 'failed-precondition', message);

export const resourceExhausted = (message = 'تم تجاوز الحد المسموح من الطلبات، حاول لاحقًا.') =>
  new HttpError(429, 'resource-exhausted', message);
