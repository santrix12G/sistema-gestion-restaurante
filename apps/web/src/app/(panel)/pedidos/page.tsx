'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Aviso, Boton, Cargando, Titulo, Vacio } from '@/components/ui';
import { TarjetaPedido } from '@/components/tarjeta-pedido';
import { llamar } from '@/lib/api';
import { coincide } from '@/lib/buscar';
import { useCambiarEstado } from '@/lib/cambiar-estado';
import { destino, hora, NOMBRE_ESTADO, pesos } from '@/lib/formato';
import { useDatos } from '@/lib/hooks';
import { useSesion } from '@/lib/sesion';
import { useTiempoReal } from '@/lib/tiempo-real';
import { Pedido, UsuarioSesion } from '@/lib/tipos';

type Vista = 'activos' | 'cerrados';
interface Columna {
  clave: string;
  titulo: string;
  filtro: (p: Pedido) => boolean;
  vacia: string;
}

/** Las mismas reglas que valida la API: así solo aparecen los botones que el usuario puede usar. */
function puedeCerrar(p: Pedido, u: UsuarioSesion) {
  if (u.rol === 'ADMIN') return true;
  if (p.tipo === 'DOMICILIO') return u.rol === 'REPARTIDOR' && p.entrega?.repartidor?.id === u.id;
  return u.rol === 'MESERO' && p.creadoPor?.id === u.id;
}

/**
 * La API ya devuelve solo los pedidos de cada uno: el mesero, los que registró; el repartidor, sus domicilios
 * y los disponibles. Aquí solo se reparten en columnas.
 */
function columnasPara(u: UsuarioSesion): Columna[] {
  if (u.rol === 'REPARTIDOR') {
    return [
      { clave: 'mios', titulo: 'Llevando yo', filtro: (p) => p.entrega?.repartidor?.id === u.id, vacia: 'No llevas ningún domicilio' },
      { clave: 'libres', titulo: 'Disponibles para llevar', filtro: (p) => !p.entrega?.repartidor, vacia: 'No hay domicilios esperando' },
    ];
  }
  const columnas: Columna[] = [
    { clave: 'mesa', titulo: 'En mesa', filtro: (p) => p.tipo === 'MESA', vacia: 'Sin pedidos' },
    { clave: 'recoger', titulo: 'Para recoger', filtro: (p) => p.tipo === 'RECOGER', vacia: 'Sin pedidos' },
  ];
  // Los domicilios llegan por el chatbot: el mesero no los registra
  if (u.rol === 'ADMIN') columnas.push({ clave: 'domicilio', titulo: 'Domicilios', filtro: (p) => p.tipo === 'DOMICILIO', vacia: 'Sin pedidos' });
  return columnas;
}

export default function Pedidos() {
  const { usuario } = useSesion();
  const [vista, setVista] = useState<Vista>('activos');
  const [consulta, setConsulta] = useState('');
  const ruta = vista === 'activos' ? '/pedidos' : '/pedidos?estados=PAGADO,CANCELADO';
  const { datos: pedidos, error, recargar } = useDatos(() => llamar<Pedido[]>(ruta), 30_000);
  useTiempoReal(recargar);
  const { cambiar, tomar, ocupado, error: errorCambio } = useCambiarEstado(recargar);
  const atiende = usuario?.rol === 'ADMIN' || usuario?.rol === 'MESERO';

  // Al cambiar de pestaña, carga la otra lista sin esperar a la consulta periódica
  useEffect(() => {
    void recargar();
  }, [ruta, recargar]);

  if (!usuario) return null;
  const columnas = columnasPara(usuario);
  const enVista = (pedidos ?? []).filter((p) => (vista === 'activos' ? p.estado === 'ACTIVO' : p.estado !== 'ACTIVO'));
  const hallados = enVista.filter((p) => coincide(p, consulta));
  const buscando = consulta.trim() !== '';

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

  const titulo = usuario.rol === 'ADMIN' ? 'Pedidos' : usuario.rol === 'REPARTIDOR' ? 'Mis domicilios' : 'Mis pedidos';
  const pestanaCerrados = usuario.rol === 'ADMIN' ? 'Pagados y cancelados hoy' : 'Mi historial de hoy';

  return (
    <>
      <Titulo accion={atiende && <Link href="/pedidos/nuevo"><Boton>Nuevo pedido</Boton></Link>}>{titulo}</Titulo>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="tablist" className="inline-flex rounded-xl bg-stone-200/70 p-1 text-sm font-medium">
          {(['activos', 'cerrados'] as Vista[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={vista === v}
              onClick={() => setVista(v)}
              className={`rounded-lg px-4 py-1.5 ${vista === v ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
            >
              {v === 'activos' ? 'Activos' : pestanaCerrados}
            </button>
          ))}
        </div>
        <label className="w-full sm:w-80">
          <span className="sr-only">Buscar pedidos</span>
          <input
            type="search"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Buscar: M3, #12, cliente, producto…"
            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
          />
        </label>
        {buscando && pedidos && (
          <span className="text-sm text-stone-500">
            {hallados.length} de {enVista.length}
          </span>
        )}
      </div>
      <div className="mb-4 space-y-2">
        <Aviso>{error}</Aviso>
        <Aviso>{errorCambio}</Aviso>
      </div>
      {!pedidos ? (
        !error && <Cargando />
      ) : vista === 'activos' ? (
        <div className={`grid gap-4 ${columnas.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {columnas.map((c) => {
            const lista = hallados.filter(c.filtro);
            return (
              <section key={c.clave} className="rounded-2xl bg-stone-200/60 p-3">
                <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold text-stone-700">
                  {c.titulo}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs">{lista.length}</span>
                </h2>
                <div className="space-y-3">
                  {lista.map((p) => <TarjetaPedido key={p.id} pedido={p} acciones={acciones(p)} />)}
                  {lista.length === 0 && (
                    <p className="px-1 py-4 text-center text-xs text-stone-500">{buscando ? 'Nada coincide con la búsqueda' : c.vacia}</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Cerrados pedidos={hallados} buscando={buscando} />
      )}
    </>
  );
}

function Cerrados({ pedidos, buscando }: { pedidos: Pedido[]; buscando: boolean }) {
  if (pedidos.length === 0) {
    return <Vacio>{buscando ? 'Ningún pedido de hoy coincide con la búsqueda.' : 'Hoy no se ha pagado ni cancelado ningún pedido.'}</Vacio>;
  }
  const pagados = pedidos.filter((p) => p.estado === 'PAGADO');
  const cancelados = pedidos.length - pagados.length;
  return (
    <>
      <p className="mb-3 text-sm text-stone-600">
        <span className="font-semibold text-stone-900">{pesos(pagados.reduce((suma, p) => suma + p.total, 0))}</span> cobrados en{' '}
        {pagados.length} {pagados.length === 1 ? 'pedido' : 'pedidos'}
        {cancelados > 0 && ` · ${cancelados} ${cancelados === 1 ? 'cancelado' : 'cancelados'}`}
      </p>
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
                    #{p.numero} · {destino(p)} <span className="font-normal text-stone-500">· {hora(p.actualizadoEn)}</span>
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
    </>
  );
}
