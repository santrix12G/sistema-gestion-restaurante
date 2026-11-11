import { Inject, Injectable } from '@nestjs/common';
import { UsuarioActual } from '../../identidad';
import { DomainError } from '../../../shared/domain-error';
import { BusEventos } from '../../../shared/eventos';
import { EstadoCierre, PedidoParaPermisos, validarCierre, validarTomaDomicilio } from '../domain/pedido';
import { aEvento, PEDIDO_REPOSITORY, PedidoRepository, PedidoVista } from './pedido.repository';

const paraPermisos = (p: PedidoVista): PedidoParaPermisos => ({
  estado: p.estado,
  tipo: p.tipo,
  creadoPorId: p.creadoPor?.id ?? null,
  repartidorId: p.entrega?.repartidor?.id ?? null,
});

/** Marca un pedido como pagado o cancelado, y saca domicilios a reparto. */
@Injectable()
export class ActualizarEstadoPedidoUseCase {
  constructor(
    @Inject(PEDIDO_REPOSITORY) private readonly pedidos: PedidoRepository,
    private readonly bus: BusEventos,
  ) {}

  async ejecutar(id: string, nuevo: EstadoCierre, usuario: UsuarioActual): Promise<PedidoVista> {
    const pedido = await this.obtener(id);
    validarCierre(paraPermisos(pedido), nuevo, usuario.rol, usuario.id);
    // Si dos personas actúan a la vez sobre el mismo pedido, solo gana la primera
    if (!(await this.pedidos.cerrar(id, nuevo, usuario.id))) throw new DomainError('conflicto', 'Otra persona cambió este pedido. Actualiza la pantalla');

    const actualizado = await this.obtener(id);
    this.bus.publicar('pedido.estado_cambiado', { ...aEvento(actualizado), estadoAnterior: pedido.estado });
    return actualizado;
  }

  /** El repartidor toma el domicilio: queda a su nombre y solo él puede cerrarlo. */
  async tomarDomicilio(id: string, usuario: UsuarioActual): Promise<PedidoVista> {
    const pedido = await this.obtener(id);
    validarTomaDomicilio(paraPermisos(pedido), usuario.rol, usuario.id);
    if (!(await this.pedidos.tomarDomicilio(id, usuario.id))) throw new DomainError('conflicto', 'Otro repartidor ya tomó este domicilio. Actualiza la pantalla');

    const actualizado = await this.obtener(id);
    this.bus.publicar('pedido.en_camino', { ...aEvento(actualizado), repartidor: usuario.nombre });
    return actualizado;
  }

  private async obtener(id: string) {
    const pedido = await this.pedidos.obtener(id);
    if (!pedido) throw new DomainError('no_encontrado', 'El pedido no existe');
    return pedido;
  }
}
