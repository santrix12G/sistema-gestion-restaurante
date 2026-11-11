import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import { llamar, mensajeDeError, URL_API } from './api';
import { useSesion } from './sesion';
import { EstadoPedido, Pedido } from './tipos';

// Respaldo por si el socket se cae: la lista se vuelve a pedir cada cierto tiempo
const CONSULTA_PERIODICA_MS = 20_000;

/**
 * Pedidos en los estados dados, siempre al día: se actualizan al entrar a la pantalla,
 * al volver a la app, con cada aviso en tiempo real y cada 20 segundos.
 */
export function usePedidos(estados: EstadoPedido[]) {
  const { sesion } = useSesion();
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recargando, setRecargando] = useState(false);
  const filtro = estados.join(',');

  const cargar = useCallback(async () => {
    try {
      setPedidos(await llamar<Pedido[]>(`/pedidos?estados=${filtro}`));
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }, [filtro]);

  const recargar = useCallback(async () => {
    setRecargando(true);
    await cargar();
    setRecargando(false);
  }, [cargar]);

  // Al entrar a la pantalla y mientras siga visible
  useFocusEffect(
    useCallback(() => {
      void cargar();
      const intervalo = setInterval(() => void cargar(), CONSULTA_PERIODICA_MS);
      const alCambiarApp = AppState.addEventListener('change', (estado) => {
        if (estado === 'active') void cargar();
      });
      return () => {
        clearInterval(intervalo);
        alCambiarApp.remove();
      };
    }, [cargar]),
  );

  // Avisos al instante cuando entra un pedido, sale a reparto o se cierra
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;
  const token = sesion?.token;
  useEffect(() => {
    if (!token) return;
    // El socket vive en el mismo servidor que la API, pero fuera de /api
    const socket = io(URL_API.replace(/\/api$/, ''), { auth: { token }, transports: ['websocket'] });
    socket.on('pedido', () => void cargarRef.current());
    // Al reconectar pudo haberse perdido algún aviso
    socket.io.on('reconnect', () => void cargarRef.current());
    socket.on('sesion_invalida', () => socket.close());
    return () => {
      socket.close();
    };
  }, [token]);

  return { pedidos, error, recargando, recargar, cargar };
}

async function intentar(accion: () => Promise<unknown>): Promise<string | null> {
  try {
    await accion();
    return null;
  } catch (e) {
    return mensajeDeError(e);
  }
}

/** Marca el pedido como pagado o cancelado. Devuelve el mensaje de error, o null si salió bien. */
export function cerrarPedido(pedido: Pedido, estado: 'PAGADO' | 'CANCELADO') {
  return intentar(() => llamar(`/pedidos/${pedido.id}/estado`, { metodo: 'PATCH', cuerpo: { estado } }));
}

/** El repartidor toma el domicilio: queda a su nombre. Devuelve el mensaje de error, o null si salió bien. */
export function tomarDomicilio(pedido: Pedido) {
  return intentar(() => llamar(`/pedidos/${pedido.id}/tomar`, { metodo: 'POST' }));
}
