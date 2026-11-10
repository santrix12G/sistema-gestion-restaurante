'use client';

import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { leerSesionGuardada, URL_API } from './api';

/**
 * Llama a `alAvisar` en cuanto entra un pedido o cambia de estado, sin esperar a la siguiente consulta.
 * Si el socket se cae, la página sigue al día con su consulta periódica.
 */
export function useTiempoReal(alAvisar: () => void) {
  const alAvisarRef = useRef(alAvisar);
  alAvisarRef.current = alAvisar;

  useEffect(() => {
    const token = leerSesionGuardada<{ token: string }>()?.token;
    if (!token) return;
    // El socket vive en el mismo servidor que la API, pero fuera de /api
    const socket = io(new URL(URL_API).origin, { auth: { token }, transports: ['websocket'] });
    socket.on('pedido', () => alAvisarRef.current());
    // Al reconectar pudo haberse perdido algún aviso
    socket.io.on('reconnect', () => alAvisarRef.current());
    socket.on('sesion_invalida', () => socket.close());
    return () => {
      socket.close();
    };
  }, []);
}
