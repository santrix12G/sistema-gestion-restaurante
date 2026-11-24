'use client';

import { Contrast, Languages } from 'lucide-react';
import { IDIOMAS, Idioma, t } from '@/lib/i18n';
import { ESCALAS_LETRA, usePreferencias } from '@/lib/preferencias';

/**
 * Herramientas de accesibilidad: tamaño de letra, contraste alto e idioma.
 * Están en el inicio de sesión, en las páginas públicas y en el menú del panel.
 */
export function BarraAccesibilidad({ className = '', oscura = false }: { className?: string; oscura?: boolean }) {
  const { letra, contraste, idioma, cambiar } = usePreferencias();
  const boton = `grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-bold ring-1 transition-colors disabled:opacity-40 ${
    oscura ? 'text-white ring-white/30 hover:bg-white/10' : 'bg-white text-stone-700 ring-stone-300 hover:bg-stone-100'
  }`;
  return (
    <div role="group" aria-label={t('Accesibilidad')} className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <button
        type="button"
        className={boton}
        onClick={() => cambiar({ letra: letra - 1 })}
        disabled={letra === 0}
        aria-label={t('Reducir el tamaño de la letra')}
        title={t('Reducir el tamaño de la letra')}
      >
        <span aria-hidden>A−</span>
      </button>
      <span className={`min-w-11 text-center text-xs font-semibold tabular-nums ${oscura ? 'text-white/90' : 'text-stone-600'}`} aria-live="polite">
        <span className="sr-only">{t('Tamaño de la letra')}: </span>
        {ESCALAS_LETRA[letra]} %
      </span>
      <button
        type="button"
        className={boton}
        onClick={() => cambiar({ letra: letra + 1 })}
        disabled={letra === ESCALAS_LETRA.length - 1}
        aria-label={t('Aumentar el tamaño de la letra')}
        title={t('Aumentar el tamaño de la letra')}
      >
        <span aria-hidden className="text-base">
          A+
        </span>
      </button>
      <button
        type="button"
        className={`${boton} ${contraste ? (oscura ? 'bg-white !text-stone-900' : '!bg-stone-900 !text-white') : ''}`}
        onClick={() => cambiar({ contraste: !contraste })}
        aria-pressed={contraste}
        title={t('Contraste alto')}
      >
        <Contrast className="size-4" aria-hidden />
        <span className="sr-only">{t('Contraste alto')}</span>
      </button>
      <label className={`flex h-9 items-center gap-1 rounded-lg pl-2 ring-1 ${oscura ? 'text-white ring-white/30' : 'bg-white text-stone-700 ring-stone-300'}`}>
        <Languages className="size-4 shrink-0" aria-hidden />
        <span className="sr-only">{t('Idioma')}</span>
        <select
          value={idioma}
          onChange={(e) => cambiar({ idioma: e.target.value as Idioma })}
          className={`h-full rounded-lg bg-transparent pr-1 text-sm font-semibold outline-none ${oscura ? '[&>option]:text-stone-900' : ''}`}
        >
          {IDIOMAS.map((i) => (
            <option key={i.codigo} value={i.codigo} lang={i.codigo}>
              {i.nombre}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
