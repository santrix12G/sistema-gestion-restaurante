'use client';

import { BookOpen, ChartColumn, CirclePlus, ClipboardList, LayoutGrid, LogOut, LucideIcon, Menu, Users, Wallet, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { BarraAccesibilidad } from '@/components/accesibilidad';
import { ProveedorAvisos } from '@/components/avisos';
import { ProveedorImpresion } from '@/components/impresion';
import { Marca } from '@/components/marca';
import { Pie, SaltarAlContenido } from '@/components/pagina-publica';
import { t } from '@/lib/i18n';
import { useSesion } from '@/lib/sesion';
import { Rol, UsuarioSesion } from '@/lib/tipos';

interface Opcion {
  ruta: string;
  texto: string;
  icono: LucideIcon;
  roles: Rol[];
}

/** El menú, agrupado por lo que hace cada sección. Cada rol solo ve sus opciones */
const GRUPOS: { titulo: string; opciones: Opcion[] }[] = [
  {
    titulo: 'Operación',
    opciones: [
      { ruta: '/pedidos', texto: 'Pedidos', icono: ClipboardList, roles: ['ADMIN', 'MESERO', 'REPARTIDOR'] },
      { ruta: '/pedidos/nuevo', texto: 'Nuevo pedido', icono: CirclePlus, roles: ['ADMIN', 'MESERO'] },
      { ruta: '/caja', texto: 'Caja', icono: Wallet, roles: ['ADMIN'] },
    ],
  },
  {
    titulo: 'Administración',
    opciones: [
      { ruta: '/menu', texto: 'Menú', icono: BookOpen, roles: ['ADMIN', 'MESERO'] },
      { ruta: '/mesas', texto: 'Mesas', icono: LayoutGrid, roles: ['ADMIN'] },
      { ruta: '/personal', texto: 'Personal', icono: Users, roles: ['ADMIN'] },
    ],
  },
  {
    titulo: 'Análisis',
    opciones: [{ ruta: '/estadisticas', texto: 'Estadísticas', icono: ChartColumn, roles: ['ADMIN'] }],
  },
];

const NOMBRE_ROL: Record<Rol, string> = { ADMIN: 'Administrador', MESERO: 'Mesero', REPARTIDOR: 'Repartidor' };

const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export default function PanelLayout({ children }: { children: ReactNode }) {
  const { usuario, lista, salir } = useSesion();
  const router = useRouter();
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (lista && !usuario) router.replace('/login');
  }, [lista, usuario, router]);

  // En el celular, el menú se cierra al cambiar de pantalla
  useEffect(() => setAbierto(false), [ruta]);

  if (!usuario) return null;

  return (
    <ProveedorImpresion>
      <ProveedorAvisos>
        <SaltarAlContenido />
        <div className="flex min-h-screen flex-col lg:pl-64">
          {/* Barra superior, solo en pantallas pequeñas */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
            <Marca />
            <button
              onClick={() => setAbierto(true)}
              className="rounded-lg p-2 text-stone-700 hover:bg-stone-100"
              aria-label={t('Abrir el menú')}
              aria-expanded={abierto}
              aria-controls="menu-lateral"
            >
              <Menu className="size-6" aria-hidden />
            </button>
          </header>

          {abierto && <div className="fixed inset-0 z-30 bg-stone-900/40 lg:hidden" onClick={() => setAbierto(false)} aria-hidden />}

          <aside
            id="menu-lateral"
            className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-stone-200 bg-white transition-transform lg:translate-x-0 ${
              abierto ? 'translate-x-0 shadow-xl' : '-translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between px-5 py-5">
              <Link href="/" className="min-w-0">
                <Marca />
              </Link>
              <button onClick={() => setAbierto(false)} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 lg:hidden" aria-label={t('Cerrar el menú')}>
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2" aria-label={t('Menú principal')}>
              {GRUPOS.map((g) => {
                const opciones = g.opciones.filter((o) => o.roles.includes(usuario.rol));
                if (opciones.length === 0) return null;
                return (
                  <div key={g.titulo}>
                    <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-stone-500">{t(g.titulo)}</p>
                    <ul className="space-y-0.5">
                      {opciones.map((o) => {
                        const activa = ruta === o.ruta;
                        const Icono = o.icono;
                        return (
                          <li key={o.ruta}>
                            <Link
                              href={o.ruta}
                              aria-current={activa ? 'page' : undefined}
                              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                activa ? 'bg-marca-50 text-marca-700' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                              }`}
                            >
                              <Icono className={`size-[18px] ${activa ? 'text-marca-600' : 'text-stone-400'}`} aria-hidden />
                              {t(o.texto)}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </nav>
            <BarraAccesibilidad className="border-t border-stone-200 px-4 pt-3" />
            <TarjetaUsuario usuario={usuario} salir={salir} />
          </aside>

          <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
          <Pie className="print:hidden" />
        </div>
      </ProveedorAvisos>
    </ProveedorImpresion>
  );
}

function TarjetaUsuario({ usuario, salir }: { usuario: UsuarioSesion; salir: () => void }) {
  const rol = t(NOMBRE_ROL[usuario.rol]);
  return (
    <div className="flex items-center gap-3 border-t border-stone-200 px-4 py-4">
      {/* Abre «Mi cuenta», donde cada quien cambia su contraseña */}
      <Link href="/cuenta" className="-m-1 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 hover:bg-stone-100">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-stone-100 text-sm font-semibold text-stone-700" aria-hidden>
          {iniciales(usuario.nombre)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{usuario.nombre}</p>
          {/* El administrador del seed se llama "Administrador": no se repite */}
          {usuario.nombre !== rol && <p className="truncate text-xs text-stone-500">{rol}</p>}
          <p className="truncate text-xs font-medium text-marca-700 underline">{t('Mi cuenta')}</p>
        </div>
      </Link>
      <button onClick={salir} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900" aria-label={t('Cerrar sesión')} title={t('Cerrar sesión')}>
        <LogOut className="size-[18px]" aria-hidden />
      </button>
    </div>
  );
}
