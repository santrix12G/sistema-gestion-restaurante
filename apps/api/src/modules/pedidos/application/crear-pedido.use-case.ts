import { Inject, Injectable } from '@nestjs/common';
import { CatalogoService } from '../../catalogo';
import { ClientesService } from '../../clientes';
import { UsuarioActual } from '../../identidad';
import { DomainError } from '../../../shared/domain-error';
import { BusEventos } from '../../../shared/eventos';
import { PrismaService } from '../../../shared/prisma.service';
import { armarPedido, ItemSolicitado } from './lineas-pedido';
import { aEvento, PEDIDO_REPOSITORY, PedidoRepository, PedidoVista } from './pedido.repository';

export interface SolicitudPedidoLocal {
  tipo: 'MESA' | 'RECOGER';
  mesaId?: string;
  cliente?: { telefono: string; nombre?: string };
  items: ItemSolicitado[];
  notas?: string;
  claveIdempotencia?: string;
}

/** Pedido que registra el personal desde la web: en mesa o para recoger. Queda confirmado de una vez. */
@Injectable()
export class CrearPedidoUseCase {
  constructor(
    @Inject(PEDIDO_REPOSITORY) private readonly pedidos: PedidoRepository,
    private readonly catalogo: CatalogoService,
    private readonly clientes: ClientesService,
    private readonly prisma: PrismaService,
    private readonly bus: BusEventos,
  ) {}

  async ejecutar(solicitud: SolicitudPedidoLocal, usuario: UsuarioActual): Promise<PedidoVista> {
    if (solicitud.claveIdempotencia) {
      const existente = await this.pedidos.buscarPorClave(solicitud.claveIdempotencia);
      if (existente) return existente;
    }

    let mesaId: string | undefined;
    let clienteId: string | undefined;
    if (solicitud.tipo === 'MESA') {
      if (!solicitud.mesaId) throw new DomainError('validacion', 'Elige la mesa del pedido');
      const mesa = await this.prisma.mesa.findUnique({ where: { id: solicitud.mesaId } });
      if (!mesa?.activa) throw new DomainError('validacion', 'La mesa no existe o no está activa');
      mesaId = mesa.id;
    } else {
      if (!solicitud.cliente?.telefono) throw new DomainError('validacion', 'Un pedido para recoger necesita el teléfono del cliente');
      clienteId = (await this.clientes.obtenerOCrear(solicitud.cliente.telefono, solicitud.cliente.nombre)).id;
    }

    const totales = await armarPedido(this.catalogo, solicitud.items);
    const pedido = await this.pedidos.crear({
      tipo: solicitud.tipo,
      canal: 'WEB',
      estado: 'CONFIRMADO',
      mesaId,
      clienteId,
      creadoPorId: usuario.id,
      claveIdempotencia: solicitud.claveIdempotencia,
      notas: solicitud.notas?.trim() || undefined,
      ...totales,
    });
    this.bus.publicar('pedido.creado', aEvento(pedido));
    return pedido;
  }
}
