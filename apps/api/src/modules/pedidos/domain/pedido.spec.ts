import { DomainError } from '../../../shared/domain-error';
import { calcularTotales, EstadoPedido, Rol, TipoPedido, validarCambioEstado } from './pedido';

const linea = (precioUnitario: number, cantidad: number) => ({ productoId: 'p', nombre: 'Limonada', precioUnitario, cantidad });

function error(fn: () => void): DomainError | undefined {
  try {
    fn();
  } catch (e) {
    return e as DomainError;
  }
}

describe('calcularTotales', () => {
  it('suma las líneas y el domicilio', () => {
    const r = calcularTotales([linea(18000, 2), linea(6000, 1)], 5000);
    expect(r.lineas.map((l) => l.subtotal)).toEqual([36000, 6000]);
    expect(r).toMatchObject({ subtotal: 42000, costoDomicilio: 5000, total: 47000 });
  });

  it('rechaza un pedido vacío', () => {
    expect(error(() => calcularTotales([]))?.tipo).toBe('validacion');
  });

  it.each([0, -1, 1.5, 51])('rechaza la cantidad %p', (cantidad) => {
    expect(error(() => calcularTotales([linea(1000, cantidad)]))?.message).toMatch(/entre 1 y 50/);
  });
});

describe('validarCambioEstado', () => {
  const pedido = (estado: EstadoPedido, tipo: TipoPedido = 'MESA') => ({ estado, tipo });
  const permite = (estado: EstadoPedido, nuevo: EstadoPedido, rol: Rol, tipo: TipoPedido = 'MESA') =>
    error(() => validarCambioEstado(pedido(estado, tipo), nuevo, rol)) === undefined;

  it('sigue el flujo de un pedido en mesa', () => {
    expect(permite('CONFIRMADO', 'EN_PREPARACION', 'COCINA')).toBe(true);
    expect(permite('EN_PREPARACION', 'LISTO', 'COCINA')).toBe(true);
    expect(permite('LISTO', 'ENTREGADO', 'MESERO')).toBe(true);
  });

  it('sigue el flujo de un domicilio', () => {
    expect(permite('LISTO', 'EN_CAMINO', 'REPARTIDOR', 'DOMICILIO')).toBe(true);
    expect(permite('EN_CAMINO', 'ENTREGADO', 'REPARTIDOR', 'DOMICILIO')).toBe(true);
  });

  it('no permite saltarse estados ni volver atrás', () => {
    expect(error(() => validarCambioEstado(pedido('CONFIRMADO'), 'LISTO', 'ADMIN'))?.tipo).toBe('conflicto');
    expect(error(() => validarCambioEstado(pedido('LISTO'), 'EN_PREPARACION', 'ADMIN'))?.tipo).toBe('conflicto');
    expect(error(() => validarCambioEstado(pedido('ENTREGADO'), 'CANCELADO', 'ADMIN'))?.tipo).toBe('conflicto');
  });

  it('no permite cancelar lo que ya se está cocinando', () => {
    expect(error(() => validarCambioEstado(pedido('EN_PREPARACION'), 'CANCELADO', 'ADMIN'))?.message).toMatch(/ya no se puede cancelar/);
  });

  it('separa el camino de mesa y el de domicilio', () => {
    expect(permite('LISTO', 'EN_CAMINO', 'ADMIN', 'MESA')).toBe(false);
    expect(permite('LISTO', 'ENTREGADO', 'ADMIN', 'DOMICILIO')).toBe(false);
  });

  it('solo el repartidor que sacó el domicilio puede entregarlo', () => {
    const enCamino = { estado: 'EN_CAMINO' as const, tipo: 'DOMICILIO' as const, repartidorId: 'repartidor-1' };
    expect(error(() => validarCambioEstado(enCamino, 'ENTREGADO', 'REPARTIDOR', 'repartidor-1'))).toBeUndefined();
    expect(error(() => validarCambioEstado(enCamino, 'ENTREGADO', 'REPARTIDOR', 'repartidor-2'))?.message).toMatch(/otro repartidor/);
    expect(error(() => validarCambioEstado(enCamino, 'ENTREGADO', 'ADMIN', 'admin-1'))).toBeUndefined();
  });

  it('aplica los permisos por rol', () => {
    expect(error(() => validarCambioEstado(pedido('CONFIRMADO'), 'EN_PREPARACION', 'MESERO'))?.tipo).toBe('prohibido');
    expect(permite('CONFIRMADO', 'CANCELADO', 'COCINA')).toBe(false);
    expect(permite('LISTO', 'ENTREGADO', 'REPARTIDOR', 'MESA')).toBe(false);
    expect(permite('EN_CAMINO', 'ENTREGADO', 'MESERO', 'DOMICILIO')).toBe(false);
  });
});
