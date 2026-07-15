interface PriceChartProps {
  bars: { date: string; close: number }[];
}

/** شارت خطي بسيط (SVG) للسعر اليومي - بدون مكتبات خارجية. */
export function PriceChart({ bars }: PriceChartProps) {
  if (bars.length < 2) {
    return <p className="text-sm text-slate-400">لا تتوفر بيانات كافية لعرض الشارت.</p>;
  }

  const width = 600;
  const height = 200;
  const closes = bars.map((b) => b.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const points = bars
    .map((b, i) => {
      const x = (i / (bars.length - 1)) * width;
      const y = height - ((b.close - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height: 200 }}>
        <polyline points={points} fill="none" stroke="#15803d" strokeWidth={1.5} />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>{bars[0].date}</span>
        <span>
          {min.toFixed(2)} - {max.toFixed(2)}
        </span>
        <span>{bars[bars.length - 1].date}</span>
      </div>
    </div>
  );
}
