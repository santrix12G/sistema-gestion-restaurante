'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { NOMBRE_RESTAURANTE } from '@/components/marca';
import { destino, pesos } from '@/lib/formato';
import { regionActual, t } from '@/lib/i18n';
import { MetodoCobro, Pedido } from '@/lib/tipos';

/**
 * Impresión desde el navegador, pensada para impresoras térmicas de tirilla de 80 mm (72 mm de área útil).
 * Mientras se imprime, solo se ve el documento: el resto de la página se oculta con print:hidden.
 */

/** Datos del negocio para el tiquete del cliente. Se configuran en el despliegue (Vercel); si faltan, no salen. */
const NEGOCIO = {
  nit: process.env.NEXT_PUBLIC_TIQUETE_NIT,
  direccion: process.env.NEXT_PUBLIC_TIQUETE_DIRECCION,
  telefono: process.env.NEXT_PUBLIC_TIQUETE_TELEFONO,
  mensaje: process.env.NEXT_PUBLIC_TIQUETE_MENSAJE,
};

const NOMBRE_METODO: Record<MetodoCobro | 'ONLINE', string> = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia', ONLINE: 'En línea' };

/** Lo que se sabe del cobro en el momento de cobrar: así el tiquete lleva la forma de pago y las vueltas */
export interface DatosCobro {
  metodo: MetodoCobro | 'ONLINE';
  /** Con cuánto pagó en efectivo, si se escribió */
  recibido?: number;
}

const fechaHora = (fecha: string | Date) =>
  new Date(fecha).toLocaleString(regionActual(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

interface ContextoImpresion {
  /** Imprime el documento y resuelve cuando se cierra el cuadro de impresión */
  imprimir: (documento: ReactNode) => Promise<void>;
}
const Contexto = createContext<ContextoImpresion | null>(null);

export function ProveedorImpresion({ children }: { children: ReactNode }) {
  const [documento, setDocumento] = useState<ReactNode>(null);
  const terminar = useRef<() => void>(undefined);

  const imprimir = useCallback(
    (doc: ReactNode) =>
      new Promise<void>((resolver) => {
        terminar.current = resolver;
        setDocumento(doc);
      }),
    [],
  );

  // Cuando el documento ya está en la página, se abre el cuadro de impresión del navegador
  useEffect(() => {
    if (!documento) return;
    const listo = () => {
      setDocumento(null);
      terminar.current?.();
      terminar.current = undefined;
    };
    window.addEventListener('afterprint', listo, { once: true });
    const cuadro = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('afterprint', listo);
    };
  }, [documento]);

  return (
    <Contexto.Provider value={{ imprimir }}>
      <div className="print:hidden">{children}</div>
      {documento && (
        <div id="impresion" className="hidden print:block">
          {documento}
        </div>
      )}
    </Contexto.Provider>
  );
}

export function useImpresion() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useImpresion debe usarse dentro de ProveedorImpresion');
  return contexto;
}

function Linea() {
  return <hr className="my-2 border-0 border-t border-dashed border-black" />;
}

function Fila({ izquierda, derecha, fuerte }: { izquierda: ReactNode; derecha: ReactNode; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${fuerte ? 'text-[13pt] font-bold' : ''}`}>
      <span>{izquierda}</span>
      <span className="shrink-0 tabular-nums">{derecha}</span>
    </div>
  );
}

/** Tiquete para el cliente, con precios, total y forma de pago. No es factura electrónica. */
export function TiqueteCliente({ pedido, cobro }: { pedido: Pedido; cobro?: DatosCobro }) {
  const enLinea = pedido.pagos?.[0]?.estado === 'APROBADO';
  const metodo = cobro?.metodo ?? (enLinea ? 'ONLINE' : undefined);
  const vueltas = cobro?.metodo === 'EFECTIVO' && cobro.recibido && cobro.recibido >= pedido.total ? cobro.recibido - pedido.total : undefined;
  return (
    <article className="documento-impresion">
      <header className="text-center">
        <p className="text-[14pt] font-bold uppercase">{NOMBRE_RESTAURANTE}</p>
        {NEGOCIO.nit && <p>NIT {NEGOCIO.nit}</p>}
        {NEGOCIO.direccion && <p>{NEGOCIO.direccion}</p>}
        {NEGOCIO.telefono && <p>{t('Tel.')} {NEGOCIO.telefono}</p>}
      </header>
      <Linea />
      {/* Un pedido que se acaba de cobrar o sigue abierto lleva la hora de ahora; uno cerrado, la de su cierre */}
      <Fila izquierda={<strong>{t('Pedido #{numero}', { numero: pedido.numero })}</strong>} derecha={fechaHora(cobro || pedido.estado === 'ACTIVO' ? new Date() : pedido.actualizadoEn)} />
      <p>{destino(pedido)}</p>
      {pedido.entrega && <p>{t('Dirección')}: {pedido.entrega.direccionTexto}</p>}
      {pedido.cliente?.telefono && pedido.tipo !== 'MESA' && <p>{t('Tel. cliente')}: {pedido.cliente.telefono}</p>}
      {pedido.creadoPor && <p>{t('Atendió')}: {pedido.creadoPor.nombre}</p>}
      <Linea />
      <div className="space-y-1">
        {pedido.detalles.map((d) => (
          <div key={d.id}>
            <Fila izquierda={`${d.cantidad} x ${d.nombreProducto}`} derecha={pesos(d.subtotal)} />
            {d.cantidad > 1 && <p className="pl-3 text-[8pt]">{pesos(d.precioUnitario)} {t('c/u')}</p>}
          </div>
        ))}
      </div>
      <Linea />
      {pedido.costoDomicilio > 0 && (
        <>
          <Fila izquierda={t('Subtotal')} derecha={pesos(pedido.subtotal)} />
          <Fila izquierda={t('Domicilio')} derecha={pesos(pedido.costoDomicilio)} />
        </>
      )}
      <Fila izquierda={t('TOTAL')} derecha={pesos(pedido.total)} fuerte />
      {metodo && (
        <>
          <Linea />
          <Fila izquierda={t('Forma de pago')} derecha={t(NOMBRE_METODO[metodo])} />
          {cobro?.recibido !== undefined && vueltas !== undefined && (
            <>
              <Fila izquierda={t('Recibido')} derecha={pesos(cobro.recibido)} />
              <Fila izquierda={t('Vueltas')} derecha={pesos(vueltas)} />
            </>
          )}
        </>
      )}
      <Linea />
      <footer className="text-center">
        <p className="font-semibold">{NEGOCIO.mensaje || t('¡Gracias por tu compra!')}</p>
        <p className="mt-1 text-[7.5pt]">{t('Este documento no es una factura electrónica de venta.')}</p>
      </footer>
    </article>
  );
}

/** Comanda para la cocina: lo que hay que preparar y para dónde, con letra grande y sin precios. */
export function Comanda({ pedido }: { pedido: Pedido }) {
  return (
    <article className="documento-impresion">
      <header className="text-center">
        <p className="text-[10pt] font-semibold uppercase tracking-widest">{t('Comanda')}</p>
        <p className="text-[22pt] leading-tight font-black">#{pedido.numero}</p>
        <p className="text-[15pt] font-bold">{destino(pedido)}</p>
        <p>
          {fechaHora(pedido.creadoEn)}
          {pedido.creadoPor && ` · ${pedido.creadoPor.nombre}`}
        </p>
      </header>
      <Linea />
      <ul className="space-y-2">
        {pedido.detalles.map((d) => (
          <li key={d.id} className="text-[13pt] leading-snug">
            <span className="font-black">{d.cantidad} x</span> <span className="font-semibold">{d.nombreProducto}</span>
            {d.notas && <p className="ml-6 text-[11pt] font-bold uppercase">» {d.notas}</p>}
          </li>
        ))}
      </ul>
      {pedido.notas && (
        <>
          <Linea />
          <p className="text-[11pt] font-bold">{t('NOTA')}: {pedido.notas}</p>
        </>
      )}
      <Linea />
      <p className="text-center text-[8pt]">
        {t('{n} productos', { n: pedido.detalles.reduce((s, d) => s + d.cantidad, 0) })} · {t(pedido.tipo === 'MESA' ? 'Para la mesa' : pedido.tipo === 'DOMICILIO' ? 'Para domicilio' : 'Para llevar')}
      </p>
    </article>
  );
}
