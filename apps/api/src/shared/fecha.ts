/** Colombia está en UTC-5 todo el año (no cambia de horario). El servidor en Render corre en UTC. */
const DESFASE_COLOMBIA_MS = -5 * 60 * 60 * 1000;

/** Momento en que empezó el día de hoy en Colombia. */
export function inicioDelDia(ahora = new Date()): Date {
  const local = new Date(ahora.getTime() + DESFASE_COLOMBIA_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - DESFASE_COLOMBIA_MS);
}
