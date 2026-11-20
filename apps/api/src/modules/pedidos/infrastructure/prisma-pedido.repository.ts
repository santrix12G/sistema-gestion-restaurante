import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from '../../../shared/domain-error';
import { PrismaService } from '../../../shared/prisma.service';
import { MetodoCobro } from '../../caja';
import { Alcance, EstadoCierre, EstadoPedido } from '../domain/pedido';
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
  mesa: { select: { tipo: true, numero: true } },
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
  // Solo lectura: los pagos son del módulo de pagos. Aquí basta el último pago en línea para mostrarlo en la tarjeta
  pagos: { where: { metodo: 'ONLINE' }, orderBy: { creadoEn: 'desc' }, take: 1, select: { estado: true } },
} satisfies Prisma.PedidoSelect;

function filtroDe(alcance: Alcance): Prisma.PedidoWhereInput {
  switch (alcance.tipo) {
    case 'todos':
      return {};
    case 'registrados_por':
      return { creadoPorId: alcance.usuarioId };
    case 'domicilios_de':
      return {
        tipo: 'DOMICILIO',
        entrega: alcance.incluirLibres
          ? { OR: [{ repartidorId: alcance.repartidorId }, { repartidorId: null }] }
          : { repartidorId: alcance.repartidorId },
      };
  }
}

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

  listar({ estados, alcance, cerradosDesde }: { estados: EstadoPedido[]; alcance: Alcance; cerradosDesde?: Date }) {
    return this.prisma.pedido.findMany({
      // Un pedido cerrado ya no cambia: su última actualización es la hora en que se cerró
      where: { estado: { in: estados }, ...(cerradosDesde && { actualizadoEn: { gte: cerradosDesde } }), ...filtroDe(alcance) },
      orderBy: cerradosDesde ? { actualizadoEn: 'desc' } : { creadoEn: 'asc' },
      select: VISTA,
      take: 300,
    });
  }

  async cerrar(id: string, hasta: EstadoCierre, usuarioId: string, metodo: MetodoCobro): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.pedido.updateMany({ where: { id, estado: 'ACTIVO' }, data: { estado: hasta } });
      if (count === 0) return false;
      if (hasta === 'PAGADO') await this.registrarCobro(tx, id, usuarioId, metodo);
      await tx.historialEstadoPedido.create({ data: { pedidoId: id, estadoAntes: 'ACTIVO', estadoNuevo: hasta, usuarioId } });
      // La entrega de un domicilio sigue al pedido: pagado es entregado; cancelado en camino es una entrega fallida
      if (hasta === 'PAGADO') await tx.entrega.updateMany({ where: { pedidoId: id }, data: { estado: 'ENTREGADA', entregadaEn: new Date() } });
      else await tx.entrega.updateMany({ where: { pedidoId: id, repartidorId: { not: null } }, data: { estado: 'FALLIDA' } });
      return true;
    });
  }

  /** Si lanza un error, la transacción se deshace y el pedido sigue activo */
  private async registrarCobro(tx: Prisma.TransactionClient, pedidoId: string, usuarioId: string, metodo: MetodoCobro) {
    const caja = await tx.caja.findFirst({ where: { cerradaEn: null }, select: { id: true } });
    const enLinea = await tx.pago.findFirst({ where: { pedidoId, metodo: 'ONLINE', estado: 'APROBADO' }, select: { id: true, cajaId: true } });
    if (enLinea) {
      // Ya se pagó en línea: no entra dinero, pero la venta queda en el turno en que se entregó
      if (caja && !enLinea.cajaId) await tx.pago.update({ where: { id: enLinea.id }, data: { cajaId: caja.id } });
      return;
    }
    if (!caja) throw new DomainError('conflicto', 'La caja está cerrada. El administrador debe abrirla para poder cobrar');
    const { total } = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, select: { total: true } });
    await tx.pago.create({ data: { pedidoId, metodo, estado: 'APROBADO', monto: total, cajaId: caja.id, cobradoPorId: usuarioId } });
  }

  async tomarDomicilio(id: string, repartidorId: string): Promise<boolean> {
    const { count } = await this.prisma.entrega.updateMany({
      where: { pedidoId: id, repartidorId: null, pedido: { estado: 'ACTIVO' } },
      data: { repartidorId, estado: 'EN_CAMINO', asignadaEn: new Date() },
    });
    return count > 0;
  }
}
