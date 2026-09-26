import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { useSubmissionGuard } from './useSubmissionGuard';

beforeEach(() => localStorage.clear());

it('keeps an identity-only pending marker across component remounts', () => {
  const first = renderHook(() => useSubmissionGuard('synthetic@example.com', 'import'));
  let id = '';
  act(() => { id = first.result.current.begin(41).id; });
  expect(first.result.current.blocked).toBe(true);
  expect(Object.keys(JSON.parse(localStorage.getItem('suma:pending:synthetic%40example.com:import')!)).sort()).toEqual(['count', 'id', 'submittedAt']);
  first.unmount();
  const resumed = renderHook(() => useSubmissionGuard('synthetic@example.com', 'import'));
  expect(resumed.result.current.pending?.id).toBe(id);
  expect(() => resumed.result.current.begin(41)).toThrow('Najpierw sprawdź');
  act(() => resumed.result.current.finish());
  expect(resumed.result.current.blocked).toBe(false);
});

it('does not apply a previous account marker to another signed-in user', () => {
  const first = renderHook(() => useSubmissionGuard('first@example.com', 'transaction'));
  act(() => { first.result.current.begin(1); });
  const second = renderHook(() => useSubmissionGuard('second@example.com', 'transaction'));
  expect(second.result.current.blocked).toBe(false);
});
