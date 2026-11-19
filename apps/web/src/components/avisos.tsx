'use client';

import { CircleAlert, CircleCheck, TriangleAlert, X } from 'lucide-react';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Boton } from './ui';

type TipoAviso = 'exito' | 'error';
interface AvisoFlotante {
  id: number;
  tipo: TipoAviso;
  texto: string;
}

interface Confirmacion {
  titulo: string;
  detalle?: string;
  /** Texto del botón que acepta, por ejemplo "Cobrar" o "Cancelar pedido" */
  aceptar: string;
  peligro?: boolean;
}

interface ContextoAvisos {
  /** Muestra un aviso breve abajo a la derecha que se cierra solo */
  avisar: (texto: string, tipo?: TipoAviso) => void;
  /** Pregunta antes de una acción importante. Resuelve true si la persona acepta. Reemplaza al confirm() del navegador */
  confirmar: (pregunta: Confirmacion) => Promise<boolean>;
}

const Contexto = createContext<ContextoAvisos | null>(null);
const DURACION_MS = 4000;

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<AvisoFlotante[]>([]);
  const [pregunta, setPregunta] = useState<(Confirmacion & { responder: (si: boolean) => void }) | null>(null);
  const siguienteId = useRef(0);

  const cerrar = useCallback((id: number) => setAvisos((lista) => lista.filter((a) => a.id !== id)), []);

  const avisar = useCallback(
    (texto: string, tipo: TipoAviso = 'exito') => {
      const id = ++siguienteId.current;
      setAvisos((lista) => [...lista.slice(-2), { id, tipo, texto }]);
      setTimeout(() => cerrar(id), DURACION_MS);
    },
    [cerrar],
  );

  const confirmar = useCallback(
    (datos: Confirmacion) => new Promise<boolean>((resolver) => setPregunta({ ...datos, responder: resolver })),
    [],
  );

  function responder(si: boolean) {
    pregunta?.responder(si);
    setPregunta(null);
  }

  return (
    <Contexto.Provider value={{ avisar, confirmar }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto">
        {avisos.map((a) => (
          <div
            key={a.id}
            role={a.tipo === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ring-1 ${
              a.tipo === 'exito' ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-red-50 text-red-900 ring-red-200'
            }`}
          >
            {a.tipo === 'exito' ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
            <span className="flex-1">{a.texto}</span>
            <button onClick={() => cerrar(a.id)} className="opacity-60 hover:opacity-100" aria-label="Cerrar aviso">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
      {pregunta && <Dialogo pregunta={pregunta} responder={responder} />}
    </Contexto.Provider>
  );
}

function Dialogo({ pregunta, responder }: { pregunta: Confirmacion; responder: (si: boolean) => void }) {
  const volver = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // El foco empieza en "Volver": un Enter sin querer no ejecuta la acción
    volver.current?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && responder(false);
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [responder]);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-stone-900/40 p-4" onClick={() => responder(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titulo-confirmacion"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3">
          {pregunta.peligro && (
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
              <TriangleAlert className="size-5" aria-hidden />
            </span>
          )}
          <div>
            <h2 id="titulo-confirmacion" className="text-base font-semibold">{pregunta.titulo}</h2>
            {pregunta.detalle && <p className="mt-1 text-sm text-stone-600">{pregunta.detalle}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Boton ref={volver} variante="secundario" onClick={() => responder(false)}>Volver</Boton>
          <Boton variante={pregunta.peligro ? 'peligroLleno' : 'primario'} onClick={() => responder(true)}>{pregunta.aceptar}</Boton>
        </div>
      </div>
    </div>
  );
}

export function useAvisos() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useAvisos debe usarse dentro de ProveedorAvisos');
  return contexto;
}
