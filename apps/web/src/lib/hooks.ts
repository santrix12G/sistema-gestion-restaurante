'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mensajeDeError } from './api';

/**
 * Carga datos de la API y, si se indica, los recarga cada cierto tiempo.
 * Así la cocina y el tablero de pedidos se mantienen al día sin recargar la página.
 */
export function useDatos<T>(cargar: () => Promise<T>, cadaMs?: number) {
  const [datos, setDatos] = useState<T>();
  const [error, setError] = useState<string>();
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  const recargar = useCallback(async () => {
    try {
      setDatos(await cargarRef.current());
      setError(undefined);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }, []);

  useEffect(() => {
    void recargar();
    if (!cadaMs) return;
    const intervalo = setInterval(() => {
      // No consulta mientras la pestaña está oculta
      if (document.visibilityState === 'visible') void recargar();
    }, cadaMs);
    return () => clearInterval(intervalo);
  }, [recargar, cadaMs]);

  return { datos, error, recargar };
}
