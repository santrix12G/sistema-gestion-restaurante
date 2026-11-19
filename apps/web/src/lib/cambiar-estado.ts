'use client';

import { useState } from 'react';
import { llamar, mensajeDeError } from './api';

/** Cierra un pedido o toma un domicilio, y avisa si la API lo rechaza. `alTerminar` recarga la lista. Cada acción resuelve true si se hizo. */
export function useCambiarEstado(alTerminar: () => Promise<void>) {
  const [ocupado, setOcupado] = useState<string>();
  const [error, setError] = useState<string>();

  async function ejecutar(id: string, accion: () => Promise<unknown>): Promise<boolean> {
    setOcupado(id);
    setError(undefined);
    try {
      await accion();
      return true;
    } catch (e) {
      setError(mensajeDeError(e));
      return false;
    } finally {
      await alTerminar();
      setOcupado(undefined);
    }
  }

  const cambiar = (id: string, estado: 'PAGADO' | 'CANCELADO') =>
    ejecutar(id, () => llamar(`/pedidos/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado } }));
  const tomar = (id: string) => ejecutar(id, () => llamar(`/pedidos/${id}/tomar`, { metodo: 'POST' }));

  return { cambiar, tomar, ocupado, error };
}
