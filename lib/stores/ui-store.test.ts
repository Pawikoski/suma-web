import { beforeEach, describe, expect, it } from 'vitest';
import { useSumaUiStore } from './ui-store';

describe('useSumaUiStore', () => {
  beforeEach(() => {
    useSumaUiStore.setState({ selectedTransactionId: null });
  });

  it('keeps selected transaction as local UI state', () => {
    useSumaUiStore.getState().selectTransaction('tx-1');

    expect(useSumaUiStore.getState().selectedTransactionId).toBe('tx-1');

    useSumaUiStore.getState().clearSelectedTransaction();

    expect(useSumaUiStore.getState().selectedTransactionId).toBeNull();
  });
});
