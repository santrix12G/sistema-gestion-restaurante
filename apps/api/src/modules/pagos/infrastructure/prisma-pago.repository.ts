import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma.service';
import { EstadoPago } from '../domain/pago';
import { NuevoPagoEnLinea, PagoGuardado, PagoRepository } from '../application/pago.repository';

const VISTA = { id: true, pedidoId: true, estado: true, monto: true, urlPago: true, creadoEn: true } as const;

@Injectable()
export class PrismaPagoRepository implements PagoRepository {
  constructor(private readonly prisma: PrismaService) {}

  crearEnLinea(pago: NuevoPagoEnLinea): Promise<PagoGuardado> {
    return this.prisma.pago.create({ data: { ...pago, metodo: 'ONLINE', estado: 'PENDIENTE' }, select: VISTA });
  }

  obtener(id: string): Promise<PagoGuardado | null> {
    return this.prisma.pago.findUnique({ where: { id }, select: VISTA });
  }

  ultimoEnLinea(pedidoId: string): Promise<PagoGuardado | null> {
    return this.prisma.pago.findFirst({ where: { pedidoId, metodo: 'ONLINE' }, orderBy: { creadoEn: 'desc' }, select: VISTA });
  }

  async cambiarEstado(id: string, desde: EstadoPago, hasta: EstadoPago): Promise<boolean> {
    // La condición sobre el estado actual evita que dos avisos simultáneos se pisen
    const { count } = await this.prisma.pago.updateMany({ where: { id, estado: desde }, data: { estado: hasta } });
    return count === 1;
  }
}
