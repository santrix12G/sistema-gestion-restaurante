'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { BarraAccesibilidad } from '@/components/accesibilidad';
import { Marca, NOMBRE_RESTAURANTE } from '@/components/marca';
import { t } from '@/lib/i18n';

/** Datos de contacto del negocio. Se configuran en el despliegue; si faltan, no salen */
export const CONTACTO = {
  correo: process.env.NEXT_PUBLIC_CONTACTO_CORREO,
  telefono: process.env.NEXT_PUBLIC_TIQUETE_TELEFONO,
  direccion: process.env.NEXT_PUBLIC_TIQUETE_DIRECCION,
};

/** Las páginas públicas que enlaza el pie de página y el mapa del sitio */
export const PAGINAS_PUBLICAS = [
  { ruta: '/login', texto: 'Iniciar sesión' },
  { ruta: '/recuperar', texto: 'Recuperar la contraseña' },
  { ruta: '/privacidad', texto: 'Política de tratamiento de datos' },
  { ruta: '/terminos', texto: 'Términos y condiciones' },
  { ruta: '/accesibilidad', texto: 'Declaración de accesibilidad' },
  { ruta: '/mapa-del-sitio', texto: 'Mapa del sitio' },
];

/** Enlace para saltar el menú e ir directo al contenido con el teclado (CC10 del Anexo 1) */
export function SaltarAlContenido() {
  return (
    <a
      href="#contenido"
      className="sr-only z-50 rounded-lg bg-stone-900 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      {t('Saltar al contenido principal')}
    </a>
  );
}

/** Pie de página: contacto, políticas y mapa del sitio */
export function Pie({ className = '' }: { className?: string }) {
  return (
    <footer className={`border-t border-stone-200 bg-white px-4 py-6 text-sm text-stone-600 sm:px-6 ${className}`}>
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:justify-between">
        <div>
          <p className="font-semibold text-stone-900">{NOMBRE_RESTAURANTE}</p>
          {CONTACTO.direccion && <p>{CONTACTO.direccion}</p>}
          {CONTACTO.telefono && (
            <p>
              {t('Teléfono')}: <a href={`tel:${CONTACTO.telefono.replace(/\s+/g, '')}`}>{CONTACTO.telefono}</a>
            </p>
          )}
          {CONTACTO.correo && (
            <p>
              {t('Correo')}: <a href={`mailto:${CONTACTO.correo}`}>{CONTACTO.correo}</a>
            </p>
          )}
        </div>
        <nav aria-label={t('Enlaces del pie de página')}>
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {PAGINAS_PUBLICAS.slice(2).map((p) => (
              <li key={p.ruta}>
                <Link href={p.ruta} className="hover:text-stone-900 hover:underline">
                  {t(p.texto)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

/** Marco de las páginas públicas: encabezado con las herramientas de accesibilidad, contenido y pie */
export function PaginaPublica({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* React 19 lleva el <title> al <head>: cada página tiene su título (CC23 del Anexo 1) */}
      <title>{`${titulo} · ${NOMBRE_RESTAURANTE}`}</title>
      <SaltarAlContenido />
      <header className="border-b border-stone-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link href="/login" aria-label={t('Ir al inicio de sesión')}>
            <Marca />
          </Link>
          <BarraAccesibilidad />
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 outline-none sm:px-6">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">{titulo}</h1>
        <div className="space-y-4 leading-relaxed text-stone-700 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-stone-900 [&_li]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
      </main>
      <Pie />
    </div>
  );
}
