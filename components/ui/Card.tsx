'use client';
import { CSSProperties, ReactNode } from 'react';
import { T } from '@/lib/tokens';

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
  className?: string;
}

export default function Card({ children, style, onClick, className }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: T.card,
        borderRadius: T.radius,
        border: `1px solid ${T.border}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
