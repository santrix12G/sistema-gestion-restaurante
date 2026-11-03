import { ReactNode } from 'react';
import { destino, hace, pesos } from '@/lib/formato';
import { Pedido } from '@/lib/tipos';

const CANAL: Record<Pedido['canal'], string> = { WEB: 'Local', MOVIL: 'App', WHATSAPP: 'WhatsApp' };

export function TarjetaPedido({ pedido, acciones, grande = false }: { pedido: Pedido; acciones?: ReactNode; grande?: boolean }) {
  return (
    <article className="flex flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className={`font-bold ${grande ? 'text-xl' : 'text-base'}`}>#{pedido.numero} · {destino(pedido)}</p>
          <p className="text-xs text-stone-500">{CANAL[pedido.canal]} · {hace(pedido.creadoEn)}</p>
        </div>
        {!grande && <p className="text-sm font-semibold">{pesos(pedido.total)}</p>}
      </header>
      <ul className={`mb-3 space-y-1 ${grande ? 'text-base' : 'text-sm'}`}>
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
