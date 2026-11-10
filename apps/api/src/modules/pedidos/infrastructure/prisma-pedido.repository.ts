import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma.service';
import { EstadoPedido } from '../domain/pedido';
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
  cliente: { select: { nombre: true, telefono: true } },
  entrega: { select: { direccionTexto: true, estado: true } },
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
          historial: { create: { estadoNuevo: pedido.estado, usuarioId: creadoPorId } },
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

  listar(estados: EstadoPedido[]) {
    return this.prisma.pedido.findMany({ where: { estado: { in: estados } }, orderBy: { creadoEn: 'asc' }, select: VISTA, take: 200 });
  }

  async cambiarEstado(id: string, desde: EstadoPedido, hasta: EstadoPedido, usuarioId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.pedido.updateMany({ where: { id, estado: desde }, data: { estado: hasta } });
      if (count === 0) return false;
      await tx.historialEstadoPedido.create({ data: { pedidoId: id, estadoAntes: desde, estadoNuevo: hasta, usuarioId } });
      // La entrega de un domicilio sigue al pedido
      if (hasta === 'EN_CAMINO') await tx.entrega.updateMany({ where: { pedidoId: id }, data: { estado: 'EN_CAMINO' } });
      if (hasta === 'ENTREGADO') await tx.entrega.updateMany({ where: { pedidoId: id }, data: { estado: 'ENTREGADA', entregadaEn: new Date() } });
      return true;
    });
  }
}
