import { HttpsError } from 'firebase-functions/v2/https';

const SYMBOL_PATTERN = /^[A-Za-z0-9]{1,10}$/;

/** يتحقق من صحة رمز السهم المُدخل من المستخدم قبل استخدامه في أي طلب. */
export function validateSymbol(input: unknown): string {
  if (typeof input !== 'string') {
    throw new HttpsError('invalid-argument', 'رمز السهم مطلوب.');
  }
  const symbol = input.trim();
  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new HttpsError('invalid-argument', 'رمز السهم غير صالح.');
  }
  return symbol;
}
