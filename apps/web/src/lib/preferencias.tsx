'use client';

import { createContext, Fragment, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { fijarIdioma, Idioma } from './i18n';

/**
 * Preferencias de accesibilidad de cada persona: idioma, contraste alto y tamaño de letra.
 * Se guardan en el navegador. El contraste y la letra se aplican antes de dibujar la página
 * (ver SCRIPT_PREFERENCIAS en el layout), para que no parpadee.
 */
export interface Preferencias {
  idioma: Idioma;
  contraste: boolean;
  /** Índice en ESCALAS_LETRA */
  letra: number;
}

export const CLAVE_PREFERENCIAS = 'restaurante.preferencias';
/** Tamaños de letra, en porcentaje del tamaño del navegador. Todo el diseño usa rem, así que crece completo */
export const ESCALAS_LETRA = [100, 115, 130, 150];
const INICIALES: Preferencias = { idioma: 'es', contraste: false, letra: 0 };

/** Aplica el contraste, la letra y el idioma a la etiqueta <html> */
export function aplicarPreferencias({ idioma, contraste, letra }: Preferencias) {
  const html = document.documentElement;
  html.lang = idioma;
  if (contraste) html.dataset.contraste = 'alto';
  else delete html.dataset.contraste;
  html.style.fontSize = `${ESCALAS_LETRA[letra] ?? 100}%`;
}

/** Corre en <head> antes de dibujar: misma lógica que aplicarPreferencias, sin React */
export const SCRIPT_PREFERENCIAS = `try{var p=JSON.parse(localStorage.getItem('${CLAVE_PREFERENCIAS}')||'{}');var h=document.documentElement;if(p.idioma==='en')h.lang='en';if(p.contraste)h.dataset.contraste='alto';var e=${JSON.stringify(ESCALAS_LETRA)}[p.letra];if(e)h.style.fontSize=e+'%';}catch(_){}`;

function leer(): Preferencias {
  try {
    const guardadas = JSON.parse(localStorage.getItem(CLAVE_PREFERENCIAS) ?? '{}') as Partial<Preferencias>;
    return {
      idioma: guardadas.idioma === 'en' ? 'en' : 'es',
      contraste: guardadas.contraste === true,
      letra: Number.isInteger(guardadas.letra) && guardadas.letra! >= 0 && guardadas.letra! < ESCALAS_LETRA.length ? guardadas.letra! : 0,
    };
  } catch {
    return INICIALES;
  }
}

interface ContextoPreferencias extends Preferencias {
  cambiar: (cambios: Partial<Preferencias>) => void;
}
const Contexto = createContext<ContextoPreferencias | null>(null);

export function ProveedorPreferencias({ children }: { children: ReactNode }) {
  // El servidor siempre dibuja en español; el idioma guardado se aplica al montar
  const [preferencias, setPreferencias] = useState<Preferencias>(INICIALES);
  fijarIdioma(preferencias.idioma);

  useEffect(() => {
    const guardadas = leer();
    fijarIdioma(guardadas.idioma);
    setPreferencias(guardadas);
    aplicarPreferencias(guardadas);
  }, []);

  const cambiar = useCallback((cambios: Partial<Preferencias>) => {
    setPreferencias((antes) => {
      const nuevas = { ...antes, ...cambios };
      fijarIdioma(nuevas.idioma);
      aplicarPreferencias(nuevas);
      try {
        localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(nuevas));
      } catch {
        // Sin almacenamiento: la preferencia dura hasta cerrar la pestaña
      }
      return nuevas;
    });
  }, []);

  return (
    <Contexto.Provider value={{ ...preferencias, cambiar }}>
      {/* Cambiar de idioma vuelve a dibujar toda la página con los textos nuevos */}
      <Fragment key={preferencias.idioma}>{children}</Fragment>
    </Contexto.Provider>
  );
}

export function usePreferencias() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('usePreferencias debe usarse dentro de ProveedorPreferencias');
  return contexto;
}
