import { createHash, randomBytes } from 'node:crypto';

/** Sin «mantener la sesión iniciada», la sesión dura un turno. Con ella, un mes. */
export const DURACION_SESION = { turno: '12h', recordada: '30d' } as const;

/** Un enlace para restablecer la contraseña vale 30 minutos y una sola vez */
export const MINUTOS_ENLACE_RECUPERACION = 30;

/** Token aleatorio de 256 bits para el enlace, en base64url (cabe en una URL sin escapar) */
export const generarTokenRecuperacion = () => randomBytes(32).toString('base64url');

/** En la base de datos solo se guarda el hash: quien la lea no puede usar los enlaces */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Cambiar la contraseña cierra las sesiones abiertas: un token emitido antes de `sesionesDesde` ya no vale.
 * `emitidoEn` viene del JWT, en segundos; `sesionesDesde` se compara truncada a segundos para no rechazar
 * la sesión que se inicia en el mismo segundo del cambio.
 */
export function sesionVigente(emitidoEn: number | undefined, sesionesDesde: Date | null) {
  if (!sesionesDesde) return true;
  if (emitidoEn === undefined) return false;
  return emitidoEn >= Math.floor(sesionesDesde.getTime() / 1000);
}

/** Para el registro de auditoría: j***@correo.com */
export function ocultarEmail(email: string) {
  const [usuario, dominio] = email.split('@');
  if (!dominio) return '***';
  return `${usuario.slice(0, 1)}***@${dominio}`;
}
