interface ScoreBadgeProps {
  score?: number;
  excluded?: boolean;
}

export function ScoreBadge({ score, excluded }: ScoreBadgeProps) {
  if (excluded) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
        مستبعدة
      </span>
    );
  }
  if (score === undefined) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-400">
        غير محسوبة
      </span>
    );
  }

  let classes = 'bg-slate-100 text-slate-600';
  if (score >= 90) classes = 'bg-emerald-100 text-emerald-800';
  else if (score >= 80) classes = 'bg-green-100 text-green-800';
  else if (score >= 70) classes = 'bg-amber-100 text-amber-800';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}`}>
      {Math.round(score)}/100
    </span>
  );
}
