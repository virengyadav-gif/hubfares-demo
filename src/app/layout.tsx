import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Hubfares — B2B Travel Distribution', description: 'Hubfares B2B travel distribution & operations platform.', icons: { icon: '/hubfares-logo.jpeg' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#25272b' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
