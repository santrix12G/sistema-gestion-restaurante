'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Aviso, Boton, Cargando, Titulo, Vacio } from '@/components/ui';
import { TarjetaPedido } from '@/components/tarjeta-pedido';
import { llamar } from '@/lib/api';
import { useCambiarEstado } from '@/lib/cambiar-estado';
import { destino, hora, NOMBRE_ESTADO, pesos } from '@/lib/formato';
import { useDatos } from '@/lib/hooks';
import { useSesion } from '@/lib/sesion';
import { useTiempoReal } from '@/lib/tiempo-real';
import { Pedido, TipoPedido, UsuarioSesion } from '@/lib/tipos';

type Vista = 'activos' | 'cerrados';

const COLUMNAS: { tipo: TipoPedido; titulo: string }[] = [
  { tipo: 'MESA', titulo: 'En mesa' },
  { tipo: 'RECOGER', titulo: 'Para recoger' },
  { tipo: 'DOMICILIO', titulo: 'Domicilios' },
];

/** Las mismas reglas que valida la API: así solo aparecen los botones que el usuario puede usar. */
function puedeCerrar(p: Pedido, u: UsuarioSesion) {
  if (u.rol === 'ADMIN') return true;
  if (p.tipo === 'DOMICILIO') return u.rol === 'REPARTIDOR' && p.entrega?.repartidor?.id === u.id;
  return u.rol === 'MESERO' && p.creadoPor?.id === u.id;
}

export default function Pedidos() {
  const { usuario } = useSesion();
  const [vista, setVista] = useState<Vista>('activos');
  const ruta = vista === 'activos' ? '/pedidos' : '/pedidos?estados=PAGADO,CANCELADO';
  const { datos: pedidos, error, recargar } = useDatos(() => llamar<Pedido[]>(ruta), 30_000);
  useTiempoReal(recargar);
  const { cambiar, tomar, ocupado, error: errorCambio } = useCambiarEstado(recargar);
  const atiende = usuario?.rol === 'ADMIN' || usuario?.rol === 'MESERO';

  // Al cambiar de pestaña, carga la otra lista sin esperar a la consulta periódica
  useEffect(() => {
    void recargar();
  }, [ruta, recargar]);

  function acciones(p: Pedido) {
    if (!usuario) return null;
    const deshabilitado = ocupado === p.id;
    const domicilio = p.tipo === 'DOMICILIO';
    const libre = domicilio && !p.entrega?.repartidor;
    return (
      <>
        {usuario.rol === 'REPARTIDOR' && libre && (
          <Boton onClick={() => tomar(p.id)} disabled={deshabilitado}>Llevar domicilio</Boton>
        )}
        {puedeCerrar(p, usuario) && (
          <>
            <Boton
              variante="exito"
              disabled={deshabilitado}
              onClick={() => confirm(`¿Marcar el pedido #${p.numero} como pagado (${pesos(p.total)})?`) && cambiar(p.id, 'PAGADO')}
            >
              {domicilio ? 'Entregado y pagado' : 'Pagado'}
            </Boton>
            <Boton
              variante="peligro"
              disabled={deshabilitado}
              onClick={() => confirm(`¿Cancelar el pedido #${p.numero}?`) && cambiar(p.id, 'CANCELADO')}
            >
              Cancelar
            </Boton>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <Titulo accion={atiende && <Link href="/pedidos/nuevo"><Boton>Nuevo pedido</Boton></Link>}>Pedidos</Titulo>
      <div role="tablist" className="mb-4 inline-flex rounded-xl bg-stone-200/70 p-1 text-sm font-medium">
        {(['activos', 'cerrados'] as Vista[]).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={vista === v}
            onClick={() => setVista(v)}
            className={`rounded-lg px-4 py-1.5 ${vista === v ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
          >
            {v === 'activos' ? 'Activos' : 'Pagados y cancelados hoy'}
          </button>
        ))}
      </div>
      <div className="mb-4 space-y-2">
        <Aviso>{error}</Aviso>
        <Aviso>{errorCambio}</Aviso>
      </div>
      {!pedidos ? (
        !error && <Cargando />
      ) : vista === 'activos' ? (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNAS.map((c) => {
            const lista = pedidos.filter((p) => p.tipo === c.tipo && p.estado === 'ACTIVO');
            return (
              <section key={c.tipo} className="rounded-2xl bg-stone-200/60 p-3">
                <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold text-stone-700">
                  {c.titulo}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs">{lista.length}</span>
                </h2>
                <div className="space-y-3">
                  {lista.map((p) => <TarjetaPedido key={p.id} pedido={p} acciones={acciones(p)} />)}
                  {lista.length === 0 && <p className="px-1 py-4 text-center text-xs text-stone-500">Sin pedidos</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Cerrados pedidos={pedidos.filter((p) => p.estado !== 'ACTIVO')} />
      )}
    </>
  );
}

function Cerrados({ pedidos }: { pedidos: Pedido[] }) {
  if (pedidos.length === 0) return <Vacio>Hoy no se ha pagado ni cancelado ningún pedido.</Vacio>;
  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
      <ul className="divide-y divide-stone-100">
        {pedidos.map((p) => (
          <li key={p.id} className="px-4 py-3">
            <details>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.estado === 'PAGADO' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {NOMBRE_ESTADO[p.estado]}
                </span>
                <span className="flex-1 font-medium">
                  #{p.numero} · {destino(p)} <span className="font-normal text-stone-500">· {hora(p.creadoEn)}</span>
                </span>
                <span className={`font-semibold ${p.estado === 'CANCELADO' ? 'text-stone-400 line-through' : ''}`}>{pesos(p.total)}</span>
              </summary>
              <div className="mt-3 max-w-md">
                <TarjetaPedido pedido={p} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
