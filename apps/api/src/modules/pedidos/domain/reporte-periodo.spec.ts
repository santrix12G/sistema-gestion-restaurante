import { rangoDePeriodo } from '../../../shared/fecha';
import { PedidoDelPeriodo, resumirPeriodo } from './reporte-periodo';

const ana = { id: 'u-ana', nombre: 'Ana' };
const beto = { id: 'u-beto', nombre: 'Beto' };
const rita = { id: 'u-rita', nombre: 'Rita' };

/** Un pedido que llegó a `llego` (hora de Colombia) y se cerró `minutos` después */
function pedido(datos: Partial<PedidoDelPeriodo> & { llego: string; minutos: number; total: number }): PedidoDelPeriodo {
  const creadoEn = new Date(`${datos.llego}-05:00`);
  return {
    estado: 'PAGADO',
    tipo: 'MESA',
    canal: 'WEB',
    creadoPor: ana,
    entrega: null,
    detalles: [{ productoId: 'p-bandeja', nombreProducto: 'Bandeja', cantidad: 1, subtotal: datos.total }],
    ...datos,
    creadoEn,
    cerradoEn: new Date(creadoEn.getTime() + datos.minutos * 60_000),
  };
}

const DIAS = ['2026-11-09', '2026-11-10', '2026-11-11']; // lunes a miércoles
const CATALOGO = [
  { id: 'p-bandeja', nombre: 'Bandeja' },
  { id: 'p-jugo', nombre: 'Jugo' },
  { id: 'p-arepa', nombre: 'Arepa' },
];

describe('reporte de un período', () => {
  const pedidos = [
    pedido({ llego: '2026-11-09T12:00', minutos: 20, total: 30000 }),
    pedido({ llego: '2026-11-09T13:00', minutos: 45, total: 20000, creadoPor: beto }),
    pedido({
      llego: '2026-11-11T19:00',
      minutos: 40,
      total: 50000,
      tipo: 'DOMICILIO',
      canal: 'WHATSAPP',
      creadoPor: null,
      entrega: { repartidor: rita, asignadaEn: new Date('2026-11-11T19:10-05:00'), entregadaEn: new Date('2026-11-11T19:35-05:00') },
    }),
    // Llegó el 10 a las 11:50 p. m. y se cobró el 11: cuenta el 11
    pedido({ llego: '2026-11-10T23:50', minutos: 15, total: 10000 }),
    pedido({ llego: '2026-11-10T12:00', minutos: 5, total: 99000, estado: 'CANCELADO' }),
  ];
  const r = resumirPeriodo(pedidos, DIAS, CATALOGO, { total: 100000, pedidos: 5 });

  it('suma las ventas de cada día por el día en que se cobró', () => {
    expect(r.ventas.total).toBe(110000);
    expect(r.porDia).toEqual([
      { fecha: '2026-11-09', pedidos: 2, total: 50000 },
      { fecha: '2026-11-10', pedidos: 0, total: 0 },
      { fecha: '2026-11-11', pedidos: 2, total: 60000 },
    ]);
    expect(r.mejorDia).toEqual({ fecha: '2026-11-11', pedidos: 2, total: 60000 });
  });

  it('compara con el período anterior', () => {
    expect(r.comparacion).toEqual({ anterior: { total: 100000, pedidos: 5 }, variacionVentas: 10, variacionPedidos: -20 });
    expect(resumirPeriodo([], DIAS, [], { total: 0, pedidos: 0 }).comparacion.variacionVentas).toBeNull();
  });

  it('reparte por día de la semana, empezando el lunes', () => {
    expect(r.porDiaSemana.map((d) => d.diaSemana)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(r.porDiaSemana[0]).toEqual({ diaSemana: 1, dias: 1, pedidos: 2, total: 50000, promedio: 50000 });
    expect(r.porDiaSemana[3]).toEqual({ diaSemana: 4, dias: 0, pedidos: 0, total: 0, promedio: 0 });
  });

  it('lista todos los productos, con los que no se vendieron al final', () => {
    expect(r.productos.map((p) => [p.nombre, p.cantidad, p.porcentaje])).toEqual([
      ['Bandeja', 4, 100],
      ['Arepa', 0, 0],
      ['Jugo', 0, 0],
    ]);
  });

  it('cuenta lo de cada mesero, lo del chatbot y los domicilios de cada repartidor', () => {
    expect(r.personal.meseros).toEqual([
      { id: 'u-ana', nombre: 'Ana', pedidos: 2, total: 40000, promedio: 20000 },
      { id: 'u-beto', nombre: 'Beto', pedidos: 1, total: 20000, promedio: 20000 },
    ]);
    expect(r.personal.chatbot).toEqual({ pedidos: 1, total: 50000 });
    expect(r.personal.repartidores).toEqual([{ id: 'u-rita', nombre: 'Rita', entregas: 1, total: 50000, minutosEnCamino: 25 }]);
  });

  it('mide cuánto tarda un pedido desde que llega hasta que se cobra', () => {
    expect(r.tiempos.general).toEqual({ pedidos: 4, minutosPromedio: 30, demorados: 2, porcentajeDemorados: 50 });
    expect(r.tiempos.porTipo.find((t) => t.tipo === 'DOMICILIO')).toEqual({ tipo: 'DOMICILIO', pedidos: 1, minutosPromedio: 40, demorados: 1, porcentajeDemorados: 100 });
    expect(r.tiempos.porTipo.find((t) => t.tipo === 'RECOGER')?.minutosPromedio).toBeNull();
  });
});

describe('rango de un período', () => {
  const ahora = new Date('2026-11-18T15:00:00.000Z');

  it('incluye las dos fechas y calcula el período anterior del mismo largo', () => {
    const r = rangoDePeriodo('2026-11-09', '2026-11-15', ahora);
    expect(r.dias).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
    expect(r.desde.toISOString()).toBe('2026-11-09T05:00:00.000Z');
    expect(r.hasta.toISOString()).toBe('2026-11-16T05:00:00.000Z');
    expect(r.anterior).toEqual({ desde: new Date('2026-11-02T05:00:00.000Z'), hasta: new Date('2026-11-09T05:00:00.000Z') });
  });

  it('rechaza fechas al revés, futuras, mal escritas o un período de más de un año', () => {
    expect(() => rangoDePeriodo('2026-11-10', '2026-11-09', ahora)).toThrow('posterior');
    expect(() => rangoDePeriodo('2026-11-10', '2026-11-20', ahora)).toThrow('futura');
    expect(() => rangoDePeriodo('', '2026-11-10', ahora)).toThrow('formato');
    expect(() => rangoDePeriodo('2025-01-01', '2026-11-10', ahora)).toThrow('366');
  });
});
