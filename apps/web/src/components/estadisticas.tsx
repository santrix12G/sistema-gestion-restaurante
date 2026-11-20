import { ReactNode } from 'react';
import { Vacio } from '@/components/ui';
import { pesos } from '@/lib/formato';
import { EstadisticasDia, TipoPedido } from '@/lib/tipos';

/** Piezas que comparten el resumen del día y el reporte por período */

export const NOMBRE_TIPO: Record<TipoPedido, string> = { MESA: 'En mesa', DOMICILIO: 'Domicilio', RECOGER: 'Para recoger' };
export const NOMBRE_CANAL: Record<EstadisticasDia['porCanal'][number]['canal'], string> = {
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
  WEB: 'Web del personal',
  MOVIL: 'App móvil',
};
export const CHATBOT = ['WHATSAPP', 'TELEGRAM'];

/** 13 → "1 p. m.", 12 → "12 m.", como se dice en Colombia */
export function nombreHora(hora: number) {
  if (hora === 0) return '12 a. m.';
  if (hora === 12) return '12 m.';
  return hora < 12 ? `${hora} a. m.` : `${hora - 12} p. m.`;
}

/** Fecha de hoy en Colombia como AAAA-MM-DD, la misma que usa la API */
export const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function Cifra({ titulo, valor, detalle, destacada }: { titulo: string; valor: string; detalle: ReactNode; destacada?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ring-1 ${destacada ? 'bg-marca-600 text-white ring-marca-600' : 'bg-white ring-stone-200'}`}>
      <p className={`text-sm font-medium ${destacada ? 'text-white/80' : 'text-stone-500'}`}>{titulo}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{valor}</p>
      <p className={`mt-1 text-xs ${destacada ? 'text-white/80' : 'text-stone-500'}`}>{detalle}</p>
    </div>
  );
}

export function Panel({ titulo, detalle, children, className = '' }: { titulo: string; detalle?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-4 ring-1 ring-stone-200 ${className}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="font-semibold">{titulo}</h2>
        {detalle && <p className="text-sm text-stone-500">{detalle}</p>}
      </div>
      {children}
    </section>
  );
}

export function Barra({ proporcion }: { proporcion: number }) {
  return (
    <div className="h-2 rounded-full bg-stone-100">
      <div className="h-2 rounded-full bg-marca-500" style={{ width: `${Math.max(proporcion * 100, proporcion > 0 ? 2 : 0)}%` }} />
    </div>
  );
}

/** Ventas de cada canal, con la marca de los que llegan por el chatbot */
export function VentasPorCanal({ porCanal }: { porCanal: EstadisticasDia['porCanal'] }) {
  const max = Math.max(...porCanal.map((c) => c.total), 1);
  return (
    <ul className="space-y-3">
      {porCanal.map((c) => (
        <li key={c.canal}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">
              {NOMBRE_CANAL[c.canal]}
              {CHATBOT.includes(c.canal) && <span className="ml-2 rounded-full bg-marca-50 px-2 py-0.5 text-xs font-semibold text-marca-700">Chatbot</span>}
            </span>
            <span className="text-stone-600">
              <strong className="text-stone-900">{pesos(c.total)}</strong> · {plural(c.pedidos, 'pedido', 'pedidos')}
            </span>
          </div>
          <Barra proporcion={c.total / max} />
        </li>
      ))}
    </ul>
  );
}

/** Lo que dejó el chatbot, como texto para el encabezado del panel de canales */
export function parteDelChatbot(porCanal: EstadisticasDia['porCanal'], vendido: number) {
  if (vendido <= 0) return undefined;
  const delChatbot = porCanal.filter((c) => CHATBOT.includes(c.canal)).reduce((s, c) => s + c.total, 0);
  return `El chatbot trajo el ${Math.round((delChatbot / vendido) * 100)} % de lo vendido`;
}

export function VentasPorTipo({ porTipo }: { porTipo: EstadisticasDia['porTipo'] }) {
  const max = Math.max(...porTipo.map((t) => t.total), 1);
  return (
    <ul className="space-y-3">
      {porTipo.map((t) => (
        <li key={t.tipo}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{NOMBRE_TIPO[t.tipo]}</span>
            <span className="text-stone-600">
              <strong className="text-stone-900">{pesos(t.total)}</strong> · {plural(t.pedidos, 'pedido', 'pedidos')}
            </span>
          </div>
          <Barra proporcion={t.total / max} />
        </li>
      ))}
    </ul>
  );
}

/** Pedidos por hora, desde la primera hasta la última con pedidos (al menos de 11 a. m. a 9 p. m.) */
export function HorasPico({ porHora, horaPico, sinVentas }: { porHora: EstadisticasDia['porHora']; horaPico: number | null; sinVentas: string }) {
  const conPedidos = porHora.filter((h) => h.pedidos > 0).map((h) => h.hora);
  if (conPedidos.length === 0) return <Vacio>{sinVentas}</Vacio>;
  const horas = porHora.slice(Math.min(11, ...conPedidos), Math.max(21, ...conPedidos) + 1);
  const max = Math.max(...horas.map((h) => h.pedidos));
  return (
    <div className="flex h-44 items-end gap-1" role="list" aria-label="Pedidos por hora">
      {horas.map((h) => (
        <div key={h.hora} role="listitem" className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${nombreHora(h.hora)}: ${plural(h.pedidos, 'pedido', 'pedidos')}, ${pesos(h.total)}`}>
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
