import { PedidoCerrado, resumirDia } from './estadisticas';

const linea = (productoId: string, cantidad: number, precio: number) => ({ productoId, nombreProducto: productoId, cantidad, subtotal: cantidad * precio });
const pedido = (estado: PedidoCerrado['estado'], tipo: PedidoCerrado['tipo'], detalles: PedidoCerrado['detalles'], extra = 0): PedidoCerrado => ({
  estado,
  tipo,
  detalles,
  total: detalles.reduce((s, d) => s + d.subtotal, 0) + extra,
});

describe('estadísticas del día', () => {
  it('sin pedidos todo queda en cero', () => {
    const r = resumirDia([]);
    expect(r.ventas).toEqual({ total: 0, pedidos: 0, promedio: 0, platos: 0 });
    expect(r.cancelados).toEqual({ pedidos: 0, total: 0 });
    expect(r.porTipo.every((t) => t.pedidos === 0 && t.total === 0)).toBe(true);
    expect(r.masVendidos).toEqual([]);
  });

  it('suma lo pagado con el domicilio, separa lo cancelado y reparte por tipo', () => {
    const r = resumirDia([
      pedido('PAGADO', 'MESA', [linea('Bandeja', 2, 20000)]),
      pedido('PAGADO', 'DOMICILIO', [linea('Bandeja', 1, 20000), linea('Jugo', 1, 5000)], 4000),
      pedido('CANCELADO', 'MESA', [linea('Jugo', 3, 5000)]),
    ]);
    expect(r.ventas).toEqual({ total: 69000, pedidos: 2, promedio: 34500, platos: 4 });
    expect(r.cancelados).toEqual({ pedidos: 1, total: 15000 });
    expect(r.porTipo).toEqual([
      { tipo: 'MESA', pedidos: 1, total: 40000 },
      { tipo: 'DOMICILIO', pedidos: 1, total: 29000 },
      { tipo: 'RECOGER', pedidos: 0, total: 0 },
    ]);
  });

  it('los más vendidos cuentan solo lo pagado, por unidades y luego por dinero', () => {
    const r = resumirDia([
      pedido('PAGADO', 'MESA', [linea('Jugo', 2, 5000), linea('Bandeja', 2, 20000), linea('Arepa', 1, 3000)]),
      pedido('PAGADO', 'RECOGER', [linea('Arepa', 1, 3000)]),
      pedido('CANCELADO', 'MESA', [linea('Arepa', 10, 3000)]),
    ]);
    expect(r.masVendidos.map((p) => [p.nombre, p.cantidad, p.total])).toEqual([
      ['Bandeja', 2, 40000],
      ['Jugo', 2, 10000],
      ['Arepa', 2, 6000],
    ]);
  });

  it('muestra como mucho cinco productos y redondea el promedio', () => {
    const lineas = ['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) => linea(n, 6 - i, 1000));
    const r = resumirDia([pedido('PAGADO', 'MESA', lineas), pedido('PAGADO', 'MESA', [linea('A', 1, 1001)])]);
    expect(r.masVendidos.map((p) => p.nombre)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(r.ventas.promedio).toBe(Math.round((21000 + 1001) / 2));
  });
});
