import { Bike, CircleX, Clock, CreditCard, Hourglass, LucideIcon, MapPin, MessageCircle, Monitor, Send, Smartphone, Undo2 } from 'lucide-react';
import { ReactNode } from 'react';
import { destino, pesos } from '@/lib/formato';
import { useAhora } from '@/lib/hooks';
import { EstadoPago, Pedido } from '@/lib/tipos';

/** Por dónde llegó el pedido, con su ícono y color */
const CANAL: Record<Pedido['canal'], { texto: string; icono: LucideIcon; clase: string }> = {
  WEB: { texto: 'Local', icono: Monitor, clase: 'text-stone-500' },
  MOVIL: { texto: 'App', icono: Smartphone, clase: 'text-stone-500' },
  WHATSAPP: { texto: 'WhatsApp', icono: MessageCircle, clase: 'text-emerald-600' },
  TELEGRAM: { texto: 'Telegram', icono: Send, clase: 'text-sky-600' },
};

/** Lo que el personal necesita saber del pago en línea: si ya está pagado, no se cobra al entregar. */
const PAGO: Record<EstadoPago, { texto: string; icono: LucideIcon; clase: string }> = {
  APROBADO: { texto: 'Pagado en línea · no cobrar', icono: CreditCard, clase: 'bg-emerald-50 text-emerald-800' },
  PENDIENTE: { texto: 'Pago en línea pendiente', icono: Hourglass, clase: 'bg-amber-50 text-amber-800' },
  RECHAZADO: { texto: 'Pago en línea rechazado · cobrar en efectivo', icono: CircleX, clase: 'bg-red-50 text-red-800' },
  REEMBOLSADO: { texto: 'Pago en línea reembolsado', icono: Undo2, clase: 'bg-stone-100 text-stone-700' },
};

/**
 * Cuánto lleva esperando un pedido abierto, en tres niveles. Así se ve de un vistazo cuál atender primero.
 * Hasta 15 minutos va bien, hasta 30 hay que estar pendiente y después ya se demoró.
 */
export const MINUTOS_ATENCION = 15;
export const MINUTOS_DEMORA = 30;
const ESPERA = {
  bien: { borde: 'border-l-emerald-500', etiqueta: 'bg-emerald-50 text-emerald-700' },
  atencion: { borde: 'border-l-amber-500', etiqueta: 'bg-amber-50 text-amber-800' },
  demora: { borde: 'border-l-red-500', etiqueta: 'bg-red-50 text-red-700' },
};

export function nivelEspera(minutos: number): keyof typeof ESPERA {
  if (minutos < MINUTOS_ATENCION) return 'bien';
  return minutos < MINUTOS_DEMORA ? 'atencion' : 'demora';
}

function textoEspera(minutos: number) {
  if (minutos < 1) return 'Ahora';
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
}

function EtiquetaPago({ pedido }: { pedido: Pedido }) {
  const estado = pedido.pagos?.[0]?.estado;
  if (!estado) return null;
  const { texto, icono: Icono, clase } = PAGO[estado];
  return (
    <p className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold ${clase}`}>
      <Icono className="size-3.5 shrink-0" aria-hidden />
      {texto}
    </p>
  );
}

export function TarjetaPedido({ pedido, acciones }: { pedido: Pedido; acciones?: ReactNode }) {
  const ahora = useAhora();
  const abierto = pedido.estado === 'ACTIVO';
  const minutos = Math.max(0, Math.floor((ahora - new Date(pedido.creadoEn).getTime()) / 60_000));
  const espera = ESPERA[nivelEspera(minutos)];
  const canal = CANAL[pedido.canal];
  const IconoCanal = canal.icono;

  return (
    <article className={`flex flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200 ${abierto ? `border-l-4 ${espera.borde}` : ''}`}>
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-bold">
            <span className="text-stone-400">#{pedido.numero}</span> {destino(pedido)}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-stone-500">
            <span className={`inline-flex items-center gap-1 font-medium ${canal.clase}`}>
              <IconoCanal className="size-3.5" aria-hidden />
              {canal.texto}
            </span>
            {pedido.creadoPor && <span>· {pedido.creadoPor.nombre}</span>}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className="text-base font-bold tabular-nums">{pesos(pedido.total)}</p>
          {abierto && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${espera.etiqueta}`} title="Tiempo desde que llegó el pedido">
              <Clock className="size-3" aria-hidden />
              {textoEspera(minutos)}
            </span>
          )}
        </div>
      </header>
      <EtiquetaPago pedido={pedido} />
      {pedido.entrega && (
        <div className="mb-3 space-y-1 text-sm text-stone-700">
          <p className="flex gap-1.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-stone-400" aria-hidden />
            {pedido.entrega.direccionTexto}
          </p>
          {abierto && (
            <p className={`flex items-center gap-1.5 text-xs font-semibold ${pedido.entrega.repartidor ? 'text-sky-700' : 'text-amber-700'}`}>
              <Bike className="size-4" aria-hidden />
              {pedido.entrega.repartidor ? `En camino con ${pedido.entrega.repartidor.nombre}` : 'Esperando repartidor'}
            </p>
          )}
        </div>
      )}
      <ul className="mb-3 space-y-1.5 text-sm">
        {pedido.detalles.map((d) => (
          <li key={d.id} className="flex gap-2">
            <span className="grid h-5 min-w-6 place-items-center rounded bg-stone-100 px-1 text-xs font-bold tabular-nums">{d.cantidad}</span>
            <span>
              {d.nombreProducto}
              {d.notas && <span className="block text-xs font-semibold text-marca-700">{d.notas}</span>}
            </span>
          </li>
        ))}
      </ul>
      {pedido.notas && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{pedido.notas}</p>}
      {acciones && <div className="mt-auto flex flex-wrap gap-2 border-t border-stone-100 pt-3">{acciones}</div>}
    </article>
  );
}
