import { DomainError } from '../../../shared/domain-error';
import { codigoMesa, siguienteNumero, validarRetiro } from './mesa';

describe('mesas', () => {
  it('arma el código con la abreviatura del tipo', () => {
    expect(codigoMesa({ tipo: 'NORMAL', numero: 3 })).toBe('M3');
    expect(codigoMesa({ tipo: 'LARGA', numero: 1 })).toBe('L1');
    expect(codigoMesa({ tipo: 'AFUERA', numero: 12 })).toBe('AF12');
  });

  it('propone el número siguiente al mayor del tipo', () => {
    expect(siguienteNumero([])).toBe(1);
    expect(siguienteNumero([1, 3])).toBe(4);
  });

  it('no deja retirar una mesa con pedidos activos', () => {
    expect(() => validarRetiro({ tipo: 'LARGA', numero: 2 }, 0)).not.toThrow();
    expect(() => validarRetiro({ tipo: 'LARGA', numero: 2 }, 1)).toThrow(DomainError);
    expect(() => validarRetiro({ tipo: 'LARGA', numero: 2 }, 2)).toThrow(/L2 tiene 2 pedidos activos/);
  });
});
