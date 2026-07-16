import { InvestmentScoreResult } from '../../scoring/investmentScore';

export type AlertType = '70-79' | '80-89' | '90-100';

export interface AlertMessageInput {
  companyNameAr?: string;
  symbol: string;
  price?: number;
  score: InvestmentScoreResult;
  alertType: AlertType;
  updatedAtRiyadh: string;
  appUrl?: string;
}

const ALERT_TITLES: Record<AlertType, { emoji: string; title: string }> = {
  '70-79': { emoji: '👁️', title: 'سهم يستحق المراقبة' },
  '80-89': { emoji: '🟢', title: 'فرصة استثمارية محتملة' },
  '90-100': { emoji: '🌟', title: 'فرصة قوية تستحق الدراسة' },
};

const MAX_REASONS_SHOWN = 6;
const MAX_WARNINGS_SHOWN = 4;

/** يبني نص رسالة Telegram بالتنسيق المطلوب تمامًا (لا "اشترِ الآن"، دائمًا إخلاء المسؤولية). */
export function buildAlertMessage(input: AlertMessageInput): { text: string; buttonUrl?: string } {
  const { emoji, title } = ALERT_TITLES[input.alertType];
  const lines: string[] = [];

  lines.push(`${emoji} ${title}`);
  lines.push('');
  lines.push(`الشركة: ${input.companyNameAr ?? input.symbol}`);
  lines.push(`الرمز: ${input.symbol}`);
  if (input.price !== undefined) lines.push(`السعر: ${input.price.toFixed(2)} ريال`);
  lines.push(`التقييم: ${Math.round(input.score.totalScore ?? 0)}/100`);
  lines.push(`اكتمال البيانات: ${Math.round(input.score.dataCompleteness ?? 0)}%`);
  lines.push('');
  lines.push(`الجودة: ${input.score.quality?.score ?? 0}/${input.score.quality?.maxScore ?? 35}`);
  lines.push(`التقييم المالي: ${input.score.valuation?.score ?? 0}/${input.score.valuation?.maxScore ?? 25}`);
  lines.push(`التوزيعات: ${input.score.dividend?.score ?? 0}/${input.score.dividend?.maxScore ?? 25}`);
  lines.push(`التوقيت الفني: ${input.score.technical?.score ?? 0}/${input.score.technical?.maxScore ?? 15}`);

  const reasons = input.score.reasons.slice(0, MAX_REASONS_SHOWN);
  if (reasons.length > 0) {
    lines.push('');
    lines.push('أبرز الأسباب:');
    for (const reason of reasons) lines.push(`✅ ${reason}`);
  }

  const warnings = input.score.warnings.slice(0, MAX_WARNINGS_SHOWN);
  if (warnings.length > 0) {
    lines.push('');
    lines.push('تحذيرات:');
    for (const warning of warnings) lines.push(`⚠️ ${warning}`);
  }

  lines.push('');
  lines.push(`آخر تحديث: ${input.updatedAtRiyadh}`);
  lines.push('');
  lines.push('هذا تنبيه آلي وليس توصية مالية.');

  const buttonUrl = input.appUrl ? `${input.appUrl.replace(/\/$/, '')}/stocks/${input.symbol}` : undefined;

  return { text: lines.join('\n'), buttonUrl };
}
