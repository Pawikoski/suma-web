import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CategoryIconPicker from './CategoryIconPicker';

describe('CategoryIconPicker', () => {
  it('searches catalog tags and returns a valid icon name', () => {
    const onChange = vi.fn();
    render(<CategoryIconPicker value="Category" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Wybierz ikonę kategorii' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Szukaj ikony' }), { target: { value: 'insurance' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ubezpieczenie' }));

    expect(onChange).toHaveBeenCalledWith('Policy');
    expect(screen.getByRole('button', { name: 'Wybierz ikonę kategorii' }).getAttribute('aria-expanded')).toBe('false');
  });
});
