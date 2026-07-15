import { getScore } from '../repo/scoresRepo';
import { computeScoreForSymbol } from './computeScores';
import { evaluateAndMaybeSendAlert, AlertEvaluation } from '../alerts/evaluateAlert';
import { InvestmentScoreResult } from '../scoring/investmentScore';

/**
 * يحسب التقييم لسهم معين (يقرأ الدرجة السابقة أولًا قبل استبدالها لمعرفة
 * إن كانت قد "عبرت" الحد 80 حديثًا)، ثم يطبّق قواعد التنبيه. تُستخدم هذه
 * الدالة من كل من الفحص المجدول (المرحلة 8) واختبار المطوّر (DevTest).
 */
export async function runAlertCheckForSymbol(
  symbol: string
): Promise<{ result: InvestmentScoreResult; evaluation: AlertEvaluation }> {
  const previousScore = await getScore(symbol);
  const result = await computeScoreForSymbol(symbol);
  const evaluation = await evaluateAndMaybeSendAlert(
    result,
    previousScore?.totalScore,
    previousScore?.dataCompleteness
  );
  return { result, evaluation };
}
