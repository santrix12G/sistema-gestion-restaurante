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

/** El día (AAAA-MM-DD) en Colombia en que cae un momento */
export const diaEnColombia = (momento: Date) => hoyEnColombia(momento);

/** Un período no puede pasar de un año: así el reporte responde rápido */
export const MAX_DIAS_PERIODO = 366;

/**
 * El intervalo [desde, hasta) de varios días seguidos en Colombia, con las dos fechas incluidas,
 * la lista de esos días y el período anterior del mismo largo, para comparar.
 */
export function rangoDePeriodo(desdeDia: string, hastaDia: string, ahora = new Date()) {
  const inicio = rangoDelDia(desdeDia, ahora);
  const fin = rangoDelDia(hastaDia, ahora);
  if (inicio.dia > fin.dia) throw new DomainError('validacion', 'La fecha inicial no puede ser posterior a la final');
  const cantidad = Math.round((fin.desde.getTime() - inicio.desde.getTime()) / UN_DIA_MS) + 1;
  if (cantidad > MAX_DIAS_PERIODO) throw new DomainError('validacion', `El período no puede pasar de ${MAX_DIAS_PERIODO} días`);
  const dias = Array.from({ length: cantidad }, (_, i) => new Date(inicio.desde.getTime() + i * UN_DIA_MS + DESFASE_COLOMBIA_MS).toISOString().slice(0, 10));
  return {
    desde: inicio.desde,
    hasta: fin.hasta,
    dias,
    anterior: { desde: new Date(inicio.desde.getTime() - cantidad * UN_DIA_MS), hasta: inicio.desde },
  };
}
