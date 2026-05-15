'use client';

import { CSSProperties } from 'react';
import { useSumaUiStore } from '@/lib/stores/ui-store';
import { fmtPLN } from '@/lib/utils';

interface PrivacyAmountProps {
  amount: number;
  signed?: boolean;
  prefix?: string;
  className?: string;
  style?: CSSProperties;
}

export default function PrivacyAmount({ amount, signed, prefix = '', className, style }: PrivacyAmountProps) {
  const privacyMode = useSumaUiStore(state => state.privacyMode);

  return (
    <span className={`${className ?? ''}${privacyMode ? ' privacy-amount' : ''}`} style={style}>
      {privacyMode ? '••••••' : `${prefix}${fmtPLN(amount, signed)}`}
    </span>
  );
}
