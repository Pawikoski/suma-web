'use client';
import { T } from '@/lib/tokens';

const PTS = [20, 35, 25, 45, 30, 55, 40, 35, 50, 42, 60, 48, 55, 65, 58];

export default function Sparkline({ color = T.accent }: { color?: string }) {
  const max = Math.max(...PTS), min = Math.min(...PTS), w = 120, h = 40;
  const x = (i: number) => (i / (PTS.length - 1)) * w;
  const y = (v: number) => h - ((v - min) / (max - min)) * (h - 4) - 2;
  const d = PTS.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d + ` L${w},${h} L0,${h} Z`} fill={color} opacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}
