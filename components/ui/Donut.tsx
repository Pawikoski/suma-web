'use client';
import { T } from '@/lib/tokens';

interface DonutSlice { value: number; color: string }

export default function Donut({ data, size = 120 }: { data: DonutSlice[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let angle = -90;
  const r = 44, cx = 60, cy = 60;

  const slices = data.map((d) => {
    const pct = d.value / total;
    const start = angle;
    angle += pct * 360;
    const sr = start * Math.PI / 180, er = angle * Math.PI / 180;
    const x1 = cx + r * Math.cos(sr), y1 = cy + r * Math.sin(sr);
    const x2 = cx + r * Math.cos(er), y2 = cy + r * Math.sin(er);
    const large = pct > 0.5 ? 1 : 0;
    return { ...d, path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z` };
  });

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity={0.85} />)}
      <circle cx={cx} cy={cy} r={30} fill={T.card} />
    </svg>
  );
}
