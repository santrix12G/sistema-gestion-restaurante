import { DomainError } from './domain-error';

/** Colombia está en UTC-5 todo el año (no cambia de horario). El servidor en Render corre en UTC. */
const DESFASE_COLOMBIA_MS = -5 * 60 * 60 * 1000;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** Momento en que empezó el día de hoy en Colombia. */
export function inicioDelDia(ahora = new Date()): Date {
  const local = new Date(ahora.getTime() + DESFASE_COLOMBIA_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - DESFASE_COLOMBIA_MS);
}

/** La hora (0 a 23) de un momento, en Colombia */
export const horaEnColombia = (momento: Date) => new Date(momento.getTime() + DESFASE_COLOMBIA_MS).getUTCHours();

/** La fecha de hoy en Colombia, como AAAA-MM-DD */
export const hoyEnColombia = (ahora = new Date()) => new Date(ahora.getTime() + DESFASE_COLOMBIA_MS).toISOString().slice(0, 10);

/**
 * El intervalo [desde, hasta) de un día en Colombia. Sin fecha, el de hoy.
 * No acepta días que aún no llegan.
 */
export function rangoDelDia(fecha?: string, ahora = new Date()) {
  const dia = fecha ?? hoyEnColombia(ahora);
  const desde = new Date(`${dia}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || Number.isNaN(desde.getTime()) || desde.toISOString().slice(0, 10) !== dia) {
    throw new DomainError('validacion', 'La fecha debe tener el formato AAAA-MM-DD');
  }
  if (dia > hoyEnColombia(ahora)) throw new DomainError('validacion', 'La fecha no puede ser futura');
  const inicio = new Date(desde.getTime() - DESFASE_COLOMBIA_MS);
  return { dia, desde: inicio, hasta: new Date(inicio.getTime() + UN_DIA_MS), esHoy: dia === hoyEnColombia(ahora) };
}
