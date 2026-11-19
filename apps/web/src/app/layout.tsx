import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { NOMBRE_RESTAURANTE } from '@/components/marca';
import { ProveedorSesion } from '@/lib/sesion';
import './globals.css';

export const metadata: Metadata = {
  title: NOMBRE_RESTAURANTE,
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
