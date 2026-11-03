import { Inject, Injectable } from '@nestjs/common';
import { CatalogoService } from '../../catalogo';
import { ClientesService } from '../../clientes';
import { UsuarioActual } from '../../identidad';
import { DomainError } from '../../../shared/domain-error';
import { PrismaService } from '../../../shared/prisma.service';
import { calcularTotales } from '../domain/pedido';
import { PEDIDO_REPOSITORY, PedidoRepository, PedidoVista } from './pedido.repository';

export interface SolicitudPedidoLocal {
  tipo: 'MESA' | 'RECOGER';
  mesaId?: string;
  cliente?: { telefono: string; nombre?: string };
  items: { productoId: string; cantidad: number; notas?: string }[];
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

    const productos = await this.catalogo.productosParaVenta([...new Set(solicitud.items.map((i) => i.productoId))]);
    const lineas = solicitud.items.map((item) => {
      const producto = productos.get(item.productoId)!;
      if (!producto.disponible) throw new DomainError('conflicto', `${producto.nombre} no está disponible en este momento`);
      return { productoId: producto.id, nombre: producto.nombre, precioUnitario: producto.precio, cantidad: item.cantidad, notas: item.notas?.trim() || undefined };
    });
    const totales = calcularTotales(lineas);

    return this.pedidos.crear({
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
  }
}
