import { Inject, Injectable } from '@nestjs/common';
import { CatalogoService } from '../../catalogo';
import { ClientesService } from '../../clientes';
import { leerConfig } from '../../../shared/config';
import { DomainError } from '../../../shared/domain-error';
import { BusEventos } from '../../../shared/eventos';
import { armarPedido, ItemSolicitado } from './lineas-pedido';
import { aEvento, PEDIDO_REPOSITORY, PedidoRepository, PedidoVista } from './pedido.repository';

export interface SolicitudPedidoCliente {
  canal: 'WHATSAPP' | 'TELEGRAM' | 'MOVIL';
  clienteId: string;
  tipo: 'DOMICILIO' | 'RECOGER';
  direccion?: string;
  items: ItemSolicitado[];
  notas?: string;
  /** Obligatoria: los canales del cliente reintentan, y el reintento no debe duplicar el pedido */
  claveIdempotencia: string;
}

/**
 * Pedido que hace el propio cliente, por WhatsApp o, más adelante, por la app móvil.
 * Por ahora el pago es en efectivo al recibir, así que entra confirmado.
 */
@Injectable()
export class CrearPedidoClienteUseCase {
  private readonly costoDomicilio = leerConfig().costoDomicilio;

  constructor(
    @Inject(PEDIDO_REPOSITORY) private readonly pedidos: PedidoRepository,
    private readonly catalogo: CatalogoService,
    private readonly clientes: ClientesService,
    private readonly bus: BusEventos,
  ) {}

  async ejecutar(solicitud: SolicitudPedidoCliente): Promise<PedidoVista> {
    const existente = await this.pedidos.buscarPorClave(solicitud.claveIdempotencia);
    if (existente) return existente;

    let entrega: { direccionId: string; direccionTexto: string } | undefined;
    if (solicitud.tipo === 'DOMICILIO') {
      if (!solicitud.direccion?.trim()) throw new DomainError('validacion', 'Un domicilio necesita la dirección de entrega');
      const direccion = await this.clientes.guardarDireccion(solicitud.clienteId, solicitud.direccion);
      entrega = { direccionId: direccion.id, direccionTexto: direccion.texto };
    }

    const totales = await armarPedido(this.catalogo, solicitud.items, solicitud.tipo === 'DOMICILIO' ? this.costoDomicilio : 0);
    const pedido = await this.pedidos.crear({
      tipo: solicitud.tipo,
      canal: solicitud.canal,
      estado: 'CONFIRMADO',
      clienteId: solicitud.clienteId,
      claveIdempotencia: solicitud.claveIdempotencia,
      entrega,
      notas: solicitud.notas?.trim() || undefined,
      ...totales,
    });
    this.bus.publicar('pedido.creado', aEvento(pedido));
    return pedido;
  }
}
