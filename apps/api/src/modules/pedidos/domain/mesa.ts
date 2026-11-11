import { DomainError } from '../../../shared/domain-error';

export type TipoMesa = 'NORMAL' | 'LARGA' | 'AFUERA';

export const TIPOS_MESA: TipoMesa[] = ['NORMAL', 'LARGA', 'AFUERA'];

/** Abreviatura que usa el personal: la mesa larga 1 es la L1 */
export const PREFIJO_MESA: Record<TipoMesa, string> = { NORMAL: 'M', LARGA: 'L', AFUERA: 'AF' };

export const MAX_NUMERO_MESA = 999;
export const MAX_CAPACIDAD_MESA = 50;

export function codigoMesa(mesa: { tipo: TipoMesa; numero: number }) {
  return `${PREFIJO_MESA[mesa.tipo]}${mesa.numero}`;
}

/** El siguiente número libre del tipo: si existen L1 y L3, la siguiente es la L4 */
export function siguienteNumero(numerosDelTipo: number[]) {
  return numerosDelTipo.length === 0 ? 1 : Math.max(...numerosDelTipo) + 1;
}

/** Una mesa con pedidos abiertos no se puede suspender ni borrar: los pedidos quedarían sin dónde atenderse. */
export function validarRetiro(mesa: { tipo: TipoMesa; numero: number }, pedidosActivos: number) {
  if (pedidosActivos > 0) {
    throw new DomainError('conflicto', `La mesa ${codigoMesa(mesa)} tiene ${pedidosActivos === 1 ? 'un pedido activo' : `${pedidosActivos} pedidos activos`}. Ciérralos primero`);
  }
}
