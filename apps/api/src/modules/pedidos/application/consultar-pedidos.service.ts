import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../shared/domain-error';
import { PrismaService } from '../../../shared/prisma.service';
import { inicioDelDia } from '../../../shared/fecha';
import { EstadoPedido } from '../domain/pedido';
import { PEDIDO_REPOSITORY, PedidoRepository } from './pedido.repository';

@Injectable()
export class ConsultarPedidosService {
  constructor(
    @Inject(PEDIDO_REPOSITORY) private readonly pedidos: PedidoRepository,
    private readonly prisma: PrismaService,
  ) {}

  /** Los pedidos activos, todos. Los pagados y cancelados, solo los de hoy. */
  listar(estados: EstadoPedido[] = ['ACTIVO']) {
    const soloActivos = estados.every((e) => e === 'ACTIVO');
    return this.pedidos.listar({ estados, desde: soloActivos ? undefined : inicioDelDia() });
  }

  async obtener(id: string) {
    const pedido = await this.pedidos.obtener(id);
    if (!pedido) throw new DomainError('no_encontrado', 'El pedido no existe');
    return pedido;
  }

  /** Mesas activas, con cuántos pedidos abiertos tiene cada una. */
  async mesas() {
    const mesas = await this.prisma.mesa.findMany({
      where: { activa: true },
      orderBy: { numero: 'asc' },
      include: { _count: { select: { pedidos: { where: { estado: 'ACTIVO' } } } } },
    });
    return mesas.map(({ _count, ...mesa }) => ({ ...mesa, pedidosActivos: _count.pedidos }));
  }
}
