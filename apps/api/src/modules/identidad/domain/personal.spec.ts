import { DomainError } from '../../../shared/domain-error';
import { normalizarEmail, validarBorrado, validarContrasena, validarSinPendientes } from './personal';

describe('cuentas del personal', () => {
  it('exige contraseñas de 8 caracteres con letras y números', () => {
    expect(() => validarContrasena('Mesero-2026')).not.toThrow();
    expect(() => validarContrasena('abc12')).toThrow(/al menos 8/);
    expect(() => validarContrasena('solo-letras')).toThrow(/letras y números/);
    expect(() => validarContrasena('12345678')).toThrow(/letras y números/);
    expect(() => validarContrasena('a1'.repeat(40))).toThrow(/demasiado larga/);
  });

  it('guarda los correos en minúsculas y sin espacios', () => {
    expect(normalizarEmail('  Ana@Restaurante.TEST ')).toBe('ana@restaurante.test');
  });

  it('no deja suspender a quien tiene pedidos abiertos ni borrar a quien tiene historial', () => {
    expect(() => validarSinPendientes('Ana', 0)).not.toThrow();
    expect(() => validarSinPendientes('Ana', 2)).toThrow(/Ana tiene 2 pedidos activos/);
    expect(() => validarBorrado('Ana', 0)).not.toThrow();
    expect(() => validarBorrado('Ana', 1)).toThrow(DomainError);
  });
});
