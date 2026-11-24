'use client';

import Link from 'next/link';
import { PAGINAS_PUBLICAS, PaginaPublica } from '@/components/pagina-publica';
import { t } from '@/lib/i18n';

/** Mapa del sitio (Anexo 1 de la Resolución 1519 de 2020). La versión XML está en /sitemap.xml */
const PANEL = [
  { ruta: '/pedidos', texto: 'Pedidos' },
  { ruta: '/pedidos/nuevo', texto: 'Nuevo pedido' },
  { ruta: '/caja', texto: 'Caja' },
  { ruta: '/menu', texto: 'Menú' },
  { ruta: '/mesas', texto: 'Mesas' },
  { ruta: '/personal', texto: 'Personal' },
  { ruta: '/estadisticas', texto: 'Estadísticas' },
];

export default function MapaDelSitio() {
  return (
    <PaginaPublica titulo={t('Mapa del sitio')}>
      <h2>{t('Páginas públicas')}</h2>
      <ul>
        {PAGINAS_PUBLICAS.map((p) => (
          <li key={p.ruta}>
            <Link href={p.ruta} className="text-marca-700 hover:underline">
              {t(p.texto)}
            </Link>
          </li>
        ))}
      </ul>
      <h2>{t('Panel del personal (requiere iniciar sesión)')}</h2>
      <ul>
        {PANEL.map((p) => (
          <li key={p.ruta}>
            <Link href={p.ruta} className="text-marca-700 hover:underline">
              {t(p.texto)}
            </Link>
          </li>
        ))}
      </ul>
    </PaginaPublica>
  );
}
