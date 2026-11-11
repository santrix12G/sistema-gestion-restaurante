import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma.service';
import { EstadoCierre, EstadoPedido } from '../domain/pedido';
import { NuevoPedido, PedidoRepository, PedidoVista } from '../application/pedido.repository';

const VISTA = {
  id: true,
  numero: true,
  tipo: true,
  canal: true,
  estado: true,
  subtotal: true,
  costoDomicilio: true,
  total: true,
  notas: true,
  creadoEn: true,
  actualizadoEn: true,
  mesa: { select: { numero: true } },
  creadoPor: { select: { id: true, nombre: true } },
  cliente: { select: { nombre: true, telefono: true } },
  entrega: {
    select: {
      direccionTexto: true,
      estado: true,
      direccion: { select: { barrio: true, referencia: true } },
      repartidor: { select: { id: true, nombre: true } },
    },
  },
  detalles: { select: { id: true, nombreProducto: true, precioUnitario: true, cantidad: true, subtotal: true, notas: true } },
} satisfies Prisma.PedidoSelect;

@Injectable()
export class PrismaPedidoRepository implements PedidoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear({ lineas, creadoPorId, entrega, ...pedido }: NuevoPedido): Promise<PedidoVista> {
    try {
      return await this.prisma.pedido.create({
        data: {
          ...pedido,
          creadoPorId,
          entrega: entrega ? { create: entrega } : undefined,
          detalles: {
            create: lineas.map((l) => ({
              productoId: l.productoId,
              nombreProducto: l.nombre,
              precioUnitario: l.precioUnitario,
              cantidad: l.cantidad,
              subtotal: l.subtotal,
              notas: l.notas,
            })),
          },
          historial: { create: { estadoNuevo: 'ACTIVO', usuarioId: creadoPorId } },
        },
        select: VISTA,
      });
    } catch (e) {
      // Dos envíos simultáneos con la misma clave: el segundo devuelve el pedido del primero
      if (pedido.claveIdempotencia && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existente = await this.buscarPorClave(pedido.claveIdempotencia);
        if (existente) return existente;
      }
      throw e;
    }
  }

  buscarPorClave(clave: string) {
    return this.prisma.pedido.findUnique({ where: { claveIdempotencia: clave }, select: VISTA });
  }

  obtener(id: string) {
    return this.prisma.pedido.findUnique({ where: { id }, select: VISTA });
  }

  listar({ estados, desde }: { estados: EstadoPedido[]; desde?: Date }) {
    return this.prisma.pedido.findMany({
      where: { estado: { in: estados }, ...(desde && { creadoEn: { gte: desde } }) },
      orderBy: { creadoEn: desde ? 'desc' : 'asc' },
      select: VISTA,
      take: 300,
    });
  }

  async cerrar(id: string, hasta: EstadoCierre, usuarioId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.pedido.updateMany({ where: { id, estado: 'ACTIVO' }, data: { estado: hasta } });
      if (count === 0) return false;
      await tx.historialEstadoPedido.create({ data: { pedidoId: id, estadoAntes: 'ACTIVO', estadoNuevo: hasta, usuarioId } });
      // La entrega de un domicilio sigue al pedido: pagado es entregado; cancelado en camino es una entrega fallida
      if (hasta === 'PAGADO') await tx.entrega.updateMany({ where: { pedidoId: id }, data: { estado: 'ENTREGADA', entregadaEn: new Date() } });
      else await tx.entrega.updateMany({ where: { pedidoId: id, repartidorId: { not: null } }, data: { estado: 'FALLIDA' } });
      return true;
    });
  }

  async tomarDomicilio(id: string, repartidorId: string): Promise<boolean> {
    const { count } = await this.prisma.entrega.updateMany({
      where: { pedidoId: id, repartidorId: null, pedido: { estado: 'ACTIVO' } },
      data: { repartidorId, estado: 'EN_CAMINO', asignadaEn: new Date() },
    });
    return count > 0;
  }
}
