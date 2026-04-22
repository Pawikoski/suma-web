'use client';
import { T } from '@/lib/tokens';

interface BarProps {
  pct: number;
  color?: string;
  track?: string;
  height?: number;
}

export default function Bar({ pct, color = T.accent, track = T.bg, height = 6 }: BarProps) {
  return (
    <div style={{ height, background: track, borderRadius: height, overflow: 'hidden' }}>
      <div
        style={{
          height: '100%',
          width: `${Math.min(pct, 100)}%`,
          background: pct > 100 ? T.expense : color,
          borderRadius: height,
          transition: 'width .3s',
        }}
      />
    </div>
  );
}
