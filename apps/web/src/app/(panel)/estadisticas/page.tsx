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
const NOMBRE_CANAL: Record<EstadisticasDia['porCanal'][number]['canal'], string> = {
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
  WEB: 'Web del personal',
  MOVIL: 'App móvil',
};
const CHATBOT = ['WHATSAPP', 'TELEGRAM'];

/** 13 → "1 p. m.", 12 → "12 m.", como se dice en Colombia */
function nombreHora(hora: number) {
  if (hora === 0) return '12 a. m.';
  if (hora === 12) return '12 m.';
  return hora < 12 ? `${hora} a. m.` : `${hora - 12} p. m.`;
}

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
  const { ventas, cancelados, activos, porTipo, porCanal, porHora, horaPico, masVendidos } = datos;
  const maxTipo = Math.max(...porTipo.map((t) => t.total), 1);
  const maxCanal = Math.max(...porCanal.map((c) => c.total), 1);
  const delChatbot = porCanal.filter((c) => CHATBOT.includes(c.canal)).reduce((s, c) => s + c.total, 0);
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

        <Panel titulo="Horas pico" detalle={horaPico !== null ? `Más pedidos a las ${nombreHora(horaPico)}` : undefined}>
          <HorasPico porHora={porHora} horaPico={horaPico} esHoy={esHoy} />
        </Panel>

        <Panel titulo="Ventas por canal" detalle={ventas.total > 0 ? `El chatbot trajo el ${Math.round((delChatbot / ventas.total) * 100)} % de lo vendido` : undefined}>
          <ul className="space-y-3">
            {porCanal.map((c) => (
              <li key={c.canal}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">
                    {NOMBRE_CANAL[c.canal]}
                    {CHATBOT.includes(c.canal) && <span className="ml-2 rounded-full bg-marca-50 px-2 py-0.5 text-xs font-semibold text-marca-700">Chatbot</span>}
                  </span>
                  <span className="text-stone-600">
                    <strong className="text-stone-900">{pesos(c.total)}</strong> · {c.pedidos} {c.pedidos === 1 ? 'pedido' : 'pedidos'}
                  </span>
                </div>
                <Barra proporcion={c.total / maxCanal} />
              </li>
            ))}
          </ul>
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
        Un pedido cuenta el día en que se cobró o se canceló. Lo vendido incluye el costo de los domicilios; los cancelados no suman a ninguna cifra de ventas. Las horas pico
        se miden por la hora en que llegó cada pedido pagado, en hora de Colombia.
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

function Panel({ titulo, detalle, children }: { titulo: string; detalle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="font-semibold">{titulo}</h2>
        {detalle && <p className="text-sm text-stone-500">{detalle}</p>}
      </div>
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

/** Pedidos por hora, desde la primera hasta la última con pedidos (al menos de 11 a. m. a 9 p. m.) */
function HorasPico({ porHora, horaPico, esHoy }: { porHora: EstadisticasDia['porHora']; horaPico: number | null; esHoy: boolean }) {
  const conPedidos = porHora.filter((h) => h.pedidos > 0).map((h) => h.hora);
  if (conPedidos.length === 0) return <Vacio>Aún no hay ventas {esHoy ? 'hoy' : 'ese día'}</Vacio>;
  const horas = porHora.slice(Math.min(11, ...conPedidos), Math.max(21, ...conPedidos) + 1);
  const max = Math.max(...horas.map((h) => h.pedidos));
  return (
    <div className="flex h-44 items-end gap-1" role="list" aria-label="Pedidos por hora">
      {horas.map((h) => (
        <div key={h.hora} role="listitem" className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${nombreHora(h.hora)}: ${h.pedidos} ${h.pedidos === 1 ? 'pedido' : 'pedidos'}, ${pesos(h.total)}`}>
          <span className="text-[10px] font-semibold tabular-nums text-stone-600">{h.pedidos || ''}</span>
          {/* El alto de la barra es relativo a este espacio, sin contar los textos de arriba y abajo */}
          <div className="flex w-full flex-1 items-end">
            <div
              className={`w-full rounded-t ${h.hora === horaPico ? 'bg-marca-600' : 'bg-marca-500/35'}`}
              style={{ height: `${(h.pedidos / max) * 100}%`, minHeight: h.pedidos ? 4 : 0 }}
            />
          </div>
          <span className="w-full truncate text-center text-[10px] text-stone-500">{nombreHora(h.hora).replace(' a. m.', 'a').replace(' p. m.', 'p').replace(' m.', 'm')}</span>
        </div>
      ))}
    </div>
  );
}
