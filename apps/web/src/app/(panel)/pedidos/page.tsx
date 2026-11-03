'use client';

import Link from 'next/link';
import { Aviso, Boton, Cargando, Titulo } from '@/components/ui';
import { TarjetaPedido } from '@/components/tarjeta-pedido';
import { llamar } from '@/lib/api';
import { useCambiarEstado } from '@/lib/cambiar-estado';
import { useDatos } from '@/lib/hooks';
import { useSesion } from '@/lib/sesion';
import { EstadoPedido, Pedido } from '@/lib/tipos';

const COLUMNAS: { estado: EstadoPedido; titulo: string }[] = [
  { estado: 'PENDIENTE', titulo: 'Pendientes de pago' },
  { estado: 'CONFIRMADO', titulo: 'Confirmados' },
  { estado: 'EN_PREPARACION', titulo: 'En preparación' },
  { estado: 'LISTO', titulo: 'Listos' },
  { estado: 'EN_CAMINO', titulo: 'En camino' },
];

export default function Pedidos() {
  const { usuario } = useSesion();
  const { datos: pedidos, error, recargar } = useDatos(() => llamar<Pedido[]>('/pedidos'), 5000);
  const { cambiar, ocupado, error: errorCambio } = useCambiarEstado(recargar);
  const atiende = usuario?.rol === 'ADMIN' || usuario?.rol === 'MESERO';

  // Las columnas de pendientes y en camino solo aparecen cuando tienen pedidos: llegarán con WhatsApp y domicilios
  const columnas = COLUMNAS.filter((c) => !['PENDIENTE', 'EN_CAMINO'].includes(c.estado) || pedidos?.some((p) => p.estado === c.estado));

  // Los botones solo muestran lo que el rol puede hacer. La API vuelve a validarlo.
  function acciones(p: Pedido) {
    if (!atiende) return null;
    const deshabilitado = ocupado === p.id;
    return (
      <>
        {p.estado === 'LISTO' && p.tipo !== 'DOMICILIO' && (
          <Boton onClick={() => cambiar(p.id, 'ENTREGADO')} disabled={deshabilitado}>Entregado</Boton>
        )}
        {(p.estado === 'PENDIENTE' || p.estado === 'CONFIRMADO') && (
          <Boton
            variante="peligro"
            disabled={deshabilitado}
            onClick={() => confirm(`¿Cancelar el pedido #${p.numero}?`) && cambiar(p.id, 'CANCELADO')}
          >
            Cancelar
          </Boton>
        )}
      </>
    );
  }

  return (
    <>
      <Titulo accion={atiende && <Link href="/pedidos/nuevo"><Boton>Nuevo pedido</Boton></Link>}>Pedidos activos</Titulo>
      <div className="mb-4 space-y-2">
        <Aviso>{error}</Aviso>
        <Aviso>{errorCambio}</Aviso>
      </div>
      {!pedidos ? (
        !error && <Cargando />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columnas.map((c) => {
            const lista = pedidos.filter((p) => p.estado === c.estado);
            return (
              <section key={c.estado} className="rounded-2xl bg-stone-200/60 p-3">
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
      )}
    </>
  );
}
