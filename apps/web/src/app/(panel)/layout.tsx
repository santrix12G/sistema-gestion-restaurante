'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { useSesion } from '@/lib/sesion';
import { Rol } from '@/lib/tipos';

const NAVEGACION: { ruta: string; texto: string; roles: Rol[] }[] = [
  { ruta: '/pedidos', texto: 'Pedidos', roles: ['ADMIN', 'MESERO', 'COCINA', 'REPARTIDOR'] },
  { ruta: '/pedidos/nuevo', texto: 'Nuevo pedido', roles: ['ADMIN', 'MESERO'] },
  { ruta: '/cocina', texto: 'Cocina', roles: ['ADMIN', 'COCINA'] },
  { ruta: '/menu', texto: 'Menú', roles: ['ADMIN', 'COCINA'] },
  { ruta: '/chatbot', texto: 'Simulador WhatsApp', roles: ['ADMIN'] },
];

const NOMBRE_ROL: Record<Rol, string> = { ADMIN: 'Administrador', MESERO: 'Mesero', COCINA: 'Cocina', REPARTIDOR: 'Repartidor' };

export default function PanelLayout({ children }: { children: ReactNode }) {
  const { usuario, lista, salir } = useSesion();
  const router = useRouter();
  const ruta = usePathname();

  useEffect(() => {
    if (lista && !usuario) router.replace('/login');
  }, [lista, usuario, router]);

  if (!usuario) return null;
  const opciones = NAVEGACION.filter((n) => n.roles.includes(usuario.rol));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-bold text-marca-600">Restaurante</Link>
          <nav className="flex flex-1 flex-wrap gap-1">
            {opciones.map((o) => (
              <Link
                key={o.ruta}
                href={o.ruta}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${ruta === o.ruta ? 'bg-marca-50 text-marca-700' : 'text-stone-600 hover:bg-stone-100'}`}
              >
                {o.texto}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-stone-600">
              {usuario.nombre} · <span className="text-stone-400">{NOMBRE_ROL[usuario.rol]}</span>
            </span>
            <button onClick={salir} className="font-medium text-stone-600 underline-offset-2 hover:underline">Salir</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
