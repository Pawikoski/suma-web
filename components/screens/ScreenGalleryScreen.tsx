'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart2, ClipboardList, EyeOff, Home, Wallet } from 'lucide-react';
import { T } from '@/lib/tokens';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import Card from '@/components/ui/Card';
import Bar from '@/components/ui/Bar';
import Icon from '@/components/ui/Icon';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

const sections = [
  {
    title: 'Home',
    description: 'Główne karty startowe, konta i kategorie z bieżącego sync.',
    variants: [
      { key: 'home/full', title: 'Pełny stan', description: 'Majątek, konta i top kategorie.' },
      { key: 'home/loading', title: 'Ładowanie', description: 'Szkielet kart przed gotowymi danymi.' },
    ],
  },
  {
    title: 'Konta',
    description: 'Karty kont z różnymi typami sald.',
    variants: [{ key: 'accounts/list', title: 'Lista kont', description: 'Bank, gotówka i konta inwestycyjne.' }],
  },
  {
    title: 'Transakcje',
    description: 'Lista transakcji oraz stany empty/loading.',
    variants: [
      { key: 'transactions/full', title: 'Pełna lista', description: 'Wiersze, konto, kategoria i kwota.' },
      { key: 'transactions/empty', title: 'Empty state', description: 'Okres bez transakcji.' },
      { key: 'transactions/loading', title: 'Ładowanie', description: 'Szkielet listy bez migania pustego stanu.' },
    ],
  },
  {
    title: 'Budżety',
    description: 'Postęp budżetu miesięcznego i progi ostrzegawcze.',
    variants: [{ key: 'budgets/overview', title: 'Przegląd budżetu', description: 'Kategorie blisko limitu i po limicie.' }],
  },
  {
    title: 'Prywatność',
    description: 'Finansowe elementy po włączeniu maskowania kwot.',
    variants: [{ key: 'privacy/hidden', title: 'Ukryte kwoty', description: 'Konta, budżet i transakcje w trybie prywatnym.' }],
  },
] as const;

export default function ScreenGalleryScreen() {
  const data = useActiveMonthData();

  return (
    <div className="screen screen-gallery-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <Link href={`/settings?month=${data.activeMonth}`} style={{ height: 38, padding: '0 12px', borderRadius: T.radiusSm, background: T.bg, color: T.mid, fontWeight: 850, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Ustawienia
        </Link>
      </div>
      <div>
        <h1 style={{ color: T.dark, fontSize: 26, fontWeight: 950 }}>Screen Gallery</h1>
        <div style={{ color: T.muted, fontSize: 14, marginTop: 4 }}>Debugowy katalog ekranów i stanów UI/UX dla webowego workspace Suma.</div>
      </div>

      {sections.map(section => (
        <section key={section.title} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <h2 style={{ color: T.dark, fontSize: 20, fontWeight: 900 }}>{section.title}</h2>
            <div style={{ color: T.muted, fontSize: 13 }}>{section.description}</div>
          </div>
          <div className="screen-gallery-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {section.variants.map(variant => (
              <GalleryVariant key={variant.key} title={variant.title} description={variant.description}>
                <VariantPreview variantKey={variant.key} data={data} />
              </GalleryVariant>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GalleryVariant({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: T.dark, fontSize: 15, fontWeight: 850 }}>{title}</div>
        <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>{description}</div>
      </div>
      {children}
    </Card>
  );
}

function VariantPreview({ variantKey, data }: { variantKey: string; data: ReturnType<typeof useActiveMonthData> }) {
  if (variantKey === 'home/full') return <HomePreview data={data} />;
  if (variantKey === 'home/loading') return <LoadingPreview icon={<Home size={18} color={T.accent} />} />;
  if (variantKey === 'accounts/list') return <AccountsPreview data={data} />;
  if (variantKey === 'transactions/full') return <TransactionsPreview data={data} />;
  if (variantKey === 'transactions/empty') return <EmptyPreview />;
  if (variantKey === 'transactions/loading') return <LoadingPreview icon={<ClipboardList size={18} color={T.accent} />} />;
  if (variantKey === 'budgets/overview') return <BudgetPreview data={data} />;
  if (variantKey === 'privacy/hidden') return <PrivacyPreview data={data} />;
  return null;
}

function HomePreview({ data }: { data: ReturnType<typeof useActiveMonthData> }) {
  const totalBalance = data.accounts.filter(account => account.includeInNetWorth).reduce((sum, account) => sum + account.balance, 0);
  const topCategory = [...data.categories].sort((a, b) => b.spent - a.spent)[0];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <PreviewTile icon={<Wallet size={16} color={T.accent} />} label="Majątek" value={<PrivacyAmount amount={totalBalance} />} />
      <PreviewTile icon={<BarChart2 size={16} color={T.expense} />} label="Top kategoria" value={topCategory?.name ?? 'Brak'} />
    </div>
  );
}

function AccountsPreview({ data }: { data: ReturnType<typeof useActiveMonthData> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.accounts.slice(0, 3).map(account => (
        <div key={account.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 42, borderRadius: T.radiusSm, background: T.bg, padding: '0 10px' }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: account.color, display: 'grid', placeItems: 'center' }}>
            <Icon name={account.icon} size={15} color="white" />
          </span>
          <span style={{ flex: 1, color: T.dark, fontSize: 13, fontWeight: 800 }}>{account.name}</span>
          <PrivacyAmount amount={account.balance} style={{ color: T.mid, fontSize: 12, fontWeight: 850 }} />
        </div>
      ))}
    </div>
  );
}

function TransactionsPreview({ data }: { data: ReturnType<typeof useActiveMonthData> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.transactions.slice(0, 3).map(transaction => (
        <div key={transaction.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 42, borderRadius: T.radiusSm, background: T.bg, padding: '0 10px' }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: transaction.catBg, display: 'grid', placeItems: 'center' }}>
            <Icon name={transaction.catIcon} size={15} color={transaction.catColor} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', color: T.dark, fontSize: 12, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{transaction.desc || transaction.cat}</span>
            <span style={{ display: 'block', color: T.muted, fontSize: 10 }}>{transaction.acc}</span>
          </span>
          <PrivacyAmount amount={Math.abs(transaction.amount)} prefix={transaction.type === 'expense' ? '- ' : '+ '} style={{ color: transaction.type === 'expense' ? T.expense : T.income, fontSize: 12, fontWeight: 900 }} />
        </div>
      ))}
    </div>
  );
}

function BudgetPreview({ data }: { data: ReturnType<typeof useActiveMonthData> }) {
  const budgeted = data.categories.filter(category => category.budget && category.budget > 0).slice(0, 3);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {budgeted.length === 0 && <EmptyPreview label="Brak budżetów kategorii" />}
      {budgeted.map(category => {
        const pct = category.budget ? category.spent / category.budget * 100 : 0;
        return (
          <div key={category.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5, color: T.mid, fontSize: 12, fontWeight: 850 }}>
              <span>{category.name}</span>
              <span>{Math.round(pct)}%</span>
            </div>
            <Bar pct={pct} color={pct >= 100 ? T.expense : pct >= 80 ? T.warn : category.color} height={6} />
          </div>
        );
      })}
    </div>
  );
}

function PrivacyPreview({ data }: { data: ReturnType<typeof useActiveMonthData> }) {
  const firstTx = data.transactions[0];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
      <div style={{ borderRadius: T.radiusSm, background: T.bg, padding: 12 }}>
        <div style={{ color: T.muted, fontSize: 11, fontWeight: 800 }}>Majątek</div>
        <span className="privacy-amount" style={{ color: T.dark, fontSize: 20, fontWeight: 950 }}>••••••</span>
      </div>
      <div style={{ borderRadius: T.radiusSm, background: T.bg, padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <EyeOff size={16} color={T.accent} />
        <span style={{ color: T.mid, fontSize: 12, fontWeight: 850 }}>{firstTx?.cat ?? 'Transakcja'}</span>
        <span className="privacy-amount" style={{ marginLeft: 'auto', color: T.expense, fontSize: 12, fontWeight: 900 }}>••••••</span>
      </div>
    </div>
  );
}

function LoadingPreview({ icon }: { icon: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: T.accentLight, display: 'grid', placeItems: 'center' }}>{icon}</div>
      {[0, 1, 2].map(index => (
        <div key={index} style={{ height: 14, borderRadius: 999, background: index === 0 ? '#e2e8f0' : '#edf2f7', width: `${90 - index * 18}%` }} />
      ))}
    </div>
  );
}

function EmptyPreview({ label = 'Brak transakcji w wybranym okresie' }: { label?: string }) {
  return (
    <div style={{ minHeight: 118, borderRadius: T.radiusSm, background: T.bg, display: 'grid', placeItems: 'center', color: T.faint, fontSize: 13, textAlign: 'center', padding: 16 }}>
      {label}
    </div>
  );
}

function PreviewTile({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div style={{ borderRadius: T.radiusSm, background: T.bg, padding: 12, minHeight: 96, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: T.card, display: 'grid', placeItems: 'center' }}>{icon}</span>
      <span>
        <span style={{ display: 'block', color: T.dark, fontSize: 14, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        <span style={{ display: 'block', color: T.muted, fontSize: 11, fontWeight: 800 }}>{label}</span>
      </span>
    </div>
  );
}
