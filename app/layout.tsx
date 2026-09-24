import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Providers from './providers';
import 'material-icons/iconfont/material-icons.css';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Suma',
  description: 'Twój tracker finansów osobistych',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${inter.variable} h-full`}>
      <body className="min-h-full" style={{ fontFamily: 'var(--font-inter), -apple-system, sans-serif' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
