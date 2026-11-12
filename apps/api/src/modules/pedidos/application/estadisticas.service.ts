import { Injectable } from '@nestjs/common';
import { rangoDelDia } from '../../../shared/fecha';
import { PrismaService } from '../../../shared/prisma.service';
import { PedidoCerrado, resumirDia } from '../domain/estadisticas';

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
}
