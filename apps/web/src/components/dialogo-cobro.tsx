'use client';

import { ArrowLeftRight, Banknote, CreditCard, LucideIcon, Printer, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Boton } from '@/components/ui';
import { pesos } from '@/lib/formato';
import { regionActual, t } from '@/lib/i18n';
import { MetodoCobro, Pedido } from '@/lib/tipos';

export const METODOS: { metodo: MetodoCobro; texto: string; icono: LucideIcon }[] = [
  { metodo: 'EFECTIVO', texto: 'Efectivo', icono: Banknote },
  { metodo: 'TARJETA', texto: 'Tarjeta', icono: CreditCard },
  { metodo: 'TRANSFERENCIA', texto: 'Transferencia', icono: ArrowLeftRight },
];

/** Billetes con que suele pagar el cliente: los que alcanzan para el total, para no escribir el monto */
function billetesSugeridos(total: number) {
  const opciones = [10_000, 20_000, 50_000, 100_000, 200_000];
  const redondeos = [5_000, 10_000, 50_000].map((r) => Math.ceil(total / r) * r);
  return [...new Set([...redondeos, ...opciones])].filter((v) => v > total).sort((a, b) => a - b).slice(0, 3);
}

interface Props {
  pedido: Pedido;
  /** Si es false, solo se puede cerrar un pedido que ya se pagó en línea */
  cajaAbierta: boolean;
  esAdmin: boolean;
  /** `recibido` es con cuánto pagó en efectivo, si se escribió. `imprimir` pide el tiquete del cliente */
  alCobrar: (metodo: MetodoCobro, opciones: { recibido?: number; imprimir: boolean }) => void;
  alCerrar: () => void;
}

/** Si se imprime el tiquete al cobrar. Se recuerda en este navegador: cada caja tiene o no impresora */
const CLAVE_IMPRIMIR = 'imprimir-tiquete-al-cobrar';
function leerPreferencia() {
  try {
    return localStorage.getItem(CLAVE_IMPRIMIR) === 'si';
  } catch {
    return false;
  }
}
function guardarPreferencia(si: boolean) {
  try {
    localStorage.setItem(CLAVE_IMPRIMIR, si ? 'si' : 'no');
  } catch {
    // Sin almacenamiento (navegación privada) solo no se recuerda
  }
}

/** Cobrar un pedido: con qué paga el cliente y, en efectivo, cuánto entrega y cuánto se le devuelve. */
export function DialogoCobro({ pedido, cajaAbierta, esAdmin, alCobrar, alCerrar }: Props) {
  const pagadoEnLinea = pedido.pagos?.[0]?.estado === 'APROBADO';
  const [metodo, setMetodo] = useState<MetodoCobro>('EFECTIVO');
  const [recibido, setRecibido] = useState('');
  const [imprimir, setImprimir] = useState(leerPreferencia);
  const primerBoton = useRef<HTMLButtonElement>(null);
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;

  // Solo al abrir: la lista de pedidos se recarga sola y no debe mover el foco mientras se escribe
  useEffect(() => {
    primerBoton.current?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && cerrarRef.current();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, []);

  const monto = Number(recibido.replace(/\D/g, '')) || 0;
  const falta = metodo === 'EFECTIVO' && monto > 0 && monto < pedido.total;
  const sinCaja = !cajaAbierta && !pagadoEnLinea;

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (falta || sinCaja) return;
    guardarPreferencia(imprimir);
    alCobrar(metodo, { recibido: metodo === 'EFECTIVO' && monto > 0 ? monto : undefined, imprimir });
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-stone-900/40 p-4" onClick={alCerrar}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-cobro"
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="titulo-cobro" className="text-base font-semibold">
            {t('Cobrar pedido #{numero}', { numero: pedido.numero })}
          </h2>
          <p className="text-2xl font-bold tabular-nums">{pesos(pedido.total)}</p>
        </div>

        {pagadoEnLinea ? (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            <CreditCard className="size-4" aria-hidden />
            {t('Ya se pagó en línea: no cobres')}
          </p>
        ) : sinCaja ? (
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <TriangleAlert className="size-4" aria-hidden />
              {t('La caja está cerrada')}
            </p>
            <p className="mt-1">
              {esAdmin ? (
                <>
                  {t('Abre la caja en')}{' '}
                  <Link href="/caja" className="font-semibold underline">
                    {t('Caja')}
                  </Link>{' '}
                  {t('para poder cobrar.')}
                </>
              ) : (
                t('Pide al administrador que abra la caja para poder cobrar.')
              )}
            </p>
          </div>
        ) : (
          <>
            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-medium text-stone-700">{t('¿Con qué paga?')}</legend>
              <div className="grid grid-cols-3 gap-2">
                {METODOS.map(({ metodo: m, texto, icono: Icono }, i) => (
                  <button
                    key={m}
                    ref={i === 0 ? primerBoton : undefined}
                    type="button"
                    aria-pressed={metodo === m}
                    onClick={() => setMetodo(m)}
                    className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-sm font-semibold ring-1 ${
                      metodo === m ? 'bg-marca-50 text-marca-700 ring-2 ring-marca-500' : 'bg-white text-stone-700 ring-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <Icono className="size-5" aria-hidden />
                    {t(texto)}
                  </button>
                ))}
              </div>
            </fieldset>

            {metodo === 'EFECTIVO' && (
              <div className="mt-4 rounded-xl bg-stone-50 p-3">
                <label className="block text-sm font-medium text-stone-700" htmlFor="recibido">
                  {t('¿Con cuánto paga?')} <span className="font-normal text-stone-500">{t('(opcional, para calcular las vueltas)')}</span>
                </label>
                <input
                  id="recibido"
                  inputMode="numeric"
                  value={recibido ? Number(recibido.replace(/\D/g, '')).toLocaleString(regionActual()) : ''}
                  onChange={(e) => setRecibido(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-lg font-semibold tabular-nums outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setRecibido(String(pedido.total))} className="rounded-full bg-white px-3 py-1 text-xs font-semibold ring-1 ring-stone-300 hover:bg-stone-100">
                    {t('Exacto')}
                  </button>
                  {billetesSugeridos(pedido.total).map((v) => (
                    <button key={v} type="button" onClick={() => setRecibido(String(v))} className="rounded-full bg-white px-3 py-1 text-xs font-semibold tabular-nums ring-1 ring-stone-300 hover:bg-stone-100">
                      {pesos(v)}
                    </button>
                  ))}
                </div>
                {monto > 0 && (
                  <p className={`mt-3 flex items-baseline justify-between text-sm font-semibold ${falta ? 'text-red-700' : 'text-emerald-800'}`} aria-live="polite">
                    {falta ? t('Falta') : t('Vueltas')}
                    <span className="text-xl tabular-nums">{pesos(Math.abs(monto - pedido.total))}</span>
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {!sinCaja && (
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={imprimir} onChange={(e) => setImprimir(e.target.checked)} className="size-4 accent-marca-600" />
            <Printer className="size-4 text-stone-500" aria-hidden />
            {t('Imprimir el tiquete del cliente')}
          </label>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="secundario" onClick={alCerrar} ref={pagadoEnLinea || sinCaja ? primerBoton : undefined}>
            {t('Volver')}
          </Boton>
          {!sinCaja && (
            <Boton type="submit" variante="exito" disabled={falta}>
              {pagadoEnLinea ? t('Marcar pagado') : t('Cobrar {total}', { total: pesos(pedido.total) })}
            </Boton>
          )}
        </div>
      </form>
    </div>
  );
}
