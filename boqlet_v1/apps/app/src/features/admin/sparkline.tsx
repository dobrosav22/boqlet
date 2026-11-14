/** A tile's trend line (F19 §1): the series as a small blue polyline, scaled to its own maximum. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 160;
  const h = 28;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full max-w-40" role="img" aria-label={label} preserveAspectRatio="none">
      <line x1="0" y1={h - 1} x2={w} y2={h - 1} stroke="var(--border)" strokeWidth="1" />
      <polyline points={points} fill="none" stroke="var(--blue)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
