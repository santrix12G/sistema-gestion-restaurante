import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

const VARIANTES = {
  primario: 'bg-marca-600 text-white hover:bg-marca-700 disabled:bg-stone-300',
  secundario: 'bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 disabled:text-stone-400',
  exito: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-stone-300',
  peligro: 'bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:text-stone-400',
};

export function Boton({ variante = 'primario', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: keyof typeof VARIANTES }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTES[variante]} ${className}`}
      {...props}
    />
  );
}

export function Campo({ etiqueta, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-stone-700">{etiqueta}</span>
      <input
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
        {...props}
      />
    </label>
  );
}

export function Aviso({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">{children}</p>;
}

export function Titulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {accion}
    </div>
  );
}

export function Cargando() {
  return <p className="py-10 text-center text-sm text-stone-500">Cargando…</p>;
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">{children}</p>;
}
