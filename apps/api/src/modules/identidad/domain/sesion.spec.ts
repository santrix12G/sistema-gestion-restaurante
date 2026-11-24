import { generarTokenRecuperacion, hashToken, ocultarEmail, sesionVigente } from './sesion';

describe('sesión y recuperación de contraseña', () => {
  it('un token sin fecha de corte siempre vale', () => {
    expect(sesionVigente(100, null)).toBe(true);
  });

  it('un token emitido antes de cambiar la contraseña ya no vale', () => {
    const corte = new Date('2026-11-23T15:00:10.600Z');
    const segundos = Math.floor(corte.getTime() / 1000);
    expect(sesionVigente(segundos - 1, corte)).toBe(false);
    expect(sesionVigente(segundos, corte)).toBe(true);
    expect(sesionVigente(segundos + 60, corte)).toBe(true);
    expect(sesionVigente(undefined, corte)).toBe(false);
  });

  it('genera tokens distintos y largos, y guarda solo su hash', () => {
    const a = generarTokenRecuperacion();
    const b = generarTokenRecuperacion();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[\w-]{43}$/);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).toBe(hashToken(a));
  });

  it('oculta el correo en el registro', () => {
    expect(ocultarEmail('juan@restaurante.co')).toBe('j***@restaurante.co');
    expect(ocultarEmail('raro')).toBe('***');
  });
});
