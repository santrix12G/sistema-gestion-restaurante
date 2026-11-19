import { Injectable } from '@nestjs/common';
import { rangoDePeriodo, rangoDelDia } from '../../../shared/fecha';
import { PrismaService } from '../../../shared/prisma.service';
import { PedidoCerrado, resumirDia } from '../domain/estadisticas';
import { PedidoDelPeriodo, resumirPeriodo } from '../domain/reporte-periodo';

/** Cifras del día para el administrador */
@Injectable()
export class EstadisticasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Un pedido cuenta el día en que se cobró o se canceló, igual que en la lista de cerrados.
   * Para hoy también dice cuántos pedidos siguen abiertos y cuánto suman.
   */
  async delDia(fecha?: string) {
    const { dia, desde, hasta, esHoy } = rangoDelDia(fecha);
    const [cerrados, activos] = await Promise.all([
      this.prisma.pedido.findMany({
        where: { estado: { in: ['PAGADO', 'CANCELADO'] }, actualizadoEn: { gte: desde, lt: hasta } },
        select: { estado: true, tipo: true, canal: true, creadoEn: true, total: true, detalles: { select: { productoId: true, nombreProducto: true, cantidad: true, subtotal: true } } },
      }),
      esHoy ? this.prisma.pedido.aggregate({ where: { estado: 'ACTIVO' }, _count: true, _sum: { total: true } }) : null,
    ]);
    return {
      fecha: dia,
      ...resumirDia(cerrados as PedidoCerrado[]),
      activos: activos && { pedidos: activos._count, total: activos._sum.total ?? 0 },
    };
  }

  /**
   * Reporte de varios días, con las dos fechas incluidas. Igual que el del día, un pedido cuenta el día en que se cobró o se canceló.
   * Se compara con el período anterior del mismo largo.
   */
  async delPeriodo(desdeDia: string, hastaDia: string) {
    const { desde, hasta, dias, anterior } = rangoDePeriodo(desdeDia, hastaDia);
    const persona = { select: { id: true, nombre: true } };
    const [cerrados, ventasAnteriores, catalogo] = await Promise.all([
      this.prisma.pedido.findMany({
        where: { estado: { in: ['PAGADO', 'CANCELADO'] }, actualizadoEn: { gte: desde, lt: hasta } },
        select: {
          estado: true,
          tipo: true,
          canal: true,
          creadoEn: true,
          actualizadoEn: true,
          total: true,
          creadoPor: persona,
          entrega: { select: { asignadaEn: true, entregadaEn: true, repartidor: persona } },
          detalles: { select: { productoId: true, nombreProducto: true, cantidad: true, subtotal: true } },
        },
      }),
      this.prisma.pedido.aggregate({
        where: { estado: 'PAGADO', actualizadoEn: { gte: anterior.desde, lt: anterior.hasta } },
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.producto.findMany({ select: { id: true, nombre: true } }),
    ]);
    const pedidos: PedidoDelPeriodo[] = cerrados.map(({ actualizadoEn, ...p }) => ({ ...p, cerradoEn: actualizadoEn }) as PedidoDelPeriodo);
    return {
      desde: dias[0],
      hasta: dias[dias.length - 1],
      ...resumirPeriodo(pedidos, dias, catalogo, { total: ventasAnteriores._sum.total ?? 0, pedidos: ventasAnteriores._count }),
    };
  }
}
