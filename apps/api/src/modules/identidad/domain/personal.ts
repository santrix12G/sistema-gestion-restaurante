import { DomainError } from '../../../shared/domain-error';

/** Las cuentas que el administrador gestiona. Los administradores no se crean ni se borran desde la aplicación. */
export type RolPersonal = 'MESERO' | 'REPARTIDOR';
export const ROLES_PERSONAL: RolPersonal[] = ['MESERO', 'REPARTIDOR'];

export const MIN_CONTRASENA = 8;
// bcrypt solo usa los primeros 72 bytes
export const MAX_CONTRASENA = 72;

export const normalizarEmail = (email: string) => email.trim().toLowerCase();

/** Al menos 8 caracteres, con letras y números */
export function validarContrasena(contrasena: string) {
  if (contrasena.length < MIN_CONTRASENA) throw new DomainError('validacion', `La contraseña debe tener al menos ${MIN_CONTRASENA} caracteres`);
  if (Buffer.byteLength(contrasena) > MAX_CONTRASENA) throw new DomainError('validacion', 'La contraseña es demasiado larga');
  if (!/[a-zA-Z]/.test(contrasena) || !/\d/.test(contrasena)) throw new DomainError('validacion', 'La contraseña debe tener letras y números');
}

/**
 * Quien tiene pedidos abiertos (el mesero los que registró, el repartidor los domicilios que lleva)
 * no se puede suspender, borrar ni cambiar de rol: esos pedidos quedarían sin responsable.
 */
export function validarSinPendientes(nombre: string, pendientes: number) {
  if (pendientes > 0) {
    throw new DomainError('conflicto', `${nombre} tiene ${pendientes === 1 ? 'un pedido activo' : `${pendientes} pedidos activos`} a su cargo. Ciérralos primero`);
  }
}

/** Una cuenta que ya registró, entregó o movió algo no se borra: el historial la sigue nombrando. */
export function validarBorrado(nombre: string, registros: number) {
  if (registros > 0) throw new DomainError('conflicto', `${nombre} ya tiene pedidos o movimientos registrados. Suspende su cuenta en lugar de borrarla`);
}
