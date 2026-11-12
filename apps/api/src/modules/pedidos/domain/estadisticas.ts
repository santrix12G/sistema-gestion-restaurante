import { EstadoCierre, TipoPedido } from './pedido';

/** Un pedido cerrado en el día, con lo que se vendió */
export interface PedidoCerrado {
  estado: EstadoCierre;
  tipo: TipoPedido;
  total: number;
  detalles: { productoId: string; nombreProducto: string; cantidad: number; subtotal: number }[];
}

export const TIPOS_PEDIDO: TipoPedido[] = ['MESA', 'DOMICILIO', 'RECOGER'];
export const MAX_MAS_VENDIDOS = 5;

/**
 * Resumen del día: lo vendido (pedidos pagados), los cancelados y los productos más vendidos.
 * Los cancelados no cuentan como venta ni suman a los más vendidos.
 */
export function resumirDia(pedidos: PedidoCerrado[]) {
  const pagados = pedidos.filter((p) => p.estado === 'PAGADO');
  const cancelados = pedidos.filter((p) => p.estado === 'CANCELADO');
  const sumar = (lista: PedidoCerrado[]) => lista.reduce((suma, p) => suma + p.total, 0);
  const vendido = sumar(pagados);

  const productos = new Map<string, { productoId: string; nombre: string; cantidad: number; total: number }>();
  for (const { productoId, nombreProducto, cantidad, subtotal } of pagados.flatMap((p) => p.detalles)) {
    const actual = productos.get(productoId) ?? { productoId, nombre: nombreProducto, cantidad: 0, total: 0 };
    productos.set(productoId, { ...actual, cantidad: actual.cantidad + cantidad, total: actual.total + subtotal });
  }

  return {
    ventas: {
      total: vendido,
      pedidos: pagados.length,
      // Valor promedio de cada pedido pagado, redondeado al peso
      promedio: pagados.length ? Math.round(vendido / pagados.length) : 0,
      platos: pagados.flatMap((p) => p.detalles).reduce((suma, d) => suma + d.cantidad, 0),
    },
    cancelados: { pedidos: cancelados.length, total: sumar(cancelados) },
    porTipo: TIPOS_PEDIDO.map((tipo) => {
      const delTipo = pagados.filter((p) => p.tipo === tipo);
      return { tipo, pedidos: delTipo.length, total: sumar(delTipo) };
    }),
    // Más unidades primero; si empatan, el que más dinero dejó y luego por nombre
    masVendidos: [...productos.values()]
      .sort((a, b) => b.cantidad - a.cantidad || b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'))
      .slice(0, MAX_MAS_VENDIDOS),
  };
}
