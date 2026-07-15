import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCollection } from '../hooks/useCollection';
import { Company, Dividend } from '../types/models';

function daysRemaining(dateStr?: string): number | undefined {
  if (!dateStr) return undefined;
  const target = new Date(dateStr).getTime();
  if (Number.isNaN(target)) return undefined;
  return Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24));
}

const MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export default function DividendCalendar() {
  const { data: dividends, loading } = useCollection<Dividend>('dividends');
  const { data: companies } = useCollection<Company>('companies');

  const [month, setMonth] = useState('');
  const [sector, setSector] = useState('');

  const companyMap = useMemo(() => new Map(companies.map((c) => [c.symbol, c])), [companies]);
  const sectors = useMemo(() => Array.from(new Set(companies.map((c) => c.sector).filter(Boolean))) as string[], [companies]);

  const rows = useMemo(() => {
    return dividends
      .map((d) => {
        const referenceDate = d.eligibilityDate ?? d.distributionDate ?? d.announcementDate;
        const company = companyMap.get(d.symbol);
        return { ...d, referenceDate, company };
      })
      .filter((d) => {
        if (!d.referenceDate) return false;
        if (sector && d.company?.sector !== sector) return false;
        if (month) {
          const m = new Date(d.referenceDate).getMonth();
          if (String(m) !== month) return false;
        }
        return true;
      })
      .sort((a, b) => (a.referenceDate ?? '').localeCompare(b.referenceDate ?? ''));
  }, [dividends, companyMap, month, sector]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-xl font-bold text-slate-900">تقويم التوزيعات</h1>

      <div className="mb-4 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">كل الأشهر</option>
          {MONTH_NAMES.map((name, i) => (
            <option key={i} value={i}>
              {name}
            </option>
          ))}
        </select>
        <select value={sector} onChange={(e) => setSector(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">كل القطاعات</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
              <th className="p-3">الشركة</th>
              <th className="p-3">قيمة التوزيع</th>
              <th className="p-3">تاريخ الإعلان</th>
              <th className="p-3">تاريخ الأحقية</th>
              <th className="p-3">تاريخ الصرف</th>
              <th className="p-3">الأيام المتبقية</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-slate-400">جارٍ التحميل...</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-slate-400">لا توجد توزيعات مطابقة.</td>
              </tr>
            )}
            {rows.map((d, i) => {
              const remaining = daysRemaining(d.eligibilityDate);
              return (
                <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="p-3">
                    <Link to={`/stocks/${d.symbol}`} className="font-medium text-brand-700 hover:underline">
                      {d.company?.nameAr ?? d.symbol}
                    </Link>
                  </td>
                  <td className="p-3">{d.amountPerShare !== undefined ? `${d.amountPerShare.toFixed(2)} ريال` : '—'}</td>
                  <td className="p-3 text-slate-500">{d.announcementDate ?? '—'}</td>
                  <td className="p-3 text-slate-500">{d.eligibilityDate ?? '—'}</td>
                  <td className="p-3 text-slate-500">{d.distributionDate ?? '—'}</td>
                  <td className="p-3">
                    {remaining !== undefined ? (remaining >= 0 ? `${remaining} يوم` : 'مضى') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
