import { horaEnColombia } from '../../../shared/fecha';
import { EstadoCierre, TipoPedido } from './pedido';

export type CanalPedido = 'WHATSAPP' | 'TELEGRAM' | 'WEB' | 'MOVIL';

/** Un pedido cerrado en el día, con lo que se vendió */
export interface PedidoCerrado {
  estado: EstadoCierre;
  tipo: TipoPedido;
  canal: CanalPedido;
  /** Cuándo llegó el pedido: de aquí salen las horas pico */
  creadoEn: Date;
  total: number;
  detalles: { productoId: string; nombreProducto: string; cantidad: number; subtotal: number }[];
}

export const TIPOS_PEDIDO: TipoPedido[] = ['MESA', 'DOMICILIO', 'RECOGER'];
// Primero los del chatbot, que es por donde piden los clientes
export const CANALES: CanalPedido[] = ['WHATSAPP', 'TELEGRAM', 'WEB', 'MOVIL'];
export const MAX_MAS_VENDIDOS = 5;

/**
 * Resumen del día: lo vendido (pedidos pagados), los cancelados, los productos más vendidos,
 * las ventas por canal y las horas pico. Los cancelados no cuentan como venta ni suman a nada más.
 * Las horas pico se miden por la hora en que llegó cada pedido pagado, en hora de Colombia.
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

  const porHora = Array.from({ length: 24 }, (_, hora) => {
    const deLaHora = pagados.filter((p) => horaEnColombia(p.creadoEn) === hora);
    return { hora, pedidos: deLaHora.length, total: sumar(deLaHora) };
  });

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
    porCanal: CANALES.map((canal) => {
      const delCanal = pagados.filter((p) => p.canal === canal);
      return { canal, pedidos: delCanal.length, total: sumar(delCanal) };
    }),
    porHora,
    // La hora con más pedidos; si empatan, la que más vendió y luego la más temprana
    horaPico: porHora.reduce<(typeof porHora)[number] | null>(
      (pico, h) => (h.pedidos > 0 && (!pico || h.pedidos > pico.pedidos || (h.pedidos === pico.pedidos && h.total > pico.total)) ? h : pico),
      null,
    )?.hora ?? null,
    // Más unidades primero; si empatan, el que más dinero dejó y luego por nombre
    masVendidos: [...productos.values()]
      .sort((a, b) => b.cantidad - a.cantidad || b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'))
      .slice(0, MAX_MAS_VENDIDOS),
  };
}
