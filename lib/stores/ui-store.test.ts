import { beforeEach, describe, expect, it } from 'vitest';
import { useSumaUiStore } from './ui-store';

describe('useSumaUiStore', () => {
  beforeEach(() => {
    useSumaUiStore.setState({ selectedTransactionId: null, isCommandOpen: false, privacyMode: false });
  });

  it('keeps selected transaction as local UI state', () => {
    useSumaUiStore.getState().selectTransaction('tx-1');

    expect(useSumaUiStore.getState().selectedTransactionId).toBe('tx-1');

    useSumaUiStore.getState().clearSelectedTransaction();

    expect(useSumaUiStore.getState().selectedTransactionId).toBeNull();
  });

  it('stores app shell UI state outside canonical finance data', () => {
    useSumaUiStore.getState().openCommand();
    expect(useSumaUiStore.getState().isCommandOpen).toBe(true);

    useSumaUiStore.getState().closeCommand();
    useSumaUiStore.getState().togglePrivacyMode();

    expect(useSumaUiStore.getState().isCommandOpen).toBe(false);
    expect(useSumaUiStore.getState().privacyMode).toBe(true);
  });
});
