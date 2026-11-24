import type { Metadata } from 'next';
import { ReactNode } from 'react';

// El token del enlace va en la dirección: no se envía a otros sitios ni se indexa
export const metadata: Metadata = { referrer: 'no-referrer', robots: { index: false, follow: false } };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
