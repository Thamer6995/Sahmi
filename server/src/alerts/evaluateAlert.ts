import { InvestmentScoreResult } from '../scoring/investmentScore';
import { determineAlertTier, AlertTier } from './alertTier';
import { hasRecentAlert, createAlert } from '../repo/alertsRepo';
import { getSettings } from '../repo/settingsRepo';
import { getCompany } from '../repo/companiesRepo';
import { getQuote } from '../repo/quotesRepo';
import { telegramService } from '../services/telegram/TelegramService';
import { buildAlertMessage } from '../services/telegram/messageBuilder';
import { APP_URL, APP_TIMEZONE } from '../config/env';
import { logger } from '../utils/logger';

export interface AlertEvaluation {
  sent: boolean;
  tier: AlertTier;
  /** توضيح لماذا أُرسل التنبيه أو لماذا لم يُرسل - لأغراض التشخيص والعرض في لوحة الإدارة */
  reason: string;
}

function formatRiyadhDatetime(): string {
  return new Intl.DateTimeFormat('ar-SA', {
    timeZone: APP_TIMEZONE() || 'Asia/Riyadh',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());
}

/**
 * يطبّق كل قواعد التنبيه المطلوبة بالترتيب (القسم الخامس من المواصفة):
 * 1) Total Score >= 80  2) Data Completeness >= 70%  3) ليست خاسرة في آخر
 * فترة سنوية  4) لا تحذير مالي حرج  5) لم يُرسل نفس النوع خلال 7 أيام
 * 6) عبرت الحد 80 حديثًا أو تحسّنت الدرجة/البيانات جوهريًا.
 *
 * درجة 70-79 تُسجَّل كتنبيه داخل التطبيق فقط ولا تُرسل عبر Telegram أبدًا
 * (بغض النظر عن بقية الشروط)، تمامًا كما هو مطلوب.
 */
export async function evaluateAndMaybeSendAlert(
  result: InvestmentScoreResult,
  previousTotalScore: number | undefined,
  previousDataCompleteness: number | undefined,
  signal?: AbortSignal
): Promise<AlertEvaluation> {
  if (result.excluded || result.totalScore === undefined) {
    return { sent: false, tier: null, reason: 'الشركة مستبعدة من التقييم أو لا توجد درجة محسوبة' };
  }

  const tier = determineAlertTier(result.totalScore);
  if (!tier) {
    return { sent: false, tier: null, reason: 'الدرجة الكلية أقل من 70' };
  }

  if (tier === '70-79') {
    await createAlert({
      symbol: result.symbol,
      alertType: tier,
      score: result.totalScore,
      reasons: result.reasons,
      sentToTelegram: false,
    });
    return { sent: false, tier, reason: 'درجة 70-79 تُعرض داخل التطبيق فقط ولا تُرسل عبر Telegram (حسب التصميم)' };
  }

  const settings = await getSettings();

  if (result.totalScore < settings.minimumAlertScore) {
    return { sent: false, tier, reason: `الدرجة أقل من الحد الأدنى المُعدّ في الإعدادات (${settings.minimumAlertScore})` };
  }
  if ((result.dataCompleteness ?? 0) < 70) {
    return { sent: false, tier, reason: 'اكتمال البيانات أقل من 70%' };
  }
  if (result.latestYearProfitable === false) {
    return { sent: false, tier, reason: 'الشركة خاسرة في آخر فترة سنوية متاحة' };
  }
  if (result.hasCriticalFinancialWarning) {
    return { sent: false, tier, reason: 'يوجد تحذير مالي حرج يمنع إرسال التنبيه' };
  }

  const crossedThreshold = previousTotalScore === undefined || previousTotalScore < 80;
  const scoreImprovedMaterially = previousTotalScore !== undefined && result.totalScore - previousTotalScore >= 5;
  const completenessImprovedMaterially =
    previousDataCompleteness !== undefined && (result.dataCompleteness ?? 0) - previousDataCompleteness >= 15;

  if (!crossedThreshold && !scoreImprovedMaterially && !completenessImprovedMaterially) {
    return {
      sent: false,
      tier,
      reason: 'لا يوجد تحسّن جوهري منذ آخر تقييم (الدرجة كانت 80 فأكثر مسبقًا بدون تغيّر ملموس)',
    };
  }

  if (!settings.telegramEnabled) {
    return { sent: false, tier, reason: 'إرسال Telegram معطّل من الإعدادات' };
  }

  const cooldownDays = settings.alertCooldownDays;
  const alreadySentRecently = await hasRecentAlert(result.symbol, tier, cooldownDays);
  if (alreadySentRecently) {
    return { sent: false, tier, reason: `تم إرسال نفس نوع التنبيه لهذا السهم خلال آخر ${cooldownDays} أيام` };
  }

  // إلغاء تعاوني (من jobLock عبر المسار المجدول) - لا نبدأ إرسال Telegram
  // ولا نكتب تنبيهًا جديدًا لسهم لم تبدأ معالجته بعد وقت الإلغاء.
  if (signal?.aborted) {
    return { sent: false, tier, reason: 'أُلغيت المعالجة (AbortSignal) قبل إرسال التنبيه' };
  }

  const [company, quote] = await Promise.all([getCompany(result.symbol), getQuote(result.symbol)]);

  const { text, buttonUrl } = buildAlertMessage({
    companyNameAr: company?.nameAr,
    symbol: result.symbol,
    price: quote?.price,
    score: result,
    alertType: tier,
    updatedAtRiyadh: formatRiyadhDatetime(),
    appUrl: APP_URL() || undefined,
  });

  const sendResult = await telegramService.sendMessage(text, {
    button: buttonUrl ? { text: 'فتح السهم في التطبيق', url: buttonUrl } : undefined,
    signal,
  });

  if (signal?.aborted) {
    return { sent: false, tier, reason: 'أُلغيت المعالجة (AbortSignal) بعد محاولة الإرسال - لن يُسجَّل تنبيه جديد' };
  }

  await createAlert({
    symbol: result.symbol,
    alertType: tier,
    score: result.totalScore,
    price: quote?.price,
    reasons: result.reasons,
    sentToTelegram: sendResult.ok,
    telegramMessageId: sendResult.messageId,
  });

  if (!sendResult.ok) {
    logger.error('alert_telegram_send_failed', { symbol: result.symbol, error: sendResult.error });
    return { sent: false, tier, reason: `فشل إرسال التنبيه عبر Telegram: ${sendResult.error}` };
  }

  return { sent: true, tier, reason: 'تم إرسال التنبيه بنجاح عبر Telegram' };
}
