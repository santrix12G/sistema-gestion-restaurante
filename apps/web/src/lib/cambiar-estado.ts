'use client';

import { useState } from 'react';
import { llamar, mensajeDeError } from './api';
import { EstadoPedido } from './tipos';

/** Cambia el estado de un pedido y avisa si la API lo rechaza. `alTerminar` recarga la lista. */
export function useCambiarEstado(alTerminar: () => Promise<void>) {
  const [ocupado, setOcupado] = useState<string>();
  const [error, setError] = useState<string>();

  async function cambiar(id: string, estado: EstadoPedido) {
    setOcupado(id);
    setError(undefined);
    try {
      await llamar(`/pedidos/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado } });
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      await alTerminar();
      setOcupado(undefined);
    }
  }

  return { cambiar, ocupado, error };
}
