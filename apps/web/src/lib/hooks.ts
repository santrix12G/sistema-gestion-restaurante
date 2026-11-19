'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mensajeDeError } from './api';

/**
 * Carga datos de la API y, si se indica, los recarga cada cierto tiempo.
 * Así el tablero de pedidos se mantiene al día sin recargar la página.
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

/** La hora actual, que se actualiza sola cada cierto tiempo: así los "hace 5 min" avanzan sin recargar */
export function useAhora(cadaMs = 30_000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), cadaMs);
    return () => clearInterval(intervalo);
  }, [cadaMs]);
  return ahora;
}
