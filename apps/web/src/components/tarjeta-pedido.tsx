import { ReactNode } from 'react';
import { destino, hace, pesos } from '@/lib/formato';
import { Pedido } from '@/lib/tipos';

const CANAL: Record<Pedido['canal'], string> = { WEB: 'Local', MOVIL: 'App', WHATSAPP: 'WhatsApp', TELEGRAM: 'Telegram' };

export function TarjetaPedido({ pedido, acciones }: { pedido: Pedido; acciones?: ReactNode }) {
  return (
    <article className="flex flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">#{pedido.numero} · {destino(pedido)}</p>
          <p className="text-xs text-stone-500">
            {CANAL[pedido.canal]}{pedido.creadoPor && ` · ${pedido.creadoPor.nombre}`} · {hace(pedido.creadoEn)}
          </p>
        </div>
        <p className="text-sm font-semibold">{pesos(pedido.total)}</p>
      </header>
      {pedido.entrega && (
        <div className="mb-3 space-y-1 text-sm text-stone-700">
          <p>📍 {pedido.entrega.direccionTexto}</p>
          {pedido.estado === 'ACTIVO' && (
            <p className={`text-xs font-semibold ${pedido.entrega.repartidor ? 'text-sky-700' : 'text-amber-700'}`}>
              {pedido.entrega.repartidor ? `🛵 En camino con ${pedido.entrega.repartidor.nombre}` : 'Esperando repartidor'}
            </p>
          )}
        </div>
      )}
      <ul className="mb-3 space-y-1 text-sm">
        {pedido.detalles.map((d) => (
          <li key={d.id}>
            <span className="font-semibold">{d.cantidad}×</span> {d.nombreProducto}
            {d.notas && <span className="block pl-6 text-sm font-medium text-marca-700">→ {d.notas}</span>}
          </li>
        ))}
      </ul>
      {pedido.notas && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{pedido.notas}</p>}
      {acciones && <div className="mt-auto flex flex-wrap gap-2">{acciones}</div>}
    </article>
  );
}
