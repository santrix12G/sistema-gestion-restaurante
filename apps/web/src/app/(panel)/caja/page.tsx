'use client';

import { ArrowDownLeft, ArrowUpRight, Globe, Lock, LockOpen, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { useAvisos } from '@/components/avisos';
import { METODOS } from '@/components/dialogo-cobro';
import { NOMBRE_RESTAURANTE } from '@/components/marca';
import { Cifra, Panel, plural } from '@/components/estadisticas';
import { Aviso, Boton, Cargando, Campo, Titulo, Vacio } from '@/components/ui';
import { llamar, mensajeDeError } from '@/lib/api';
import { hora, pesos } from '@/lib/formato';
import { useDatos } from '@/lib/hooks';
import { regionActual, t } from '@/lib/i18n';
import { useSesion } from '@/lib/sesion';
import { useTiempoReal } from '@/lib/tiempo-real';
import { Caja, CajaAbierta, CajaCerrada, MetodoPago } from '@/lib/tipos';

const NOMBRE_METODO: Record<MetodoPago, string> = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia', ONLINE: 'En línea' };
const ICONO_METODO = { ...Object.fromEntries(METODOS.map((m) => [m.metodo, m.icono])), ONLINE: Globe } as Record<MetodoPago, typeof Globe>;

const fechaHora = (fecha: string) => new Date(fecha).toLocaleString(regionActual(), { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
/** Lee un monto escrito con o sin puntos: "150.000" → 150000 */
const leerPesos = (texto: string) => Number(texto.replace(/\D/g, '')) || 0;
const mostrarPesos = (texto: string) => (texto ? leerPesos(texto).toLocaleString(regionActual()) : '');

/** Caja del restaurante: abrir con la base, entradas y salidas, y cerrar con el arqueo. Solo el administrador. */
export default function PaginaCaja() {
  const { usuario } = useSesion();
  const router = useRouter();
  const { datos, error, recargar } = useDatos(() => llamar<{ caja: CajaAbierta | null }>('/caja/actual'), 30_000);
  const historial = useDatos(() => llamar<CajaCerrada[]>('/caja/historial'));
  // Cada cobro cambia las cuentas de la caja abierta
  useTiempoReal(recargar);
  const [ultimoCierre, setUltimoCierre] = useState<Caja>();

  useEffect(() => {
    if (usuario && usuario.rol !== 'ADMIN') router.replace('/pedidos');
  }, [usuario, router]);

  async function alCambiar(cierre?: Caja) {
    setUltimoCierre(cierre);
    await Promise.all([recargar(), historial.recargar()]);
  }

  const caja = datos?.caja;
  return (
    <>
      <Titulo detalle={caja ? t('Abierta desde {fecha} por {nombre}', { fecha: fechaHora(caja.abiertaEn), nombre: caja.abiertaPor.nombre }) : t('Abre la caja con la base para empezar a cobrar.')}>
        <title>{`${t('Caja')} · ${NOMBRE_RESTAURANTE}`}</title>
        <span className="flex items-center gap-3">
          {t('Caja')}
          {datos && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${caja ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-200 text-stone-600'}`}>
              {caja ? <LockOpen className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
              {caja ? t('Abierta') : t('Cerrada')}
            </span>
          )}
        </span>
      </Titulo>
      {!datos ? (
        error ? <Aviso>{error}</Aviso> : <Cargando />
      ) : (
        <div className="space-y-4">
          <Aviso>{error}</Aviso>
          {ultimoCierre && !caja && <ResultadoCierre caja={ultimoCierre} />}
          {caja ? <CajaAbiertaVista caja={caja} alCambiar={alCambiar} /> : <AbrirCaja alAbrir={() => alCambiar()} />}
          <Panel titulo={t('Cierres anteriores')} detalle={t('Los últimos 30')}>
            {!historial.datos ? (
              historial.error ? <Aviso>{historial.error}</Aviso> : <Cargando />
            ) : (
              <Historial cajas={historial.datos} />
            )}
          </Panel>
        </div>
      )}
    </>
  );
}

function AbrirCaja({ alAbrir }: { alAbrir: () => Promise<void> }) {
  const { avisar } = useAvisos();
  const [base, setBase] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();

  async function abrir(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(undefined);
    try {
      await llamar('/caja/abrir', { metodo: 'POST', cuerpo: { base: leerPesos(base) } });
      avisar(t('Caja abierta con {base} de base', { base: pesos(leerPesos(base)) }));
      await alAbrir();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={abrir} className="rounded-2xl bg-white p-6 ring-1 ring-stone-200">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-marca-50 text-marca-600">
          <Wallet className="size-6" aria-hidden />
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{t('Abrir la caja')}</h2>
          <p className="mt-1 text-sm text-stone-600">
            {t('Cuenta el efectivo con que empiezas, para dar vueltas. Mientras la caja esté cerrada nadie puede cobrar pedidos.')}
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Campo
              etiqueta={t('Base en efectivo')}
              inputMode="numeric"
              placeholder="0"
              value={mostrarPesos(base)}
              onChange={(e) => setBase(e.target.value.replace(/\D/g, '').slice(0, 9))}
              className="w-56"
            />
            <Boton type="submit" disabled={enviando}>
              <LockOpen className="size-4" aria-hidden />
              {enviando ? t('Abriendo…') : t('Abrir caja')}
            </Boton>
          </div>
          <div className="mt-3">
            <Aviso>{error}</Aviso>
          </div>
        </div>
      </div>
    </form>
  );
}

function CajaAbiertaVista({ caja, alCambiar }: { caja: CajaAbierta; alCambiar: (cierre?: Caja) => Promise<void> }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra titulo={t('Efectivo en caja')} valor={pesos(caja.efectivoEsperado)} detalle={t('Lo que debería haber al contar')} destacada />
        <Cifra titulo={t('Vendido en el turno')} valor={pesos(caja.vendido)} detalle={plural(caja.pagos.length, 'cobro', 'cobros')} />
        <Cifra titulo={t('Base')} valor={pesos(caja.base)} detalle={t('Efectivo con que se abrió')} />
        <Cifra titulo={t('Entradas y salidas')} valor={pesos(caja.entradas - caja.salidas)} detalle={`+${pesos(caja.entradas)} · −${pesos(caja.salidas)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo={t('Por forma de pago')} detalle={t('Solo el efectivo se cuenta en la caja')}>
          <ul className="divide-y divide-stone-100">
            {caja.porMetodo.map((m) => {
              const Icono = ICONO_METODO[m.metodo];
              return (
                <li key={m.metodo} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <Icono className="size-4 text-stone-500" aria-hidden />
                    {t(NOMBRE_METODO[m.metodo])}
                  </span>
                  <span className="text-stone-600">
                    <strong className="text-stone-900 tabular-nums">{pesos(m.total)}</strong> · {plural(m.pagos, 'cobro', 'cobros')}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
        <CerrarCaja caja={caja} alCerrar={alCambiar} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo={t('Entradas y salidas')} detalle={t('Dinero que no es de ventas')}>
          <NuevoMovimiento alGuardar={() => alCambiar()} />
          {caja.movimientos.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">{t('Aún no hay movimientos en este turno.')}</p>
          ) : (
            <ul className="mt-4 divide-y divide-stone-100">
              {caja.movimientos.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    {m.tipo === 'ENTRADA' ? <ArrowDownLeft className="size-4 shrink-0 text-emerald-600" aria-label={t('Entrada')} /> : <ArrowUpRight className="size-4 shrink-0 text-red-600" aria-label={t('Salida')} />}
                    <span className="truncate">{m.motivo}</span>
                    <span className="shrink-0 text-xs text-stone-400">{hora(m.creadoEn)}</span>
                  </span>
                  <strong className={`shrink-0 tabular-nums ${m.tipo === 'ENTRADA' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {m.tipo === 'ENTRADA' ? '+' : '−'}
                    {pesos(m.monto)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel titulo={t('Cobros del turno')} detalle={caja.pagos.length > 0 ? t('Del más reciente al más antiguo') : undefined}>
          {caja.pagos.length === 0 ? (
            <Vacio>{t('Aún no se ha cobrado ningún pedido')}</Vacio>
          ) : (
            <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto">
              {caja.pagos.map((p) => {
                const Icono = ICONO_METODO[p.metodo];
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-semibold text-stone-400">#{p.numeroPedido}</span>
                      <span className="inline-flex items-center gap-1 text-stone-600">
                        <Icono className="size-3.5" aria-hidden />
                        {t(NOMBRE_METODO[p.metodo])}
                      </span>
                      <span className="truncate text-xs text-stone-400">
                        {hora(p.cobradoEn)}
                        {p.cobradoPor && ` · ${p.cobradoPor.nombre}`}
                      </span>
                    </span>
                    <strong className="shrink-0 tabular-nums">{pesos(p.monto)}</strong>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

function NuevoMovimiento({ alGuardar }: { alGuardar: () => Promise<void> }) {
  const { avisar } = useAvisos();
  const [tipo, setTipo] = useState<'ENTRADA' | 'SALIDA'>('SALIDA');
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(undefined);
    try {
      await llamar('/caja/movimientos', { metodo: 'POST', cuerpo: { tipo, monto: leerPesos(monto), motivo } });
      avisar(t(tipo === 'ENTRADA' ? 'Entrada de {monto} registrada' : 'Salida de {monto} registrada', { monto: pesos(leerPesos(monto)) }));
      setMonto('');
      setMotivo('');
      await alGuardar();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-3 rounded-xl bg-stone-50 p-3">
      <div className="inline-flex rounded-lg bg-stone-200/70 p-1 text-sm font-semibold" role="radiogroup" aria-label={t('Tipo de movimiento')}>
        {(['SALIDA', 'ENTRADA'] as const).map((opcion) => (
          <button
            key={opcion}
            type="button"
            role="radio"
            aria-checked={tipo === opcion}
            onClick={() => setTipo(opcion)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 ${tipo === opcion ? 'bg-white shadow-sm' : 'text-stone-600'}`}
          >
            {opcion === 'SALIDA' ? <ArrowUpRight className="size-4 text-red-600" aria-hidden /> : <ArrowDownLeft className="size-4 text-emerald-600" aria-hidden />}
            {opcion === 'SALIDA' ? t('Salida') : t('Entrada')}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <Campo etiqueta={t('Monto')} inputMode="numeric" placeholder="0" required value={mostrarPesos(monto)} onChange={(e) => setMonto(e.target.value.replace(/\D/g, '').slice(0, 9))} />
        <Campo
          etiqueta={t('Motivo')}
          required
          maxLength={120}
          placeholder={tipo === 'SALIDA' ? t('Ej.: compra de hielo') : t('Ej.: sencillo para vueltas')}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </div>
      <Aviso>{error}</Aviso>
      <Boton type="submit" variante="secundario" disabled={enviando || !leerPesos(monto) || !motivo.trim()}>
        {enviando ? t('Guardando…') : t(tipo === 'SALIDA' ? 'Registrar salida' : 'Registrar entrada')}
      </Boton>
    </form>
  );
}

function CerrarCaja({ caja, alCerrar }: { caja: CajaAbierta; alCerrar: (cierre: Caja) => Promise<void> }) {
  const { avisar, confirmar } = useAvisos();
  const [contado, setContado] = useState('');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();
  const valor = leerPesos(contado);
  const diferencia = contado ? valor - caja.efectivoEsperado : null;
  const abiertos = caja.pedidosAbiertos?.pedidos ?? 0;

  async function cerrar(e: FormEvent) {
    e.preventDefault();
    const si = await confirmar({
      titulo: t('¿Cerrar la caja?'),
      detalle: [
        t('Contaste {valor}: {diferencia}.', { valor: pesos(valor), diferencia: textoDiferencia(diferencia!) }),
        abiertos > 0 ? t('Quedan {n} que no se podrán cobrar hasta abrir otra caja.', { n: plural(abiertos, 'pedido abierto', 'pedidos abiertos') }) : '',
      ].join(' '),
      aceptar: t('Cerrar caja'),
      peligro: abiertos > 0,
    });
    if (!si) return;
    setEnviando(true);
    setError(undefined);
    try {
      const cierre = await llamar<Caja>('/caja/cerrar', { metodo: 'POST', cuerpo: { efectivoContado: valor, notas: notas || undefined } });
      avisar(t('Caja cerrada'));
      await alCerrar(cierre);
    } catch (err) {
      setError(mensajeDeError(err));
      setEnviando(false);
    }
  }

  return (
    <Panel titulo={t('Cerrar caja y arqueo')} detalle={t('Cuenta el efectivo y compáralo')}>
      <form onSubmit={cerrar} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-xs text-stone-500">{t('Debería haber')}</p>
            <p className="text-xl font-bold tabular-nums">{pesos(caja.efectivoEsperado)}</p>
            <p className="mt-1 text-xs text-stone-500">
              {t('Base + efectivo cobrado')} {caja.entradas || caja.salidas ? t('+ entradas − salidas') : ''}
            </p>
          </div>
          <Campo
            etiqueta={t('Efectivo contado')}
            inputMode="numeric"
            placeholder="0"
            required
            value={mostrarPesos(contado)}
            onChange={(e) => setContado(e.target.value.replace(/\D/g, '').slice(0, 9))}
          />
        </div>
        {diferencia !== null && <Diferencia valor={diferencia} />}
        <Campo etiqueta={t('Notas (opcional)')} maxLength={300} placeholder={t('Ej.: faltó un billete de 2.000')} value={notas} onChange={(e) => setNotas(e.target.value)} />
        {abiertos > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {t('Hay {n} por {total}. Si cierras ahora, se cobrarán en la siguiente caja.', { n: plural(abiertos, 'pedido abierto', 'pedidos abiertos'), total: pesos(caja.pedidosAbiertos!.total) })}
          </p>
        )}
        <Aviso>{error}</Aviso>
        <Boton type="submit" disabled={enviando || !contado} className="w-full">
          <Lock className="size-4" aria-hidden />
          {enviando ? t('Cerrando…') : t('Cerrar caja')}
        </Boton>
      </form>
    </Panel>
  );
}

const textoDiferencia = (d: number) => (d === 0 ? t('la caja cuadra') : d > 0 ? t('sobran {valor}', { valor: pesos(d) }) : t('faltan {valor}', { valor: pesos(-d) }));

function Diferencia({ valor, grande }: { valor: number; grande?: boolean }) {
  const clase = valor === 0 ? 'bg-emerald-50 text-emerald-800' : valor > 0 ? 'bg-sky-50 text-sky-800' : 'bg-red-50 text-red-800';
  const titulo = t(valor === 0 ? 'Cuadra' : valor > 0 ? 'Sobrante' : 'Faltante');
  return (
    <p className={`flex items-baseline justify-between rounded-lg px-3 py-2 font-semibold ${clase} ${grande ? 'text-base' : 'text-sm'}`} aria-live="polite">
      {titulo}
      <span className={`tabular-nums ${grande ? 'text-2xl' : 'text-lg'}`}>{valor === 0 ? pesos(0) : `${valor > 0 ? '+' : '−'}${pesos(Math.abs(valor))}`}</span>
    </p>
  );
}

function ResultadoCierre({ caja }: { caja: Caja }) {
  return (
    <section className="rounded-2xl bg-white p-4 ring-2 ring-marca-500">
      <h2 className="font-semibold">{t('Arqueo de la caja que acabas de cerrar')}</h2>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
        <Dato titulo={t('Vendido')}>{pesos(caja.vendido)}</Dato>
        <Dato titulo={t('Debía haber')}>{pesos(caja.efectivoEsperado)}</Dato>
        <Dato titulo={t('Se contó')}>{pesos(caja.efectivoContado ?? 0)}</Dato>
        <div className="sm:col-span-1">{caja.diferencia !== null && <Diferencia valor={caja.diferencia} grande />}</div>
      </dl>
    </section>
  );
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{titulo}</dt>
      <dd className="text-lg font-bold tabular-nums">{children}</dd>
    </div>
  );
}

function Historial({ cajas }: { cajas: CajaCerrada[] }) {
  if (cajas.length === 0) return <Vacio>{t('Aún no se ha cerrado ninguna caja')}</Vacio>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-xs text-stone-500">
          <tr>
            <th className="pb-1 text-left font-medium">{t('Turno')}</th>
            <th className="pb-1 text-right font-medium">{t('Vendido')}</th>
            <th className="pb-1 text-right font-medium">{t('Debía haber')}</th>
            <th className="pb-1 text-right font-medium">{t('Se contó')}</th>
            <th className="pb-1 text-right font-medium">{t('Diferencia')}</th>
          </tr>
        </thead>
        <tbody>
          {cajas.map((c) => (
            <tr key={c.id} className="border-t border-stone-100 align-top">
              <td className="py-2">
                <p className="font-medium">{fechaHora(c.abiertaEn)}</p>
                <p className="text-xs text-stone-500">
                  {t('Cerró {nombre} a las {hora}', { nombre: c.cerradaPor?.nombre ?? '—', hora: c.cerradaEn ? hora(c.cerradaEn) : '—' })}
                  {c.notasCierre && ` · ${c.notasCierre}`}
                </p>
              </td>
              <td className="py-2 text-right tabular-nums">{pesos(c.vendido)}</td>
              <td className="py-2 text-right tabular-nums">{pesos(c.efectivoEsperado)}</td>
              <td className="py-2 text-right tabular-nums">{pesos(c.efectivoContado ?? 0)}</td>
              <td className={`py-2 text-right font-semibold tabular-nums ${!c.diferencia ? 'text-emerald-700' : c.diferencia > 0 ? 'text-sky-700' : 'text-red-700'}`}>
                {!c.diferencia ? t('Cuadra') : `${c.diferencia > 0 ? '+' : '−'}${pesos(Math.abs(c.diferencia))}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
