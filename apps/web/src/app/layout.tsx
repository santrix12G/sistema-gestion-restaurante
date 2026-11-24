import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { ProveedorPreferencias, SCRIPT_PREFERENCIAS } from '@/lib/preferencias';
import { ProveedorSesion } from '@/lib/sesion';
import './globals.css';

// Sin `title` aquí: Next pondría su <title> antes que el de cada página y el navegador usa el primero.
// Cada pantalla pone el suyo con <title> (React 19 lo lleva al <head>) en Titulo y PaginaPublica.
export const metadata: Metadata = {
  description: 'Gestión de pedidos del restaurante',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // El script cambia lang, el contraste y el tamaño de letra antes de dibujar: React no debe quejarse de esa diferencia
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_PREFERENCIAS }} />
      </head>
      <body>
        <ProveedorPreferencias>
          <ProveedorSesion>{children}</ProveedorSesion>
        </ProveedorPreferencias>
      </body>
    </html>
  );
}
