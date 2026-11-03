import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { ProveedorSesion } from '@/lib/sesion';
import './globals.css';

export const metadata: Metadata = {
  title: 'Restaurante',
  description: 'Gestión de pedidos del restaurante',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ProveedorSesion>{children}</ProveedorSesion>
      </body>
    </html>
  );
}
