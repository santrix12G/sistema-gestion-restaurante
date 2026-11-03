'use client';

import { Aviso, Boton, Cargando, Titulo, Vacio } from '@/components/ui';
import { TarjetaPedido } from '@/components/tarjeta-pedido';
import { llamar } from '@/lib/api';
import { useCambiarEstado } from '@/lib/cambiar-estado';
import { useDatos } from '@/lib/hooks';
import { Pedido } from '@/lib/tipos';

export default function Cocina() {
  const { datos: pedidos, error, recargar } = useDatos(() => llamar<Pedido[]>('/pedidos?estados=CONFIRMADO,EN_PREPARACION'), 5000);
  const { cambiar, ocupado, error: errorCambio } = useCambiarEstado(recargar);

  const porPreparar = pedidos?.filter((p) => p.estado === 'CONFIRMADO') ?? [];
  const enPreparacion = pedidos?.filter((p) => p.estado === 'EN_PREPARACION') ?? [];

  return (
    <>
      <Titulo>Cocina</Titulo>
      <div className="mb-4 space-y-2">
        <Aviso>{error}</Aviso>
        <Aviso>{errorCambio}</Aviso>
      </div>
      {!pedidos ? (
        !error && <Cargando />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Por preparar ({porPreparar.length})</h2>
            <div className="space-y-3">
              {porPreparar.map((p) => (
                <TarjetaPedido key={p.id} pedido={p} grande acciones={
                  <Boton onClick={() => cambiar(p.id, 'EN_PREPARACION')} disabled={ocupado === p.id} className="w-full py-3 text-base">Empezar</Boton>
                } />
              ))}
              {porPreparar.length === 0 && <Vacio>No hay pedidos nuevos</Vacio>}
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold">En preparación ({enPreparacion.length})</h2>
            <div className="space-y-3">
              {enPreparacion.map((p) => (
                <TarjetaPedido key={p.id} pedido={p} grande acciones={
                  <Boton onClick={() => cambiar(p.id, 'LISTO')} disabled={ocupado === p.id} variante="exito" className="w-full py-3 text-base">Listo</Boton>
                } />
              ))}
              {enPreparacion.length === 0 && <Vacio>Nada en preparación</Vacio>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
