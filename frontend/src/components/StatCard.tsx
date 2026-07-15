interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'good' | 'warning' | 'bad';
}

const TONE_CLASSES: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-slate-900',
  good: 'text-green-700',
  warning: 'text-amber-700',
  bad: 'text-red-700',
};

export function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${TONE_CLASSES[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
