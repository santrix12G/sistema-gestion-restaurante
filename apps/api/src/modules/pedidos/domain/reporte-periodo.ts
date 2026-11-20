import { diaEnColombia } from '../../../shared/fecha';
import { PedidoCerrado, TIPOS_PEDIDO, resumirDia } from './estadisticas';

/** Más de esto, un pedido se demoró. Es el mismo límite que pinta en rojo la tarjeta del pedido en la web. */
export const MINUTOS_DEMORA = 30;

interface Persona {
  id: string;
  nombre: string;
}

/** Un pedido cerrado en el período, con quién lo atendió y cuándo se cerró */
export interface PedidoDelPeriodo extends PedidoCerrado {
  /** Cuándo se cobró o se canceló: decide el día en que cuenta */
  cerradoEn: Date;
  /** Mesero que lo registró. Vacío si llegó por el chatbot */
  creadoPor: Persona | null;
  entrega: { repartidor: Persona | null; asignadaEn: Date | null; entregadaEn: Date | null } | null;
}

/** Lo que se vendió en el período anterior, para comparar */
export interface VentasAnteriores {
  total: number;
  pedidos: number;
}

const minutosEntre = (desde: Date, hasta: Date) => Math.max(0, (hasta.getTime() - desde.getTime()) / 60_000);
const promedio = (valores: number[]) => (valores.length ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length) : null);
/** Cuánto cambió una cifra frente a la anterior, en porcentaje entero. Sin cifra anterior no hay con qué comparar. */
const variacion = (actual: number, anterior: number) => (anterior > 0 ? Math.round(((actual - anterior) / anterior) * 100) : null);

/**
 * Reporte de varios días: lo mismo que el resumen del día, más las ventas de cada día y de cada día de la semana,
 * todos los productos (también los que no se vendieron), el desempeño del personal y los tiempos de servicio.
 * `dias` son las fechas AAAA-MM-DD del período, en orden. `catalogo` son los productos que hoy existen.
 */
export function resumirPeriodo(pedidos: PedidoDelPeriodo[], dias: string[], catalogo: Persona[], anterior: VentasAnteriores) {
  const base = resumirDia(pedidos);
  const pagados = pedidos.filter((p) => p.estado === 'PAGADO');
  const sumar = (lista: PedidoDelPeriodo[]) => lista.reduce((s, p) => s + p.total, 0);

  const porDia = dias.map((fecha) => {
    const delDia = pagados.filter((p) => diaEnColombia(p.cerradoEn) === fecha);
    return { fecha, pedidos: delDia.length, total: sumar(delDia) };
  });

  // 0 es domingo. Se promedia entre los días de ese tipo que tiene el período, aunque alguno no haya vendido.
  const porDiaSemana = [1, 2, 3, 4, 5, 6, 0].map((diaSemana) => {
    const deEseDia = porDia.filter((d) => new Date(`${d.fecha}T12:00:00.000Z`).getUTCDay() === diaSemana);
    const total = deEseDia.reduce((s, d) => s + d.total, 0);
    return {
      diaSemana,
      dias: deEseDia.length,
      pedidos: deEseDia.reduce((s, d) => s + d.pedidos, 0),
      total,
      promedio: deEseDia.length ? Math.round(total / deEseDia.length) : 0,
    };
  });

  // Todos los productos, del que más dinero dejó al que menos, y al final los del menú que no se vendieron
  const vendidos = new Map<string, { productoId: string; nombre: string; cantidad: number; total: number }>();
  for (const { productoId, nombreProducto, cantidad, subtotal } of pagados.flatMap((p) => p.detalles)) {
    const actual = vendidos.get(productoId) ?? { productoId, nombre: nombreProducto, cantidad: 0, total: 0 };
    vendidos.set(productoId, { ...actual, cantidad: actual.cantidad + cantidad, total: actual.total + subtotal });
  }
  const vendidoProductos = [...vendidos.values()].reduce((s, p) => s + p.total, 0);
  const productos = [
    ...[...vendidos.values()].sort((a, b) => b.total - a.total || b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es')),
    ...catalogo
      .filter((p) => !vendidos.has(p.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((p) => ({ productoId: p.id, nombre: p.nombre, cantidad: 0, total: 0 })),
  ].map((p) => ({ ...p, porcentaje: vendidoProductos ? Math.round((p.total / vendidoProductos) * 1000) / 10 : 0 }));

  const meseros = agrupar(pagados.filter((p) => p.creadoPor), (p) => p.creadoPor!).map(({ persona, pedidos: suyos }) => ({
    ...persona,
    pedidos: suyos.length,
    total: sumar(suyos),
    promedio: Math.round(sumar(suyos) / suyos.length),
  }));
  const delChatbot = pagados.filter((p) => !p.creadoPor);

  const repartidores = agrupar(
    pagados.filter((p) => p.entrega?.repartidor),
    (p) => p.entrega!.repartidor!,
  ).map(({ persona, pedidos: suyos }) => ({
    ...persona,
    entregas: suyos.length,
    total: sumar(suyos),
    // Desde que tomó el domicilio hasta que lo entregó y cobró
    minutosEnCamino: promedio(
      suyos.filter((p) => p.entrega!.asignadaEn && p.entrega!.entregadaEn).map((p) => minutosEntre(p.entrega!.asignadaEn!, p.entrega!.entregadaEn!)),
    ),
  }));

  // Desde que llega el pedido hasta que se cobra
  const tiempoDe = (lista: PedidoDelPeriodo[]) => {
    const minutos = lista.map((p) => minutosEntre(p.creadoEn, p.cerradoEn));
    const demorados = minutos.filter((m) => m > MINUTOS_DEMORA).length;
    return {
      pedidos: lista.length,
      minutosPromedio: promedio(minutos),
      demorados,
      porcentajeDemorados: lista.length ? Math.round((demorados / lista.length) * 100) : 0,
    };
  };

  return {
    ...base,
    comparacion: {
      anterior,
      variacionVentas: variacion(base.ventas.total, anterior.total),
      variacionPedidos: variacion(base.ventas.pedidos, anterior.pedidos),
    },
    porDia,
    porDiaSemana,
    // El día que más vendió; si empatan, el primero
    mejorDia: porDia.reduce<(typeof porDia)[number] | null>((mejor, d) => (d.total > 0 && (!mejor || d.total > mejor.total) ? d : mejor), null),
    productos,
    personal: {
      meseros: meseros.sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es')),
      chatbot: { pedidos: delChatbot.length, total: sumar(delChatbot) },
      repartidores: repartidores.sort((a, b) => b.entregas - a.entregas || a.nombre.localeCompare(b.nombre, 'es')),
    },
    tiempos: {
      limiteMinutos: MINUTOS_DEMORA,
      general: tiempoDe(pagados),
      porTipo: TIPOS_PEDIDO.map((tipo) => ({ tipo, ...tiempoDe(pagados.filter((p) => p.tipo === tipo)) })),
    },
  };
}

/** Junta los pedidos de cada persona, en el orden en que aparece cada una */
function agrupar(pedidos: PedidoDelPeriodo[], de: (p: PedidoDelPeriodo) => Persona) {
  const grupos = new Map<string, { persona: Persona; pedidos: PedidoDelPeriodo[] }>();
  for (const p of pedidos) {
    const persona = de(p);
    const grupo = grupos.get(persona.id) ?? { persona: { id: persona.id, nombre: persona.nombre }, pedidos: [] };
    grupo.pedidos.push(p);
    grupos.set(persona.id, grupo);
  }
  return [...grupos.values()];
}
