'use client';

import { CalendarDays, CalendarRange } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Cifra, HorasPico, Panel, VentasPorCanal, VentasPorTipo, hoy, nombreHora, parteDelChatbot, plural } from '@/components/estadisticas';
import { ReportePeriodo } from '@/components/reporte-periodo';
import { Aviso, Cargando, Titulo, Vacio } from '@/components/ui';
import { llamar } from '@/lib/api';
import { pesos } from '@/lib/formato';
import { useDatos } from '@/lib/hooks';
import { useSesion } from '@/lib/sesion';
import { useTiempoReal } from '@/lib/tiempo-real';
import { EstadisticasDia } from '@/lib/tipos';

type Vista = 'dia' | 'periodo';
const VISTAS = [
  { clave: 'dia', texto: 'Un día', icono: CalendarDays },
  { clave: 'periodo', texto: 'Reporte por período', icono: CalendarRange },
] as const;

/** El administrador ve las cifras de un día o el reporte de varios días, con el personal y los tiempos. */
export default function Estadisticas() {
  const { usuario } = useSesion();
  const router = useRouter();
  const [vista, setVista] = useState<Vista>('dia');
  const [fecha, setFecha] = useState(hoy);

  useEffect(() => {
    if (usuario && usuario.rol !== 'ADMIN') router.replace('/pedidos');
  }, [usuario, router]);

  return (
    <>
      <Titulo
        detalle={vista === 'dia' ? 'Lo vendido, lo cancelado y lo más vendido de un día.' : 'Ventas, productos, personal y tiempos de varios días.'}
        accion={
          vista === 'dia' && (
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
          )
        }
      >
        Estadísticas
      </Titulo>
      <div className="mb-5 inline-flex rounded-xl bg-stone-200/70 p-1" role="tablist">
        {VISTAS.map(({ clave, texto, icono: Icono }) => (
          <button
            key={clave}
            role="tab"
            aria-selected={vista === clave}
            onClick={() => setVista(clave)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold ${vista === clave ? 'bg-white shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
          >
            <Icono className="size-4" aria-hidden />
            {texto}
          </button>
        ))}
      </div>
      {/* Cambiar de día monta el resumen de nuevo con sus propios datos */}
      {vista === 'dia' ? <ResumenDia key={fecha} fecha={fecha} /> : <ReportePeriodo />}
    </>
  );
}

function ResumenDia({ fecha }: { fecha: string }) {
  const esHoy = fecha === hoy();
  const { datos, error, recargar } = useDatos(() => llamar<EstadisticasDia>(`/estadisticas/dia?fecha=${fecha}`), esHoy ? 60_000 : undefined);
  // Hoy las cifras se actualizan apenas se cobra o se cancela un pedido
  useTiempoReal(() => {
    if (esHoy) void recargar();
  });

  if (!datos) return error ? <Aviso>{error}</Aviso> : <Cargando />;
  const { ventas, cancelados, activos, porTipo, porCanal, porHora, horaPico, masVendidos } = datos;
  const maxUnidades = Math.max(...masVendidos.map((p) => p.cantidad), 1);
  const sinVentas = `Aún no hay ventas ${esHoy ? 'hoy' : 'ese día'}`;

  return (
    <div className="space-y-4">
      <Aviso>{error}</Aviso>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra titulo="Vendido" valor={pesos(ventas.total)} detalle={plural(ventas.pedidos, 'pedido pagado', 'pedidos pagados')} destacada />
        <Cifra titulo="Promedio por pedido" valor={pesos(ventas.promedio)} detalle={plural(ventas.platos, 'producto vendido', 'productos vendidos')} />
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
            <Vacio>{sinVentas}</Vacio>
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
                  <div className="h-2 rounded-full bg-stone-100">
                    <div className="h-2 rounded-full bg-marca-500" style={{ width: `${(p.cantidad / maxUnidades) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel titulo="Horas pico" detalle={horaPico !== null ? `Más pedidos a las ${nombreHora(horaPico)}` : undefined}>
          <HorasPico porHora={porHora} horaPico={horaPico} sinVentas={sinVentas} />
        </Panel>

        <Panel titulo="Ventas por canal" detalle={parteDelChatbot(porCanal, ventas.total)}>
          <VentasPorCanal porCanal={porCanal} />
        </Panel>

        <Panel titulo="Ventas por tipo de pedido">
          <VentasPorTipo porTipo={porTipo} />
        </Panel>
      </div>
      <p className="text-xs text-stone-500">
        Un pedido cuenta el día en que se cobró o se canceló. Lo vendido incluye el costo de los domicilios; los cancelados no suman a ninguna cifra de ventas. Las horas pico
        se miden por la hora en que llegó cada pedido pagado, en hora de Colombia.
      </p>
    </div>
  );
}
