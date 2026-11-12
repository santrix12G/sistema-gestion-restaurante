'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { Aviso, Cargando, Titulo, Vacio } from '@/components/ui';
import { llamar } from '@/lib/api';
import { pesos } from '@/lib/formato';
import { useDatos } from '@/lib/hooks';
import { useSesion } from '@/lib/sesion';
import { useTiempoReal } from '@/lib/tiempo-real';
import { EstadisticasDia, TipoPedido } from '@/lib/tipos';

const NOMBRE_TIPO: Record<TipoPedido, string> = { MESA: 'En mesa', DOMICILIO: 'Domicilio', RECOGER: 'Para recoger' };

/** Fecha de hoy en Colombia como AAAA-MM-DD, la misma que usa la API */
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

/** El administrador ve lo vendido, lo cancelado y lo más vendido del día. */
export default function Estadisticas() {
  const { usuario } = useSesion();
  const router = useRouter();
  const [fecha, setFecha] = useState(hoy);

  useEffect(() => {
    if (usuario && usuario.rol !== 'ADMIN') router.replace('/pedidos');
  }, [usuario, router]);

  return (
    <>
      <Titulo
        accion={
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            Día
            <input
              type="date"
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
              value={fecha}
              max={hoy()}
              onChange={(e) => setFecha(e.target.value || hoy())}
            />
          </label>
        }
      >
        Estadísticas
      </Titulo>
      {/* Cambiar de día monta el resumen de nuevo con sus propios datos */}
      <Resumen key={fecha} fecha={fecha} />
    </>
  );
}

function Resumen({ fecha }: { fecha: string }) {
  const esHoy = fecha === hoy();
  const { datos, error, recargar } = useDatos(() => llamar<EstadisticasDia>(`/estadisticas/dia?fecha=${fecha}`), esHoy ? 60_000 : undefined);
  // Hoy las cifras se actualizan apenas se cobra o se cancela un pedido
  useTiempoReal(() => {
    if (esHoy) void recargar();
  });

  if (!datos) return error ? <Aviso>{error}</Aviso> : <Cargando />;
  const { ventas, cancelados, activos, porTipo, masVendidos } = datos;
  const maxTipo = Math.max(...porTipo.map((t) => t.total), 1);
  const maxUnidades = Math.max(...masVendidos.map((p) => p.cantidad), 1);

  return (
    <div className="space-y-4">
      <Aviso>{error}</Aviso>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra titulo="Vendido" valor={pesos(ventas.total)} detalle={`${ventas.pedidos} ${ventas.pedidos === 1 ? 'pedido pagado' : 'pedidos pagados'}`} destacada />
        <Cifra titulo="Promedio por pedido" valor={pesos(ventas.promedio)} detalle={`${ventas.platos} ${ventas.platos === 1 ? 'producto vendido' : 'productos vendidos'}`} />
        <Cifra titulo="Cancelados" valor={String(cancelados.pedidos)} detalle={`${pesos(cancelados.total)} que no se cobraron`} />
        {activos ? (
          <Cifra titulo="Abiertos ahora" valor={String(activos.pedidos)} detalle={`${pesos(activos.total)} por cobrar`} />
        ) : (
          <Cifra titulo="Abiertos ahora" valor="—" detalle="Solo se muestra para hoy" />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Más vendidos">
          {masVendidos.length === 0 ? (
            <Vacio>Aún no hay ventas {esHoy ? 'hoy' : 'ese día'}</Vacio>
          ) : (
            <ol className="space-y-3">
              {masVendidos.map((p, i) => (
                <li key={p.productoId}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">
                      <span className="mr-2 text-stone-400">{i + 1}.</span>
                      {p.nombre}
                    </span>
                    <span className="shrink-0 text-stone-600">
                      <strong className="text-stone-900">{p.cantidad}</strong> {p.cantidad === 1 ? 'unidad' : 'unidades'} · {pesos(p.total)}
                    </span>
                  </div>
                  <Barra proporcion={p.cantidad / maxUnidades} />
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel titulo="Ventas por tipo de pedido">
          <ul className="space-y-3">
            {porTipo.map((t) => (
              <li key={t.tipo}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{NOMBRE_TIPO[t.tipo]}</span>
                  <span className="text-stone-600">
                    <strong className="text-stone-900">{pesos(t.total)}</strong> · {t.pedidos} {t.pedidos === 1 ? 'pedido' : 'pedidos'}
                  </span>
                </div>
                <Barra proporcion={t.total / maxTipo} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <p className="text-xs text-stone-500">
        Un pedido cuenta el día en que se cobró o se canceló. Lo vendido incluye el costo de los domicilios; los cancelados no suman a lo vendido ni a los más vendidos.
      </p>
    </div>
  );
}

function Cifra({ titulo, valor, detalle, destacada }: { titulo: string; valor: string; detalle: string; destacada?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ring-1 ${destacada ? 'bg-marca-600 text-white ring-marca-600' : 'bg-white ring-stone-200'}`}>
      <p className={`text-sm font-medium ${destacada ? 'text-white/80' : 'text-stone-500'}`}>{titulo}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{valor}</p>
      <p className={`mt-1 text-xs ${destacada ? 'text-white/80' : 'text-stone-500'}`}>{detalle}</p>
    </div>
  );
}

function Panel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <h2 className="mb-4 font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function Barra({ proporcion }: { proporcion: number }) {
  return (
    <div className="h-2 rounded-full bg-stone-100">
      <div className="h-2 rounded-full bg-marca-500" style={{ width: `${Math.max(proporcion * 100, proporcion > 0 ? 2 : 0)}%` }} />
    </div>
  );
}
