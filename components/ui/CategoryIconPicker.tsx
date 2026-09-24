'use client';

import { useState } from 'react';
import { categoryIconSections, findCategoryIcon } from '@/lib/category-icons';
import { T } from '@/lib/tokens';
import Icon from './Icon';

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pl-PL');
}

export default function CategoryIconPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = findCategoryIcon(value);
  const search = normalizeSearch(query.trim());
  const sections = categoryIconSections
    .map(section => ({
      ...section,
      icons: section.icons.filter(icon =>
        !search || normalizeSearch(`${icon.label} ${icon.name} ${icon.tags.join(' ')} ${section.title}`).includes(search)
      ),
    }))
    .filter(section => section.icons.length > 0);

  return (
    <div>
      <button
        type="button"
        aria-label="Wybierz ikonę kategorii"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        style={{ width: '100%', minHeight: 42, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.card, color: T.dark, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
      >
        <Icon name={selected?.name ?? 'Category'} size={22} />
        <span>{selected?.label ?? 'Wybierz ikonę (dotychczasowa nieobsługiwana)'}</span>
        <span aria-hidden="true" style={{ marginLeft: 'auto' }}>▾</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: 8, background: T.card }}>
          <input
            aria-label="Szukaj ikony"
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Szukaj ikony"
            style={{ width: '100%', boxSizing: 'border-box', height: 36, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, padding: '0 10px', fontFamily: 'inherit' }}
          />
          <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 8 }}>
            {sections.length === 0 && <div style={{ padding: 12, color: T.muted }}>Brak pasujących ikon</div>}
            {sections.map(section => (
              <div key={section.title} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 6 }}>{section.title}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 5 }}>
                  {section.icons.map(icon => (
                    <button
                      type="button"
                      key={icon.name}
                      aria-label={icon.label}
                      aria-pressed={icon.name === selected?.name}
                      title={icon.label}
                      onClick={() => { onChange(icon.name); setOpen(false); setQuery(''); }}
                      style={{ minHeight: 66, padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: T.radiusSm, border: `1px solid ${icon.name === selected?.name ? T.accent : T.border}`, background: icon.name === selected?.name ? T.accentLight : T.card, color: T.dark, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      <Icon name={icon.name} size={22} />
                      <span style={{ fontSize: 10, lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere' }}>{icon.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
