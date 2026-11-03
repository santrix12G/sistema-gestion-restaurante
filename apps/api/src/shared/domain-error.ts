export type TipoError = 'validacion' | 'no_encontrado' | 'conflicto' | 'prohibido';

/** Regla de negocio incumplida. La capa HTTP la traduce al código de respuesta según su tipo. */
export class DomainError extends Error {
  constructor(
    readonly tipo: TipoError,
    message: string,
  ) {
    super(message);
  }
}
