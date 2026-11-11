import { DomainError } from '../../../shared/domain-error';
import { alcanceDe, calcularTotales, EstadoCierre, PedidoParaPermisos, puedeVer, Rol, validarCierre, validarTomaDomicilio } from './pedido';

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

describe('validarCierre', () => {
  const mesa: PedidoParaPermisos = { estado: 'ACTIVO', tipo: 'MESA', creadoPorId: 'mesero-1' };
  const domicilio: PedidoParaPermisos = { estado: 'ACTIVO', tipo: 'DOMICILIO', repartidorId: 'repartidor-1' };
  const recogerChatbot: PedidoParaPermisos = { estado: 'ACTIVO', tipo: 'RECOGER', creadoPorId: null };
  const cierra = (p: PedidoParaPermisos, rol: Rol, usuarioId: string, nuevo: EstadoCierre = 'PAGADO') =>
    error(() => validarCierre(p, nuevo, rol, usuarioId));

  it('el mesero cierra solo los pedidos que registró', () => {
    expect(cierra(mesa, 'MESERO', 'mesero-1')).toBeUndefined();
    expect(cierra(mesa, 'MESERO', 'mesero-1', 'CANCELADO')).toBeUndefined();
    expect(cierra(mesa, 'MESERO', 'mesero-2')?.message).toMatch(/otro mesero/);
  });

  it('el repartidor cierra solo los domicilios que lleva', () => {
    expect(cierra(domicilio, 'REPARTIDOR', 'repartidor-1')).toBeUndefined();
    expect(cierra(domicilio, 'REPARTIDOR', 'repartidor-2')?.message).toMatch(/otro repartidor/);
    expect(cierra({ ...domicilio, repartidorId: null }, 'REPARTIDOR', 'repartidor-1')?.message).toMatch(/Primero toma/);
    expect(cierra(domicilio, 'MESERO', 'mesero-1')?.tipo).toBe('prohibido');
    expect(cierra(mesa, 'REPARTIDOR', 'repartidor-1')?.tipo).toBe('prohibido');
  });

  it('los pedidos del chatbot para recoger los cierra el administrador', () => {
    expect(cierra(recogerChatbot, 'MESERO', 'mesero-1')?.message).toMatch(/administrador/);
    expect(cierra(recogerChatbot, 'ADMIN', 'admin-1')).toBeUndefined();
  });

  it('el administrador cierra cualquier pedido', () => {
    expect(cierra(mesa, 'ADMIN', 'admin-1', 'CANCELADO')).toBeUndefined();
    expect(cierra({ ...domicilio, repartidorId: null }, 'ADMIN', 'admin-1')).toBeUndefined();
  });

  it('un pedido cerrado no cambia más', () => {
    expect(cierra({ ...mesa, estado: 'PAGADO' }, 'ADMIN', 'admin-1', 'CANCELADO')?.message).toMatch(/ya está pagado/);
    expect(cierra({ ...mesa, estado: 'CANCELADO' }, 'MESERO', 'mesero-1')?.tipo).toBe('conflicto');
  });
});

describe('validarTomaDomicilio', () => {
  const libre: PedidoParaPermisos = { estado: 'ACTIVO', tipo: 'DOMICILIO', repartidorId: null };
  const toma = (p: PedidoParaPermisos, rol: Rol = 'REPARTIDOR', id = 'repartidor-1') => error(() => validarTomaDomicilio(p, rol, id));

  it('un repartidor toma un domicilio libre', () => {
    expect(toma(libre)).toBeUndefined();
  });

  it('no se toma un domicilio que ya lleva alguien, ni uno cerrado', () => {
    expect(toma({ ...libre, repartidorId: 'repartidor-2' })?.message).toMatch(/Otro repartidor/);
    expect(toma({ ...libre, estado: 'CANCELADO' })?.tipo).toBe('conflicto');
  });

  it('solo los repartidores toman domicilios, y solo domicilios', () => {
    expect(toma(libre, 'MESERO')?.tipo).toBe('prohibido');
    expect(toma(libre, 'ADMIN')?.tipo).toBe('prohibido');
    expect(toma({ ...libre, tipo: 'MESA' })?.tipo).toBe('conflicto');
  });
});

describe('qué pedidos ve cada rol', () => {
  const mesa = (creadoPorId: string | null, estado: PedidoParaPermisos['estado'] = 'ACTIVO'): PedidoParaPermisos => ({ tipo: 'MESA', estado, creadoPorId });
  const domicilio = (repartidorId: string | null, estado: PedidoParaPermisos['estado'] = 'ACTIVO'): PedidoParaPermisos => ({ tipo: 'DOMICILIO', estado, repartidorId });

  it('el administrador ve todos', () => {
    expect(alcanceDe('ADMIN', 'a', ['ACTIVO'])).toEqual({ tipo: 'todos' });
    expect(puedeVer(mesa('m1'), 'ADMIN', 'a')).toBe(true);
    expect(puedeVer(domicilio(null, 'PAGADO'), 'ADMIN', 'a')).toBe(true);
  });

  it('el mesero solo ve los que registró, activos o cerrados', () => {
    expect(puedeVer(mesa('m1'), 'MESERO', 'm1')).toBe(true);
    expect(puedeVer(mesa('m1', 'PAGADO'), 'MESERO', 'm1')).toBe(true);
    expect(puedeVer(mesa('m2'), 'MESERO', 'm1')).toBe(false);
    expect(puedeVer(mesa(null), 'MESERO', 'm1')).toBe(false);
  });

  it('el repartidor ve los domicilios libres y los suyos; en el historial, solo los que llevó', () => {
    expect(puedeVer(domicilio(null), 'REPARTIDOR', 'r1')).toBe(true);
    expect(puedeVer(domicilio('r1'), 'REPARTIDOR', 'r1')).toBe(true);
    expect(puedeVer(domicilio('r2'), 'REPARTIDOR', 'r1')).toBe(false);
    expect(puedeVer(domicilio('r1', 'PAGADO'), 'REPARTIDOR', 'r1')).toBe(true);
    expect(puedeVer(domicilio(null, 'CANCELADO'), 'REPARTIDOR', 'r1')).toBe(false);
    expect(puedeVer(mesa('r1'), 'REPARTIDOR', 'r1')).toBe(false);
    expect(alcanceDe('REPARTIDOR', 'r1', ['PAGADO', 'CANCELADO'])).toEqual({ tipo: 'domicilios_de', repartidorId: 'r1', incluirLibres: false });
  });
});
