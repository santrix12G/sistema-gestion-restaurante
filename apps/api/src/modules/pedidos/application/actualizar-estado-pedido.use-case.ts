import { Inject, Injectable } from '@nestjs/common';
import { UsuarioActual } from '../../identidad';
import { DomainError } from '../../../shared/domain-error';
import { BusEventos } from '../../../shared/eventos';
import { EstadoPedido, validarCambioEstado } from '../domain/pedido';
import { aEvento, PEDIDO_REPOSITORY, PedidoRepository, PedidoVista } from './pedido.repository';

@Injectable()
export class ActualizarEstadoPedidoUseCase {
  constructor(
    @Inject(PEDIDO_REPOSITORY) private readonly pedidos: PedidoRepository,
    private readonly bus: BusEventos,
  ) {}

  async ejecutar(id: string, nuevo: EstadoPedido, usuario: UsuarioActual): Promise<PedidoVista> {
    const pedido = await this.pedidos.obtener(id);
    if (!pedido) throw new DomainError('no_encontrado', 'El pedido no existe');

    validarCambioEstado({ ...pedido, repartidorId: pedido.entrega?.repartidor?.id }, nuevo, usuario.rol, usuario.id);
    // El repartidor que saca el domicilio queda a cargo de entregarlo
    const repartidorId = nuevo === 'EN_CAMINO' && usuario.rol === 'REPARTIDOR' ? usuario.id : undefined;
    // Si dos personas actúan a la vez sobre el mismo pedido, solo gana la primera
    const cambiado = await this.pedidos.cambiarEstado(id, pedido.estado, nuevo, usuario.id, repartidorId);
    if (!cambiado) throw new DomainError('conflicto', 'Otra persona cambió este pedido. Actualiza la pantalla');

    const actualizado = (await this.pedidos.obtener(id))!;
    this.bus.publicar('pedido.estado_cambiado', { ...aEvento(actualizado), estadoAnterior: pedido.estado });
    return actualizado;
  }
}
