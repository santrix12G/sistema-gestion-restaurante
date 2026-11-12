import { DomainError } from './domain-error';
import { hoyEnColombia, inicioDelDia, rangoDelDia } from './fecha';

describe('fechas en hora de Colombia', () => {
  // 11 de noviembre a las 2:00 a. m. en UTC: en Colombia aún son las 9:00 p. m. del 10
  const ahora = new Date('2026-11-11T02:00:00.000Z');

  it('el día de hoy es el de Colombia, no el del servidor', () => {
    expect(hoyEnColombia(ahora)).toBe('2026-11-10');
    expect(inicioDelDia(ahora).toISOString()).toBe('2026-11-10T05:00:00.000Z');
  });

  it('sin fecha da el día de hoy, de medianoche a medianoche', () => {
    const r = rangoDelDia(undefined, ahora);
    expect(r).toMatchObject({ dia: '2026-11-10', esHoy: true });
    expect(r.desde.toISOString()).toBe('2026-11-10T05:00:00.000Z');
    expect(r.hasta.toISOString()).toBe('2026-11-11T05:00:00.000Z');
  });

  it('acepta días pasados', () => {
    const r = rangoDelDia('2026-02-28', ahora);
    expect(r.esHoy).toBe(false);
    expect(r.desde.toISOString()).toBe('2026-02-28T05:00:00.000Z');
  });

  it('rechaza fechas mal escritas, inexistentes o futuras', () => {
    for (const fecha of ['ayer', '2026-2-1', '2026-02-30', '2026-11-11']) {
      expect(() => rangoDelDia(fecha, ahora)).toThrow(DomainError);
    }
  });
});
