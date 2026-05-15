'use client';

import { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { BarChart2, Bell, Cloud, Database, Download, Eye, EyeOff, FileJson, Globe2, Lock, LogOut, Palette, UploadCloud, Wallet } from 'lucide-react';
import { logout } from '@/app/actions/auth';
import { T } from '@/lib/tokens';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import { useSumaUiStore } from '@/lib/stores/ui-store';
import Card from '@/components/ui/Card';

export default function SettingsScreen() {
  const { accounts, categories, allTransactions, recurringTransactions, settlements, investmentHoldings, accountInterest, userEmail, syncError, activeMonth } = useActiveMonthData();
  const privacyMode = useSumaUiStore(state => state.privacyMode);
  const togglePrivacyMode = useSumaUiStore(state => state.togglePrivacyMode);
  const expenseCategories = categories.filter(category => category.types.includes('EXPENSE'));
  const defaultAccount = accounts[0]?.name ?? 'Automatycznie';
  const defaultCategory = expenseCategories[0]?.name ?? 'Automatycznie';
  const navMonth = `month=${encodeURIComponent(activeMonth)}`;

  return (
    <div className="screen settings-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Section title="Konto i synchronizacja">
        <SettingsRow icon={<Wallet size={18} />} title={userEmail ?? 'Konto Suma'} description="Sesja aktywna w webowym workspace" value="Aktywne" />
        <Divider />
        <SettingsRow
          icon={<Cloud size={18} />}
          title="Synchronizacja"
          description={syncError ? 'Ostatnie pobranie danych zwróciło błąd' : 'Dane są pobierane z aktualnego kontraktu sync'}
          value={syncError ? 'Błąd' : 'Włączona'}
          tone={syncError ? T.expense : T.income}
        />
        <Divider />
        <form action={logout}>
          <button style={rowButtonStyle}>
            <span style={rowIconStyle}><LogOut size={18} /></span>
            <span style={{ flex: 1, textAlign: 'left' }}>
              <span style={rowTitleStyle}>Wyloguj</span>
              <span style={rowDescriptionStyle}>Zakończ sesję na tym urządzeniu</span>
            </span>
          </button>
        </form>
      </Section>

      <Section title="Aplikacja">
        <SettingsRow icon={<Palette size={18} />} title="Wygląd" description="Web używa jasnego, desktopowego motywu zgodnego z Suma" value="Jasny" />
        <Divider />
        <SettingsRow icon={<Globe2 size={18} />} title="Język" description="Interfejs workspace" value="Polski" />
        <Divider />
        <SettingsRow icon={<Wallet size={18} />} title="Waluta" description="Format kwot i podsumowań" value="PLN" />
      </Section>

      <Section title="Dodawanie transakcji">
        <SettingsRow icon={<Wallet size={18} />} title="Domyślne konto" description="Pierwszy wybór w formularzach web" value={defaultAccount} />
        <Divider />
        <SettingsRow icon={<BarChart2 size={18} />} title="Domyślna kategoria wydatku" description="Pierwsza dostępna kategoria kosztowa" value={defaultCategory} />
      </Section>

      <Section title="Prywatność i bezpieczeństwo">
        <button onClick={togglePrivacyMode} style={rowButtonStyle}>
          <span style={rowIconStyle}>{privacyMode ? <EyeOff size={18} /> : <Eye size={18} />}</span>
          <span style={{ flex: 1, textAlign: 'left' }}>
            <span style={rowTitleStyle}>Ukrywanie kwot</span>
            <span style={rowDescriptionStyle}>Maskuje wartości finansowe w widokach web</span>
          </span>
          <span style={{ ...valuePillStyle, color: privacyMode ? T.accent : T.muted }}>{privacyMode ? 'Włączone' : 'Wyłączone'}</span>
        </button>
        <Divider />
        <SettingsRow icon={<Lock size={18} />} title="PIN i biometria" description="Funkcja urządzeniowa dostępna w aplikacji Android" value="Android" />
      </Section>

      <Section title="Powiadomienia">
        <Link href={`/settings/budget-notifications?${navMonth}`} style={{ textDecoration: 'none' }}>
          <SettingsRow icon={<Bell size={18} />} title="Alerty budżetowe" description="Monitorowanie progów budżetów dla aktywnego miesiąca" value="Otwórz" />
        </Link>
        <Divider />
        <Link href={`/settings/app-notification-reader?${navMonth}`} style={{ textDecoration: 'none' }}>
          <SettingsRow icon={<Bell size={18} />} title="Czytanie powiadomień bankowych" description="Transakcje z parsera powiadomień Androida" value="Otwórz" />
        </Link>
      </Section>

      <Section title="Dane">
        <div className="settings-data-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, padding: 14 }}>
          <DataTile label="Transakcje" value={allTransactions.length} />
          <DataTile label="Konta" value={accounts.length} />
          <DataTile label="Kategorie" value={categories.length} />
          <DataTile label="Stałe" value={recurringTransactions.length} />
          <DataTile label="Rozliczenia" value={settlements.length} />
          <DataTile label="Inwestycje" value={investmentHoldings.length} />
          <DataTile label="Odsetki" value={accountInterest.length} />
          <DataTile label="Okres" value={activeMonth === 'all' ? 'All' : activeMonth} />
        </div>
        <Divider />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: 14 }}>
          <Link href={`/import-export?${navMonth}`} style={primaryLinkStyle}>
            <UploadCloud size={16} color="white" /> Import/eksport
          </Link>
          <a href="/api/export/sync" download style={secondaryLinkStyle}>
            <FileJson size={16} /> Pobierz JSON
          </a>
          <Link href={`/reports?${navMonth}`} style={secondaryLinkStyle}>
            <Download size={16} /> Raporty
          </Link>
          <Link href={`/budget?${navMonth}`} style={secondaryLinkStyle}>
            <Database size={16} /> Budżety
          </Link>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ color: T.muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', margin: '0 0 8px 2px' }}>{title}</div>
      <Card style={{ overflow: 'hidden' }}>{children}</Card>
    </div>
  );
}

function SettingsRow({ icon, title, description, value, tone = T.mid }: { icon: ReactNode; title: string; description: string; value: string; tone?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, padding: '10px 14px' }}>
      <span style={rowIconStyle}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={rowTitleStyle}>{title}</span>
        <span style={rowDescriptionStyle}>{description}</span>
      </span>
      <span style={{ ...valuePillStyle, color: tone }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: T.border, marginLeft: 58 }} />;
}

function DataTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: 12, minWidth: 0 }}>
      <div style={{ color: T.dark, fontSize: 22, fontWeight: 950, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      <div style={{ color: T.muted, fontSize: 11, fontWeight: 800 }}>{label}</div>
    </div>
  );
}

const rowIconStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  background: T.bg,
  color: T.muted,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const rowTitleStyle: CSSProperties = {
  display: 'block',
  color: T.dark,
  fontSize: 14,
  fontWeight: 850,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const rowDescriptionStyle: CSSProperties = {
  display: 'block',
  color: T.muted,
  fontSize: 12,
  marginTop: 2,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const valuePillStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  maxWidth: 160,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const rowButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minHeight: 64,
  padding: '10px 14px',
  width: '100%',
};

const primaryLinkStyle: CSSProperties = {
  minHeight: 38,
  padding: '0 12px',
  borderRadius: T.radiusSm,
  background: T.accent,
  color: 'white',
  fontWeight: 850,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  textDecoration: 'none',
};

const secondaryLinkStyle: CSSProperties = {
  minHeight: 38,
  padding: '0 12px',
  borderRadius: T.radiusSm,
  background: T.bg,
  color: T.mid,
  fontWeight: 850,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  textDecoration: 'none',
};
