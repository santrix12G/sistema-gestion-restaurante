'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { idiomaActual } from '@/lib/i18n';

/** Clave pública del sitio en Cloudflare Turnstile. Sin ella no se muestra captcha (la API tampoco lo pide) */
export const CLAVE_CAPTCHA = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface Turnstile {
  render: (contenedor: HTMLElement, opciones: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let cargando: Promise<void> | undefined;
function cargarScript() {
  cargando ??= new Promise((resolver, rechazar) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolver();
    script.onerror = () => {
      cargando = undefined;
      rechazar(new Error('No se pudo cargar el captcha'));
    };
    document.head.appendChild(script);
  });
  return cargando;
}

export interface ControlCaptcha {
  /** Cada respuesta sirve una vez: después de un intento fallido se pide otra */
  reiniciar: () => void;
}

/**
 * Captcha de Cloudflare Turnstile. Casi siempre se resuelve solo, sin imágenes ni textos que leer,
 * por eso es accesible (lo pide el Anexo 3 de la Resolución 1519 de 2020). Avisa la respuesta con `alResolver`.
 */
export const Captcha = forwardRef<ControlCaptcha, { alResolver: (respuesta: string | undefined) => void }>(function Captcha({ alResolver }, ref) {
  const contenedor = useRef<HTMLDivElement>(null);
  const id = useRef<string>(undefined);
  const alResolverRef = useRef(alResolver);
  alResolverRef.current = alResolver;

  useImperativeHandle(ref, () => ({
    reiniciar: () => {
      alResolverRef.current(undefined);
      if (id.current) window.turnstile?.reset(id.current);
    },
  }));

  useEffect(() => {
    if (!CLAVE_CAPTCHA) return;
    let vivo = true;
    cargarScript()
      .then(() => {
        if (!vivo || !contenedor.current || !window.turnstile) return;
        id.current = window.turnstile.render(contenedor.current, {
          sitekey: CLAVE_CAPTCHA,
          language: idiomaActual(),
          size: 'flexible',
          callback: (respuesta: string) => alResolverRef.current(respuesta),
          'expired-callback': () => alResolverRef.current(undefined),
          'error-callback': () => alResolverRef.current(undefined),
        });
      })
      .catch(() => alResolverRef.current(undefined));
    return () => {
      vivo = false;
      if (id.current) window.turnstile?.remove(id.current);
      id.current = undefined;
    };
  }, []);

  if (!CLAVE_CAPTCHA) return null;
  return <div ref={contenedor} className="min-h-[65px]" />;
});
