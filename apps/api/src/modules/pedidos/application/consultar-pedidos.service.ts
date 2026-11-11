import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../shared/domain-error';
import { inicioDelDia } from '../../../shared/fecha';
import { UsuarioActual } from '../../identidad';
import { alcanceDe, EstadoPedido, puedeVer } from '../domain/pedido';
import { PEDIDO_REPOSITORY, PedidoRepository } from './pedido.repository';

@Injectable()
export class ConsultarPedidosService {
  constructor(
    @Inject(PEDIDO_REPOSITORY) private readonly pedidos: PedidoRepository,
  ) {}

  /** Los pedidos que el usuario puede ver: activos, todos; pagados y cancelados, solo los cerrados hoy. */
  listar(usuario: UsuarioActual, estados: EstadoPedido[] = ['ACTIVO']) {
    const soloActivos = estados.every((e) => e === 'ACTIVO');
    return this.pedidos.listar({
      estados,
      alcance: alcanceDe(usuario.rol, usuario.id, estados),
      cerradosDesde: soloActivos ? undefined : inicioDelDia(),
    });
  }

  async obtener(id: string, usuario: UsuarioActual) {
    const pedido = await this.pedidos.obtener(id);
    // A quien no puede verlo se le responde igual que si no existiera
    const visible = pedido && puedeVer({ ...pedido, creadoPorId: pedido.creadoPor?.id, repartidorId: pedido.entrega?.repartidor?.id }, usuario.rol, usuario.id);
    if (!pedido || !visible) throw new DomainError('no_encontrado', 'El pedido no existe');
    return pedido;
  }
}
