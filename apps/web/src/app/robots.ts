import type { MetadataRoute } from 'next';

const SITIO = (process.env.NEXT_PUBLIC_SITIO_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/** Los buscadores solo ven las páginas públicas; el panel del personal no se indexa (Anexo 3: ocultar páginas administrativas) */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: ['/login', '/privacidad', '/terminos', '/accesibilidad', '/mapa-del-sitio'], disallow: '/' },
    sitemap: `${SITIO}/sitemap.xml`,
  };
}
