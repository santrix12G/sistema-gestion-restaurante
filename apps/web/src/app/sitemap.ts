import type { MetadataRoute } from 'next';

/** Mapa del sitio en XML con las páginas públicas (Anexo 1 de la Resolución 1519 de 2020) */
const SITIO = (process.env.NEXT_PUBLIC_SITIO_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  return ['/login', '/recuperar', '/privacidad', '/terminos', '/accesibilidad', '/mapa-del-sitio'].map((ruta) => ({ url: `${SITIO}${ruta}` }));
}
