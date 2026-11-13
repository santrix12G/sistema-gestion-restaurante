import { decidirCambio, PagoInformado, PagoRegistrado, traducirEstado } from './pago';

const pendiente: PagoRegistrado = { estado: 'PENDIENTE', monto: 47000 };
const aviso = (estado: string, cambios: Partial<PagoInformado> = {}): PagoInformado => ({ estado, monto: 47000, moneda: 'COP', ...cambios });

describe('traducirEstado', () => {
  it.each([
    ['approved', 'APROBADO'],
    ['pending', 'PENDIENTE'],
    ['in_process', 'PENDIENTE'],
    ['authorized', 'PENDIENTE'],
    ['rejected', 'RECHAZADO'],
    ['cancelled', 'RECHAZADO'],
    ['refunded', 'REEMBOLSADO'],
    ['charged_back', 'REEMBOLSADO'],
  ])('traduce %s a %s', (estadoPasarela, esperado) => {
    expect(traducirEstado(estadoPasarela)).toBe(esperado);
  });

  it.each(['in_mediation', 'desconocido', ''])('ignora el estado %p', (estadoPasarela) => {
    expect(traducirEstado(estadoPasarela)).toBeUndefined();
  });
});

describe('decidirCambio', () => {
  it('aprueba un pago pendiente cuando el monto y la moneda coinciden', () => {
    expect(decidirCambio(pendiente, aviso('approved'))).toEqual({ cambiar: true, nuevo: 'APROBADO' });
  });

  it('acepta el monto con decimales que a veces envía la pasarela', () => {
    expect(decidirCambio(pendiente, aviso('approved', { monto: 47000.0 }))).toEqual({ cambiar: true, nuevo: 'APROBADO' });
  });

  it('no aprueba si el monto no coincide', () => {
    expect(decidirCambio(pendiente, aviso('approved', { monto: 1000 }))).toMatchObject({ cambiar: false, motivo: expect.stringMatching(/no coincide/) });
  });

  it('no aprueba si la moneda no es pesos colombianos', () => {
    expect(decidirCambio(pendiente, aviso('approved', { moneda: 'USD' }))).toMatchObject({ cambiar: false, motivo: expect.stringMatching(/Moneda/) });
  });

  it('ignora el aviso repetido de un estado que ya tiene', () => {
    expect(decidirCambio({ ...pendiente, estado: 'APROBADO' }, aviso('approved'))).toMatchObject({ cambiar: false });
  });

  it('un rechazo que llega tarde no deshace un pago aprobado', () => {
    expect(decidirCambio({ ...pendiente, estado: 'APROBADO' }, aviso('rejected'))).toMatchObject({ cambiar: false, motivo: expect.stringMatching(/reembolsado/) });
  });

  it('un pago aprobado puede reembolsarse', () => {
    expect(decidirCambio({ ...pendiente, estado: 'APROBADO' }, aviso('refunded'))).toEqual({ cambiar: true, nuevo: 'REEMBOLSADO' });
  });

  it('un pago reembolsado ya no cambia', () => {
    expect(decidirCambio({ ...pendiente, estado: 'REEMBOLSADO' }, aviso('approved'))).toMatchObject({ cambiar: false });
  });

  it('el cliente puede reintentar después de un rechazo', () => {
    expect(decidirCambio({ ...pendiente, estado: 'RECHAZADO' }, aviso('approved'))).toEqual({ cambiar: true, nuevo: 'APROBADO' });
  });

  it('ignora los estados de la pasarela que no cambian nada', () => {
    expect(decidirCambio(pendiente, aviso('in_mediation'))).toMatchObject({ cambiar: false });
  });
});
