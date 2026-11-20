import { DomainError } from '../../../shared/domain-error';
import { calcularArqueo, validarMonto, validarSalida } from './caja';

describe('arqueo de caja', () => {
  it('una caja recién abierta solo tiene la base', () => {
    const r = calcularArqueo({ base: 100000, pagos: [], movimientos: [] });
    expect(r).toMatchObject({ base: 100000, vendido: 0, pagos: 0, entradas: 0, salidas: 0, efectivoEsperado: 100000, efectivoContado: null, diferencia: null });
    expect(r.porMetodo.map((m) => m.metodo)).toEqual(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'ONLINE']);
  });

  it('el efectivo esperado suma solo lo cobrado en efectivo y los movimientos', () => {
    const r = calcularArqueo(
      {
        base: 100000,
        pagos: [
          { metodo: 'EFECTIVO', monto: 30000 },
          { metodo: 'EFECTIVO', monto: 20000 },
          { metodo: 'TARJETA', monto: 50000 },
          { metodo: 'TRANSFERENCIA', monto: 15000 },
          { metodo: 'ONLINE', monto: 40000 },
        ],
        movimientos: [
          { tipo: 'ENTRADA', monto: 50000 },
          { tipo: 'SALIDA', monto: 12000 },
        ],
      },
      205000,
    );
    expect(r.vendido).toBe(155000);
    expect(r.porMetodo).toEqual([
      { metodo: 'EFECTIVO', pagos: 2, total: 50000 },
      { metodo: 'TARJETA', pagos: 1, total: 50000 },
      { metodo: 'TRANSFERENCIA', pagos: 1, total: 15000 },
      { metodo: 'ONLINE', pagos: 1, total: 40000 },
    ]);
    // 100.000 + 50.000 + 50.000 − 12.000
    expect(r.efectivoEsperado).toBe(188000);
    expect(r.diferencia).toBe(17000);
    expect(calcularArqueo({ base: 0, pagos: [{ metodo: 'EFECTIVO', monto: 10000 }], movimientos: [] }, 8000).diferencia).toBe(-2000);
  });

  it('valida los montos y que una salida no deje la caja en negativo', () => {
    expect(() => validarMonto(0, 'La base', { permitirCero: true })).not.toThrow();
    expect(() => validarMonto(0, 'El monto')).toThrow(DomainError);
    expect(() => validarMonto(-5, 'El monto')).toThrow('mayor que cero');
    expect(() => validarMonto(10.5, 'El monto')).toThrow(DomainError);
    expect(() => validarMonto(60_000_000, 'El monto')).toThrow('demasiado alto');
    expect(() => validarSalida(50000, 50000)).not.toThrow();
    expect(() => validarSalida(50001, 50000)).toThrow('solo debería haber');
  });
});
